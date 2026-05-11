import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { db, FieldValue, getOpenAI, sendPushToUser } from "./base";
import { getEconomyConfig } from "./wallet";

/**
 * Shared helper to calculate total compatibility tokens and determine which field to decrement.
 * Priority: compatibilityCount > analysisCount > social.compatibilityCredits
 */
function getCompatibilityBalance(user: any) {
  const cCount = Math.max(0, Number(user?.compatibilityCount || 0));
  const aCount = Math.max(0, Number(user?.analysisCount || 0));
  const sCount = Math.max(0, Number(user?.social?.compatibilityCredits || 0));
  
  const total = cCount + aCount + sCount;
  let field: string | null = null;
  
  if (cCount > 0) field = 'compatibilityCount';
  else if (aCount > 0) field = 'analysisCount';
  else if (sCount > 0) field = 'social.compatibilityCredits';
  
  return { total, field };
}

// 1. Complete Social Onboarding
export const completeSocialOnboarding = functions.region('us-central1').https.onCall(async (data, context) => {
  console.log("AUDIT: completeSocialOnboarding started. Data received:", JSON.stringify(data));
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    
    const { 
      nickname = "", gender = "erkek", lookingFor = "", birthDate = "", 
      interests = [], photos = [], bio = "",
      zodiacSign = "", element = "", rulingPlanet = "", planet = "", 
      friendlySign = "", enemySign = "",
      age = 0, mysticAnimal = "", luckyNumber = "", luckyColor = ""
    } = data || {};

    // Explicitly handle nulls and ensure arrays
    const finalInterests = Array.isArray(interests) ? interests : [];
    const finalPhotos = Array.isArray(photos) ? photos : [];
    const finalAge = (typeof age === 'number' && !isNaN(age)) ? age : Number(age) || 0;

    console.log("AUDIT: Hardened fields:", { 
      nickname, gender, lookingFor, birthDate, 
      interestsCount: finalInterests.length, 
      photosCount: finalPhotos.length, 
      bioLength: bio?.length,
      finalAge
    });

    if (!nickname || !gender || !birthDate) {
      console.log("AUDIT: Fast Track Validation failed.");
      throw new functions.https.HttpsError('invalid-argument', 'Lütfen temel bilgileri (İsim, Cinsiyet, Doğum Tarihi) doldurun.');
    }

    const finalLookingFor = lookingFor || (gender === 'erkek' ? 'kadın' : 'erkek');
    const finalBio = String(bio || "");

    console.log("AUDIT: Fast Track Hardened fields:", { 
      nickname, gender, lookingFor: finalLookingFor, birthDate, 
      interestsCount: finalInterests.length, 
      photosCount: finalPhotos.length, 
      bioLength: finalBio.length,
      finalAge
    });

    const userRef = db.collection("users").doc(userId);

    return await db.runTransaction(async (transaction) => {
      console.log("AUDIT: Fast Track Transaction started.");
      const userSnap = await transaction.get(userRef);
      
      const socialData: any = {
        nickname: String(nickname),
        gender: String(gender),
        lookingFor: String(finalLookingFor),
        interests: finalInterests,
        photos: finalPhotos,
        bio: finalBio,
        enabled: true,
        profileCompleted: true,
        visible: true,
        banned: false,
        lastOnboardingAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        settings: {
          whoCanMessage: 'everyone',
          whoCanAddFriend: 'everyone',
          notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true }
        }
      };

      const baseData: any = {
        nickname: String(nickname),
        gender: String(gender),
        lookingFor: String(finalLookingFor),
        interests: finalInterests,
        photos: finalPhotos,
        bio: finalBio,
        birthDate: String(birthDate),
        zodiacSign: String(zodiacSign || ""),
        element: String(element || ""),
        rulingPlanet: String(rulingPlanet || planet || ""),
        friendlySign: String(friendlySign || ""),
        enemySign: String(enemySign || ""),
        age: finalAge,
        mysticAnimal: String(mysticAnimal || ""),
        luckyNumber: String(luckyNumber || ""),
        luckyColor: String(luckyColor || ""),
        updatedAt: FieldValue.serverTimestamp(),
        social: socialData
      };

      console.log("AUDIT: baseData before cleaning:", JSON.stringify(baseData));

      // Deep clean function
      const cleanData = (obj: any) => {
        Object.keys(obj).forEach(key => {
          if (obj[key] === undefined) delete obj[key];
          else if (obj[key] && typeof obj[key] === 'object' && !(obj[key] instanceof admin.firestore.FieldValue)) {
            cleanData(obj[key]);
          }
        });
      };

      cleanData(baseData);

      if (!userSnap.exists) {
        baseData.createdAt = FieldValue.serverTimestamp(); 
        baseData.uid = userId; 
        baseData.email = context.auth?.token.email || "";
        baseData.displayName = String(nickname); 
        baseData.photoURL = finalPhotos[0] || "";
        baseData.energy = 50; 
        baseData.mainCoins = 0;
        baseData.superLikes = 0; 
        baseData.refreshCount = 0; 
        baseData.compatibilityCount = 0;
        
        console.log("AUDIT: transaction.set (new user)");
        transaction.set(userRef, baseData);
      } else {
        console.log("AUDIT: transaction.set (merge)");
        transaction.set(userRef, baseData, { merge: true });
      }
      return { success: true };
    });
  } catch (error: any) {
    console.error("completeSocialOnboarding failure:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Profil oluşturulurken teknik bir hata oluştu.', error);
  }
});

// 2. Update Social Profile
export const updateSocialProfile = functions.region('us-central1').https.onCall(async (data, context) => {
  // STEP 3: Log auth for debugging
  console.log("updateSocialProfile AUTH CONTEXT:", context.auth ? { uid: context.auth.uid, email: context.auth.token.email } : "NULL");

  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const { nickname, bio, gender, zodiacSign, photos, interests, birthDate, isOnline, lastSeen } = data;
    const userRef = db.collection("users").doc(userId);
    
    // Construct a clean update object for nested merging
    const baseUpdates: any = {};
    const socialUpdates: any = {};
    
    // Explicit guards to prevent undefined writes and maintain structure
    if (nickname !== undefined && nickname !== null) {
      if (typeof nickname !== 'string') throw new functions.https.HttpsError('invalid-argument', 'Nickname geçersiz.');
      if (nickname.length > 50) throw new functions.https.HttpsError('invalid-argument', 'Nickname çok uzun.');
      socialUpdates.nickname = nickname;
      baseUpdates.nickname = nickname;
      baseUpdates.displayName = nickname;
    }
    if (bio !== undefined && bio !== null) {
      if (typeof bio !== 'string') throw new functions.https.HttpsError('invalid-argument', 'Bio geçersiz.');
      if (bio.length > 500) throw new functions.https.HttpsError('invalid-argument', 'Bio çok uzun.');
      socialUpdates.bio = bio;
      baseUpdates.bio = bio;
    }
    if (gender !== undefined && gender !== null) {
      socialUpdates.gender = gender;
      baseUpdates.gender = gender;
    }
    if (zodiacSign !== undefined && zodiacSign !== null) {
      socialUpdates.zodiacSign = zodiacSign;
      baseUpdates.zodiacSign = zodiacSign;
    }
    if (photos !== undefined && photos !== null) {
      if (!Array.isArray(photos) || photos.length > 6) throw new functions.https.HttpsError('invalid-argument', 'Geçersiz fotoğraf listesi.');
      socialUpdates.photos = photos;
      baseUpdates.photos = photos;
      if (photos.length > 0) baseUpdates.photoURL = photos[0];
    }
    if (interests !== undefined && interests !== null) {
      if (!Array.isArray(interests)) throw new functions.https.HttpsError('invalid-argument', 'İlgi alanları geçersiz.');
      socialUpdates.interests = interests;
      baseUpdates.interests = interests;
    }
    if (birthDate !== undefined && birthDate !== null) {
      socialUpdates.birthDate = birthDate;
      baseUpdates.birthDate = birthDate;
    }
    
    if (isOnline !== undefined && isOnline !== null) socialUpdates.isOnline = !!isOnline;
    if (lastSeen !== undefined && lastSeen !== null) {
      socialUpdates.lastSeen = FieldValue.serverTimestamp();
      baseUpdates.lastSeenAt = FieldValue.serverTimestamp();
    }

    const updates: any = { ...baseUpdates };
    if (Object.keys(socialUpdates).length > 0) {
      updates.social = socialUpdates;
    }

    if (Object.keys(updates).length === 0) return { success: true, status: 'SUCCESS', message: 'No changes' };

    updates["updatedAt"] = FieldValue.serverTimestamp();
    
    // Use set with merge: true for nested object blending
    await userRef.set(updates, { merge: true });
    
    // Check Profile Completion for rewards/notifications
    const updatedSnap = await userRef.get();
    const userData = updatedSnap.data();
    if (userData?.social) {
      const completion = calculateProfileCompletion(userData.social);
      if (completion === 100 && !userData.social.rewardClaimed) {
         // Notify about 100% completion if not already notified
         const lastCompNotifAt = userData.social.notifications?.lastProfileCompletedNotifAt;
         const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
         if (!lastCompNotifAt || lastCompNotifAt.toMillis() < oneDayAgo) {
            const notifRef = db.collection("notifications").doc();
            await notifRef.set({
              userId,
              type: "profile_completed",
              title: "Profilin Tamamlandı! ✨",
              message: "Harika görünüyorsun! Ödülünü Görev Merkezi'nden alabilirsin.",
              read: false,
              createdAt: FieldValue.serverTimestamp()
            });
            await userRef.set({
              social: { notifications: { lastProfileCompletedNotifAt: FieldValue.serverTimestamp() } }
            }, { merge: true });
            await sendPushToUser(userId, {
               title: "Profilin Tamamlandı! ✨",
               body: "Harika görünüyorsun! Ödülünü Görev Merkezi'nden alabilirsin.",
               category: "status"
            });
         }
      }
    }
    
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    // STEP 4: Log detailed error
    console.error("REAL ERROR in updateSocialProfile:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    
    // Log details and throw internal error with safe message
    const message = error.message || 'Profil güncellenirken bir hata oluştu.';
    throw new functions.https.HttpsError('internal', message, error.stack);
  }
});

