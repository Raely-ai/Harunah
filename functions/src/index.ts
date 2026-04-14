import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import * as crypto from "crypto";

admin.initializeApp({
  projectId: "gen-lang-client-0107919355"
});

const db = getFirestore("ai-studio-71aa84b8-dbfc-4fbb-ab63-365a3c94301c");
const messaging = getMessaging();
const FieldValue = admin.firestore.FieldValue;

// Define OpenAI Secret
const openAiKey = defineSecret("OPENAI_API_KEY");

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) {
    const key = openAiKey.value();
    if (!key) {
      throw new Error("OPENAI_API_KEY is not set in environment/secrets.");
    }
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

/**
 * NOTIFICATION HELPERS
 */

async function sendPushToUser(userId: string, payload: { title: string, body: string, data?: Record<string, string>, category?: string, senderId?: string }) {
  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) return;
    const userData = userSnap.data() as any;
    const fcmToken = userData.fcmToken;

    // Check if sender is muted
    const mutedUserIds = userData.social?.mutedUserIds || [];
    if (payload.senderId && mutedUserIds.includes(payload.senderId)) {
      console.log(`User ${userId} has muted sender ${payload.senderId}. Skipping push.`);
      return;
    }

    const settings = userData.notificationSettings || {
      messages: true,
      likes: true,
      superLikes: true,
      fortunes: true,
      compatibility: true,
      rewards: true,
      broadcasts: true,
      reminders: true,
      system: true
    };

    if (!fcmToken) return;

    // Check preference based on category
    if (payload.category && settings[payload.category] === false) {
      console.log(`User ${userId} has disabled ${payload.category} notifications.`);
      return;
    }

    const message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          }
        }
      }
    };

    await messaging.send(message);
    console.log(`Push sent to user ${userId}`);
  } catch (error: any) {
    console.error(`Error sending push to user ${userId}:`, error);
    if (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-registration-token') {
      console.log(`Cleaning up invalid token for user ${userId}`);
      await db.collection("users").doc(userId).update({ fcmToken: FieldValue.delete() });
    }
  }
}

/**
 * NEW FORTUNE SYSTEM FUNCTIONS
 */

// 1. Create Fortune Reading (Backend Controlled)
export const createFortuneReading = functions.https.onCall(async (data, context) => {
  console.log("createFortuneReading called for type:", data?.type);
  try {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    
    const userId = context.auth.uid;
    const { type, formData, questions, priorityMode } = data || {};

    if (!type || !formData) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

    // Sanitize formData to only include allowed fields based on type
    const sanitizedFormData: any = {
      adSoyad: formData.adSoyad || "",
      dogumTarihi: formData.dogumTarihi || "",
      iliskiDurumu: formData.iliskiDurumu || ""
    };

    if (['water', 'ebced', 'yildizname', 'havas'].includes(type)) {
      sanitizedFormData.motherName = formData.motherName || "";
      sanitizedFormData.fatherName = formData.fatherName || "";
    }

    // Create a simple hash of the request to prevent duplicates
    const requestString = JSON.stringify({ userId, type, formData: sanitizedFormData, questions });
    const requestHash = crypto.createHash('md5').update(requestString).digest('hex');

    const userRef = db.collection("users").doc(userId);
    const economyRef = db.collection("adminSettings").doc("economy");
    
    // 1. Guard: Check for active readings or exact duplicates (Outside transaction for better performance/stability)
    const activeReadings = await db.collection("readings")
      .where("userId", "==", userId)
      .where("status", "in", ["searching", "found", "interpreting", "waiting"])
      .limit(1)
      .get();
    
    if (!activeReadings.empty) {
      throw new functions.https.HttpsError('already-exists', 'Zaten aktif bir fal talebiniz var.');
    }

    const duplicateCheck = await db.collection("readings")
      .where("requestHash", "==", requestHash)
      .where("createdAt", ">", new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(1)
      .get();

    if (!duplicateCheck.empty) {
      throw new functions.https.HttpsError('already-exists', 'Bu fal talebi zaten gönderilmiş.');
    }

    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
      const userData = userSnap.data() as any;

      const economySnap = await transaction.get(economyRef);
      const economy = economySnap.exists ? economySnap.data() as any : {
        fortunePricing: { coffee: 100, tarot: 150, water: 200, ebced: 250, yildizname: 300, havas: 500, extraQuestion: 50, priorityFee: 100 },
        subscriptionLimits: { totalDaily: 10 },
        interpretationTimes: {
          coffee: { minSearchTime: 1, maxSearchTime: 3, minInterpreterTime: 5, maxInterpreterTime: 10, minReadingTime: 10, maxReadingTime: 20 },
          tarot: { minSearchTime: 1, maxSearchTime: 3, minInterpreterTime: 5, maxInterpreterTime: 10, minReadingTime: 10, maxReadingTime: 20 },
          advanced: { minSearchTime: 2, maxSearchTime: 5, minInterpreterTime: 10, maxInterpreterTime: 15, minReadingTime: 15, maxReadingTime: 30 }
        }
      };

      // 2. Calculate Price
      const basePrice = Number(economy.fortunePricing?.[type]) || 100;
      const extraQuestionPrice = Number(economy.fortunePricing?.extraQuestion) || 50;
      const priorityFee = Number(economy.fortunePricing?.priorityFee) || 100;
      
      let extraQuestionsCost = 0;
      if (Array.isArray(questions) && questions.length > 3) {
        extraQuestionsCost = (questions.length - 3) * extraQuestionPrice;
      }
      
      const totalCost = basePrice + extraQuestionsCost + (priorityMode ? priorityFee : 0);

      // 3. Determine Balance Type
      let balanceType: 'subscription' | 'energy' | 'main' = 'main';
      const today = new Date().toISOString().split('T')[0];
      
      // Priority 1: Subscription (Highest priority)
      const sub = userData.subscription;
      const subLimits = economy.subscriptionLimits || { totalDaily: 10 };

      if (sub && sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt) > new Date()) {
        const dailyUsed = sub.dailyLimitUsed || 0;
        const lastReset = sub.lastResetAt || "";
        
        if (lastReset === today && dailyUsed >= subLimits.totalDaily) {
          throw new functions.https.HttpsError('resource-exhausted', 'Günlük fal limitinize ulaştınız. Yarın tekrar bekleriz!');
        }
        balanceType = 'subscription';
      }

      // Priority 2: Energy (If not subscription)
      if (balanceType === 'main') {
        if ((userData.energy || 0) >= totalCost) {
          balanceType = 'energy';
        }
      }

      // Priority 3: Main Coins (Check if neither subscription nor energy covers it)
      if (balanceType === 'main') {
        if ((userData.mainCoins || 0) < totalCost) {
          throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
        }
      }

      // 4. Deduct Balance
      const userUpdates: any = {};
      if (balanceType === 'main') {
        userUpdates.mainCoins = FieldValue.increment(-totalCost);
      } else if (balanceType === 'energy') {
        userUpdates.energy = FieldValue.increment(-totalCost);
      } else if (balanceType === 'subscription') {
        if (userData.subscription?.lastResetAt !== today) {
          userUpdates["subscription.dailyLimitUsed"] = 1;
        } else {
          userUpdates["subscription.dailyLimitUsed"] = FieldValue.increment(1);
        }
        userUpdates["subscription.lastResetAt"] = today;
      }
      transaction.update(userRef, userUpdates);

      // 5. Create Reading
      const readingRef = db.collection("readings").doc();
      const now = new Date();
      
      // Subscribers get priority mode by default
      const effectivePriorityMode = priorityMode || (balanceType === 'subscription');
      
      // Timing Logic (Fake Processing)
      const fakeConfig = economy.fakeProcessing || {
        readerFindingMinDelay: 60000,
        readerFindingMaxDelay: 180000,
        interpretationMinDelay: 300000,
        interpretationMaxDelay: 1200000
      };

      const searchDelay = (Math.random() * (fakeConfig.readerFindingMaxDelay - fakeConfig.readerFindingMinDelay) + fakeConfig.readerFindingMinDelay);
      const interpretationDelay = (Math.random() * (fakeConfig.interpretationMaxDelay - fakeConfig.interpretationMinDelay) + fakeConfig.interpretationMinDelay);

      // Priority speed up (50% faster)
      const speedFactor = effectivePriorityMode ? 0.5 : 1.0;

      const expectedReaderFoundAt = new Date(now.getTime() + searchDelay * speedFactor);
      const interpretationStartedAt = new Date(expectedReaderFoundAt.getTime() + (interpretationDelay * 0.2) * speedFactor); // Found -> Interpreting is quick
      const expectedCompletedAt = new Date(expectedReaderFoundAt.getTime() + interpretationDelay * speedFactor);

      const readingData = {
        id: readingRef.id,
        userId,
        type,
        status: 'searching',
        requestHash,
        formData: sanitizedFormData,
        questions: Array.isArray(questions) ? questions.map((q: any) => typeof q === 'string' ? q : q.text).filter(Boolean) : [],
        priorityMode: !!effectivePriorityMode,
        balanceType,
        creditsUsed: balanceType === 'subscription' ? 0 : totalCost,
        priceBreakdown: {
          base: basePrice,
          extraQuestions: extraQuestionsCost,
          priority: effectivePriorityMode && !priorityMode ? 0 : (priorityMode ? priorityFee : 0),
          total: totalCost
        },
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expectedReaderFoundAt: expectedReaderFoundAt.toISOString(),
        interpretationStartedAt: interpretationStartedAt.toISOString(),
        expectedCompletedAt: expectedCompletedAt.toISOString(),
        title: type === 'coffee' ? 'Kahve Falı' : type === 'tarot' ? 'Tarot Açılımı' : type.charAt(0).toUpperCase() + type.slice(1),
        isSeenByUser: false
      };

      transaction.set(readingRef, readingData);

      // Log Transaction
      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'spend',
        source: 'fortune_reading',
        amount: balanceType === 'subscription' ? 0 : -totalCost,
        balanceType: balanceType === 'energy' ? 'energy' : 'main',
        createdAt: now.toISOString(),
        status: 'spent',
        description: `${readingData.title} için harcama`
      });

      return { success: true, readingId: readingRef.id };
    });
  } catch (err: any) {
    console.error("Fortune creation failed:", err);
    
    // If it's already an HttpsError, re-throw it
    if (err instanceof functions.https.HttpsError) {
      throw err;
    }
    
    // Otherwise wrap it but be careful with JSON.stringify
    let errorMessage = "Bilinmeyen bir hata oluştu.";
    try {
      errorMessage = err.message || String(err);
    } catch (e) {
      // ignore
    }
    
    throw new functions.https.HttpsError('internal', `Fortune Creation Error: ${errorMessage}`);
  }
});

