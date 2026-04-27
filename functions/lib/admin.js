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
exports.adminManagePromoCode = exports.adminUpdateReport = exports.adminUpdateConfig = exports.adminUpdateUser = exports.adminAdjustWallet = exports.adminSetWallet = exports.adminModerationAction = exports.getAdminChatMessages = exports.getAdminUserChats = exports.adminGrantWalletReward = exports.adminBroadcastNotification = void 0;
const functions = __importStar(require("firebase-functions"));
const base_1 = require("./base");
exports.adminBroadcastNotification = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
        const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
            (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
        if (!isAdmin) {
            throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
        }
        if (!data)
            throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
        const { title, body, screen, data: extraData } = data;
        if (!title || !body)
            throw new functions.https.HttpsError('invalid-argument', 'Başlık ve mesaj zorunludur.');
        const usersSnap = await base_1.db.collection("users").where("fcmToken", "!=", null).get();
        console.log(`Broadcasting to ${usersSnap.size} users...`);
        const tokens = [];
        const tokenToUid = {};
        usersSnap.docs.forEach(doc => {
            const data = doc.data();
            const token = data.fcmToken;
            if (typeof token === 'string' && token.trim().length > 0) {
                tokens.push(token);
                tokenToUid[token] = doc.id;
            }
        });
        const results = {
            successCount: 0,
            failureCount: 0
        };
        const invalidTokens = [];
        for (let i = 0; i < tokens.length; i += 500) {
            const chunk = tokens.slice(i, i + 500);
            try {
                const response = await base_1.messaging.sendEachForMulticast({
                    tokens: chunk,
                    notification: { title, body },
                    data: {
                        ...Object.fromEntries(Object.entries(extraData || {}).map(([k, v]) => [k, String(v)])),
                        screen: String(screen || 'home'),
                        category: 'system'
                    }
                });
                results.successCount += response.successCount;
                results.failureCount += response.failureCount;
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const errCode = resp.error?.code;
                        if (errCode === 'messaging/invalid-registration-token' ||
                            errCode === 'messaging/registration-token-not-registered') {
                            invalidTokens.push(chunk[idx]);
                        }
                    }
                });
            }
            catch (err) {
                console.error("Multicast error for chunk", err);
                results.failureCount += chunk.length;
            }
        }
        if (invalidTokens.length > 0) {
            console.log(`Cleaning up ${invalidTokens.length} invalid tokens...`);
            let batch = base_1.db.batch();
            let opCount = 0;
            for (const t of invalidTokens) {
                const uid = tokenToUid[t];
                if (uid) {
                    const userRef = base_1.db.collection("users").doc(uid);
                    batch.update(userRef, { fcmToken: base_1.FieldValue.delete() });
                    opCount++;
                    if (opCount === 500) {
                        await batch.commit();
                        batch = base_1.db.batch();
                        opCount = 0;
                    }
                }
            }
            if (opCount > 0) {
                await batch.commit();
            }
        }
        return { success: true, results };
    }
    catch (error) {
        console.error("adminBroadcastNotification error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Duyuru gönderilirken hata oluştu.');
    }
});
exports.adminGrantWalletReward = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
        const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
            (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
        if (!isAdmin)
            throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
        if (!data)
            throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
        const { targetUserId, amount, balanceType, description } = data;
        if (typeof amount !== 'number' || amount === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Miktar sıfırdan farklı olmalıdır.');
        }
        const userRef = base_1.db.collection("users").doc(targetUserId);
        await base_1.db.runTransaction(async (transaction) => {
            const updates = {};
            if (balanceType === 'main')
                updates.mainCoins = base_1.FieldValue.increment(amount);
            else
                updates.energy = base_1.FieldValue.increment(amount);
            transaction.update(userRef, updates);
            const txRef = base_1.db.collection("walletTransactions").doc();
            transaction.set(txRef, {
                id: txRef.id,
                userId: targetUserId,
                type: amount > 0 ? 'earn' : 'spend',
                source: 'admin_grant',
                amount,
                balanceType,
                createdAt: new Date().toISOString(),
                status: 'active',
                description: `Admin İşlemi: ${description}`
            });
        });
        return { success: true };
    }
    catch (error) {
        console.error("adminGrantWalletReward error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Ödül verilirken hata oluştu.');
    }
});
exports.getAdminUserChats = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { targetUserId } = data;
    if (!targetUserId)
        throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
    try {
        await base_1.db.collection("moderationLogs").add({
            adminId: context.auth.uid,
            adminEmail: context.auth.token.email || "",
            targetUid: targetUserId,
            action: "view_user_chats",
            timestamp: new Date().toISOString()
        });
        const chatsSnap = await base_1.db.collection("chats")
            .where("participants", "array-contains", targetUserId)
            .get();
        const chats = chatsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        chats.sort((a, b) => {
            const t1 = a.lastMessageAt?.seconds || 0;
            const t2 = b.lastMessageAt?.seconds || 0;
            return t2 - t1;
        });
        return { chats };
    }
    catch (error) {
        console.error("getAdminUserChats error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Sohbetler getirilirken bir hata oluştu.');
    }
});
exports.getAdminChatMessages = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { chatId, targetUserId } = data;
    if (!chatId)
        throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
    try {
        await base_1.db.collection("moderationLogs").add({
            adminId: context.auth.uid,
            adminEmail: context.auth.token.email || "",
            targetUid: targetUserId || "unknown",
            chatId,
            action: "view_chat_messages",
            timestamp: new Date().toISOString()
        });
        const messagesSnap = await base_1.db.collection("messages")
            .where("chatId", "==", chatId)
            .get();
        let messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        messages.sort((a, b) => {
            const t1 = a.createdAt?.seconds || 0;
            const t2 = b.createdAt?.seconds || 0;
            return t2 - t1;
        });
        messages = messages.slice(0, 500);
        messages.sort((a, b) => {
            const t1 = a.createdAt?.seconds || 0;
            const t2 = b.createdAt?.seconds || 0;
            return t1 - t2;
        });
        return { messages };
    }
    catch (error) {
        console.error("getAdminChatMessages error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Mesajlar getirilirken bir hata oluştu.');
    }
});
exports.adminModerationAction = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { action, targetUserId, chatId, messageId, reason } = data;
    try {
        await base_1.db.collection("moderationLogs").add({
            adminId: context.auth.uid,
            adminEmail: context.auth.token.email || "",
            targetUid: targetUserId || "unknown",
            chatId: chatId || "none",
            messageId: messageId || "none",
            action: `moderation_${action}`,
            reason: reason || "Belirtilmedi",
            timestamp: new Date().toISOString()
        });
        if (action === 'ban_user' && targetUserId) {
            await base_1.db.collection("users").doc(targetUserId).update({ isBanned: true });
        }
        else if (action === 'delete_chat' && chatId) {
            await base_1.db.collection("chats").doc(chatId).update({ status: 'deleted_by_admin' });
        }
        else if (action === 'flag_message' && messageId) {
            await base_1.db.collection("messages").doc(messageId).update({ isFlagged: true, flaggedReason: reason });
        }
        return { success: true };
    }
    catch (error) {
        console.error("adminModerationAction error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'İşlem gerçekleştirilirken bir hata oluştu.');
    }
});
exports.adminSetWallet = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { targetUserId, updates } = data;
    if (!targetUserId || !updates)
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
    const userRef = base_1.db.collection("users").doc(targetUserId);
    const allowedFields = [
        'mainCoins', 'energy', 'superLikes', 'refreshCount',
        'compatibilityCount', 'dailyAdWatchCount', 'dailySwipeLimit', 'extraSwipeLimit'
    ];
    const sanitizedUpdates = {};
    Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
            sanitizedUpdates[key] = updates[key];
        }
    });
    if (Object.keys(sanitizedUpdates).length === 0)
        return { success: true };
    try {
        await userRef.update(sanitizedUpdates);
        const txRef = base_1.db.collection("walletTransactions").doc();
        await txRef.set({
            id: txRef.id,
            userId: targetUserId,
            type: 'admin_set',
            source: 'admin_action',
            amount: 0,
            createdAt: new Date().toISOString(),
            status: 'active',
            description: `Admin tarafından cüzdan değerleri güncellendi: ${JSON.stringify(sanitizedUpdates)}`
        });
        return { success: true };
    }
    catch (error) {
        console.error("adminSetWallet error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Cüzdan güncellenirken hata oluştu.');
    }
});
exports.adminAdjustWallet = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { targetUserId, field, amount } = data;
    if (!targetUserId || !field || amount === undefined)
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
    const allowedFields = [
        'mainCoins', 'energy', 'superLikes', 'refreshCount',
        'compatibilityCount', 'dailyAdWatchCount', 'dailySwipeLimit', 'extraSwipeLimit'
    ];
    if (!allowedFields.includes(field))
        throw new functions.https.HttpsError('invalid-argument', 'Geçersiz alan.');
    const userRef = base_1.db.collection("users").doc(targetUserId);
    try {
        await userRef.update({
            [field]: base_1.FieldValue.increment(amount)
        });
        const txRef = base_1.db.collection("walletTransactions").doc();
        await txRef.set({
            id: txRef.id,
            userId: targetUserId,
            type: amount > 0 ? 'earn' : 'spend',
            source: 'admin_action',
            amount: amount,
            balanceType: (field === 'energy' || field === 'mainCoins') ? (field === 'energy' ? 'energy' : 'main') : 'other',
            createdAt: new Date().toISOString(),
            status: 'active',
            description: `Admin tarafından ${field} miktarı ${amount} kadar değiştirildi.`
        });
        return { success: true };
    }
    catch (error) {
        console.error("adminAdjustWallet error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Cüzdan ayarlanırken hata oluştu.');
    }
});
exports.adminUpdateUser = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { targetUserId, updates, reason } = data;
    if (!targetUserId || !updates)
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
    try {
        await base_1.db.collection("users").doc(targetUserId).update(updates);
        await base_1.db.collection("moderationLogs").add({
            adminId: context.auth.uid,
            adminEmail: context.auth.token.email || "",
            targetUid: targetUserId,
            action: "update_user",
            updates: JSON.stringify(updates),
            reason: reason || "Admin panel güncellemesi",
            timestamp: new Date().toISOString()
        });
        return { success: true };
    }
    catch (error) {
        console.error("adminUpdateUser error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Kullanıcı güncellenirken hata oluştu.');
    }
});
exports.adminUpdateConfig = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { configType, configData } = data;
    if (!configType || !configData)
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
    try {
        let collectionName = "config";
        let docName = "global";
        if (configType === 'wallet') {
            collectionName = "adminSettings";
            docName = "wallet";
        }
        else if (configType === 'economy') {
            collectionName = "adminSettings";
            docName = "economy";
        }
        else if (configType === 'socialCommerce') {
            collectionName = "config";
            docName = "socialCommerce";
        }
        await base_1.db.collection(collectionName).doc(docName).set(configData);
        await base_1.db.collection("moderationLogs").add({
            adminId: context.auth.uid,
            adminEmail: context.auth.token.email || "",
            action: `update_config_${configType}`,
            timestamp: new Date().toISOString()
        });
        return { success: true };
    }
    catch (error) {
        console.error("adminUpdateConfig error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Ayarlar güncellenirken hata oluştu.');
    }
});
exports.adminUpdateReport = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { reportId, status, adminNotes } = data;
    if (!reportId || !status)
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
    try {
        await base_1.db.collection("reports").doc(reportId).update({
            status,
            adminNotes: adminNotes || "",
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    }
    catch (error) {
        console.error("adminUpdateReport error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Rapor güncellenirken hata oluştu.');
    }
});
exports.adminManagePromoCode = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await base_1.db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { action, promoId, promoData } = data;
    try {
        if (action === 'create') {
            const ref = base_1.db.collection("promoCodes").doc();
            await ref.set({
                ...promoData,
                id: ref.id,
                createdAt: new Date().toISOString(),
                currentUses: 0
            });
        }
        else if (action === 'update' && promoId) {
            await base_1.db.collection("promoCodes").doc(promoId).update(promoData);
        }
        else if (action === 'delete' && promoId) {
            await base_1.db.collection("promoCodes").doc(promoId).delete();
        }
        return { success: true };
    }
    catch (error) {
        console.error("adminManagePromoCode error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Promosyon kodu işlemi sırasında hata oluştu.');
    }
});
//# sourceMappingURL=admin.js.map