// 3. Update Social Settings
export const updateSocialSettings = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.settings) throw new functions.https.HttpsError('invalid-argument', 'Ayarlar gerekli.');
    const { settings } = data;
    const userRef = db.collection("users").doc(userId);
    const allowedFields = ['visibility', 'discoveryEnabled', 'notificationsEnabled', 'genderPreference', 'minAge', 'maxAge', 'whoCanMessage', 'whoCanAddFriend', 'notifications', 'enabled', 'visible'];
    const updates: any = {};
    Object.keys(settings).forEach(key => {
      if (allowedFields.includes(key)) {
        if (key === 'enabled' || key === 'visible') updates[`social.${key}`] = settings[key];
        else updates[`social.settings.${key}`] = settings[key];
      }
    });
    if (Object.keys(updates).length > 0) {
      updates["updatedAt"] = FieldValue.serverTimestamp();
      await userRef.set(updates, { merge: true });
    }
    return { success: true };
  } catch (error: any) {
    console.error("updateSocialSettings error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Ayarlar güncellenirken hata oluştu.');
  }
});

// 4. Refresh Discover Feed
export const refreshDiscover = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  console.log(`[refreshDiscover] DEBUG START: function called by auth uid=${userId}`);
  
  try {
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    const nowIso = now.toISOString();

    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;
    const gender = userData.social?.gender || userData.gender || "";
    const lookingFor = userData.social?.lookingFor || userData.lookingFor || "";
    let targetGender = "";
    
    const mode = data?.mode || 'discover';

    const lfLower = String(lookingFor).toLowerCase();
    if (mode === 'match') {
      targetGender = gender === 'erkek' ? 'kadın' : gender === 'kadın' ? 'erkek' : "";
    } else {
      if (lfLower === "erkek" || lfLower === "male" || lfLower === "man" || lfLower === "adam") {
        targetGender = "erkek";
      } else if (lfLower === "kadın" || lfLower === "kadin" || lfLower === "female" || lfLower === "woman" || lfLower === "bayan") {
        targetGender = "kadın";
      } else if (lfLower === "herkes" || lfLower === "all" || lfLower === "arkadaş" || lfLower === "arkadas") {
        targetGender = ""; // No gender filter
      } else {
        targetGender = gender === 'erkek' ? 'kadın' : gender === 'kadın' ? 'erkek' : "";
      }
    }
    
    console.log(`[refreshDiscover] userId: ${userId}, gender: ${gender}, lookingFor: ${lookingFor}, targetGenderQuery: ${targetGender || 'ALL'}`);
    console.log(`[refreshDiscover] DEBUG START: userId=${userId}, gender=${gender}, lookingFor=${lookingFor}, targetGenderQuery=${targetGender || 'ALL'}, mode=${mode}`);

    // Perform swipes check outside transaction to gather exclusion context rapidly
    const swipesSnap = await db.collection("swipes")
      .where("fromUserId", "==", userId)
      .limit(800) // Safety limit, optimize memory/read
      .get();
      
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const swipedUserIds = swipesSnap.docs
      .filter(d => {
        const data = d.data();
        if (data.type !== 'pass') return true; // always exclude likes/superlikes
        if (mode === 'discover') return false; // Bug 5 fix: Do NOT exclude passes from Discover
        const createdAt = data.createdAt?.toMillis?.() || 0;
        if (createdAt && createdAt < thirtyDaysAgo) return false; // forget old passes
        return true;
      })
      .map(d => d.data().toUserId);
      
    const exclusionList = new Set([userId, ...swipedUserIds]); 

    let usersQuery = db.collection("users")
      .where("social.enabled", "==", true)
      .where("social.visible", "==", true);
      
    if (targetGender) {
      usersQuery = usersQuery.where("social.gender", "==", targetGender);
    }
    
    // Optimization: Use a larger limit to guarantee we find non-excluded people
    const queryLimit = 250; 
    const usersSnap = await usersQuery.limit(queryLimit).get();
    
    console.log(`[refreshDiscover] DEBUG RAW USERS COUNT: ${usersSnap.docs.length}`);
    console.log(`[refreshDiscover] DEBUG SWIPES EXCLUDED COUNT: ${swipedUserIds.length}`);

    const result = await db.runTransaction(async (transaction) => {
      const tUserSnap = await transaction.get(userRef);
      if (!tUserSnap.exists) throw new Error("Kullanıcı bulunamadı.");
      const tUserData = tUserSnap.data() as any;
      const lastFree = tUserData.social?.lastFreeRefreshAt;
      const isFreeAvailable = !lastFree || (now.getTime() - new Date(lastFree).getTime() >= 24 * 60 * 60 * 1000);

      
      let status = 'SUCCESS';
      let updates: any = {};
      
      if (mode === 'match') {
        status = 'MATCH_MODE';
      } else {
        updates["social.lastDiscoverRefreshAt"] = nowIso;
        if (isFreeAvailable) {
          status = 'FREE_REFRESH_USED'; 
          updates["social.lastFreeRefreshAt"] = nowIso;
        } else {
          if ((tUserData.refreshCount || 0) <= 0) return { success: false, status: 'INSUFFICIENT_FUNDS' };
          status = 'PAID_REFRESH_USED'; 
          updates["refreshCount"] = FieldValue.increment(-1);
        }
      }

      const mapUserDoc = (doc: any) => {
        const d = doc.data() as any;
        return {
          id: doc.id,
          uid: doc.id,
          nickname: d.social?.nickname || d.displayName || "Kullanıcı",
          age: d.age || d.social?.age || 0,
          gender: d.social?.gender || d.gender || "",
          photoURL: d.social?.photos?.[0] || d.photoURL || "",
          zodiacSign: d.zodiacSign || d.social?.zodiacSign || "",
          element: d.element || "",
          birthDate: d.birthDate || d.social?.birthDate || "",
          bio: d.social?.bio || d.bio || "",
          lookingFor: d.social?.lookingFor || d.lookingFor || "",
          socialLookingFor: d.social?.lookingFor || "",
          socialGender: d.social?.gender || "",
          interests: d.social?.interests || d.interests || [],
          photos: d.social?.photos || [],
          verified: d.social?.verified || false,
          profileCompleted: d.social?.profileCompleted || false,
          level: d.level || d.social?.level || 0,
          boostExpiresAt: d.social?.boostExpiresAt || d.boostExpiresAt || ""
        };
      };

      let available = usersSnap.docs
        .filter(doc => !exclusionList.has(doc.id))
        .map(mapUserDoc);
        
      if (available.length < 5 && usersSnap.docs.length > 0) {
        console.warn(`[refreshDiscover] WARNING: only ${available.length} users left for ${userId}! Allowing swiped users to prevent soft-lock.`);
        // Fall back to self-only exclusion so app doesn't break
        const selfExclusion = new Set([userId]);
        available = usersSnap.docs
          .filter(doc => !selfExclusion.has(doc.id))
          .map(mapUserDoc);
      }
      
      available = available.sort((a,b) => {
          const aBoost = a.boostExpiresAt ? new Date(a.boostExpiresAt).getTime() : 0;
          const bBoost = b.boostExpiresAt ? new Date(b.boostExpiresAt).getTime() : 0;
          const nowTime = Date.now();
          const aIsBoosted = aBoost > nowTime;
          const bIsBoosted = bBoost > nowTime;
          
          if (aIsBoosted && !bIsBoosted) return -1;
          if (bIsBoosted && !aIsBoosted) return 1;
          return Math.random() - 0.5; // Natural random for the rest
      }).slice(0, 20);
      
      // Removed recentDiscoverIds update to prevent unswiped users from being permanently excluded just because they were fetched
      if (Object.keys(updates).length > 0) {
        transaction.update(userRef, updates);
      }
      
      console.log(`[refreshDiscover] DEBUG FINAL RETURNED COUNT: ${available.length}, UID LIST: ${available.map((u: any) => u.uid).join(',')}`);

      return { success: true, status, users: available };
    });

    return result;
  } catch (error: any) {
    console.error("[refreshDiscover] Error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Keşfet yenilenirken hata oluştu.');
  }
});

export const refreshDiscoverFeed = refreshDiscover;

