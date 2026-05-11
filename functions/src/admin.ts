import * as functions from "firebase-functions";
import { db, FieldValue, sendPushToUser, messaging } from "./base";

// 1. Admin Broadcast Notification
export const adminBroadcastNotification = functions.region('us-central1').https.onCall(async (data, context) => {
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

    const tokens: string[] = [];
    const tokenToUid: Record<string, string> = {};

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

    const invalidTokens: string[] = [];

    // Send in chunks of 500 (Firebase limit)
    for (let i = 0; i < tokens.length; i += 500) {
      const chunk = tokens.slice(i, i + 500);
      try {
         const response = await messaging.sendEachForMulticast({
            tokens: chunk,
            notification: { title, body },
            data: { 
                ...Object.fromEntries(Object.entries(extraData || {}).map(([k, v]) => [k, String(v)])),
                screen: String(screen || 'home'),
                category: 'system' 
            },
            android: {
              priority: 'high',
              notification: {
                sound: 'default',
                channelId: 'lasya_default_channel',
                priority: 'high',
                defaultSound: true
              }
            },
            apns: {
              payload: {
                aps: {
                  sound: 'default',
                  badge: 1
                }
              }
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
      } catch (err) {
         console.error("Multicast error for chunk", err);
         results.failureCount += chunk.length;
      }
    }

    // Token Cleanup
    if (invalidTokens.length > 0) {
       console.log(`Cleaning up ${invalidTokens.length} invalid tokens...`);
       let batch = db.batch();
       let opCount = 0;
       
       for (const t of invalidTokens) {
          const uid = tokenToUid[t];
          if (uid) {
             const userRef = db.collection("users").doc(uid);
             batch.update(userRef, { fcmToken: FieldValue.delete() });
             opCount++;
             if (opCount === 500) {
               await batch.commit();
               batch = db.batch();
               opCount = 0;
             }
          }
       }
       if (opCount > 0) {
          await batch.commit();
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
export const adminGrantWalletReward = functions.region('us-central1').https.onCall(async (data, context) => {
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
export const getAdminUserChats = functions.region('us-central1').https.onCall(async (data, context) => {
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
export const getAdminChatMessages = functions.region('us-central1').https.onCall(async (data, context) => {
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
      .get();

    let messages = messagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Sort in memory (descending first to get latest 500, or ascending as requested)
    messages.sort((a: any, b: any) => {
      const t1 = a.createdAt?.seconds || 0;
      const t2 = b.createdAt?.seconds || 0;
      return t2 - t1; // Sort descending
    });
    
    // Limit to 500
    messages = messages.slice(0, 500);

    // Sort ascending for UI (oldest to newest)
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
export const adminModerationAction = functions.region('us-central1').https.onCall(async (data, context) => {
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
export const adminSetWallet = functions.region('us-central1').https.onCall(async (data, context) => {
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
export const adminAdjustWallet = functions.region('us-central1').https.onCall(async (data, context) => {
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
export const adminUpdateUser = functions.region('us-central1').https.onCall(async (data, context) => {
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
export const adminUpdateConfig = functions.region('us-central1').https.onCall(async (data, context) => {
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
export const adminUpdateReport = functions.region('us-central1').https.onCall(async (data, context) => {
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
export const adminManagePromoCode = functions.region('us-central1').https.onCall(async (data, context) => {
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

// -- TEST USER MANAGEMENT --

export const adminCreateTestUsers = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                    (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);

    if (!isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
    }

    const { maleCount = 20, femaleCount = 20 } = data;
    const totalCount = maleCount + femaleCount;
    
    if (totalCount > 50) {
      throw new functions.https.HttpsError('invalid-argument', 'Tek seferde en fazla 50 kullanıcı oluşturulabilir.');
    }

    const turkishMaleNames = ['Ahmet', 'Mehmet', 'Can', 'Burak', 'Emre', 'Ali', 'Yusuf', 'Eren', 'Ozan', 'Tarkan', 'Mert', 'Kaan', 'Arda', 'Cem', 'Tolga', 'Barış', 'Kemal', 'Serkan', 'Oğuz', 'Gökhan', 'Hakan', 'Erdem', 'Volkan', 'Koray'];
    const turkishFemaleNames = ['Ayşe', 'Fatma', 'Merve', 'Elif', 'Zeynep', 'Büşra', 'Ceren', 'Damla', 'Ece', 'Gizem', 'Pelin', 'Selin', 'Derya', 'Bahar', 'Gamze', 'Aslı', 'İrem', 'Ebru', 'Cansu', 'Gözde', 'Hande', 'Melis', 'Sinem', 'Tuğçe'];
    const cities = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Kayseri', 'Eskişehir', 'Samsun'];
    const bios = [
      'Hayatı sevmeyi öğreniyorum. Kahve aşığı.',
      'Yeni insanlar tanımayı severim.',
      'Müzik, kitaplar ve kediler.',
      'Gezmeyi seviyorum, yeni maceralara her zaman açığım.',
      'Doğa yürüyüşleri ve kamp yapmak vazgeçilmezim.',
      'Sadece samimiyet.',
      'Sinema ve tiyatro aşığı.',
      'İyi yemek ve iyi insan.',
      'Spontane yaşamayı severim.'
    ];

    const results = { created: 0, failed: 0 };
    const auth = require('firebase-admin').auth();
    const batch = db.batch();

    const timestamp = Date.now();

    for (let i = 0; i < totalCount; i++) {
      const isMale = i < maleCount;
      const gender = isMale ? 'erkek' : 'kadın';
      const namePool = isMale ? turkishMaleNames : turkishFemaleNames;
      
      const randomName = namePool[Math.floor(Math.random() * namePool.length)];
      const randomCity = cities[Math.floor(Math.random() * cities.length)];
      const randomBio = bios[Math.floor(Math.random() * bios.length)];
      const age = Math.floor(Math.random() * 20) + 18; // 18-37
      
      const email = `test_${isMale ? 'male' : 'female'}_${timestamp}_${i}@lasya.test`;
      const password = `TestPass!${Math.floor(Math.random() * 1000000)}`;

      try {
        const userRecord = await auth.createUser({
          email,
          password,
          displayName: randomName,
          emailVerified: true,
          disabled: false,
        });

        const userRef = db.collection('users').doc(userRecord.uid);
        
        batch.set(userRef, {
          email,
          role: 'user',
          uid: userRecord.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          isTestUser: true,
          createdByAdminSeed: true,
          lastActivity: new Date().toISOString(),
          
          social: {
            nickname: randomName,
            age: age,
            gender: gender,
            city: randomCity,
            bio: randomBio,
            lookingFor: isMale ? ['kadın'] : ['erkek'],
            zodiac: 'Koç', // Default or pick random
            relationshipStatus: 'bekar',
            photos: [`https://api.dicebear.com/7.x/avataaars/svg?seed=${userRecord.uid}`],
            enabled: true,
            visible: true,
            profileCompleted: true,
            onboardingDiscoverBonusClaimed: true, // give them defaults so they dont error
            completionRewardClaimed: true
          }
        });
        
        results.created++;
      } catch (err) {
        console.error("Error creating test user:", err);
        results.failed++;
      }
    }

    if (results.created > 0) {
      await batch.commit();
    }

    return { success: true, message: `${results.created} test kullanıcısı başarıyla oluşturuldu. ${results.failed} başarısız.`, results };

  } catch (error: any) {
    console.error("adminCreateTestUsers error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Bir hata oluştu.');
  }
});

export const adminManageTestUsers = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                    (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);

    if (!isAdmin) {
      throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
    }

    const { action } = data; // 'hide', 'show', 'delete'
    if (!['hide', 'show', 'delete'].includes(action)) {
      throw new functions.https.HttpsError('invalid-argument', 'Geçersiz işlem.');
    }

    const testUsersSnap = await db.collection("users").where("isTestUser", "==", true).get();
    
    if (testUsersSnap.empty) {
      return { success: true, message: "İşlem yapılacak test kullanıcısı bulunamadı." };
    }

    let modifiedCount = 0;
    const auth = require('firebase-admin').auth();

    // Max limit chunk array per batch limits
    const chunks = [];
    let currentChunk = [];
    testUsersSnap.docs.forEach(doc => {
      currentChunk.push(doc);
      if (currentChunk.length === 500) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    });
    if (currentChunk.length > 0) chunks.push(currentChunk);

    for (const chunk of chunks) {
      const batch = db.batch();
      const uidsToDelete: string[] = [];

      for (const doc of chunk) {
        if (action === 'hide') {
          batch.update(doc.ref, { "social.visible": false });
          modifiedCount++;
        } else if (action === 'show') {
          batch.update(doc.ref, { "social.visible": true });
          modifiedCount++;
        } else if (action === 'delete') {
          batch.delete(doc.ref);
          uidsToDelete.push(doc.id);
        }
      }

      await batch.commit();

      if (action === 'delete' && uidsToDelete.length > 0) {
        // Delete from Auth - maximum 1000 per request, but we chunk to 500 max anyway
        try {
           await auth.deleteUsers(uidsToDelete);
           modifiedCount += uidsToDelete.length;
        } catch(e) {
           console.error("Auth delete error batch", e);
           // Fallback manual loops just in case
           for(const uid of uidsToDelete) {
               try { await auth.deleteUser(uid); } catch(ex) {}
           }
           modifiedCount += uidsToDelete.length;
        }
      }
    }

    const actionText = action === 'hide' ? 'gizlendi' : action === 'show' ? 'gösterildi' : 'silindi';
    return { success: true, message: `${modifiedCount} test kullanıcısı başarıyla ${actionText}.` };

  } catch (error: any) {
    console.error("adminManageTestUsers error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Bir hata oluştu.');
  }
});
