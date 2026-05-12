/// <reference types="vite/client" />
import { 
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  doc,
  getDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, handleFirestoreError, OperationType, waitForAuth } from "./firebase";
import { AdminWalletConfig, WalletTransaction, EconomyConfig, RefreshActionResult, PurchaseActionResult } from "../types";

import { cacheManager } from "./cacheManager";
import { toSafeDate } from "./dateUtils";

// Helper to call Firebase Functions
export const callFunction = async (name: string, data?: any) => {
  try {
    // 1. Ensure authentication is fully initialized
    const user = await waitForAuth();
    
    // 2. Skip if no authenticated session is present
    if (!user) {
      console.log(`[Firebase] Skipping callable function ${name}: No authenticated session.`);
      return { success: false, status: 'SKIPPED_UNAUTHENTICATED' };
    }
    
    // 3. Setup function reference
    const func = httpsCallable(functions, name);
    
    // 4. Invoke
    const result = await func(data);
    return result.data as any;
  } catch (error: any) {
    // 5. Handle errors
    const code = error.code || 'internal';
    const message = error.message || "Bir hata oluştu.";
    const details = error.details || null;

    // Quota errors
    const isQuotaError = message.toLowerCase().includes('quota') || 
                         code === 'resource-exhausted' ||
                         code === 'functions/resource-exhausted';
    
    if (isQuotaError) {
      console.warn(`Firebase Function ${name} hit quota limit.`);
      return { success: false, code: 'QUOTA_EXCEEDED', message: "AI servis kotası dolu. Lütfen daha sonra tekrar deneyin.", details };
    }

    console.error(`Firebase Function ${name} error:`, error);
    
    return {
      success: false,
      code,
      message,
      details
    };
  }
};

export const DEFAULT_ADMIN_WALLET_CONFIG: AdminWalletConfig = {
  adRewardEnergy: 10,
  maxDailyAds: 5,
  adRewardExpiryDays: 7,
  dailyLoginRewardEnergy: 20,
  dailyLoginExpiryDays: 7,
  fortuneSubscriptions: {
    daily: { price: 19.99, dailyLimit: 10, description: "Günde 10 fal hakkı" },
    weekly: { price: 59.99, dailyLimit: 10, description: "Günde 10 fal hakkı" },
    monthly: { price: 149.99, dailyLimit: 10, description: "Günde 10 fal hakkı" }
  },
  boostPackages: {
    weekly: { price: 49.99, days: 7, description: "1 Hafta boyunca keşfette en üstte görün!" },
    monthly: { price: 149.99, days: 30, description: "1 Ay boyunca keşfette en üstte görün!" }
  },
  socialRightsPrices: {
    superLike: 20,
    refresh: 15,
    compatibility: 25
  },
  socialBundles: [
    {
      id: "starter_bundle",
      name: "Başlangıç Paketi",
      description: "5 Süper Like + 5 Yenileme + 5 Analiz",
      price: 150,
      contents: {
        superLikes: 5,
        refreshes: 5,
        compatibility: 5,
        boostDays: 0
      }
    }
  ],
  coinPackages: [
    { id: "100_coins", coins: 100, price: 49.99, bonus: 0 },
    { id: "500_coins", coins: 500, price: 199.99, bonus: 50 }
  ]
};

