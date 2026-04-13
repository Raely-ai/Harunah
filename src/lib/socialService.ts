import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  limit,
  writeBatch,
  increment,
  deleteDoc,
  arrayUnion
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage, functions, handleFirestoreError, OperationType } from "./firebase";
import { UserProfile, InteractionRequest, SocialActionResult, Message } from "../types";
import { walletService } from "./walletService";
import { httpsCallable } from "firebase/functions";

import { toast } from "sonner";

export const socialService = {
  // 1. Create or Get Chat
  async createChat(userAId: string, userBId: string, existingBatch?: any): Promise<string> {
    const currentUid = auth.currentUser?.uid;
    console.log("socialService: createChat starting", { 
      userAId, 
      userBId, 
      currentUid,
      hasExistingBatch: !!existingBatch 
    });
    
    const chatId = `chat_${[userAId, userBId].sort().join('_')}`;
    const chatRef = doc(db, "chats", chatId);
    
    let chatSnap;
    try {
      chatSnap = await getDoc(chatRef);
    } catch (err) {
      console.warn("socialService: Error getting chat doc (likely permission denied on non-existent):", err);
    }

    if (chatSnap?.exists()) {
      console.log("socialService: Chat already exists:", chatId);
      return chatId;
    }

    // Backward Compatibility: Check for legacy chat with random ID
    let legacyChat = null;
    try {
      const q = query(
        collection(db, "chats"),
        where("participants", "array-contains", userAId),
        limit(20)
      );
      const snap = await getDocs(q);
      legacyChat = snap.docs.find(d => {
        const parts = d.data().participants as string[];
        return parts.includes(userBId);
      });
      if (legacyChat) console.log("socialService: Found legacy chat", legacyChat.id);
    } catch (err) {
      console.warn("socialService: Error checking legacy chats:", err);
    }

    if (legacyChat) return legacyChat.id;

    // Create new deterministic chat
    const batch = existingBatch || writeBatch(db);
    
    console.log("socialService: Setting chat document", { 
      chatId, 
      participants: [userAId, userBId],
      currentUid 
    });
    
    batch.set(chatRef, {
      id: chatId,
      participants: [userAId, userBId],
      createdAt: serverTimestamp(),
      lastMessage: "Sohbet başladı! 👋",
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: "system",
      lastMessageStatus: 'sent',
      status: 'active',
      unreadCount: {
        [userAId]: 0,
        [userBId]: 0
      },
      typing: {
        [userAId]: false,
        [userBId]: false
      }
    });

    // Initial system message
    const msgRef = doc(collection(db, "messages"));
    console.log("socialService: Setting initial system message", { 
      msgId: msgRef.id, 
      chatId, 
      senderId: "system" 
    });
    batch.set(msgRef, {
      chatId,
      participants: [userAId, userBId],
      senderId: "system",
      text: "Sohbet başlayabilir.",
      createdAt: serverTimestamp(),
      seen: false,
      status: 'sent',
      type: 'system'
    });

    // We no longer delete interactionRequests and swipes inside this batch.
    // Cleanup is handled safely outside the batch to prevent permission errors
    // on non-existent documents from failing the entire chat creation.

    if (!existingBatch) {
      console.log("socialService: Committing standalone chat batch...");
      await batch.commit();
      
      // Standalone cleanup
      const deleteSafe = async (collectionName: string, docId: string) => {
        try {
          await deleteDoc(doc(db, collectionName, docId));
        } catch (err) {
          console.warn(`socialService: Cleanup failed for ${collectionName}/${docId} (safe to ignore):`, err);
        }
      };
      
      Promise.allSettled([
        deleteSafe("interactionRequests", `request_${userAId}_${userBId}`),
        deleteSafe("interactionRequests", `request_${userBId}_${userAId}`),
        deleteSafe("swipes", `swipe_${userAId}_${userBId}`),
        deleteSafe("swipes", `swipe_${userBId}_${userAId}`)
      ]);
    }
    return chatId;
  },

  // 2. Send Like (Encounter Module)
  async sendLike(fromUser: UserProfile, toUserId: string, type: 'like' | 'super_like' | 'pass'): Promise<SocialActionResult> {
    console.log("socialService: sendLike (Backend) called", { fromUserId: fromUser.uid, toUserId, type });
    if (!toUserId) return 'INVALID_TARGET';
    if (fromUser.uid === toUserId) return 'SELF_ACTION';

    try {
      const func = httpsCallable(functions, 'sendLike');
      const result = await func({ targetUserId: toUserId, type });
      const data = result.data as { status: SocialActionResult };
      
      console.log("socialService: sendLike result:", data.status);
      return data.status;
    } catch (error: any) {
      console.error("socialService: Error in sendLike (Backend):", error);
      toast.error(error.message || "İşlem sırasında bir hata oluştu.");
      return 'TECHNICAL_ERROR';
    }
  },

  // 2.1 Check Block Status
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
      const func = httpsCallable(functions, 'sendMessageRequest');
      const result = await func({ targetUserId: toUser.uid });
      const data = result.data as { status: SocialActionResult };
      
      console.log("socialService: sendMessageRequest result:", data.status);
      return data.status;
    } catch (error) {
      console.error("socialService: Error in sendMessageRequest (Backend):", error);
      return 'TECHNICAL_ERROR';
    }
  },

  // 4. Accept Request (DEBUG MODE - Sequential)
  async acceptRequest(request: InteractionRequest) {
    const currentUid = auth.currentUser?.uid;
    console.log("socialService: acceptRequest DEBUG starting", { 
      requestId: request.id, 
      from: request.fromUserId, 
      to: request.toUserId, 
      currentUid 
    });
    
    const chatId = `chat_${[request.fromUserId, request.toUserId].sort().join('_')}`;
    const chatRef = doc(db, "chats", chatId);

    // STEP 1: REQUEST UPDATE
    try {
      await updateDoc(doc(db, "interactionRequests", request.id), {
        status: 'accepted',
        updatedAt: serverTimestamp()
      });
      console.log("✅ SUCCESS: request update");
    } catch (error: any) {
      console.error("❌ FAIL: request update", error?.code, error?.message);
    }

    // STEP 2: CHAT CREATE
    try {
      await setDoc(chatRef, {
        id: chatId,
        participants: [request.fromUserId, request.toUserId],
        createdAt: serverTimestamp(),
        lastMessage: "Sohbet başladı! 👋",
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: "system",
        lastMessageStatus: 'sent',
        status: 'active',
        unreadCount: {
          [request.fromUserId]: 0,
          [request.toUserId]: 0
        },
        typing: {
          [request.fromUserId]: false,
          [request.toUserId]: false
        }
      });
      console.log("✅ SUCCESS: chat create");
    } catch (error: any) {
      console.error("❌ FAIL: chat create", error?.code, error?.message);
    }

    // STEP 3: MESSAGE CREATE
    try {
      const msgRef = doc(collection(db, "messages"));
      await setDoc(msgRef, {
        chatId,
        participants: [request.fromUserId, request.toUserId],
        senderId: "system",
        text: "Sohbet başlayabilir.",
        createdAt: serverTimestamp(),
        seen: false,
        status: 'sent',
        type: 'system'
      });
      console.log("✅ SUCCESS: message create");
    } catch (error: any) {
      console.error("❌ FAIL: message create", error?.code, error?.message);
    }

    // STEP 4: NOTIFICATION CREATE
    try {
      const notifRef = doc(collection(db, "notifications"));
      await setDoc(notifRef, {
        userId: request.fromUserId,
        type: "request_accepted",
        title: "İstek Kabul Edildi!",
        message: "Mesaj isteğin kabul edildi, sohbete başlayabilirsin! 🎉",
        data: { chatId },
        read: false,
        createdAt: serverTimestamp()
      });
      console.log("✅ SUCCESS: notification create");
    } catch (error: any) {
      console.error("❌ FAIL: notification create", error?.code, error?.message);
    }

    // STEP 5: CLEANUP DELETE (Request)
    try {
      await deleteDoc(doc(db, "interactionRequests", request.id));
      console.log("✅ SUCCESS: cleanup delete (request)");
    } catch (error: any) {
      console.error("❌ FAIL: cleanup delete (request)", error?.code, error?.message);
    }

    // STEP 6: CLEANUP DELETE (Swipes)
    try {
      const swipeId1 = `swipe_${request.fromUserId}_${request.toUserId}`;
      await deleteDoc(doc(db, "swipes", swipeId1));
      console.log("✅ SUCCESS: cleanup delete (swipe)");
    } catch (error: any) {
      console.error("❌ FAIL: cleanup delete (swipe)", error?.code, error?.message);
    }

    return chatId;
  },

  // 5. Reject Request
  async rejectRequest(requestId: string) {
    await updateDoc(doc(db, "interactionRequests", requestId), {
      status: 'rejected',
      updatedAt: serverTimestamp()
    });
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
    // Check block status
    const blocked = await this.isBlocked(senderId, otherUserId);
    if (blocked) {
      throw new Error("Bu kullanıcıyla artık iletişim kuramazsın.");
    }

    const batch = writeBatch(db);
    const msgRef = doc(collection(db, "messages"));
    
    const type = content.mediaType || 'text';
    const lastMessageText = type === 'text' ? content.text : (type === 'image' ? "📷 Görsel" : "🎥 Video");

    const messageData = {
      id: msgRef.id,
      chatId,
      participants: [senderId, otherUserId],
      senderId,
      receiverId: otherUserId,
      text: content.text || "",
      mediaUrl: content.mediaUrl || null,
      mediaType: content.mediaType || null,
      createdAt: serverTimestamp(),
      status: 'sent',
      seen: false,
      type
    };

    batch.set(msgRef, messageData);

    const chatRef = doc(db, "chats", chatId);
    batch.update(chatRef, {
      lastMessage: lastMessageText,
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: senderId,
      lastMessageStatus: 'sent',
      [`unreadCount.${otherUserId}`]: increment(1)
    });

    await batch.commit();
    return msgRef.id;
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

  async deleteChat(chatId: string, userId: string) {
    const chatRef = doc(db, "chats", chatId);
    await updateDoc(chatRef, {
      deletedFor: arrayUnion(userId)
    });
  },

  async markAsSeen(chatId: string, currentUserId: string, otherUserId: string) {
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      where("participants", "array-contains", currentUserId),
      where("senderId", "==", otherUserId),
      where("status", "!=", "seen"),
      limit(50)
    );

    const snap = await getDocs(q);
    if (snap.empty) {
      // Still need to reset unreadCount in chat doc
      await updateDoc(doc(db, "chats", chatId), {
        [`unreadCount.${currentUserId}`]: 0
      });
      return;
    }

    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.update(d.ref, { status: 'seen', seen: true });
    });

    batch.update(doc(db, "chats", chatId), {
      [`unreadCount.${currentUserId}`]: 0
    });

    // If the last message was from the other user, update its status in the chat doc too
    const chatSnap = await getDoc(doc(db, "chats", chatId));
    if (chatSnap.exists() && chatSnap.data().lastMessageSenderId === otherUserId) {
      batch.update(doc(db, "chats", chatId), {
        lastMessageStatus: 'seen'
      });
    }

    await batch.commit();
  },

  async markAsDelivered(chatId: string, currentUserId: string, otherUserId: string) {
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
      where("participants", "array-contains", currentUserId),
      where("senderId", "==", otherUserId),
      where("status", "==", "sent"),
      limit(50)
    );

    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.update(d.ref, { status: 'delivered' });
    });
    
    await batch.commit();
  },

  async deleteMessage(messageId: string, chatId: string, forEveryone: boolean = false) {
    const msgRef = doc(db, "messages", messageId);
    if (forEveryone) {
      await updateDoc(msgRef, {
        isDeleted: true,
        deletedForEveryone: true,
        text: "Bu mesaj silindi.",
        mediaUrl: null,
        mediaType: null
      });
    } else {
      await updateDoc(msgRef, {
        isDeleted: true
      });
    }
  },

  async editMessage(messageId: string, newText: string) {
    const msgRef = doc(db, "messages", messageId);
    await updateDoc(msgRef, {
      text: newText,
      editedAt: serverTimestamp()
    });
  },

  async setTypingStatus(chatId: string, userId: string, isTyping: boolean) {
    await updateDoc(doc(db, "chats", chatId), {
      [`typing.${userId}`]: isTyping
    });
  },

  // --- Privacy & Moderation ---
  async blockUser(targetUid: string) {
    const func = httpsCallable(functions, 'blockUser');
    return await func({ targetUid });
  },

  async unblockUser(targetUid: string) {
    const func = httpsCallable(functions, 'unblockUser');
    return await func({ targetUid });
  },

  async muteUser(targetUid: string) {
    const func = httpsCallable(functions, 'muteUser');
    return await func({ targetUid });
  },

  async unmuteUser(targetUid: string) {
    const func = httpsCallable(functions, 'unmuteUser');
    return await func({ targetUid });
  }
};
