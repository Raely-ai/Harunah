import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { db, FieldValue, getOpenAI, sendPushToUser } from "./base";

// 1. Complete Social Onboarding
export const completeSocialOnboarding = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    
    const { 
      nickname, gender, lookingFor, birthDate, interests, photos, bio,
      zodiacSign, element, rulingPlanet, planet, friendlySign, enemySign,
      age, mysticAnimal, luckyNumber, luckyColor
    } = data;

    if (!nickname || !gender || !lookingFor || !birthDate || !interests || !photos || !bio) {
      throw new functions.https.HttpsError('invalid-argument', 'Lütfen tüm zorunlu alanları doldurun.');
    }

    const userRef = db.collection("users").doc(userId);
    const now = new Date().toISOString();

    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const socialData = {
        nickname, gender, lookingFor, interests, photos, bio,
        enabled: true, profileCompleted: true, visible: true,
        banned: false, lastOnboardingAt: now, updatedAt: now,
        settings: {
          whoCanMessage: 'everyone', whoCanAddFriend: 'everyone',
          notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true }
        }
      };

      const baseData: any = {
        nickname, gender, lookingFor, interests, photos, bio, birthDate,
        zodiacSign: zodiacSign || "", element: element || "", rulingPlanet: rulingPlanet || planet || "",
        friendlySign: friendlySign || "", enemySign: enemySign || "", age: age || 0,
        mysticAnimal: mysticAnimal || "", luckyNumber: luckyNumber || "", luckyColor: luckyColor || "",
        updatedAt: now, social: socialData
      };

      if (!userSnap.exists) {
        baseData.createdAt = now; baseData.uid = userId; baseData.email = context.auth?.token.email || "";
        baseData.displayName = nickname; baseData.photoURL = photos[0] || "";
        baseData.energy = 50; baseData.mainCoins = 0;
        baseData.superLikes = 0; baseData.refreshCount = 0; baseData.compatibilityCount = 0;
        transaction.set(userRef, baseData);
      } else {
        transaction.update(userRef, baseData);
      }
      return { success: true };
    });
  } catch (error: any) {
    console.error("completeSocialOnboarding error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Profil oluşturulurken bir hata oluştu.');
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
    const updates: any = {};
    
    // Explicit guards to prevent undefined writes and maintain structure
    if (nickname !== undefined && nickname !== null) {
      if (typeof nickname !== 'string') throw new functions.https.HttpsError('invalid-argument', 'Nickname geçersiz.');
      if (nickname.length > 50) throw new functions.https.HttpsError('invalid-argument', 'Nickname çok uzun.');
      updates["social.nickname"] = nickname;
      updates["nickname"] = nickname;
      updates["displayName"] = nickname;
    }
    if (bio !== undefined && bio !== null) {
      if (typeof bio !== 'string') throw new functions.https.HttpsError('invalid-argument', 'Bio geçersiz.');
      if (bio.length > 500) throw new functions.https.HttpsError('invalid-argument', 'Bio çok uzun.');
      updates["social.bio"] = bio;
      updates["bio"] = bio;
    }
    if (gender !== undefined && gender !== null) {
      updates["social.gender"] = gender;
      updates["gender"] = gender;
    }
    if (zodiacSign !== undefined && zodiacSign !== null) {
      updates["social.zodiacSign"] = zodiacSign;
      updates["zodiacSign"] = zodiacSign;
    }
    if (photos !== undefined && photos !== null) {
      if (!Array.isArray(photos) || photos.length > 6) throw new functions.https.HttpsError('invalid-argument', 'Geçersiz fotoğraf listesi.');
      updates["social.photos"] = photos;
      updates["photos"] = photos;
      if (photos.length > 0) updates["photoURL"] = photos[0];
    }
    if (interests !== undefined && interests !== null) {
      updates["social.interests"] = interests;
      updates["interests"] = interests;
    }
    if (birthDate !== undefined && birthDate !== null) {
      updates["social.birthDate"] = birthDate;
      updates["birthDate"] = birthDate;
    }
    if (isOnline !== undefined && isOnline !== null) updates["social.isOnline"] = !!isOnline;
    if (lastSeen !== undefined && lastSeen !== null) {
      updates["social.lastSeen"] = FieldValue.serverTimestamp();
      updates["lastSeenAt"] = FieldValue.serverTimestamp();
    }

    if (Object.keys(updates).length === 0) return { success: true, status: 'SUCCESS', message: 'No changes' };

    updates["updatedAt"] = FieldValue.serverTimestamp();
    
    // Use set with merge: true instead of update() to avoid errors if the document doesn't exist
    await userRef.set(updates, { merge: true });
    
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
  
  try {
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    const nowIso = now.toISOString();

    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;
    const gender = userData.social?.gender || userData.gender || "";
    const targetGender = gender === 'erkek' ? 'kadın' : gender === 'kadın' ? 'erkek' : "";
    const recentIds = userData.social?.recentDiscoverIds || [];
    
    // Perform swipes check outside transaction to gather exclusion context rapidly
    const swipesSnap = await db.collection("swipes")
      .where("fromUserId", "==", userId)
      .limit(500) // Safety limit for query efficiency
      .get();
    const swipedUserIds = swipesSnap.docs.map(d => d.data().toUserId);
    const exclusionList = new Set([userId, ...recentIds, ...swipedUserIds]);

    let usersQuery = db.collection("users")
      .where("social.enabled", "==", true)
      .where("social.visible", "==", true);
      
    if (targetGender) {
      usersQuery = usersQuery.where("social.gender", "==", targetGender);
    }

    // Optimization: Use a slightly larger limit to account for exclusions, but keep it tight
    const queryLimit = 60; 
    const usersSnap = await usersQuery.limit(queryLimit).get();
    
    const result = await db.runTransaction(async (transaction) => {
      const tUserSnap = await transaction.get(userRef);
      if (!tUserSnap.exists) throw new Error("Kullanıcı bulunamadı.");
      const tUserData = tUserSnap.data() as any;
      const lastFree = tUserData.social?.lastFreeRefreshAt;
      const isFreeAvailable = !lastFree || (now.getTime() - new Date(lastFree).getTime() >= 24 * 60 * 60 * 1000);
      
      let status = 'SUCCESS';
      let updates: any = { "social.lastDiscoverRefreshAt": nowIso };
      
      if (isFreeAvailable) {
        status = 'FREE_REFRESH_USED'; 
        updates["social.lastFreeRefreshAt"] = nowIso;
      } else {
        if ((tUserData.refreshCount || 0) <= 0) return { success: false, status: 'INSUFFICIENT_FUNDS' };
        status = 'PAID_REFRESH_USED'; 
        updates["refreshCount"] = FieldValue.increment(-1);
      }

      let available = usersSnap.docs
        .filter(doc => !exclusionList.has(doc.id))
        .map(doc => ({ id: doc.id, ...doc.data() }));
        
      if (available.length < 5) {
        const absoluteExclusion = new Set([userId, ...swipedUserIds]);
        available = usersSnap.docs
          .filter(doc => !absoluteExclusion.has(doc.id))
          .map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      available = available.sort(() => Math.random() - 0.5).slice(0, 20);
      
      updates["social.recentDiscoverIds"] = Array.from(new Set([...recentIds, ...available.map(u => u.id)])).slice(-100);
      transaction.update(userRef, updates);
      
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
  const fromUserId = context.auth.uid;

  try {
    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const { targetUserId, type } = data;
    if (!targetUserId || !['like', 'super_like', 'pass'].includes(type) || fromUserId === targetUserId) {
      throw new functions.https.HttpsError('invalid-argument', 'Geçersiz işlem parametreleri.');
    }

    const fromUserRef = db.collection("users").doc(fromUserId);
    const toUserRef = db.collection("users").doc(targetUserId);

    const result = await db.runTransaction(async (transaction) => {
      const [fromSnap, toSnap] = await Promise.all([transaction.get(fromUserRef), transaction.get(toUserRef)]);
      if (!fromSnap.exists || !toSnap.exists) return { status: 'TARGET_NOT_FOUND' };

      const fromData = fromSnap.data() as any;
      const toData = toSnap.data() as any;
      if ((fromData.social?.blockedUserIds || []).includes(targetUserId) || (toData.social?.blockedUserIds || []).includes(fromUserId)) {
        return { status: 'BLOCKED' };
      }

      if (type === 'super_like') {
        if ((fromData.superLikes || 0) <= 0) return { status: 'INSUFFICIENT_FUNDS' };
        transaction.update(fromUserRef, { superLikes: FieldValue.increment(-1) });
      }

      const swipeId = `swipe_${fromUserId}_${targetUserId}`;
      const swipeRef = db.collection("swipes").doc(swipeId);
      const now = FieldValue.serverTimestamp();
      transaction.set(swipeRef, { id: swipeId, fromUserId, toUserId: targetUserId, type, updatedAt: now }, { merge: true });

      if (type === 'like' || type === 'super_like') {
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          userId: targetUserId, type: type === 'super_like' ? "super_like" : "like", title: type === 'super_like' ? "Yeni Süper Like!" : "Yeni Beğeni!",
          message: `${fromData.social?.nickname || fromData.displayName || "Biri"} seni beğendi! ❤️`,
          data: { fromUserId }, read: false, createdAt: now
        });
        if (type === 'super_like') {
          const requestRef = db.collection("interactionRequests").doc(`request_${fromUserId}_${targetUserId}`);
          transaction.set(requestRef, { id: `request_${fromUserId}_${targetUserId}`, fromUserId, toUserId: targetUserId, status: "pending", type: "super_like", createdAt: now, updatedAt: now }, { merge: true });
        }
      }
      return { status: 'SUCCESS', targetUserId, type, senderNickname: fromData.social?.nickname || fromData.displayName };
    });

    // Performance: Don't await push notification, return result immediately
    if (result.status === 'SUCCESS' && (type === 'like' || type === 'super_like')) {
      sendPushToUser(result.targetUserId, { 
        title: type === 'super_like' ? "Yeni Süper Like!" : "Yeni Beğeni!", 
        body: `${result.senderNickname} seni beğendi! ❤️`, 
        category: 'social', 
        senderId: fromUserId 
      }).catch(e => console.error("Push failed:", e));
    }
    return result;
  } catch (error: any) {
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 6. Send Message Request
export const sendMessageRequest = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const fromUserId = context.auth.uid;
  
  try {
    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const toUserId = data.toUserId || data.targetUserId;
    if (!toUserId || fromUserId === toUserId) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');

    const result = await db.runTransaction(async (transaction) => {
      const fromUserRef = db.collection("users").doc(fromUserId);
      const toUserRef = db.collection("users").doc(toUserId);
      const [fromSnap, toSnap] = await Promise.all([transaction.get(fromUserRef), transaction.get(toUserRef)]);
      if (!fromSnap.exists || !toSnap.exists) throw new Error("USER_NOT_FOUND");

      const requestId = `req_${fromUserId}_${toUserId}`;
      const requestRef = db.collection("interactionRequests").doc(requestId);
      const requestSnap = await transaction.get(requestRef);
      if (requestSnap.exists && requestSnap.data()?.status === 'pending') return { status: 'ALREADY_REQUESTED' };

      const now = FieldValue.serverTimestamp();
      transaction.set(requestRef, { id: requestId, fromUserId, toUserId, status: "pending", type: "message_request", createdAt: now, updatedAt: now });

      const notifRef = db.collection("notifications").doc();
      transaction.set(notifRef, { userId: toUserId, type: "message_request", title: "Yeni Mesaj İsteği", message: `${fromSnap.data()?.social?.nickname || fromSnap.data()?.displayName || "Biri"} sana bir mesaj isteği gönderdi.`, data: { fromUserId }, read: false, createdAt: now });
      return { status: 'SUCCESS', toUserId, senderNickname: fromSnap.data()?.social?.nickname || fromSnap.data()?.displayName };
    });

    if (result.status === 'SUCCESS') {
      sendPushToUser(result.toUserId, { title: "Yeni Mesaj İsteği", body: `${result.senderNickname} sana bir mesaj isteği gönderdi.`, category: 'social', senderId: fromUserId }).catch(e => console.error("Push failed:", e));
    }
    return result;
  } catch (error: any) {
    return { status: 'TECHNICAL_ERROR', message: error.message };
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
      if (!requestSnap.exists) throw new Error('NOT_FOUND');
      const request = requestSnap.data() as any;
      if (request.toUserId !== userId || request.status !== 'pending') throw new Error('INVALID_STATUS');

      const fromUserId = request.fromUserId;
      const [fromSnap, toSnap] = await Promise.all([transaction.get(db.collection("users").doc(fromUserId)), transaction.get(db.collection("users").doc(userId))]);
      if (!fromSnap.exists || !toSnap.exists) throw new Error('USER_NOT_FOUND');

      const chatId = `chat_${[fromUserId, userId].sort().join('_')}`;
      const chatRef = db.collection("chats").doc(chatId);
      const now = FieldValue.serverTimestamp();

      transaction.update(requestRef, { status: 'accepted', updatedAt: now });
      transaction.set(chatRef, { id: chatId, participants: [fromUserId, userId], createdAt: now, lastMessage: "Sohbet başladı! 👋", lastMessageAt: now, status: 'active', unreadCount: { [fromUserId]: 0, [userId]: 0 } }, { merge: true });
      
      const msgRef = db.collection("messages").doc();
      transaction.set(msgRef, { id: msgRef.id, chatId, participants: [fromUserId, userId], senderId: "system", text: "Sohbet başlayabilir.", createdAt: now, status: 'sent', type: 'system' });

      const notifRef = db.collection("notifications").doc();
      transaction.set(notifRef, { userId: fromUserId, type: "request_accepted", title: "İstek Kabul Edildi!", message: `${toSnap.data()?.social?.nickname || toSnap.data()?.displayName} mesaj isteğini kabul etti! 🎉`, data: { chatId }, read: false, createdAt: now });

      return { status: 'SUCCESS', chatId, fromUserId, toUserId: userId, toUserNickname: toSnap.data()?.social?.nickname || toSnap.data()?.displayName };
    });

    // Performance: Async push
    if (result.status === 'SUCCESS') {
      sendPushToUser(result.fromUserId, { 
        title: "İstek Kabul Edildi!", 
        body: `${result.toUserNickname} mesaj isteğini kabul etti! 🎉`, 
        data: { screen: 'chat', chatId: result.chatId }, 
        category: 'social', 
        senderId: result.toUserId 
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
    const { chatId, text, mediaUrl, mediaType } = data;
    if (!chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');

    const chatRef = db.collection("chats").doc(chatId);
    
    const result = await db.runTransaction(async (transaction) => {
      const chatSnap = await transaction.get(chatRef);
      if (!chatSnap.exists) throw new Error('NOT_FOUND');
      const chat = chatSnap.data() as any;
      if (!chat.participants.includes(senderId)) throw new Error('UNAUTHORIZED');

      const receiverId = chat.participants.find((id: string) => id !== senderId);
      const [senderSnap, receiverSnap] = await Promise.all([transaction.get(db.collection("users").doc(senderId)), transaction.get(db.collection("users").doc(receiverId))]);
      
      const now = FieldValue.serverTimestamp();
      const msgRef = db.collection("messages").doc();
      const type = mediaType || 'text';
      const lastMsgText = type === 'text' ? (text || "") : (type === 'image' ? "📷 Görsel" : "🎥 Video");

      transaction.set(msgRef, { id: msgRef.id, chatId, participants: [senderId, receiverId], senderId, receiverId, text: text || "", mediaUrl: mediaUrl || null, mediaType: mediaType || null, createdAt: now, status: 'sent', seen: false, type });
      transaction.update(chatRef, { lastMessage: lastMsgText, lastMessageAt: now, lastMessageSenderId: senderId, lastMessageStatus: 'sent', [`unreadCount.${receiverId}`]: FieldValue.increment(1) });
      transaction.update(db.collection("users").doc(receiverId), { unreadMessagesCount: FieldValue.increment(1) });
      return { status: 'SUCCESS', messageId: msgRef.id, receiverId, chatId, senderNickname: senderSnap.data()?.social?.nickname || senderSnap.data()?.displayName, lastMsgText };
    });

    if (result.status === 'SUCCESS') {
      sendPushToUser(result.receiverId, { title: result.senderNickname, body: result.lastMsgText, data: { screen: 'chat', chatId: result.chatId }, category: 'messages', senderId }).catch(e => console.error("Push failed:", e));
    }
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
    const unreads = await db.collection("messages").where("chatId", "==", chatId).where("receiverId", "==", userId).where("status", "!=", "seen").limit(100).get();
    if (unreads.empty) {
      await db.collection("chats").doc(chatId).update({ [`unreadCount.${userId}`]: 0 });
      return { success: true, status: 'SUCCESS' };
    }
    const batch = db.batch();
    unreads.docs.forEach(doc => batch.update(doc.ref, { status: 'seen', seen: true }));
    batch.update(db.collection("chats").doc(chatId), { [`unreadCount.${userId}`]: 0, lastMessageStatus: 'seen' });
    batch.update(db.collection("users").doc(userId), { unreadMessagesCount: FieldValue.increment(-unreads.size) });
    await batch.commit();
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
export const runDiscoverCompatibilityAnalysis = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
    const { targetUserId, relationshipType } = data;
    const cacheKey = `${userId}_${targetUserId}_${relationshipType}`;
    const history = await db.collection("compatibilityHistory").where("cacheKey", "==", cacheKey).limit(1).get();
    if (!history.empty) return { success: true, analysis: history.docs[0].data(), cached: true };

    const userRef = db.collection("users").doc(userId);
    const targetRef = db.collection("users").doc(targetUserId);
    return await db.runTransaction(async (transaction) => {
      const [uSnap, tSnap] = await Promise.all([transaction.get(userRef), transaction.get(targetRef)]);
      if (!uSnap.exists || !tSnap.exists) throw new Error("Kullanıcı bulunamadı.");
      const uData = uSnap.data() as any;
      if ((uData.compatibilityCount || 0) <= 0) throw new Error("INSUFFICIENT_FUNDS");

      transaction.update(userRef, { compatibilityCount: FieldValue.increment(-1) });
      const requestRef = db.collection("compatibilityRequests").doc();
      const readyAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      transaction.set(requestRef, { 
        id: requestRef.id, userId, source: 'discover', targetUserId, relationshipType, status: 'pending', createdAt: new Date().toISOString(), readyAt, cacheKey,
        person1: { name: uData.social?.nickname || uData.displayName, photo: uData.social?.photos?.[0], birthDate: uData.social?.birthDate },
        person2: { name: tSnap.data()?.social?.nickname || tSnap.data()?.displayName, photo: tSnap.data()?.social?.photos?.[0], birthDate: tSnap.data()?.social?.birthDate }
      });
      return { success: true, requestId: requestRef.id, readyAt };
    });
  } catch (error: any) {
    console.error("runDiscoverCompatibilityAnalysis error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
  }
});

// 23. Process Compatibility Requests
export const processCompatibilityRequests = functions.pubsub.schedule('every 2 minutes').onRun(async (context) => {
  const now = new Date().toISOString();
  const pendings = await db.collection("compatibilityRequests").where("status", "==", "pending").where("readyAt", "<=", now).limit(20).get();
  if (pendings.empty) return null;

  const openai = getOpenAI();
  for (const doc of pendings.docs) {
    const req = doc.data();
    try {
      const response = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "system", content: "Sen uzman bir ilişki danışmanısın." }, { role: "user", content: `Analyze compatibility for ${req.person1.name} and ${req.person2.name}.` }], max_tokens: 1000 });
      const aiComment = response.choices[0].message.content || "";
      const analysisData = { ...req, status: 'completed', loveScore: 85, aiComment, createdAt: now };
      const batch = db.batch();
      batch.update(doc.ref, { status: 'completed', updatedAt: now });
      const histRef = db.collection("compatibilityHistory").doc();
      batch.set(histRef, analysisData);
      batch.set(db.collection("notifications").doc(), { userId: req.userId, type: 'system', title: 'Analiz Hazır!', message: 'Sonuçları hemen incele!', read: false, createdAt: FieldValue.serverTimestamp() });
      await batch.commit();
      await sendPushToUser(req.userId, { title: 'Uyum Analiziniz Hazır!', body: 'Hemen incele!', category: 'compatibility' });
    } catch (e) {
      await doc.ref.update({ status: 'error', error: String(e) });
    }
  }
  return null;
});

export const runManualCompatibilityAnalysis = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.person1 || !data.person2) throw new functions.https.HttpsError('invalid-argument', 'Kişi bilgileri gerekli.');
    const { person1, person2, relationshipType } = data;
    const userRef = db.collection("users").doc(userId);
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists) throw new Error("User not found");
      if ((snap.data()?.compatibilityCount || 0) <= 0) throw new Error("INSUFFICIENT_FUNDS");
      transaction.update(userRef, { compatibilityCount: FieldValue.increment(-1) });
      const ref = db.collection("compatibilityRequests").doc();
      const readyAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      transaction.set(ref, { id: ref.id, userId, person1, person2, relationshipType, status: 'pending', createdAt: new Date().toISOString(), readyAt });
      return { success: true, requestId: ref.id, readyAt };
    });
  } catch (error: any) {
    console.error("runManualCompatibilityAnalysis error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
  }
});

export const checkDailyReminders = functions.region('us-central1').pubsub.schedule('every 24 hours').onRun(async (context) => { return null; });