// 2. Process Fortune AI
export const processFortuneAI = functions.runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  const openai = getOpenAI();
  
  const { readingId } = data;
  if (!readingId) throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');

  const readingRef = db.collection("readings").doc(readingId);
  
  // Retry logic for document visibility
  let readingSnap = await readingRef.get();
  if (!readingSnap.exists) {
    console.log(`Reading ${readingId} not found, retrying in 2s...`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    readingSnap = await readingRef.get();
  }

  if (!readingSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Fal kaydı henüz oluşturulmadı veya bulunamadı.');
  }

  // Use transaction for atomic status check and lock
  const result = await db.runTransaction(async (transaction) => {
    const freshSnap = await transaction.get(readingRef);
    if (!freshSnap.exists) throw new Error('Fal kaydı bulunamadı.');
    const reading = freshSnap.data() as any;

    if (reading.userId !== userId) throw new Error('Yetkisiz erişim.');
    
    // Idempotency check
    if (reading.status === 'completed') return { alreadyCompleted: true, content: reading.content };
    if (reading.status === 'processing_ai') return { alreadyProcessing: true };

    // Lock the reading for AI generation
    transaction.update(readingRef, { 
      isAIGenerating: true,
      updatedAt: new Date().toISOString() 
    });

    return { reading, proceed: true };
  }).catch(err => {
    throw new functions.https.HttpsError('internal', `AI Process Error: ${err.message} | Stack: ${err.stack}`);
  });

  if (result.alreadyCompleted) return { success: true, content: result.content };
  if (result.alreadyProcessing) return { success: true, message: "Falınız zaten hazırlanıyor..." };
  
  const reading = result.reading;

  // Notify Interpreting (if we just started)
  await db.collection("notifications").add({
    userId: reading.userId,
    type: 'system',
    title: 'Falınız Yorumlanıyor',
    message: `${reading.title} yorumunuz LASYA tarafından hazırlanıyor.`,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    data: { readingId }
  });

  // Fetch AI Settings from Economy Config
  const economySnap = await db.collection("adminSettings").doc("economy").get();
  const economy = economySnap.data() as any;
  const aiConfig = economy?.aiSettings?.[reading.type] || {
    systemPrompt: "Sen LASYA isminde mistik bir kahinsin.",
    templatePrompt: "Kullanıcı {adsoyad}, {dogumtarihi} doğumlu, {iliskidurumu}. Soruları: {sorular}. Lütfen yorumla.",
    tone: "Karizmatik",
    mysticLevel: 9
  };

  // Prepare Placeholders
  const placeholders: Record<string, string> = {
    adsoyad: reading.formData.adSoyad || "Canım",
    dogumtarihi: reading.formData.dogumTarihi || "Bilinmiyor",
    iliskidurumu: reading.formData.iliskiDurumu || "Bilinmiyor",
    anneadi: reading.formData.motherName || "Bilinmiyor",
    babaadi: reading.formData.fatherName || "Bilinmiyor",
    sorular: Array.isArray(reading.questions) ? reading.questions.join(", ") : "Genel yorum",
    tur: reading.type,
    isim: reading.formData.adSoyad?.split(" ")[0] || "Canım"
  };

  let systemPrompt = aiConfig.systemPrompt;
  let templatePrompt = aiConfig.templatePrompt;

  const identityRules = `
Sen Ahlas adında, karizmatik, gizemli ve hafif flörtöz bir erkek falcısın. 
Şu an bir ${placeholders.tur === 'coffee' ? 'KAHVE FALI' : placeholders.tur.toUpperCase()} bakıyorsun. 
Yorumlarını mutlaka bu fal türünün ( ${placeholders.tur} ) geleneklerine ve sembollerine göre yap.
Robot gibi değil, gerçek bir insan gibi konuşuyorsun. 
TÜM YORUMUN TEK BİR PARAGRAF OLMALI, SATIR ATLAMA KESİNLİKLE YASAK.
Genel yorumun 350-400 kelime arasında olmalı.
Yorumuna mutlaka şu cümleyle başla: "Merhaba tekrardan hoşgeldin ${placeholders.isim}, şimdi hemen falına geçelim..."
Yorumunu mutlaka şu cümleyle bitir: "Falın bu kadardı sabrın için teşekkür ederim."
Cevap Tonu: ${aiConfig.tone || "Karizmatik"}
Mistik Seviye: ${aiConfig.mysticLevel || 9}/10
`;

  systemPrompt = identityRules + "\n" + systemPrompt;

  Object.entries(placeholders).forEach(([key, value]) => {
    const regex = new RegExp(`{${key}}`, 'g');
    systemPrompt = systemPrompt.replace(regex, value);
    templatePrompt = templatePrompt.replace(regex, value);
  });

  // AI DEBUG LOGS
  console.log("AI DEBUG - reading.type:", reading.type);
  console.log("AI DEBUG - aiConfig:", aiConfig);
  console.log("AI DEBUG - systemPrompt (final):", systemPrompt);
  console.log("AI DEBUG - templatePrompt (final):", templatePrompt);
  
  if (economy?.aiSettings?.[reading.type]) {
    console.log("AI DEBUG - ADMIN PROMPT KULLANILIYOR");
  } else {
    console.log("AI DEBUG - FALLBACK PROMPT KULLANILIYOR");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: `
${templatePrompt}

Ek Bilgiler:
Anne Adı: ${placeholders.anneadi}
Baba Adı: ${placeholders.babaadi}
Fal Türü: ${placeholders.tur}

Lütfen bu bilgilere ve yukarıdaki taslağa göre mistik bir yorum yap.
`
        }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    let content = response.choices[0].message.content || "";
    content = content.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

    // Save Result - Mark as generated but store in hiddenResult
    // The background task will move it to 'content' when expectedCompletedAt is reached
    await readingRef.update({
      hiddenResult: content,
      isAIGenerated: true,
      isAIGenerating: false,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (error: any) {
    console.error("OpenAI Error Details:", {
      message: error.message,
      stack: error.stack,
      code: error.code,
      type: error.type
    });
    await readingRef.update({
      status: 'error',
      error: `AI Hatası: ${error.message}`,
      updatedAt: new Date().toISOString()
    }).catch(updateErr => console.error("Failed to update reading status to error:", updateErr));
    
    throw new functions.https.HttpsError('internal', `AI üretimi sırasında hata oluştu: ${error.message}`);
  }
});

// 3. Upgrade Fortune Priority
export const upgradeFortunePriority = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  const { readingId } = data;
  if (!readingId) throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');

  const readingRef = db.collection("readings").doc(readingId);
  const userRef = db.collection("users").doc(userId);
  const economyRef = db.collection("adminSettings").doc("economy");

  return await db.runTransaction(async (transaction) => {
    const readingSnap = await transaction.get(readingRef);
    if (!readingSnap.exists) throw new functions.https.HttpsError('not-found', 'Fal kaydı bulunamadı.');
    const reading = readingSnap.data() as any;

    if (reading.userId !== userId) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');
    if (reading.priorityMode) throw new functions.https.HttpsError('failed-precondition', 'Zaten öncelikli sırada.');
    if (reading.status !== 'searching') throw new functions.https.HttpsError('failed-precondition', 'Sadece arama aşamasında yükseltilebilir.');

    const economySnap = await transaction.get(economyRef);
    const priorityFee = economySnap.data()?.fortunePricing?.priorityFee || 100;

    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() as any;

    if ((userData.mainCoins || 0) < priorityFee) {
      throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
    }

    // Deduct Fee
    transaction.update(userRef, {
      mainCoins: FieldValue.increment(-priorityFee)
    });

    // Update Reading
    const now = new Date();
    const expectedFoundAt = reading.expectedReaderFoundAt ? new Date(reading.expectedReaderFoundAt).getTime() : now.getTime() + 60000;
    const createdAt = reading.createdAt ? new Date(reading.createdAt).getTime() : now.getTime();
    const searchDelay = (expectedFoundAt - createdAt) * 0.5;
    const newFoundAt = new Date(now.getTime() + (isNaN(searchDelay) ? 30000 : searchDelay));
    
    transaction.update(readingRef, {
      priorityMode: true,
      expectedReaderFoundAt: newFoundAt.toISOString(),
      updatedAt: now.toISOString()
    });

    // Log Transaction
    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId: userId,
      type: 'spend',
      source: 'fortune_priority',
      amount: -priorityFee,
      balanceType: 'main',
      createdAt: now.toISOString(),
      status: 'spent',
      description: 'Öncelikli sıra yükseltmesi'
    });

    return { success: true };
  });
});

// 5. Generate Daily Message
export const generateDailyMessage = functions.runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
  const openai = getOpenAI();
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sen bilge bir kahinsin. Kullanıcılara günlük kısa, etkileyici ve mistik mesajlar veriyorsun." },
        { role: "user", content: "Günün falı için kısa, gizemli ve motive edici bir cümle yaz. Aşk, kariyer veya genel bir tavsiye olsun. Sadece cümleyi döndür. Maksimum 15 kelime." }
      ],
      temperature: 0.8,
      max_tokens: 100
    });

    const text = response.choices[0].message.content || "Yıldızlar bugün senin için parlıyor.";
    const categories: ('love' | 'career' | 'general')[] = ['love', 'career', 'general'];
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    return { text, category };
  } catch (error) {
    console.error("Daily message AI error:", error);
    return { text: "Yıldızlar bugün senin için parlıyor.", category: 'general' };
  }
});

// 4. Background Status Updater (Scheduled every minute)
export const updateReadingStatuses = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const now = new Date().toISOString();
  
  // 1. Searching -> Found
  const searchingReadings = await db.collection("readings")
    .where("status", "==", "searching")
    .where("expectedReaderFoundAt", "<=", now)
    .limit(50)
    .get();

  for (const doc of searchingReadings.docs) {
    const reading = doc.data();
    await doc.ref.update({ status: 'found', updatedAt: now });
    
    // Notify In-App
    await db.collection("notifications").add({
      userId: reading.userId,
      type: 'system',
      title: 'Yorumcu Bulundu!',
      message: `${reading.title} için yorumcunuz hazır, yorumlanmaya başlanıyor.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: { readingId: doc.id }
    });

    // Notify Push
    await sendPushToUser(reading.userId, {
      title: 'Yorumcu Bulundu!',
      body: `${reading.title} için yorumcunuz hazır, yorumlanmaya başlanıyor.`,
      data: { screen: 'fortune_detail', readingId: doc.id },
      category: 'fortunes'
    });
  }

  // 2. Found -> Interpreting
  const foundReadings = await db.collection("readings")
    .where("status", "==", "found")
    .where("interpretationStartedAt", "<=", now)
    .limit(50)
    .get();

  for (const doc of foundReadings.docs) {
    const reading = doc.data();
    await doc.ref.update({ status: 'interpreting', updatedAt: now });
    
    // Notify In-App
    await db.collection("notifications").add({
      userId: reading.userId,
      type: 'system',
      title: 'Falınız Yorumlanıyor',
      message: `${reading.title} yorumunuz LASYA tarafından hazırlanıyor.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: { readingId: doc.id }
    });

    // Notify Push
    await sendPushToUser(reading.userId, {
      title: 'Falınız Yorumlanıyor',
      body: `${reading.title} yorumunuz LASYA tarafından hazırlanıyor.`,
      data: { screen: 'fortune_detail', readingId: doc.id },
      category: 'fortunes'
    });
  }

    // 3. Interpreting -> Completed
    const interpretingReadings = await db.collection("readings")
      .where("status", "==", "interpreting")
      .where("expectedCompletedAt", "<=", now)
      .limit(50)
      .get();

    for (const doc of interpretingReadings.docs) {
      const reading = doc.data();
      
      // Only complete if AI has actually finished generating and we have a hidden result
      if (reading.isAIGenerated && reading.hiddenResult) {
        await doc.ref.update({ 
          status: 'completed', 
          content: reading.hiddenResult,
          resultText: reading.hiddenResult,
          updatedAt: now 
        });
        
        // Notify In-App
        await db.collection("notifications").add({
          userId: reading.userId,
          type: 'system',
          title: 'Falınız Hazır!',
          message: `${reading.title} yorumunuz tamamlandı. Hemen inceleyin!`,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          data: { readingId: doc.id }
        });

        // Notify Push
        await sendPushToUser(reading.userId, {
          title: 'Falınız Hazır!',
          body: `${reading.title} yorumunuz tamamlandı. Hemen inceleyin!`,
          data: { screen: 'fortune_detail', readingId: doc.id },
          category: 'fortunes'
        });
      }
    }

  return null;
});

