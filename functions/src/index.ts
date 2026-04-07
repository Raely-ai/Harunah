import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

/**
 * PRODUCTION WALLET FUNCTIONS
 */

// 1. Watch Ad Reward
export const watchAdReward = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { config } = data; // Admin config passed from client or fetched here
  
  const userRef = db.collection("users").doc(userId);
  
  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
    
    const userData = userSnap.data() as any;
    const today = new Date().toISOString().split('T')[0];
    const lastReset = userData.lastAdReset ? userData.lastAdReset.split('T')[0] : "";
    
    let dailyCount = userData.dailyAdWatchCount || 0;
    if (today !== lastReset) dailyCount = 0;

    if (dailyCount >= config.maxDailyAds) {
      throw new functions.https.HttpsError('failed-precondition', 'Günlük reklam sınırı aşıldı.');
    }

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + (config.adRewardExpiryDays || 7));

    transaction.update(userRef, {
      energy: admin.firestore.FieldValue.increment(config.adRewardEnergy),
      dailyAdWatchCount: dailyCount + 1,
      lastAdReset: now.toISOString()
    });

    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: 'earn',
      source: 'ad',
      amount: config.adRewardEnergy,
      balanceType: 'energy',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      remainingAmount: config.adRewardEnergy,
      status: 'active',
      description: 'Reklam izleme ödülü (Sistem Onaylı)'
    });

    return { success: true };
  });
});

// 2. Purchase Coins
export const purchaseCoins = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { amount, packageId, balanceType = 'main' } = data;

  // Input Validation
  if (typeof amount !== 'number' || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Miktar pozitif bir sayı olmalıdır.');
  }
  
  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  
  await db.runTransaction(async (transaction) => {
    const updates: any = {};
    if (balanceType === 'main') updates.mainCoins = admin.firestore.FieldValue.increment(amount);
    else updates.energy = admin.firestore.FieldValue.increment(amount);
    
    transaction.update(userRef, updates);

    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: 'purchase',
      source: 'purchase',
      amount: amount,
      balanceType,
      createdAt: now.toISOString(),
      expiresAt: null,
      remainingAmount: amount,
      status: 'active',
      description: `Satın alım onaylandı: ${packageId}`
    });
  });

  return { success: true };
});

// 3. Spend Balance
export const spendBalance = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { balanceType, amount, source, description } = data;

  // Input Validation
  if (typeof amount !== 'number' || amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Harcama miktarı pozitif olmalıdır.');
  }
  
  const userRef = db.collection("users").doc(userId);
  const now = new Date().toISOString();
  
  try {
    let energyTxs: any[] = [];
    if (balanceType === 'energy') {
      const snaps = await db.collection("walletTransactions")
        .where("userId", "==", userId)
        .where("balanceType", "==", "energy")
        .where("status", "==", "active")
        .where("expiresAt", ">", now)
        .orderBy("expiresAt", "asc")
        .get();
      energyTxs = snaps.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
    }

    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;
      
      const currentBalance = balanceType === 'main' ? (userData.mainCoins || 0) : (userData.energy || 0);
      if (currentBalance < amount) throw new Error("Yetersiz bakiye.");

      if (balanceType === 'energy') {
        let remainingToSpend = amount;
        for (const tx of energyTxs) {
          if (remainingToSpend <= 0) break;
          const available = tx.remainingAmount;
          if (available <= remainingToSpend) {
            transaction.update(tx.ref, { remainingAmount: 0, status: 'spent' });
            remainingToSpend -= available;
          } else {
            transaction.update(tx.ref, { remainingAmount: available - remainingToSpend });
            remainingToSpend = 0;
          }
        }
        if (remainingToSpend > 0) throw new Error("Enerji bakiyesi doğrulanamadı.");
      }

      const updates: any = {};
      if (balanceType === 'main') updates.mainCoins = currentBalance - amount;
      else updates.energy = currentBalance - amount;
      transaction.update(userRef, updates);

      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'spend',
        source,
        amount: -amount,
        balanceType,
        createdAt: now,
        status: 'spent',
        description: `${description} (Sistem Doğrulamalı)`
      });

      return { success: true };
    });
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// 4. Buy Fortune Subscription
export const buyFortuneSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type, subConfig } = data;
  
  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  let expiresAt = new Date();
  
  if (type === 'daily') expiresAt.setDate(now.getDate() + 1);
  else if (type === 'weekly') expiresAt.setDate(now.getDate() + 7);
  else if (type === 'monthly') expiresAt.setMonth(now.getMonth() + 1);

  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;

    // Check for active subscription
    if (userData.subscription && userData.subscription.status === 'active') {
      const currentExpires = new Date(userData.subscription.expiresAt);
      if (currentExpires > now) {
        throw new functions.https.HttpsError('failed-precondition', 'Zaten aktif bir fal aboneliğiniz var.');
      }
    }

    transaction.update(userRef, {
      subscription: {
        type,
        status: 'active',
        expiresAt: expiresAt.toISOString(),
        dailyLimit: subConfig.dailyLimit,
        dailyLimitUsed: 0,
        lastResetAt: now.toISOString().split('T')[0],
        dailyReadingsUsed: { coffee: 0, tarot: 0, advanced: 0 }
      }
    });

    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: 'purchase',
      source: 'subscription',
      amount: subConfig.price,
      balanceType: 'main',
      createdAt: now.toISOString(),
      status: 'active',
      description: `Fal Aboneliği (${type})`
    });

    return { success: true };
  });
});

