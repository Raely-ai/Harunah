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
import { db, functions, handleFirestoreError, OperationType } from "./firebase";
import { AdminWalletConfig, WalletTransaction, EconomyConfig, RefreshActionResult, PurchaseActionResult } from "../types";

import { cacheManager } from "./cacheManager";

// Helper to call Firebase Functions
export const callFunction = async (name: string, data?: any) => {
  const func = httpsCallable(functions, name);
  try {
    const result = await func(data);
    return result.data as any;
  } catch (error: any) {
    console.error(`Firebase Function ${name} error:`, error);
    
    // Extract meaningful error message
    let message = "Bir hata oluştu.";
    if (error.message) {
      // If it's a standard HttpsError, the message is usually what we want
      message = error.message;
    }
    
    // If it's an internal error, try to see if there's more detail in the details object
    if (error.code === 'internal' && error.details) {
      message = typeof error.details === 'string' ? error.details : JSON.stringify(error.details);
    }

    const enhancedError = new Error(message);
    (enhancedError as any).code = error.code;
    (enhancedError as any).details = error.details;
    
    throw enhancedError;
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
            compatibility: economy.socialPricing.compatibility[0]?.priceCoins ?? 25
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
    return await callFunction('spendBalance', { balanceType, amount, source, description });
  },

  async purchaseSocialRight(_userId: string, type: 'superLike' | 'refresh' | 'compatibility', quantity: number = 1): Promise<{ success: boolean; status: PurchaseActionResult; message?: string }> {
    const description = type === 'superLike' ? 'Süper Like' : type === 'refresh' ? 'Keşfet Yenileme' : 'Uyum Analizi';
    return await callFunction('purchaseSocialItem', { type, description, quantity });
  },

  async purchaseSocialBundle(_userId: string, bundleId: string): Promise<{ success: boolean; message?: string }> {
    return await callFunction('purchaseSocialBundle', { bundleId });
  },

  async buyFortuneSubscription(_userId: string, type: 'daily' | 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string }> {
    return await callFunction('buyFortuneSubscription', { type });
  },

  async completeSocialOnboarding(data: any): Promise<{ success: boolean; message?: string }> {
    return await callFunction('completeSocialOnboarding', data);
  },

  async getTransactions(userId: string, limitCount: number = 20): Promise<WalletTransaction[]> {
    const CACHE_KEY = `walletTransactions_${userId}`;
    const cached = cacheManager.get<WalletTransaction[]>(CACHE_KEY);
    if (cached) return cached;

    const q = query(
      collection(db, "walletTransactions"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    try {
      const snaps = await getDocs(q);
      const txs = snaps.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
      cacheManager.set(CACHE_KEY, txs, 600, true);
      return txs;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "walletTransactions");
      return [];
    }
  },

  async consumeSocialFeature(_userId: string, type: 'superLike' | 'refresh' | 'compatibility' | 'swipe'): Promise<{ success: boolean; consumedFrom?: string }> {
    const config = await this.getAdminConfig();
    return await callFunction('consumeSocialFeature', { type, config });
  },

  async purchaseBoostPackage(_userId: string, type: 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string; boostExpiresAt?: string }> {
    return await callFunction('purchaseBoostPackage', { type });
  },

  async sendSuperLike(targetUserId: string): Promise<{ success: boolean; chatId?: string }> {
    return await callFunction('sendSuperLikeAndCreateChat', { targetUserId });
  },

  async refreshDiscoverFeed(): Promise<{ success: boolean; status: RefreshActionResult; users: any[] }> {
    return await callFunction('refreshDiscoverFeed');
  },

  async runCompatibilityAnalysis(targetUserId: string, relationshipType: string): Promise<{ success: boolean; analysis?: any; cached: boolean; requestId?: string; readyAt?: string }> {
    return await callFunction('runDiscoverCompatibilityAnalysis', { targetUserId, relationshipType });
  },
  
  async runManualCompatibilityAnalysis(data: { person1: any, person2: any, relationshipType: string }): Promise<{ success: boolean; requestId: string; readyAt: string }> {
    return await callFunction('runManualCompatibilityAnalysis', data);
  },

  async refreshDiscover(): Promise<{ success: boolean; status: RefreshActionResult; lastRefreshAt: string }> {
    return await callFunction('refreshDiscover');
  },

  async updateSocialSettings(settings: any): Promise<{ success: boolean }> {
    return await callFunction('updateSocialSettings', { settings });
  },

  async adminGrantWallet(targetUserId: string, amount: number, balanceType: 'main' | 'energy', description: string): Promise<void> {
    await callFunction('adminGrantWalletReward', { targetUserId, amount, balanceType, description });
  },

  async redeemPromoCode(code: string): Promise<{ success: boolean; message: string; rewards?: any }> {
    return await callFunction('redeemPromoCode', { code });
  }
};