// 5. Send Like
export const sendLike = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
  
  const fromUserId = context.auth.uid;
  const { targetUserId, type, source } = data; // type: 'like', 'super_like', 'pass', source: 'discover' | 'match'

  if (!targetUserId || !['like', 'super_like', 'pass'].includes(type) || fromUserId === targetUserId) {
    throw new functions.https.HttpsError('invalid-argument', 'Geçersiz işlem parametreleri.');
  }

  try {
    const fromUserRef = db.collection("users").doc(fromUserId);
    const toUserRef = db.collection("users").doc(targetUserId);

    const result = await db.runTransaction(async (transaction) => {
      const [fromSnap, toSnap] = await Promise.all([transaction.get(fromUserRef), transaction.get(toUserRef)]);
      if (!fromSnap.exists || !toSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");

      const fromData = fromSnap.data() as any;
      const toData = toSnap.data() as any;
      
      // 1. STRICT DAILY LIMIT CHECK: 15 SWIPES (Only for like and super_like)
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const lastDate = fromData.dailySwipeDate || "";
      const used = fromData.dailySwipeUsed || 0;
      const isNewDay = lastDate !== today;

      const swipeUpdate: any = {};
      
      // Always increment lifetime swipes for ALL interactions (like, super_like, pass)
      swipeUpdate['social.lifetimeSwipes'] = FieldValue.increment(1);

      if (type !== 'pass') {
        const lifetimeSwipes = fromData.social?.lifetimeSwipes || 0;
        // Free onboarding advantage ONLY applies to normal likes
        // Super Like is NEVER free during onboarding
        const isFreeOnboardingSwipe = lifetimeSwipes < 10 && type === 'like';

        if (type === 'super_like') {
            // Super Like ALWAYS requires credit
            if ((fromData.superLikes || 0) <= 0) {
                throw new functions.https.HttpsError('failed-precondition', 'Yetersiz Süper Like.');
            }
            swipeUpdate.superLikes = FieldValue.increment(-1);
        } else {
            // Normal like
            if (source === 'discover') {
                const currentRemaining = Math.max(0, Number(fromData.social?.discoverLikesRemaining ?? fromData.discoverLikesRemaining ?? 15));
                if (!isFreeOnboardingSwipe) {
                    if (currentRemaining <= 0) {
                        throw new functions.https.HttpsError('failed-precondition', 'discover_like_limit_reached');
                    }
                    // Explicitly set to social path and ensure no negative
                    swipeUpdate['social.discoverLikesRemaining'] = Math.max(0, currentRemaining - 1);
                }
            } else {
                if (!isFreeOnboardingSwipe) {
                    if (!isNewDay && used >= 15) {
                      throw new functions.https.HttpsError('resource-exhausted', 'daily_limit_reached');
                    }
                    swipeUpdate.dailySwipeUsed = isNewDay ? 1 : FieldValue.increment(1);
                    swipeUpdate.dailySwipeDate = today;
                }
            }
        }
        transaction.update(fromUserRef, swipeUpdate);
      }

      const swipeId = `swipe_${fromUserId}_${targetUserId}`;
      const swipeRef = db.collection("swipes").doc(swipeId);
      const serverNow = FieldValue.serverTimestamp();
      transaction.set(swipeRef, { id: swipeId, fromUserId, toUserId: targetUserId, type, createdAt: serverNow, updatedAt: serverNow }, { merge: true });

      if (type === 'like' || type === 'super_like') {
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          userId: targetUserId, 
          fromUserId, 
          type: type === 'super_like' ? "super_like" : "like", 
          title: type === 'super_like' ? "Yeni Süper Like! ✨" : "Yeni Beğeni! ❤️",
          message: `${fromData.social?.nickname || fromData.displayName || "Biri"} seni beğendi!`,
          fromUserName: fromData.social?.nickname || fromData.displayName || "Biri",
          fromUserPhoto: fromData.photoURL || fromData.social?.photos?.[0] || "",
          data: { fromUserId }, 
          read: false, 
          createdAt: serverNow
        });
      }

      return { success: true, status: 'SUCCESS', targetUserId, type, fromUserNickname: fromData.social?.nickname || fromData.displayName, fromUserPhoto: fromData.photoURL || fromData.social?.photos?.[0] };
    });

    if (result.success && result.status === 'SUCCESS' && (type === 'like' || type === 'super_like')) {
      sendPushToUser(result.targetUserId, { 
        title: type === 'super_like' 
          ? `${result.fromUserNickname || "Biri"} sana Süper Like attı ✨` 
          : `${result.fromUserNickname || "Biri"} seni beğendi 💜`,
        body: type === 'super_like' ? "Bu enerji karşılıksız kalmasın." : "Profiline bakmak ister misin?",
        category: type === 'super_like' ? 'superLikes' : 'likes',
        senderId: fromUserId,
        imageUrl: result.fromUserPhoto,
        data: { type, fromUserId }
      }).catch(e => console.error("Push failed:", e));
    }
    return result;
  } catch (error: any) {
    console.error("sendLike error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Beğeni işlemi başarısız oldu.');
  }
});

// Priority Message Request
export const sendPriorityMessageRequest = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const fromUserId = context.auth.uid;
  const { targetUserId } = data;

  if (!targetUserId || fromUserId === targetUserId) {
    throw new functions.https.HttpsError('invalid-argument', 'Geçersiz kullanıcı.');
  }

  try {
     const economy = await getEconomyConfig() || {};
     const priorityMessagePrice = economy.socialPricing?.priorityMessagePrice || 50;

     const fromUserRef = db.collection("users").doc(fromUserId);
     const requestRef = db.collection("interactionRequests").doc(`req_${fromUserId}_${targetUserId}`);

    let fromUserName = "Biri";
    let fromUserPhoto = "";

    const result = await db.runTransaction(async (transaction) => {
        const fromSnap = await transaction.get(fromUserRef);
        if (!fromSnap.exists) return { success: false, status: 'USER_NOT_FOUND' };
        
        const fromData = fromSnap.data() as any;
        fromUserName = fromData.social?.nickname || fromData.displayName || "Biri";
        fromUserPhoto = fromData.social?.photos?.[0] || fromData.photoURL || "";

        // Check Coins
        if ((fromData.mainCoins || 0) < priorityMessagePrice) {
            return { success: false, status: 'INSUFFICIENT_FUNDS' };
        }

        // Check existing chat/request
        const reqSnap = await transaction.get(requestRef);
        if (reqSnap.exists) {
            const reqData = reqSnap.data();
            if (reqData?.status === 'pending') {
                return { success: false, status: 'ALREADY_REQUESTED' };
            }
            return { success: false, status: 'ALREADY_INTERACTED' };
        }
        
        // Deduct Coins
        transaction.update(fromUserRef, { mainCoins: FieldValue.increment(-priorityMessagePrice) });

        // Update Request
        const now = new Date().toISOString();
        transaction.set(requestRef, { 
            id: requestRef.id, fromUserId, toUserId: targetUserId, status: 'pending', type: 'priority_message_request', priority: true, createdAt: now 
        });

        transaction.set(db.collection("notifications").doc(), {
            userId: targetUserId, 
            fromUserId, 
            fromUserName,
            fromUserPhoto,
            type: 'priority_message_request',
            title: "Öncelikli Mesaj İsteği 🚀",
            message: `${fromUserName} sana öncelikli bir mesaj isteği gönderdi!`,
            data: { fromUserId },
            read: false, 
            createdAt: now
        });

        return { success: true };
    });

    if (result.success) {
        // Send Push
        await sendPushToUser(targetUserId, {
            title: "Öncelikli mesaj isteğin var 💌",
            body: `${fromUserName} sana öne çıkan bir mesaj isteği gönderdi.`,
            category: 'social',
            senderId: fromUserId,
            imageUrl: fromUserPhoto,
            data: {
                type: "priority_message_request",
                fromUserId,
                requestId: `req_${fromUserId}_${targetUserId}`,
                targetTab: "messages",
                targetSubTab: "requests"
            }
        }).catch(e => console.error("Push failed:", e));
    }

    return result;
  } catch (error: any) {
      console.error("sendPriorityMessageRequest error:", error);
      if (error instanceof functions.https.HttpsError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new functions.https.HttpsError('internal', `İstek gönderilirken hata oluştu: ${msg}`);
  }
});