export const walletService = {
  async getAdminConfig(): Promise<AdminWalletConfig> {
    const CACHE_KEY = "adminEconomyConfig";
    const cached = cacheManager.get<AdminWalletConfig>(CACHE_KEY);
    if (cached) return cached;

    const docRef = doc(db, "adminSettings", "economy");
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const economy = snap.data() as EconomyConfig;
        const config: AdminWalletConfig = {
          adRewardEnergy: economy.rewards.adRewardEnergy,
          maxDailyAds: economy.rewards.maxDailyAds,
          adRewardExpiryDays: economy.rewards.adRewardExpiryDays,
          dailyLoginRewardEnergy: economy.rewards.dailyLoginRewardEnergy,
          dailyLoginExpiryDays: economy.rewards.dailyLoginExpiryDays,
          fortuneSubscriptions: {
            daily: { price: economy.fortuneSubscriptions.daily.priceTRY, dailyLimit: economy.fortuneSubscriptions.daily.dailyLimit, description: economy.fortuneSubscriptions.daily.description },
            weekly: { price: economy.fortuneSubscriptions.weekly.priceTRY, dailyLimit: economy.fortuneSubscriptions.weekly.dailyLimit, description: economy.fortuneSubscriptions.weekly.description },
            monthly: { price: economy.fortuneSubscriptions.monthly.priceTRY, dailyLimit: economy.fortuneSubscriptions.monthly.dailyLimit, description: economy.fortuneSubscriptions.monthly.description }
          },
          boostPackages: {
            weekly: { 
              price: economy.boostPackages?.weekly?.priceTRY || 49.99, 
              days: economy.boostPackages?.weekly?.days || 7,
              description: economy.boostPackages?.weekly?.description || "1 Hafta Öne Çık"
            },
            monthly: { 
              price: economy.boostPackages?.monthly?.priceTRY || 149.99, 
              days: economy.boostPackages?.monthly?.days || 30,
              description: economy.boostPackages?.monthly?.description || "1 Ay Öne Çık"
            }
          },
          socialRightsPrices: {
            superLike: economy.socialPricing.superLike[0]?.priceCoins ?? 20,
            refresh: economy.socialPricing.refresh[0]?.priceCoins ?? 15,
            compatibility: economy.socialPricing.compatibility[0]?.priceCoins ?? 25,
            speedUpPrice: economy.compatibilitySpeedUpPrice ?? 10
          },
          socialBundles: DEFAULT_ADMIN_WALLET_CONFIG.socialBundles,
          coinPackages: economy.coinPackages.map(p => ({ id: p.id, coins: p.coins, price: p.priceTRY, bonus: p.bonus }))
        };
        cacheManager.set(CACHE_KEY, config, 3600, true);
        return config;
      }
      return DEFAULT_ADMIN_WALLET_CONFIG;
    } catch (error) {
      return DEFAULT_ADMIN_WALLET_CONFIG;
    }
  },

  async watchAd(_userId: string): Promise<{ success: boolean; message?: string }> {
    return await callFunction('watchAdReward');
  },

  async purchaseCoins(_userId: string, amount: number, packageId: string): Promise<void> {
    await callFunction('purchaseCoins', { amount, packageId, balanceType: 'main' });
  },

  async spendBalance(_userId: string, balanceType: 'main' | 'energy', amount: number, source: string, description: string): Promise<{ success: boolean; message?: string }> {
    try {
      return await callFunction('spendBalance', { balanceType, amount, source, description });
    } catch (error: any) {
      console.error("spendBalance error:", error);
      return { success: false, message: error.message || "Bakiye harcanamadı." };
    }
  },

  async purchaseSocialRight(_userId: string, type: 'superLike' | 'refresh' | 'compatibility', quantity: number = 1): Promise<{ success: boolean; status: PurchaseActionResult; message?: string }> {
    const description = type === 'superLike' ? 'Süper Like' : type === 'refresh' ? 'Keşfet Yenileme' : 'Uyum Analizi';
    try {
      return await callFunction('purchaseSocialItem', { type, description, quantity });
    } catch (error: any) {
      return { success: false, status: 'ERROR', message: error.message };
    }
  },

  async purchaseSocialBundle(_userId: string, bundleId: string): Promise<{ success: boolean; message?: string }> {
    return await callFunction('purchaseSocialBundle', { bundleId });
  },

  async buyFortuneSubscription(_userId: string, type: 'daily' | 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string }> {
    return await callFunction('buyFortuneSubscription', { type });
  },

  async getTransactions(userId: string, forceRefresh: boolean = false, limitCount: number = 20): Promise<WalletTransaction[]> {
    const CACHE_KEY = `walletTransactions_${userId}`;
    if (!forceRefresh) {
      const cached = cacheManager.get<WalletTransaction[]>(CACHE_KEY);
      if (cached) return cached;
    }

    const q = query(
      collection(db, "walletTransactions"),
      where("userId", "==", userId),
      limit(limitCount + 20) // Get a few extra to ensure space for sorting
    );
    try {
      const snaps = await getDocs(q);
      const txs = snaps.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
      
      // Client-side sort
      txs.sort((a, b) => {
        const timeA = toSafeDate(a.createdAt).getTime();
        const timeB = toSafeDate(b.createdAt).getTime();
        return timeB - timeA;
      });

      const finalTxs = txs.slice(0, limitCount);
      cacheManager.set(CACHE_KEY, finalTxs, 600, true);
      return finalTxs;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "walletTransactions");
      return [];
    }
  },

  async refreshDiscover(): Promise<{ success: boolean; status: RefreshActionResult; users: any[] }> {
    try {
      return await callFunction('refreshDiscover');
    } catch (error: any) {
      return { success: false, status: 'ERROR', users: [] };
    }
  },

  async purchaseBoostPackage(_userId: string, type: 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string; boostExpiresAt?: string }> {
    try {
      return await callFunction('purchaseBoostPackage', { type });
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  },

  async runCompatibilityAnalysis(targetUserId: string, relationshipType: string): Promise<{ success: boolean; analysis?: any; cached: boolean; requestId?: string; finishTime?: string }> {
    return await callFunction('runDiscoverCompatibilityAnalysis', { targetUserId, relationshipType });
  },
  
  async runManualCompatibilityAnalysis(data: { person1: any, person2: any, relationshipType: string }): Promise<{ success: boolean; requestId: string; finishTime: string }> {
    return await callFunction('runManualCompatibilityAnalysis', data);
  },

  async speedUpCompatibilityAnalysis(requestId: string): Promise<{ success: boolean; message?: string }> {
    return await callFunction('speedUpCompatibilityAnalysis', { requestId });
  },

  async updateSocialSettings(settings: any): Promise<{ success: boolean }> {
    try {
      return await callFunction('updateSocialSettings', { settings });
    } catch (error: any) {
      return { success: false };
    }
  },

  async adminGrantWallet(targetUserId: string, amount: number, balanceType: 'main' | 'energy', description: string): Promise<void> {
    await callFunction('adminGrantWalletReward', { targetUserId, amount, balanceType, description });
  },

  async redeemPromoCode(code: string): Promise<{ success: boolean; message: string; rewards?: any }> {
    return await callFunction('redeemPromoCode', { code });
  },

  async claimDailyLoginReward(): Promise<{ success: boolean; rewardAmount: number }> {
    return await callFunction('claimDailyLoginReward');
  },

  async claimVerificationReward(): Promise<{ success: boolean; rewardAmount: number }> {
    return await callFunction('claimVerificationReward');
  },

  async claimFreeCompatibilityReward(): Promise<{ success: boolean }> {
    return await callFunction('claimFreeCompatibilityReward');
  }
};
