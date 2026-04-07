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

// Helper to call Cloud Functions with simulation fallback
export const callFunction = async (name: string, data: any) => {
  // In production, call the real Cloud Function
  if (import.meta.env.PROD) {
    const fn = httpsCallable(functions, name);
    const result = await fn(data);
    return result.data as any;
  }
  
  // In development/preview, use the local backend simulation
  console.log(`[SIMULATION] Calling Cloud Function: ${name}`, data);
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
    const price = config.socialRightsPrices[type];
    const description = type === 'superLike' ? 'Süper Like' : type === 'refresh' ? 'Keşfet Yenileme' : 'Uyum Analizi';
    
    // In production, this would be a single Cloud Function call 'purchaseSocialItem'
    if (import.meta.env.PROD) {
      const fn = httpsCallable(functions, 'purchaseSocialItem');
      const result = await fn({ type, price, description });
      return result.data as any;
    }

    // Simulation
    const result = await this.spendBalance(userId, 'main', price, 'social_action', `${description} satın alımı`);
    if (!result.success) return result;

    const userRef = doc(db, "users", userId);
    const updates: any = {};
    if (type === 'superLike') updates.superLikes = increment(1);
    if (type === 'refresh') updates.refreshCount = increment(1);
    if (type === 'compatibility') updates.compatibilityCount = increment(1);
    
    await updateDoc(userRef, updates);
    return { success: true };
  },

  async purchaseSocialBundle(userId: string, bundleId: string): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    const bundle = config.socialBundles.find(b => b.id === bundleId);
    if (!bundle) return { success: false, message: "Paket bulunamadı." };

    // Simulation/Backend Call
    const result = await this.spendBalance(userId, 'main', bundle.price, 'social_action', `${bundle.name} satın alımı`);
    if (!result.success) return result;

    const userRef = doc(db, "users", userId);
    const now = new Date();
    const boostExpiry = new Date();
    boostExpiry.setDate(now.getDate() + bundle.contents.boostDays);

    await updateDoc(userRef, {
      superLikes: increment(bundle.contents.superLikes),
      refreshCount: increment(bundle.contents.refreshes),
      compatibilityCount: increment(bundle.contents.compatibility),
      boostExpiresAt: boostExpiry.toISOString()
    });

    return { success: true };
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
    
    if (import.meta.env.PROD) {
      const fn = httpsCallable(functions, 'consumeSocialFeature');
      const result = await fn({ type, config });
      return (result.data as any).success;
    }

    // Simulation (Existing logic)
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    const userData = userSnap.data() as UserProfile;
    const sub = userData.socialSubscription;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (sub && sub.status === 'active' && new Date(sub.expiresAt) > now) {
      const dailyUsage = sub.dailyUsage || { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: today };
      if (dailyUsage.lastResetDate !== today) {
        dailyUsage.superLikes = 0;
        dailyUsage.refreshes = 0;
        dailyUsage.compatibility = 0;
        dailyUsage.lastResetDate = today;
      }
      const limits = config.socialSubscriptions[sub.type as 'weekly' | 'monthly'].dailyLimits;
      if (type === 'superLike' && dailyUsage.superLikes < limits.superLikes) {
        dailyUsage.superLikes++;
        await updateDoc(userRef, { "socialSubscription.dailyUsage": dailyUsage });
        return true;
      } else if (type === 'refresh' && dailyUsage.refreshes < limits.refreshes) {
        dailyUsage.refreshes++;
        await updateDoc(userRef, { "socialSubscription.dailyUsage": dailyUsage });
        return true;
      } else if (type === 'compatibility' && dailyUsage.compatibility < limits.compatibility) {
        dailyUsage.compatibility++;
        await updateDoc(userRef, { "socialSubscription.dailyUsage": dailyUsage });
        return true;
      }
    }
    
    // Fallback to paid
    const field = type === 'superLike' ? 'superLikes' : type === 'refresh' ? 'refreshCount' : 'compatibilityCount';
    if ((userData[field] || 0) <= 0) return false;
    await updateDoc(userRef, { [field]: increment(-1) });
    return true;
  },

  async purchaseSocialSubscription(userId: string, type: 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    const subConfig = config.socialSubscriptions[type];
    return await callFunction('buySocialSubscription', { userId, type, subConfig });
  }
};