// 17. Claim Profile Completion Reward
export const claimProfileCompletionReward = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;

  try {
    const userRef = db.collection("users").doc(userId);
    const economy = await getEconomyConfig() || {};
    const rewardAmount = economy.rewards?.profileCompletionEnergy || 50;

    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
      
      const userData = userSnap.data() as any;
      const s = userData.social || {};

      // 1. Calculate Completion (Mirroring Frontend Logic)
      let score = 0;
      const photoCount = s.photos?.length || 0;
      
      let photoScore = 0;
      if (photoCount === 1) photoScore = 20;
      else if (photoCount >= 2 && photoCount <= 3) photoScore = 25;
      else if (photoCount >= 4) photoScore = 30;

      if (s.nickname || userData.displayName) score += 15;
      if (s.gender || userData.gender) score += 15;
      if (userData.birthDate) score += 15;
      if (s.bio) score += 15;
      if (s.interests && s.interests.length > 0) score += 10;
      score += photoScore;

      if (score < 100) {
        throw new functions.https.HttpsError('failed-precondition', `Profil tamamlama puanı yetersiz (${score}/100).`);
      }

      // 2. Check if already claimed
      if (s.completionRewardClaimed) {
        throw new functions.https.HttpsError('already-exists', 'Bu ödülü zaten aldınız.');
      }

      // 3. Update User and Log Transaction
      const now = new Date().toISOString();
      transaction.update(userRef, {
        energy: FieldValue.increment(rewardAmount),
        "social.completionRewardClaimed": true,
        "social.updatedAt": now
      });

      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'earn',
        source: 'profile_completion',
        amount: rewardAmount,
        balanceType: 'energy',
        createdAt: now,
        status: 'active',
        description: 'Profil tamamlama ödülü (100% Tamamlanma)'
      });

      return { success: true, rewardAmount };
    });
  } catch (error: any) {
    console.error("claimProfileCompletionReward error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('internal', `Profil tamamlama ödülü işlenirken hata oluştu: ${msg}`);
  }
});

// 6. Send Message Request
export const sendMessageRequest = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
  
  const fromUserId = context.auth.uid;
  const toUserId = data.toUserId || data.targetUserId;
  if (!toUserId || fromUserId === toUserId) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');

  try {
    const fromUserRef = db.collection("users").doc(fromUserId);
    const toUserRef = db.collection("users").doc(toUserId);

    const result = await db.runTransaction(async (transaction) => {
      const [fromSnap, toSnap] = await Promise.all([transaction.get(fromUserRef), transaction.get(toUserRef)]);
      if (!fromSnap.exists || !toSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");

      const fromData = fromSnap.data() as any;
      
      const requestId = `req_${fromUserId}_${toUserId}`;
      const requestRef = db.collection("interactionRequests").doc(requestId);
      const requestSnap = await transaction.get(requestRef);
      if (requestSnap.exists && requestSnap.data()?.status === 'pending') return { success: false, status: 'ALREADY_REQUESTED' };

      const now = FieldValue.serverTimestamp();
      transaction.set(requestRef, { 
        id: requestId, fromUserId, toUserId, 
        status: "pending", type: "message_request", 
        createdAt: now, updatedAt: now 
      }, { merge: true });

      const notifRef = db.collection("notifications").doc();
      transaction.set(notifRef, { 
        userId: toUserId, 
        fromUserId, 
        type: "message_request", 
        title: "Yeni Mesaj İsteği 💌", 
        message: `${fromData.social?.nickname || fromData.displayName || "Biri"} sana bir mesaj isteği gönderdi.`, 
        fromUserName: fromData.social?.nickname || fromData.displayName || "Biri",
        fromUserPhoto: fromData.photoURL || fromData.social?.photos?.[0] || "",
        data: { fromUserId }, 
        read: false, 
        createdAt: now 
      });

      return { success: true, status: 'SUCCESS', toUserId, senderNickname: fromData.social?.nickname || fromData.displayName, senderPhoto: fromData.photoURL || fromData.social?.photos?.[0] };
    });

    if (result.success && result.status === 'SUCCESS') {
      sendPushToUser(result.toUserId, { 
        title: "Yeni Mesaj İsteği 💌", 
        body: `${result.senderNickname} sana bir mesaj isteği gönderdi.`, 
        category: 'social', 
        senderId: fromUserId,
        imageUrl: result.senderPhoto 
      }).catch(e => console.error("Push failed:", e));
    }
    return result;
  } catch (error: any) {
    console.error("sendMessageRequest error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İstek gönderilemedi.');
  }
});

// 7. Accept Request
export const acceptRequest = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const { requestId } = data;
    if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'Request ID gerekli.');

    const requestRef = db.collection("interactionRequests").doc(requestId);
    const result = await db.runTransaction(async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
      if (!requestSnap.exists) throw new functions.https.HttpsError('not-found', 'İstek bulunamadı.');
      const request = requestSnap.data() as any;
      if (request.toUserId !== userId || request.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'Geçersiz istek durumu.');

      const fromUserId = request.fromUserId;
      const [fromSnap, toSnap] = await Promise.all([transaction.get(db.collection("users").doc(fromUserId)), transaction.get(db.collection("users").doc(userId))]);
      if (!fromSnap.exists || !toSnap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');

      const chatId = `chat_${[fromUserId, userId].sort().join('_')}`;
      const chatRef = db.collection("chats").doc(chatId);
      const now = FieldValue.serverTimestamp();

      transaction.update(requestRef, { status: 'accepted', updatedAt: now });
      transaction.set(chatRef, { id: chatId, participants: [fromUserId, userId], createdAt: now, lastMessage: "Sohbet başladı! 👋", lastMessageAt: now, status: 'active', unreadCount: { [fromUserId]: 0, [userId]: 0 } }, { merge: true });
      
      const msgRef = db.collection("messages").doc();
      transaction.set(msgRef, { id: msgRef.id, chatId, participants: [fromUserId, userId], senderId: "system", text: "Sohbet başlayabilir.", createdAt: now, status: 'sent', type: 'system' });

      const notifRef = db.collection("notifications").doc();
      transaction.set(notifRef, { 
        userId: fromUserId, 
        type: "request_accepted", 
        title: "İstek Kabul Edildi!", 
        message: `${toSnap.data()?.social?.nickname || toSnap.data()?.displayName} mesaj isteğini kabul etti! 🎉`, 
        fromUserName: toSnap.data()?.social?.nickname || toSnap.data()?.displayName || "Biri",
        fromUserPhoto: toSnap.data()?.photoURL || toSnap.data()?.social?.photos?.[0] || "",
        data: { chatId }, 
        read: false, 
        createdAt: now 
      });

      return { status: 'SUCCESS', chatId, fromUserId, toUserId: userId, toUserNickname: toSnap.data()?.social?.nickname || toSnap.data()?.displayName, toUserPhoto: toSnap.data()?.photoURL || toSnap.data()?.social?.photos?.[0] };
    });

    // Performance: Async push
    if (result.status === 'SUCCESS') {
      sendPushToUser(result.fromUserId, { 
        title: "İstek Kabul Edildi!", 
        body: `${result.toUserNickname} mesaj isteğini kabul etti! 🎉`, 
        data: { screen: 'chat', chatId: result.chatId }, 
        category: 'social', 
        senderId: result.toUserId,
        imageUrl: result.toUserPhoto 
      }).catch(e => console.error("Push failed:", e));
    }
    return result;
  } catch (error: any) {
    console.error("acceptRequest error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İstek kabul edilirken hata oluştu.');
  }
});

