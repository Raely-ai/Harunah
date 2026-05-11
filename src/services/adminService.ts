import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc,
  deleteDoc,
  setDoc,
  increment,
  Timestamp,
  serverTimestamp,
  getCountFromServer,
  startAfter
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, CentralizedReport, AppConfig, AdminWalletConfig, EconomyConfig, normalizeUserProfile, SocialCommerceConfig } from "../types";
import { callFunction } from "../lib/walletService";
import { toast } from "sonner";

const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCachedData(key: string) {
  const cached = cache[key];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any) {
  cache[key] = { data, timestamp: Date.now() };
}

export const adminService = {
  // Stats
  async getUserStats(): Promise<{ totalUsers: number; activeUsers: number }> {
    try {
      const allUsersQuery = query(collection(db, "users"));
      const activeUsersQuery = query(collection(db, "users"), where("isBanned", "!=", true));
      
      const [allSnap, activeSnap] = await Promise.all([
        getCountFromServer(allUsersQuery),
        getCountFromServer(activeUsersQuery)
      ]);
      
      return {
        totalUsers: allSnap.data().count,
        activeUsers: activeSnap.data().count
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "users/stats");
      return { totalUsers: 0, activeUsers: 0 };
    }
  },

  // User Management
  async getUsers(forceRefresh = false): Promise<UserProfile[]> {
    if (!forceRefresh) {
      const cached = getCachedData('users');
      if (cached) return cached;
    }
    try {
      // SADECE 100 kullanıcı çekilecek, fatura tuzağı önlendi
      const snap = await getDocs(query(collection(db, "users"), limit(100)));
      const users = snap.docs.map(d => normalizeUserProfile(d.data(), d.id));
      setCachedData('users', users);
      return users;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "users");
      return [];
    }
  },

  async updateUser(targetUserId: string, updates: any, reason?: string): Promise<void> {
    try {
      await callFunction('adminUpdateUser', { targetUserId, updates, reason });
      toast.success("Kullanıcı güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUserId}`);
    }
  },

  async banUser(uid: string, reason: string): Promise<void> {
    try {
      await callFunction('adminUpdateUser', { 
        targetUserId: uid, 
        updates: { isBanned: true },
        reason: `Ban: ${reason}`
      });
      toast.success("Kullanıcı yasaklandı.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async unbanUser(uid: string): Promise<void> {
    try {
      await callFunction('adminUpdateUser', { 
        targetUserId: uid, 
        updates: { isBanned: false },
        reason: "Yasak kaldırıldı."
      });
      toast.success("Kullanıcı yasağı kaldırıldı.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async toggleSocialBan(uid: string, banned: boolean): Promise<void> {
    try {
      await callFunction('adminUpdateUser', { 
        targetUserId: uid, 
        updates: { 'social.banned': banned },
        reason: banned ? "Sosyal ban aktif edildi." : "Sosyal ban kaldırıldı."
      });
      toast.success(`Sosyal ban ${banned ? 'aktif' : 'pasif'} hale getirildi.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  // Report Management
  async getReports(forceRefresh = false, lastVisible?: any): Promise<CentralizedReport[]> {
    try {
      let q = query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(100));
      if (lastVisible) {
        q = query(collection(db, "reports"), orderBy("createdAt", "desc"), startAfter(lastVisible), limit(100));
      }
      const snap = await getDocs(q);
      const reports = snap.docs.map(d => ({ id: d.id, ...d.data() } as CentralizedReport));
      return reports;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "reports");
      return [];
    }
  },

  async createReport(report: Omit<CentralizedReport, 'id' | 'createdAt' | 'status'>): Promise<void> {
    try {
      await callFunction('createReport', report);
      toast.success("Rapor gönderildi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "reports");
    }
  },

  async updateReportStatus(reportId: string, status: CentralizedReport['status'], adminNotes?: string): Promise<void> {
    try {
      await callFunction('adminUpdateReport', { reportId, status, adminNotes });
      toast.success("Rapor durumu güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  },

  // Config Management
  async getGlobalConfig(forceRefresh = false): Promise<AppConfig | null> {
    if (!forceRefresh) {
      const cached = getCachedData('globalConfig');
      if (cached) return cached;
    }
    try {
      const snap = await getDoc(doc(db, "config", "global"));
      const data = snap.exists() ? snap.data() as AppConfig : null;
      if (data) setCachedData('globalConfig', data);
      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "config/global");
      return null;
    }
  },

  async updateGlobalConfig(config: AppConfig): Promise<void> {
    try {
      await callFunction('adminUpdateConfig', { configType: 'global', configData: config });
      toast.success("Global ayarlar güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "config/global");
    }
  },

  async getWalletConfig(forceRefresh = false): Promise<AdminWalletConfig | null> {
    if (!forceRefresh) {
      const cached = getCachedData('walletConfig');
      if (cached) return cached;
    }
    try {
      const snap = await getDoc(doc(db, "adminSettings", "wallet"));
      const data = snap.exists() ? snap.data() as AdminWalletConfig : null;
      if (data) setCachedData('walletConfig', data);
      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "adminSettings/wallet");
      return null;
    }
  },

  async updateWalletConfig(config: AdminWalletConfig): Promise<void> {
    try {
      await callFunction('adminUpdateConfig', { configType: 'wallet', configData: config });
      toast.success("Cüzdan ayarları güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "adminSettings/wallet");
    }
  },

  async getEconomyConfig(forceRefresh = false): Promise<EconomyConfig | null> {
    if (!forceRefresh) {
      const cached = getCachedData('economyConfig');
      if (cached) return cached;
    }
    try {
      const snap = await getDoc(doc(db, "adminSettings", "economy"));
      const data = snap.exists() ? snap.data() as EconomyConfig : null;
      if (data) setCachedData('economyConfig', data);
      return data;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "adminSettings/economy");
      return null;
    }
  },

  async updateEconomyConfig(config: EconomyConfig): Promise<void> {
    try {
      await callFunction('adminUpdateConfig', { configType: 'economy', configData: config });
      toast.success("Ekonomi ayarları güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "adminSettings/economy");
    }
  },

  async updateSocialCommerceConfig(config: SocialCommerceConfig): Promise<void> {
    try {
      await callFunction('adminUpdateConfig', { configType: 'socialCommerce', configData: config });
      toast.success("Sosyal market ayarları güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "config/socialCommerce");
    }
  },

  // Promo Code Management
  async getPromoCodes(forceRefresh = false): Promise<any[]> {
    if (!forceRefresh) {
      const cached = getCachedData('promoCodes');
      if (cached) return cached;
    }
    try {
      const snap = await getDocs(collection(db, "promoCodes"));
      const codes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCachedData('promoCodes', codes);
      return codes;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "promoCodes");
      return [];
    }
  },

  async managePromoCode(action: 'create' | 'update' | 'delete', promoId?: string, promoData?: any): Promise<void> {
    try {
      await callFunction('adminManagePromoCode', { action, promoId, promoData });
      toast.success(`Promosyon kodu ${action === 'create' ? 'oluşturuldu' : action === 'update' ? 'güncellendi' : 'silindi'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "promoCodes");
    }
  },

  // Logging
  // Redundant: Logging is now handled server-side in admin Cloud Functions

  // Moderation Chat View Methods
  async getAdminUserChats(targetUserId: string): Promise<any[]> {
    try {
      const result = await callFunction('getAdminUserChats', { targetUserId });
      return result.chats || [];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "admin/chats");
      return [];
    }
  },

  async getAdminChatMessages(chatId: string, targetUserId: string): Promise<any[]> {
    try {
      const result = await callFunction('getAdminChatMessages', { chatId, targetUserId });
      return result.messages || [];
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "admin/messages");
      return [];
    }
  },

  async performModerationAction(data: {
    action: 'ban_user' | 'delete_chat' | 'flag_message';
    targetUserId?: string;
    chatId?: string;
    messageId?: string;
    reason?: string;
  }): Promise<boolean> {
    try {
      await callFunction('adminModerationAction', data);
      toast.success("İşlem başarıyla gerçekleştirildi.");
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "admin/moderation");
      return false;
    }
  },

  async adminSetWallet(targetUserId: string, updates: any): Promise<void> {
    console.log(`[ADMIN SERVICE] Setting wallet for ${targetUserId}:`, updates);
    try {
      await callFunction('adminSetWallet', { targetUserId, updates });
      toast.success("Cüzdan güncellendi.");
    } catch (error) {
      console.error(`[ADMIN SERVICE] Error setting wallet for ${targetUserId}:`, error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUserId}/wallet`);
    }
  },

  async adminAdjustWallet(targetUserId: string, field: string, amount: number): Promise<void> {
    console.log(`[ADMIN SERVICE] Adjusting wallet for ${targetUserId}: ${field} by ${amount}`);
    try {
      await callFunction('adminAdjustWallet', { targetUserId, field, amount });
      toast.success("Cüzdan ayarlandı.");
    } catch (error) {
      console.error(`[ADMIN SERVICE] Error adjusting wallet for ${targetUserId}:`, error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${targetUserId}/wallet`);
    }
  },

  async broadcastNotification(data: { title: string, body: string, screen?: string, data?: any }): Promise<any> {
    try {
      const result = await callFunction('adminBroadcastNotification', data);
      toast.success("Bildirim yayını başlatıldı.");
      return result;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "admin/broadcast");
      throw error;
    }
  },

  async createTestUsers(maleCount: number, femaleCount: number): Promise<any> {
    try {
      const result = await callFunction('adminCreateTestUsers', { maleCount, femaleCount });
      toast.success(result?.message || "Test kullanıcıları oluşturuldu.");
      return result;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "admin/createTestUsers");
      throw error;
    }
  },

  async manageTestUsers(action: 'hide' | 'show' | 'delete'): Promise<any> {
    try {
      const result = await callFunction('adminManageTestUsers', { action });
      toast.success(result?.message || `Test kullanıcıları işlemi (${action}) tamamlandı.`);
      return result;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "admin/manageTestUsers");
      throw error;
    }
  }
};

