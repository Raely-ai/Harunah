import * as functions from "firebase-functions";
import { db, FieldValue, sendPushToUser } from "./base";

// 1. Admin Broadcast Notification
export const adminBroadcastNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    // Check if admin
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                    (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);

    if (!isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
    }

    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const { title, body, screen, data: extraData } = data;
    if (!title || !body) throw new functions.https.HttpsError('invalid-argument', 'Başlık ve mesaj zorunludur.');

    // Fetch all users with FCM tokens
    const usersSnap = await db.collection("users").where("fcmToken", "!=", null).get();
    
    console.log(`Broadcasting to ${usersSnap.size} users...`);

    const results = {
      successCount: 0,
      failureCount: 0
    };

    // Batch send
    for (const userDoc of usersSnap.docs) {
      try {
        await sendPushToUser(userDoc.id, {
          title,
          body,
          data: { ...extraData, screen: screen || 'home' },
          category: 'system'
        });
        results.successCount++;
      } catch (err) {
        results.failureCount++;
      }
    }

    return { success: true, results };
  } catch (error: any) {
    console.error("adminBroadcastNotification error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Duyuru gönderilirken hata oluştu.');
  }
});

// 2. Admin Grant Wallet Reward
export const adminGrantWalletReward = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    // Verify Admin
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                    (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    
    if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const { targetUserId, amount, balanceType, description } = data;

    // Input Validation
    if (typeof amount !== 'number' || amount === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Miktar sıfırdan farklı olmalıdır.');
    }

    const userRef = db.collection("users").doc(targetUserId);
    
    await db.runTransaction(async (transaction) => {
      const updates: any = {};
      if (balanceType === 'main') updates.mainCoins = FieldValue.increment(amount);
      else updates.energy = FieldValue.increment(amount);
      
      transaction.update(userRef, updates);

      const txRef = db.collection("walletTransactions").doc();
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
  } catch (error: any) {
    console.error("adminGrantWalletReward error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Ödül verilirken hata oluştu.');
  }
});

// 3. Admin Get User Chats
export const getAdminUserChats = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { targetUserId } = data;
  if (!targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');

  try {
    // Log access
    await db.collection("moderationLogs").add({
      adminId: context.auth.uid,
      adminEmail: context.auth.token.email || "",
      targetUid: targetUserId,
      action: "view_user_chats",
      timestamp: new Date().toISOString()
    });

    const chatsSnap = await db.collection("chats")
      .where("participants", "array-contains", targetUserId)
      .get();

    const chats = chatsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort in memory
    chats.sort((a: any, b: any) => {
      const t1 = a.lastMessageAt?.seconds || 0;
      const t2 = b.lastMessageAt?.seconds || 0;
      return t2 - t1;
    });
    return { chats };
  } catch (error: any) {
    console.error("getAdminUserChats error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Sohbetler getirilirken bir hata oluştu.');
  }
});

// 4. Admin Get Chat Messages
export const getAdminChatMessages = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { chatId, targetUserId } = data;
  if (!chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');

  try {
    // Log access
    await db.collection("moderationLogs").add({
      adminId: context.auth.uid,
      adminEmail: context.auth.token.email || "",
      targetUid: targetUserId || "unknown",
      chatId,
      action: "view_chat_messages",
      timestamp: new Date().toISOString()
    });

    const messagesSnap = await db.collection("messages")
      .where("chatId", "==", chatId)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort in memory
    messages.sort((a: any, b: any) => {
      const t1 = a.createdAt?.seconds || 0;
      const t2 = b.createdAt?.seconds || 0;
      return t1 - t2;
    });
    return { messages };
  } catch (error: any) {
    console.error("getAdminChatMessages error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Mesajlar getirilirken bir hata oluştu.');
  }
});

// 5. Admin Moderation Action
export const adminModerationAction = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { action, targetUserId, chatId, messageId, reason } = data;

  try {
    // Log action
    await db.collection("moderationLogs").add({
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
      await db.collection("users").doc(targetUserId).update({ isBanned: true });
    } else if (action === 'delete_chat' && chatId) {
      await db.collection("chats").doc(chatId).update({ status: 'deleted_by_admin' });
    } else if (action === 'flag_message' && messageId) {
      await db.collection("messages").doc(messageId).update({ isFlagged: true, flaggedReason: reason });
    }

    return { success: true };
  } catch (error: any) {
    console.error("adminModerationAction error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'İşlem gerçekleştirilirken bir hata oluştu.');
  }
});

// 6. Admin Set Wallet (Direct Set)
export const adminSetWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { targetUserId, updates } = data;
  if (!targetUserId || !updates) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

  const userRef = db.collection("users").doc(targetUserId);
  
  const allowedFields = [
    'mainCoins', 'energy', 'superLikes', 'refreshCount', 
    'compatibilityCount', 'dailyAdWatchCount', 'dailySwipeLimit', 'extraSwipeLimit'
  ];
  const sanitizedUpdates: any = {};
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      sanitizedUpdates[key] = updates[key];
    }
  });

  if (Object.keys(sanitizedUpdates).length === 0) return { success: true };

  try {
    await userRef.update(sanitizedUpdates);

    // Log Transaction
    const txRef = db.collection("walletTransactions").doc();
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
  } catch (error: any) {
    console.error("adminSetWallet error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Cüzdan güncellenirken hata oluştu.');
  }
});

