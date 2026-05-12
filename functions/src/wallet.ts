import * as functions from "firebase-functions";
import { db, FieldValue } from "./base";

// Economy Config Cache (Optimization)
let cachedEconomy: any = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 300000; // 5 minutes

export async function getEconomyConfig() {
  const now = Date.now();
  if (cachedEconomy && (now - lastCacheUpdate < CACHE_TTL)) {
    return cachedEconomy;
  }
  const configSnap = await db.collection("adminSettings").doc("economy").get();
  if (!configSnap.exists) {
    cachedEconomy = {}; // empty object instead of null to prevent null reference checks breaking
    lastCacheUpdate = now;
    return cachedEconomy;
  }
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

function toMillisSafe(value: any): number {
  if (!value) return 0;
  try {
    if (typeof value === 'number') return value;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date.getTime();
    }
    // Handle plain objects that look like Timestamps { _seconds, _nanoseconds } or { seconds, nanoseconds }
    if (typeof value === 'object') {
      const s = value._seconds || value.seconds;
      if (typeof s === 'number') return s * 1000;
    }
  } catch (e) {
    console.error("toMillisSafe error:", e);
  }
  return 0;
}
export const watchAdReward = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    const economy = await getEconomyConfig();
    if (!economy) throw new functions.https.HttpsError('internal', 'Sistem yapılandırması bulunamadı.');
    
    const adRewardEnergy = Number(economy.rewards?.adRewardEnergy || 10);
    const maxDailyAds = Number(economy.rewards?.maxDailyAds || 5);
    const adRewardExpiryDays = Number(economy.rewards?.adRewardExpiryDays || 7);
    
    const userRef = db.collection("users").doc(userId);
    
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      
      const userData = userSnap.data() as any;
      const today = new Date().toISOString().split('T')[0];
      let lastReset = "";
      if (userData.lastAdReset) {
        if (typeof userData.lastAdReset === "string") {
          lastReset = userData.lastAdReset.split("T")[0];
        } else if (userData.lastAdReset.toDate) {
          lastReset = userData.lastAdReset.toDate().toISOString().split("T")[0];
        }
      }
      
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
  } catch (error: any) {
    console.error("watchAdReward error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('internal', `Reklam ödülü işlenirken hata oluştu: ${msg}`);
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
    
    // PRODUCTION GUARD: Gerçek doğrulama yoksa, test mode dışında satın almayı engelle.
    const isProduction = !process.env.FUNCTIONS_EMULATOR;
    if (isProduction) {
       // Bu kısım production'a geçmeden önce gerçek Google/Apple API entegrasyonu ile doldurulmalı!
       // Şimdilik production'da sahte receipt ile coin verilmesini engelliyoruz.
       throw new functions.https.HttpsError('permission-denied', 'Ödeme sistemi şu an bakımda.');
    }

    console.log(`[Validation] Validating ${platform} receipt for ${packageId}...`);
    
    const isValid = receipt && receipt.length > 32; // Simüle edilen bir doğrulama kuralı
    if (!isValid) {
      throw new functions.https.HttpsError('permission-denied', 'Ödeme doğrulaması başarısız oldu (Invalid Receipt).');
    }

    // DOUBLE PURCHASE / DUPLICATE RECEIPT GUARD
    const receiptPrefix = receipt.substring(0, 32);
    const existingTx = await db.collection("walletTransactions")
      .where("receiptId", "==", receiptPrefix)
      .limit(1)
      .get();
    
    if (!existingTx.empty) {
      throw new functions.https.HttpsError('already-exists', 'Bu ödeme işlemi zaten kullanılmış.');
    }

    const economy = await getEconomyConfig() || {};
    const pkg = economy.coinPackages?.find((p: any) => p.id === packageId);
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
        receiptId: receiptPrefix, // Safely stored for double purchase prevention
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
        .get();
      
      energyTxs = snaps.docs.map(d => ({ id: d.id, ref: d.ref, ...(d.data() as any) }))
        .filter((tx: any) => tx.balanceType === "energy" && tx.status === "active" && tx.expiresAt && tx.expiresAt > now)
        .sort((a: any, b: any) => {
          if (a.expiresAt < b.expiresAt) return -1;
          if (a.expiresAt > b.expiresAt) return 1;
          return 0;
        });
    }

    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;
      
      const currentBalance = balanceType === 'main' ? (userData.mainCoins || 0) : (userData.energy || 0);
      if (currentBalance < amount) throw new functions.https.HttpsError('failed-precondition', "Yetersiz bakiye.");

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
        if (remainingToSpend > 0) throw new functions.https.HttpsError('failed-precondition', "Enerji bakiyesi doğrulanamadı.");
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
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
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
          throw new functions.https.HttpsError('already-exists', 'Zaten aktif bir fal aboneliğiniz var.');
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

// 5. Purchase Boost Package (J-Coin based)
export const purchaseBoostPackage = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    if (!data || !data.type) throw new functions.https.HttpsError('invalid-argument', 'Boost tipi gerekli.');
    const { type } = data; // Usually package id like 'weekly' or 'monthly'
    
    // HARDENING: Fetch social market config from Firestore
    const configSnap = await db.collection("config").doc("socialCommerce").get();
    let durationDays = 7;
    let priceCoins = 100;
    
    if (configSnap.exists) {
        const commerceConfig = configSnap.data() as any;
        const boostPackages = commerceConfig.boostPackages || [];
        const boostConfig = boostPackages.find((p: any) => p.id === type);
        
        if (!boostConfig) {
             throw new functions.https.HttpsError('invalid-argument', 'Geçersiz boost paketi.');
        }
        
        durationDays = boostConfig.durationHours ? boostConfig.durationHours / 24 : (boostConfig.value || 7);
        priceCoins = boostConfig.price;
    } else {
        // Fallback if config is missing but let's throw instead based on user rules
        throw new functions.https.HttpsError('internal', 'Sosyal market yapılandırması bulunamadı.');
    }

    const userRef = db.collection("users").doc(userId);
    const now = new Date();
    
    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;

      if ((userData.mainCoins || 0) < priceCoins) {
        throw new functions.https.HttpsError('failed-precondition', "Yetersiz J-Coin bakiyesi.");
      }

      const currentBoost = userData.boostExpiresAt ? new Date(userData.boostExpiresAt) : new Date();
      const baseDate = currentBoost > now ? currentBoost : now;
      baseDate.setDate(baseDate.getDate() + durationDays);

      transaction.update(userRef, {
        mainCoins: FieldValue.increment(-priceCoins),
        boostExpiresAt: baseDate.toISOString()
      });

      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'spend',
        source: 'boost',
        amount: -priceCoins,
        balanceType: 'main',
        createdAt: now.toISOString(),
        status: 'spent', // Tamamlanmış harcama
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

    // 1. Fetch config from economy
    const economy = await getEconomyConfig() || {};
    
    // 2. Determine Price (Try to find matching package, fallback to unit price)
    let packageArray: any[] = [];
    if (type === 'superLike') packageArray = economy.socialPricing?.superLike || [];
    else if (type === 'refresh') packageArray = economy.socialPricing?.refresh || [];
    else if (type === 'compatibility') packageArray = economy.socialPricing?.compatibility || [];
    else throw new functions.https.HttpsError('invalid-argument', "Geçersiz öğe tipi.");
    
    const qty = Math.max(1, parseInt(quantity) || 1);
    
    const matchingPkg = packageArray.find((p: any) => p.count === qty);
    let totalPrice: number;
    let actualQty = qty;
    
    if (matchingPkg) {
      totalPrice = matchingPkg.priceCoins; // use .priceCoins from EconomyConfig
      actualQty = matchingPkg.count || qty;
    } else {
      const unitPrice = packageArray[0]?.priceCoins || 20;
      totalPrice = unitPrice * qty;
    }

    console.log(`[purchaseSocialItem] Actual Qty: ${actualQty}, TotalPrice: ${totalPrice} (Matched: ${!!matchingPkg})`);

    // 3. Run Transaction
    const userRef = db.collection("users").doc(userId);
    const result = await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;
      
      if ((userData.mainCoins || 0) < totalPrice) {
        return { success: false, status: 'INSUFFICIENT_FUNDS' };
      }

      const updates: any = {
        mainCoins: FieldValue.increment(-totalPrice)
      };
      
      if (type === 'superLike') updates.superLikes = FieldValue.increment(actualQty);
      else if (type === 'refresh') updates.refreshCount = FieldValue.increment(actualQty);
      else if (type === 'compatibility') updates.compatibilityCount = FieldValue.increment(actualQty);
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
        description: `${description || type} (${actualQty} adet) satın alımı`
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
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;
      
      if ((userData.mainCoins || 0) < bundle.price) throw new functions.https.HttpsError('failed-precondition', "Yetersiz bakiye.");

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

// 13. Claim Daily Login Reward
export const claimDailyLoginReward = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;
  
  try {
    const economy = await getEconomyConfig();
    const rewardAmount = Number(economy?.rewards?.dailyLoginRewardEnergy || 5);

    const userRef = db.collection("users").doc(userId);

    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;

      const lastClaimTime = toMillisSafe(userData.lastDailyRewardAt);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const lastClaimDate = lastClaimTime ? new Date(lastClaimTime).toISOString().split('T')[0] : "";
      
      if (lastClaimDate === today) {
        throw new functions.https.HttpsError('already-exists', 'Bugünkü ödülünüzü zaten aldınız.');
      }

      // Safe energy calculation to handle string energy in old documents
      const currentEnergy = Number(userData.energy || 0);
      const safeCurrentEnergy = isNaN(currentEnergy) ? 0 : currentEnergy;

      transaction.update(userRef, {
        energy: safeCurrentEnergy + rewardAmount,
        lastDailyRewardAt: FieldValue.serverTimestamp()
      });

      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'earn',
        source: 'daily_login',
        amount: rewardAmount,
        balanceType: 'energy',
        createdAt: new Date().toISOString(),
        remainingAmount: rewardAmount,
        status: 'active',
        description: 'Günlük giriş ödülü'
      });

      return { success: true, rewardAmount };
    });
  } catch (error: any) {
    console.error("claimDailyLoginReward error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    // Be more descriptive about the internal error if it happens
    throw new functions.https.HttpsError('internal', `Günlük ödül işlenirken sunucu hatası oluştu: ${msg}`);
  }
});

