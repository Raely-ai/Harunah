import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

const regionalFunctions = functions.region('europe-west2');
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import * as crypto from "crypto";

import { getFirestore, FieldValue } from "firebase-admin/firestore";

import * as logger from "firebase-functions/logger";

const app = admin.initializeApp();
const db = getFirestore(app, "ai-studio-71aa84b8-dbfc-4fbb-ab63-365a3c94301c");

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
 * NEW FORTUNE SYSTEM FUNCTIONS
 */

// 1. Create Fortune Reading (Backend Controlled)
export const createFortuneReading = regionalFunctions.https.onCall(async (data, context) => {
    let currentStep = "start";
    try {
      logger.info("Step: start", { 
        auth: context.auth ? { uid: context.auth.uid, email: context.auth.token.email } : "null",
        payload: data 
      });

      currentStep = "auth_check";
      if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
      }
      const userId = context.auth.uid;

      currentStep = "validation";
      const { type, formData, questions, priorityMode } = data || {};
      if (!type || !formData) {
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri (type veya formData).');
      }

      // Sanitize formData
      const sanitizedFormData = JSON.parse(JSON.stringify(formData || {}));

      // Create hash
      const requestString = JSON.stringify({ userId, type, formData: sanitizedFormData, questions: questions || [] });
      const requestHash = crypto.createHash('sha256').update(requestString).digest('hex');

      const userRef = db.collection("users").doc(userId);
      const economyRef = db.collection("adminSettings").doc("economy");
      
      currentStep = "duplicate_check";
      logger.info("Step: duplicate_check", { userId, requestHash });
      
      // Check active readings
      const activeReadings = await db.collection("readings")
        .where("userId", "==", userId)
        .limit(20)
        .get();
      
      const hasActive = activeReadings.docs.some(doc => 
        ["searching", "found", "interpreting", "waiting"].includes(doc.data().status)
      );
      
      if (hasActive) {
        throw new functions.https.HttpsError('already-exists', 'Zaten aktif bir fal talebiniz var.');
      }

      // Check exact duplicate
      const duplicateCheck = await db.collection("readings")
        .where("requestHash", "==", requestHash)
        .limit(1)
        .get();

      if (!duplicateCheck.empty) {
        const dupData = duplicateCheck.docs[0].data();
        const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        if (dupData.createdAt > fiveMinsAgo) {
          throw new functions.https.HttpsError('already-exists', 'Bu fal talebi zaten gönderilmiş.');
        }
      }

      currentStep = "transaction_start";
      logger.info("Step: transaction_start", { userId });
      
      return await db.runTransaction(async (transaction) => {
        currentStep = "transaction_get_user";
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
          throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
        }
        const userData = userSnap.data() as any;

        currentStep = "transaction_get_economy";
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

        currentStep = "balance_calculation";
        const basePrice = Number(economy.fortunePricing?.[type]) || 100;
        const extraQuestionPrice = Number(economy.fortunePricing?.extraQuestion) || 50;
        const priorityFee = Number(economy.fortunePricing?.priorityFee) || 100;
        
        let extraQuestionsCost = 0;
        if (Array.isArray(questions) && questions.length > 3) {
          extraQuestionsCost = (questions.length - 3) * extraQuestionPrice;
        }
        
        const totalCost = basePrice + extraQuestionsCost + (priorityMode ? priorityFee : 0);

        let balanceType: 'subscription' | 'energy' | 'main' = 'main';
        const today = new Date().toISOString().split('T')[0];
        
        const sub = userData.subscription;
        if (sub && sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt) > new Date()) {
          const subLimits = economy.subscriptionLimits || { totalDaily: 10 };
          const dailyUsed = sub.dailyLimitUsed || 0;
          const lastReset = sub.lastResetAt || "";
          
          if (lastReset !== today || dailyUsed < subLimits.totalDaily) {
            balanceType = 'subscription';
          }
        }

        if (balanceType === 'main' && economy.energyPaymentEnabled && (userData.energy || 0) >= totalCost) {
          balanceType = 'energy';
        }

        if (balanceType === 'main' && (userData.mainCoins || 0) < totalCost) {
          throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
        }

      currentStep = "balance_deduction";
      logger.info("Step: balance_deduction", { userId, balanceType, totalCost });
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
      
      if (Object.keys(userUpdates).length > 0) {
        transaction.update(userRef, userUpdates);
      } else {
        logger.info("No user updates needed for balance deduction");
      }

      currentStep = "create_reading";
      logger.info("Step: create_reading", { userId });
      const readingRef = db.collection("readings").doc();
      const now = new Date();
      const effectivePriorityMode = priorityMode || (balanceType === 'subscription');
      
      const rawTimes = economy.interpretationTimes?.[type === 'coffee' || type === 'tarot' ? type : 'advanced'] || {};
      const times = {
        minSearchTime: rawTimes.minSearchTime ?? 1,
        maxSearchTime: rawTimes.maxSearchTime ?? 3,
        minInterpreterTime: rawTimes.minInterpreterTime ?? 5,
        maxInterpreterTime: rawTimes.maxInterpreterTime ?? 10,
        minReadingTime: rawTimes.minReadingTime ?? 10,
        maxReadingTime: rawTimes.maxReadingTime ?? 20
      };

      const speedFactor = effectivePriorityMode ? 0.5 : 1.0;
      const searchDelay = (Math.random() * (times.maxSearchTime - times.minSearchTime) + times.minSearchTime) * 60 * 1000;
      const interpreterDelay = (Math.random() * (times.maxInterpreterTime - times.minInterpreterTime) + times.minInterpreterTime) * 60 * 1000;
      const readingDelay = (Math.random() * (times.maxReadingTime - times.minReadingTime) + times.minReadingTime) * 60 * 1000;

      const expectedReaderFoundAt = new Date(now.getTime() + searchDelay * speedFactor);
      const interpretationStartedAt = new Date(expectedReaderFoundAt.getTime() + interpreterDelay * speedFactor);
      const expectedCompletedAt = new Date(interpretationStartedAt.getTime() + readingDelay * speedFactor);

      const readingData = {
        id: readingRef.id,
        userId,
        type,
        status: 'searching',
        requestHash,
        formData: sanitizedFormData,
        images: [],
        cards: [],
        questions: Array.isArray(questions) ? questions.filter((q: any) => q != null) : [],
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
        title: type === 'coffee' ? 'Kahve Falı' : type === 'tarot' ? 'Tarot Açılımı' : type.charAt(0).toUpperCase() + type.slice(1)
      };

      logger.info("Setting reading document", { readingId: readingRef.id });
      transaction.set(readingRef, readingData);

      const txRef = db.collection("walletTransactions").doc();
      logger.info("Setting transaction document", { txId: txRef.id });
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

        currentStep = "end";
        logger.info("Step: end", { userId, readingId: readingRef.id });
        return { success: true, readingId: readingRef.id };
      });
    } catch (err: any) {
      logger.error(`Fortune creation failed at step: ${currentStep}`, { 
        error: err.message, 
        stack: err.stack,
        userId: context.auth?.uid 
      });
      
      const errorPayload = {
        message: err.message || String(err),
        step: currentStep,
        code: err.code || 'unknown',
        name: err.name || 'Error',
        stack: err.stack
      };

      if (err instanceof functions.https.HttpsError) {
        throw err;
      }
      
      throw new functions.https.HttpsError('internal', JSON.stringify(errorPayload));
    }
});

