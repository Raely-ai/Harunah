/// <reference types="vite/client" />
import { 
  doc, 
  getDoc, 
  updateDoc, 
  increment, 
  serverTimestamp, 
  setDoc,
  runTransaction,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  addDoc
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions, handleFirestoreError, OperationType, auth } from "./firebase";
import { UserProfile, AdminWalletConfig, WalletTransaction, EconomyConfig } from "../types";
import { walletBackend } from "./walletBackend";

// Helper to call Express API with simulation fallback
export const callFunction = async (name: string, data: any) => {
  // In production (or when using Express backend), call the Express API
  try {
    const token = await auth.currentUser?.getIdToken();
    const endpointMap: Record<string, string> = {
      'watchAdReward': '/api/wallet/watch-ad',
      'purchaseCoins': '/api/wallet/purchase-coins',
      'spendBalance': '/api/wallet/spend-balance',
      'purchaseSocialItem': '/api/wallet/purchase-social-item',
      'purchaseSocialBundle': '/api/wallet/purchase-social-bundle',
      'buyFortuneSubscription': '/api/wallet/buy-fortune-subscription',
      'buySocialSubscription': '/api/wallet/buy-social-subscription',
      'consumeSocialFeature': '/api/wallet/consume-social-feature'
    };

    const endpoint = endpointMap[name];
    if (endpoint) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "API error");
      }

      return await response.json();
    }
  } catch (error) {
    console.error(`API call failed for ${name}:`, error);
    if (import.meta.env.PROD) throw error;
  }
  
  // In development/preview fallback to simulation if API fails or not mapped
  console.log(`[SIMULATION] Falling back for: ${name}`, data);
  switch (name) {
    case 'watchAdReward': return await walletBackend.processAdReward(data.userId, data.config);
    case 'purchaseCoins': return await walletBackend.processPurchase(data.userId, data.amount, data.packageId, data.balanceType);
    case 'spendBalance': return await walletBackend.processSpend(data.userId, data.balanceType, data.amount, data.source, data.description);
    case 'buyFortuneSubscription': return await walletBackend.processSubscription(data.userId, data.type, data.subConfig, 'fortune');
    case 'buySocialSubscription': return await walletBackend.processSubscription(data.userId, data.type, data.subConfig, 'social');
    case 'getAdminUserChats': return await walletBackend.getAdminUserChats(auth.currentUser?.uid || "", data.targetUserId);
    case 'getAdminChatMessages': return await walletBackend.getAdminChatMessages(auth.currentUser?.uid || "", data.chatId);
    case 'adminSetWallet': return await walletBackend.adminSetWallet(auth.currentUser?.uid || "", data.targetUserId, data.updates);
    case 'adminAdjustWallet': return await walletBackend.adminAdjustWallet(auth.currentUser?.uid || "", data.targetUserId, data.field, data.amount);
    case 'adminModerationAction': return await walletBackend.adminModerationAction(auth.currentUser?.uid || "", data);
    default: throw new Error(`Function ${name} not implemented in simulation.`);
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
        // Map EconomyConfig to AdminWalletConfig for backward compatibility
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
          socialBundles: DEFAULT_ADMIN_WALLET_CONFIG.socialBundles, // Keep existing or map if added to EconomyConfig
          coinPackages: economy.coinPackages.map(p => ({ id: p.id, coins: p.coins, price: p.priceTRY, bonus: p.bonus }))
        };
      }
      return DEFAULT_ADMIN_WALLET_CONFIG;
    } catch (error) {
      return DEFAULT_ADMIN_WALLET_CONFIG;
    }
  },

  async watchAd(userId: string): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    return await callFunction('watchAdReward', { userId, config });
  },

  async purchaseCoins(userId: string, amount: number, packageId: string): Promise<void> {
    await callFunction('purchaseCoins', { userId, amount, packageId });
  },

  async spendBalance(userId: string, balanceType: 'main' | 'energy', amount: number, source: string, description: string): Promise<{ success: boolean; message?: string }> {
    return await callFunction('spendBalance', { userId, balanceType, amount, source, description });
  },

  async purchaseSocialRight(userId: string, type: 'superLike' | 'refresh' | 'compatibility'): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    const description = type === 'superLike' ? 'Süper Like' : type === 'refresh' ? 'Keşfet Yenileme' : 'Uyum Analizi';
    
    return await callFunction('purchaseSocialItem', { type, description });
  },

  async purchaseSocialBundle(userId: string, bundleId: string): Promise<{ success: boolean; message?: string }> {
    return await callFunction('purchaseSocialBundle', { bundleId });
  },

  async buyFortuneSubscription(userId: string, type: 'daily' | 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    const subConfig = config.fortuneSubscriptions[type];
    return await callFunction('buyFortuneSubscription', { userId, type, subConfig });
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

  async consumeSocialFeature(userId: string, type: 'superLike' | 'refresh' | 'compatibility'): Promise<boolean> {
    const config = await this.getAdminConfig();
    
    const result = await callFunction('consumeSocialFeature', { type, config });
    if (result && result.success !== undefined) return result.success;
    return false;
  },

  async purchaseSocialSubscription(userId: string, type: 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    const subConfig = config.socialSubscriptions[type];
    return await callFunction('buySocialSubscription', { userId, type, subConfig });
  }
};
