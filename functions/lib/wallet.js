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
exports.redeemPromoCode = exports.consumeSocialFeature = exports.purchaseSocialBundle = exports.purchaseSocialItem = exports.purchaseBoostPackage = exports.buyFortuneSubscription = exports.spendBalance = exports.purchaseCoins = exports.watchAdReward = void 0;
const functions = __importStar(require("firebase-functions"));
const base_1 = require("./base");
exports.watchAdReward = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    try {
        const configSnap = await base_1.db.collection("adminSettings").doc("economy").get();
        if (!configSnap.exists)
            throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
        const economy = configSnap.data();
        const adRewardEnergy = economy.rewards?.adRewardEnergy || 10;
        const maxDailyAds = economy.rewards?.maxDailyAds || 5;
        const adRewardExpiryDays = economy.rewards?.adRewardExpiryDays || 7;
        const userRef = base_1.db.collection("users").doc(userId);
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new Error("Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const today = new Date().toISOString().split('T')[0];
            const lastReset = userData.lastAdReset ? userData.lastAdReset.split('T')[0] : "";
            let dailyCount = userData.dailyAdWatchCount || 0;
            if (today !== lastReset)
                dailyCount = 0;
            if (dailyCount >= maxDailyAds) {
                throw new Error('Günlük reklam sınırı aşıldı.');
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
        if (!data)
            throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
        const { amount, packageId, balanceType = 'main' } = data;
        if (typeof amount !== 'number' || amount <= 0) {
            throw new functions.https.HttpsError('invalid-argument', 'Miktar pozitif bir sayı olmalıdır.');
        }
        const userRef = base_1.db.collection("users").doc(userId);
        const now = new Date();
        await base_1.db.runTransaction(async (transaction) => {
            const updates = {};
            if (balanceType === 'main')
                updates.mainCoins = base_1.FieldValue.increment(amount);
            else
                updates.energy = base_1.FieldValue.increment(amount);
            transaction.update(userRef, updates);
            const txRef = base_1.db.collection("walletTransactions").doc();
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
                .where("balanceType", "==", "energy")
                .where("status", "==", "active")
                .where("expiresAt", ">", now)
                .orderBy("expiresAt", "asc")
                .get();
            energyTxs = snaps.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
        }
        return await base_1.db.runTransaction(async (transaction) => {
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
                throw new Error("Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            const price = subConfig.priceTRY || subConfig.price;
            if ((userData.mainCoins || 0) < price) {
                throw new Error('Yetersiz bakiye.');
            }
            if (userData.subscription && userData.subscription.status === 'active') {
                const currentExpires = new Date(userData.subscription.expiresAt);
                if (currentExpires > now) {
                    throw new Error('Zaten aktif bir fal aboneliğiniz var.');
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
        const configSnap = await base_1.db.collection("adminSettings").doc("economy").get();
        if (!configSnap.exists)
            throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
        const economy = configSnap.data();
        const boostConfig = economy.boostPackages?.[type] || (type === 'weekly' ? { days: 7, priceTRY: 49.99 } : { days: 30, priceTRY: 149.99 });
        const userRef = base_1.db.collection("users").doc(userId);
        const now = new Date();
        return await base_1.db.runTransaction(async (transaction) => {
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
            const txRef = base_1.db.collection("walletTransactions").doc();
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
        const configSnap = await base_1.db.collection("adminSettings").doc("economy").get();
        if (!configSnap.exists)
            throw new functions.https.HttpsError('internal', "Sistem yapılandırması bulunamadı.");
        const economy = configSnap.data();
        const priceKey = type === 'superLike' ? 'superLike' : type === 'refresh' ? 'refresh' : 'compatibility';
        if (!economy.socialPricing || !economy.socialPricing[priceKey])
            throw new functions.https.HttpsError('invalid-argument', "Geçersiz öğe.");
        const pricingArray = economy.socialPricing[priceKey] || [];
        const qty = Math.max(1, parseInt(quantity) || 1);
        const matchingPkg = pricingArray.find((p) => p.count === qty);
        let totalPrice;
        if (matchingPkg) {
            totalPrice = matchingPkg.priceCoins;
        }
        else {
            const unitPrice = pricingArray[0]?.priceCoins || 20;
            totalPrice = unitPrice * qty;
        }
        console.log(`[purchaseSocialItem] Qty: ${qty}, TotalPrice: ${totalPrice} (Matched: ${!!matchingPkg})`);
        const userRef = base_1.db.collection("users").doc(userId);
        const result = await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new Error("USER_NOT_FOUND");
            const userData = userSnap.data();
            if ((userData.mainCoins || 0) < totalPrice) {
                return { success: false, status: 'INSUFFICIENT_FUNDS' };
            }
            const updates = {
                mainCoins: base_1.FieldValue.increment(-totalPrice)
            };
            if (type === 'superLike')
                updates.superLikes = base_1.FieldValue.increment(qty);
            else if (type === 'refresh')
                updates.refreshCount = base_1.FieldValue.increment(qty);
            else if (type === 'compatibility')
                updates.compatibilityCount = base_1.FieldValue.increment(qty);
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
                description: `${description || type} (${qty} adet) satın alımı`
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
                throw new Error("Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            if ((userData.mainCoins || 0) < bundle.price)
                throw new Error("Yetersiz bakiye.");
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
exports.consumeSocialFeature = functions.region('us-central1').https.onCall(async (data, context) => {
    if (!context.auth)
        throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
    const userId = context.auth.uid;
    const { type } = data;
    const userRef = base_1.db.collection("users").doc(userId);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    try {
        return await base_1.db.runTransaction(async (transaction) => {
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
            const userData = userSnap.data();
            let consumedFrom = 'paid';
            if (type === 'swipe') {
                const dailyUsed = userData.dailySwipeUsed || 0;
                const lastDate = userData.dailySwipeDate || "";
                let maxSwipes = 15;
                const sub = userData.subscription;
                if (sub && sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt) > now) {
                    if (sub.type === 'daily')
                        maxSwipes = 100;
                    else if (sub.type === 'weekly')
                        maxSwipes = 150;
                    else if (sub.type === 'monthly')
                        maxSwipes = 200;
                }
                if (lastDate !== today) {
                    transaction.update(userRef, {
                        dailySwipeUsed: 1,
                        dailySwipeDate: today,
                        dailyFreeSuperLikeUsed: false,
                        dailyFreeRefreshUsed: false
                    });
                }
                else {
                    if (dailyUsed >= maxSwipes)
                        throw new functions.https.HttpsError('resource-exhausted', `Günlük kaydırma sınırına ulaştınız (${maxSwipes} hak).`);
                    transaction.update(userRef, { dailySwipeUsed: base_1.FieldValue.increment(1) });
                }
            }
            else {
                const field = type === 'superLike' ? 'superLikes' : type === 'refresh' ? 'refreshCount' : 'compatibilityCount';
                if ((userData[field] || 0) <= 0)
                    throw new functions.https.HttpsError('failed-precondition', "Yetersiz hak.");
                transaction.update(userRef, { [field]: base_1.FieldValue.increment(-1) });
            }
            const logRef = base_1.db.collection("usageLogs").doc();
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
    }
    catch (error) {
        console.error("consumeSocialFeature error:", error);
        if (error instanceof functions.https.HttpsError)
            throw error;
        throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında bir hata oluştu.');
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
//# sourceMappingURL=wallet.js.map