// 2. Process Fortune AI
export const processFortuneAI = regionalFunctions.runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  const openai = getOpenAI();
  
  const { readingId } = data;
  if (!readingId) throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');

  const readingRef = db.collection("readings").doc(readingId);
  
  // Use transaction for atomic status check and lock
  const result = await db.runTransaction(async (transaction) => {
    const readingSnap = await transaction.get(readingRef);
    if (!readingSnap.exists) throw new Error('Fal kaydı bulunamadı.');
    const reading = readingSnap.data() as any;

    if (reading.userId !== userId) throw new Error('Yetkisiz erişim.');
    
    // Idempotency check
    if (reading.status === 'completed') return { alreadyCompleted: true, content: reading.content };
    if (reading.status === 'processing_ai') return { alreadyProcessing: true };

    // Lock the reading
    transaction.update(readingRef, { 
      status: 'processing_ai', 
      updatedAt: new Date().toISOString() 
    });

    return { reading, proceed: true };
  }).catch(err => {
    throw new functions.https.HttpsError('internal', JSON.stringify({
      message: err.message || String(err),
      step: "transaction_lock",
      stack: err.stack
    }));
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
    annebaba: `${reading.formData.motherName || ""}/${reading.formData.fatherName || ""}`,
    sorular: reading.questions?.map((q: any) => typeof q === 'string' ? q : q.text).join(", ") || "Genel yorum",
    kartlar: reading.cards?.join(", ") || "Seçim yok",
    gorseller: reading.images?.length > 0 ? `${reading.images.length} adet görsel yüklendi.` : "Görsel yok",
    tur: reading.type,
    isim: reading.formData.adSoyad?.split(" ")[0] || "Canım"
  };

  let systemPrompt = aiConfig.systemPrompt;
  let templatePrompt = aiConfig.templatePrompt;

  const identityRules = `
Sen Ahlas adında, karizmatik, gizemli ve hafif flörtöz bir erkek falcısın. 
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

  // Double check status before starting AI to prevent race conditions
  const currentSnap = await readingRef.get();
  if (currentSnap.data()?.status !== 'processing_ai') {
    throw new functions.https.HttpsError('failed-precondition', 'Fal durumu geçersiz (processing_ai bekleniyordu).');
  }

  let currentStep = "init";
  try {
    currentStep = "before_openai";
    console.log(`[${readingId}] Step: ${currentStep}`);

    // Timeout protection: 28 seconds (Cloud Functions have a default timeout, but we want to catch it earlier)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("OpenAI request timed out")), 28000)
    );

    const openaiPromise = openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: templatePrompt }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    const response: any = await Promise.race([openaiPromise, timeoutPromise]);
    
    currentStep = "after_openai";
    console.log(`[${readingId}] Step: ${currentStep}`);

    const contentRaw = response?.choices?.[0]?.message?.content;
    if (!contentRaw) {
      throw new Error("OpenAI empty response content");
    }

    let content = contentRaw.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
    if (!content) {
      throw new Error("OpenAI processed content is empty");
    }

    currentStep = "before_save";
    console.log(`[${readingId}] Step: ${currentStep}`);

    await readingRef.update({
      status: 'completed',
      content,
      resultText: content,
      updatedAt: new Date().toISOString()
    });

    currentStep = "after_save";
    console.log(`[${readingId}] Step: ${currentStep}`);

    // Notify Success
    await db.collection("notifications").add({
      userId: reading.userId,
      type: 'system',
      title: 'Falınız Hazır!',
      message: `${reading.title} yorumunuz tamamlandı. Hemen inceleyin!`,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      data: { readingId }
    });

    return { success: true, content };
  } catch (error: any) {
    console.error(`[${readingId}] Error at step ${currentStep}:`, error);
    
    const errorPayload = JSON.stringify({
      message: error.message || 'Bilinmeyen hata',
      step: currentStep
    });

    // Attempt to log error to the reading document
    await readingRef.update({
      status: 'error',
      error: errorPayload,
      updatedAt: new Date().toISOString()
    }).catch(err => console.error("Secondary error updating status:", err));

    throw new functions.https.HttpsError('internal', errorPayload);
  }
});

// 3. Upgrade Fortune Priority
export const upgradeFortunePriority = regionalFunctions.https.onCall(async (data, context) => {
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
    const searchDelay = (new Date(reading.expectedReaderFoundAt).getTime() - new Date(reading.createdAt).getTime()) * 0.5;
    const newFoundAt = new Date(now.getTime() + searchDelay);
    
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
export const generateDailyMessage = regionalFunctions.runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
  const openai = getOpenAI();
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
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
export const updateReadingStatuses = regionalFunctions.runWith({ secrets: ["OPENAI_API_KEY"] }).pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const now = new Date().toISOString();
  const openai = getOpenAI();
  
  // 1. Searching -> Found
  const searchingReadings = await db.collection("readings")
    .where("status", "==", "searching")
    .where("expectedReaderFoundAt", "<=", now)
    .limit(50)
    .get();

  for (const doc of searchingReadings.docs) {
    const reading = doc.data();
    await doc.ref.update({ status: 'found', updatedAt: now });
    
    // Notify
    await db.collection("notifications").add({
      userId: reading.userId,
      type: 'system',
      title: 'Yorumcu Bulundu!',
      message: `${reading.title} için yorumcunuz hazır, yorumlanmaya başlanıyor.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: { readingId: doc.id }
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
    
    // Notify
    await db.collection("notifications").add({
      userId: reading.userId,
      type: 'system',
      title: 'Falınız Yorumlanıyor',
      message: `${reading.title} yorumunuz LASYA tarafından hazırlanıyor.`,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      data: { readingId: doc.id }
    });
  }

  // 3. Interpreting -> Completed (Trigger AI)
  const interpretingReadings = await db.collection("readings")
    .where("status", "==", "interpreting")
    .where("expectedCompletedAt", "<=", now)
    .limit(5)
    .get();

  for (const doc of interpretingReadings.docs) {
    const reading = doc.data();
    
    try {
      // Atomic lock for background process
      const lockResult = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(doc.ref);
        const data = snap.data();
        if (data?.status !== 'interpreting') return { proceed: false };
        
        transaction.update(doc.ref, { status: 'processing_ai', updatedAt: now });
        return { proceed: true };
      });

      if (!lockResult.proceed) continue;

      // Fetch Prompt Template
      const economySnap = await db.collection("adminSettings").doc("economy").get();
      const economy = economySnap.data() as any;
      const aiConfig = economy?.aiSettings?.[reading.type] || {
        systemPrompt: "Sen LASYA isminde mistik bir kahinsin.",
        templatePrompt: "Kullanıcı {adsoyad}, {dogumtarihi} doğumlu, {iliskidurumu}. Soruları: {sorular}. Lütfen yorumla."
      };

      // Replace Placeholders
      let systemPrompt = aiConfig.systemPrompt;
      let templatePrompt = aiConfig.templatePrompt;

      const placeholders: Record<string, string> = {
        adsoyad: reading.formData.adSoyad || "Canım",
        dogumtarihi: reading.formData.dogumTarihi || "Bilinmiyor",
        iliskidurumu: reading.formData.iliskiDurumu || "Bilinmiyor",
        annebaba: `${reading.formData.motherName || ""}/${reading.formData.fatherName || ""}`,
        sorular: reading.questions?.map((q: any) => typeof q === 'string' ? q : q.text).join(", ") || "Genel yorum",
        kartlar: reading.cards?.join(", ") || "Seçim yok",
        gorseller: reading.images?.length > 0 ? "Görseller eklendi." : "Görsel yok.",
        tur: reading.type,
        isim: reading.formData.adSoyad?.split(" ")[0] || "Canım"
      };

      Object.entries(placeholders).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        systemPrompt = systemPrompt.replace(regex, value);
        templatePrompt = templatePrompt.replace(regex, value);
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: templatePrompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      let content = response.choices[0].message.content || "";
      content = content.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

      await doc.ref.update({
        status: 'completed',
        content,
        resultText: content,
        updatedAt: new Date().toISOString()
      });

      // Notify
      await db.collection("notifications").add({
        userId: reading.userId,
        type: 'system',
        title: 'Falınız Hazır!',
        message: `${reading.title} yorumunuz tamamlandı. Hemen inceleyin!`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        data: { readingId: doc.id }
      });
    } catch (error: any) {
      console.error("Background AI Error:", error);
      await doc.ref.update({
        status: 'error',
        error: error.message,
        updatedAt: new Date().toISOString()
      });
    }
  }

  return null;
});