// 8. Reject Request
export const rejectRequest = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    if (!data || !data.requestId) throw new functions.https.HttpsError('invalid-argument', 'Request ID gerekli.');
    const { requestId } = data;
    const requestRef = db.collection("interactionRequests").doc(requestId);
    await requestRef.set({ status: 'rejected', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("rejectRequest error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 9. Send Message
export const sendMessage = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const senderId = context.auth.uid;
  
  try {
    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const { chatId, text, mediaUrl, mediaType, fileName } = data;
    if (!chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');

    const chatRef = db.collection("chats").doc(chatId);
    
    const result = await db.runTransaction(async (transaction) => {
      const chatSnap = await transaction.get(chatRef);
      if (!chatSnap.exists) throw new functions.https.HttpsError('not-found', 'Sohbet bulunamadı.');
      const chat = chatSnap.data() as any;
      if (!chat.participants.includes(senderId)) throw new functions.https.HttpsError('permission-denied', 'Bu sohbete erişim yetkiniz yok.');

      const receiverId = chat.participants.find((id: string) => id !== senderId);
      if (!receiverId) throw new functions.https.HttpsError('failed-precondition', 'Alıcı bulunamadı.');

      const [senderSnap, receiverSnap] = await Promise.all([transaction.get(db.collection("users").doc(senderId)), transaction.get(db.collection("users").doc(receiverId))]);
      
      const senderData = senderSnap.data();
      const receiverData = receiverSnap.data();

      // Block Safety Check
      if (receiverData?.social?.blockedUserIds?.includes(senderId) || senderData?.social?.blockedUserIds?.includes(receiverId)) {
        throw new functions.https.HttpsError('permission-denied', 'Bu kullanıcıyla mesajlaşamazsınız.');
      }

      const now = FieldValue.serverTimestamp();
      const msgRef = db.collection("messages").doc();
      const type = mediaType || 'text';
      const lastMsgText = type === 'text' ? (text || "") : (type === 'image' ? "📷 Görsel" : type === 'video' ? "🎥 Video" : "📎 Dosya");

      transaction.set(msgRef, { 
        id: msgRef.id, 
        chatId, 
        participants: [senderId, receiverId], 
        senderId, 
        receiverId, 
        text: text || "", 
        mediaUrl: mediaUrl || null, 
        mediaType: mediaType || null, 
        fileName: fileName || null,
        createdAt: now, 
        status: 'sent', 
        seen: false, 
        type 
      });
      transaction.update(chatRef, { 
        lastMessage: lastMsgText, 
        lastMessageAt: now, 
        lastMessageSenderId: senderId, 
        lastMessageStatus: 'sent', 
        lastMessageId: msgRef.id,
        [`unreadCount.${receiverId}`]: FieldValue.increment(1) 
      });
      transaction.update(db.collection("users").doc(receiverId), { unreadMessagesCount: FieldValue.increment(1) });
      return { status: 'SUCCESS', messageId: msgRef.id, receiverId, chatId, senderNickname: senderData?.social?.nickname || senderData?.displayName, lastMsgText };
    });

    return result;
  } catch (error: any) {
    console.error("sendMessage error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Mesaj gönderilirken hata oluştu.');
  }
});

// 10. Mark As Seen
export const markAsSeen = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
    const { chatId } = data;
    
    // Always attempt to clear the unread counter on the chat
    try {
      const chatRef = db.collection("chats").doc(chatId);
      const chatSnap = await chatRef.get();
      if (chatSnap.exists) {
        const chatData = chatSnap.data();
        const updates: any = { [`unreadCount.${userId}`]: 0 };
        // Only set lastMessageStatus to "seen" if the last message was sent by the OTHER user.
        if (chatData?.lastMessageSenderId && chatData.lastMessageSenderId !== userId) {
            updates.lastMessageStatus = 'seen';
        }
        await chatRef.update(updates);
      }
    } catch (e) {
      console.error("markAsSeen chat update error:", e);
    }

    try {
      // Use "in" operator instead of "!=" to avoid some index constraints
      const unreadsInfo = await db.collection("messages").where("chatId", "==", chatId).where("receiverId", "==", userId).where("status", "in", ["sent", "delivered"]).limit(100).get();
      if (!unreadsInfo.empty) {
        const batch = db.batch();
        unreadsInfo.docs.forEach(doc => batch.update(doc.ref, { status: 'seen', seen: true }));
        batch.update(db.collection("users").doc(userId), { unreadMessagesCount: FieldValue.increment(-unreadsInfo.size) });
        await batch.commit();
      }
    } catch (e) {
      console.error("markAsSeen messages query error:", e);
      // We already cleared the chat unreadCount, so the UI will look correct
    }

    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("markAsSeen error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 11. Mark As Delivered
export const markAsDelivered = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
    const { chatId } = data;
    const sents = await db.collection("messages").where("chatId", "==", chatId).where("receiverId", "==", userId).where("status", "==", "sent").limit(100).get();
    if (sents.empty) return { success: true, status: 'SUCCESS' };
    const batch = db.batch();
    sents.docs.forEach(doc => batch.update(doc.ref, { status: 'delivered' }));
    await batch.commit();
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("markAsDelivered error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 12. Delete Chat
export const deleteChat = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
    const { chatId } = data;
    await db.collection("chats").doc(chatId).update({ deletedFor: FieldValue.arrayUnion(userId) });
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("deleteChat error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 13. Delete Message
export const deleteMessage = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.messageId) throw new functions.https.HttpsError('invalid-argument', 'Message ID gerekli.');
    const { messageId, forEveryone } = data;
    const msgRef = db.collection("messages").doc(messageId);
    const snap = await msgRef.get();
    if (snap.exists && snap.data()?.senderId === userId) {
      if (forEveryone) await msgRef.update({ isDeleted: true, deletedForEveryone: true, text: "Bu mesaj silindi.", mediaUrl: null, mediaType: null });
      else await msgRef.update({ isDeleted: true });
    }
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("deleteMessage error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Mesaj silinirken hata oluştu.');
  }
});

// 14. Edit Message
export const editMessage = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.messageId) throw new functions.https.HttpsError('invalid-argument', 'Mesaj ID ve yeni metin gerekli.');
    const { messageId, newText } = data;
    const msgRef = db.collection("messages").doc(messageId);
    const snap = await msgRef.get();
    if (snap.exists && snap.data()?.senderId === userId) {
      await msgRef.update({ text: newText, editedAt: FieldValue.serverTimestamp() });
    }
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("editMessage error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Mesaj düzenlenirken hata oluştu.');
  }
});

// 15. Set Typing Status
export const setTypingStatus = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
    const { chatId, isTyping } = data;
    await db.collection("chats").doc(chatId).set({ [`typing.${userId}`]: !!isTyping }, { merge: true });
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("setTypingStatus error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 16. Block User
export const blockUser = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    if (!data || !data.targetUid) throw new functions.https.HttpsError('invalid-argument', 'Target UID gerekli.');
    const { targetUid } = data;
    await db.collection("users").doc(context.auth.uid).set({ "social.blockedUserIds": FieldValue.arrayUnion(targetUid) }, { merge: true });
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("blockUser error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Engelleme sırasında hata oluştu.');
  }
});

// 17. Unblock User
export const unblockUser = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    if (!data || !data.targetUid) throw new functions.https.HttpsError('invalid-argument', 'Target UID gerekli.');
    const { targetUid } = data;
    await db.collection("users").doc(context.auth.uid).set({ "social.blockedUserIds": FieldValue.arrayRemove(targetUid) }, { merge: true });
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("unblockUser error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Engeli kaldırırken hata oluştu.');
  }
});

// 18. Mute User
export const muteUser = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    if (!data || !data.targetUid) throw new functions.https.HttpsError('invalid-argument', 'Target UID gerekli.');
    const { targetUid } = data;
    await db.collection("users").doc(context.auth.uid).set({ "social.mutedUserIds": FieldValue.arrayUnion(targetUid) }, { merge: true });
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("muteUser error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Sessize alma sırasında hata oluştu.');
  }
});

// 19. Unmute User
export const unmuteUser = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    if (!data || !data.targetUid) throw new functions.https.HttpsError('invalid-argument', 'Target UID gerekli.');
    const { targetUid } = data;
    await db.collection("users").doc(context.auth.uid).set({ "social.mutedUserIds": FieldValue.arrayRemove(targetUid) }, { merge: true });
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("unmuteUser error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Sessizden çıkarma sırasında hata oluştu.');
  }
});

// 20. Create Report
export const createReport = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    if (!data || !data.reportedUserId) throw new functions.https.HttpsError('invalid-argument', 'Raporlanan kullanıcı ID gerekli.');
    const { reportedUserId, source, reason, description, metadata } = data;
    
    // Spam kontrolü
    const existingReports = await db.collection("reports")
      .where("reporterId", "==", context.auth.uid)
      .where("reportedUserId", "==", reportedUserId)
      .where("status", "==", "pending")
      .get();
      
    if (!existingReports.empty) {
      throw new functions.https.HttpsError('already-exists', 'Bu kullanıcı için zaten incelemede olan bir raporunuz bulunmaktadır.');
    }

    const ref = db.collection("reports").doc();
    await ref.set({ id: ref.id, reporterId: context.auth.uid, reportedUserId, source, reason, description: description || "", metadata: metadata || {}, createdAt: FieldValue.serverTimestamp(), status: 'pending' });
    return { success: true, status: 'SUCCESS' };
  } catch (error: any) {
    console.error("createReport error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Rapor oluşturulurken hata oluştu.');
  }
});

// 21. Create Chat
export const createChat = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
    const { targetUserId } = data;
    const chatId = `chat_${[userId, targetUserId].sort().join('_')}`;
    const now = FieldValue.serverTimestamp();
    await db.collection("chats").doc(chatId).set({ id: chatId, participants: [userId, targetUserId], createdAt: now, lastMessage: "Sohbet başladı! 👋", lastMessageAt: now, status: 'active', unreadCount: { [userId]: 0, [targetUserId]: 0 } }, { merge: true });
    return { success: true, status: 'SUCCESS', chatId };
  } catch (error: any) {
    console.error("createChat error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Sohbet oluşturulurken hata oluştu.');
  }
});

