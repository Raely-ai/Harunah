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
exports.generateThumbnails = exports.onMessageCreated = exports.runManualCompatibilityAnalysis = exports.speedUpCompatibilityAnalysis = exports.processCompatibilityRequests = exports.runDiscoverCompatibilityAnalysis = exports.createChat = exports.createReport = exports.unmuteUser = exports.muteUser = exports.unblockUser = exports.blockUser = exports.setTypingStatus = exports.editMessage = exports.deleteMessage = exports.deleteChat = exports.markAsDelivered = exports.markAsSeen = exports.sendMessage = exports.rejectRequest = exports.acceptRequest = exports.sendMessageRequest = exports.sendLike = exports.refreshDiscoverFeed = exports.refreshDiscover = exports.updateSocialSettings = exports.updateSocialProfile = exports.completeSocialOnboarding = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const base_1 = require("./base");
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
        if (!nickname || !gender || !lookingFor || !birthDate || finalInterests.length < 5 || finalPhotos.length === 0 || !bio) {
            console.log("AUDIT: Validation failed hardening.");
            throw new functions.https.HttpsError('invalid-argument', 'Lütfen tüm zorunlu alanları doldurun.');
        }
        const userRef = base_1.db.collection("users").doc(userId);
        return await base_1.db.runTransaction(async (transaction) => {
            console.log("AUDIT: Transaction started.");
            const userSnap = await transaction.get(userRef);
            const socialData = {
                nickname: String(nickname),
                gender: String(gender),
                lookingFor: String(lookingFor),
                interests: finalInterests,
                photos: finalPhotos,
                bio: String(bio),
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
                lookingFor: String(lookingFor),
                interests: finalInterests,
                photos: finalPhotos,
                bio: String(bio),
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
    try {
        const userRef = base_1.db.collection("users").doc(userId);
        const now = new Date();
        const nowIso = now.toISOString();
        const userSnap = await userRef.get();
        if (!userSnap.exists)
            throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
        const userData = userSnap.data();
        const gender = userData.social?.gender || userData.gender || "";
        const targetGender = gender === 'erkek' ? 'kadın' : gender === 'kadın' ? 'erkek' : "";
        const recentIds = userData.social?.recentDiscoverIds || [];
        const swipesSnap = await base_1.db.collection("swipes")
            .where("fromUserId", "==", userId)
            .limit(500)
            .get();
        const swipedUserIds = swipesSnap.docs.map(d => d.data().toUserId);
        const exclusionList = new Set([userId, ...recentIds, ...swipedUserIds]);
        let usersQuery = base_1.db.collection("users")
            .where("social.enabled", "==", true)
            .where("social.visible", "==", true);
        if (targetGender) {
            usersQuery = usersQuery.where("social.gender", "==", targetGender);
        }
        const queryLimit = 60;
        const usersSnap = await usersQuery.limit(queryLimit).get();
        const result = await base_1.db.runTransaction(async (transaction) => {
            const tUserSnap = await transaction.get(userRef);
            if (!tUserSnap.exists)
                throw new Error("Kullanıcı bulunamadı.");
            const tUserData = tUserSnap.data();
            const lastFree = tUserData.social?.lastFreeRefreshAt;
            const isFreeAvailable = !lastFree || (now.getTime() - new Date(lastFree).getTime() >= 24 * 60 * 60 * 1000);
            let status = 'SUCCESS';
            let updates = { "social.lastDiscoverRefreshAt": nowIso };
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
            let available = usersSnap.docs
                .filter(doc => !exclusionList.has(doc.id))
                .map(doc => {
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
                    bio: d.social?.bio || d.bio || ""
                };
            });
            if (available.length < 5) {
                const absoluteExclusion = new Set([userId, ...swipedUserIds]);
                available = usersSnap.docs
                    .filter(doc => !absoluteExclusion.has(doc.id))
                    .map(doc => {
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
                        bio: d.social?.bio || d.bio || ""
                    };
                });
            }
            available = available.sort(() => Math.random() - 0.5).slice(0, 20);
            updates["social.recentDiscoverIds"] = Array.from(new Set([...recentIds, ...available.map(u => u.id)])).slice(-100);
            transaction.update(userRef, updates);
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
    const { targetUserId, type } = data;
    if (!targetUserId || !['like', 'super_like', 'pass'].includes(type) || fromUserId === targetUserId) {
        throw new functions.https.HttpsError('invalid-argument', 'Geçersiz işlem parametreleri.');
    }
    try {
        const fromUserRef = base_1.db.collection("users").doc(fromUserId);
        const toUserRef = base_1.db.collection("users").doc(targetUserId);
        return await base_1.db.runTransaction(async (transaction) => {
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
            if (!isNewDay && used >= 15) {
                throw new functions.https.HttpsError('resource-exhausted', 'daily_limit_reached');
            }
            transaction.update(fromUserRef, {
                dailySwipeUsed: isNewDay ? 1 : base_1.FieldValue.increment(1),
                dailySwipeDate: today
            });
            const swipeId = `swipe_${fromUserId}_${targetUserId}`;
            const swipeRef = base_1.db.collection("swipes").doc(swipeId);
            const serverNow = base_1.FieldValue.serverTimestamp();
            transaction.set(swipeRef, { id: swipeId, fromUserId, toUserId: targetUserId, type, createdAt: serverNow, updatedAt: serverNow }, { merge: true });
            if (type === 'like' || type === 'super_like') {
                const notifRef = base_1.db.collection("notifications").doc();
                transaction.set(notifRef, {
                    userId: targetUserId, fromUserId, type: type === 'super_like' ? "super_like" : "like",
                    title: type === 'super_like' ? "Yeni Süper Like! ✨" : "Yeni Beğeni! ❤️",
                    message: `${fromData.social?.nickname || fromData.displayName || "Biri"} seni beğendi!`,
                    data: { fromUserId }, read: false, createdAt: serverNow
                });
            }
            return { success: true, status: 'SUCCESS' };
        });
    }
    catch (error) {
        console.error("sendLike error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Beğeni işlemi başarısız oldu.');
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
                userId: toUserId, fromUserId, type: "message_request",
                title: "Yeni Mesaj İsteği 💌",
                message: `${fromData.social?.nickname || fromData.displayName || "Biri"} sana bir mesaj isteği gönderdi.`,
                data: { fromUserId }, read: false, createdAt: now
            });
            return { success: true, status: 'SUCCESS', toUserId, senderNickname: fromData.social?.nickname || fromData.displayName };
        });
        if (result.success && result.status === 'SUCCESS') {
            (0, base_1.sendPushToUser)(result.toUserId, {
                title: "Yeni Mesaj İsteği 💌",
                body: `${result.senderNickname} sana bir mesaj isteği gönderdi.`,
                category: 'social',
                senderId: fromUserId
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
            transaction.set(notifRef, { userId: fromUserId, type: "request_accepted", title: "İstek Kabul Edildi!", message: `${toSnap.data()?.social?.nickname || toSnap.data()?.displayName} mesaj isteğini kabul etti! 🎉`, data: { chatId }, read: false, createdAt: now });
            return { status: 'SUCCESS', chatId, fromUserId, toUserId: userId, toUserNickname: toSnap.data()?.social?.nickname || toSnap.data()?.displayName };
        });
        if (result.status === 'SUCCESS') {
            (0, base_1.sendPushToUser)(result.fromUserId, {
                title: "İstek Kabul Edildi!",
                body: `${result.toUserNickname} mesaj isteğini kabul etti! 🎉`,
                data: { screen: 'chat', chatId: result.chatId },
                category: 'social',
                senderId: result.toUserId
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
        const { chatId, text, mediaUrl, mediaType } = data;
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
            const [senderSnap, receiverSnap] = await Promise.all([transaction.get(base_1.db.collection("users").doc(senderId)), transaction.get(base_1.db.collection("users").doc(receiverId))]);
            const now = base_1.FieldValue.serverTimestamp();
            const msgRef = base_1.db.collection("messages").doc();
            const type = mediaType || 'text';
            const lastMsgText = type === 'text' ? (text || "") : (type === 'image' ? "📷 Görsel" : "🎥 Video");
            transaction.set(msgRef, { id: msgRef.id, chatId, participants: [senderId, receiverId], senderId, receiverId, text: text || "", mediaUrl: mediaUrl || null, mediaType: mediaType || null, createdAt: now, status: 'sent', seen: false, type });
            transaction.update(chatRef, { lastMessage: lastMsgText, lastMessageAt: now, lastMessageSenderId: senderId, lastMessageStatus: 'sent', [`unreadCount.${receiverId}`]: base_1.FieldValue.increment(1) });
            transaction.update(base_1.db.collection("users").doc(receiverId), { unreadMessagesCount: base_1.FieldValue.increment(1) });
            return { status: 'SUCCESS', messageId: msgRef.id, receiverId, chatId, senderNickname: senderSnap.data()?.social?.nickname || senderSnap.data()?.displayName, lastMsgText };
        });
        if (result.status === 'SUCCESS') {
            (0, base_1.sendPushToUser)(result.receiverId, { title: result.senderNickname, body: result.lastMsgText, data: { screen: 'chat', chatId: result.chatId }, category: 'messages', senderId }).catch(e => console.error("Push failed:", e));
        }
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
exports.runDiscoverCompatibilityAnalysis = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.targetUserId)
            throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
        const { targetUserId, relationshipType } = data;
        const cacheKey = `${userId}_${targetUserId}_${relationshipType}`;
        const history = await base_1.db.collection("compatibilityHistory").where("cacheKey", "==", cacheKey).limit(1).get();
        if (!history.empty)
            return { success: true, analysis: history.docs[0].data(), cached: true };
        const userRef = base_1.db.collection("users").doc(userId);
        const targetRef = base_1.db.collection("users").doc(targetUserId);
        return await base_1.db.runTransaction(async (transaction) => {
            const [uSnap, tSnap] = await Promise.all([transaction.get(userRef), transaction.get(targetRef)]);
            if (!uSnap.exists || !tSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const uData = uSnap.data();
            const tData = tSnap.data();
            if ((uData.compatibilityCount || 0) <= 0)
                throw new functions.https.HttpsError('failed-precondition', "Yetersiz uyum analizi kredisi.");
            transaction.update(userRef, { compatibilityCount: base_1.FieldValue.increment(-1) });
            const requestRef = base_1.db.collection("compatibilityRequests").doc();
            const readyAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            transaction.set(requestRef, {
                id: requestRef.id,
                userId,
                targetUserId,
                relationshipType: relationshipType || 'ask',
                status: 'pending',
                createdAt: base_1.FieldValue.serverTimestamp(),
                readyAt,
                cacheKey,
                person1: {
                    name: uData.social?.nickname || uData.displayName || "Kullanıcı",
                    photo: uData.social?.photos?.[0] || uData.photoURL || "",
                    birthDate: uData.social?.birthDate || uData.birthDate || ""
                },
                person2: {
                    name: tData.social?.nickname || tData.displayName || "Kullanıcı",
                    photo: tData.social?.photos?.[0] || tData.photoURL || "",
                    birthDate: tData.social?.birthDate || tData.birthDate || ""
                }
            });
            return { success: true, requestId: requestRef.id, readyAt };
        });
    }
    catch (error) {
        console.error("runDiscoverCompatibilityAnalysis error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
    }
});
exports.processCompatibilityRequests = functions.region('us-central1').pubsub.schedule('every 2 minutes').onRun(async (context) => {
    const now = new Date().toISOString();
    const pendings = await base_1.db.collection("compatibilityRequests").where("status", "==", "pending").where("readyAt", "<=", now).limit(20).get();
    if (pendings.empty)
        return null;
    const openai = (0, base_1.getOpenAI)();
    for (const docSnap of pendings.docs) {
        const req = docSnap.data();
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [{
                        role: "system",
                        content: "Sen bir AI değilsin. Sen evrenin frekanslarını okuyan, Türkçe konuşan, mistik ve iddialı bir ASTROLOGSUN. Kullanıcıdan asla bilgi isteme, soru sorma. Verilen bilgilerden yola çıkarak KESİN bir analiz yap. Dilin %100 TÜRKÇE olmalı."
                    }, {
                        role: "user",
                        content: `Kişi 1: ${req.person1?.name || 'Bilinmiyor'} (Doğum: ${req.person1?.birthDate || 'Bilinmiyor'})
Kişi 2: ${req.person2?.name || 'Bilinmiyor'} (Doğum: ${req.person2?.birthDate || 'Bilinmiyor'})
İlişki Türü: ${req.relationshipType || 'Bilinmiyor'}

Lütfen analizini aşağıdaki JSON formatında döndür. Skorlar 40 ile 100 arasında anlamlı tam sayılar olmalıdır (%0 KESİNLİKLE YASAKTIR).

{
  "loveScore": 40-100 arası sayı,
  "friendshipScore": 40-100 arası sayı,
  "energyScore": 40-100 arası sayı,
  "summaryLong": "En az 4-5 cümlelik, 'Yıldızlar diyor ki...' gibi mistik bir dille yazılmış, iddialı, isimleri de kullanarak yapılmış Türkçe astrolojik analiz."
}

Asla analiz dışında bir kelime yazma, json dön.`
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
            const analysisData = {
                ...req,
                requestId: docSnap.id,
                status: 'completed',
                loveScore: parseScore(parsed.loveScore),
                friendshipScore: parseScore(parsed.friendshipScore),
                energyScore: parseScore(parsed.energyScore),
                summaryShort: parsed.summaryShort || "Yıldızların mistik fısıltısı duyuldu.",
                summaryLong: summaryContent.length > 5 ? summaryContent : "Kozmik analiz başarıyla tamamlandı ancak yıldızlar şu an konuşmak istemiyor.",
                createdAt: now
            };
            const batch = base_1.db.batch();
            batch.update(docSnap.ref, { status: 'completed', updatedAt: now });
            const histRef = base_1.db.collection("compatibilityHistory").doc();
            batch.set(histRef, analysisData);
            batch.set(base_1.db.collection("notifications").doc(), { userId: req.userId, type: 'system', title: 'Kozmik Uyum Analizi Hazır! ✨', message: 'Frekans analiz sonuçlarını incelemek için dokun.', read: false, createdAt: base_1.FieldValue.serverTimestamp() });
            await batch.commit();
            await (0, base_1.sendPushToUser)(req.userId, { title: 'Uyum Analiziniz Hazır!', body: 'Hemen incele!', category: 'compatibility' });
        }
        catch (e) {
            await docSnap.ref.update({ status: 'error', error: String(e) });
        }
    }
    return null;
});
exports.speedUpCompatibilityAnalysis = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const requestId = data.requestId;
    if (!requestId)
        throw new functions.https.HttpsError('invalid-argument', 'RequestId gerekli.');
    try {
        return await base_1.db.runTransaction(async (transaction) => {
            const userRef = base_1.db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
            const configSnap = await transaction.get(base_1.db.collection("config").doc("global"));
            let speedUpPrice = 10;
            if (configSnap.exists) {
                const configData = configSnap.data();
                speedUpPrice = configData?.socialEconomy?.compatibilitySpeedUpPrice ?? 10;
            }
            const userData = userSnap.data() || {};
            if ((userData.mainCoins || 0) < speedUpPrice) {
                throw new functions.https.HttpsError('failed-precondition', 'Yetersiz J-Coin bakiyesi.');
            }
            const reqRef = base_1.db.collection("compatibilityRequests").doc(requestId);
            const reqSnap = await transaction.get(reqRef);
            if (!reqSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Analiz isteği bulunamadı.');
            const reqData = reqSnap.data() || {};
            if (reqData.userId !== userId)
                throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
            if (reqData.status !== 'pending')
                throw new functions.https.HttpsError('failed-precondition', 'Bu analiz zaten tamamlanmış veya hata almış.');
            transaction.update(userRef, {
                mainCoins: base_1.FieldValue.increment(-speedUpPrice)
            });
            transaction.update(reqRef, {
                readyAt: new Date().toISOString()
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
exports.runManualCompatibilityAnalysis = functions.region('us-central1').https.onCall(async (data, context) => {
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
        return await base_1.db.runTransaction(async (transaction) => {
            const snap = await transaction.get(userRef);
            if (!snap.exists)
                throw new Error("User not found");
            if ((snap.data()?.compatibilityCount || 0) <= 0)
                throw new Error("INSUFFICIENT_FUNDS");
            transaction.update(userRef, { compatibilityCount: base_1.FieldValue.increment(-1) });
            const ref = base_1.db.collection("compatibilityRequests").doc();
            const readyAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
            transaction.set(ref, { id: ref.id, userId, person1: cleanPerson1, person2: cleanPerson2, relationshipType, status: 'pending', createdAt: new Date().toISOString(), readyAt });
            return { success: true, requestId: ref.id, readyAt };
        });
    }
    catch (error) {
        console.error("runManualCompatibilityAnalysis error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
    }
});
exports.onMessageCreated = functions.region('us-central1').firestore.document('messages/{messageId}').onCreate(async (snap, context) => {
    const message = snap.data();
    if (!message || !message.chatId || !message.senderId || !message.receiverId)
        return;
    try {
        const senderSnap = await base_1.db.collection("users").doc(message.senderId).get();
        if (!senderSnap.exists)
            return;
        const senderNickname = senderSnap.data()?.social?.nickname || senderSnap.data()?.displayName || "Birisi";
        let previewText = message.text || "Yeni bir mesaj";
        if (message.type === 'image' || message.mediaType === 'image')
            previewText = "📷 Fotoğraf";
        else if (message.type === 'video' || message.mediaType === 'video')
            previewText = "🎥 Video";
        else if (message.type === 'file' || message.mediaType === 'file')
            previewText = "📎 Dosya";
        await (0, base_1.sendPushToUser)(message.receiverId, {
            title: senderNickname,
            body: previewText,
            data: {
                screen: "chat",
                chatId: message.chatId
            },
            category: "messages",
            senderId: message.senderId
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
//# sourceMappingURL=social.js.map