/**
 * COMPATIBILITY REQUESTS PROCESSOR
 */

export const processCompatibilityRequests = functions.pubsub.schedule('every 2 minutes').onRun(async (context) => {
  const now = new Date().toISOString();
  
  const pendingRequests = await db.collection("compatibilityRequests")
    .where("status", "==", "pending")
    .where("readyAt", "<=", now)
    .limit(20)
    .get();

  if (pendingRequests.empty) return null;

  const economySnap = await db.collection("adminSettings").doc("economy").get();
  const economy = economySnap.exists ? economySnap.data() as any : {};
  const customPrompt = economy.manualCompatibilityPrompt || "Analyze compatibility between {person1_name} and {person2_name}. Relationship type: {relationshipType}.";
  const openai = getOpenAI();

  for (const requestDoc of pendingRequests.docs) {
    const request = requestDoc.data();
    const { userId, person1, person2, relationshipType, source, targetUserId, cacheKey } = request;

    try {
      // Prepare Placeholders
      const placeholders: Record<string, string> = {
        person1_name: person1.name,
        person1_birthDate: person1.birthDate || "Bilinmiyor",
        person1_status: person1.status || "Bilinmiyor",
        person2_name: person2.name,
        person2_birthDate: person2.birthDate || "Bilinmiyor",
        person2_status: person2.status || "Bilinmiyor",
        relationshipType: relationshipType
      };

      let finalPrompt = customPrompt;
      Object.entries(placeholders).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        finalPrompt = finalPrompt.replace(regex, value);
      });

      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sen uzman bir ilişki danışmanı ve astroloğusun. Yorumunu mistik ve etkileyici bir dille yap." },
          { role: "user", content: finalPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });

      const aiComment = response.choices[0].message.content || "";
      
      // Generate Analysis Scores
      const loveScore = Math.floor(Math.random() * 31) + 65; // 65-95
      const friendshipScore = Math.floor(Math.random() * 31) + 65;
      const energyScore = Math.floor(Math.random() * 31) + 65;
      
      const summaryShort = `${person1.name} ve ${person2.name} arasındaki uyum yıldızlar tarafından destekleniyor.`;
      
      const analysisData = {
        userId,
        source: source || 'manual',
        targetUserId: targetUserId || null,
        person1,
        person2,
        targetName: person2.name,
        targetPhoto: person2.photo,
        relationshipType,
        loveScore,
        friendshipScore,
        energyScore,
        summaryShort,
        summaryLong: aiComment,
        aiComment,
        createdAt: new Date().toISOString(),
        cacheKey: cacheKey || null
      };
      
      const batch = db.batch();
      
      // Update request status
      batch.update(requestDoc.ref, { status: 'completed', updatedAt: now });
      
      // Add to history
      const historyRef = db.collection("compatibilityHistory").doc();
      batch.set(historyRef, { 
        id: historyRef.id, 
        requestId: requestDoc.id,
        ...analysisData 
      });
      
      // Notify user In-App
      const notifRef = db.collection("notifications").doc();
      batch.set(notifRef, {
        userId,
        type: 'system',
        title: 'Uyum Analiziniz Hazır!',
        message: `${person1.name} ve ${person2.name} arasındaki analiz tamamlandı.`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: { screen: 'compatibility_history' }
      });

      await batch.commit();

      // Notify Push
      await sendPushToUser(userId, {
        title: 'Uyum Analiziniz Hazır!',
        body: `${person1.name} ve ${person2.name} arasındaki analiz tamamlandı.`,
        data: { screen: 'compatibility_history' },
        category: 'compatibility'
      });

    } catch (error) {
      console.error(`Error processing compatibility request ${requestDoc.id}:`, error);
      await requestDoc.ref.update({ status: 'error', error: String(error), updatedAt: now });
    }
  }
  return null;
});

/**
 * NOTIFICATION TRIGGERS
 */

// 1. Message Trigger
export const onMessageCreate = functions.firestore
  .document('messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    if (message.senderId === 'system') return;

    const receiverId = message.receiverId;
    if (!receiverId) return;

    await sendPushToUser(receiverId, {
      title: 'Yeni Mesaj!',
      body: message.text || 'Bir medya gönderildi.',
      data: { screen: 'chat', chatId: message.chatId },
      category: 'messages',
      senderId: message.senderId
    });
  });

// 2. Swipe Trigger (Like / Super Like)
export const onSwipeWrite = functions.firestore
  .document('swipes/{swipeId}')
  .onWrite(async (change, context) => {
    const after = change.after.data();
    const before = change.before.data();

    if (!after || after.type === 'pass') return;

    // Only send push if it's a new swipe or type changed to like/super_like
    if (before && before.type === after.type) return;

    const fromUserId = after.fromUserId;
    const toUserId = after.toUserId;

    const fromUserSnap = await db.collection("users").doc(fromUserId).get();
    const fromUserName = fromUserSnap.exists ? (fromUserSnap.data()?.social?.nickname || fromUserSnap.data()?.displayName || 'Biri') : 'Biri';

    const title = after.type === 'super_like' ? 'Yeni Süper Like!' : 'Yeni Beğeni!';
    const body = `${fromUserName} seni beğendi! ❤️`;

    await sendPushToUser(toUserId, {
      title,
      body,
      data: { screen: 'likers', fromUserId },
      category: 'likes',
      senderId: fromUserId
    });
  });

// 3. Interaction Request Trigger
export const onInteractionRequestCreate = functions.firestore
  .document('interactionRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();
    if (request.status !== 'pending') return;

    const fromUserId = request.fromUserId;
    const toUserId = request.toUserId;
    const fromUserName = request.senderSnapshot?.nickname || 'Biri';

    await sendPushToUser(toUserId, {
      title: 'Yeni Mesaj İsteği',
      body: `${fromUserName} sana bir mesaj isteği gönderdi.`,
      data: { screen: 'requests', fromUserId },
      category: 'messages',
      senderId: fromUserId
    });
  });

// 4. User Update Trigger (Verification)
export const onUserUpdate = functions.firestore
  .document('users/{userId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Verification Status Change
    if (before.isVerified !== after.isVerified) {
      const title = after.isVerified ? 'Hesabınız Doğrulandı!' : 'Doğrulama Durumu Güncellendi';
      const body = after.isVerified 
        ? 'Tebrikler! Hesabınız başarıyla doğrulandı. Artık tüm özelliklere erişebilirsiniz.' 
        : 'Hesabınızın doğrulama durumu değişti. Lütfen profilinizi kontrol edin.';

      await sendPushToUser(context.params.userId, {
        title,
        body,
        data: { screen: 'profile' },
        category: 'system'
      });
    }
  });

/**
 * ADMIN NOTIFICATION FUNCTIONS
 */

export const adminBroadcastNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  // Check if admin
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  if (adminSnap.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Bu işlem için yetkiniz yok.');
  }

  const { title, body, screen, data: extraData } = data;
  if (!title || !body) throw new functions.https.HttpsError('invalid-argument', 'Başlık ve mesaj zorunludur.');

  // Fetch all users with FCM tokens
  // Note: In a real app with millions of users, this should be a background task with batching
  const usersSnap = await db.collection("users").where("fcmToken", "!=", null).get();
  
  console.log(`Broadcasting to ${usersSnap.size} users...`);

  const results = {
    successCount: 0,
    failureCount: 0
  };

  // Batch send (FCM supports up to 500 per call, but we'll use our helper for simplicity/token cleanup)
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
});

/**
 * RETENTION REMINDERS (Scheduled)
 */

export const checkDailyReminders = functions.pubsub.schedule('every 4 hours').onRun(async (context) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // 1. Daily Energy Reminder
  const energyUsers = await db.collection("users")
    .where("energy", "<", 50)
    .limit(100)
    .get();

  for (const userDoc of energyUsers.docs) {
    const user = userDoc.data();
    const lastReminder = user.lastDailyEnergyReminderAt || "";
    if (lastReminder !== today) {
      await sendPushToUser(userDoc.id, {
        title: 'Enerjin Doldu!',
        body: 'Günlük ücretsiz enerjin seni bekliyor. Hemen gel ve falına baktır! ✨',
        data: { screen: 'wallet' },
        category: 'reminders'
      });
      await userDoc.ref.update({ lastDailyEnergyReminderAt: today });
    }
  }

  // 2. Free Reading Reminder
  // (Logic for checking if 24h passed since last free reading)
  
  return null;
});

/**
 * PRODUCTION WALLET FUNCTIONS
 */

// 1. Watch Ad Reward
export const watchAdReward = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  
  // HARDENING: Fetch config from Firestore, don't trust client
  const configSnap = await db.collection("adminSettings").doc("economy").get();
  if (!configSnap.exists) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
  const economy = configSnap.data() as any;
  const adRewardEnergy = economy.rewards?.adRewardEnergy || 10;
  const maxDailyAds = economy.rewards?.maxDailyAds || 5;
  const adRewardExpiryDays = economy.rewards?.adRewardExpiryDays || 7;
  
  const userRef = db.collection("users").doc(userId);
  
  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
    
    const userData = userSnap.data() as any;
    const today = new Date().toISOString().split('T')[0];
    const lastReset = userData.lastAdReset ? userData.lastAdReset.split('T')[0] : "";
    
    let dailyCount = userData.dailyAdWatchCount || 0;
    if (today !== lastReset) dailyCount = 0;

    if (dailyCount >= maxDailyAds) {
      throw new functions.https.HttpsError('failed-precondition', 'Günlük reklam sınırı aşıldı.');
    }

    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(now.getDate() + adRewardExpiryDays);

    transaction.update(userRef, {
      energy: FieldValue.increment(adRewardEnergy),
      dailyAdWatchCount: dailyCount + 1,
      lastAdReset: now.toISOString()
    });

    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: 'earn',
      source: 'ad',
      amount: adRewardEnergy,
      balanceType: 'energy',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      remainingAmount: adRewardEnergy,
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
    if (balanceType === 'main') updates.mainCoins = FieldValue.increment(amount);
    else updates.energy = FieldValue.increment(amount);
    
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
  const { type } = data;
  
  // HARDENING: Fetch config from Firestore
  const configSnap = await db.collection("adminSettings").doc("economy").get();
  if (!configSnap.exists) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
  const economy = configSnap.data() as any;
  const subConfig = economy.fortuneSubscriptions[type];
  if (!subConfig) throw new functions.https.HttpsError('invalid-argument', 'Geçersiz abonelik tipi.');

  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  let expiresAt = new Date();
  
  if (type === 'daily') expiresAt.setDate(now.getDate() + 1);
  else if (type === 'weekly') expiresAt.setDate(now.getDate() + 7);
  else if (type === 'monthly') expiresAt.setDate(now.getDate() + 30);

  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;

    // Check Balance
    const price = subConfig.priceTRY || subConfig.price;
    if ((userData.mainCoins || 0) < price) {
      throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
    }

    // Check for active subscription
    if (userData.subscription && userData.subscription.status === 'active') {
      const currentExpires = new Date(userData.subscription.expiresAt);
      if (currentExpires > now) {
        throw new functions.https.HttpsError('failed-precondition', 'Zaten aktif bir fal aboneliğiniz var.');
      }
    }

    transaction.update(userRef, {
      mainCoins: FieldValue.increment(-price),
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
      type: 'spend',
      source: 'subscription',
      amount: -price,
      balanceType: 'main',
      createdAt: now.toISOString(),
      status: 'spent',
      description: `Fal Aboneliği (${type})`
    });

    return { success: true };
  });
});

