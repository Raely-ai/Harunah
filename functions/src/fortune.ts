import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import { db, FieldValue, getOpenAI, sendPushToUser } from "./base";

// 1. Create Fortune Reading (Backend Controlled)
export const createFortuneReading = functions.region('us-central1').https.onCall(async (data, context) => {
  console.log("createFortuneReading called for type:", data?.type);
  try {
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    
    const userId = context.auth.uid;
    const { type, formData, questions, priorityMode } = data || {};

    if (!type || !formData) throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');

    // Sanitize formData
    const sanitizedFormData: any = {
      adSoyad: formData.adSoyad || "",
      dogumTarihi: formData.dogumTarihi || "",
      iliskiDurumu: formData.iliskiDurumu || ""
    };

    if (['water', 'ebced', 'yildizname', 'havas'].includes(type)) {
      sanitizedFormData.motherName = formData.motherName || "";
      sanitizedFormData.fatherName = formData.fatherName || "";
    }

    const requestString = JSON.stringify({ userId, type, formData: sanitizedFormData, questions });
    const requestHash = crypto.createHash('md5').update(requestString).digest('hex');

    const userRef = db.collection("users").doc(userId);
    const economyRef = db.collection("adminSettings").doc("economy");
    
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
        subscriptionLimits: { totalDaily: 10 }
      };

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
      const subLimits = economy.subscriptionLimits || { totalDaily: 10 };

      if (sub && sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt) > new Date()) {
        const dailyUsed = sub.dailyLimitUsed || 0;
        const lastReset = sub.lastResetAt || "";
        if (lastReset === today && dailyUsed >= subLimits.totalDaily) {
          throw new functions.https.HttpsError('resource-exhausted', 'Günlük fal limitinize ulaştınız.');
        }
        balanceType = 'subscription';
      }

      // Balance Separation: Energy preferred for Fortunes
      if (balanceType === 'main' && (userData.energy || 0) >= totalCost) {
        balanceType = 'energy';
      }

      if (balanceType === 'main' && (userData.mainCoins || 0) < totalCost) {
        throw new functions.https.HttpsError('failed-precondition', 'Yetersiz enerji veya jeton (Mağaza\'dan enerji toplayabilirsin).');
      }

      const userUpdates: any = {};
      if (balanceType === 'main') userUpdates.mainCoins = FieldValue.increment(-totalCost);
      else if (balanceType === 'energy') userUpdates.energy = FieldValue.increment(-totalCost);
      else if (balanceType === 'subscription') {
        userUpdates["subscription.dailyLimitUsed"] = (userData.subscription?.lastResetAt !== today) ? 1 : FieldValue.increment(1);
        userUpdates["subscription.lastResetAt"] = today;
      }
      transaction.update(userRef, userUpdates);

      const readingRef = db.collection("readings").doc();
      const now = new Date();
      const effectivePriorityMode = priorityMode || (balanceType === 'subscription');
      
      const fakeConfig = economy.fakeProcessing || {
        readerFindingMinDelay: 60000, readerFindingMaxDelay: 180000,
        interpretationMinDelay: 300000, interpretationMaxDelay: 1200000
      };

      const searchDelay = (Math.random() * (fakeConfig.readerFindingMaxDelay - fakeConfig.readerFindingMinDelay) + fakeConfig.readerFindingMinDelay);
      const interpretationDelay = (Math.random() * (fakeConfig.interpretationMaxDelay - fakeConfig.interpretationMinDelay) + fakeConfig.interpretationMinDelay);
      const speedFactor = effectivePriorityMode ? 0.5 : 1.0;

      const expectedReaderFoundAt = new Date(now.getTime() + searchDelay * speedFactor);
      const interpretationStartedAt = new Date(expectedReaderFoundAt.getTime() + (interpretationDelay * 0.2) * speedFactor);
      const expectedCompletedAt = new Date(expectedReaderFoundAt.getTime() + interpretationDelay * speedFactor);

      const readingData = {
        id: readingRef.id, userId, type, status: 'searching', requestHash, formData: sanitizedFormData,
        questions: Array.isArray(questions) ? questions.map((q: any) => typeof q === 'string' ? q : q.text).filter(Boolean) : [],
        priorityMode: !!effectivePriorityMode, balanceType, creditsUsed: balanceType === 'subscription' ? 0 : totalCost,
        createdAt: now.toISOString(), updatedAt: now.toISOString(), expectedReaderFoundAt: expectedReaderFoundAt.toISOString(),
        interpretationStartedAt: interpretationStartedAt.toISOString(), expectedCompletedAt: expectedCompletedAt.toISOString(),
        title: type === 'coffee' ? 'Kahve Falı' : type === 'tarot' ? 'Tarot Açılımı' : type.charAt(0).toUpperCase() + type.slice(1),
        isSeenByUser: false
      };

      transaction.set(readingRef, readingData);

      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id, userId, type: 'spend', source: 'fortune_reading',
        amount: balanceType === 'subscription' ? 0 : -totalCost,
        balanceType: balanceType === 'energy' ? 'energy' : 'main',
        createdAt: now.toISOString(), status: 'spent', description: `${readingData.title} için harcama`
      });

      return { success: true, readingId: readingRef.id };
    });
  } catch (err: any) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', `Fortune Creation Error: ${err.message}`);
  }
});