// 14. Claim Verification Reward
export const claimVerificationReward = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;

  try {
    const economy = await getEconomyConfig();
    const rewardAmount = Number(economy?.rewards?.verifiedRewardEnergy || 100);

    const userRef = db.collection("users").doc(userId);

    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;

      const isVerified = userData.social?.verified || userData.isVerified;
      if (!isVerified) {
        throw new functions.https.HttpsError('failed-precondition', 'Profiliniz henüz onaylanmamış.');
      }

      if (userData.verificationRewardClaimed || userData.social?.verificationRewardClaimed) {
        throw new functions.https.HttpsError('already-exists', 'Bu ödülü zaten aldınız.');
      }

      transaction.update(userRef, {
        energy: FieldValue.increment(rewardAmount),
        verificationRewardClaimed: true,
        "social.verificationRewardClaimed": true
      });

      const now = new Date().toISOString();
      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'earn',
        source: 'profile_verification',
        amount: rewardAmount,
        balanceType: 'energy',
        createdAt: now,
        expiresAt: null,
        remainingAmount: rewardAmount,
        status: 'active',
        description: 'Onaylı profil ödülü'
      });

      return { success: true, rewardAmount };
    });
  } catch (error: any) {
    console.error("claimVerificationReward error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('failed-precondition', `Onay ödülü işlenirken hata oluştu: ${msg}`);
  }
});