// 5. Purchase Boost Package (TL-based)
export const purchaseBoostPackage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type } = data; // 'weekly' or 'monthly'
  
  // HARDENING: Fetch config from Firestore
  const configSnap = await db.collection("adminSettings").doc("economy").get();
  if (!configSnap.exists) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
  const economy = configSnap.data() as any;
  
  // Boost packages are defined in economy.boostPackages or similar
  const boostConfig = economy.boostPackages?.[type] || (type === 'weekly' ? { days: 7, priceTRY: 49.99 } : { days: 30, priceTRY: 149.99 });

  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  
  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;

    const currentBoost = userData.boostExpiresAt ? new Date(userData.boostExpiresAt) : new Date();
    const baseDate = currentBoost > now ? currentBoost : now;
    baseDate.setDate(baseDate.getDate() + boostConfig.days);

    transaction.update(userRef, {
      boostExpiresAt: baseDate.toISOString()
    });

    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: 'purchase',
      source: 'boost',
      amount: boostConfig.priceTRY,
      balanceType: 'fiat',
      createdAt: now.toISOString(),
      status: 'active',
      description: `Boost Paketi (${type})`
    });

    return { success: true, boostExpiresAt: baseDate.toISOString() };
  });
});

// 6. Purchase Social Item
export const purchaseSocialItem = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type, description, quantity } = data;

  console.log(`[purchaseSocialItem] User: ${userId}, Type: ${type}, Qty: ${quantity}`);

  try {
    // 1. Fetch config
    const configSnap = await db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists) throw new Error("CONFIG_NOT_FOUND");
    const economy = configSnap.data() as any;
    
    // 2. Determine Price (Try to find matching package, fallback to unit price)
    const priceKey = type === 'superLike' ? 'superLike' : type === 'refresh' ? 'refresh' : 'compatibility';
    if (!economy.socialPricing || !economy.socialPricing[priceKey]) throw new Error("INVALID_ITEM");
    
    const pricingArray = economy.socialPricing[priceKey] || [];
    const qty = Math.max(1, parseInt(quantity) || 1);
    
    const matchingPkg = pricingArray.find((p: any) => p.count === qty);
    let totalPrice: number;
    
    if (matchingPkg) {
      totalPrice = matchingPkg.priceCoins;
    } else {
      const unitPrice = pricingArray[0]?.priceCoins || 20;
      totalPrice = unitPrice * qty;
    }

    console.log(`[purchaseSocialItem] Qty: ${qty}, TotalPrice: ${totalPrice} (Matched: ${!!matchingPkg})`);

    // 3. Run Transaction
    const userRef = db.collection("users").doc(userId);
    const result = await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("USER_NOT_FOUND");
      const userData = userSnap.data() as any;
      
      if ((userData.mainCoins || 0) < totalPrice) {
        return { success: false, status: 'INSUFFICIENT_FUNDS' };
      }

      const updates: any = {
        mainCoins: FieldValue.increment(-totalPrice)
      };
      
      if (type === 'superLike') updates.superLikes = FieldValue.increment(qty);
      else if (type === 'refresh') updates.refreshCount = FieldValue.increment(qty);
      else if (type === 'compatibility') updates.compatibilityCount = FieldValue.increment(qty);
      else return { success: false, status: 'INVALID_ITEM' };
      
      transaction.update(userRef, updates);

      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'spend',
        source: 'social_action',
        amount: -totalPrice,
        balanceType: 'main',
        createdAt: new Date().toISOString(),
        status: 'spent',
        description: `${description || type} (${qty} adet) satın alımı`
      });

      return { success: true, status: 'SUCCESS' };
    });

    return result;
  } catch (error: any) {
    console.error("[purchaseSocialItem] Error:", error);
    if (error.message === "CONFIG_NOT_FOUND") return { success: false, status: 'ERROR', message: 'Sistem yapılandırması bulunamadı.' };
    if (error.message === "INVALID_ITEM") return { success: false, status: 'INVALID_ITEM' };
    if (error.message === "USER_NOT_FOUND") return { success: false, status: 'ERROR', message: 'Kullanıcı bulunamadı.' };
    
    return { success: false, status: 'ERROR', message: error.message };
  }
});

// 12. Purchase Social Bundle
export const purchaseSocialBundle = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { bundleId } = data;

  // HARDENING: Fetch config from Firestore
  const configSnap = await db.collection("adminSettings").doc("economy").get();
  if (!configSnap.exists) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
  const economy = configSnap.data() as any;
  
  // Find bundle in config (assuming it's in economy.socialBundles or similar)
  // For now we use the default bundles if not found in DB
  const bundles = economy.socialBundles || [
    {
      id: "starter_bundle",
      name: "Başlangıç Paketi",
      price: 150,
      contents: { superLikes: 5, refreshes: 5, compatibility: 5, boostDays: 7 }
    }
  ];
  
  const bundle = bundles.find((b: any) => b.id === bundleId);
  if (!bundle) throw new functions.https.HttpsError('not-found', 'Paket bulunamadı.');

  const userRef = db.collection("users").doc(userId);
  
  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;
    
    if ((userData.mainCoins || 0) < bundle.price) throw new Error("Yetersiz bakiye.");

    const now = new Date();

    transaction.update(userRef, {
      mainCoins: FieldValue.increment(-bundle.price),
      superLikes: FieldValue.increment(bundle.contents.superLikes),
      refreshCount: FieldValue.increment(bundle.contents.refreshes),
      compatibilityCount: FieldValue.increment(bundle.contents.compatibility)
    });

    const txRef = db.collection("walletTransactions").doc();
    transaction.set(txRef, {
      id: txRef.id,
      userId,
      type: 'spend',
      source: 'social_action',
      amount: -bundle.price,
      balanceType: 'main',
      createdAt: now.toISOString(),
      status: 'spent',
      description: `${bundle.name} satın alımı`
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
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;
      
      let consumedFrom = 'paid';
      
      if (type === 'swipe') {
        const dailyUsed = userData.dailySwipeUsed || 0;
        const lastDate = userData.dailySwipeDate || "";
        
        // Determine Limit
        let maxSwipes = 15; // Default Free
        const sub = userData.subscription;
        if (sub && sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt) > now) {
          if (sub.type === 'daily') maxSwipes = 100;
          else if (sub.type === 'weekly') maxSwipes = 150;
          else if (sub.type === 'monthly') maxSwipes = 200;
        }

        if (lastDate !== today) {
          transaction.update(userRef, { 
            dailySwipeUsed: 1, 
            dailySwipeDate: today,
            dailyFreeSuperLikeUsed: false,
            dailyFreeRefreshUsed: false
          });
        } else {
          if (dailyUsed >= maxSwipes) throw new functions.https.HttpsError('resource-exhausted', `Günlük kaydırma sınırına ulaştınız (${maxSwipes} hak).`);
          transaction.update(userRef, { dailySwipeUsed: FieldValue.increment(1) });
        }
      } else {
        const field = type === 'superLike' ? 'superLikes' : type === 'refresh' ? 'refreshCount' : 'compatibilityCount';
        if ((userData[field] || 0) <= 0) throw new functions.https.HttpsError('failed-precondition', "Yetersiz hak.");
        
        transaction.update(userRef, { [field]: FieldValue.increment(-1) });
      }

      // 3. Log Usage (Usage Log)
      const logRef = db.collection("usageLogs").doc();
      transaction.set(logRef, {
        id: logRef.id,
        userId,
        type: 'social_feature',
        feature: type,
        consumedFrom,
        createdAt: now.toISOString()
      });

      return { success: true, consumedFrom };
    });
  } catch (error: any) {
    console.error("consumeSocialFeature error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında bir hata oluştu.');
  }
});

// 13. Update Social Settings (Secure)
export const updateSocialSettings = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { settings } = data;

  if (!settings) throw new functions.https.HttpsError('invalid-argument', 'Ayarlar gerekli.');

  const userRef = db.collection("users").doc(userId);
  
  // Only allow specific fields to be updated via this function
  const allowedFields = [
    'visibility', 'discoveryEnabled', 'notificationsEnabled', 
    'genderPreference', 'minAge', 'maxAge',
    'whoCanMessage', 'whoCanAddFriend', 'notifications',
    'enabled', 'visible'
  ];
  const updates: any = {};
  
  Object.keys(settings).forEach(key => {
    if (allowedFields.includes(key)) {
      if (key === 'enabled' || key === 'visible') {
        updates[`social.${key}`] = settings[key];
      } else {
        updates[`social.settings.${key}`] = settings[key];
      }
    }
  });

  if (Object.keys(updates).length === 0) return { success: true };

  await userRef.update(updates);
  return { success: true };
});

// 14. Refresh Discover (Consumes and Updates Timestamp)
export const refreshDiscover = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;

  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  const nowIso = now.toISOString();

  console.log(`[refreshDiscover] Starting for user: ${userId}`);

  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;

      const lastFreeRefreshAt = userData.social?.lastFreeRefreshAt;
      const isFreeAvailable = !lastFreeRefreshAt || (now.getTime() - new Date(lastFreeRefreshAt).getTime() >= 24 * 60 * 60 * 1000);
      
      let status = 'SUCCESS';
      let updates: any = {
        "social.lastDiscoverRefreshAt": nowIso
      };

      if (isFreeAvailable) {
        status = 'FREE_REFRESH_USED';
        updates["social.lastFreeRefreshAt"] = nowIso;
      } else {
        if ((userData.refreshCount || 0) <= 0) {
          return { success: false, status: 'INSUFFICIENT_FUNDS' };
        }
        status = 'PAID_REFRESH_USED';
        updates["refreshCount"] = FieldValue.increment(-1);
      }

      transaction.update(userRef, updates);

      // Log Usage
      const logRef = db.collection("usageLogs").doc();
      transaction.set(logRef, {
        id: logRef.id,
        userId,
        type: 'social_feature',
        feature: 'refresh',
        status,
        createdAt: nowIso
      });

      return { success: true, status, lastRefreshAt: nowIso };
    });
  } catch (error: any) {
    console.error("[refreshDiscover] Error:", error);
    return { success: false, status: 'ERROR', message: error.message };
  }
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
      .orderBy("createdAt", "desc")
      .limit(500) // Increased limit for better history view. Consider pagination for production.
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