// 22. Compatibility Analysis
async function generateCompatibilityAiDirect(person1: any, person2: any, relationshipType: string, userId: string, targetUserId?: string, cacheKey?: string) {
  const now = new Date().toISOString();
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({ 
      model: "gpt-4o-mini", 
      response_format: { type: "json_object" },
      messages: [{ 
        role: "system", 
        content: "Sen evrenin frekanslarını okuyan, sadece TÜRKÇE konuşan, mistik ve iddialı bir ASTROLOGSUN. Senden %100 Türkçe ve JSON formatında astrolog analizi isteniyor. Başka hiçbir dil KULLANILAMAZ." 
      }, { 
        role: "user", 
        content: `Kişi 1: ${person1?.name || 'Bilinmiyor'} (Doğum: ${person1?.birthDate || 'Bilinmiyor'})
Kişi 2: ${person2?.name || 'Bilinmiyor'} (Doğum: ${person2?.birthDate || 'Bilinmiyor'})
İlişki Türü: ${relationshipType || 'Bilinmiyor'}

Lütfen analizini KESİNLİKLE AŞAĞIDAKİ JSON YAPISINA sahip olarak ve %100 TÜRKÇE döndür. İngilizce kelime kullanmak yasaktır. Skorlar 40 ile 100 arasında tam sayılar olmalıdır.

{
  "loveScore": 40-100 arası sayı,
  "friendshipScore": 40-100 arası sayı,
  "energyScore": 40-100 arası sayı,
  "summaryShort": "Tek cümlelik, vurucu ve etkileyici Türkçe astrolog özeti.",
  "summaryLong": "En az 4-5 cümlelik, 'Yıldızlar diyor ki...' gibi mistik bir dille yazılmış, KESİNLİKLE TÜRKÇE olan, iddialı ve detaylı astrolojik analiz."
}

Sadece JSON dön. Asla fazladan bir şey yazma.` 
      }], 
      max_tokens: 1000 
    });
    const aiContent = response.choices[0].message.content || "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(aiContent);
    } catch (e) {
      console.error("GPT JSON parse error:", e, "Content was:", aiContent);
    }
    
    const summaryContent = parsed.summaryLong || parsed.interpretation || parsed.summary || "";
    
    const parseScore = (val: any) => {
      const num = parseInt(val);
      return (!isNaN(num) && num > 0 && num <= 100) ? num : (Math.floor(Math.random() * 41) + 40); // 40-80 fallback
    };
    
    const docRef = db.collection("compatibilityHistory").doc();
    const unlockAtTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const analysisData: any = { 
      id: docRef.id,
      requestId: docRef.id, // For backwards compatibility
      userId,
      person1,
      person2,
      relationshipType: relationshipType || 'ask',
      status: 'locked', 
      revealed: false,
      unlockAt: unlockAtTime,
      loveScore: parseScore(parsed.loveScore),
      friendshipScore: parseScore(parsed.friendshipScore),
      energyScore: parseScore(parsed.energyScore),
      summaryShort: parsed.summaryShort || "Yıldızların mistik fısıltısı duyuldu.",
      summaryLong: summaryContent.length > 5 ? summaryContent : "Kozmik analiz başarıyla tamamlandı ancak yıldızlar şu an konuşmak istemiyor.",
      createdAt: now 
    };
    if (targetUserId) analysisData.targetUserId = targetUserId;
    if (cacheKey) analysisData.cacheKey = cacheKey;
    
    const batch = db.batch();
    batch.set(docRef, analysisData);
    batch.set(db.collection("notifications").doc(), { 
      userId, 
      type: 'system', 
      title: 'Uyum Analizi Hazırlanıyor... ✨', 
      message: 'Frekans analizin birazdan sonuçlanacak. Sonucunu Frekans Arşivi\'nde görebilirsin.', 
      read: false, 
      createdAt: new Date().toISOString() 
    });
    await batch.commit();
    await sendPushToUser(userId, { 
      title: "Uyum Analizi Başlatıldı 🔮", 
      body: "Frekansların taranıyor... Analizin birazdan hazır olacak.", 
      category: 'compatibility',
      data: { type: 'compatibilityProgress', analysisId: docRef.id }
    });
    return analysisData;
  } catch (e: any) {
    console.error("AI Generation Fatal Error:", e);
    const errorMessage = e && e.message ? e.message : 'Bilinmeyen hata';
    throw new functions.https.HttpsError('internal', `AI servisine şu an ulaşılamıyor: ${errorMessage}`);
  }
}

export const runDiscoverCompatibilityAnalysis = functions.region('us-central1').runWith({ secrets: ["OPENAI_API_KEY"], timeoutSeconds: 120 }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
    const { targetUserId, relationshipType } = data;

    // Duplicate check: prevent starting new analysis if one is already pending or locked
    const existingPending = await db.collection("compatibilityHistory")
      .where("userId", "==", userId)
      .where("targetUserId", "==", targetUserId)
      .where("status", "in", ["locked", "pending"])
      .limit(1)
      .get();
      
    if (!existingPending.empty) {
      throw new functions.https.HttpsError('already-exists', 'ALREADY_PENDING');
    }

    const userRef = db.collection("users").doc(userId);
    const targetRef = db.collection("users").doc(targetUserId);

    // 1. Fetch Economy Config for Price
    const economy = await getEconomyConfig() || {};
    const compatPrice = economy.socialPricing?.compatibility?.[0]?.priceCoins || 25;

    // 2. Perform Transaction for Payment
    const usersData = await db.runTransaction(async (transaction) => {
      const [uSnap, tSnap] = await Promise.all([transaction.get(userRef), transaction.get(targetRef)]);
      if (!uSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      if (!tSnap.exists) throw new functions.https.HttpsError('not-found', "Hedef kullanıcı bulunamadı.");
      
      const user = uSnap.data() as any;
      const targetUser = tSnap.data() as any;

      let paymentType: 'count' | 'coins' = 'coins';

      const { total: compCount, field: fieldToDecrement } = getCompatibilityBalance(user);

      if (compCount > 0 && fieldToDecrement) {
        transaction.update(userRef, { [fieldToDecrement]: FieldValue.increment(-1) });
        paymentType = 'count';
      } else if ((user.mainCoins || 0) >= compatPrice) {
        transaction.update(userRef, { mainCoins: FieldValue.increment(-compatPrice) });
        // Log transaction
        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'spend',
          source: 'compatibility_analysis',
          amount: -compatPrice,
          balanceType: 'main',
          createdAt: new Date().toISOString(),
          status: 'spent',
          description: `Uyum Analizi (Keşfet)`
        });
        paymentType = 'coins';
      } else {
        throw new functions.https.HttpsError('failed-precondition', "Yeterli jetonun yok.");
      }

      return {
        paymentType,
        compatPrice,
        me: {
          name: user.social?.nickname || user.displayName || "Sen",
          birthDate: user.birthDate || user.social?.birthDate || "",
          photo: user.social?.photos?.[0] || user.photoURL || "",
          age: user.age || 0
        },
        target: {
          name: targetUser.social?.nickname || targetUser.displayName || "O",
          birthDate: targetUser.birthDate || targetUser.social?.birthDate || "",
          photo: targetUser.social?.photos?.[0] || targetUser.photoURL || "",
          age: targetUser.age || 0
        }
      };
    });

    // 3. Process AI implicitly inline - results in compatibilityHistory
    let analysisData;
    try {
      analysisData = await generateCompatibilityAiDirect(
        usersData.me, 
        usersData.target, 
        relationshipType || 'ask', 
        userId, 
        targetUserId
      );
    } catch (aiError: any) {
      console.error("runDiscoverCompatibilityAnalysis AI Error:", aiError);
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError);
      await db.runTransaction(async (t) => {
        if (usersData.paymentType === 'count') {
          t.update(userRef, { compatibilityCount: FieldValue.increment(1) });
        } else if (usersData.paymentType === 'coins') {
          t.update(userRef, { mainCoins: FieldValue.increment(usersData.compatPrice) });
          // Log refund
          const refundRef = db.collection("walletTransactions").doc();
          t.set(refundRef, {
            id: refundRef.id,
            userId,
            type: 'earn',
            source: 'refund',
            amount: usersData.compatPrice,
            balanceType: 'main',
            createdAt: new Date().toISOString(),
            status: 'completed',
            description: `Uyum Analizi İadesi (AI Hatası)`
          });
        }
      });
      throw new functions.https.HttpsError('internal', `Uyum analizi hazırlanamadı: ${aiMsg}. Hakkın iade edildi.`);
    }
    
    // NEW: Notify the target user that someone is curious (Compatibility Peek)
    try {
      const peekId = `peek_${userId}_${targetUserId}`;
      const peekRef = db.collection("compatibilityPeeks").doc(peekId);
      const peekSnap = await peekRef.get();
      
      let shouldUpdatePeek = true;
      if (peekSnap.exists) {
        const peekData = peekSnap.data();
        if (peekData?.createdAt) {
          const lastTime = peekData.createdAt.toDate ? peekData.createdAt.toDate() : new Date(peekData.createdAt);
          const diffMs = Date.now() - lastTime.getTime();
          if (diffMs < 24 * 60 * 60 * 1000) {
            shouldUpdatePeek = false; // Cooldown active
          }
        }
      }
      
      if (shouldUpdatePeek) {
        const fromUser = usersData.me;
        await peekRef.set({
          id: peekId,
          fromUserId: userId,
          toUserId: targetUserId,
          fromUserName: fromUser.name,
          fromUserPhoto: fromUser.photo,
          fromUserAge: fromUser.age,
          createdAt: new Date().toISOString(),
          source: "discover",
          read: false
        });
        
        // Create Notification for Target User
        const targetNotificationRef = db.collection("notifications").doc();
        await targetNotificationRef.set({
          userId: targetUserId,
          type: 'compatibility_peek',
          title: 'Birisi uyumunu merak etti ✨',
          message: 'Enerjin birinin dikkatini çekti! Kimin seninle uyumunu merak ettiğini gör.',
          read: false,
          createdAt: new Date().toISOString(),
          metadata: {
            fromUserId: userId,
            peekId: peekId
          }
        });
        
        await sendPushToUser(targetUserId, {
          title: "Birisi uyumunu merak etti ✨",
          body: "Enerjin birinin dikkatini çekti! Kimin seninle uyumunu merak ettiğini gör.",
          category: 'compatibility',
          data: { type: 'compatibilityPeek', fromUserId: userId }
        });
      }
    } catch (peekError) {
      console.error("peek creation error:", peekError);
      // Non-blocking
    }

    return { 
      success: true, 
      requestId: analysisData.id, 
      status: "locked",
      finishTime: analysisData.unlockAt
    };
  } catch (error: any) {
    console.error("runDiscoverCompatibilityAnalysis error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
  }
});

