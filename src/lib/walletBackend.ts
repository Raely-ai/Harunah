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
  addDoc,
  Timestamp
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { UserProfile, AdminWalletConfig, WalletTransaction } from "../types";

/**
 * PRODUCTION BACKEND SIMULATION
 * 
 * In a real production environment, the logic in this file should be moved to 
 * Firebase Cloud Functions (Node.js) and executed using the Admin SDK.
 * 
 * This ensures that:
 * 1. Users cannot modify their own balances via the browser console.
 * 2. Transactions are atomic and server-validated.
 * 3. Business logic is hidden from the client.
 */

export const walletBackend = {
  // Helper to verify admin status (Server-side check)
  async verifyAdmin(uid: string): Promise<boolean> {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return false;
    const data = userSnap.data();
    return data.role === 'admin' || data.email === 'hpferdicakir@gmail.com';
  },

  // 1. Give Ad Reward (Server-side)
  async processAdReward(userId: string, config: AdminWalletConfig): Promise<{ success: boolean; message?: string }> {
    const userRef = doc(db, "users", userId);
    
    return await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error("Kullanıcı bulunamadı.");
      
      const userData = userSnap.data() as UserProfile;
      const today = new Date().toISOString().split('T')[0];
      const lastReset = userData.lastAdReset ? userData.lastAdReset.split('T')[0] : "";
      
      let dailyCount = userData.dailyAdWatchCount || 0;
      if (today !== lastReset) dailyCount = 0;

      if (dailyCount >= config.maxDailyAds) {
        throw new Error("Günlük reklam sınırı aşıldı.");
      }

      const now = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(now.getDate() + (config.adRewardExpiryDays || 7));

      // Update Profile
      transaction.update(userRef, {
        energy: increment(config.adRewardEnergy),
        dailyAdWatchCount: dailyCount + 1,
        lastAdReset: now.toISOString()
      });

      // Create Audit Log
      const txRef = doc(collection(db, "walletTransactions"));
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'earn',
        source: 'ad',
        amount: config.adRewardEnergy,
        balanceType: 'energy',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        remainingAmount: config.adRewardEnergy,
        status: 'active',
        description: 'Reklam izleme ödülü (Sistem Onaylı)'
      });

      return { success: true };
    });
  },

  // 2. Process Purchase (Server-side)
  async processPurchase(userId: string, amount: number, packageId: string, balanceType: 'main' | 'energy' = 'main'): Promise<void> {
    const userRef = doc(db, "users", userId);
    const now = new Date();
    
    await runTransaction(db, async (transaction) => {
      const updates: any = {};
      if (balanceType === 'main') updates.mainCoins = increment(amount);
      else updates.energy = increment(amount);
      
      transaction.update(userRef, updates);

      const txRef = doc(collection(db, "walletTransactions"));
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
  },

  // 3. Spend Balance (Server-side FIFO)
  async processSpend(userId: string, balanceType: 'main' | 'energy', amount: number, source: string, description: string): Promise<{ success: boolean; message?: string }> {
    const userRef = doc(db, "users", userId);
    const now = new Date().toISOString();
    
    try {
      // FIFO logic for energy
      let energyTxs: any[] = [];
      if (balanceType === 'energy') {
        const q = query(
          collection(db, "walletTransactions"),
          where("userId", "==", userId),
          where("balanceType", "==", "energy"),
          where("status", "==", "active"),
          where("expiresAt", ">", now),
          orderBy("expiresAt", "asc")
        );
        const snaps = await getDocs(q);
        energyTxs = snaps.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));
      }

      return await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data() as UserProfile;
        
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

        const txRef = doc(collection(db, "walletTransactions"));
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
      return { success: false, message: error.message };
    }
  },

  // 4. Process Subscription (Server-side)
  async processSubscription(userId: string, type: string, subConfig: any, subType: 'fortune' | 'social'): Promise<{ success: boolean; message?: string }> {
    const userRef = doc(db, "users", userId);
    const now = new Date();
    let expiresAt = new Date();
    
    if (type === 'daily') expiresAt.setDate(now.getDate() + 1);
    else if (type === 'weekly') expiresAt.setDate(now.getDate() + 7);
    else if (type === 'monthly') expiresAt.setMonth(now.getMonth() + 1);

    return await runTransaction(db, async (transaction) => {
      const updates: any = {};
      
      if (subType === 'fortune') {
        updates.subscription = {
          type,
          status: 'active',
          expiresAt: expiresAt.toISOString(),
          dailyLimit: subConfig.dailyLimit,
          dailyLimitUsed: 0,
          lastResetAt: now.toISOString().split('T')[0],
          dailyReadingsUsed: { coffee: 0, tarot: 0, advanced: 0 }
        };
      } else {
        updates.socialSubscription = {
          status: 'active',
          type,
          expiresAt: expiresAt.toISOString(),
          dailyUsage: { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: now.toISOString().split('T')[0] }
        };
        updates.boostExpiresAt = expiresAt.toISOString();
      }

      transaction.update(userRef, updates);

      const txRef = doc(collection(db, "walletTransactions"));
      transaction.set(txRef, {
        id: txRef.id,
        userId,
        type: 'purchase',
        source: 'subscription',
        amount: subConfig.price,
        balanceType: 'main',
        createdAt: now.toISOString(),
        status: 'active',
        description: `${subType === 'fortune' ? 'Fal' : 'Sosyal'} Aboneliği (${type})`
      });

      return { success: true };
    });
  }
};