// 15. Claim Free Compatibility Reward (Cooldown based)
export const claimFreeCompatibilityReward = functions.region('us-central1').https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Giriş yapmalısınız.');
  const userId = context.auth.uid;

  try {
    const economy = await getEconomyConfig();
    const cooldownHours = Number(economy?.rewards?.freeCompatibilityCooldownHours || 48);

    const userRef = db.collection("users").doc(userId);

    return await db.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new functions.https.HttpsError('not-found', "Kullanıcı bulunamadı.");
      const userData = userSnap.data() as any;

      const lastClaimTime = toMillisSafe(userData.lastFreeCompatibilityAt);
      if (lastClaimTime > 0 && (Date.now() - lastClaimTime) < (cooldownHours * 60 * 60 * 1000)) {
        throw new functions.https.HttpsError('failed-precondition', 'Ücretsiz uyum analizi henüz hazır değil.');
      }

      transaction.update(userRef, {
        compatibilityCount: FieldValue.increment(1),
        lastFreeCompatibilityAt: new Date().toISOString()
      });

      const now = new Date().toISOString();
      const txRef = db.collection("walletTransactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'earn',
        source: 'free_compatibility',
        amount: 1,
        balanceType: 'energy',
        createdAt: now,
        status: 'active',
        description: 'Ücretsiz Uyum Analizi Hakkı',
        expiresAt: null,
        remainingAmount: 1
      });

      return { success: true };
    });
  } catch (error: any) {
    console.error("claimFreeCompatibilityReward error:", error);
    if (error instanceof functions.https.HttpsError) throw error;
    const msg = error instanceof Error ? error.message : String(error);
    throw new functions.https.HttpsError('failed-precondition', `Uyum analizi ödülü işlenirken hata oluştu: ${msg}`);
  }
});