export const runManualCompatibilityAnalysis = functions.region('us-central1').runWith({ secrets: ["OPENAI_API_KEY"], timeoutSeconds: 120 }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.person1 || !data.person2) throw new functions.https.HttpsError('invalid-argument', 'Kişi bilgileri gerekli.');
    const { person1, person2, relationshipType } = data;
    
    const cleanPerson1 = JSON.parse(JSON.stringify(person1));
    const cleanPerson2 = JSON.parse(JSON.stringify(person2));

    const userRef = db.collection("users").doc(userId);

    // 1. Fetch Economy Config for Price
    const economy = await getEconomyConfig() || {};
    const compatPrice = economy.socialPricing?.compatibility?.[0]?.priceCoins || 25;
    
    const paymentData = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const user = snap.data() as any;

      let paymentType: 'count' | 'coins' = 'coins';

      const { total: compCount, field: fieldToDecrement } = getCompatibilityBalance(user);

      if (compCount > 0 && fieldToDecrement) {
        transaction.update(userRef, { [fieldToDecrement]: FieldValue.increment(-1) });
        paymentType = 'count';
      } else if ((user.mainCoins || 0) >= compatPrice) {
        transaction.update(userRef, { mainCoins: FieldValue.increment(-compatPrice) });
        // Log transaction
        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'spend',
          source: 'compatibility_analysis',
          amount: -compatPrice,
          balanceType: 'main',
          createdAt: new Date().toISOString(),
          status: 'spent',
          description: `Uyum Analizi (Manuel)`
        });
        paymentType = 'coins';
      } else {
        throw new functions.https.HttpsError('failed-precondition', "Yeterli jetonun yok.");
      }

      return { paymentType, compatPrice };
    });
    
    // 2. Process AI implicitly inline - results in compatibilityHistory with 5min lock
    let analysisData;
    try {
      analysisData = await generateCompatibilityAiDirect(cleanPerson1, cleanPerson2, relationshipType, userId);
    } catch (aiError: any) {
      console.error("runManualCompatibilityAnalysis AI Error:", aiError);
      const aiMsg = aiError instanceof Error ? aiError.message : String(aiError);
      await db.runTransaction(async (t) => {
        if (paymentData.paymentType === 'count') {
          t.update(userRef, { compatibilityCount: FieldValue.increment(1) });
        } else if (paymentData.paymentType === 'coins') {
          t.update(userRef, { mainCoins: FieldValue.increment(paymentData.compatPrice) });
          // Log refund
          const refundRef = db.collection("walletTransactions").doc();
          t.set(refundRef, {
            id: refundRef.id,
            userId,
            type: 'earn',
            source: 'refund',
            amount: paymentData.compatPrice,
            balanceType: 'main',
            createdAt: new Date().toISOString(),
            status: 'completed',
            description: `Manuel Analiz İadesi (AI Hatası)`
          });
        }
      });
      throw new functions.https.HttpsError('internal', `Analiz hazırlanamadı: ${aiMsg}. Hakkın iade edildi.`);
    }
    return { 
      success: true, 
      requestId: analysisData.id, 
      finishTime: analysisData.unlockAt,
      status: "locked" 
    };
  } catch (error: any) {
    console.error("runManualCompatibilityAnalysis error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
  }
});

export const speedUpCompatibilityAnalysis = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const requestId = data.requestId;
  
  if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'RequestId gerekli.');
  
  try {
    const economy = await getEconomyConfig() || {};
    const speedUpPrice = economy.socialPricing?.compatibilitySpeedUpPrice ?? 10;

    return await db.runTransaction(async (transaction) => {
      const userRef = db.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
      
      const userData = userSnap.data() || {};
      if ((userData.mainCoins || 0) < speedUpPrice) throw new functions.https.HttpsError('failed-precondition', 'Yeterli jetonun yok.');
      
      // Look up in compatibilityHistory since we instantly generate and lock it
      const reqRef = db.collection("compatibilityHistory").doc(requestId);
      const reqSnap = await transaction.get(reqRef);
      
      if (!reqSnap.exists) throw new functions.https.HttpsError('not-found', 'Analiz isteği bulunamadı.');
      const reqData = reqSnap.data() || {};
      
      if (reqData.userId !== userId) throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
      if (reqData.status !== 'locked' || reqData.revealed) {
        throw new functions.https.HttpsError('failed-precondition', 'Analiz zaten açılmış.');
      }
      
      transaction.update(userRef, {
        mainCoins: FieldValue.increment(-speedUpPrice)
      });
      
      transaction.update(reqRef, {
        status: 'completed',
        revealed: true,
        unlockAt: new Date().toISOString() // Unlock immediately
      });
      
      return { success: true, message: `Hızlandırma başarılı.` };
    });
  } catch (error: any) {
    console.error("speedUpCompatibilityAnalysis error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

export const claimOnboardingDiscoverBonus = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const userRef = db.collection("users").doc(userId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
      const user = snap.data();
      
      if (user?.social?.onboardingDiscoverBonusClaimed) {
        throw new functions.https.HttpsError('already-exists', 'Bonus zaten alındı.');
      }

      const createdAt = user?.createdAt ? new Date(user.createdAt) : new Date();
      const now = new Date();
      const diffHrs = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (diffHrs > 24) {
          throw new functions.https.HttpsError('failed-precondition', 'Bonus süresi doldu.');
      }

      transaction.update(userRef, {
        "social.onboardingDiscoverBonusClaimed": true,
        "social.discoverLikesRemaining": 65,
        "social.discoverLikesLastReset": now.toISOString(),
        "social.updatedAt": now.toISOString()
      });
      
      return { success: true, amount: 65 };
    });
  } catch (error: any) {
    console.error("claimOnboardingDiscoverBonus error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('internal', `Bonus alınırken hata oluştu: ${msg}`);
  }
});

export const claim10MinuteReward = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const userRef = db.collection("users").doc(userId);

  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
      const user = snap.data();
      
      if (user?.social?.receivedOnboarding10mReward) {
        throw new functions.https.HttpsError('already-exists', 'Ödül zaten alındı.');
      }

      transaction.update(userRef, {
        "social.receivedOnboarding10mReward": true,
        "compatibilityCount": FieldValue.increment(1),
        "social.updatedAt": new Date().toISOString()
      });

      return { success: true };
    });
  } catch (error: any) {
    console.error("claim10MinuteReward error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('internal', `Ödül alınırken hata oluştu: ${msg}`);
  }
});

export const resetDailyDiscoverLikes = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const userRef = db.collection("users").doc(userId);

  try {
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
      const user = snap.data();

      const lastResetStr = user?.social?.discoverLikesLastReset;
      const now = new Date();
      
      if (lastResetStr) {
        const lastReset = new Date(lastResetStr);
        const diffHrs = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
        if (diffHrs < 24) {
          return { success: false, message: 'Henüz yenileme zamanı gelmedi.' };
        }
      }

      transaction.update(userRef, {
        "social.discoverLikesRemaining": 15,
        "social.discoverLikesLastReset": now.toISOString(),
        "social.updatedAt": now.toISOString()
      });

      return { success: true, amount: 15 };
    });
  } catch (error: any) {
    console.error("resetDailyDiscoverLikes error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('internal', `Yenileme sırasında hata oluştu: ${msg}`);
  }
});

// 23. Check and Notify Locked Compatibility
export const notifyUnlockedCompatibility = functions.region('us-central1').pubsub.schedule('every 2 minutes').onRun(async (context) => {
  const now = new Date().toISOString();
  
  try {
    const lockedSnap = await db.collection("compatibilityHistory")
      .where("status", "==", "locked")
      .where("revealed", "==", false)
      .where("unlockAt", "<=", now)
      .limit(100)
      .get();
      
    if (lockedSnap.empty) return null;
    
    console.log(`[notifyUnlockedCompatibility] Found ${lockedSnap.size} analyses to unlock`);
    
    const promises = lockedSnap.docs.map(async (doc) => {
      const data = doc.data();
      // Double check notifiedReady to avoid race conditions if multiple instances run
      if (data.notifiedReady) return;
      
      const userId = data.userId;
      
      const batch = db.batch();
      batch.update(doc.ref, {
        notifiedReady: true,
        status: 'completed',
        revealed: true
      });
      
      batch.set(db.collection("notifications").doc(), {
        userId,
        type: 'compatibility_ready',
        title: 'Uyum Analizin Hazır! ✨',
        message: 'Frekans analiz sonucun artık açıldı, hemen incele.',
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        metadata: { analysisId: doc.id }
      });
      
      await batch.commit();
      
      await sendPushToUser(userId, {
        title: "Uyum Analizin Açıldı! ✨",
        body: "Yıldızlar konuştu, kozmik uyum sonucunu görmek ister misin?",
        category: 'compatibility',
        data: { type: 'compatibility', analysisId: doc.id }
      });
    });
    
    await Promise.all(promises);
    return null;
  } catch (error) {
    console.error("notifyUnlockedCompatibility error:", error);
    return null;
  }
});

