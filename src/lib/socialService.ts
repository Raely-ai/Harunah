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

export const socialService = {
  // 1. Create or Get Chat
  async createChat(_userAId: string, userBId: string): Promise<string> {
    console.log("socialService: createChat (Backend) starting", { userBId });
    try {
      const result = await callFunction('createChat', { targetUserId: userBId });
      return result.chatId;
    } catch (error: any) {
      console.error("socialService: Error in createChat (Backend):", error);
      throw error;
    }
  },

  // 2. Send Like (Encounter Module)
  async sendLike(fromUser: UserProfile, toUserId: string, type: 'like' | 'super_like' | 'pass'): Promise<SocialActionResult> {
    console.log("socialService: sendLike (Backend) called", { fromUserId: fromUser.uid, toUserId, type });
    if (!toUserId) return 'INVALID_TARGET';
    if (fromUser.uid === toUserId) return 'SELF_ACTION';

    try {
      const result = await callFunction('sendLike', { targetUserId: toUserId, type });
      return result.status;
    } catch (error: any) {
      console.error("socialService: Error in sendLike (Backend):", error);
      toast.error(error.message || "İşlem sırasında bir hata oluştu.");
      return 'TECHNICAL_ERROR';
    }
  },

  // 2.1 Get Swiped IDs
  async getSwipedUserIds(userId: string): Promise<string[]> {
    try {
      const q = query(
        collection(db, "swipes"),
        where("fromUserId", "==", userId)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data().toUserId);
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
  async sendMessageRequest(fromUser: UserProfile, toUser: UserProfile): Promise<SocialActionResult> {
    const currentUid = auth.currentUser?.uid;
    
    console.log("socialService: sendMessageRequest (Backend) called", { 
      toUserId: toUser?.uid,
    });

    if (!toUser?.uid) return 'INVALID_TARGET';
    if (!currentUid) return 'TECHNICAL_ERROR';
    if (currentUid === toUser.uid) return 'SELF_ACTION';

    try {
      const result = await callFunction('sendMessageRequest', { targetUserId: toUser.uid });
      return result.status;
    } catch (error) {
      console.error("socialService: Error in sendMessageRequest (Backend):", error);
      return 'TECHNICAL_ERROR';
    }
  },

  // 4. Accept Request
  async acceptRequest(request: InteractionRequest) {
    console.log("socialService: acceptRequest (Backend) starting", { requestId: request.id });
    try {
      const result = await callFunction('acceptRequest', { requestId: request.id });
      return result.chatId;
    } catch (error: any) {
      console.error("socialService: Error in acceptRequest (Backend):", error);
      throw error;
    }
  },

  // 5. Reject Request
  async rejectRequest(requestId: string) {
    console.log("socialService: rejectRequest (Backend) starting", { requestId });
    try {
      await callFunction('rejectRequest', { requestId });
    } catch (error: any) {
      console.error("socialService: Error in rejectRequest (Backend):", error);
      throw error;
    }
  },

  async updateUserStatus(uid: string, isOnline: boolean) {
    if (!uid || auth.currentUser?.uid !== uid) return;
    try {
      await updateDoc(doc(db, "users", uid), {
        "social.isOnline": isOnline,
        "social.lastSeen": serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async updateSocialField(uid: string, field: string, value: any) {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      [`social.${field}`]: value
    });
  },

  // --- Advanced Messaging Features ---

  async sendMessage(chatId: string, senderId: string, otherUserId: string, content: { text?: string, mediaUrl?: string, mediaType?: 'image' | 'video' }) {
    console.log("socialService: sendMessage (Backend) starting", { chatId });
    try {
      const result = await callFunction('sendMessage', { 
        chatId, 
        text: content.text, 
        mediaUrl: content.mediaUrl, 
        mediaType: content.mediaType 
      });
      return result.messageId;
    } catch (error: any) {
      console.error("socialService: Error in sendMessage (Backend):", error);
      throw error;
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
    console.log("socialService: deleteChat (Backend) starting", { chatId });
    try {
      await callFunction('deleteChat', { chatId });
    } catch (error: any) {
      console.error("socialService: Error in deleteChat (Backend):", error);
      throw error;
    }
  },

  async markAsSeen(chatId: string, _currentUserId: string, _otherUserId: string) {
    try {
      await callFunction('markAsSeen', { chatId });
    } catch (error: any) {
      console.error("socialService: Error in markAsSeen (Backend):", error);
    }
  },

  async markAsDelivered(chatId: string, _currentUserId: string, _otherUserId: string) {
    try {
      await callFunction('markAsDelivered', { chatId });
    } catch (error: any) {
      console.error("socialService: Error in markAsDelivered (Backend):", error);
    }
  },

  async deleteMessage(messageId: string, _chatId: string, forEveryone: boolean = false) {
    console.log("socialService: deleteMessage (Backend) starting", { messageId });
    try {
      await callFunction('deleteMessage', { messageId, forEveryone });
    } catch (error: any) {
      console.error("socialService: Error in deleteMessage (Backend):", error);
      throw error;
    }
  },

  async editMessage(messageId: string, newText: string) {
    console.log("socialService: editMessage (Backend) starting", { messageId });
    try {
      await callFunction('editMessage', { messageId, newText });
    } catch (error: any) {
      console.error("socialService: Error in editMessage (Backend):", error);
      throw error;
    }
  },

  async setTypingStatus(chatId: string, _userId: string, isTyping: boolean) {
    try {
      await callFunction('setTypingStatus', { chatId, isTyping });
    } catch (error: any) {
      console.error("socialService: Error in setTypingStatus (Backend):", error);
    }
  },

  // --- Privacy & Moderation ---
  async blockUser(targetUid: string) {
    return await callFunction('blockUser', { targetUid });
  },

  async unblockUser(targetUid: string) {
    return await callFunction('unblockUser', { targetUid });
  },

  async muteUser(targetUid: string) {
    return await callFunction('muteUser', { targetUid });
  },

  async unmuteUser(targetUid: string) {
    return await callFunction('unmuteUser', { targetUid });
  }
};
