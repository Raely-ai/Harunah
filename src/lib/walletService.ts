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
import { AdminWalletConfig, WalletTransaction, EconomyConfig } from "../types";

// Helper to call Firebase Functions
export const callFunction = async (name: string, data?: any) => {
  const func = httpsCallable(functions, name);
  try {
    const result = await func(data);
    return result.data as any;
  } catch (error: any) {
    console.error(`Firebase Function ${name} error:`, error);
    throw error;
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
  socialSubscriptions: {
    weekly: { 
      price: 99.99, 
      dailyLimits: { superLikes: 5, refreshes: 3, compatibility: 3 },
      description: "Haftalık Social Premium: Günlük 5 Süper Like, 3 Yenileme, 3 Analiz ve Profil Öne Çıkarma!"
    },
    monthly: { 
      price: 249.99, 
      dailyLimits: { superLikes: 5, refreshes: 3, compatibility: 3 },
      description: "Aylık Social Premium: Günlük 5 Süper Like, 3 Yenileme, 3 Analiz ve Profil Öne Çıkarma!"
    }
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
      description: "1 Hafta Öne Çık + 5 Süper Like + 5 Yenileme + 5 Analiz",
      price: 150,
      contents: {
        superLikes: 5,
        refreshes: 5,
        compatibility: 5,
        boostDays: 7
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
    const docRef = doc(db, "adminSettings", "economy");
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const economy = snap.data() as EconomyConfig;
        return {
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
          socialSubscriptions: {
            weekly: { 
              price: economy.socialSubscriptions.weekly.priceTRY, 
              dailyLimits: economy.socialSubscriptions.weekly.dailyLimits,
              description: economy.socialSubscriptions.weekly.description
            },
            monthly: { 
              price: economy.socialSubscriptions.monthly.priceTRY, 
              dailyLimits: economy.socialSubscriptions.monthly.dailyLimits,
              description: economy.socialSubscriptions.monthly.description
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

  async purchaseSocialRight(_userId: string, type: 'superLike' | 'refresh' | 'compatibility'): Promise<{ success: boolean; message?: string }> {
    const description = type === 'superLike' ? 'Süper Like' : type === 'refresh' ? 'Keşfet Yenileme' : 'Uyum Analizi';
    return await callFunction('purchaseSocialItem', { type, description });
  },

  async purchaseSocialBundle(_userId: string, bundleId: string): Promise<{ success: boolean; message?: string }> {
    return await callFunction('purchaseSocialBundle', { bundleId });
  },

  async buyFortuneSubscription(_userId: string, type: 'daily' | 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string }> {
    return await callFunction('buyFortuneSubscription', { type });
  },

  async getTransactions(userId: string, limitCount: number = 20): Promise<WalletTransaction[]> {
    const q = query(
      collection(db, "walletTransactions"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    try {
      const snaps = await getDocs(q);
      return snaps.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "walletTransactions");
      return [];
    }
  },

  async consumeSocialFeature(_userId: string, type: 'superLike' | 'refresh' | 'compatibility' | 'swipe'): Promise<boolean> {
    const config = await this.getAdminConfig();
    const result = await callFunction('consumeSocialFeature', { type, config });
    if (result && result.success !== undefined) return result.success;
    return false;
  },

  async purchaseSocialSubscription(_userId: string, type: 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string }> {
    return await callFunction('buySocialSubscription', { type });
  },

  async refreshDiscover(): Promise<{ success: boolean; consumedFrom: string; lastRefreshAt: string }> {
    const config = await this.getAdminConfig();
    return await callFunction('refreshDiscover', { config });
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
