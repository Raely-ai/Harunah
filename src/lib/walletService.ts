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
import { db, handleFirestoreError, OperationType } from "./firebase";
import { UserProfile, AdminWalletConfig, WalletTransaction } from "../types";
import { walletBackend } from "./walletBackend";

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
    const docRef = doc(db, "adminSettings", "wallet");
    console.log("[DEBUG] walletService.getAdminConfig - Attempting to read adminSettings/wallet");
    try {
      const snap = await getDoc(docRef);
      console.log("[DEBUG] walletService.getAdminConfig - Read success:", snap.exists());
      if (snap.exists()) {
        return snap.data() as AdminWalletConfig;
      } else {
        return DEFAULT_ADMIN_WALLET_CONFIG;
      }
    } catch (error) {
      console.error("[DEBUG] walletService.getAdminConfig - Error:", error);
      // Don't throw here to allow fallback to defaults
      return DEFAULT_ADMIN_WALLET_CONFIG;
    }
  },

  async watchAd(userId: string): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    // CALL BACKEND SIMULATION
    return await walletBackend.processAdReward(userId, config);
  },

  async purchaseCoins(userId: string, amount: number, packageId: string): Promise<void> {
    // CALL BACKEND SIMULATION
    await walletBackend.processPurchase(userId, amount, packageId);
  },

  async spendBalance(userId: string, balanceType: 'main' | 'energy', amount: number, source: string, description: string): Promise<{ success: boolean; message?: string }> {
    // CALL BACKEND SIMULATION
    return await walletBackend.processSpend(userId, balanceType, amount, source, description);
  },

  async purchaseSocialRight(userId: string, type: 'superLike' | 'refresh' | 'compatibility'): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    const price = config.socialRightsPrices[type];
    const description = type === 'superLike' ? 'Süper Like' : type === 'refresh' ? 'Keşfet Yenileme' : 'Uyum Analizi';
    
    // 1. Spend Balance (Backend)
    const result = await this.spendBalance(userId, 'main', price, 'social_action', `${description} satın alımı`);
    if (!result.success) return result;

    // 2. Add Right (Backend - In a real app, this would be part of the same transaction)
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

    // 1. Spend Balance (Backend)
    const result = await this.spendBalance(userId, 'main', bundle.price, 'social_action', `${bundle.name} satın alımı`);
    if (!result.success) return result;

    // 2. Add Bundle Contents (Backend)
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
    
    // CALL BACKEND SIMULATION
    return await walletBackend.processSubscription(userId, type, subConfig, 'fortune');
  },

  async getTransactions(userId: string, limitCount: number = 20): Promise<WalletTransaction[]> {
    console.log("[DEBUG] walletService.getTransactions - Attempting to query walletTransactions for userId:", userId);
    const q = query(
      collection(db, "walletTransactions"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    try {
      const snaps = await getDocs(q);
      console.log("[DEBUG] walletService.getTransactions - Query success, count:", snaps.size);
      return snaps.docs.map(d => ({ id: d.id, ...d.data() } as WalletTransaction));
    } catch (error) {
      console.error("[DEBUG] walletService.getTransactions - Error detected");
      handleFirestoreError(error, OperationType.LIST, "walletTransactions");
      return []; // unreachable due to throw
    }
  },

  async consumeSocialFeature(userId: string, type: 'superLike' | 'refresh' | 'compatibility'): Promise<boolean> {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    
    const userData = userSnap.data() as UserProfile;
    const config = await this.getAdminConfig();
    
    // Check Social Subscription
    const sub = userData.socialSubscription;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (sub && sub.status === 'active' && new Date(sub.expiresAt) > now) {
      const dailyUsage = sub.dailyUsage || { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: today };
      
      // Reset if new day
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
    
    // Fallback to paid usage
    if (type === 'superLike') {
      const count = userData.superLikes || 0;
      if (count <= 0) return false;
      await updateDoc(userRef, { superLikes: increment(-1) });
    } else if (type === 'refresh') {
      const count = userData.refreshCount || 0;
      if (count <= 0) return false;
      await updateDoc(userRef, { refreshCount: increment(-1) });
    } else if (type === 'compatibility') {
      const count = userData.compatibilityCount || 0;
      if (count <= 0) return false;
      await updateDoc(userRef, { compatibilityCount: increment(-1) });
    }
    
    return true;
  },

  async purchaseSocialSubscription(userId: string, type: 'weekly' | 'monthly'): Promise<{ success: boolean; message?: string }> {
    const config = await this.getAdminConfig();
    const subConfig = config.socialSubscriptions[type];
    
    // CALL BACKEND SIMULATION
    return await walletBackend.processSubscription(userId, type, subConfig, 'social');
  }
};