// 2. Process Fortune AI
export const processFortuneAI = functions.region('us-central1').runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    const openai = getOpenAI();
    if (!data || !data.readingId) throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');
    const { readingId } = data;

    const readingRef = db.collection("readings").doc(readingId);
    const result = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(readingRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Fal kaydı bulunamadı.');
      const reading = snap.data() as any;
      if (reading.userId !== userId) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');
      if (reading.status === 'completed') return { alreadyCompleted: true, content: reading.content };
      if (reading.status === 'processing_ai') return { alreadyProcessing: true };
      transaction.update(readingRef, { isAIGenerating: true, updatedAt: new Date().toISOString() });
      return { reading, proceed: true };
    });

    if (result.alreadyCompleted) return { success: true, content: result.content };
    if (result.alreadyProcessing) return { success: true, message: "Falınız zaten hazırlanıyor..." };
    
    const reading = result.reading;
    const economySnap = await db.collection("adminSettings").doc("economy").get();
    const economy = economySnap.data() as any;
    const aiConfig = economy?.aiSettings?.[reading.type] || {
      systemPrompt: "Sen LASYA isminde mistik bir kahinsin.",
      templatePrompt: "Kullanıcı {adsoyad}, {dogumtarihi} doğumlu, {iliskidurumu}. Soruları: {sorular}. Lütfen yorumla.",
      tone: "Karizmatik", mysticLevel: 9
    };

    const placeholders: Record<string, string> = {
      adsoyad: reading.formData.adSoyad || "Canım", dogumtarihi: reading.formData.dogumTarihi || "Bilinmiyor",
      iliskidurumu: reading.formData.iliskiDurumu || "Bilinmiyor", anneadi: reading.formData.motherName || "Bilinmiyor",
      babaadi: reading.formData.fatherName || "Bilinmiyor", sorular: Array.isArray(reading.questions) ? reading.questions.join(", ") : "Genel yorum",
      tur: reading.type, isim: reading.formData.adSoyad?.split(" ")[0] || "Canım"
    };

    let systemPrompt = `Sen Ahlas adında, karizmatik, gizemli ve hafif flörtöz bir erkek falcısın... ` + aiConfig.systemPrompt;
    let templatePrompt = aiConfig.templatePrompt;
    Object.entries(placeholders).forEach(([key, value]) => {
      const regex = new RegExp(`{${key}}`, 'g');
      systemPrompt = systemPrompt.replace(regex, value);
      templatePrompt = templatePrompt.replace(regex, value);
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: templatePrompt }],
      temperature: 0.8, max_tokens: 2000
    });
    let content = response.choices[0].message.content || "";
    content = content.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

    await readingRef.update({ hiddenResult: content, isAIGenerated: true, isAIGenerating: false, updatedAt: new Date().toISOString() });
    return { success: true };
  } catch (error: any) {
    console.error("processFortuneAI error:", error);
    
    // START REFUND LOGIC
    try {
      const readingRef = db.collection("readings").doc(data?.readingId);
      const snap = await readingRef.get();
      if (snap.exists) {
        const reading = snap.data() as any;
        if (reading.status !== 'completed' && reading.creditsUsed > 0) {
          const { refundTransaction } = require("./wallet");
          await refundTransaction(userId, reading.creditsUsed, reading.balanceType === 'energy' ? 'energy' : 'main');
          await readingRef.update({ status: 'error', refundStatus: 'processed', updatedAt: new Date().toISOString() });
        }
      }
    } catch (refundErr) {
      console.error("Refund failed during processFortuneAI failure:", refundErr);
    }
    // END REFUND LOGIC

    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'AI üretimi sırasında hata oluştu.');
  }
});

