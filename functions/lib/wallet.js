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
exports.claimFreeCompatibilityReward = exports.claimVerificationReward = exports.claimDailyLoginReward = exports.redeemPromoCode = exports.purchaseSocialBundle = exports.purchaseSocialItem = exports.purchaseBoostPackage = exports.buyFortuneSubscription = exports.spendBalance = exports.purchaseCoins = exports.watchAdReward = void 0;
exports.getEconomyConfig = getEconomyConfig;
exports.refundTransaction = refundTransaction;
const functions = __importStar(require("firebase-functions"));
const base_1 = require("./base");
let cachedEconomy = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 300000;
async function getEconomyConfig() {
    const now = Date.now();
    if (cachedEconomy && (now - lastCacheUpdate < CACHE_TTL)) {
        return cachedEconomy;
    }
    const configSnap = await base_1.db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists) {
        cachedEconomy = {};
        lastCacheUpdate = now;
        return cachedEconomy;
    }
    cachedEconomy = configSnap.data();
    lastCacheUpdate = now;
    return cachedEconomy;
}
async function refundTransaction(userId, amount, balanceType, rightField) {
    const userRef = base_1.db.collection("users").doc(userId);
    const txRef = base_1.db.collection("walletTransactions").doc();
    const now = new Date().toISOString();
    await base_1.db.runTransaction(async (transaction) => {
        const updates = {};
        if (balanceType === 'main')
            updates.mainCoins = base_1.FieldValue.increment(amount);
        else if (balanceType === 'energy')
            updates.energy = base_1.FieldValue.increment(amount);
        else if (balanceType === 'right' && rightField)
            updates[rightField] = base_1.FieldValue.increment(amount);
        transaction.update(userRef, updates);
        transaction.set(txRef, {
            id: txRef.id,
            userId,
            type: 'refund',
            source: 'system_refund',
            amount,
            balanceType,
            createdAt: now,
            status: 'active',
            description: `Hata nedeniyle otomatik iade (${amount} ${balanceType})`
        });
    });
}
function toMillisSafe(value) {
    if (!value)
        return 0;
    if (typeof value === 'number')
        return value;
    if (value.toDate && typeof value.toDate === 'function')
        return value.toDate().getTime();
    if (value instanceof Date)
        return value.getTime();
    if (typeof value === 'string') {
        const date = new Date(value);
        if (!isNaN(date.getTime()))
            return date.getTime();
    }
    return 0;
}
exports.watchAdReward = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        const economy = await getEconomyConfig();
        if (!economy)
            throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
        const adRewardEnergy = economy.rewards?.adRewardEnergy || 10;
        const maxDailyAds = economy.rewards?.maxDailyAds || 5;
        const adRewardExpiryDays = economy.rewards?.adRewardExpiryDays || 7;
        const userRef = base_1.db.collection("users").doc(userId);
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const today = new Date().toISOString().split('T')[0];
            let lastReset = "";
            if (userData.lastAdReset) {
                if (typeof userData.lastAdReset === "string") {
                    lastReset = userData.lastAdReset.split("T")[0];
                }
                else if (userData.lastAdReset.toDate) {
                    lastReset = userData.lastAdReset.toDate().toISOString().split("T")[0];
                }
            }
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
                energy: base_1.FieldValue.increment(adRewardEnergy),
                dailyAdWatchCount: dailyCount + 1,
                lastAdReset: now.toISOString()
            });
            const txRef = base_1.db.collection("walletTransactions").doc();
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
    }
    catch (error) {
        console.error("watchAdReward error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Reklam ödülü işlenirken hata oluştu.');
    }
});
exports.purchaseCoins = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.receipt)
            throw new functions.https.HttpsError('invalid-argument', 'Ödeme kanıtı (receipt) bulunamadı.');
        const { amount, packageId, receipt, platform } = data;
        const isProduction = !process.env.FUNCTIONS_EMULATOR;
        if (isProduction) {
            throw new functions.https.HttpsError('permission-denied', 'Ödeme sistemi şu an bakımda.');
        }
        console.log(`[Validation] Validating ${platform} receipt for ${packageId}...`);
        const isValid = receipt && receipt.length > 32;
        if (!isValid) {
            throw new functions.https.HttpsError('permission-denied', 'Ödeme doğrulaması başarısız oldu (Invalid Receipt).');
        }
        const receiptPrefix = receipt.substring(0, 32);
        const existingTx = await base_1.db.collection("walletTransactions")
            .where("receiptId", "==", receiptPrefix)
            .limit(1)
            .get();
        if (!existingTx.empty) {
            throw new functions.https.HttpsError('already-exists', 'Bu ödeme işlemi zaten kullanılmış.');
        }
        const economy = await getEconomyConfig() || {};
        const pkg = economy.coinPackages?.find((p) => p.id === packageId);
        if (!pkg)
            throw new functions.https.HttpsError('not-found', 'Paket bilgisi sistemde bulunamadı.');
        const coinsToGrant = pkg.coins + (pkg.bonus || 0);
        const userRef = base_1.db.collection("users").doc(userId);
        const now = new Date();
        await base_1.db.runTransaction(async (transaction) => {
            transaction.update(userRef, { mainCoins: base_1.FieldValue.increment(coinsToGrant) });
            const txRef = base_1.db.collection("walletTransactions").doc();
            transaction.set(txRef, {
                id: txRef.id,
                userId,
                type: 'purchase',
                source: 'purchase',
                amount: coinsToGrant,
                balanceType: 'main',
                createdAt: now.toISOString(),
                platform,
                packageId,
                receiptId: receiptPrefix,
                status: 'active',
                description: `Satın alım onaylandı: ${packageId}`
            });
        });
        return { success: true, granted: coinsToGrant };
    }
    catch (error) {
        console.error("purchaseCoins error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Satın alım sırasında hata oluştu.');
    }
});
exports.spendBalance = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data)
            throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
        const { balanceType, amount, source, description } = data;
        if (typeof amount !== 'number' || amount <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Harcama miktarı pozitif olmalıdır.');
        }
        const userRef = base_1.db.collection("users").doc(userId);
        const now = new Date().toISOString();
        let energyTxs = [];
        if (balanceType === 'energy') {
            const snaps = await base_1.db.collection("walletTransactions")
                .where("userId", "==", userId)
                .get();
            energyTxs = snaps.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
                .filter((tx) => tx.balanceType === "energy" && tx.status === "active" && tx.expiresAt && tx.expiresAt > now)
                .sort((a, b) => {
                if (a.expiresAt < b.expiresAt)
                    return -1;
                if (a.expiresAt > b.expiresAt)
                    return 1;
                return 0;
            });
        }
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const currentBalance = balanceType === 'main' ? (userData.mainCoins || 0) : (userData.energy || 0);
            if (currentBalance < amount)
                throw new functions.https.HttpsError('failed-precondition', "Yetersiz bakiye.");
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
                    throw new functions.https.HttpsError('failed-precondition', "Enerji bakiyesi doğrulanamadı.");
            }
            const updates = {};
            if (balanceType === 'main')
                updates.mainCoins = currentBalance - amount;
            else
                updates.energy = currentBalance - amount;
            transaction.update(userRef, updates);
            const txRef = base_1.db.collection("walletTransactions").doc();
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
        console.error("spendBalance error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.buyFortuneSubscription = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.type)
            throw new functions.https.HttpsError('invalid-argument', 'Abonelik tipi gerekli.');
        const { type } = data;
        const configSnap = await base_1.db.collection("adminSettings").doc("economy").get();
        if (!configSnap.exists)
            throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
        const economy = configSnap.data();
        const subConfig = economy.fortuneSubscriptions[type];
        if (!subConfig)
            throw new functions.https.HttpsError('invalid-argument', 'Geçersiz abonelik tipi.');
        const userRef = base_1.db.collection("users").doc(userId);
        const now = new Date();
        let expiresAt = new Date();
        if (type === 'daily')
            expiresAt.setDate(now.getDate() + 1);
        else if (type === 'weekly')
            expiresAt.setDate(now.getDate() + 7);
        else if (type === 'monthly')
            expiresAt.setDate(now.getDate() + 30);
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const price = subConfig.priceTRY || subConfig.price;
            if ((userData.mainCoins || 0) < price) {
                throw new functions.https.HttpsError('failed-precondition', 'Yetersiz bakiye.');
            }
            if (userData.subscription && userData.subscription.status === 'active') {
                const currentExpires = new Date(userData.subscription.expiresAt);
                if (currentExpires > now) {
                    throw new functions.https.HttpsError('already-exists', 'Zaten aktif bir fal aboneliğiniz var.');
                }
            }
            transaction.update(userRef, {
                mainCoins: base_1.FieldValue.increment(-price),
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
            const txRef = base_1.db.collection("walletTransactions").doc();
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
    }
    catch (error) {
        console.error("buyFortuneSubscription error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Abonelik sırasında hata oluştu.');
    }
});
exports.purchaseBoostPackage = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.type)
            throw new functions.https.HttpsError('invalid-argument', 'Boost tipi gerekli.');
        const { type } = data;
        const configSnap = await base_1.db.collection("config").doc("socialCommerce").get();
        let durationDays = 7;
        let priceCoins = 100;
        if (configSnap.exists) {
            const commerceConfig = configSnap.data();
            const boostPackages = commerceConfig.boostPackages || [];
            const boostConfig = boostPackages.find((p) => p.id === type);
            if (!boostConfig) {
                throw new functions.https.HttpsError('invalid-argument', 'Geçersiz boost paketi.');
            }
            durationDays = boostConfig.durationHours ? boostConfig.durationHours / 24 : (boostConfig.value || 7);
            priceCoins = boostConfig.price;
        }
        else {
            throw new functions.https.HttpsError('internal', 'Sosyal market yapılandırması bulunamadı.');
        }
        const userRef = base_1.db.collection("users").doc(userId);
        const now = new Date();
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            if ((userData.mainCoins || 0) < priceCoins) {
                throw new functions.https.HttpsError('failed-precondition', "Yetersiz J-Coin bakiyesi.");
            }
            const currentBoost = userData.boostExpiresAt ? new Date(userData.boostExpiresAt) : new Date();
            const baseDate = currentBoost > now ? currentBoost : now;
            baseDate.setDate(baseDate.getDate() + durationDays);
            transaction.update(userRef, {
                mainCoins: base_1.FieldValue.increment(-priceCoins),
                boostExpiresAt: baseDate.toISOString()
            });
            const txRef = base_1.db.collection("walletTransactions").doc();
            transaction.set(txRef, {
                id: txRef.id,
                userId,
                type: 'spend',
                source: 'boost',
                amount: -priceCoins,
                balanceType: 'main',
                createdAt: now.toISOString(),
                status: 'spent',
                description: `Boost Paketi (${type})`
            });
            return { success: true, boostExpiresAt: baseDate.toISOString() };
        });
    }
    catch (error) {
        console.error("purchaseBoostPackage error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.purchaseSocialItem = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.type)
            throw new functions.https.HttpsError('invalid-argument', 'Öğe tipi gerekli.');
        const { type, description, quantity } = data;
        console.log(`[purchaseSocialItem] User: ${userId}, Type: ${type}, Qty: ${quantity}`);
        const economy = await getEconomyConfig() || {};
        let packageArray = [];
        if (type === 'superLike')
            packageArray = economy.socialPricing?.superLike || [];
        else if (type === 'refresh')
            packageArray = economy.socialPricing?.refresh || [];
        else if (type === 'compatibility')
            packageArray = economy.socialPricing?.compatibility || [];
        else
            throw new functions.https.HttpsError('invalid-argument', "Geçersiz öğe tipi.");
        const qty = Math.max(1, parseInt(quantity) || 1);
        const matchingPkg = packageArray.find((p) => p.count === qty);
        let totalPrice;
        let actualQty = qty;
        if (matchingPkg) {
            totalPrice = matchingPkg.priceCoins;
            actualQty = matchingPkg.count || qty;
        }
        else {
            const unitPrice = packageArray[0]?.priceCoins || 20;
            totalPrice = unitPrice * qty;
        }
        console.log(`[purchaseSocialItem] Actual Qty: ${actualQty}, TotalPrice: ${totalPrice} (Matched: ${!!matchingPkg})`);
        const userRef = base_1.db.collection("users").doc(userId);
        const result = await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            if ((userData.mainCoins || 0) < totalPrice) {
                return { success: false, status: 'INSUFFICIENT_FUNDS' };
            }
            const updates = {
                mainCoins: base_1.FieldValue.increment(-totalPrice)
            };
            if (type === 'superLike')
                updates.superLikes = base_1.FieldValue.increment(actualQty);
            else if (type === 'refresh')
                updates.refreshCount = base_1.FieldValue.increment(actualQty);
            else if (type === 'compatibility')
                updates.compatibilityCount = base_1.FieldValue.increment(actualQty);
            else
                return { success: false, status: 'INVALID_ITEM' };
            transaction.update(userRef, updates);
            const txRef = base_1.db.collection("walletTransactions").doc();
            transaction.set(txRef, {
                id: txRef.id,
                userId,
                type: 'spend',
                source: 'social_action',
                amount: -totalPrice,
                balanceType: 'main',
                createdAt: new Date().toISOString(),
                status: 'spent',
                description: `${description || type} (${actualQty} adet) satın alımı`
            });
            return { success: true, status: 'SUCCESS' };
        });
        return result;
    }
    catch (error) {
        console.error("[purchaseSocialItem] Error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.purchaseSocialBundle = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        if (!data || !data.bundleId)
            throw new functions.https.HttpsError('invalid-argument', 'Paket ID gerekli.');
        const { bundleId } = data;
        const configSnap = await base_1.db.collection("adminSettings").doc("economy").get();
        if (!configSnap.exists)
            throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
        const economy = configSnap.data();
        const bundles = economy.socialBundles || [];
        const bundle = bundles.find((b) => b.id === bundleId);
        if (!bundle)
            throw new functions.https.HttpsError('not-found', 'Paket bulunamadı.');
        const userRef = base_1.db.collection("users").doc(userId);
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            if ((userData.mainCoins || 0) < bundle.price)
                throw new functions.https.HttpsError('failed-precondition', "Yetersiz bakiye.");
            const now = new Date();
            transaction.update(userRef, {
                mainCoins: base_1.FieldValue.increment(-bundle.price),
                superLikes: base_1.FieldValue.increment(bundle.contents.superLikes),
                refreshCount: base_1.FieldValue.increment(bundle.contents.refreshes),
                compatibilityCount: base_1.FieldValue.increment(bundle.contents.compatibility)
            });
            const txRef = base_1.db.collection("walletTransactions").doc();
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
    }
    catch (error) {
        console.error("purchaseSocialBundle error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
    }
});
exports.redeemPromoCode = functions.region('us-central1').https.onCall(async (data, context) => {
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
        const promoSnap = await base_1.db.collection("promoCodes")
            .where("code", "==", normalizedCode)
            .limit(1)
            .get();
        if (promoSnap.empty) {
            throw new functions.https.HttpsError('not-found', 'Geçersiz veya hatalı kod.');
        }
        const promoDoc = promoSnap.docs[0];
        const promo = promoDoc.data();
        return await base_1.db.runTransaction(async (transaction) => {
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
            const userRef = base_1.db.collection("users").doc(userId);
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
            const redemptionRef = base_1.db.collection("promoCodeRedemptions").doc(redemptionId);
            const redemptionSnap = await transaction.get(redemptionRef);
            if (redemptionSnap.exists) {
                throw new functions.https.HttpsError('already-exists', 'Bu kodu zaten kullandınız.');
            }
            const rewards = promo.rewards;
            const userUpdates = {};
            const grantedRewards = {};
            if (rewards.energy) {
                userUpdates.energy = base_1.FieldValue.increment(rewards.energy);
                grantedRewards.energy = rewards.energy;
            }
            if (rewards.mainCoins) {
                userUpdates.mainCoins = base_1.FieldValue.increment(rewards.mainCoins);
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
                    userUpdates.superLikes = base_1.FieldValue.increment(rewards.socialFeatures.superLike);
                    grantedRewards.superLike = rewards.socialFeatures.superLike;
                }
                if (rewards.socialFeatures.refresh) {
                    userUpdates.refreshCount = base_1.FieldValue.increment(rewards.socialFeatures.refresh);
                    grantedRewards.refresh = rewards.socialFeatures.refresh;
                }
                if (rewards.socialFeatures.analysis) {
                    userUpdates.compatibilityCount = base_1.FieldValue.increment(rewards.socialFeatures.analysis);
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
            transaction.update(promoDoc.ref, { currentUses: base_1.FieldValue.increment(1) });
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
                const txRef = base_1.db.collection("walletTransactions").doc();
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
exports.claimDailyLoginReward = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        const economy = await getEconomyConfig();
        const rewardAmount = economy?.rewards?.dailyLoginRewardEnergy || 20;
        const userRef = base_1.db.collection("users").doc(userId);
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const lastClaimTime = toMillisSafe(userData.lastDailyRewardAt);
            const today = new Date().toISOString().split('T')[0];
            const lastClaimDate = lastClaimTime ? new Date(lastClaimTime).toISOString().split('T')[0] : "";
            if (lastClaimDate === today) {
                throw new functions.https.HttpsError('already-exists', 'Bugünkü ödülünüzü zaten aldınız.');
            }
            transaction.update(userRef, {
                energy: base_1.FieldValue.increment(rewardAmount),
                lastDailyRewardAt: base_1.FieldValue.serverTimestamp()
            });
            const txRef = base_1.db.collection("walletTransactions").doc();
            transaction.set(txRef, {
                id: txRef.id,
                userId,
                type: 'earn',
                source: 'daily_login',
                amount: rewardAmount,
                balanceType: 'energy',
                createdAt: base_1.FieldValue.serverTimestamp(),
                status: 'active',
                description: 'Günlük giriş ödülü'
            });
            return { success: true, rewardAmount };
        });
    }
    catch (error) {
        console.error("claimDailyLoginReward error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Ödül işlenirken hata oluştu.');
    }
});
exports.claimVerificationReward = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        const economy = await getEconomyConfig();
        const rewardAmount = economy?.rewards?.verifiedRewardEnergy || 100;
        const userRef = base_1.db.collection("users").doc(userId);
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const isVerified = userData.social?.verified || userData.isVerified;
            if (!isVerified) {
                throw new functions.https.HttpsError('failed-precondition', 'Profiliniz henüz onaylanmamış.');
            }
            if (userData.verificationRewardClaimed || userData.social?.verificationRewardClaimed) {
                throw new functions.https.HttpsError('already-exists', 'Bu ödülü zaten aldınız.');
            }
            transaction.update(userRef, {
                energy: base_1.FieldValue.increment(rewardAmount),
                verificationRewardClaimed: true,
                "social.verificationRewardClaimed": true
            });
            const txRef = base_1.db.collection("walletTransactions").doc();
            transaction.set(txRef, {
                id: txRef.id,
                userId,
                type: 'earn',
                source: 'profile_verification',
                amount: rewardAmount,
                balanceType: 'energy',
                createdAt: new Date().toISOString(),
                status: 'active',
                description: 'Onaylı profil ödülü'
            });
            return { success: true, rewardAmount };
        });
    }
    catch (error) {
        console.error("claimVerificationReward error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Hata oluştu.');
    }
});
exports.claimFreeCompatibilityReward = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        const economy = await getEconomyConfig();
        const cooldownHours = economy?.rewards?.freeCompatibilityCooldownHours || 48;
        const userRef = base_1.db.collection("users").doc(userId);
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const lastClaimTime = toMillisSafe(userData.lastFreeCompatibilityAt);
            if (lastClaimTime > 0 && (Date.now() - lastClaimTime) < (cooldownHours * 60 * 60 * 1000)) {
                throw new functions.https.HttpsError('failed-precondition', 'Ücretsiz uyum analizi henüz hazır değil.');
            }
            transaction.update(userRef, {
                compatibilityCount: base_1.FieldValue.increment(1),
                lastFreeCompatibilityAt: base_1.FieldValue.serverTimestamp()
            });
            const txRef = base_1.db.collection("walletTransactions").doc();
            transaction.set(txRef, {
                id: txRef.id,
                userId,
                type: 'earn',
                source: 'free_compatibility',
                amount: 1,
                balanceType: 'energy',
                createdAt: base_1.FieldValue.serverTimestamp(),
                status: 'active',
                description: 'Ücretsiz Uyum Analizi Hakkı',
                expiresAt: null
            });
            return { success: true };
        });
    }
    catch (error) {
        console.error("claimFreeCompatibilityReward error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'Hata oluştu.');
    }
});
//# sourceMappingURL=wallet.js.map