// 12. Redeem Promo Code
export const redeemPromoCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { code } = data;
  
  if (!code || typeof code !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Geçersiz kod.');
  }

  const normalizedCode = code.trim().toUpperCase();
  const now = new Date().toISOString();
  
  try {
    // 1. Find Promo Code (Outside transaction for query)
    const promoSnap = await db.collection("promoCodes")
      .where("code", "==", normalizedCode)
      .limit(1)
      .get();
    
    if (promoSnap.empty) {
      throw new functions.https.HttpsError('not-found', 'Geçersiz veya hatalı kod.');
    }

    const promoDoc = promoSnap.docs[0];
    const promo = promoDoc.data() as any;

    return await db.runTransaction(async (transaction) => {
      // 2. Basic Validations
      if (!promo.isActive) {
        throw new functions.https.HttpsError('failed-precondition', 'Bu kod artık aktif değil.');
      }

      if (promo.startsAt && now < promo.startsAt) {
        throw new functions.https.HttpsError('failed-precondition', 'Bu kampanya henüz başlamadı.');
      }

      if (promo.expiresAt && now > promo.expiresAt) {
        throw new functions.https.HttpsError('failed-precondition', 'Bu kodun süresi dolmuş.');
      }

      if (promo.currentUses >= promo.maxTotalUses) {
        throw new functions.https.HttpsError('failed-precondition', 'Bu kodun kullanım sınırı dolmuş.');
      }

      // 3. User Specific Validations
      const userRef = db.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
      const userData = userSnap.data() as any;

      if (promo.onlyNewUsers) {
        const createdAt = userData.createdAt ? new Date(userData.createdAt).getTime() : 0;
        const isNew = (Date.now() - createdAt) < (24 * 60 * 60 * 1000);
        if (!isNew) {
          throw new functions.https.HttpsError('failed-precondition', 'Bu kod sadece yeni kullanıcılar içindir.');
        }
      }

      // 4. Check if user already used this code
      const redemptionId = `${userId}_${promoDoc.id}`;
      const redemptionRef = db.collection("promoCodeRedemptions").doc(redemptionId);
      const redemptionSnap = await transaction.get(redemptionRef);
      
      if (redemptionSnap.exists) {
        throw new functions.https.HttpsError('already-exists', 'Bu kodu zaten kullandınız.');
      }

      // 5. Apply Rewards
      const rewards = promo.rewards;
      const userUpdates: any = {};
      const grantedRewards: any = {};

      if (rewards.energy) {
        userUpdates.energy = FieldValue.increment(rewards.energy);
        grantedRewards.energy = rewards.energy;
      }

      if (rewards.mainCoins) {
        userUpdates.mainCoins = FieldValue.increment(rewards.mainCoins);
        grantedRewards.mainCoins = rewards.mainCoins;
      }

      if (rewards.fortuneSubscription) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (rewards.fortuneSubscription === 'monthly' ? 30 : rewards.fortuneSubscription === 'weekly' ? 7 : 1));
        userUpdates.subscription = {
          status: 'active',
          type: rewards.fortuneSubscription,
          expiresAt: expiresAt.toISOString(),
          dailyLimit: 10,
          dailyLimitUsed: 0,
          lastResetAt: now.split('T')[0]
        };
        grantedRewards.fortuneSubscription = rewards.fortuneSubscription;
      }

      if (rewards.socialSubscription) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (rewards.socialSubscription === 'monthly' ? 30 : 7));
        userUpdates.socialSubscription = {
          status: 'active',
          type: rewards.socialSubscription,
          expiresAt: expiresAt.toISOString(),
          dailyUsage: { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: now.split('T')[0] }
        };
        grantedRewards.socialSubscription = rewards.socialSubscription;
      }

      if (rewards.socialFeatures) {
        if (rewards.socialFeatures.superLike) {
          userUpdates.superLikes = FieldValue.increment(rewards.socialFeatures.superLike);
          grantedRewards.superLike = rewards.socialFeatures.superLike;
        }
        if (rewards.socialFeatures.refresh) {
          userUpdates.refreshCount = FieldValue.increment(rewards.socialFeatures.refresh);
          grantedRewards.refresh = rewards.socialFeatures.refresh;
        }
        if (rewards.socialFeatures.analysis) {
          userUpdates.compatibilityCount = FieldValue.increment(rewards.socialFeatures.analysis);
          grantedRewards.analysis = rewards.socialFeatures.analysis;
        }
        if (rewards.socialFeatures.boostDays) {
          const currentBoost = userData.boostExpiresAt ? new Date(userData.boostExpiresAt) : new Date();
          const baseDate = currentBoost > new Date() ? currentBoost : new Date();
          baseDate.setDate(baseDate.getDate() + rewards.socialFeatures.boostDays);
          userUpdates.boostExpiresAt = baseDate.toISOString();
          grantedRewards.boostDays = rewards.socialFeatures.boostDays;
        }
      }

      // 6. Execute Updates
      transaction.update(userRef, userUpdates);
      transaction.update(promoDoc.ref, { currentUses: FieldValue.increment(1) });
      
      // Log Redemption
      transaction.set(redemptionRef, {
        id: redemptionId,
        promoCodeId: promoDoc.id,
        code: normalizedCode,
        userId,
        redeemedAt: now,
        rewardsGranted: grantedRewards,
        status: 'success'
      });

      // Log Wallet Transaction for coins/energy
      if (grantedRewards.mainCoins || grantedRewards.energy) {
        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'earn',
          source: 'promo_code',
          amount: grantedRewards.mainCoins || grantedRewards.energy,
          balanceType: grantedRewards.mainCoins ? 'main' : 'energy',
          createdAt: now,
          status: 'active',
          description: `Promosyon kodu kullanıldı: ${normalizedCode}`
        });
      }

      return { success: true, rewards: grantedRewards };
    });
  } catch (error: any) {
    console.error("redeemPromoCode error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Kod kullanılırken bir hata oluştu.');
  }
});

// 13. Admin Set Wallet (Direct Set)
export const adminSetWallet = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const adminSnap = await db.collection("users").doc(context.auth.uid).get();
  const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                  (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
  
  if (!isAdmin) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');

  const { targetUserId, updates } = data;
  if (!targetUserId || !updates) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

  const userRef = db.collection("users").doc(targetUserId);
  
  // Sanitize updates to only allow wallet fields
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

// 14. Admin Adjust Wallet (Relative Change)
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

// 14.1 Admin Update User
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

// 14.2 Admin Update Config
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

// 14.3 Admin Update Report
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

// 14.4 Admin Manage Promo Code
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

// 15. Complete Social Onboarding
export const completeSocialOnboarding = functions.https.onCall(async (data, context) => {
  console.log("completeSocialOnboarding called");
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Bu işlemi yapmak için giriş yapmalısınız.');
  }
  
  const userId = context.auth.uid;
  const { 
    nickname, 
    gender, 
    lookingFor, 
    birthDate, 
    interests, 
    photos, 
    bio,
    zodiacSign,
    element,
    rulingPlanet,
    planet, // fallback
    friendlySign,
    enemySign,
    age,
    mysticAnimal,
    luckyNumber,
    luckyColor
  } = data;

  // Basic validation
  if (!nickname || !gender || !lookingFor || !birthDate || !interests || !photos || !bio) {
    throw new functions.https.HttpsError('invalid-argument', 'Lütfen tüm zorunlu alanları doldurun.');
  }

  const userRef = db.collection("users").doc(userId);
  const now = new Date().toISOString();

  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      
      const socialData = {
        nickname,
        gender,
        lookingFor,
        interests,
        photos,
        bio,
        enabled: true,
        profileCompleted: true,
        visible: true,
        banned: false,
        lastOnboardingAt: now,
        updatedAt: now,
        settings: {
          whoCanMessage: 'everyone',
          whoCanAddFriend: 'everyone',
          notifications: {
            messages: true,
            friendRequests: true,
            roomInvites: true,
            gifts: true
          }
        }
      };

      const baseData: any = {
        // Root level fields for compatibility
        nickname,
        gender,
        lookingFor,
        interests,
        photos,
        bio,
        birthDate,
        zodiacSign: zodiacSign || "",
        element: element || "",
        rulingPlanet: rulingPlanet || planet || "",
        friendlySign: friendlySign || "",
        enemySign: enemySign || "",
        age: age || 0,
        mysticAnimal: mysticAnimal || "",
        luckyNumber: luckyNumber || "",
        luckyColor: luckyColor || "",
        updatedAt: now,
        social: socialData
      };

      if (!userSnap.exists) {
        baseData.createdAt = now;
        baseData.uid = userId;
        baseData.email = context.auth?.token.email || "";
        baseData.displayName = nickname;
        baseData.photoURL = photos[0] || "";
        baseData.energy = 50; // Welcome energy
        baseData.mainCoins = 0;
        baseData.superLikes = 0;
        baseData.refreshCount = 0;
        baseData.compatibilityCount = 0;
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

/**
 * SOCIAL MODULE REAL SYSTEM FUNCTIONS
 */

// 16. Send Super Like and Create Chat
export const sendSuperLikeAndCreateChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { targetUserId } = data;
  if (!targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı gerekli.');

  const userRef = db.collection("users").doc(userId);
  const targetUserRef = db.collection("users").doc(targetUserId);

  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const targetSnap = await transaction.get(targetUserRef);

      if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
      if (!targetSnap.exists) throw new Error("Hedef kullanıcı bulunamadı.");

      const userData = userSnap.data() as any;
      const targetData = targetSnap.data() as any;
      const now = new Date().toISOString();
      const today = now.split('T')[0];
      const lastReset = userData.dailySwipeDate || "";

      let consumedFrom = 'paid';
      const sub = userData.subscription;
      const isPremium = sub && sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt) > new Date(now);

      // Check for Free Daily Bonus
      if (isPremium && lastReset === today && !userData.dailyFreeSuperLikeUsed) {
        consumedFrom = 'daily_bonus';
        transaction.update(userRef, { dailyFreeSuperLikeUsed: true });
      } else {
        if ((userData.superLikes || 0) <= 0) {
          throw new Error("Yetersiz Süper Like hakkı.");
        }
        // 1. Deduct Super Like
        transaction.update(userRef, { superLikes: FieldValue.increment(-1) });
      }

      // 2. Check for existing chat
      const chatsQuery = await db.collection("chats")
        .where("participants", "array-contains", userId)
        .get();
      
      const existingChat = chatsQuery.docs.find(doc => doc.data().participants.includes(targetUserId));

      let chatId: string;

      if (existingChat) {
        chatId = existingChat.id;
        // Update existing chat metadata if needed, but usually we just redirect
      } else {
        // 3. Create new chat
        const chatRef = db.collection("chats").doc();
        chatId = chatRef.id;
        
        transaction.set(chatRef, {
          id: chatId,
          participants: [userId, targetUserId],
          participantSnapshots: {
            [userId]: {
              nickname: userData.social?.nickname || userData.displayName || "Gezgin",
              photo: userData.social?.photos?.[0] || userData.photoURL || ""
            },
            [targetUserId]: {
              nickname: targetData.social?.nickname || targetData.displayName || "Gezgin",
              photo: targetData.social?.photos?.[0] || targetData.photoURL || ""
            }
          },
          createdAt: now,
          lastMessage: "Bu sohbet süper like ile başladı.",
          lastMessageAt: FieldValue.serverTimestamp(),
          lastMessageSenderId: "system",
          unreadCount: { [targetUserId]: 1, [userId]: 0 },
          status: 'active',
          startedBy: "super_like",
          startedAt: now,
          starterUserId: userId
        });

        // 4. Add system message
        const messageRef = db.collection("messages").doc();
        transaction.set(messageRef, {
          id: messageRef.id,
          chatId: chatId,
          senderId: "system",
          text: "Bu sohbet süper like ile başladı.",
          type: "system",
          createdAt: now,
          status: "sent",
          participants: [userId, targetUserId]
        });
      }

      // 5. Log Usage
      const logRef = db.collection("usageLogs").doc();
      transaction.set(logRef, {
        id: logRef.id,
        userId,
        type: 'social_feature',
        feature: 'super_like',
        targetUserId,
        chatId,
        createdAt: now
      });

      return { success: true, chatId };
    });
  } catch (error: any) {
    console.error("sendSuperLikeAndCreateChat error:", error);
    throw new functions.https.HttpsError('internal', error.message || 'Süper Like gönderilirken hata oluştu.');
  }
});