// 3. Upgrade Fortune Priority
export const upgradeFortunePriority = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.readingId) throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');
    const { readingId } = data;

    const readingRef = db.collection("readings").doc(readingId);
    return await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(readingRef);
      if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Fal kaydı bulunamadı.');
      const reading = snap.data() as any;
      if (reading.userId !== userId) throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');
      
      const economySnap = await db.collection("adminSettings").doc("economy").get();
      const priorityFee = economySnap.data()?.fortunePricing?.priorityFee || 100;

      const userRef = db.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      if ((userSnap.data()?.mainCoins || 0) < priorityFee) throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');

      transaction.update(userRef, { mainCoins: FieldValue.increment(-priorityFee) });
      transaction.update(readingRef, { priorityMode: true, updatedAt: new Date().toISOString() });
      return { success: true };
    });
  } catch (error: any) {
    console.error("upgradeFortunePriority error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Önceliği yükseltirken hata oluştu.');
  }
});

// 4. Generate Daily Message
export const generateDailyMessage = functions.region('us-central1').runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  
  try {
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Sen bilge bir kahinsin. Kullanıcılara günlük kısa, mistik mesajlar veriyorsun." },
        { role: "user", content: "Kısa, gizemli bir cümle yaz. Maksimum 15 kelime." }
      ],
      temperature: 0.8, max_tokens: 100
    });
    return { text: response.choices[0].message.content || "Yıldızlar seninle.", category: 'general' };
  } catch (error: any) {
    console.error("generateDailyMessage error:", error);
    return { text: "Yıldızlar bugün senin için parlıyor.", category: 'general' };
  }
});

// 5. Background Status Updater
export const updateReadingStatuses = functions.region('us-central1').pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const now = new Date().toISOString();
  const searchings = await db.collection("readings").where("status", "==", "searching").where("expectedReaderFoundAt", "<=", now).limit(50).get();
  for (const doc of searchings.docs) {
    await doc.ref.update({ status: 'found', updatedAt: now });
    await sendPushToUser(doc.data().userId, { title: 'Yorumcu Bulundu!', body: 'Yorumlanmaya başlanıyor.', category: 'fortunes' });
  }
  const founds = await db.collection("readings").where("status", "==", "found").where("interpretationStartedAt", "<=", now).limit(50).get();
  for (const doc of founds.docs) {
    await doc.ref.update({ status: 'interpreting', updatedAt: now });
  }
  const checkCompletes = await db.collection("readings").where("status", "==", "interpreting").where("expectedCompletedAt", "<=", now).limit(50).get();
  for (const doc of checkCompletes.docs) {
    if (doc.data().isAIGenerated && doc.data().hiddenResult) {
      await doc.ref.update({ status: 'completed', content: doc.data().hiddenResult, resultText: doc.data().hiddenResult, updatedAt: now });
      await sendPushToUser(doc.data().userId, { title: 'Falınız Hazır!', body: 'Hemen inceleyin!', category: 'fortunes' });
    }
  }
});
