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
exports.updateReadingStatuses = exports.generateDailyMessage = exports.upgradeFortunePriority = exports.processFortuneAI = exports.createFortuneReading = void 0;
const functions = __importStar(require("firebase-functions"));
const crypto = __importStar(require("crypto"));
const base_1 = require("./base");
exports.createFortuneReading = functions.region('us-central1').https.onCall(async (data, context) => {
    console.log("createFortuneReading called for type:", data?.type);
    try {
        if (!context.auth)
            throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
        const userId = context.auth.uid;
        const { type, formData, questions, priorityMode } = data || {};
        if (!type || !formData)
            throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
        const sanitizedFormData = {
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
        const userRef = base_1.db.collection("users").doc(userId);
        const economyRef = base_1.db.collection("adminSettings").doc("economy");
        const activeReadings = await base_1.db.collection("readings")
            .where("userId", "==", userId)
            .where("status", "in", ["searching", "found", "interpreting", "waiting"])
            .limit(1)
            .get();
        if (!activeReadings.empty) {
            throw new functions.https.HttpsError('already-exists', 'Zaten aktif bir fal talebiniz var.');
        }
        const duplicateCheck = await base_1.db.collection("readings")
            .where("requestHash", "==", requestHash)
            .where("createdAt", ">", new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .limit(1)
            .get();
        if (!duplicateCheck.empty) {
            throw new functions.https.HttpsError('already-exists', 'Bu fal talebi zaten gönderilmiş.');
        }
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
            const userData = userSnap.data();
            const economySnap = await transaction.get(economyRef);
            const economy = economySnap.exists ? economySnap.data() : {
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
            let balanceType = 'main';
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
            if (balanceType === 'main' && (userData.energy || 0) >= totalCost) {
                balanceType = 'energy';
            }
            if (balanceType === 'main' && (userData.mainCoins || 0) < totalCost) {
                throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
            }
            const userUpdates = {};
            if (balanceType === 'main')
                userUpdates.mainCoins = base_1.FieldValue.increment(-totalCost);
            else if (balanceType === 'energy')
                userUpdates.energy = base_1.FieldValue.increment(-totalCost);
            else if (balanceType === 'subscription') {
                userUpdates["subscription.dailyLimitUsed"] = (userData.subscription?.lastResetAt !== today) ? 1 : base_1.FieldValue.increment(1);
                userUpdates["subscription.lastResetAt"] = today;
            }
            transaction.update(userRef, userUpdates);
            const readingRef = base_1.db.collection("readings").doc();
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
                questions: Array.isArray(questions) ? questions.map((q) => typeof q === 'string' ? q : q.text).filter(Boolean) : [],
                priorityMode: !!effectivePriorityMode, balanceType, creditsUsed: balanceType === 'subscription' ? 0 : totalCost,
                createdAt: now.toISOString(), updatedAt: now.toISOString(), expectedReaderFoundAt: expectedReaderFoundAt.toISOString(),
                interpretationStartedAt: interpretationStartedAt.toISOString(), expectedCompletedAt: expectedCompletedAt.toISOString(),
                title: type === 'coffee' ? 'Kahve Falı' : type === 'tarot' ? 'Tarot Açılımı' : type.charAt(0).toUpperCase() + type.slice(1),
                isSeenByUser: false
            };
            transaction.set(readingRef, readingData);
            const txRef = base_1.db.collection("walletTransactions").doc();
            transaction.set(txRef, {
                id: txRef.id, userId, type: 'spend', source: 'fortune_reading',
                amount: balanceType === 'subscription' ? 0 : -totalCost,
                balanceType: balanceType === 'energy' ? 'energy' : 'main',
                createdAt: now.toISOString(), status: 'spent', description: `${readingData.title} için harcama`
            });
            return { success: true, readingId: readingRef.id };
        });
    }
    catch (err) {
        if (err instanceof functions.https.HttpsError)
            throw err;
        throw new functions.https.HttpsError('internal', `Fortune Creation Error: ${err.message}`);
    }
});
exports.processFortuneAI = functions.region('us-central1').runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        const openai = (0, base_1.getOpenAI)();
        if (!data || !data.readingId)
            throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');
        const { readingId } = data;
        const readingRef = base_1.db.collection("readings").doc(readingId);
        const result = await base_1.db.runTransaction(async (transaction) => {
            const snap = await transaction.get(readingRef);
            if (!snap.exists)
                throw new Error('Fal kaydı bulunamadı.');
            const reading = snap.data();
            if (reading.userId !== userId)
                throw new Error('Yetkisiz erişim.');
            if (reading.status === 'completed')
                return { alreadyCompleted: true, content: reading.content };
            if (reading.status === 'processing_ai')
                return { alreadyProcessing: true };
            transaction.update(readingRef, { isAIGenerating: true, updatedAt: new Date().toISOString() });
            return { reading, proceed: true };
        });
        if (result.alreadyCompleted)
            return { success: true, content: result.content };
        if (result.alreadyProcessing)
            return { success: true, message: "Falınız zaten hazırlanıyor..." };
        const reading = result.reading;
        const economySnap = await base_1.db.collection("adminSettings").doc("economy").get();
        const economy = economySnap.data();
        const aiConfig = economy?.aiSettings?.[reading.type] || {
            systemPrompt: "Sen LASYA isminde mistik bir kahinsin.",
            templatePrompt: "Kullanıcı {adsoyad}, {dogumtarihi} doğumlu, {iliskidurumu}. Soruları: {sorular}. Lütfen yorumla.",
            tone: "Karizmatik", mysticLevel: 9
        };
        const placeholders = {
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
    }
    catch (error) {
        console.error("processFortuneAI error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'AI üretimi sırasında hata oluştu.');
    }
});
exports.upgradeFortunePriority = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.readingId)
            throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');
        const { readingId } = data;
        const readingRef = base_1.db.collection("readings").doc(readingId);
        return await base_1.db.runTransaction(async (transaction) => {
            const snap = await transaction.get(readingRef);
            if (!snap.exists)
                throw new Error('Fal kaydı bulunamadı.');
            const reading = snap.data();
            if (reading.userId !== userId)
                throw new Error('Yetkisiz erişim.');
            const economySnap = await base_1.db.collection("adminSettings").doc("economy").get();
            const priorityFee = economySnap.data()?.fortunePricing?.priorityFee || 100;
            const userRef = base_1.db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            if ((userSnap.data()?.mainCoins || 0) < priorityFee)
                throw new Error('Yetersiz bakiye.');
            transaction.update(userRef, { mainCoins: base_1.FieldValue.increment(-priorityFee) });
            transaction.update(readingRef, { priorityMode: true, updatedAt: new Date().toISOString() });
            return { success: true };
        });
    }
    catch (error) {
        console.error("upgradeFortunePriority error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Önceliği yükseltirken hata oluştu.');
    }
});
exports.generateDailyMessage = functions.region('us-central1').runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    try {
        const openai = (0, base_1.getOpenAI)();
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Sen bilge bir kahinsin. Kullanıcılara günlük kısa, mistik mesajlar veriyorsun." },
                { role: "user", content: "Kısa, gizemli bir cümle yaz. Maksimum 15 kelime." }
            ],
            temperature: 0.8, max_tokens: 100
        });
        return { text: response.choices[0].message.content || "Yıldızlar seninle.", category: 'general' };
    }
    catch (error) {
        console.error("generateDailyMessage error:", error);
        return { text: "Yıldızlar bugün senin için parlıyor.", category: 'general' };
    }
});
exports.updateReadingStatuses = functions.region('us-central1').pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const now = new Date().toISOString();
    const searchings = await base_1.db.collection("readings").where("status", "==", "searching").where("expectedReaderFoundAt", "<=", now).limit(50).get();
    for (const doc of searchings.docs) {
        await doc.ref.update({ status: 'found', updatedAt: now });
        await (0, base_1.sendPushToUser)(doc.data().userId, { title: 'Yorumcu Bulundu!', body: 'Yorumlanmaya başlanıyor.', category: 'fortunes' });
    }
    const founds = await base_1.db.collection("readings").where("status", "==", "found").where("interpretationStartedAt", "<=", now).limit(50).get();
    for (const doc of founds.docs) {
        await doc.ref.update({ status: 'interpreting', updatedAt: now });
    }
    const checkCompletes = await base_1.db.collection("readings").where("status", "==", "interpreting").where("expectedCompletedAt", "<=", now).limit(50).get();
    for (const doc of checkCompletes.docs) {
        if (doc.data().isAIGenerated && doc.data().hiddenResult) {
            await doc.ref.update({ status: 'completed', content: doc.data().hiddenResult, resultText: doc.data().hiddenResult, updatedAt: now });
            await (0, base_1.sendPushToUser)(doc.data().userId, { title: 'Falınız Hazır!', body: 'Hemen inceleyin!', category: 'fortunes' });
        }
    }
});
//# sourceMappingURL=fortune.js.map