// 5. Buy Social Subscription
export const buySocialSubscription = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type, subConfig } = data;
  
  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  let expiresAt = new Date();
  
  if (type === 'weekly') expiresAt.setDate(now.getDate() + 7);
  else if (type === 'monthly') expiresAt.setMonth(now.getMonth() + 1);

  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;

    // Check for active subscription
    if (userData.socialSubscription && userData.socialSubscription.status === 'active') {
      const currentExpires = new Date(userData.socialSubscription.expiresAt);
      if (currentExpires > now) {
        throw new functions.https.HttpsError('failed-precondition', 'Zaten aktif bir sosyal aboneliğiniz var.');
      }
    }

    transaction.update(userRef, {
      socialSubscription: {
        status: 'active',
        type,
        expiresAt: expiresAt.toISOString(),
        dailyUsage: { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: now.toISOString().split('T')[0] }
      },
      boostExpiresAt: expiresAt.toISOString()
    });

    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: 'purchase',
      source: 'subscription',
      amount: subConfig.price,
      balanceType: 'main',
      createdAt: now.toISOString(),
      status: 'active',
      description: `Sosyal Aboneliği (${type})`
    });

    return { success: true };
  });
});

// 6. Purchase Social Item
export const purchaseSocialItem = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type, price, description } = data;

  // Input Validation
  if (typeof price !== 'number' || price <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Fiyat pozitif olmalıdır.');
  }
  
  const userRef = db.collection("users").doc(userId);
  
  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;
    
    if ((userData.mainCoins || 0) < price) throw new Error("Yetersiz bakiye.");

    const updates: any = {
      mainCoins: admin.firestore.FieldValue.increment(-price)
    };
    if (type === 'superLike') updates.superLikes = admin.firestore.FieldValue.increment(1);
    if (type === 'refresh') updates.refreshCount = admin.firestore.FieldValue.increment(1);
    if (type === 'compatibility') updates.compatibilityCount = admin.firestore.FieldValue.increment(1);
    
    transaction.update(userRef, updates);

    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: 'spend',
      source: 'social_action',
      amount: -price,
      balanceType: 'main',
      createdAt: new Date().toISOString(),
      status: 'spent',
      description: `${description} satın alımı`
    });

    return { success: true };
  });
});

// 7. Consume Social Feature
export const consumeSocialFeature = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type, config } = data;
  
  const userRef = db.collection("users").doc(userId);
  
  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;
    
    const sub = userData.socialSubscription;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Check Subscription
    if (sub && sub.status === 'active' && new Date(sub.expiresAt) > now) {
      const dailyUsage = sub.dailyUsage || { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: today };
      if (dailyUsage.lastResetDate !== today) {
        dailyUsage.superLikes = 0;
        dailyUsage.refreshes = 0;
        dailyUsage.compatibility = 0;
        dailyUsage.lastResetDate = today;
      }
      
      const limits = config.socialSubscriptions[sub.type].dailyLimits;
      if (type === 'superLike' && dailyUsage.superLikes < limits.superLikes) {
        dailyUsage.superLikes++;
        transaction.update(userRef, { "socialSubscription.dailyUsage": dailyUsage });
        return { success: true };
      }
      // ... other types
    }
    
    // Fallback to paid
    const field = type === 'superLike' ? 'superLikes' : type === 'refresh' ? 'refreshCount' : 'compatibilityCount';
    if ((userData[field] || 0) <= 0) throw new Error("Yetersiz hak.");
    
    transaction.update(userRef, { [field]: admin.firestore.FieldValue.increment(-1) });
    return { success: true };
  });
});

// 8. Admin Grant Wallet Reward
export const adminGrantWalletReward = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  // Verify Admin
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { targetUserId, amount, balanceType, description } = data;

  // Input Validation
  if (typeof amount !== 'number' || amount === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Miktar sıfırdan farklı olmalıdır.');
  }

  const userRef = db.collection("users").doc(targetUserId);
  
  await db.runTransaction(async (transaction) => {
    const updates: any = {};
    if (balanceType === 'main') updates.mainCoins = admin.firestore.FieldValue.increment(amount);
    else updates.energy = admin.firestore.FieldValue.increment(amount);
    
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
});

// 9. Admin Get User Chats
export const getAdminUserChats = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  // Verify Admin
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
    // Sort in memory to avoid index requirement
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

// 10. Admin Get Chat Messages
export const getAdminChatMessages = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  // Verify Admin
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
      .limit(100)
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

// 11. Admin Moderation Action
export const adminModerationAction = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  // Verify Admin
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
      // Soft delete chat
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