/**
 * PRODUCTION WALLET FUNCTIONS
 */

// 1. Watch Ad Reward
export const watchAdReward = regionalFunctions.https.onCall(async (data, context) => {
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
export const purchaseCoins = regionalFunctions.https.onCall(async (data, context) => {
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
export const spendBalance = regionalFunctions.https.onCall(async (data, context) => {
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
export const buyFortuneSubscription = regionalFunctions.https.onCall(async (data, context) => {
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
  else if (type === 'monthly') expiresAt.setMonth(now.getMonth() + 1);

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

// 5. Buy Social Subscription
export const buySocialSubscription = regionalFunctions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type } = data;
  
  // HARDENING: Fetch config from Firestore
  const configSnap = await db.collection("adminSettings").doc("economy").get();
  if (!configSnap.exists) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
  const economy = configSnap.data() as any;
  const subConfig = economy.socialSubscriptions[type];
  if (!subConfig) throw new functions.https.HttpsError('invalid-argument', 'Geçersiz abonelik tipi.');

  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  let expiresAt = new Date();
  
  if (type === 'weekly') expiresAt.setDate(now.getDate() + 7);
  else if (type === 'monthly') expiresAt.setMonth(now.getMonth() + 1);

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
    if (userData.socialSubscription && userData.socialSubscription.status === 'active') {
      const currentExpires = new Date(userData.socialSubscription.expiresAt);
      if (currentExpires > now) {
        throw new functions.https.HttpsError('failed-precondition', 'Zaten aktif bir sosyal aboneliğiniz var.');
      }
    }

    transaction.update(userRef, {
      mainCoins: FieldValue.increment(-price),
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
      type: 'spend',
      source: 'subscription',
      amount: -price,
      balanceType: 'main',
      createdAt: now.toISOString(),
      status: 'spent',
      description: `Sosyal Aboneliği (${type})`
    });

    return { success: true };
  });
});

// 6. Purchase Social Item
export const purchaseSocialItem = regionalFunctions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type, description } = data;

  // HARDENING: Fetch config from Firestore
  const configSnap = await db.collection("adminSettings").doc("economy").get();
  if (!configSnap.exists) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
  const economy = configSnap.data() as any;
  
  // Map type to price field
  const priceKey = type === 'superLike' ? 'superLike' : type === 'refresh' ? 'refresh' : 'compatibility';
  const price = (economy.socialPricing && economy.socialPricing[priceKey] && economy.socialPricing[priceKey][0]?.priceCoins) || 20;
  
  const userRef = db.collection("users").doc(userId);
  
  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;
    
    if ((userData.mainCoins || 0) < price) throw new Error("Yetersiz bakiye.");

    const updates: any = {
      mainCoins: FieldValue.increment(-price)
    };
    if (type === 'superLike') updates.superLikes = FieldValue.increment(1);
    if (type === 'refresh') updates.refreshCount = FieldValue.increment(1);
    if (type === 'compatibility') updates.compatibilityCount = FieldValue.increment(1);
    
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

// 12. Purchase Social Bundle
export const purchaseSocialBundle = regionalFunctions.https.onCall(async (data, context) => {
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
    const boostExpiry = new Date();
    boostExpiry.setDate(now.getDate() + bundle.contents.boostDays);

    transaction.update(userRef, {
      mainCoins: FieldValue.increment(-bundle.price),
      superLikes: FieldValue.increment(bundle.contents.superLikes),
      refreshCount: FieldValue.increment(bundle.contents.refreshes),
      compatibilityCount: FieldValue.increment(bundle.contents.compatibility),
      boostExpiresAt: boostExpiry.toISOString()
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
export const consumeSocialFeature = regionalFunctions.https.onCall(async (data, context) => {
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
    
    transaction.update(userRef, { [field]: FieldValue.increment(-1) });
    return { success: true };
  });
});

// 8. Admin Grant Wallet Reward
export const adminGrantWalletReward = regionalFunctions.https.onCall(async (data, context) => {
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
export const getAdminUserChats = regionalFunctions.https.onCall(async (data, context) => {
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
export const getAdminChatMessages = regionalFunctions.https.onCall(async (data, context) => {
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
export const adminModerationAction = regionalFunctions.https.onCall(async (data, context) => {
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
