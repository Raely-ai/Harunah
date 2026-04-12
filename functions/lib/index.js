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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runManualCompatibilityAnalysis = exports.runDiscoverCompatibilityAnalysis = exports.refreshDiscoverFeed = exports.sendSuperLikeAndCreateChat = exports.completeSocialOnboarding = exports.adminAdjustWallet = exports.adminSetWallet = exports.redeemPromoCode = exports.adminModerationAction = exports.getAdminChatMessages = exports.getAdminUserChats = exports.adminGrantWalletReward = exports.refreshDiscover = exports.updateSocialSettings = exports.consumeSocialFeature = exports.purchaseSocialBundle = exports.purchaseSocialItem = exports.purchaseBoostPackage = exports.buyFortuneSubscription = exports.spendBalance = exports.purchaseCoins = exports.watchAdReward = exports.updateReadingStatuses = exports.generateDailyMessage = exports.upgradeFortunePriority = exports.processFortuneAI = exports.createFortuneReading = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const openai_1 = __importDefault(require("openai"));
const params_1 = require("firebase-functions/params");
const crypto = __importStar(require("crypto"));
admin.initializeApp({
    projectId: "gen-lang-client-0107919355"
});
const db = (0, firestore_1.getFirestore)("ai-studio-71aa84b8-dbfc-4fbb-ab63-365a3c94301c");
const openAiKey = (0, params_1.defineSecret)("OPENAI_API_KEY");
let _openai = null;
function getOpenAI() {
    if (!_openai) {
        const key = openAiKey.value();
        if (!key) {
            throw new Error("OPENAI_API_KEY is not set in environment/secrets.");
        }
        _openai = new openai_1.default({ apiKey: key });
    }
    return _openai;
}
exports.createFortuneReading = functions.https.onCall(async (data, context) => {
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
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
            const userData = userSnap.data();
            const economySnap = await transaction.get(economyRef);
            const economy = economySnap.exists ? economySnap.data() : {
                fortunePricing: { coffee: 100, tarot: 150, water: 200, ebced: 250, yildizname: 300, havas: 500, extraQuestion: 50, priorityFee: 100 },
                subscriptionLimits: { totalDaily: 10 },
                interpretationTimes: {
                    coffee: { minSearchTime: 1, maxSearchTime: 3, minInterpreterTime: 5, maxInterpreterTime: 10, minReadingTime: 10, maxReadingTime: 20 },
                    tarot: { minSearchTime: 1, maxSearchTime: 3, minInterpreterTime: 5, maxInterpreterTime: 10, minReadingTime: 10, maxReadingTime: 20 },
                    advanced: { minSearchTime: 2, maxSearchTime: 5, minInterpreterTime: 10, maxInterpreterTime: 15, minReadingTime: 15, maxReadingTime: 30 }
                }
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
                    throw new functions.https.HttpsError('resource-exhausted', 'Günlük fal limitinize ulaştınız. Yarın tekrar bekleriz!');
                }
                balanceType = 'subscription';
            }
            if (balanceType === 'main') {
                if ((userData.energy || 0) >= totalCost) {
                    balanceType = 'energy';
                }
            }
            if (balanceType === 'main') {
                if ((userData.mainCoins || 0) < totalCost) {
                    throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
                }
            }
            const userUpdates = {};
            if (balanceType === 'main') {
                userUpdates.mainCoins = firestore_1.FieldValue.increment(-totalCost);
            }
            else if (balanceType === 'energy') {
                userUpdates.energy = firestore_1.FieldValue.increment(-totalCost);
            }
            else if (balanceType === 'subscription') {
                if (userData.subscription?.lastResetAt !== today) {
                    userUpdates["subscription.dailyLimitUsed"] = 1;
                }
                else {
                    userUpdates["subscription.dailyLimitUsed"] = firestore_1.FieldValue.increment(1);
                }
                userUpdates["subscription.lastResetAt"] = today;
            }
            transaction.update(userRef, userUpdates);
            const readingRef = db.collection("readings").doc();
            const now = new Date();
            const effectivePriorityMode = priorityMode || (balanceType === 'subscription');
            const fakeConfig = economy.fakeProcessing || {
                readerFindingMinDelay: 60000,
                readerFindingMaxDelay: 180000,
                interpretationMinDelay: 300000,
                interpretationMaxDelay: 1200000
            };
            const searchDelay = (Math.random() * (fakeConfig.readerFindingMaxDelay - fakeConfig.readerFindingMinDelay) + fakeConfig.readerFindingMinDelay);
            const interpretationDelay = (Math.random() * (fakeConfig.interpretationMaxDelay - fakeConfig.interpretationMinDelay) + fakeConfig.interpretationMinDelay);
            const speedFactor = effectivePriorityMode ? 0.5 : 1.0;
            const expectedReaderFoundAt = new Date(now.getTime() + searchDelay * speedFactor);
            const interpretationStartedAt = new Date(expectedReaderFoundAt.getTime() + (interpretationDelay * 0.2) * speedFactor);
            const expectedCompletedAt = new Date(expectedReaderFoundAt.getTime() + interpretationDelay * speedFactor);
            const readingData = {
                id: readingRef.id,
                userId,
                type,
                status: 'searching',
                requestHash,
                formData: sanitizedFormData,
                questions: Array.isArray(questions) ? questions.map((q) => typeof q === 'string' ? q : q.text).filter(Boolean) : [],
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
    }
    catch (err) {
        console.error("Fortune creation failed:", err);
        if (err instanceof functions.https.HttpsError) {
            throw err;
        }
        let errorMessage = "Bilinmeyen bir hata oluştu.";
        try {
            errorMessage = err.message || String(err);
        }
        catch (e) {
        }
        throw new functions.https.HttpsError('internal', `Fortune Creation Error: ${errorMessage}`);
    }
});
exports.processFortuneAI = functions.runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const openai = getOpenAI();
    const { readingId } = data;
    if (!readingId)
        throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');
    const readingRef = db.collection("readings").doc(readingId);
    let readingSnap = await readingRef.get();
    if (!readingSnap.exists) {
        console.log(`Reading ${readingId} not found, retrying in 2s...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        readingSnap = await readingRef.get();
    }
    if (!readingSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Fal kaydı henüz oluşturulmadı veya bulunamadı.');
    }
    const result = await db.runTransaction(async (transaction) => {
        const freshSnap = await transaction.get(readingRef);
        if (!freshSnap.exists)
            throw new Error('Fal kaydı bulunamadı.');
        const reading = freshSnap.data();
        if (reading.userId !== userId)
            throw new Error('Yetkisiz erişim.');
        if (reading.status === 'completed')
            return { alreadyCompleted: true, content: reading.content };
        if (reading.status === 'processing_ai')
            return { alreadyProcessing: true };
        transaction.update(readingRef, {
            isAIGenerating: true,
            updatedAt: new Date().toISOString()
        });
        return { reading, proceed: true };
    }).catch(err => {
        throw new functions.https.HttpsError('internal', `AI Process Error: ${err.message} | Stack: ${err.stack}`);
    });
    if (result.alreadyCompleted)
        return { success: true, content: result.content };
    if (result.alreadyProcessing)
        return { success: true, message: "Falınız zaten hazırlanıyor..." };
    const reading = result.reading;
    await db.collection("notifications").add({
        userId: reading.userId,
        type: 'system',
        title: 'Falınız Yorumlanıyor',
        message: `${reading.title} yorumunuz LASYA tarafından hazırlanıyor.`,
        read: false,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        data: { readingId }
    });
    const economySnap = await db.collection("adminSettings").doc("economy").get();
    const economy = economySnap.data();
    const aiConfig = economy?.aiSettings?.[reading.type] || {
        systemPrompt: "Sen LASYA isminde mistik bir kahinsin.",
        templatePrompt: "Kullanıcı {adsoyad}, {dogumtarihi} doğumlu, {iliskidurumu}. Soruları: {sorular}. Lütfen yorumla.",
        tone: "Karizmatik",
        mysticLevel: 9
    };
    const placeholders = {
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
    console.log("AI DEBUG - reading.type:", reading.type);
    console.log("AI DEBUG - aiConfig:", aiConfig);
    console.log("AI DEBUG - systemPrompt (final):", systemPrompt);
    console.log("AI DEBUG - templatePrompt (final):", templatePrompt);
    if (economy?.aiSettings?.[reading.type]) {
        console.log("AI DEBUG - ADMIN PROMPT KULLANILIYOR");
    }
    else {
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
        await readingRef.update({
            hiddenResult: content,
            isAIGenerated: true,
            isAIGenerating: false,
            updatedAt: new Date().toISOString()
        });
        return { success: true };
    }
    catch (error) {
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
exports.upgradeFortunePriority = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { readingId } = data;
    if (!readingId)
        throw new functions.https.HttpsError('invalid-argument', 'Reading ID gerekli.');
    const readingRef = db.collection("readings").doc(readingId);
    const userRef = db.collection("users").doc(userId);
    const economyRef = db.collection("adminSettings").doc("economy");
    return await db.runTransaction(async (transaction) => {
        const readingSnap = await transaction.get(readingRef);
        if (!readingSnap.exists)
            throw new functions.https.HttpsError('not-found', 'Fal kaydı bulunamadı.');
        const reading = readingSnap.data();
        if (reading.userId !== userId)
            throw new functions.https.HttpsError('permission-denied', 'Yetkisiz erişim.');
        if (reading.priorityMode)
            throw new functions.https.HttpsError('failed-precondition', 'Zaten öncelikli sırada.');
        if (reading.status !== 'searching')
            throw new functions.https.HttpsError('failed-precondition', 'Sadece arama aşamasında yükseltilebilir.');
        const economySnap = await transaction.get(economyRef);
        const priorityFee = economySnap.data()?.fortunePricing?.priorityFee || 100;
        const userSnap = await transaction.get(userRef);
        const userData = userSnap.data();
        if ((userData.mainCoins || 0) < priorityFee) {
            throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
        }
        transaction.update(userRef, {
            mainCoins: firestore_1.FieldValue.increment(-priorityFee)
        });
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
exports.generateDailyMessage = functions.runWith({ secrets: ["OPENAI_API_KEY"] }).https.onCall(async (data, context) => {
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
        const categories = ['love', 'career', 'general'];
        const category = categories[Math.floor(Math.random() * categories.length)];
        return { text, category };
    }
    catch (error) {
        console.error("Daily message AI error:", error);
        return { text: "Yıldızlar bugün senin için parlıyor.", category: 'general' };
    }
});
exports.updateReadingStatuses = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    const now = new Date().toISOString();
    const searchingReadings = await db.collection("readings")
        .where("status", "==", "searching")
        .where("expectedReaderFoundAt", "<=", now)
        .limit(50)
        .get();
    for (const doc of searchingReadings.docs) {
        const reading = doc.data();
        await doc.ref.update({ status: 'found', updatedAt: now });
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
    const foundReadings = await db.collection("readings")
        .where("status", "==", "found")
        .where("interpretationStartedAt", "<=", now)
        .limit(50)
        .get();
    for (const doc of foundReadings.docs) {
        const reading = doc.data();
        await doc.ref.update({ status: 'interpreting', updatedAt: now });
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
    const interpretingReadings = await db.collection("readings")
        .where("status", "==", "interpreting")
        .where("expectedCompletedAt", "<=", now)
        .limit(50)
        .get();
    for (const doc of interpretingReadings.docs) {
        const reading = doc.data();
        if (reading.isAIGenerated && reading.hiddenResult) {
            await doc.ref.update({
                status: 'completed',
                content: reading.hiddenResult,
                resultText: reading.hiddenResult,
                updatedAt: now
            });
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
exports.watchAdReward = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const configSnap = await db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists)
        throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
    const economy = configSnap.data();
    const adRewardEnergy = economy.rewards?.adRewardEnergy || 10;
    const maxDailyAds = economy.rewards?.maxDailyAds || 5;
    const adRewardExpiryDays = economy.rewards?.adRewardExpiryDays || 7;
    const userRef = db.collection("users").doc(userId);
    return await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists)
            throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
        const userData = userSnap.data();
        const today = new Date().toISOString().split('T')[0];
        const lastReset = userData.lastAdReset ? userData.lastAdReset.split('T')[0] : "";
        let dailyCount = userData.dailyAdWatchCount || 0;
        if (today !== lastReset)
            dailyCount = 0;
        if (dailyCount >= maxDailyAds) {
            throw new functions.https.HttpsError('failed-precondition', 'Günlük reklam sınırı aşıldı.');
        }
        const now = new Date();
        const expiresAt = new Date();
        expiresAt.setDate(now.getDate() + adRewardExpiryDays);
        transaction.update(userRef, {
            energy: firestore_1.FieldValue.increment(adRewardEnergy),
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
exports.purchaseCoins = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { amount, packageId, balanceType = 'main' } = data;
    if (typeof amount !== 'number' || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Miktar pozitif bir sayı olmalıdır.');
    }
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    await db.runTransaction(async (transaction) => {
        const updates = {};
        if (balanceType === 'main')
            updates.mainCoins = firestore_1.FieldValue.increment(amount);
        else
            updates.energy = firestore_1.FieldValue.increment(amount);
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
exports.spendBalance = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { balanceType, amount, source, description } = data;
    if (typeof amount !== 'number' || amount <= 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Harcama miktarı pozitif olmalıdır.');
    }
    const userRef = db.collection("users").doc(userId);
    const now = new Date().toISOString();
    try {
        let energyTxs = [];
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
            if (!userSnap.exists)
                throw new Error("Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const currentBalance = balanceType === 'main' ? (userData.mainCoins || 0) : (userData.energy || 0);
            if (currentBalance < amount)
                throw new Error("Yetersiz bakiye.");
            if (balanceType === 'energy') {
                let remainingToSpend = amount;
                for (const tx of energyTxs) {
                    if (remainingToSpend <= 0)
                        break;
                    const available = tx.remainingAmount;
                    if (available <= remainingToSpend) {
                        transaction.update(tx.ref, { remainingAmount: 0, status: 'spent' });
                        remainingToSpend -= available;
                    }
                    else {
                        transaction.update(tx.ref, { remainingAmount: available - remainingToSpend });
                        remainingToSpend = 0;
                    }
                }
                if (remainingToSpend > 0)
                    throw new Error("Enerji bakiyesi doğrulanamadı.");
            }
            const updates = {};
            if (balanceType === 'main')
                updates.mainCoins = currentBalance - amount;
            else
                updates.energy = currentBalance - amount;
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
    }
    catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
exports.buyFortuneSubscription = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { type } = data;
    const configSnap = await db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists)
        throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
    const economy = configSnap.data();
    const subConfig = economy.fortuneSubscriptions[type];
    if (!subConfig)
        throw new functions.https.HttpsError('invalid-argument', 'Geçersiz abonelik tipi.');
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    let expiresAt = new Date();
    if (type === 'daily')
        expiresAt.setDate(now.getDate() + 1);
    else if (type === 'weekly')
        expiresAt.setDate(now.getDate() + 7);
    else if (type === 'monthly')
        expiresAt.setDate(now.getDate() + 30);
    return await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists)
            throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data();
        const price = subConfig.priceTRY || subConfig.price;
        if ((userData.mainCoins || 0) < price) {
            throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
        }
        if (userData.subscription && userData.subscription.status === 'active') {
            const currentExpires = new Date(userData.subscription.expiresAt);
            if (currentExpires > now) {
                throw new functions.https.HttpsError('failed-precondition', 'Zaten aktif bir fal aboneliğiniz var.');
            }
        }
        transaction.update(userRef, {
            mainCoins: firestore_1.FieldValue.increment(-price),
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
exports.purchaseBoostPackage = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { type } = data;
    const configSnap = await db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists)
        throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
    const economy = configSnap.data();
    const boostConfig = economy.boostPackages?.[type] || (type === 'weekly' ? { days: 7, priceTRY: 49.99 } : { days: 30, priceTRY: 149.99 });
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    return await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists)
            throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data();
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
exports.purchaseSocialItem = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { type, description } = data;
    const configSnap = await db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists)
        throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
    const economy = configSnap.data();
    const priceKey = type === 'superLike' ? 'superLike' : type === 'refresh' ? 'refresh' : 'compatibility';
    const price = (economy.socialPricing && economy.socialPricing[priceKey] && economy.socialPricing[priceKey][0]?.priceCoins) || 20;
    const userRef = db.collection("users").doc(userId);
    return await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists)
            throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data();
        if ((userData.mainCoins || 0) < price)
            throw new Error("Yetersiz bakiye.");
        const updates = {
            mainCoins: firestore_1.FieldValue.increment(-price)
        };
        if (type === 'superLike')
            updates.superLikes = firestore_1.FieldValue.increment(1);
        if (type === 'refresh')
            updates.refreshCount = firestore_1.FieldValue.increment(1);
        if (type === 'compatibility')
            updates.compatibilityCount = firestore_1.FieldValue.increment(1);
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
exports.purchaseSocialBundle = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { bundleId } = data;
    const configSnap = await db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists)
        throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
    const economy = configSnap.data();
    const bundles = economy.socialBundles || [
        {
            id: "starter_bundle",
            name: "Başlangıç Paketi",
            price: 150,
            contents: { superLikes: 5, refreshes: 5, compatibility: 5, boostDays: 7 }
        }
    ];
    const bundle = bundles.find((b) => b.id === bundleId);
    if (!bundle)
        throw new functions.https.HttpsError('not-found', 'Paket bulunamadı.');
    const userRef = db.collection("users").doc(userId);
    return await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists)
            throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data();
        if ((userData.mainCoins || 0) < bundle.price)
            throw new Error("Yetersiz bakiye.");
        const now = new Date();
        transaction.update(userRef, {
            mainCoins: firestore_1.FieldValue.increment(-bundle.price),
            superLikes: firestore_1.FieldValue.increment(bundle.contents.superLikes),
            refreshCount: firestore_1.FieldValue.increment(bundle.contents.refreshes),
            compatibilityCount: firestore_1.FieldValue.increment(bundle.contents.compatibility)
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
exports.consumeSocialFeature = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { type, config } = data;
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    return await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists)
            throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data();
        let consumedFrom = 'paid';
        if (type === 'swipe') {
            const dailyUsed = userData.dailySwipeUsed || 0;
            const lastDate = userData.dailySwipeDate || "";
            const maxSwipes = config.freeDailySwipes || 50;
            if (lastDate !== today) {
                transaction.update(userRef, { dailySwipeUsed: 1, dailySwipeDate: today });
            }
            else {
                if (dailyUsed >= maxSwipes)
                    throw new Error("Günlük kaydırma sınırına ulaştınız.");
                transaction.update(userRef, { dailySwipeUsed: firestore_1.FieldValue.increment(1) });
            }
        }
        else {
            const field = type === 'superLike' ? 'superLikes' : type === 'refresh' ? 'refreshCount' : 'compatibilityCount';
            if ((userData[field] || 0) <= 0)
                throw new Error("Yetersiz hak.");
            transaction.update(userRef, { [field]: firestore_1.FieldValue.increment(-1) });
        }
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
exports.updateSocialSettings = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { settings } = data;
    if (!settings)
        throw new functions.https.HttpsError('invalid-argument', 'Ayarlar gerekli.');
    const userRef = db.collection("users").doc(userId);
    const allowedFields = [
        'visibility', 'discoveryEnabled', 'notificationsEnabled',
        'genderPreference', 'minAge', 'maxAge',
        'whoCanMessage', 'whoCanAddFriend', 'notifications'
    ];
    const updates = {};
    Object.keys(settings).forEach(key => {
        if (allowedFields.includes(key)) {
            updates[`social.settings.${key}`] = settings[key];
        }
    });
    if (Object.keys(updates).length === 0)
        return { success: true };
    await userRef.update(updates);
    return { success: true };
});
exports.refreshDiscover = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    return await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists)
            throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data();
        let consumedFrom = 'paid';
        if ((userData.refreshCount || 0) <= 0)
            throw new Error("Yetersiz yenileme hakkı.");
        transaction.update(userRef, {
            refreshCount: firestore_1.FieldValue.increment(-1),
            "social.lastDiscoverRefreshAt": now.toISOString()
        });
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
exports.adminGrantWalletReward = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { targetUserId, amount, balanceType, description } = data;
    if (typeof amount !== 'number' || amount === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'Miktar sıfırdan farklı olmalıdır.');
    }
    const userRef = db.collection("users").doc(targetUserId);
    await db.runTransaction(async (transaction) => {
        const updates = {};
        if (balanceType === 'main')
            updates.mainCoins = firestore_1.FieldValue.increment(amount);
        else
            updates.energy = firestore_1.FieldValue.increment(amount);
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
exports.getAdminUserChats = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { targetUserId } = data;
    if (!targetUserId)
        throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı ID gerekli.');
    try {
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
exports.getAdminChatMessages = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { chatId, targetUserId } = data;
    if (!chatId)
        throw new functions.https.HttpsError('invalid-argument', 'Chat ID gerekli.');
    try {
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
exports.adminModerationAction = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { action, targetUserId, chatId, messageId, reason } = data;
    try {
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
        }
        else if (action === 'delete_chat' && chatId) {
            await db.collection("chats").doc(chatId).update({ status: 'deleted_by_admin' });
        }
        else if (action === 'flag_message' && messageId) {
            await db.collection("messages").doc(messageId).update({ isFlagged: true, flaggedReason: reason });
        }
        return { success: true };
    }
    catch (error) {
        console.error("adminModerationAction error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'İşlem gerçekleştirilirken bir hata oluştu.');
    }
});
exports.redeemPromoCode = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { code } = data;
    if (!code || typeof code !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Geçersiz kod.');
    }
    const normalizedCode = code.trim().toUpperCase();
    const now = new Date().toISOString();
    try {
        const promoSnap = await db.collection("promoCodes")
            .where("code", "==", normalizedCode)
            .limit(1)
            .get();
        if (promoSnap.empty) {
            throw new functions.https.HttpsError('not-found', 'Geçersiz veya hatalı kod.');
        }
        const promoDoc = promoSnap.docs[0];
        const promo = promoDoc.data();
        return await db.runTransaction(async (transaction) => {
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
            const userRef = db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', 'Kullanıcı bulunamadı.');
            const userData = userSnap.data();
            if (promo.onlyNewUsers) {
                const createdAt = userData.createdAt ? new Date(userData.createdAt).getTime() : 0;
                const isNew = (Date.now() - createdAt) < (24 * 60 * 60 * 1000);
                if (!isNew) {
                    throw new functions.https.HttpsError('failed-precondition', 'Bu kod sadece yeni kullanıcılar içindir.');
                }
            }
            const redemptionId = `${userId}_${promoDoc.id}`;
            const redemptionRef = db.collection("promoCodeRedemptions").doc(redemptionId);
            const redemptionSnap = await transaction.get(redemptionRef);
            if (redemptionSnap.exists) {
                throw new functions.https.HttpsError('already-exists', 'Bu kodu zaten kullandınız.');
            }
            const rewards = promo.rewards;
            const userUpdates = {};
            const grantedRewards = {};
            if (rewards.energy) {
                userUpdates.energy = firestore_1.FieldValue.increment(rewards.energy);
                grantedRewards.energy = rewards.energy;
            }
            if (rewards.mainCoins) {
                userUpdates.mainCoins = firestore_1.FieldValue.increment(rewards.mainCoins);
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
                    userUpdates.superLikes = firestore_1.FieldValue.increment(rewards.socialFeatures.superLike);
                    grantedRewards.superLike = rewards.socialFeatures.superLike;
                }
                if (rewards.socialFeatures.refresh) {
                    userUpdates.refreshCount = firestore_1.FieldValue.increment(rewards.socialFeatures.refresh);
                    grantedRewards.refresh = rewards.socialFeatures.refresh;
                }
                if (rewards.socialFeatures.analysis) {
                    userUpdates.compatibilityCount = firestore_1.FieldValue.increment(rewards.socialFeatures.analysis);
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
            transaction.update(userRef, userUpdates);
            transaction.update(promoDoc.ref, { currentUses: firestore_1.FieldValue.increment(1) });
            transaction.set(redemptionRef, {
                id: redemptionId,
                promoCodeId: promoDoc.id,
                code: normalizedCode,
                userId,
                redeemedAt: now,
                rewardsGranted: grantedRewards,
                status: 'success'
            });
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
    }
    catch (error) {
        console.error("redeemPromoCode error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Kod kullanılırken bir hata oluştu.');
    }
});
exports.adminSetWallet = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
    const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') ||
        (context.auth.token.email === "hpferdicakir@gmail.com" && context.auth.token.email_verified === true);
    if (!isAdmin)
        throw new functions.https.HttpsError('permission-denied', 'Yetkisiz işlem.');
    const { targetUserId, updates } = data;
    if (!targetUserId || !updates)
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
    const userRef = db.collection("users").doc(targetUserId);
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
    }
    catch (error) {
        console.error("adminSetWallet error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Cüzdan güncellenirken hata oluştu.');
    }
});
exports.adminAdjustWallet = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const adminSnap = await db.collection("users").doc(context.auth.uid).get();
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
    const userRef = db.collection("users").doc(targetUserId);
    try {
        await userRef.update({
            [field]: firestore_1.FieldValue.increment(amount)
        });
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
    }
    catch (error) {
        console.error("adminAdjustWallet error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Cüzdan ayarlanırken hata oluştu.');
    }
});
exports.completeSocialOnboarding = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { nickname, gender, lookingFor, birthDate, interests, photos, bio, horoscope, element, planet, mysticAnimal, luckyNumber, luckyColor } = data;
    if (!nickname || !gender || !lookingFor || !birthDate || !interests || !photos || !bio) {
        throw new functions.https.HttpsError('invalid-argument', 'Eksik profil bilgileri.');
    }
    const userRef = db.collection("users").doc(userId);
    try {
        await userRef.update({
            birthDate,
            horoscope,
            element,
            planet,
            mysticAnimal,
            luckyNumber,
            luckyColor,
            "social.nickname": nickname,
            "social.gender": gender,
            "social.lookingFor": lookingFor,
            "social.interests": interests,
            "social.photos": photos,
            "social.bio": bio,
            "social.enabled": true,
            "social.profileCompleted": true,
            "social.visible": true,
            "social.banned": false,
            "social.lastOnboardingAt": new Date().toISOString()
        });
        return { success: true };
    }
    catch (error) {
        console.error("completeSocialOnboarding error:", error);
        throw new functions.https.HttpsError('internal', 'Profil oluşturulurken bir hata oluştu.');
    }
});
exports.sendSuperLikeAndCreateChat = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { targetUserId } = data;
    if (!targetUserId)
        throw new functions.https.HttpsError('invalid-argument', 'Hedef kullanıcı gerekli.');
    const userRef = db.collection("users").doc(userId);
    const targetUserRef = db.collection("users").doc(targetUserId);
    try {
        return await db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            const targetSnap = await transaction.get(targetUserRef);
            if (!userSnap.exists)
                throw new Error("Kullanıcı bulunamadı.");
            if (!targetSnap.exists)
                throw new Error("Hedef kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const targetData = targetSnap.data();
            if ((userData.superLikes || 0) <= 0) {
                throw new Error("Yetersiz Süper Like hakkı.");
            }
            transaction.update(userRef, { superLikes: firestore_1.FieldValue.increment(-1) });
            const chatsQuery = await db.collection("chats")
                .where("participants", "array-contains", userId)
                .get();
            const existingChat = chatsQuery.docs.find(doc => doc.data().participants.includes(targetUserId));
            let chatId;
            const now = new Date().toISOString();
            if (existingChat) {
                chatId = existingChat.id;
            }
            else {
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
                    lastMessageAt: firestore_1.FieldValue.serverTimestamp(),
                    lastMessageSenderId: "system",
                    unreadCount: { [targetUserId]: 1, [userId]: 0 },
                    status: 'active',
                    startedBy: "super_like",
                    startedAt: now,
                    starterUserId: userId
                });
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
    }
    catch (error) {
        console.error("sendSuperLikeAndCreateChat error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Süper Like gönderilirken hata oluştu.');
    }
});
exports.refreshDiscoverFeed = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    const nowIso = now.toISOString();
    try {
        return await db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new Error("Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const lastFree = userData.social?.lastFreeRefreshAt ? new Date(userData.social.lastFreeRefreshAt) : null;
            const isFreeAvailable = !lastFree || (now.getTime() - lastFree.getTime() > 24 * 60 * 60 * 1000);
            if (!isFreeAvailable && (userData.refreshCount || 0) <= 0) {
                throw new Error("Yetersiz yenileme hakkı.");
            }
            if (isFreeAvailable) {
                transaction.update(userRef, { "social.lastFreeRefreshAt": nowIso });
            }
            else {
                transaction.update(userRef, { refreshCount: firestore_1.FieldValue.increment(-1) });
            }
            const recentIds = userData.social?.recentDiscoverIds || [];
            const usersSnap = await db.collection("users")
                .where("social.enabled", "==", true)
                .where("social.visible", "==", true)
                .limit(100)
                .get();
            let availableUsers = usersSnap.docs
                .filter(doc => doc.id !== userId && !recentIds.includes(doc.id))
                .map(doc => ({ id: doc.id, ...doc.data() }));
            if (availableUsers.length < 10) {
                availableUsers = usersSnap.docs
                    .filter(doc => doc.id !== userId)
                    .map(doc => ({ id: doc.id, ...doc.data() }));
            }
            availableUsers = availableUsers.sort(() => Math.random() - 0.5).slice(0, 20);
            const newRecentIds = Array.from(new Set([...recentIds, ...availableUsers.map(u => u.id)])).slice(-100);
            transaction.update(userRef, { "social.recentDiscoverIds": newRecentIds });
            const logRef = db.collection("usageLogs").doc();
            transaction.set(logRef, {
                id: logRef.id,
                userId,
                type: 'social_feature',
                feature: 'refresh_discover',
                isFree: isFreeAvailable,
                createdAt: nowIso
            });
            return { success: true, users: availableUsers };
        });
    }
    catch (error) {
        console.error("refreshDiscoverFeed error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Keşfet yenilenirken hata oluştu.');
    }
});
exports.runDiscoverCompatibilityAnalysis = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { targetUserId, relationshipType } = data;
    if (!targetUserId || !relationshipType)
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
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
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            if (!targetSnap.exists)
                throw new functions.https.HttpsError('not-found', "Hedef kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const targetData = targetSnap.data();
            if ((userData.compatibilityCount || 0) <= 0) {
                throw new functions.https.HttpsError('failed-precondition', "Yetersiz uyum analizi hakkı.");
            }
            transaction.update(userRef, { compatibilityCount: firestore_1.FieldValue.increment(-1) });
            const loveScore = Math.floor(Math.random() * 31) + 65;
            const friendshipScore = Math.floor(Math.random() * 31) + 65;
            const energyScore = Math.floor(Math.random() * 31) + 65;
            const relLabels = {
                ask: "Aşk",
                arkadas: "Arkadaşlık",
                flirt: "Flört",
                platonik: "Platonik",
                gorucu_usulu: "Görücü Usulü",
                eski_sevgili: "Eski Sevgili",
                karsiliksiz_sevgi: "Karşılıksız Sevgi",
                evlilik_adayi: "Evlilik Adayı"
            };
            const relLabel = relLabels[relationshipType] || relationshipType;
            const summaryShort = `Yıldız haritalarınız ${relLabel} bağlamında oldukça güçlü bir çekim sergiliyor.`;
            const summaryLong = `Sizin enerjileriniz birbirini tamamlayan nadir bir yapıda. ${relLabel} uyumunuzda özellikle duygusal derinlik ve karşılıklı anlayış ön plana çıkıyor. Yıldızlarınızın konumu, aranızdaki iletişimin akıcı ve samimi olacağını işaret ediyor. Bu bağ, her iki taraf için de öğretici ve besleyici bir deneyim vaat ediyor.`;
            const analysisData = {
                userId,
                source: 'discover',
                targetUserId,
                targetName: targetData.social?.nickname || targetData.displayName || "Gezgin",
                targetPhoto: targetData.social?.photos?.[0] || targetData.photoURL || "",
                relationshipType,
                loveScore,
                friendshipScore,
                energyScore,
                summaryShort,
                summaryLong,
                createdAt: new Date().toISOString(),
                cacheKey
            };
            const newHistoryRef = db.collection("compatibilityHistory").doc();
            transaction.set(newHistoryRef, { id: newHistoryRef.id, ...analysisData });
            const logRef = db.collection("usageLogs").doc();
            transaction.set(logRef, {
                id: logRef.id,
                userId,
                type: 'social_feature',
                feature: 'compatibility_analysis',
                targetUserId,
                relationshipType,
                createdAt: new Date().toISOString()
            });
            return { success: true, analysis: analysisData, cached: false };
        });
    }
    catch (error) {
        console.error("runDiscoverCompatibilityAnalysis error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Analiz yapılırken hata oluştu.');
    }
});
exports.runManualCompatibilityAnalysis = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { person1, person2, relationshipType } = data;
    if (!person1 || !person2 || !relationshipType) {
        throw new functions.https.HttpsError('invalid-argument', 'Eksik veri.');
    }
    const validatePerson = (p) => p.name && p.birthDate && p.status && p.photo;
    if (!validatePerson(person1) || !validatePerson(person2)) {
        throw new functions.https.HttpsError('invalid-argument', 'Tüm alanlar zorunludur.');
    }
    const userRef = db.collection("users").doc(userId);
    try {
        return await db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            if ((userData.compatibilityCount || 0) <= 0) {
                throw new functions.https.HttpsError('failed-precondition', "Yetersiz uyum analizi hakkı.");
            }
            transaction.update(userRef, { compatibilityCount: firestore_1.FieldValue.increment(-1) });
            const loveScore = Math.floor(Math.random() * 31) + 65;
            const friendshipScore = Math.floor(Math.random() * 31) + 65;
            const energyScore = Math.floor(Math.random() * 31) + 65;
            const relLabels = {
                ask: "Aşk",
                arkadas: "Arkadaş",
                flirt: "Flört",
                platonik: "Platonik",
                gorucu_usulu: "Görücü Usulü",
                eski_sevgili: "Eski Sevgili",
                karsiliksiz_sevgi: "Karşılıksız Sevgi",
                evlilik_adayi: "Evlilik Adayı"
            };
            const relLabel = relLabels[relationshipType] || relationshipType;
            const summaryShort = `${person1.name} ve ${person2.name} arasındaki ${relLabel} uyumu yıldızlar tarafından destekleniyor.`;
            const summaryLong = `${person1.name} ve ${person2.name} enerjileri birbirini tamamlayan nadir bir yapıda. ${relLabel} bağlamında özellikle duygusal derinlik ve karşılıklı anlayış ön plana çıkıyor. Yıldızlarınızın konumu, aranızdaki iletişimin akıcı ve samimi olacağını işaret ediyor. Bu bağ, her iki taraf için de öğretici ve besleyici bir deneyim vaat ediyor.`;
            const analysisData = {
                userId,
                source: 'manual',
                person1,
                person2,
                targetName: person2.name,
                targetPhoto: person2.photo,
                relationshipType,
                loveScore,
                friendshipScore,
                energyScore,
                summaryShort,
                summaryLong,
                createdAt: new Date().toISOString()
            };
            const newHistoryRef = db.collection("compatibilityHistory").doc();
            transaction.set(newHistoryRef, { id: newHistoryRef.id, ...analysisData });
            const logRef = db.collection("usageLogs").doc();
            transaction.set(logRef, {
                id: logRef.id,
                userId,
                type: 'social_feature',
                feature: 'manual_compatibility_analysis',
                relationshipType,
                createdAt: new Date().toISOString()
            });
            return { success: true, analysis: analysisData };
        });
    }
    catch (error) {
        console.error("runManualCompatibilityAnalysis error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Analiz yapılırken hata oluştu.');
    }
});
//# sourceMappingURL=index.js.map