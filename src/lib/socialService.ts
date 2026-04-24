import { 
  collection, 
  serverTimestamp, 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc,
  increment,
  writeBatch,
  query, 
  where, 
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage, handleFirestoreError, OperationType } from "./firebase";
import { UserProfile, InteractionRequest, SocialActionResult, normalizeUserProfile } from "../types";
import { callFunction } from "./walletService";

import { toast } from "sonner";

import { cacheManager } from "./cacheManager";
import { matchingService } from "../services/matchingService";

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

    // Optimistic Update: Add to swiped list in matchingService cache immediately
    matchingService.trackSwipe(toUserId);

    try {
      const result = await callFunction('sendLike', { targetUserId: toUserId, type });
      if (result.status === 'INSUFFICIENT_FUNDS') {
        toast.error("Yetersiz hak. Lütfen cüzdanınızdan hak satın alın.");
      }
      return result.status || (result.success ? 'SUCCESS' : 'TECHNICAL_ERROR');
    } catch (error: any) {
      console.error("socialService: Error in sendLike:", error);
      if (error.message === 'daily_limit_reached' || (error.details && error.details.message === 'daily_limit_reached')) {
        return 'DAILY_LIMIT_REACHED';
      }
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

  // 2.3 Get Matches (Users with existing chats)
  async getMatches(userId: string): Promise<{ uid: string }[]> {
    try {
      const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", userId)
      );
      const snap = await getDocs(q);
      const matchIds = new Set<string>();
      
      snap.docs.forEach(d => {
        const data = d.data();
        const otherId = data.participants.find((p: string) => p !== userId);
        if (otherId) matchIds.add(otherId);
      });

      return Array.from(matchIds).map(uid => ({ uid }));
    } catch (error) {
      console.error("socialService: Error fetching matches:", error);
      return [];
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
      
      const userRef = doc(db, "users", uid);
      const payload: any = { 
        "social.isOnline": isOnline,
        "social.updatedAt": serverTimestamp()
      };
      
      if (!isOnline) {
        payload["social.lastSeen"] = serverTimestamp();
      }
      
      await updateDoc(userRef, payload);
    } catch (error) {
      console.error("socialService: Error updating user status:", error);
      lastPresenceStatus = null;
    }
  },

  async updateSocialField(uid: string, field: string, value: any) {
    if (!uid) return;
    try {
      const userRef = doc(db, "users", uid);
      await updateDoc(userRef, { [`social.${field}`]: value, "social.updatedAt": serverTimestamp() });
    } catch (error: any) {
      console.error("socialService: Error updating social field:", error);
      toast.error(error.message || "Güncelleme başarısız.");
    }
  },

  async updateFullProfile(data: any) {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      const updateData: any = {};
      
      // Map root-level data to social nested object if needed
      Object.entries(data).forEach(([key, val]) => {
        if (key === 'social') {
          Object.entries(val as any).forEach(([sKey, sVal]) => {
            updateData[`social.${sKey}`] = sVal;
          });
        } else {
          updateData[`social.${key}`] = val;
        }
      });
      
      updateData["social.updatedAt"] = serverTimestamp();
      await updateDoc(userRef, updateData);
      toast.success("Profil güncellendi.");
    } catch (error: any) {
      console.error("socialService: Error updating profile:", error);
      toast.error(error.message || "Güncelleme başarısız.");
    }
  },

  async completeSocialOnboarding(data: any) {
    if (!auth.currentUser) return { success: false, message: "Giriş yapmalısınız." };
    const uid = auth.currentUser.uid;
    const userRef = doc(db, "users", uid);
    
    try {
      const now = serverTimestamp();
      // Ensure specific structure requested: social nested object
      const payload = {
        ...data,
        social: {
          ...(data.social || {}),
          nickname: data.nickname || data.social?.nickname || "",
          gender: data.gender || data.social?.gender || "erkek",
          lookingFor: data.lookingFor || data.social?.lookingFor || "",
          interests: data.interests || data.social?.interests || [],
          photos: data.photos || data.social?.photos || [],
          bio: data.bio || data.social?.bio || "",
          birthDate: data.birthDate || data.social?.birthDate || "",
          enabled: true,
          profileCompleted: true,
          visible: true,
          banned: false,
          updatedAt: now,
          lastOnboardingAt: now,
          settings: {
            whoCanMessage: 'everyone',
            whoCanAddFriend: 'everyone',
            notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true }
          }
        },
        updatedAt: now
      };
      
      await setDoc(userRef, payload, { merge: true });
      return { success: true };
    } catch (error: any) {
      console.error("completeSocialOnboarding error:", error);
      return { success: false, message: error.message };
    }
  },

  // --- Advanced Messaging Features ---

  async sendMessage(chatId: string, senderId: string, otherUserId: string, content: { text?: string, mediaUrl?: string, mediaType?: 'image' | 'video' | 'file', fileName?: string }) {
    try {
      const batch = writeBatch(db);
      const msgRef = doc(collection(db, "messages"));
      const chatRef = doc(db, "chats", chatId);
      const receiverRef = doc(db, "users", otherUserId);

      const now = serverTimestamp();
      const type = content.mediaType || 'text';
      const lastMsgText = type === 'text' ? (content.text || "") : (type === 'image' ? "📷 Görsel" : type === 'video' ? "🎥 Video" : "📎 Dosya");

      const messageDoc = {
        id: msgRef.id,
        chatId,
        participants: [senderId, otherUserId],
        senderId,
        receiverId: otherUserId,
        text: content.text || "",
        mediaUrl: content.mediaUrl || null,
        mediaType: content.mediaType || null,
        fileName: content.fileName || null,
        createdAt: now,
        status: 'sent',
        seen: false,
        type
      };

      batch.set(msgRef, messageDoc);
      batch.update(chatRef, {
        lastMessage: lastMsgText,
        lastMessageAt: now,
        lastMessageSenderId: senderId,
        lastMessageStatus: 'sent',
        [`unreadCount.${otherUserId}`]: increment(1)
      });
      // Note: Updating other user's document will fail without rules change. 
      // We will skip it for now or rely on the chat's unreadCount.
      // batch.update(receiverRef, { unreadMessagesCount: increment(1) });

      await batch.commit();
      return msgRef.id;
    } catch (error: any) {
      console.error("socialService: Error in sendMessage:", error);
      toast.error(error.message || "Mesaj gönderilemedi.");
      return null;
    }
  },

  async sendMedia(chatId: string, senderId: string, otherUserId: string, file: File, type: 'image' | 'video' | 'file') {
    let fileToUpload = file;

    if (type === 'image') {
      try {
        const imageCompression = (await import('browser-image-compression')).default;
        const options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
          initialQuality: 0.8
        };
        fileToUpload = await imageCompression(file, options);
      } catch (error) {
        console.error("Image compression error:", error);
      }
    }

    const storagePath = `chats/${chatId}/media/${Date.now()}_${fileToUpload.name}`;
    const storageRef = ref(storage, storagePath);
    
    await uploadBytes(storageRef, fileToUpload, {
      cacheControl: 'public, max-age=31536000, s-maxage=31536000',
    });
    const downloadUrl = await getDownloadURL(storageRef);
    
    return await this.sendMessage(chatId, senderId, otherUserId, {
      mediaUrl: downloadUrl,
      mediaType: type,
      fileName: file.name // keep the original name
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

  async markAsSeen(chatId: string, currentUserId: string, _otherUserId: string) {
    try {
      await callFunction('markAsSeen', { chatId });
    } catch (error: any) {
      console.error("socialService: Error in markAsSeen:", error);
    }
  },

  async markAsDelivered(chatId: string, currentUserId: string, _otherUserId: string) {
    try {
      await callFunction('markAsDelivered', { chatId });
    } catch (error: any) {
      console.error("socialService: Error in markAsDelivered:", error);
    }
  },

  async updateSocialSettings(settings: any) {
    if (!auth.currentUser) return { success: false };
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        "social.settings": settings,
        "social.updatedAt": serverTimestamp()
      });
      return { success: true };
    } catch (error: any) {
      console.error("socialService: Error updating settings:", error);
      return { success: false };
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

  async setTypingStatus(chatId: string, userId: string, isTyping: boolean) {
    try {
      await updateDoc(doc(db, "chats", chatId), {
        [`typing.${userId}`]: isTyping
      });
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
  },

  // 6. Refresh Discover (Optimized Search)
  async refreshDiscover() {
    try {
      // Get current user from cache (App.tsx ensures it's there)
      const cachedProfile = cacheManager.get<UserProfile>("userProfile");
      if (!cachedProfile && auth.currentUser) {
        // Fallback: Fetch if not in cache
        try {
          const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (snap.exists()) {
            const profile = normalizeUserProfile(snap.data(), snap.id);
            const users = await matchingService.fetchPotentialMatches(profile);
            return { success: true, users };
          }
        } catch (innerError) {
          console.warn("refreshDiscover: Failed to fetch profile from Firestore, using function fallback");
        }
      }

      if (cachedProfile) {
        const users = await matchingService.fetchPotentialMatches(cachedProfile);
        return { success: true, users };
      }

      // Backend fallback if somehow we can't get profile
      const result = await callFunction('refreshDiscover', {});
      return result;
    } catch (error: any) {
      console.error("socialService: Error in refreshDiscover:", error);
      return { success: false, message: error.message, users: [] };
    }
  }
};
