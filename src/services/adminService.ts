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
  onSnapshot,
  deleteDoc,
  setDoc,
  increment,
  Timestamp,
  serverTimestamp
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth, functions, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, CentralizedReport, AppConfig, AdminWalletConfig, EconomyConfig, normalizeUserProfile } from "../types";
import { callFunction } from "../lib/walletService";
import { toast } from "sonner";

export const adminService = {
  // User Management
  async getUsers(): Promise<UserProfile[]> {
    try {
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map(d => normalizeUserProfile(d.data(), d.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "users");
      return [];
    }
  },

  async updateUser(uid: string, updates: any): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid), updates);
      toast.success("Kullanıcı güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async banUser(uid: string, reason: string): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid), { isBanned: true });
      await this.logModerationAction(uid, 'ban', reason);
      toast.success("Kullanıcı yasaklandı.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async unbanUser(uid: string): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid), { isBanned: false });
      await this.logModerationAction(uid, 'unban', "Yasak kaldırıldı.");
      toast.success("Kullanıcı yasağı kaldırıldı.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async toggleSocialBan(uid: string, banned: boolean): Promise<void> {
    try {
      await updateDoc(doc(db, "users", uid), { 'social.banned': banned });
      await this.logModerationAction(uid, banned ? 'ban' : 'unban', "Sosyal ban durumu değiştirildi.");
      toast.success(`Sosyal ban ${banned ? 'aktif' : 'pasif'} hale getirildi.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  // Report Management
  async createReport(report: Omit<CentralizedReport, 'id' | 'createdAt' | 'status'>): Promise<void> {
    try {
      await addDoc(collection(db, "reports"), {
        ...report,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
      toast.success("Rapor gönderildi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "reports");
    }
  },

  async updateReportStatus(reportId: string, status: CentralizedReport['status'], adminNotes?: string): Promise<void> {
    try {
      await updateDoc(doc(db, "reports", reportId), { 
        status, 
        adminNotes: adminNotes || "" 
      });
      toast.success("Rapor durumu güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  },

  // Config Management
  async getGlobalConfig(): Promise<AppConfig | null> {
    try {
      const snap = await getDoc(doc(db, "config", "global"));
      return snap.exists() ? snap.data() as AppConfig : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "config/global");
      return null;
    }
  },

  async updateGlobalConfig(config: AppConfig): Promise<void> {
    try {
      await setDoc(doc(db, "config", "global"), config);
      toast.success("Global ayarlar güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "config/global");
    }
  },

  async getWalletConfig(): Promise<AdminWalletConfig | null> {
    try {
      const snap = await getDoc(doc(db, "adminSettings", "wallet"));
      return snap.exists() ? snap.data() as AdminWalletConfig : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "adminSettings/wallet");
      return null;
    }
  },

  async updateWalletConfig(config: AdminWalletConfig): Promise<void> {
    try {
      await setDoc(doc(db, "adminSettings", "wallet"), config);
      toast.success("Cüzdan ayarları güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "adminSettings/wallet");
    }
  },

  async getEconomyConfig(): Promise<EconomyConfig | null> {
    try {
      const snap = await getDoc(doc(db, "adminSettings", "economy"));
      return snap.exists() ? snap.data() as EconomyConfig : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "adminSettings/economy");
      return null;
    }
  },

  async updateEconomyConfig(config: EconomyConfig): Promise<void> {
    try {
      await setDoc(doc(db, "adminSettings", "economy"), config);
      toast.success("Ekonomi ayarları güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "adminSettings/economy");
    }
  },

  // Logging
  async logModerationAction(targetUid: string, action: string, reason: string): Promise<void> {
    try {
      const adminId = auth.currentUser?.uid;
      if (!adminId) return;
      await addDoc(collection(db, "moderationLogs"), {
        adminId,
        adminEmail: auth.currentUser?.email || "",
        targetUid,
        action,
        reason,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Moderation log error:", error);
    }
  },

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
  }
};