// 17. Refresh Discover Feed
export const refreshDiscoverFeed = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  const nowIso = now.toISOString();
  
  console.log(`[refreshDiscoverFeed] Starting for user: ${userId}`);

  try {
    // 1. Fetch user data first to determine target gender and recent IDs
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;

    const gender = userData.social?.gender || userData.gender || "";
    const targetGender = gender === 'erkek' ? 'kadın' : gender === 'kadın' ? 'erkek' : "";
    const recentIds = userData.social?.recentDiscoverIds || [];

    // 1.1 Fetch Swipes to exclude
    const swipesSnap = await db.collection("swipes").where("fromUserId", "==", userId).get();
    const swipedUserIds = swipesSnap.docs.map(d => d.data().toUserId);
    const exclusionList = new Set([userId, ...recentIds, ...swipedUserIds]);

    console.log(`[refreshDiscoverFeed] User gender: ${gender}, Target: ${targetGender}, Swiped count: ${swipedUserIds.length}`);

    // 2. Query for potential users (outside transaction)
    let usersQuery = db.collection("users")
      .where("social.enabled", "==", true)
      .where("social.visible", "==", true);
    
    if (targetGender) {
      usersQuery = usersQuery.where("social.gender", "==", targetGender);
    }

    const usersSnap = await usersQuery.limit(100).get();
    console.log(`[refreshDiscoverFeed] Found ${usersSnap.size} potential users`);

    // 3. Run Transaction for balance and recent IDs update
    const result = await db.runTransaction(async (transaction) => {
      const tUserSnap = await transaction.get(userRef);
      if (!tUserSnap.exists) throw new Error("Kullanıcı bulunamadı.");
      const tUserData = tUserSnap.data() as any;

      const lastFreeRefreshAt = tUserData.social?.lastFreeRefreshAt;
      const isFreeAvailable = !lastFreeRefreshAt || (now.getTime() - new Date(lastFreeRefreshAt).getTime() >= 24 * 60 * 60 * 1000);
      
      let status = 'SUCCESS';
      let updates: any = {
        "social.lastDiscoverRefreshAt": nowIso
      };

      if (isFreeAvailable) {
        status = 'FREE_REFRESH_USED';
        updates["social.lastFreeRefreshAt"] = nowIso;
      } else {
        if ((tUserData.refreshCount || 0) <= 0) {
          return { success: false, status: 'INSUFFICIENT_FUNDS' };
        }
        status = 'PAID_REFRESH_USED';
        updates["refreshCount"] = FieldValue.increment(-1);
      }

      // Filter users
      let availableUsers = usersSnap.docs
        .filter(doc => !exclusionList.has(doc.id))
        .map(doc => ({ id: doc.id, ...doc.data() }));
        
      if (availableUsers.length < 10) {
        // If too few, allow some recent ones but still exclude self and swiped
        const absoluteExclusion = new Set([userId, ...swipedUserIds]);
        availableUsers = usersSnap.docs
          .filter(doc => !absoluteExclusion.has(doc.id))
          .map(doc => ({ id: doc.id, ...doc.data() }));
      }
      
      availableUsers = availableUsers.sort(() => Math.random() - 0.5).slice(0, 20);
      const newRecentIds = Array.from(new Set([...recentIds, ...availableUsers.map(u => u.id)])).slice(-100);
      
      updates["social.recentDiscoverIds"] = newRecentIds;
      
      transaction.update(userRef, updates);

      // Log Usage
      const logRef = db.collection("usageLogs").doc();
      transaction.set(logRef, {
        id: logRef.id,
        userId,
        type: 'social_feature',
        feature: 'refresh_discover',
        status,
        createdAt: nowIso
      });

      return { success: true, status, users: availableUsers };
    });

    return result;
  } catch (error: any) {
    console.error("[refreshDiscoverFeed] Error:", error);
    return { success: false, status: 'ERROR', message: error.message };
  }
});

// 18. Run Discover Compatibility Analysis (Delayed Processing)
export const runDiscoverCompatibilityAnalysis = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { targetUserId, relationshipType } = data;
  
  if (!targetUserId || !relationshipType) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
  
  const cacheKey = `${userId}_${targetUserId}_${relationshipType}`;
  const historySnap = await db.collection("compatibilityHistory")
    .where("cacheKey", "==", cacheKey)
    .limit(1)
    .get();
  
  if (!historySnap.empty) {
    return { success: true, analysis: historySnap.docs[0].data(), cached: true };
  }
  
  const userRef = db.collection("users").doc(userId);
  const targetUserRef = db.collection("users").doc(targetUserId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const targetSnap = await transaction.get(targetUserRef);
      
      if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', "Kullanıcı profiliniz bulunamadı.");
      }
      if (!targetSnap.exists) {
        throw new functions.https.HttpsError('not-found', "Hedef kullanıcı bulunamadı.");
      }
      
      const userData = userSnap.data() as any;
      const targetData = targetSnap.data() as any;
      
      if ((userData.compatibilityCount || 0) <= 0) {
        throw new functions.https.HttpsError('failed-precondition', "Yetersiz uyum analizi hakkı. Lütfen cüzdanınızdan hak satın alın.");
      }
      
      transaction.update(userRef, { compatibilityCount: FieldValue.increment(-1) });
      
      const now = new Date();
      const readyAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes later

      const requestRef = db.collection("compatibilityRequests").doc();
      const requestData = {
        id: requestRef.id,
        userId,
        source: 'discover',
        targetUserId,
        relationshipType,
        status: 'pending',
        createdAt: now.toISOString(),
        readyAt: readyAt.toISOString(),
        cacheKey,
        // Pre-fetch names/photos for the processor
        person1: {
          name: userData.social?.nickname || userData.displayName || "Sen",
          photo: userData.social?.photos?.[0] || userData.photoURL || "",
          birthDate: userData.social?.birthDate || "",
          status: userData.social?.relationshipStatus || "Bilinmiyor"
        },
        person2: {
          name: targetData.social?.nickname || targetData.displayName || "Gezgin",
          photo: targetData.social?.photos?.[0] || targetData.photoURL || "",
          birthDate: targetData.social?.birthDate || "",
          status: targetData.social?.relationshipStatus || "Bilinmiyor"
        }
      };

      transaction.set(requestRef, requestData);
      
      const logRef = db.collection("usageLogs").doc();
      transaction.set(logRef, {
        id: logRef.id,
        userId,
        type: 'social_feature',
        feature: 'compatibility_analysis_request',
        targetUserId,
        relationshipType,
        createdAt: now.toISOString()
      });
      
      return { success: true, requestId: requestRef.id, readyAt: readyAt.toISOString(), cached: false };
    });
  } catch (error: any) {
    console.error("runDiscoverCompatibilityAnalysis error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
  }
});

// 19. Run Manual Compatibility Analysis (Delayed Processing)
export const runManualCompatibilityAnalysis = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { person1, person2, relationshipType } = data;
  
  if (!person1 || !person2 || !relationshipType) {
    throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
  }

  const validatePerson = (p: any) => p.name && p.birthDate && p.status && p.photo;
  if (!validatePerson(person1) || !validatePerson(person2)) {
    throw new functions.https.HttpsError('invalid-argument', 'Tüm alanlar zorunludur.');
  }
  
  const userRef = db.collection("users").doc(userId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new functions.https.HttpsError('not-found', "Kullanıcı profiliniz bulunamadı.");
      }
      
      const userData = userSnap.data() as any;
      
      if ((userData.compatibilityCount || 0) <= 0) {
        throw new functions.https.HttpsError('failed-precondition', "Yetersiz uyum analizi hakkı. Lütfen cüzdanınızdan hak satın alın.");
      }
      
      transaction.update(userRef, { compatibilityCount: FieldValue.increment(-1) });
      
      const now = new Date();
      const readyAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes later

      const requestRef = db.collection("compatibilityRequests").doc();
      const requestData = {
        id: requestRef.id,
        userId,
        person1,
        person2,
        relationshipType,
        status: 'pending',
        createdAt: now.toISOString(),
        readyAt: readyAt.toISOString()
      };

      transaction.set(requestRef, requestData);
      
      const logRef = db.collection("usageLogs").doc();
      transaction.set(logRef, {
        id: logRef.id,
        userId,
        type: 'social_feature',
        feature: 'manual_compatibility_analysis_request',
        relationshipType,
        createdAt: now.toISOString()
      });
      
      return { success: true, requestId: requestRef.id, readyAt: readyAt.toISOString() };
    });
  } catch (error: any) {
    console.error("runManualCompatibilityAnalysis error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Analiz başlatılırken hata oluştu.');
  }
});

/**
 * PRIVACY & MODERATION FUNCTIONS (Block/Mute)
 */

export const blockUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const { targetUid } = data;
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
  if (targetUid === context.auth.uid) throw new functions.https.HttpsError('invalid-argument', 'Kendinizi engelleyemezsiniz.');

  const userRef = db.collection("users").doc(context.auth.uid);
  
  try {
    await userRef.update({
      "social.blockedUserIds": admin.firestore.FieldValue.arrayUnion(targetUid)
    });
    return { status: 'SUCCESS' };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', 'Engelleme işlemi başarısız oldu.');
  }
});

export const unblockUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const { targetUid } = data;
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');

  const userRef = db.collection("users").doc(context.auth.uid);
  
  try {
    await userRef.update({
      "social.blockedUserIds": admin.firestore.FieldValue.arrayRemove(targetUid)
    });
    return { status: 'SUCCESS' };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', 'Engel kaldırma işlemi başarısız oldu.');
  }
});

export const muteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const { targetUid } = data;
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
  if (targetUid === context.auth.uid) throw new functions.https.HttpsError('invalid-argument', 'Kendinizi susturamazsınız.');

  const userRef = db.collection("users").doc(context.auth.uid);
  
  try {
    await userRef.update({
      "social.mutedUserIds": admin.firestore.FieldValue.arrayUnion(targetUid)
    });
    return { status: 'SUCCESS' };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', 'Susturma işlemi başarısız oldu.');
  }
});

export const unmuteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const { targetUid } = data;
  if (!targetUid) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');

  const userRef = db.collection("users").doc(context.auth.uid);
  
  try {
    await userRef.update({
      "social.mutedUserIds": admin.firestore.FieldValue.arrayRemove(targetUid)
    });
    return { status: 'SUCCESS' };
  } catch (error: any) {
    throw new functions.https.HttpsError('internal', 'Susturma kaldırma işlemi başarısız oldu.');
  }
});