// 7. Admin Adjust Wallet (Relative Change)
export const adminAdjustWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { targetUserId, field, amount } = data;
  if (!targetUserId || !field || amount === undefined) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

  const allowedFields = [
    'mainCoins', 'energy', 'superLikes', 'refreshCount', 
    'compatibilityCount', 'dailyAdWatchCount', 'dailySwipeLimit', 'extraSwipeLimit'
  ];
  if (!allowedFields.includes(field)) throw new functions.https.HttpsError('invalid-argument', 'Geçersiz alan.');

  const userRef = db.collection("users").doc(targetUserId);
  
  try {
    await userRef.update({
      [field]: FieldValue.increment(amount)
    });

    // Log Transaction
    const txRef = db.collection("walletTransactions").doc();
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
  } catch (error: any) {
    console.error("adminAdjustWallet error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Cüzdan ayarlanırken hata oluştu.');
  }
});

// 8. Admin Update User
export const adminUpdateUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { targetUserId, updates, reason } = data;
  if (!targetUserId || !updates) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

  try {
    await db.collection("users").doc(targetUserId).update(updates);
    
    // Log action
    await db.collection("moderationLogs").add({
      adminId: context.auth.uid,
      adminEmail: context.auth.token.email || "",
      targetUid: targetUserId,
      action: "update_user",
      updates: JSON.stringify(updates),
      reason: reason || "Admin panel güncellemesi",
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("adminUpdateUser error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Kullanıcı güncellenirken hata oluştu.');
  }
});

// 9. Admin Update Config
export const adminUpdateConfig = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { configType, configData } = data;
  if (!configType || !configData) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

  try {
    let collectionName = "config";
    let docName = "global";

    if (configType === 'wallet') {
      collectionName = "adminSettings";
      docName = "wallet";
    } else if (configType === 'economy') {
      collectionName = "adminSettings";
      docName = "economy";
    } else if (configType === 'socialCommerce') {
      collectionName = "config";
      docName = "socialCommerce";
    }

    await db.collection(collectionName).doc(docName).set(configData);
    
    // Log action
    await db.collection("moderationLogs").add({
      adminId: context.auth.uid,
      adminEmail: context.auth.token.email || "",
      action: `update_config_${configType}`,
      timestamp: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("adminUpdateConfig error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Ayarlar güncellenirken hata oluştu.');
  }
});

// 10. Admin Update Report
export const adminUpdateReport = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { reportId, status, adminNotes } = data;
  if (!reportId || !status) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

  try {
    await db.collection("reports").doc(reportId).update({
      status,
      adminNotes: adminNotes || "",
      updatedAt: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("adminUpdateReport error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Rapor güncellenirken hata oluştu.');
  }
});

// 11. Admin Manage Promo Code
export const adminManagePromoCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { action, promoId, promoData } = data;

  try {
    if (action === 'create') {
      const ref = db.collection("promoCodes").doc();
      await ref.set({
        ...promoData,
        id: ref.id,
        createdAt: new Date().toISOString(),
        currentUses: 0
      });
    } else if (action === 'update' && promoId) {
      await db.collection("promoCodes").doc(promoId).update(promoData);
    } else if (action === 'delete' && promoId) {
      await db.collection("promoCodes").doc(promoId).delete();
    }

    return { success: true };
  } catch (error: any) {
    console.error("adminManagePromoCode error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Promosyon kodu işlemi sırasında hata oluştu.');
  }
});
