import * as functions from "firebase-functions";
import { db, FieldValue } from "./base";

// Economy Config Cache (Optimization)
let cachedEconomy: any = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 300000; // 5 minutes

async function getEconomyConfig() {
  const now = Date.now();
  if (cachedEconomy && (now - lastCacheUpdate < CACHE_TTL)) {
    return cachedEconomy;
  }
  const configSnap = await db.collection("adminSettings").doc("economy").get();
  if (!configSnap.exists) return null;
  cachedEconomy = configSnap.data();
  lastCacheUpdate = now;
  return cachedEconomy;
}

// Global Refund Helper
export async function refundTransaction(userId: string, amount: number, balanceType: 'main' | 'energy' | 'right', rightField?: string) {
  const userRef = db.collection("users").doc(userId);
  const txRef = db.collection("walletTransactions").doc();
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const updates: any = {};
    if (balanceType === 'main') updates.mainCoins = FieldValue.increment(amount);
    else if (balanceType === 'energy') updates.energy = FieldValue.increment(amount);
    else if (balanceType === 'right' && rightField) updates[rightField] = FieldValue.increment(amount);

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

// 1. Watch Ad Reward
export const watchAdReward = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    const economy = await getEconomyConfig();
    if (!economy) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
    
    const adRewardEnergy = economy.rewards?.adRewardEnergy || 10;
    const maxDailyAds = economy.rewards?.maxDailyAds || 5;
    const adRewardExpiryDays = economy.rewards?.adRewardExpiryDays || 7;
    
    const userRef = db.collection("users").doc(userId);
    
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
      
      const userData = userSnap.data() as any;
      const today = new Date().toISOString().split('T')[0];
      const lastReset = userData.lastAdReset ? userData.lastAdReset.split('T')[0] : "";
      
      let dailyCount = userData.dailyAdWatchCount || 0;
      if (today !== lastReset) dailyCount = 0;

      if (dailyCount >= maxDailyAds) {
        throw new Error('Günlük reklam sınırı aşıldı.');
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
  } catch (error: any) {
    console.error("watchAdReward error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Reklam ödülü işlenirken hata oluştu.');
  }
});

// 2. Purchase Coins (Receipt Validated)
export const purchaseCoins = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.receipt) throw new functions.https.HttpsError('invalid-argument', 'Ödeme kanıtı (receipt) bulunamadı.');
    
    const { amount, packageId, receipt, platform } = data; // platform: 'google' | 'apple'

    // HARDENING: Receipt Validation Logic
    // Gelecekte gerçek Google/Apple API'ları buraya entegre edilecek.
    // Şimdilik yapısal doğrulama ve paket kontrolü yapıyoruz.
    console.log(`[Validation] Validating ${platform} receipt for ${packageId}...`);
    
    const isValid = receipt && receipt.length > 32; // Simüle edilen bir doğrulama kuralı
    if (!isValid) {
      throw new functions.https.HttpsError('permission-denied', 'Ödeme doğrulaması başarısız oldu (Invalid Receipt).');
    }

    const economy = await getEconomyConfig();
    const pkg = economy?.coinPackages?.find((p: any) => p.id === packageId);
    if (!pkg) throw new functions.https.HttpsError('not-found', 'Paket bilgisi sistemde bulunamadı.');
    
    const coinsToGrant = pkg.coins + (pkg.bonus || 0);

    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    
    await db.runTransaction(async (transaction) => {
      transaction.update(userRef, { mainCoins: FieldValue.increment(coinsToGrant) });

      const txRef = db.collection("walletTransactions").doc();
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
        receiptId: receipt.substring(0, 10) + "...", // Güvenlik için kısaltılmış
        status: 'active',
        description: `Satın alım onaylandı: ${packageId}`
      });
    });

    return { success: true, granted: coinsToGrant };
  } catch (error: any) {
    console.error("purchaseCoins error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Satın alım sırasında hata oluştu.');
  }
});

// 3. Spend Balance
export const spendBalance = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data) throw new functions.https.HttpsError('invalid-argument', 'Veri gönderilmedi.');
    const { balanceType, amount, source, description } = data;

    // Input Validation
    if (typeof amount !== 'number' || amount <= 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Harcama miktarı pozitif olmalıdır.');
    }
    
    const userRef = db.collection("users").doc(userId);
    const now = new Date().toISOString();
    
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
    console.error("spendBalance error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 4. Buy Fortune Subscription
export const buyFortuneSubscription = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.type) throw new functions.https.HttpsError('invalid-argument', 'Abonelik tipi gerekli.');
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
        throw new Error('Yetersiz bakiye.');
      }

      // Check for active subscription
      if (userData.subscription && userData.subscription.status === 'active') {
        const currentExpires = new Date(userData.subscription.expiresAt);
        if (currentExpires > now) {
          throw new Error('Zaten aktif bir fal aboneliğiniz var.');
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
  } catch (error: any) {
    console.error("buyFortuneSubscription error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Abonelik sırasında hata oluştu.');
  }
});

// 5. Purchase Boost Package (TL-based)
export const purchaseBoostPackage = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.type) throw new functions.https.HttpsError('invalid-argument', 'Boost tipi gerekli.');
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
  } catch (error: any) {
    console.error("purchaseBoostPackage error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 6. Purchase Social Item
export const purchaseSocialItem = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.type) throw new functions.https.HttpsError('invalid-argument', 'Öğe tipi gerekli.');
    const { type, description, quantity } = data;

    console.log(`[purchaseSocialItem] User: ${userId}, Type: ${type}, Qty: ${quantity}`);

    // 1. Fetch config
    const configSnap = await db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists) throw new functions.https.HttpsError('internal', "Sistem yapılandırması bulunamadı.");
    const economy = configSnap.data() as any;
    
    // 2. Determine Price (Try to find matching package, fallback to unit price)
    const priceKey = type === 'superLike' ? 'superLike' : type === 'refresh' ? 'refresh' : 'compatibility';
    if (!economy.socialPricing || !economy.socialPricing[priceKey]) throw new functions.https.HttpsError('invalid-argument', "Geçersiz öğe.");
    
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
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 12. Purchase Social Bundle
export const purchaseSocialBundle = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.bundleId) throw new functions.https.HttpsError('invalid-argument', 'Paket ID gerekli.');
    const { bundleId } = data;

    // HARDENING: Fetch config from Firestore
    const configSnap = await db.collection("adminSettings").doc("economy").get();
    if (!configSnap.exists) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
    const economy = configSnap.data() as any;
    
    const bundles = economy.socialBundles || [];
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
  } catch (error: any) {
    console.error("purchaseSocialBundle error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'İşlem sırasında hata oluştu.');
  }
});

// 12. Redeem Promo Code
export const redeemPromoCode = functions.region('us-central1').https.onCall(async (data, context) => {
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
