import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import * as crypto from "crypto";

admin.initializeApp({
  projectId: "gen-lang-client-0107919355"
});

const db = getFirestore("ai-studio-71aa84b8-dbfc-4fbb-ab63-365a3c94301c");

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
        title: type === 'coffee' ? 'Kahve Falı' : type === 'tarot' ? 'Tarot Açılımı' : type.charAt(0).toUpperCase() + type.slice(1)
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
        
        // Notify
        await db.collection("notifications").add({
        userId: reading.userId,
        type: 'system',
        title: 'Falınız Hazır!',
        message: `${reading.title} yorumunuz tamamlandı. Hemen inceleyin!`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        data: { readingId: doc.id }
      });
    }
  }

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

// 5. Buy Social Subscription
export const buySocialSubscription = functions.https.onCall(async (data, context) => {
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
export const purchaseSocialItem = functions.https.onCall(async (data, context) => {
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
export const consumeSocialFeature = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  const userId = context.auth.uid;
  const { type, config } = data;
  
  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;
    
    const sub = userData.socialSubscription;
    let consumedFrom = 'paid';
    
    // 1. Check Subscription
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
        consumedFrom = 'subscription';
      } else if (type === 'refresh' && dailyUsage.refreshes < limits.refreshes) {
        dailyUsage.refreshes++;
        transaction.update(userRef, { "socialSubscription.dailyUsage": dailyUsage });
        consumedFrom = 'subscription';
      } else if (type === 'compatibility' && dailyUsage.compatibility < limits.compatibility) {
        dailyUsage.compatibility++;
        transaction.update(userRef, { "socialSubscription.dailyUsage": dailyUsage });
        consumedFrom = 'subscription';
      } else if (type === 'swipe') {
        // Subscriptions usually have unlimited swipes, but we can still track or enforce if needed
        // For now, we'll just allow it if they have an active sub
        consumedFrom = 'subscription';
      }
    }
    
    // 2. Fallback to paid if not subscription
    if (consumedFrom === 'paid') {
      if (type === 'swipe') {
        const dailyUsed = userData.dailySwipeUsed || 0;
        const lastDate = userData.dailySwipeDate || "";
        const maxSwipes = config.freeDailySwipes || 50;
        
        if (lastDate !== today) {
          transaction.update(userRef, { dailySwipeUsed: 1, dailySwipeDate: today });
        } else {
          if (dailyUsed >= maxSwipes) throw new Error("Günlük kaydırma sınırına ulaştınız.");
          transaction.update(userRef, { dailySwipeUsed: FieldValue.increment(1) });
        }
      } else {
        const field = type === 'superLike' ? 'superLikes' : type === 'refresh' ? 'refreshCount' : 'compatibilityCount';
        if ((userData[field] || 0) <= 0) throw new Error("Yetersiz hak.");
        
        transaction.update(userRef, { [field]: FieldValue.increment(-1) });
      }
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
    'whoCanMessage', 'whoCanAddFriend', 'notifications'
  ];
  const updates: any = {};
  
  Object.keys(settings).forEach(key => {
    if (allowedFields.includes(key)) {
      updates[`social.settings.${key}`] = settings[key];
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
  const { config } = data;

  const userRef = db.collection("users").doc(userId);
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  return await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
    const userData = userSnap.data() as any;

    const sub = userData.socialSubscription;
    let consumedFrom = 'paid';

    // 1. Check Subscription
    if (sub && sub.status === 'active' && new Date(sub.expiresAt) > now) {
      const dailyUsage = sub.dailyUsage || { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: today };
      if (dailyUsage.lastResetDate !== today) {
        dailyUsage.superLikes = 0;
        dailyUsage.refreshes = 0;
        dailyUsage.compatibility = 0;
        dailyUsage.lastResetDate = today;
      }

      const limits = config.socialSubscriptions[sub.type].dailyLimits;

      if (dailyUsage.refreshes < limits.refreshes) {
        dailyUsage.refreshes++;
        transaction.update(userRef, { 
          "socialSubscription.dailyUsage": dailyUsage,
          "social.lastDiscoverRefreshAt": now.toISOString()
        });
        consumedFrom = 'subscription';
      }
    }

    // 2. Fallback to paid
    if (consumedFrom === 'paid') {
      if ((userData.refreshCount || 0) <= 0) throw new Error("Yetersiz yenileme hakkı.");
      transaction.update(userRef, { 
        refreshCount: FieldValue.increment(-1),
        "social.lastDiscoverRefreshAt": now.toISOString()
      });
    }

    // 3. Log Usage
    const logRef = db.collection("usageLogs").doc();
    transaction.set(logRef, {
      id: logRef.id,
      userId,
      type: 'social_feature',
      feature: 'refresh',
      consumedFrom,
      createdAt: now.toISOString()
    });

    return { success: true, consumedFrom, lastRefreshAt: now.toISOString() };
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
