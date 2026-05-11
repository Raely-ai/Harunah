"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyDailyEngagement = exports.adminUpdateVerificationStatus = exports.submitProfileVerification = exports.generateThumbnails = exports.onMessageCreated = exports.notifyUnlockedCompatibility = exports.resetDailyDiscoverLikes = exports.claim10MinuteReward = exports.claimOnboardingDiscoverBonus = exports.speedUpCompatibilityAnalysis = exports.runManualCompatibilityAnalysis = exports.runDiscoverCompatibilityAnalysis = exports.createChat = exports.createReport = exports.unmuteUser = exports.muteUser = exports.unblockUser = exports.blockUser = exports.setTypingStatus = exports.editMessage = exports.deleteMessage = exports.deleteChat = exports.markAsDelivered = exports.markAsSeen = exports.sendMessage = exports.rejectRequest = exports.acceptRequest = exports.sendMessageRequest = exports.claimProfileCompletionReward = exports.sendPriorityMessageRequest = exports.sendLike = exports.refreshDiscoverFeed = exports.refreshDiscover = exports.updateSocialSettings = exports.updateSocialProfile = exports.completeSocialOnboarding = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const base_1 = require("./base");
const wallet_1 = require("./wallet");
exports.completeSocialOnboarding = functions.region('us-central1').https.onCall(async (data, context) => {
    console.log("AUDIT: completeSocialOnboarding started. Data received:", JSON.stringify(data));
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data)
            throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
        const { nickname = "", gender = "erkek", lookingFor = "", birthDate = "", interests = [], photos = [], bio = "", zodiacSign = "", element = "", rulingPlanet = "", planet = "", friendlySign = "", enemySign = "", age = 0, mysticAnimal = "", luckyNumber = "", luckyColor = "" } = data || {};
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
        const userRef = base_1.db.collection("users").doc(userId);
        return await base_1.db.runTransaction(async (transaction) => {
            console.log("AUDIT: Fast Track Transaction started.");
            const userSnap = await transaction.get(userRef);
            const socialData = {
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
                lastOnboardingAt: base_1.FieldValue.serverTimestamp(),
                updatedAt: base_1.FieldValue.serverTimestamp(),
                settings: {
                    whoCanMessage: 'everyone',
                    whoCanAddFriend: 'everyone',
                    notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true }
                }
            };
            const baseData = {
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
                updatedAt: base_1.FieldValue.serverTimestamp(),
                social: socialData
            };
            console.log("AUDIT: baseData before cleaning:", JSON.stringify(baseData));
            const cleanData = (obj) => {
                Object.keys(obj).forEach(key => {
                    if (obj[key] === undefined)
                        delete obj[key];
                    else if (obj[key] && typeof obj[key] === 'object' && !(obj[key] instanceof admin.firestore.FieldValue)) {
                        cleanData(obj[key]);
                    }
                });
            };
            cleanData(baseData);
            if (!userSnap.exists) {
                baseData.createdAt = base_1.FieldValue.serverTimestamp();
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
            }
            else {
                console.log("AUDIT: transaction.set (merge)");
                transaction.set(userRef, baseData, { merge: true });
            }
            return { success: true };
        });
    }
    catch (error) {
        console.error("completeSocialOnboarding failure:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Profil oluşturulurken teknik bir hata oluştu.', error);
    }
});
exports.updateSocialProfile = functions.region('us-central1').https.onCall(async (data, context) => {
    console.log("updateSocialProfile AUTH CONTEXT:", context.auth ? { uid: context.auth.uid, email: context.auth.token.email } : "NULL");
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data)
            throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
        const { nickname, bio, gender, zodiacSign, photos, interests, birthDate, isOnline, lastSeen } = data;
        const userRef = base_1.db.collection("users").doc(userId);
        const baseUpdates = {};
        const socialUpdates = {};
        if (nickname !== undefined && nickname !== null) {
            if (typeof nickname !== 'string')
                throw new functions.https.HttpsError('invalid-argument', 'Nickname geçersiz.');
            if (nickname.length > 50)
                throw new functions.https.HttpsError('invalid-argument', 'Nickname çok uzun.');
            socialUpdates.nickname = nickname;
            baseUpdates.nickname = nickname;
            baseUpdates.displayName = nickname;
        }
        if (bio !== undefined && bio !== null) {
            if (typeof bio !== 'string')
                throw new functions.https.HttpsError('invalid-argument', 'Bio geçersiz.');
            if (bio.length > 500)
                throw new functions.https.HttpsError('invalid-argument', 'Bio çok uzun.');
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
            if (!Array.isArray(photos) || photos.length > 6)
                throw new functions.https.HttpsError('invalid-argument', 'Geçersiz fotoğraf listesi.');
            socialUpdates.photos = photos;
            baseUpdates.photos = photos;
            if (photos.length > 0)
                baseUpdates.photoURL = photos[0];
        }
        if (interests !== undefined && interests !== null) {
            if (!Array.isArray(interests))
                throw new functions.https.HttpsError('invalid-argument', 'İlgi alanları geçersiz.');
            socialUpdates.interests = interests;
            baseUpdates.interests = interests;
        }
        if (birthDate !== undefined && birthDate !== null) {
            socialUpdates.birthDate = birthDate;
            baseUpdates.birthDate = birthDate;
        }
        if (isOnline !== undefined && isOnline !== null)
            socialUpdates.isOnline = !!isOnline;
        if (lastSeen !== undefined && lastSeen !== null) {
            socialUpdates.lastSeen = base_1.FieldValue.serverTimestamp();
            baseUpdates.lastSeenAt = base_1.FieldValue.serverTimestamp();
        }
        const updates = { ...baseUpdates };
        if (Object.keys(socialUpdates).length > 0) {
            updates.social = socialUpdates;
        }
        if (Object.keys(updates).length === 0)
            return { success: true, status: 'SUCCESS', message: 'No changes' };
        updates["updatedAt"] = base_1.FieldValue.serverTimestamp();
        await userRef.set(updates, { merge: true });
        const updatedSnap = await userRef.get();
        const userData = updatedSnap.data();
        if (userData?.social) {
            const completion = calculateProfileCompletion(userData.social);
            if (completion === 100 && !userData.social.rewardClaimed) {
                const lastCompNotifAt = userData.social.notifications?.lastProfileCompletedNotifAt;
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                if (!lastCompNotifAt || lastCompNotifAt.toMillis() < oneDayAgo) {
                    const notifRef = base_1.db.collection("notifications").doc();
                    await notifRef.set({
                        userId,
                        type: "profile_completed",
                        title: "Profilin Tamamlandı! ✨",
                        message: "Harika görünüyorsun! Ödülünü Görev Merkezi'nden alabilirsin.",
                        read: false,
                        createdAt: base_1.FieldValue.serverTimestamp()
                    });
                    await userRef.set({
                        social: { notifications: { lastProfileCompletedNotifAt: base_1.FieldValue.serverTimestamp() } }
                    }, { merge: true });
                    await (0, base_1.sendPushToUser)(userId, {
                        title: "Profilin Tamamlandı! ✨",
                        body: "Harika görünüyorsun! Ödülünü Görev Merkezi'nden alabilirsin.",
                        category: "status"
                    });
                }
            }
        }
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("REAL ERROR in updateSocialProfile:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        const message = error.message || 'Profil güncellenirken bir hata oluştu.';
        throw new functions.https.HttpsError('internal', message, error.stack);
    }
});
exports.updateSocialSettings = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.settings)
            throw new functions.https.HttpsError('invalid-argument', 'Ayarlar gerekli.');
        const { settings } = data;
        const userRef = base_1.db.collection("users").doc(userId);
        const allowedFields = ['visibility', 'discoveryEnabled', 'notificationsEnabled', 'genderPreference', 'minAge', 'maxAge', 'whoCanMessage', 'whoCanAddFriend', 'notifications', 'enabled', 'visible'];
        const updates = {};
        Object.keys(settings).forEach(key => {
            if (allowedFields.includes(key)) {
                if (key === 'enabled' || key === 'visible')
                    updates[`social.${key}`] = settings[key];
                else
                    updates[`social.settings.${key}`] = settings[key];
            }
        });
        if (Object.keys(updates).length > 0) {
            updates["updatedAt"] = base_1.FieldValue.serverTimestamp();
            await userRef.set(updates, { merge: true });
        }
        return { success: true };
    }
    catch (error) {
        console.error("updateSocialSettings error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Ayarlar güncellenirken hata oluştu.');
    }
});
exports.refreshDiscover = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    console.log(`[refreshDiscover] DEBUG START: function called by auth uid=${userId}`);
    try {
        const userRef = base_1.db.collection("users").doc(userId);
        const now = new Date();
        const nowIso = now.toISOString();
        const userSnap = await userRef.get();
        if (!userSnap.exists)
            throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
        const userData = userSnap.data();
        const gender = userData.social?.gender || userData.gender || "";
        const lookingFor = userData.social?.lookingFor || userData.lookingFor || "";
        let targetGender = "";
        const mode = data?.mode || 'discover';
        const lfLower = String(lookingFor).toLowerCase();
        if (mode === 'match') {
            targetGender = gender === 'erkek' ? 'kadın' : gender === 'kadın' ? 'erkek' : "";
        }
        else {
            if (lfLower === "erkek" || lfLower === "male" || lfLower === "man" || lfLower === "adam") {
                targetGender = "erkek";
            }
            else if (lfLower === "kadın" || lfLower === "kadin" || lfLower === "female" || lfLower === "woman" || lfLower === "bayan") {
                targetGender = "kadın";
            }
            else if (lfLower === "herkes" || lfLower === "all" || lfLower === "arkadaş" || lfLower === "arkadas") {
                targetGender = "";
            }
            else {
                targetGender = gender === 'erkek' ? 'kadın' : gender === 'kadın' ? 'erkek' : "";
            }
        }
        console.log(`[refreshDiscover] userId: ${userId}, gender: ${gender}, lookingFor: ${lookingFor}, targetGenderQuery: ${targetGender || 'ALL'}`);
        console.log(`[refreshDiscover] DEBUG START: userId=${userId}, gender=${gender}, lookingFor=${lookingFor}, targetGenderQuery=${targetGender || 'ALL'}, mode=${mode}`);
        const swipesSnap = await base_1.db.collection("swipes")
            .where("fromUserId", "==", userId)
            .limit(800)
            .get();
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const swipedUserIds = swipesSnap.docs
            .filter(d => {
            const data = d.data();
            if (data.type !== 'pass')
                return true;
            const createdAt = data.createdAt?.toMillis?.() || 0;
            if (createdAt && createdAt < thirtyDaysAgo)
                return false;
            return true;
        })
            .map(d => d.data().toUserId);
        const exclusionList = new Set([userId, ...swipedUserIds]);
        let usersQuery = base_1.db.collection("users")
            .where("social.enabled", "==", true)
            .where("social.visible", "==", true);
        if (targetGender) {
            usersQuery = usersQuery.where("social.gender", "==", targetGender);
        }
        const queryLimit = 250;
        const usersSnap = await usersQuery.limit(queryLimit).get();
        console.log(`[refreshDiscover] DEBUG RAW USERS COUNT: ${usersSnap.docs.length}`);
        console.log(`[refreshDiscover] DEBUG SWIPES EXCLUDED COUNT: ${swipedUserIds.length}`);
        const result = await base_1.db.runTransaction(async (transaction) => {
            const tUserSnap = await transaction.get(userRef);
            if (!tUserSnap.exists)
                throw new Error("Kullanıcı bulunamadı.");
            const tUserData = tUserSnap.data();
            const lastFree = tUserData.social?.lastFreeRefreshAt;
            const isFreeAvailable = !lastFree || (now.getTime() - new Date(lastFree).getTime() >= 24 * 60 * 60 * 1000);
            let status = 'SUCCESS';
            let updates = {};
            if (mode === 'match') {
                status = 'MATCH_MODE';
            }
            else {
                updates["social.lastDiscoverRefreshAt"] = nowIso;
                if (isFreeAvailable) {
                    status = 'FREE_REFRESH_USED';
                    updates["social.lastFreeRefreshAt"] = nowIso;
                }
                else {
                    if ((tUserData.refreshCount || 0) <= 0)
                        return { success: false, status: 'INSUFFICIENT_FUNDS' };
                    status = 'PAID_REFRESH_USED';
                    updates["refreshCount"] = base_1.FieldValue.increment(-1);
                }
            }
            const mapUserDoc = (doc) => {
                const d = doc.data();
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
                const selfExclusion = new Set([userId]);
                available = usersSnap.docs
                    .filter(doc => !selfExclusion.has(doc.id))
                    .map(mapUserDoc);
            }
            available = available.sort((a, b) => {
                const aBoost = a.boostExpiresAt ? new Date(a.boostExpiresAt).getTime() : 0;
                const bBoost = b.boostExpiresAt ? new Date(b.boostExpiresAt).getTime() : 0;
                const nowTime = Date.now();
                const aIsBoosted = aBoost > nowTime;
                const bIsBoosted = bBoost > nowTime;
                if (aIsBoosted && !bIsBoosted)
                    return -1;
                if (bIsBoosted && !aIsBoosted)
                    return 1;
                return Math.random() - 0.5;
            }).slice(0, 20);
            if (Object.keys(updates).length > 0) {
                transaction.update(userRef, updates);
            }
            console.log(`[refreshDiscover] DEBUG FINAL RETURNED COUNT: ${available.length}, UID LIST: ${available.map((u) => u.uid).join(',')}`);
            return { success: true, status, users: available };
        });
        return result;
    }
    catch (error) {
        console.error("[refreshDiscover] Error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Keşfet yenilenirken hata oluştu.');
    }
});
exports.refreshDiscoverFeed = exports.refreshDiscover;
exports.sendLike = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    if (!data)
        throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const fromUserId = context.auth.uid;
    const { targetUserId, type, source } = data;
    if (!targetUserId || !['like', 'super_like', 'pass'].includes(type) || fromUserId === targetUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'Geçersiz işlem parametreleri.');
    }
    try {
        const fromUserRef = base_1.db.collection("users").doc(fromUserId);
        const toUserRef = base_1.db.collection("users").doc(targetUserId);
        const result = await base_1.db.runTransaction(async (transaction) => {
            const [fromSnap, toSnap] = await Promise.all([transaction.get(fromUserRef), transaction.get(toUserRef)]);
            if (!fromSnap.exists || !toSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const fromData = fromSnap.data();
            const toData = toSnap.data();
            const now = new Date();
            const today = now.toISOString().split('T')[0];
            const lastDate = fromData.dailySwipeDate || "";
            const used = fromData.dailySwipeUsed || 0;
            const isNewDay = lastDate !== today;
            const swipeUpdate = {};
            swipeUpdate['social.lifetimeSwipes'] = base_1.FieldValue.increment(1);
            if (type !== 'pass') {
                const lifetimeSwipes = fromData.social?.lifetimeSwipes || 0;
                const isFreeOnboardingSwipe = lifetimeSwipes < 10 && type === 'like';
                if (type === 'super_like') {
                    if ((fromData.superLikes || 0) <= 0) {
                        throw new functions.https.HttpsError('failed-precondition', 'Yetersiz Süper Like.');
                    }
                    swipeUpdate.superLikes = base_1.FieldValue.increment(-1);
                }
                else {
                    if (source === 'discover') {
                        const currentRemaining = fromData.social?.discoverLikesRemaining ?? fromData.discoverLikesRemaining ?? 0;
                        if (!isFreeOnboardingSwipe) {
                            if (currentRemaining <= 0) {
                                throw new functions.https.HttpsError('failed-precondition', 'discover_like_limit_reached');
                            }
                            swipeUpdate['social.discoverLikesRemaining'] = base_1.FieldValue.increment(-1);
                        }
                    }
                    else {
                        if (!isFreeOnboardingSwipe) {
                            if (!isNewDay && used >= 15) {
                                throw new functions.https.HttpsError('resource-exhausted', 'daily_limit_reached');
                            }
                            swipeUpdate.dailySwipeUsed = isNewDay ? 1 : base_1.FieldValue.increment(1);
                            swipeUpdate.dailySwipeDate = today;
                        }
                    }
                }
                transaction.update(fromUserRef, swipeUpdate);
            }
            const swipeId = `swipe_${fromUserId}_${targetUserId}`;
            const swipeRef = base_1.db.collection("swipes").doc(swipeId);
            const serverNow = base_1.FieldValue.serverTimestamp();
            transaction.set(swipeRef, { id: swipeId, fromUserId, toUserId: targetUserId, type, createdAt: serverNow, updatedAt: serverNow }, { merge: true });
            if (type === 'like' || type === 'super_like') {
                const notifRef = base_1.db.collection("notifications").doc();
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
            (0, base_1.sendPushToUser)(result.targetUserId, {
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
    }
    catch (error) {
        console.error("sendLike error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Beğeni işlemi başarısız oldu.');
    }
});
exports.sendPriorityMessageRequest = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const fromUserId = context.auth.uid;
    const { targetUserId } = data;
    if (!targetUserId || fromUserId === targetUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'Geçersiz kullanıcı.');
    }
    try {
        const economy = await (0, wallet_1.getEconomyConfig)() || {};
        const priorityMessagePrice = economy.socialPricing?.priorityMessagePrice || 50;
        const fromUserRef = base_1.db.collection("users").doc(fromUserId);
        const requestRef = base_1.db.collection("interactionRequests").doc(`req_${fromUserId}_${targetUserId}`);
        let fromUserName = "Biri";
        await base_1.db.runTransaction(async (transaction) => {
            const fromSnap = await transaction.get(fromUserRef);
            if (!fromSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const fromData = fromSnap.data();
            fromUserName = fromData.social?.nickname || fromData.displayName || "Biri";
            if ((fromData.mainCoins || 0) < priorityMessagePrice) {
                throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
            }
            const reqSnap = await transaction.get(requestRef);
            if (reqSnap.exists)
                throw new functions.https.HttpsError('already-exists', 'Bir istek zaten var.');
            transaction.update(fromUserRef, { mainCoins: base_1.FieldValue.increment(-priorityMessagePrice) });
            const now = base_1.FieldValue.serverTimestamp();
            transaction.set(requestRef, {
                id: requestRef.id, fromUserId, toUserId: targetUserId, status: 'pending', type: 'priority_message_request', priority: true, createdAt: now
            });
            transaction.set(base_1.db.collection("notifications").doc(), {
                userId: targetUserId, fromUserId, type: 'priority_message_request',
                title: "Öncelikli Mesaj İsteği 🚀",
                message: `${fromUserName} sana öncelikli bir mesaj isteği gönderdi!`,
                read: false, createdAt: now
            });
        });
        await (0, base_1.sendPushToUser)(targetUserId, {
            title: "Öncelikli mesaj isteğin var 💌",
            body: `${fromUserName} sana öne çıkan bir mesaj isteği gönderdi.`,
            data: {
                type: "priority_message_request",
                fromUserId,
                requestId: `req_${fromUserId}_${targetUserId}`,
                targetTab: "messages",
                targetSubTab: "requests"
            }
        });
        return { success: true };
    }
    catch (error) {
        console.error("sendPriorityMessageRequest error:", error);
        throw error;
    }
});
exports.claimProfileCompletionReward = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        const userRef = base_1.db.collection("users").doc(userId);
        const economy = await (0, wallet_1.getEconomyConfig)() || {};
        const rewardAmount = economy.rewards?.profileCompletionEnergy || 50;
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
            const userData = userSnap.data();
            const s = userData.social || {};
            let score = 0;
            const photoCount = s.photos?.length || 0;
            let photoScore = 0;
            if (photoCount === 1)
                photoScore = 20;
            else if (photoCount >= 2 && photoCount <= 3)
                photoScore = 25;
            else if (photoCount >= 4)
                photoScore = 30;
            if (s.nickname || userData.displayName)
                score += 15;
            if (s.gender || userData.gender)
                score += 15;
            if (userData.birthDate)
                score += 15;
            if (s.bio)
                score += 15;
            if (s.interests && s.interests.length > 0)
                score += 10;
            score += photoScore;
            if (score < 100) {
                throw new functions.https.HttpsError('failed-precondition', `Profil tamamlama puanı yetersiz (${score}/100).`);
            }
            if (s.completionRewardClaimed) {
                throw new functions.https.HttpsError('already-exists', 'Bu ödülü zaten aldınız.');
            }
            const now = new Date().toISOString();
            transaction.update(userRef, {
                energy: admin.firestore.FieldValue.increment(rewardAmount),
                "social.completionRewardClaimed": true,
                "social.updatedAt": admin.firestore.FieldValue.serverTimestamp()
            });
            const txRef = base_1.db.collection("walletTransactions").doc();
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
    }
    catch (error) {
        console.error("claimProfileCompletionReward error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Ödül işlenirken bir hata oluştu.');
    }
});
exports.sendMessageRequest = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    if (!data)
        throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const fromUserId = context.auth.uid;
    const toUserId = data.toUserId || data.targetUserId;
    if (!toUserId || fromUserId === toUserId)
        throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
    try {
        const fromUserRef = base_1.db.collection("users").doc(fromUserId);
        const toUserRef = base_1.db.collection("users").doc(toUserId);
        const result = await base_1.db.runTransaction(async (transaction) => {
            const [fromSnap, toSnap] = await Promise.all([transaction.get(fromUserRef), transaction.get(toUserRef)]);
            if (!fromSnap.exists || !toSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const fromData = fromSnap.data();
            const requestId = `req_${fromUserId}_${toUserId}`;
            const requestRef = base_1.db.collection("interactionRequests").doc(requestId);
            const requestSnap = await transaction.get(requestRef);
            if (requestSnap.exists && requestSnap.data()?.status === 'pending')
                return { success: false, status: 'ALREADY_REQUESTED' };
            const now = base_1.FieldValue.serverTimestamp();
            transaction.set(requestRef, {
                id: requestId, fromUserId, toUserId,
                status: "pending", type: "message_request",
                createdAt: now, updatedAt: now
            }, { merge: true });
            const notifRef = base_1.db.collection("notifications").doc();
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
            (0, base_1.sendPushToUser)(result.toUserId, {
                title: "Yeni Mesaj İsteği 💌",
                body: `${result.senderNickname} sana bir mesaj isteği gönderdi.`,
                category: 'social',
                senderId: fromUserId,
                imageUrl: result.senderPhoto
            }).catch(e => console.error("Push failed:", e));
        }
        return result;
    }
    catch (error) {
        console.error("sendMessageRequest error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İstek gönderilemedi.');
    }
});
exports.acceptRequest = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data)
            throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
        const { requestId } = data;
        if (!requestId)
            throw new functions.https.HttpsError('invalid-argument', 'Request ID gerekli.');
        const requestRef = base_1.db.collection("interactionRequests").doc(requestId);
        const result = await base_1.db.runTransaction(async (transaction) => {
            const requestSnap = await transaction.get(requestRef);
            if (!requestSnap.exists)
                throw new functions.https.HttpsError('not-found', 'İstek bulunamadı.');
            const request = requestSnap.data();
            if (request.toUserId !== userId || request.status !== 'pending')
                throw new functions.https.HttpsError('failed-precondition', 'Geçersiz istek durumu.');
            const fromUserId = request.fromUserId;
            const [fromSnap, toSnap] = await Promise.all([transaction.get(base_1.db.collection("users").doc(fromUserId)), transaction.get(base_1.db.collection("users").doc(userId))]);
            if (!fromSnap.exists || !toSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
            const chatId = `chat_${[fromUserId, userId].sort().join('_')}`;
            const chatRef = base_1.db.collection("chats").doc(chatId);
            const now = base_1.FieldValue.serverTimestamp();
            transaction.update(requestRef, { status: 'accepted', updatedAt: now });
            transaction.set(chatRef, { id: chatId, participants: [fromUserId, userId], createdAt: now, lastMessage: "Sohbet başladı! 👋", lastMessageAt: now, status: 'active', unreadCount: { [fromUserId]: 0, [userId]: 0 } }, { merge: true });
            const msgRef = base_1.db.collection("messages").doc();
            transaction.set(msgRef, { id: msgRef.id, chatId, participants: [fromUserId, userId], senderId: "system", text: "Sohbet başlayabilir.", createdAt: now, status: 'sent', type: 'system' });
            const notifRef = base_1.db.collection("notifications").doc();
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
        if (result.status === 'SUCCESS') {
            (0, base_1.sendPushToUser)(result.fromUserId, {
                title: "İstek Kabul Edildi!",
                body: `${result.toUserNickname} mesaj isteğini kabul etti! 🎉`,
                data: { screen: 'chat', chatId: result.chatId },
                category: 'social',
                senderId: result.toUserId,
                imageUrl: result.toUserPhoto
            }).catch(e => console.error("Push failed:", e));
        }
        return result;
    }
    catch (error) {
        console.error("acceptRequest error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İstek kabul edilirken hata oluştu.');
    }
});
exports.rejectRequest = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        if (!data || !data.requestId)
            throw new functions.https.HttpsError('invalid-argument', 'Request ID gerekli.');
        const { requestId } = data;
        const requestRef = base_1.db.collection("interactionRequests").doc(requestId);
        await requestRef.set({ status: 'rejected', updatedAt: base_1.FieldValue.serverTimestamp() }, { merge: true });
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("rejectRequest error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.sendMessage = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const senderId = context.auth.uid;
    try {
        if (!data)
            throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
        const { chatId, text, mediaUrl, mediaType, fileName } = data;
        if (!chatId)
            throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
        const chatRef = base_1.db.collection("chats").doc(chatId);
        const result = await base_1.db.runTransaction(async (transaction) => {
            const chatSnap = await transaction.get(chatRef);
            if (!chatSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Sohbet bulunamadı.');
            const chat = chatSnap.data();
            if (!chat.participants.includes(senderId))
                throw new functions.https.HttpsError('permission-denied', 'Bu sohbete erişim yetkiniz yok.');
            const receiverId = chat.participants.find((id) => id !== senderId);
            if (!receiverId)
                throw new functions.https.HttpsError('failed-precondition', 'Alıcı bulunamadı.');
            const [senderSnap, receiverSnap] = await Promise.all([transaction.get(base_1.db.collection("users").doc(senderId)), transaction.get(base_1.db.collection("users").doc(receiverId))]);
            const senderData = senderSnap.data();
            const receiverData = receiverSnap.data();
            if (receiverData?.social?.blockedUserIds?.includes(senderId) || senderData?.social?.blockedUserIds?.includes(receiverId)) {
                throw new functions.https.HttpsError('permission-denied', 'Bu kullanıcıyla mesajlaşamazsınız.');
            }
            const now = base_1.FieldValue.serverTimestamp();
            const msgRef = base_1.db.collection("messages").doc();
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
                [`unreadCount.${receiverId}`]: base_1.FieldValue.increment(1)
            });
            transaction.update(base_1.db.collection("users").doc(receiverId), { unreadMessagesCount: base_1.FieldValue.increment(1) });
            return { status: 'SUCCESS', messageId: msgRef.id, receiverId, chatId, senderNickname: senderData?.social?.nickname || senderData?.displayName, lastMsgText };
        });
        return result;
    }
    catch (error) {
        console.error("sendMessage error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Mesaj gönderilirken hata oluştu.');
    }
});
exports.markAsSeen = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.chatId)
            throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
        const { chatId } = data;
        try {
            const chatRef = base_1.db.collection("chats").doc(chatId);
            const chatSnap = await chatRef.get();
            if (chatSnap.exists) {
                const chatData = chatSnap.data();
                const updates = { [`unreadCount.${userId}`]: 0 };
                if (chatData?.lastMessageSenderId && chatData.lastMessageSenderId !== userId) {
                    updates.lastMessageStatus = 'seen';
                }
                await chatRef.update(updates);
            }
        }
        catch (e) {
            console.error("markAsSeen chat update error:", e);
        }
        try {
            const unreadsInfo = await base_1.db.collection("messages").where("chatId", "==", chatId).where("receiverId", "==", userId).where("status", "in", ["sent", "delivered"]).limit(100).get();
            if (!unreadsInfo.empty) {
                const batch = base_1.db.batch();
                unreadsInfo.docs.forEach(doc => batch.update(doc.ref, { status: 'seen', seen: true }));
                batch.update(base_1.db.collection("users").doc(userId), { unreadMessagesCount: base_1.FieldValue.increment(-unreadsInfo.size) });
                await batch.commit();
            }
        }
        catch (e) {
            console.error("markAsSeen messages query error:", e);
        }
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("markAsSeen error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.markAsDelivered = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.chatId)
            throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
        const { chatId } = data;
        const sents = await base_1.db.collection("messages").where("chatId", "==", chatId).where("receiverId", "==", userId).where("status", "==", "sent").limit(100).get();
        if (sents.empty)
            return { success: true, status: 'SUCCESS' };
        const batch = base_1.db.batch();
        sents.docs.forEach(doc => batch.update(doc.ref, { status: 'delivered' }));
        await batch.commit();
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("markAsDelivered error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.deleteChat = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.chatId)
            throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
        const { chatId } = data;
        await base_1.db.collection("chats").doc(chatId).update({ deletedFor: base_1.FieldValue.arrayUnion(userId) });
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("deleteChat error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.deleteMessage = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.messageId)
            throw new functions.https.HttpsError('invalid-argument', 'Message ID gerekli.');
        const { messageId, forEveryone } = data;
        const msgRef = base_1.db.collection("messages").doc(messageId);
        const snap = await msgRef.get();
        if (snap.exists && snap.data()?.senderId === userId) {
            if (forEveryone)
                await msgRef.update({ isDeleted: true, deletedForEveryone: true, text: "Bu mesaj silindi.", mediaUrl: null, mediaType: null });
            else
                await msgRef.update({ isDeleted: true });
        }
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("deleteMessage error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Mesaj silinirken hata oluştu.');
    }
});
exports.editMessage = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.messageId)
            throw new functions.https.HttpsError('invalid-argument', 'Mesaj ID ve yeni metin gerekli.');
        const { messageId, newText } = data;
        const msgRef = base_1.db.collection("messages").doc(messageId);
        const snap = await msgRef.get();
        if (snap.exists && snap.data()?.senderId === userId) {
            await msgRef.update({ text: newText, editedAt: base_1.FieldValue.serverTimestamp() });
        }
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("editMessage error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Mesaj düzenlenirken hata oluştu.');
    }
});
exports.setTypingStatus = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.chatId)
            throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
        const { chatId, isTyping } = data;
        await base_1.db.collection("chats").doc(chatId).set({ [`typing.${userId}`]: !!isTyping }, { merge: true });
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("setTypingStatus error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.blockUser = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        if (!data || !data.targetUid)
            throw new functions.https.HttpsError('invalid-argument', 'Target UID gerekli.');
        const { targetUid } = data;
        await base_1.db.collection("users").doc(context.auth.uid).set({ "social.blockedUserIds": base_1.FieldValue.arrayUnion(targetUid) }, { merge: true });
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("blockUser error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Engelleme sırasında hata oluştu.');
    }
});
exports.unblockUser = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        if (!data || !data.targetUid)
            throw new functions.https.HttpsError('invalid-argument', 'Target UID gerekli.');
        const { targetUid } = data;
        await base_1.db.collection("users").doc(context.auth.uid).set({ "social.blockedUserIds": base_1.FieldValue.arrayRemove(targetUid) }, { merge: true });
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("unblockUser error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Engeli kaldırırken hata oluştu.');
    }
});
exports.muteUser = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        if (!data || !data.targetUid)
            throw new functions.https.HttpsError('invalid-argument', 'Target UID gerekli.');
        const { targetUid } = data;
        await base_1.db.collection("users").doc(context.auth.uid).set({ "social.mutedUserIds": base_1.FieldValue.arrayUnion(targetUid) }, { merge: true });
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("muteUser error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Sessize alma sırasında hata oluştu.');
    }
});
exports.unmuteUser = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        if (!data || !data.targetUid)
            throw new functions.https.HttpsError('invalid-argument', 'Target UID gerekli.');
        const { targetUid } = data;
        await base_1.db.collection("users").doc(context.auth.uid).set({ "social.mutedUserIds": base_1.FieldValue.arrayRemove(targetUid) }, { merge: true });
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("unmuteUser error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Sessizden çıkarma sırasında hata oluştu.');
    }
});
exports.createReport = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        if (!data || !data.reportedUserId)
            throw new functions.https.HttpsError('invalid-argument', 'Raporlanan kullanıcı ID gerekli.');
        const { reportedUserId, source, reason, description, metadata } = data;
        const existingReports = await base_1.db.collection("reports")
            .where("reporterId", "==", context.auth.uid)
            .where("reportedUserId", "==", reportedUserId)
            .where("status", "==", "pending")
            .get();
        if (!existingReports.empty) {
            throw new functions.https.HttpsError('already-exists', 'Bu kullanıcı için zaten incelemede olan bir raporunuz bulunmaktadır.');
        }
        const ref = base_1.db.collection("reports").doc();
        await ref.set({ id: ref.id, reporterId: context.auth.uid, reportedUserId, source, reason, description: description || "", metadata: metadata || {}, createdAt: base_1.FieldValue.serverTimestamp(), status: 'pending' });
        return { success: true, status: 'SUCCESS' };
    }
    catch (error) {
        console.error("createReport error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Rapor oluşturulurken hata oluştu.');
    }
});
exports.createChat = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.targetUserId)
            throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
        const { targetUserId } = data;
        const chatId = `chat_${[userId, targetUserId].sort().join('_')}`;
        const now = base_1.FieldValue.serverTimestamp();
        await base_1.db.collection("chats").doc(chatId).set({ id: chatId, participants: [userId, targetUserId], createdAt: now, lastMessage: "Sohbet başladı! 👋", lastMessageAt: now, status: 'active', unreadCount: { [userId]: 0, [targetUserId]: 0 } }, { merge: true });
        return { success: true, status: 'SUCCESS', chatId };
    }
    catch (error) {
        console.error("createChat error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Sohbet oluşturulurken hata oluştu.');
    }
});
async function generateCompatibilityAiDirect(person1, person2, relationshipType, userId, targetUserId, cacheKey) {
    const now = new Date().toISOString();
    const openai = (0, base_1.getOpenAI)();
    try {
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
        let parsed = {};
        try {
            parsed = JSON.parse(aiContent);
        }
        catch (e) {
            console.error("GPT JSON parse error:", e, "Content was:", aiContent);
        }
        const summaryContent = parsed.summaryLong || parsed.interpretation || parsed.summary || "";
        const parseScore = (val) => {
            const num = parseInt(val);
            return (!isNaN(num) && num > 0 && num <= 100) ? num : (Math.floor(Math.random() * 41) + 40);
        };
        const docRef = base_1.db.collection("compatibilityHistory").doc();
        const unlockAtTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        const analysisData = {
            id: docRef.id,
            requestId: docRef.id,
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
        if (targetUserId)
            analysisData.targetUserId = targetUserId;
        if (cacheKey)
            analysisData.cacheKey = cacheKey;
        const batch = base_1.db.batch();
        batch.set(docRef, analysisData);
        batch.set(base_1.db.collection("notifications").doc(), {
            userId,
            type: 'system',
            title: 'Uyum Analizi Hazırlanıyor... ✨',
            message: 'Frekans analizin birazdan sonuçlanacak. Sonucunu Frekans Arşivi\'nde görebilirsin.',
            read: false,
            createdAt: base_1.FieldValue.serverTimestamp()
        });
        await batch.commit();
        await (0, base_1.sendPushToUser)(userId, {
            title: "Uyum Analizi Başlatıldı 🔮",
            body: "Frekansların taranıyor... Analizin birazdan hazır olacak.",
            category: 'compatibility',
            data: { type: 'compatibilityProgress', analysisId: docRef.id }
        });
        return analysisData;
    }
    catch (e) {
        console.error("AI Generation Fatal Error:", e);
        const errorMessage = e && e.message ? e.message : 'Bilinmeyen hata';
        throw new functions.https.HttpsError('internal', `AI servisine şu an ulaşılamıyor: ${errorMessage}`);
    }
}
exports.runDiscoverCompatibilityAnalysis = functions.region('us-central1').runWith({ secrets: ["OPENAI_API_KEY"], timeoutSeconds: 60 }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.targetUserId)
            throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
        const { targetUserId, relationshipType } = data;
        const existingPending = await base_1.db.collection("compatibilityHistory")
            .where("userId", "==", userId)
            .where("targetUserId", "==", targetUserId)
            .where("status", "in", ["locked", "pending"])
            .limit(1)
            .get();
        if (!existingPending.empty) {
            throw new functions.https.HttpsError('already-exists', 'ALREADY_PENDING');
        }
        const userRef = base_1.db.collection("users").doc(userId);
        const targetRef = base_1.db.collection("users").doc(targetUserId);
        const economy = await (0, wallet_1.getEconomyConfig)() || {};
        const compatPrice = economy.socialPricing?.compatibility?.[0]?.priceCoins || 25;
        const usersData = await base_1.db.runTransaction(async (transaction) => {
            const [uSnap, tSnap] = await Promise.all([transaction.get(userRef), transaction.get(targetRef)]);
            if (!uSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            if (!tSnap.exists)
                throw new functions.https.HttpsError('not-found', "Hedef kullanıcı bulunamadı.");
            const user = uSnap.data();
            const targetUser = tSnap.data();
            let paymentType = 'coins';
            if ((user.compatibilityCount || 0) > 0) {
                transaction.update(userRef, { compatibilityCount: base_1.FieldValue.increment(-1) });
                paymentType = 'count';
            }
            else if ((user.mainCoins || 0) >= compatPrice) {
                transaction.update(userRef, { mainCoins: base_1.FieldValue.increment(-compatPrice) });
                const txRef = base_1.db.collection("walletTransactions").doc();
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
            }
            else {
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
        let analysisData;
        try {
            analysisData = await generateCompatibilityAiDirect(usersData.me, usersData.target, relationshipType || 'ask', userId, targetUserId);
        }
        catch (aiError) {
            await base_1.db.runTransaction(async (t) => {
                if (usersData.paymentType === 'count') {
                    t.update(userRef, { compatibilityCount: base_1.FieldValue.increment(1) });
                }
                else if (usersData.paymentType === 'coins') {
                    t.update(userRef, { mainCoins: base_1.FieldValue.increment(usersData.compatPrice) });
                    const refundRef = base_1.db.collection("walletTransactions").doc();
                    t.set(refundRef, {
                        id: refundRef.id,
                        userId,
                        type: 'earn',
                        source: 'refund',
                        amount: usersData.compatPrice,
                        balanceType: 'main',
                        createdAt: new Date().toISOString(),
                        status: 'completed',
                        description: `Uyum Analizi İadesi (Hata)`
                    });
                }
            });
            throw new functions.https.HttpsError('internal', 'Uyum analizi şu an hazırlanamadı. Hakkın/jetonun iade edildi.');
        }
        try {
            const peekId = `peek_${userId}_${targetUserId}`;
            const peekRef = base_1.db.collection("compatibilityPeeks").doc(peekId);
            const peekSnap = await peekRef.get();
            let shouldUpdatePeek = true;
            if (peekSnap.exists) {
                const peekData = peekSnap.data();
                if (peekData?.createdAt) {
                    const lastTime = peekData.createdAt.toDate ? peekData.createdAt.toDate() : new Date(peekData.createdAt);
                    const diffMs = Date.now() - lastTime.getTime();
                    if (diffMs < 24 * 60 * 60 * 1000) {
                        shouldUpdatePeek = false;
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
                    createdAt: base_1.FieldValue.serverTimestamp(),
                    source: "discover",
                    read: false
                });
                const targetNotificationRef = base_1.db.collection("notifications").doc();
                await targetNotificationRef.set({
                    userId: targetUserId,
                    type: 'compatibility_peek',
                    title: 'Birisi uyumunu merak etti ✨',
                    message: 'Enerjin birinin dikkatini çekti! Kimin seninle uyumunu merak ettiğini gör.',
                    read: false,
                    createdAt: base_1.FieldValue.serverTimestamp(),
                    metadata: {
                        fromUserId: userId,
                        peekId: peekId
                    }
                });
                await (0, base_1.sendPushToUser)(targetUserId, {
                    title: "Birisi uyumunu merak etti ✨",
                    body: "Enerjin birinin dikkatini çekti! Kimin seninle uyumunu merak ettiğini gör.",
                    category: 'compatibility',
                    data: { type: 'compatibilityPeek', fromUserId: userId }
                });
            }
        }
        catch (peekError) {
            console.error("peek creation error:", peekError);
        }
        return {
            success: true,
            requestId: analysisData.id,
            status: "locked",
            finishTime: analysisData.unlockAt
        };
    }
    catch (error) {
        console.error("runDiscoverCompatibilityAnalysis error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
    }
});
exports.runManualCompatibilityAnalysis = functions.region('us-central1').runWith({ secrets: ["OPENAI_API_KEY"], timeoutSeconds: 60 }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.person1 || !data.person2)
            throw new functions.https.HttpsError('invalid-argument', 'Kişi bilgileri gerekli.');
        const { person1, person2, relationshipType } = data;
        const cleanPerson1 = JSON.parse(JSON.stringify(person1));
        const cleanPerson2 = JSON.parse(JSON.stringify(person2));
        const userRef = base_1.db.collection("users").doc(userId);
        const economy = await (0, wallet_1.getEconomyConfig)() || {};
        const compatPrice = economy.socialPricing?.compatibility?.[0]?.priceCoins || 25;
        const paymentData = await base_1.db.runTransaction(async (transaction) => {
            const snap = await transaction.get(userRef);
            if (!snap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const user = snap.data();
            let paymentType = 'coins';
            if ((user.compatibilityCount || 0) > 0) {
                transaction.update(userRef, { compatibilityCount: base_1.FieldValue.increment(-1) });
                paymentType = 'count';
            }
            else if ((user.mainCoins || 0) >= compatPrice) {
                transaction.update(userRef, { mainCoins: base_1.FieldValue.increment(-compatPrice) });
                const txRef = base_1.db.collection("walletTransactions").doc();
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
            }
            else {
                throw new functions.https.HttpsError('failed-precondition', "Yeterli jetonun yok.");
            }
            return { paymentType, compatPrice };
        });
        let analysisData;
        try {
            analysisData = await generateCompatibilityAiDirect(cleanPerson1, cleanPerson2, relationshipType, userId);
        }
        catch (aiError) {
            await base_1.db.runTransaction(async (t) => {
                if (paymentData.paymentType === 'count') {
                    t.update(userRef, { compatibilityCount: base_1.FieldValue.increment(1) });
                }
                else if (paymentData.paymentType === 'coins') {
                    t.update(userRef, { mainCoins: base_1.FieldValue.increment(paymentData.compatPrice) });
                    const refundRef = base_1.db.collection("walletTransactions").doc();
                    t.set(refundRef, {
                        id: refundRef.id,
                        userId,
                        type: 'earn',
                        source: 'refund',
                        amount: paymentData.compatPrice,
                        balanceType: 'main',
                        createdAt: new Date().toISOString(),
                        status: 'completed',
                        description: `Uyum Analizi İadesi (Hata)`
                    });
                }
            });
            throw new functions.https.HttpsError('internal', 'Uyum analizi şu an hazırlanamadı. Hakkın/jetonun iade edildi.');
        }
        return {
            success: true,
            requestId: analysisData.id,
            finishTime: analysisData.unlockAt,
            status: "locked"
        };
    }
    catch (error) {
        console.error("runManualCompatibilityAnalysis error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
    }
});
exports.speedUpCompatibilityAnalysis = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const requestId = data.requestId;
    if (!requestId)
        throw new functions.https.HttpsError('invalid-argument', 'RequestId gerekli.');
    try {
        const economy = await (0, wallet_1.getEconomyConfig)() || {};
        const speedUpPrice = economy.socialPricing?.compatibilitySpeedUpPrice ?? 10;
        return await base_1.db.runTransaction(async (transaction) => {
            const userRef = base_1.db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
            const userData = userSnap.data() || {};
            if ((userData.mainCoins || 0) < speedUpPrice)
                throw new functions.https.HttpsError('failed-precondition', 'Yeterli jetonun yok.');
            const reqRef = base_1.db.collection("compatibilityHistory").doc(requestId);
            const reqSnap = await transaction.get(reqRef);
            if (!reqSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Analiz isteği bulunamadı.');
            const reqData = reqSnap.data() || {};
            if (reqData.userId !== userId)
                throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
            if (reqData.status !== 'locked' || reqData.revealed) {
                throw new functions.https.HttpsError('failed-precondition', 'Analiz zaten açılmış.');
            }
            transaction.update(userRef, {
                mainCoins: base_1.FieldValue.increment(-speedUpPrice)
            });
            transaction.update(reqRef, {
                status: 'completed',
                revealed: true,
                unlockAt: new Date().toISOString()
            });
            return { success: true, message: `Hızlandırma başarılı.` };
        });
    }
    catch (error) {
        console.error("speedUpCompatibilityAnalysis error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.claimOnboardingDiscoverBonus = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const userRef = base_1.db.collection("users").doc(userId);
    try {
        return await base_1.db.runTransaction(async (transaction) => {
            const snap = await transaction.get(userRef);
            if (!snap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
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
                "social.updatedAt": base_1.FieldValue.serverTimestamp()
            });
            return { success: true, amount: 65 };
        });
    }
    catch (error) {
        console.error("claimOnboardingDiscoverBonus error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Bonus alınırken hata oluştu.');
    }
});
exports.claim10MinuteReward = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const userRef = base_1.db.collection("users").doc(userId);
    try {
        return await base_1.db.runTransaction(async (transaction) => {
            const snap = await transaction.get(userRef);
            if (!snap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
            const user = snap.data();
            if (user?.social?.receivedOnboarding10mReward) {
                throw new functions.https.HttpsError('already-exists', 'Ödül zaten alındı.');
            }
            transaction.update(userRef, {
                "social.receivedOnboarding10mReward": true,
                "compatibilityCount": base_1.FieldValue.increment(1),
                "social.updatedAt": base_1.FieldValue.serverTimestamp()
            });
            return { success: true };
        });
    }
    catch (error) {
        console.error("claim10MinuteReward error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Ödül alınırken hata oluştu.');
    }
});
exports.resetDailyDiscoverLikes = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const userRef = base_1.db.collection("users").doc(userId);
    try {
        return await base_1.db.runTransaction(async (transaction) => {
            const snap = await transaction.get(userRef);
            if (!snap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
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
                "social.updatedAt": base_1.FieldValue.serverTimestamp()
            });
            return { success: true, amount: 15 };
        });
    }
    catch (error) {
        console.error("resetDailyDiscoverLikes error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'Yenileme sırasında hata oluştu.');
    }
});
exports.notifyUnlockedCompatibility = functions.region('us-central1').pubsub.schedule('every 2 minutes').onRun(async (context) => {
    const now = new Date().toISOString();
    try {
        const lockedSnap = await base_1.db.collection("compatibilityHistory")
            .where("status", "==", "locked")
            .where("revealed", "==", false)
            .where("unlockAt", "<=", now)
            .limit(100)
            .get();
        if (lockedSnap.empty)
            return null;
        console.log(`[notifyUnlockedCompatibility] Found ${lockedSnap.size} analyses to unlock`);
        const promises = lockedSnap.docs.map(async (doc) => {
            const data = doc.data();
            if (data.notifiedReady)
                return;
            const userId = data.userId;
            const batch = base_1.db.batch();
            batch.update(doc.ref, {
                notifiedReady: true,
                status: 'completed',
                revealed: true
            });
            batch.set(base_1.db.collection("notifications").doc(), {
                userId,
                type: 'compatibility_ready',
                title: 'Uyum Analizin Hazır! ✨',
                message: 'Frekans analiz sonucun artık açıldı, hemen incele.',
                read: false,
                createdAt: base_1.FieldValue.serverTimestamp(),
                metadata: { analysisId: doc.id }
            });
            await batch.commit();
            await (0, base_1.sendPushToUser)(userId, {
                title: "Uyum Analizin Açıldı! ✨",
                body: "Yıldızlar konuştu, kozmik uyum sonucunu görmek ister misin?",
                category: 'compatibility',
                data: { type: 'compatibility', analysisId: doc.id }
            });
        });
        await Promise.all(promises);
        return null;
    }
    catch (error) {
        console.error("notifyUnlockedCompatibility error:", error);
        return null;
    }
});
exports.onMessageCreated = functions.region('us-central1').firestore.document('messages/{messageId}').onCreate(async (snap, context) => {
    const message = snap.data();
    console.log("TRIGGER: onMessageCreated fired for messageId:", snap.id, "Data:", JSON.stringify(message));
    if (!message || !message.chatId || !message.senderId || !message.receiverId || message.senderId === message.receiverId) {
        console.log("TRIGGER: Skipping message - validation failed or self-message.");
        return;
    }
    try {
        const senderSnap = await base_1.db.collection("users").doc(message.senderId).get();
        if (!senderSnap.exists) {
            console.log("TRIGGER: Sender profile not found:", message.senderId);
            return;
        }
        const senderNickname = senderSnap.data()?.social?.nickname || senderSnap.data()?.displayName || "Birisi";
        const senderPhoto = senderSnap.data()?.photoURL || senderSnap.data()?.social?.photos?.[0];
        let previewText = message.text || "Yeni bir mesaj";
        if (message.type === 'image' || message.mediaType === 'image')
            previewText = "📷 Fotoğraf";
        else if (message.type === 'video' || message.mediaType === 'video')
            previewText = "🎥 Video";
        else if (message.type === 'file' || message.mediaType === 'file')
            previewText = "📎 Dosya";
        console.log("TRIGGER: Preparing to send push to:", message.receiverId, "from nickname:", senderNickname);
        await (0, base_1.sendPushToUser)(message.receiverId, {
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
    }
    catch (error) {
        console.error("onMessageCreated trigger error:", error);
    }
});
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
exports.generateThumbnails = functions.region('us-central1')
    .runWith({ memory: '1GB', timeoutSeconds: 120 })
    .storage.object().onFinalize(async (object) => {
    const fileBucket = object.bucket;
    const filePath = object.name;
    const contentType = object.contentType;
    if (!contentType?.startsWith('image/'))
        return;
    if (!filePath || filePath.includes('_thumb_'))
        return;
    try {
        const { Storage } = require('@google-cloud/storage');
        const sharp = require('sharp');
        const storageClient = new Storage();
        const bucket = storageClient.bucket(fileBucket);
        const fileName = path.basename(filePath);
        const fileDir = path.dirname(filePath);
        const workingDir = path.join(os.tmpdir(), "thumbs");
        if (!fs.existsSync(workingDir))
            fs.mkdirSync(workingDir, { recursive: true });
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
    }
    catch (error) {
        console.error("generateThumbnails error:", error);
    }
});
exports.submitProfileVerification = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { photoUrl } = data;
    if (!photoUrl)
        throw new functions.https.HttpsError('invalid-argument', 'Doğrulama fotoğrafı gereklidir.');
    try {
        const userRef = base_1.db.collection("users").doc(userId);
        await userRef.update({
            "social.verificationPhotoUrl": photoUrl,
            "social.verificationStatus": "pending",
            "social.verificationSubmittedAt": base_1.FieldValue.serverTimestamp(),
            "social.verified": false
        });
        return { success: true };
    }
    catch (error) {
        console.error("submitProfileVerification error:", error);
        throw new functions.https.HttpsError('internal', 'Başvuru sırasında bir hata oluştu.');
    }
});
exports.adminUpdateVerificationStatus = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const { targetUid, status } = data;
    if (!targetUid || !['approved', 'rejected'].includes(status)) {
        throw new functions.https.HttpsError('invalid-argument', 'Geçersiz parametreler.');
    }
    try {
        const adminRef = base_1.db.collection("users").doc(context.auth.uid);
        const adminSnap = await adminRef.get();
        if (!adminSnap.exists || adminSnap.data()?.role !== 'admin') {
            throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
        }
        const userRef = base_1.db.collection("users").doc(targetUid);
        const updates = {
            "social.verificationStatus": status,
            "social.updatedAt": base_1.FieldValue.serverTimestamp()
        };
        if (status === 'approved') {
            updates["social.verified"] = true;
            updates["social.verificationApprovedAt"] = base_1.FieldValue.serverTimestamp();
            updates["isVerified"] = true;
        }
        else {
            updates["social.verified"] = false;
            updates["isVerified"] = false;
        }
        await userRef.update(updates);
        const notifRef = base_1.db.collection("notifications").doc();
        await notifRef.set({
            userId: targetUid,
            type: "system",
            title: status === 'approved' ? "Profilin Onaylandı! ✅" : "Profil Onayı Reddedildi ❌",
            message: status === 'approved'
                ? "Tebrikler! Mavi tik profilinde görünüyor. Ödülünü cüzdanından alabilirsin."
                : "Maalesef profil doğrulama başvurun reddedildi. Lütfen tekrar dene.",
            read: false,
            createdAt: base_1.FieldValue.serverTimestamp()
        });
        return { success: true };
    }
    catch (error) {
        console.error("adminUpdateVerificationStatus error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', 'İşlem başarısız oldu.');
    }
});
function calculateProfileCompletion(social) {
    if (!social)
        return 0;
    let score = 0;
    if (social.nickname)
        score += 20;
    if (social.bio && social.bio.length > 20)
        score += 20;
    else if (social.bio)
        score += 10;
    if (social.photos && social.photos.length >= 3)
        score += 20;
    else if (social.photos && social.photos.length > 0)
        score += 10;
    if (social.interests && social.interests.length >= 5)
        score += 20;
    else if (social.interests && social.interests.length > 0)
        score += 10;
    if (social.birthDate && social.gender)
        score += 20;
    else if (social.birthDate || social.gender)
        score += 10;
    return score;
}
exports.notifyDailyEngagement = functions.region('us-central1').pubsub.schedule('every 2 hours').onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    try {
        const inactiveUsers = await base_1.db.collection("users")
            .where("lastActiveAt", "<=", oneDayAgo)
            .limit(100)
            .get();
        const engagementPromises = inactiveUsers.docs.map(async (doc) => {
            const data = doc.data();
            const lastDiscRemAt = data.social?.notifications?.lastDiscoverReminderAt;
            if (lastDiscRemAt && lastDiscRemAt.toMillis() > oneDayAgo.getTime())
                return;
            const userId = doc.id;
            await base_1.db.collection("notifications").add({
                userId,
                type: "discover_return",
                title: "Seni Özledik! 🔮",
                message: "Bugün Keşfet'te yeni ruhlar seni bekliyor olabilir.",
                read: false,
                createdAt: base_1.FieldValue.serverTimestamp()
            });
            await base_1.db.collection("users").doc(userId).set({
                social: { notifications: { lastDiscoverReminderAt: base_1.FieldValue.serverTimestamp() } }
            }, { merge: true });
            await (0, base_1.sendPushToUser)(userId, {
                title: "Yeni Ruhlar Seni Bekliyor! 🔮",
                body: "Enerjin bugün harika! Keşfet'te kimlerin olduğunu görmek ister misin?",
                category: "engagement"
            });
        });
        const resetUsers = await base_1.db.collection("users")
            .where("social.notifications.lastLikesResetNotifAt", "<=", sixHoursAgo)
            .limit(50)
            .get();
        const resetPromises = resetUsers.docs.map(async (doc) => {
            const data = doc.data();
            if (data.social?.discoverLikes === 20) {
                const userId = doc.id;
                await base_1.db.collection("notifications").add({
                    userId,
                    type: "daily_likes_reset",
                    title: "Beğeni Hakların Yenilendi! ❤️",
                    message: "Yeni gün, yeni eşleşmeler! Ücretsiz beğeni hakların seni bekliyor.",
                    read: false,
                    createdAt: base_1.FieldValue.serverTimestamp()
                });
                await base_1.db.collection("users").doc(userId).set({
                    social: { notifications: { lastLikesResetNotifAt: base_1.FieldValue.serverTimestamp() } }
                }, { merge: true });
                await (0, base_1.sendPushToUser)(userId, {
                    title: "Beğeni Hakların Yenilendi! ❤️",
                    body: "Bugünkü eşleşmeni henüz bulamadın mı? Hemen Keşfet'e göz at.",
                    category: "engagement"
                });
            }
        });
        await Promise.all([...engagementPromises, ...resetPromises]);
        return null;
    }
    catch (err) {
        console.error("notifyDailyEngagement error:", err);
        return null;
    }
});
//# sourceMappingURL=social.js.map