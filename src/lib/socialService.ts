import { 
  collection, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage, handleFirestoreError, OperationType } from "./firebase";
import { UserProfile, InteractionRequest, SocialActionResult } from "../types";
import { callFunction } from "./walletService";

import { toast } from "sonner";

import { cacheManager } from "./cacheManager";

let lastPresenceStatus: boolean | null = null;

export const socialService = {
  // 1. Create or Get Chat
  async createChat(_userAId: string, userBId: string): Promise<string | null> {
    try {
      const result = await callFunction('createChat', { targetUserId: userBId });
      if (result.status === 'SUCCESS') return result.chatId;
      throw new Error(result.message || "Sohbet oluşturulamadı.");
    } catch (error: any) {
      console.error("socialService: Error in createChat:", error);
      toast.error(error.message || "Sohbet oluşturulamadı.");
      return null;
    }
  },

  // 2. Send Like (Encounter Module)
  async sendLike(fromUser: UserProfile, toUserId: string, type: 'like' | 'super_like' | 'pass'): Promise<SocialActionResult> {
    if (!toUserId) return 'INVALID_TARGET';
    if (fromUser.uid === toUserId) return 'SELF_ACTION';

    // Optimistic Update: Add to swiped list in cache immediately
    const swipedIds = cacheManager.get<string[]>("socialSwipedIds") || [];
    if (!swipedIds.includes(toUserId)) {
      cacheManager.set("socialSwipedIds", [...swipedIds, toUserId], 86400, true);
    }

    try {
      const result = await callFunction('sendLike', { targetUserId: toUserId, type });
      if (result.status === 'INSUFFICIENT_FUNDS') {
        toast.error("Yetersiz hak. Lütfen cüzdanınızdan hak satın alın.");
      }
      return result.status;
    } catch (error: any) {
      console.error("socialService: Error in sendLike:", error);
      // Auto-retry queue could go here, but for now we fallback to Firestore persistence (handled by SDK)
      return 'TECHNICAL_ERROR';
    }
  },

  // 2.1 Get Swiped IDs (Local-First)
  async getSwipedUserIds(userId: string): Promise<string[]> {
    const cached = cacheManager.get<string[]>("socialSwipedIds");
    if (cached) return cached;

    try {
      const q = query(
        collection(db, "swipes"),
        where("fromUserId", "==", userId)
      );
      const snap = await getDocs(q);
      const ids = snap.docs.map(d => d.data().toUserId);
      cacheManager.set("socialSwipedIds", ids, 86400, true);
      return ids;
    } catch (error) {
      console.error("socialService: Error fetching swiped IDs:", error);
      return [];
    }
  },

  // 2.2 Check Block Status
  async isBlocked(userAId: string, userBId: string): Promise<boolean> {
    try {
      const [userASnap, userBSnap] = await Promise.all([
        getDoc(doc(db, "users", userAId)),
        getDoc(doc(db, "users", userBId))
      ]);

      const userA = userASnap.data() as UserProfile;
      const userB = userBSnap.data() as UserProfile;

      return !!(
        userA?.social?.blockedUserIds?.includes(userBId) || 
        userB?.social?.blockedUserIds?.includes(userAId)
      );
    } catch (error) {
      console.error("Error checking block status:", error);
      return false;
    }
  },

  // 3. Send Message Request (Discover Module)
  async sendMessageRequest(_fromUser: UserProfile, toUser: UserProfile): Promise<SocialActionResult> {
    const currentUid = auth.currentUser?.uid;
    if (!toUser?.uid) return 'INVALID_TARGET';
    if (!currentUid) return 'TECHNICAL_ERROR';
    if (currentUid === toUser.uid) return 'SELF_ACTION';

    try {
      const result = await callFunction('sendMessageRequest', { targetUserId: toUser.uid });
      return result.status || 'SUCCESS';
    } catch (error: any) {
      console.error("socialService: Error in sendMessageRequest:", error);
      return 'TECHNICAL_ERROR';
    }
  },

  // 4. Accept Request
  async acceptRequest(request: InteractionRequest) {
    try {
      const result = await callFunction('acceptRequest', { requestId: request.id });
      if (result.status === 'SUCCESS') return result.chatId;
      throw new Error(result.message || "İstek kabul edilemedi.");
    } catch (error: any) {
      console.error("socialService: Error in acceptRequest:", error);
      toast.error(error.message || "İstek kabul edilemedi.");
      return null;
    }
  },

  // 5. Reject Request
  async rejectRequest(requestId: string) {
    try {
      const result = await callFunction('rejectRequest', { requestId });
      if (result.status !== 'SUCCESS') throw new Error(result.message || "İstek reddedilemedi.");
      return true;
    } catch (error: any) {
      console.error("socialService: Error in rejectRequest:", error);
      toast.error(error.message || "İstek reddedilemedi.");
      return false;
    }
  },

  async updateUserStatus(uid: string, isOnline: boolean) {
    if (!uid || auth.currentUser?.uid !== uid) return;
    
    // Guard: Don't send same status consecutively
    if (lastPresenceStatus === isOnline) return;
    
    // Simple Debounce Guard (3 seconds)
    const now = Date.now();
    const lastUpdate = (this as any)._lastStatusUpdateAt || 0;
    if (now - lastUpdate < 3000) return;
    (this as any)._lastStatusUpdateAt = now;

    try {
      lastPresenceStatus = isOnline;
      
      const payload: any = { isOnline };
      // Only send lastSeen when going offline
      if (!isOnline) {
        payload.lastSeen = new Date().toISOString();
      }
      
      // We use a background fire-and-forget style for status to not block
      callFunction('updateSocialProfile', payload).catch(e => console.warn("Status update silent fail:", e));
    } catch (error) {
      console.error("socialService: Error updating user status:", error);
      // Reset guard on error to allow retry
      lastPresenceStatus = null;
    }
  },

  async updateSocialField(uid: string, field: string, value: any) {
    if (!uid) return;
    try {
      const result = await callFunction('updateSocialProfile', { [field]: value });
      if (result.status !== 'SUCCESS') throw new Error(result.message || "Güncelleme başarısız.");
    } catch (error: any) {
      console.error("socialService: Error updating social field:", error);
      toast.error(error.message || "Güncelleme başarısız.");
    }
  },

  async updateFullProfile(data: any) {
    try {
      const result = await callFunction('updateSocialProfile', data);
      if (result.status === 'SUCCESS') {
        toast.success("Profil güncellendi.");
      } else {
        throw new Error(result.message || "Güncelleme başarısız.");
      }
    } catch (error: any) {
      console.error("socialService: Error updating profile:", error);
      toast.error(error.message || "Güncelleme başarısız.");
    }
  },

  // --- Advanced Messaging Features ---

  async sendMessage(chatId: string, senderId: string, otherUserId: string, content: { text?: string, mediaUrl?: string, mediaType?: 'image' | 'video' }) {
    try {
      const result = await callFunction('sendMessage', { 
        chatId, 
        text: content.text, 
        mediaUrl: content.mediaUrl, 
        mediaType: content.mediaType 
      });
      if (result.status === 'SUCCESS') return result.messageId;
      throw new Error(result.message || "Mesaj gönderilemedi.");
    } catch (error: any) {
      console.error("socialService: Error in sendMessage:", error);
      toast.error(error.message || "Mesaj gönderilemedi.");
      return null;
    }
  },

  async sendMedia(chatId: string, senderId: string, otherUserId: string, file: File, type: 'image' | 'video') {
    const storagePath = `chats/${chatId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    
    return await this.sendMessage(chatId, senderId, otherUserId, {
      mediaUrl: downloadUrl,
      mediaType: type
    });
  },

  async deleteChat(chatId: string, _userId: string) {
    try {
      const result = await callFunction('deleteChat', { chatId });
      if (result.status !== 'SUCCESS') throw new Error(result.message || "Sohbet silinemedi.");
      return true;
    } catch (error: any) {
      console.error("socialService: Error in deleteChat:", error);
      toast.error(error.message || "Sohbet silinemedi.");
      return false;
    }
  },

  async markAsSeen(chatId: string, _currentUserId: string, _otherUserId: string) {
    try {
      await callFunction('markAsSeen', { chatId });
    } catch (error: any) {
      console.error("socialService: Error in markAsSeen:", error);
    }
  },

  async markAsDelivered(chatId: string, _currentUserId: string, _otherUserId: string) {
    try {
      await callFunction('markAsDelivered', { chatId });
    } catch (error: any) {
      console.error("socialService: Error in markAsDelivered:", error);
    }
  },

  async deleteMessage(messageId: string, _chatId: string, forEveryone: boolean = false) {
    try {
      const result = await callFunction('deleteMessage', { messageId, forEveryone });
      if (result.status !== 'SUCCESS') throw new Error(result.message || "Mesaj silinemedi.");
      return true;
    } catch (error: any) {
      console.error("socialService: Error in deleteMessage:", error);
      toast.error(error.message || "Mesaj silinemedi.");
      return false;
    }
  },

  async editMessage(messageId: string, newText: string) {
    try {
      const result = await callFunction('editMessage', { messageId, newText });
      if (result.status !== 'SUCCESS') throw new Error(result.message || "Mesaj düzenlenemedi.");
    } catch (error: any) {
      console.error("socialService: Error in editMessage:", error);
      throw error;
    }
  },

  async setTypingStatus(chatId: string, _userId: string, isTyping: boolean) {
    try {
      await callFunction('setTypingStatus', { chatId, isTyping });
    } catch (error: any) {
      console.error("socialService: Error in setTypingStatus:", error);
    }
  },

  // --- Privacy & Moderation ---
  async blockUser(targetUid: string) {
    const result = await callFunction('blockUser', { targetUid });
    if (result.status === 'SUCCESS') toast.success("Kullanıcı engellendi.");
    return result;
  },

  async unblockUser(targetUid: string) {
    const result = await callFunction('unblockUser', { targetUid });
    if (result.status === 'SUCCESS') toast.success("Engel kaldırıldı.");
    return result;
  },

  async muteUser(targetUid: string) {
    const result = await callFunction('muteUser', { targetUid });
    if (result.status === 'SUCCESS') toast.success("Kullanıcı susturuldu.");
    return result;
  },

  async unmuteUser(targetUid: string) {
    const result = await callFunction('unmuteUser', { targetUid });
    if (result.status === 'SUCCESS') toast.success("Susturma kaldırıldı.");
    return result;
  }
};