// 20. Send Message Request (Secure Backend)
// 19. Send Like (Secure)
export const sendLike = functions.https.onCall(async (data, context) => {
  console.log("[sendLike] function start");
  
  try {
    // 1. Auth Check
    if (!context.auth) {
      console.error("[sendLike] Unauthenticated call");
      throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    }
    
    const fromUserId = context.auth.uid;
    const { targetUserId, type } = data || {};
    console.log(`[sendLike] auth uid: ${fromUserId}, targetUserId: ${targetUserId}, type: ${type}`);

    // 2. Input Validation
    if (!targetUserId || typeof targetUserId !== 'string') {
      console.warn("[sendLike] Invalid targetUserId:", targetUserId);
      return { status: 'TARGET_NOT_FOUND' };
    }
    if (!['like', 'super_like', 'pass'].includes(type)) {
      console.warn("[sendLike] Invalid type:", type);
      return { status: 'TECHNICAL_ERROR', message: 'Geçersiz işlem tipi.' };
    }
    if (fromUserId === targetUserId) {
      console.warn("[sendLike] Self action detected");
      return { status: 'SELF_ACTION' };
    }

    const fromUserRef = db.collection("users").doc(fromUserId);
    const toUserRef = db.collection("users").doc(targetUserId);
    
    // 3. Transaction
    const result = await db.runTransaction(async (transaction) => {
      console.log(`[sendLike] Transaction started for ${fromUserId} -> ${targetUserId}`);
      
      const [fromUserSnap, toUserSnap] = await Promise.all([
        transaction.get(fromUserRef),
        transaction.get(toUserRef)
      ]);

      console.log(`[sendLike] Snaps fetched. fromExists: ${fromUserSnap.exists}, toExists: ${toUserSnap.exists}`);

      if (!fromUserSnap.exists) {
        console.error(`[sendLike] From user ${fromUserId} not found`);
        return { status: 'TECHNICAL_ERROR', message: 'Gönderen kullanıcı bulunamadı.' };
      }
      if (!toUserSnap.exists) {
        console.warn(`[sendLike] Target user ${targetUserId} not found`);
        return { status: 'TARGET_NOT_FOUND' };
      }

      const fromUserData = fromUserSnap.data() || {};
      const toUserData = toUserSnap.data() || {};

      // Block check
      const fromBlocked = (fromUserData.social?.blockedUserIds || []);
      const toBlocked = (toUserData.social?.blockedUserIds || []);
      
      if (fromBlocked.includes(targetUserId) || toBlocked.includes(fromUserId)) {
        console.warn(`[sendLike] Action blocked between ${fromUserId} and ${targetUserId}`);
        return { status: 'BLOCKED' };
      }

      // 4. Consumption Check (if super_like)
      if (type === 'super_like') {
        const superLikes = fromUserData.superLikes || 0;
        console.log(`[sendLike] Checking superLikes: ${superLikes}`);
        if (superLikes <= 0) {
          return { status: 'INSUFFICIENT_FUNDS', message: 'Yetersiz Süper Like hakkı.' };
        }
        transaction.update(fromUserRef, { superLikes: admin.firestore.FieldValue.increment(-1) });
      }

      const swipeId = `swipe_${fromUserId}_${targetUserId}`;
      const swipeRef = db.collection("swipes").doc(swipeId);
      const swipeSnap = await transaction.get(swipeRef);

      console.log(`[sendLike] Swipe check: exists=${swipeSnap.exists}`);

      // Check if already swiped with same type (to avoid duplicates)
      if (swipeSnap.exists && swipeSnap.data()?.type === type && type !== 'pass') {
        console.log(`[sendLike] Already swiped with type ${type}`);
        return { status: 'ALREADY_LIKED' };
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      
      // Defensive handling for existing createdAt (ensure it's a Timestamp or null)
      let existingCreatedAt = swipeSnap.exists ? swipeSnap.data()?.createdAt : null;
      if (existingCreatedAt && typeof existingCreatedAt === 'string') {
        try {
          existingCreatedAt = admin.firestore.Timestamp.fromDate(new Date(existingCreatedAt));
        } catch (e) {
          console.warn("[sendLike] Failed to parse existingCreatedAt:", existingCreatedAt);
          existingCreatedAt = now;
        }
      }

      console.log(`[sendLike] Recording swipe: ${swipeId}`);
      // A. Record Swipe
      transaction.set(swipeRef, {
        id: swipeId,
        fromUserId,
        toUserId: targetUserId,
        type,
        createdAt: existingCreatedAt || now,
        updatedAt: now
      }, { merge: true });

      // B. Handle Like / Super Like
      if (type === 'like' || type === 'super_like') {
        console.log(`[sendLike] Creating notification for ${targetUserId}`);
        // Create in-app notification
        const notifRef = db.collection("notifications").doc();
        transaction.set(notifRef, {
          userId: targetUserId,
          type: type === 'super_like' ? "super_like" : "like",
          title: type === 'super_like' ? "Yeni Süper Like!" : "Yeni Beğeni!",
          message: `${fromUserData.social?.nickname || fromUserData.displayName || "Biri"} seni beğendi! ❤️`,
          data: { fromUserId },
          senderSnapshot: {
            nickname: fromUserData.social?.nickname || fromUserData.displayName || "İsimsiz",
            photoURL: fromUserData.social?.photos?.[0] || fromUserData.photoURL || ""
          },
          read: false,
          createdAt: now
        });

        // If super_like, also create an interaction request
        if (type === 'super_like') {
          console.log(`[sendLike] Creating interactionRequest for ${targetUserId}`);
          const requestId = `request_${fromUserId}_${targetUserId}`;
          const requestRef = db.collection("interactionRequests").doc(requestId);
          transaction.set(requestRef, {
            id: requestId,
            fromUserId,
            toUserId: targetUserId,
            status: "pending",
            type: "super_like",
            createdAt: now,
            updatedAt: now,
            senderSnapshot: {
              nickname: fromUserData.social?.nickname || fromUserData.displayName || "İsimsiz",
              photoURL: fromUserData.social?.photos?.[0] || fromUserData.photoURL || ""
            }
          }, { merge: true });
        }
      }

      console.log("[sendLike] Transaction SUCCESS");
      return { status: 'SUCCESS' };
    });

    return result;

  } catch (error: any) {
    console.error("[sendLike] FATAL ERROR:", error);
    console.error("[sendLike] Stack:", error.stack);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    return { 
      status: 'TECHNICAL_ERROR', 
      message: error.message || 'Bilinmeyen bir hata oluştu.' 
    };
  }
});

export const sendMessageRequest = functions.https.onCall(async (data, context) => {
  console.log("[sendMessageRequest] function start");
  
  try {
    if (!context.auth) {
      console.error("[sendMessageRequest] Unauthenticated call");
      throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    }
    
    const fromUserId = context.auth.uid;
    const { targetUserId } = data || {};
    console.log(`[sendMessageRequest] auth uid: ${fromUserId}, targetUserId: ${targetUserId}`);

    if (!targetUserId) {
      console.warn("[sendMessageRequest] Missing targetUserId");
      throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
    }
    if (fromUserId === targetUserId) {
      console.warn("[sendMessageRequest] Self action detected");
      return { status: 'SELF_ACTION' };
    }

    const result = await db.runTransaction(async (transaction) => {
      console.log("[sendMessageRequest] Transaction started");
      const fromUserRef = db.collection("users").doc(fromUserId);
      const toUserRef = db.collection("users").doc(targetUserId);
      
      const [fromUserSnap, toUserSnap] = await Promise.all([
        transaction.get(fromUserRef),
        transaction.get(toUserRef)
      ]);

      if (!fromUserSnap.exists || !toUserSnap.exists) {
        console.warn("[sendMessageRequest] User not found");
        throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
      }

      const fromUserData = fromUserSnap.data() as any;
      const toUserData = toUserSnap.data() as any;

      // Block check
      const isBlocked = (fromUserData.social?.blockedUserIds || []).includes(targetUserId) || 
                        (toUserData.social?.blockedUserIds || []).includes(fromUserId);
      if (isBlocked) {
        console.warn("[sendMessageRequest] Action blocked");
        return { status: 'BLOCKED' };
      }

      // Existing chat check
      const chatId = `chat_${[fromUserId, targetUserId].sort().join('_')}`;
      const chatRef = db.collection("chats").doc(chatId);
      const chatSnap = await transaction.get(chatRef);
      if (chatSnap.exists) {
        console.log("[sendMessageRequest] Already chatting");
        return { status: 'ALREADY_CHATTING' };
      }

      // Existing request check
      const requestId = `request_${fromUserId}_${targetUserId}`;
      const requestRef = db.collection("interactionRequests").doc(requestId);
      const requestSnap = await transaction.get(requestRef);
      if (requestSnap.exists) {
        const reqData = requestSnap.data();
        if (reqData?.status === 'pending') {
          console.log("[sendMessageRequest] Already requested");
          return { status: 'ALREADY_REQUESTED' };
        }
        if (reqData?.status === 'accepted') {
          console.log("[sendMessageRequest] Already accepted");
          return { status: 'ALREADY_CHATTING' };
        }
      }

      // Create request
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      // Consumption Check (if needed - currently message requests might be free or use different logic)
      // For now, we just ensure it's secure.

      transaction.set(requestRef, {
        id: requestId,
        fromUserId,
        toUserId: targetUserId,
        status: "pending",
        type: "message_request",
        message: "",
        createdAt: now,
        updatedAt: now,
        senderSnapshot: {
          nickname: fromUserData.social?.nickname || fromUserData.displayName || "İsimsiz",
          photoURL: fromUserData.social?.photos?.[0] || fromUserData.photoURL || ""
        },
        receiverSnapshot: {
          nickname: toUserData.social?.nickname || toUserData.displayName || "İsimsiz",
          photoURL: toUserData.social?.photos?.[0] || toUserData.photoURL || ""
        }
      });

      // Create notification
      const notifRef = db.collection("notifications").doc();
      transaction.set(notifRef, {
        userId: targetUserId,
        type: "message_request",
        title: "Yeni Mesaj İsteği",
        message: `${fromUserData.social?.nickname || fromUserData.displayName || "Biri"} sana bir mesaj isteği gönderdi.`,
        data: { fromUserId },
        read: false,
        createdAt: now
      });

      return { status: 'SUCCESS' };
    });

    return result;

  } catch (error: any) {
    console.error("[sendMessageRequest] FATAL ERROR:", error);
    console.error("[sendMessageRequest] Stack:", error.stack);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    return { 
      status: 'TECHNICAL_ERROR', 
      message: error.message || 'İşlem sırasında bir hata oluştu.' 
    };
  }
});

/**
 * MESSAGING & SOCIAL INTERACTION FUNCTIONS
 */

// 1. Accept Request
export const acceptRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { requestId } = data;
  if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'Request ID gerekli.');

  const requestRef = db.collection("interactionRequests").doc(requestId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const requestSnap = await transaction.get(requestRef);
      if (!requestSnap.exists) throw new functions.https.HttpsError('not-found', 'İstek bulunamadı.');
      const request = requestSnap.data() as any;

      if (request.toUserId !== userId) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');
      if (request.status !== 'pending') throw new functions.https.HttpsError('failed-precondition', 'İstek zaten işlenmiş.');

      const fromUserId = request.fromUserId;
      const chatId = `chat_${[fromUserId, userId].sort().join('_')}`;
      const chatRef = db.collection("chats").doc(chatId);
      
      const now = admin.firestore.FieldValue.serverTimestamp();

      // Update Request
      transaction.update(requestRef, {
        status: 'accepted',
        updatedAt: now
      });

      // Create/Update Chat
      transaction.set(chatRef, {
        id: chatId,
        participants: [fromUserId, userId],
        createdAt: now,
        lastMessage: "Sohbet başladı! 👋",
        lastMessageAt: now,
        lastMessageSenderId: "system",
        lastMessageStatus: 'sent',
        status: 'active',
        unreadCount: {
          [fromUserId]: 0,
          [userId]: 0
        },
        typing: {
          [fromUserId]: false,
          [userId]: false
        }
      }, { merge: true });

      // Initial Message
      const msgRef = db.collection("messages").doc();
      transaction.set(msgRef, {
        id: msgRef.id,
        chatId,
        participants: [fromUserId, userId],
        senderId: "system",
        text: "Sohbet başlayabilir.",
        createdAt: now,
        seen: false,
        status: 'sent',
        type: 'system'
      });

      // Notification for sender
      const notifRef = db.collection("notifications").doc();
      transaction.set(notifRef, {
        userId: fromUserId,
        type: "request_accepted",
        title: "İstek Kabul Edildi!",
        message: "Mesaj isteğin kabul edildi, sohbete başlayabilirsin! 🎉",
        data: { chatId },
        read: false,
        createdAt: now
      });

      return { status: 'SUCCESS', chatId };
    });
  } catch (error: any) {
    console.error("acceptRequest error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 2. Reject Request
export const rejectRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { requestId } = data;
  if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'Request ID gerekli.');

  const requestRef = db.collection("interactionRequests").doc(requestId);
  
  try {
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) throw new functions.https.HttpsError('not-found', 'İstek bulunamadı.');
    const request = requestSnap.data() as any;

    if (request.toUserId !== userId) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');

    await requestRef.update({
      status: 'rejected',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("rejectRequest error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 3. Send Message
export const sendMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const senderId = context.auth.uid;
  const { chatId, text, mediaUrl, mediaType } = data;

  if (!chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');

  const chatRef = db.collection("chats").doc(chatId);
  
  try {
    return await db.runTransaction(async (transaction) => {
      const chatSnap = await transaction.get(chatRef);
      if (!chatSnap.exists) throw new functions.https.HttpsError('not-found', 'Sohbet bulunamadı.');
      const chat = chatSnap.data() as any;

      if (!chat.participants.includes(senderId)) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');

      const receiverId = chat.participants.find((id: string) => id !== senderId);
      
      // Block Check
      const [senderSnap, receiverSnap] = await Promise.all([
        db.collection("users").doc(senderId).get(),
        db.collection("users").doc(receiverId).get()
      ]);
      
      const senderData = senderSnap.data() || {};
      const receiverData = receiverSnap.data() || {};
      
      if ((senderData.social?.blockedUserIds || []).includes(receiverId) || 
          (receiverData.social?.blockedUserIds || []).includes(senderId)) {
        throw new functions.https.HttpsError('failed-precondition', 'Bu kullanıcıyla iletişim kuramazsınız.');
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const msgRef = db.collection("messages").doc();
      
      const type = mediaType || 'text';
      const lastMessageText = type === 'text' ? text : (type === 'image' ? "📷 Görsel" : "🎥 Video");

      const messageData = {
        id: msgRef.id,
        chatId,
        participants: [senderId, receiverId],
        senderId,
        receiverId,
        text: text || "",
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        createdAt: now,
        status: 'sent',
        seen: false,
        type
      };

      transaction.set(msgRef, messageData);

      transaction.update(chatRef, {
        lastMessage: lastMessageText,
        lastMessageAt: now,
        lastMessageSenderId: senderId,
        lastMessageStatus: 'sent',
        [`unreadCount.${receiverId}`]: admin.firestore.FieldValue.increment(1)
      });

      // Increment global unread count for receiver
      transaction.update(db.collection("users").doc(receiverId), {
        unreadMessagesCount: admin.firestore.FieldValue.increment(1)
      });

      // Send Push Notification (Outside transaction or handled safely)
      try {
        await sendPushToUser(receiverId, {
          title: senderData.social?.nickname || senderData.displayName || "Yeni Mesaj",
          body: lastMessageText,
          data: { screen: 'chat', chatId },
          category: 'messages',
          senderId
        });
      } catch (pushError) {
        console.error("Push notification failed, but message was sent:", pushError);
      }

      return { status: 'SUCCESS', messageId: msgRef.id };
    });
  } catch (error: any) {
    console.error("sendMessage error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 4. Mark As Seen
export const markAsSeen = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { chatId } = data;

  if (!chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');

  const chatRef = db.collection("chats").doc(chatId);
  const messagesRef = db.collection("messages");

  try {
    const unreadMessages = await messagesRef
      .where("chatId", "==", chatId)
      .where("receiverId", "==", userId)
      .where("status", "!=", "seen")
      .limit(100)
      .get();

    if (unreadMessages.empty) {
      await chatRef.update({ [`unreadCount.${userId}`]: 0 });
      return { status: 'SUCCESS' };
    }

    const batch = db.batch();
    const countToDecrement = unreadMessages.size;
    
    unreadMessages.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'seen', seen: true });
    });

    batch.update(chatRef, { [`unreadCount.${userId}`]: 0 });
    
    // Decrement global unread count for user
    batch.update(db.collection("users").doc(userId), {
      unreadMessagesCount: admin.firestore.FieldValue.increment(-countToDecrement)
    });

    // Update lastMessageStatus if it was from the other user
    const chatSnap = await chatRef.get();
    if (chatSnap.exists() && chatSnap.data()?.lastMessageSenderId !== userId) {
      batch.update(chatRef, { lastMessageStatus: 'seen' });
    }

    await batch.commit();
    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("markAsSeen error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 5. Mark As Delivered
export const markAsDelivered = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { chatId } = data;

  if (!chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');

  const messagesRef = db.collection("messages");

  try {
    const sentMessages = await messagesRef
      .where("chatId", "==", chatId)
      .where("receiverId", "==", userId)
      .where("status", "==", "sent")
      .limit(100)
      .get();

    if (sentMessages.empty) return { success: true };

    const batch = db.batch();
    sentMessages.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'delivered' });
    });

    await batch.commit();
    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("markAsDelivered error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 6. Delete Chat
export const deleteChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { chatId } = data;
  if (!chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');

  try {
    const chatRef = db.collection("chats").doc(chatId);
    await chatRef.update({
      deletedFor: admin.firestore.FieldValue.arrayUnion(userId)
    });
    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("deleteChat error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 7. Delete Message
export const deleteMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { messageId, forEveryone } = data;
  if (!messageId) throw new functions.https.HttpsError('invalid-argument', 'Message ID gerekli.');

  try {
    const msgRef = db.collection("messages").doc(messageId);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) throw new functions.https.HttpsError('not-found', 'Mesaj bulunamadı.');
    const msg = msgSnap.data() as any;

    if (msg.senderId !== userId) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');

    if (forEveryone) {
      await msgRef.update({
        isDeleted: true,
        deletedForEveryone: true,
        text: "Bu mesaj silindi.",
        mediaUrl: null,
        mediaType: null
      });
    } else {
      await msgRef.update({ isDeleted: true });
    }
    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("deleteMessage error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 8. Edit Message
export const editMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { messageId, newText } = data;
  if (!messageId || !newText) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

  try {
    const msgRef = db.collection("messages").doc(messageId);
    const msgSnap = await msgRef.get();
    if (!msgSnap.exists) throw new functions.https.HttpsError('not-found', 'Mesaj bulunamadı.');
    const msg = msgSnap.data() as any;

    if (msg.senderId !== userId) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');

    await msgRef.update({
      text: newText,
      editedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("editMessage error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 9. Set Typing Status
export const setTypingStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { chatId, isTyping } = data;
  if (!chatId) throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');

  try {
    const chatRef = db.collection("chats").doc(chatId);
    await chatRef.update({
      [`typing.${userId}`]: !!isTyping
    });
    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("setTypingStatus error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 10. Create Chat
export const createChat = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { targetUserId } = data;
  if (!targetUserId) throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');

  const chatId = `chat_${[userId, targetUserId].sort().join('_')}`;
  const chatRef = db.collection("chats").doc(chatId);
  
  try {
    const chatSnap = await chatRef.get();
    if (chatSnap.exists) return { status: 'SUCCESS', chatId };

    const now = admin.firestore.FieldValue.serverTimestamp();
    await chatRef.set({
      id: chatId,
      participants: [userId, targetUserId],
      createdAt: now,
      lastMessage: "Sohbet başladı! 👋",
      lastMessageAt: now,
      lastMessageSenderId: "system",
      lastMessageStatus: 'sent',
      status: 'active',
      unreadCount: {
        [userId]: 0,
        [targetUserId]: 0
      },
      typing: {
        [userId]: false,
        [targetUserId]: false
      }
    });

    const msgRef = db.collection("messages").doc();
    await msgRef.set({
      id: msgRef.id,
      chatId,
      participants: [userId, targetUserId],
      senderId: "system",
      text: "Sohbet başlayabilir.",
      createdAt: now,
      seen: false,
      status: 'sent',
      type: 'system'
    });

    return { status: 'SUCCESS', chatId };
  } catch (error: any) {
    console.error("createChat error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 11. Create Report
export const createReport = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const reporterId = context.auth.uid;
  const { reportedUserId, source, reason, description, metadata } = data;

  if (!reportedUserId || !source || !reason) {
    throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
  }

  if (reporterId === reportedUserId) {
    throw new functions.https.HttpsError('failed-precondition', 'Kendinizi raporlayamazsınız.');
  }

  try {
    const reportRef = db.collection("reports").doc();
    await reportRef.set({
      id: reportRef.id,
      reporterId,
      reportedUserId,
      source,
      reason,
      description: description || "",
      metadata: metadata || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending'
    });

    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("createReport error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});

// 12. Update Social Profile (Secure Backend)
export const updateSocialProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  const { nickname, bio, gender, zodiacSign, photos, interests, birthDate } = data;

  const userRef = db.collection("users").doc(userId);

  try {
    const updates: any = {};
    if (nickname !== undefined) {
      if (nickname.length > 50) throw new functions.https.HttpsError('invalid-argument', 'Nickname çok uzun.');
      updates["social.nickname"] = nickname;
    }
    if (bio !== undefined) {
      if (bio.length > 500) throw new functions.https.HttpsError('invalid-argument', 'Bio çok uzun.');
      updates["social.bio"] = bio;
    }
    if (gender !== undefined) updates["social.gender"] = gender;
    if (zodiacSign !== undefined) updates["social.zodiacSign"] = zodiacSign;
    if (photos !== undefined) {
      if (!Array.isArray(photos) || photos.length > 6) throw new functions.https.HttpsError('invalid-argument', 'Geçersiz fotoğraf listesi.');
      updates["social.photos"] = photos;
    }
    if (interests !== undefined) updates["social.interests"] = interests;
    if (birthDate !== undefined) updates["social.birthDate"] = birthDate;

    if (Object.keys(updates).length === 0) return { success: true };

    updates["updatedAt"] = admin.firestore.FieldValue.serverTimestamp();
    await userRef.update(updates);

    return { status: 'SUCCESS' };
  } catch (error: any) {
    console.error("updateSocialProfile error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    return { status: 'TECHNICAL_ERROR', message: error.message };
  }
});