export const onMessageCreated = functions.region('us-central1').firestore.document('messages/{messageId}').onCreate(async (snap, context) => {
  const message = snap.data();
  console.log("TRIGGER: onMessageCreated fired for messageId:", snap.id, "Data:", JSON.stringify(message));
  
  if (!message || !message.chatId || !message.senderId || !message.receiverId || message.senderId === message.receiverId) {
    console.log("TRIGGER: Skipping message - validation failed or self-message.");
    return;
  }

  try {
    const senderSnap = await db.collection("users").doc(message.senderId).get();
    if (!senderSnap.exists) {
      console.log("TRIGGER: Sender profile not found:", message.senderId);
      return;
    }
    
    const senderNickname = senderSnap.data()?.social?.nickname || senderSnap.data()?.displayName || "Birisi";
    const senderPhoto = senderSnap.data()?.photoURL || senderSnap.data()?.social?.photos?.[0];
    
    let previewText = message.text || "Yeni bir mesaj";
    if (message.type === 'image' || message.mediaType === 'image') previewText = "📷 Fotoğraf";
    else if (message.type === 'video' || message.mediaType === 'video') previewText = "🎥 Video";
    else if (message.type === 'file' || message.mediaType === 'file') previewText = "📎 Dosya";

    console.log("TRIGGER: Preparing to send push to:", message.receiverId, "from nickname:", senderNickname);

    await sendPushToUser(message.receiverId, {
      title: senderNickname,
      body: previewText,
      data: {
        type: "message",
        screen: "chat",
        chatId: message.chatId,
        senderId: message.senderId,
        messageId: snap.id
      },
      category: "messages",
      senderId: message.senderId,
      imageUrl: senderPhoto
    });
  } catch (error) {
    console.error("onMessageCreated trigger error:", error);
  }
});

import * as os from "os";
import * as path from "path";
import * as fs from "fs";

export const generateThumbnails = functions.region('us-central1')
  .runWith({ memory: '1GB', timeoutSeconds: 120 })
  .storage.object().onFinalize(async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;

    if (!contentType?.startsWith('image/')) return;
    if (!filePath || filePath.includes('_thumb_')) return; // Exit if it's already a thumbnail or null

    try {
      const { Storage } = require('@google-cloud/storage');
      const sharp = require('sharp');
      const storageClient = new Storage();
      const bucket = storageClient.bucket(fileBucket);

      const fileName = path.basename(filePath);
      const fileDir = path.dirname(filePath);

      const workingDir = path.join(os.tmpdir(), "thumbs");
      if (!fs.existsSync(workingDir)) fs.mkdirSync(workingDir, { recursive: true });

      const tempFilePath = path.join(workingDir, fileName);
      await bucket.file(filePath).download({ destination: tempFilePath });

      const sizes = [200, 600];
      const uploadPromises = sizes.map(async (size) => {
        const thumbFileName = `${size}x${size}_thumb_${fileName}`;
        const thumbFilePath = path.join(workingDir, thumbFileName);

        await sharp(tempFilePath)
          .resize(size, size, { fit: 'inside', withoutEnlargement: true })
          .toFile(thumbFilePath);

        const destination = path.join(fileDir, thumbFileName);
        
        await bucket.upload(thumbFilePath, {
          destination,
          metadata: { 
            contentType,
            cacheControl: 'public, max-age=31536000, s-maxage=31536000'
          }
        });
        
        fs.unlinkSync(thumbFilePath);
      });

      await Promise.all(uploadPromises);
      fs.unlinkSync(tempFilePath);
      console.log(`Thumbnails generated for ${filePath}`);
    } catch (error) {
      console.error("generateThumbnails error:", error);
    }
});

// PROFILE VERIFICATION (BLUE TICK) SYSTEM

/**
 * User submits their profile for verification.
 */
export const submitProfileVerification = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { photoUrl } = data;

  if (!photoUrl) throw new functions.https.HttpsError('invalid-argument', 'Doğrulama fotoğrafı gereklidir.');

  try {
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      "social.verificationPhotoUrl": photoUrl,
      "social.verificationStatus": "pending",
      "social.verificationSubmittedAt": FieldValue.serverTimestamp(),
      "social.verified": false // Ensure it remains false until approved
    });

    return { success: true };
  } catch (error: any) {
    console.error("submitProfileVerification error:", error);
    throw new functions.https.HttpsError('internal', 'Başvuru sırasında bir hata oluştu.');
  }
});

/**
 * Admin updates verification status (approve/reject).
 */
export const adminUpdateVerificationStatus = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const { targetUid, status } = data; // status: 'approved' | 'rejected'
  if (!targetUid || !['approved', 'rejected'].includes(status)) {
    throw new functions.https.HttpsError('invalid-argument', 'Geçersiz parametreler.');
  }

  try {
    // Admin check
    const adminRef = db.collection("users").doc(context.auth.uid);
    const adminSnap = await adminRef.get();
    if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
    }

    const userRef = db.collection("users").doc(targetUid);
    const updates: any = {
      "social.verificationStatus": status,
      "social.updatedAt": FieldValue.serverTimestamp()
    };

    if (status === 'approved') {
      updates["social.verified"] = true;
      updates["social.verificationApprovedAt"] = FieldValue.serverTimestamp();
      updates["isVerified"] = true; // Sync with root for convenience
    } else {
      updates["social.verified"] = false;
      updates["isVerified"] = false;
    }

    await userRef.update(updates);

    // Notify user
    const notifRef = db.collection("notifications").doc();
    await notifRef.set({
      userId: targetUid,
      type: "system",
      title: status === 'approved' ? "Profilin Onaylandı! ✅" : "Profil Onayı Reddedildi ❌",
      message: status === 'approved' 
        ? "Tebrikler! Mavi tik profilinde görünüyor. Ödülünü cüzdanından alabilirsin." 
        : "Maalesef profil doğrulama başvurun reddedildi. Lütfen tekrar dene.",
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    console.error("adminUpdateVerificationStatus error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'İşlem başarısız oldu.');
  }
});

/**
 * Calculate Profile Completion Percentage
 */
function calculateProfileCompletion(social: any) {
  if (!social) return 0;
  let score = 0;
  if (social.nickname) score += 20;
  if (social.bio && social.bio.length > 20) score += 20;
  else if (social.bio) score += 10;
  
  if (social.photos && social.photos.length >= 3) score += 20;
  else if (social.photos && social.photos.length > 0) score += 10;
  
  if (social.interests && social.interests.length >= 5) score += 20;
  else if (social.interests && social.interests.length > 0) score += 10;
  
  if (social.birthDate && social.gender) score += 20;
  else if (social.birthDate || social.gender) score += 10;
  
  return score;
}

// 24. Daily Engagement Scheduled Task
export const notifyDailyEngagement = functions.region('us-central1').pubsub.schedule('every 2 hours').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  
  try {
    // 1. Discover Return Inactivity (24h+)
    const inactiveUsers = await db.collection("users")
      .where("lastActiveAt", "<=", oneDayAgo)
      .limit(100)
      .get();
      
    const engagementPromises = inactiveUsers.docs.map(async (doc) => {
      const data = doc.data();
      const lastDiscRemAt = data.social?.notifications?.lastDiscoverReminderAt;
      
      // Cooldown 24h
      if (lastDiscRemAt && lastDiscRemAt.toMillis() > oneDayAgo.getTime()) return;
      
      const userId = doc.id;
      
      await db.collection("notifications").add({
        userId,
        type: "discover_return",
        title: "Seni Özledik! 🔮",
        message: "Bugün Keşfet'te yeni ruhlar seni bekliyor olabilir.",
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
      
      await db.collection("users").doc(userId).set({
        social: { notifications: { lastDiscoverReminderAt: FieldValue.serverTimestamp() } }
      }, { merge: true });
      
      await sendPushToUser(userId, {
        title: "Yeni Ruhlar Seni Bekliyor! 🔮",
        body: "Enerjin bugün harika! Keşfet'te kimlerin olduğunu görmek ister misin?",
        category: "engagement"
      });
    });
    
    // 2. Daily Likes Reset Reminder
    const resetUsers = await db.collection("users")
      .where("social.notifications.lastLikesResetNotifAt", "<=", sixHoursAgo)
      .limit(50)
      .get();
      
    const resetPromises = resetUsers.docs.map(async (doc) => {
      const data = doc.data();
      // If discoverLikes is full (reset happened)
      if (data.social?.discoverLikes === 20) {
        const userId = doc.id;
        
        await db.collection("notifications").add({
           userId,
           type: "daily_likes_reset",
           title: "Beğeni Hakların Yenilendi! ❤️",
           message: "Yeni gün, yeni eşleşmeler! Ücretsiz beğeni hakların seni bekliyor.",
           read: false,
           createdAt: FieldValue.serverTimestamp()
        });
        
        await db.collection("users").doc(userId).set({
          social: { notifications: { lastLikesResetNotifAt: FieldValue.serverTimestamp() } }
        }, { merge: true });
        
        await sendPushToUser(userId, {
           title: "Beğeni Hakların Yenilendi! ❤️",
           body: "Bugünkü eşleşmeni henüz bulamadın mı? Hemen Keşfet'e göz at.",
           category: "engagement"
        });
      }
    });

    await Promise.all([...engagementPromises, ...resetPromises]);
    return null;
  } catch (err) {
    console.error("notifyDailyEngagement error:", err);
    return null;
  }
});
