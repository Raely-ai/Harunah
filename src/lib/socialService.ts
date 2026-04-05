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
  deleteDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, auth, storage } from "./firebase";
import { UserProfile, InteractionRequest, SocialActionResult, Message } from "../types";

export const socialService = {
  // 1. Create or Get Chat
  async createChat(userAId: string, userBId: string, existingBatch?: any): Promise<string> {
    const chatId = `chat_${[userAId, userBId].sort().join('_')}`;
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) return chatId;

    // Backward Compatibility: Check for legacy chat with random ID
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", userAId),
      limit(20)
    );
    const snap = await getDocs(q);
    const legacyChat = snap.docs.find(d => {
      const parts = d.data().participants as string[];
      return parts.includes(userBId);
    });

    if (legacyChat) return legacyChat.id;

    // Create new deterministic chat
    const batch = existingBatch || writeBatch(db);
    
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
    batch.set(msgRef, {
      chatId,
      senderId: "system",
      text: "Sohbet başlayabilir.",
      createdAt: serverTimestamp(),
      seen: false,
      status: 'sent',
      type: 'system'
    });

    if (!existingBatch) {
      await batch.commit();
    }
    return chatId;
  },

  // 2. Send Like (Encounter Module)
  async sendLike(fromUser: UserProfile, toUserId: string, type: 'like' | 'super_like' | 'pass'): Promise<SocialActionResult> {
    console.log("socialService: sendLike called", { fromUserId: fromUser.uid, toUserId, type });
    if (!toUserId) {
      console.warn("socialService: sendLike INVALID_TARGET (toUserId missing)");
      return 'INVALID_TARGET';
    }
    if (fromUser.uid === toUserId) {
      console.warn("socialService: sendLike SELF_ACTION");
      return 'SELF_ACTION';
    }

    try {
      const swipeId = `swipe_${fromUser.uid}_${toUserId}`;
      let swipeRef = doc(db, "swipes", swipeId);
      console.log("socialService: Checking swipe existence:", swipeId);
      let swipeSnap = await getDoc(swipeRef);

      // Backward Compatibility: Check for legacy swipe with random ID
      if (!swipeSnap.exists()) {
        console.log("socialService: Swipe not found by ID, checking legacy query...");
        const q = query(
          collection(db, "swipes"),
          where("fromUserId", "==", fromUser.uid),
          where("toUserId", "==", toUserId),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          console.log("socialService: Legacy swipe found:", snap.docs[0].id);
          swipeRef = doc(db, "swipes", snap.docs[0].id);
          swipeSnap = snap.docs[0];
        }
      }

      if (swipeSnap.exists()) {
        const existingData = swipeSnap.data();
        console.log("socialService: Existing swipe data:", existingData);
        // If it's the same type, ignore
        if (existingData.type === type) {
          console.log("socialService: Same swipe type, ignoring.");
          return 'SUCCESS';
        }
        
        // If changing from 'pass' to 'like'/'super_like', we allow it
        if (existingData.type === 'pass' && (type === 'like' || type === 'super_like')) {
          console.log("socialService: Changing pass to like/super_like");
          // Continue to update
        } else {
          console.log("socialService: Already swiped, treating as success");
          return 'SUCCESS'; // Already swiped, treat as success
        }
      }

      console.log("socialService: Committing swipe batch...");
      const batch = writeBatch(db);

      batch.set(swipeRef, {
        id: swipeRef.id,
        fromUserId: fromUser.uid,
        toUserId,
        type,
        createdAt: swipeSnap.exists() ? swipeSnap.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (type !== 'pass') {
        // Create notification
        const notifRef = doc(collection(db, "notifications"));
        batch.set(notifRef, {
          userId: toUserId,
          type: type === 'super_like' ? "super_like" : "like",
          title: type === 'super_like' ? "Yeni Süper Like!" : "Yeni Beğeni!",
          message: `${fromUser.social?.nickname || fromUser.displayName} seni beğendi! ❤️`,
          data: { fromUserId: fromUser.uid },
          senderSnapshot: {
            nickname: fromUser.social?.nickname || fromUser.displayName || "İsimsiz",
            photoURL: fromUser.social?.photos?.[0] || fromUser.photoURL || ""
          },
          read: false,
          createdAt: serverTimestamp()
        });

        // If super_like, also create an interactionRequest
        if (type === 'super_like') {
          const requestId = `request_${fromUser.uid}_${toUserId}`;
          const requestRef = doc(db, "interactionRequests", requestId);
          batch.set(requestRef, {
            id: requestId,
            fromUserId: fromUser.uid,
            toUserId: toUserId,
            status: "pending",
            type: "super_like",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            senderSnapshot: {
              nickname: fromUser.social?.nickname || fromUser.displayName || "İsimsiz",
              photoURL: fromUser.social?.photos?.[0] || fromUser.photoURL || ""
            },
            receiverSnapshot: {
              nickname: "Kullanıcı", // We don't have full toUser profile here, but we can update it later or use a generic name
              photoURL: ""
            }
          });
        }
      }

      await batch.commit();
      console.log("socialService: Swipe batch committed successfully.");
      return 'SUCCESS';
    } catch (error) {
      console.error("socialService: Error in sendLike:", error);
      return 'TECHNICAL_ERROR';
    }
  },

  // 3. Send Message Request (Discover Module)
  async sendMessageRequest(fromUser: UserProfile, toUser: UserProfile): Promise<SocialActionResult> {
    const currentUid = auth.currentUser?.uid;
    
    console.log("socialService: sendMessageRequest called", { 
      passedFromUserId: fromUser?.uid, 
      authCurrentUserId: currentUid,
      toUserId: toUser?.uid,
      fromUserNickname: fromUser?.social?.nickname || fromUser?.displayName,
      toUserNickname: toUser?.social?.nickname || toUser?.displayName
    });

    if (!toUser?.uid) {
      console.warn("socialService: sendMessageRequest INVALID_TARGET (toUser.uid missing)");
      return 'INVALID_TARGET';
    }
    
    // CRITICAL: Use auth.currentUser.uid as the ONLY source of truth for the sender ID
    // If it's missing, we MUST fail because Firestore rules will reject it anyway.
    if (!currentUid) {
      console.error("socialService: sendMessageRequest TECHNICAL_ERROR (auth.currentUser.uid is missing)");
      return 'TECHNICAL_ERROR';
    }
    
    const fromUserId = currentUid;
    
    if (fromUserId === toUser.uid) {
      console.warn("socialService: sendMessageRequest SELF_ACTION");
      return 'SELF_ACTION';
    }

    try {
      // 1. Check if chat already exists (Deterministic Chat ID)
      const chatId = `chat_${[fromUserId, toUser.uid].sort().join('_')}`;
      console.log("socialService: Checking chat existence:", chatId);
      
      let chatSnap;
      try {
        chatSnap = await getDoc(doc(db, "chats", chatId));
      } catch (err) {
        console.error("socialService: Error checking chat existence (likely permission denied on non-existent doc):", err);
        // If we can't read it, we assume it doesn't exist or we don't have permission.
        // But with the new rules, this should not happen.
      }

      if (chatSnap?.exists()) {
        console.log("socialService: Chat already exists.");
        return 'ALREADY_CHATTING';
      }

      // 2. Check if request already exists (Deterministic Request ID)
      const requestId = `request_${fromUserId}_${toUser.uid}`;
      console.log("socialService: Checking request existence:", requestId);
      let requestRef = doc(db, "interactionRequests", requestId);
      let requestSnap;
      
      try {
        requestSnap = await getDoc(requestRef);
      } catch (err) {
        console.error("socialService: Error checking request existence:", err);
      }
      
      // Backward Compatibility: Check for legacy request with random ID
      // ONLY if deterministic one doesn't exist AND we didn't have a permission error
      if (!requestSnap?.exists()) {
        console.log("socialService: Request not found by ID, checking legacy query...");
        try {
          const q = query(
            collection(db, "interactionRequests"),
            where("fromUserId", "==", fromUserId),
            where("toUserId", "==", toUser.uid),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            console.log("socialService: Legacy request found:", snap.docs[0].id);
            requestRef = doc(db, "interactionRequests", snap.docs[0].id);
            requestSnap = snap.docs[0];
          }
        } catch (queryErr) {
          console.warn("socialService: Legacy query failed (likely missing index):", queryErr);
          // If query fails, we just proceed with the deterministic ID.
        }
      }

      if (requestSnap?.exists()) {
        const existingData = requestSnap.data();
        console.log("socialService: Existing request data:", existingData);
        if (existingData.status === 'pending') {
          console.log("socialService: Request already pending.");
          return 'ALREADY_REQUESTED';
        }
        if (existingData.status === 'accepted') {
          console.log("socialService: Request already accepted (chat should exist).");
          return 'ALREADY_CHATTING';
        }
        // If rejected, we allow resubmitting (overwriting the existing doc)
      }

      // 3. Create request with deterministic ID or update legacy one
      console.log("socialService: Committing request batch...");
      const batch = writeBatch(db);
      
      const requestData = {
        id: requestRef.id,
        fromUserId: fromUserId,
        toUserId: toUser.uid,
        status: "pending",
        type: "message_request",
        createdAt: (requestSnap?.exists() && requestSnap.data().createdAt) ? requestSnap.data().createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
        senderSnapshot: {
          nickname: fromUser.social?.nickname || fromUser.displayName || "İsimsiz",
          photoURL: fromUser.social?.photos?.[0] || fromUser.photoURL || ""
        },
        receiverSnapshot: {
          nickname: toUser.social?.nickname || toUser.displayName || "İsimsiz",
          photoURL: toUser.social?.photos?.[0] || toUser.photoURL || ""
        }
      };
      
      batch.set(requestRef, requestData, { merge: true });

      // 4. Create notification
      const notifRef = doc(collection(db, "notifications"));
      batch.set(notifRef, {
        userId: toUser.uid,
        type: "message_request",
        title: "Yeni Mesaj İsteği",
        message: `${fromUser.social?.nickname || fromUser.displayName || "Biri"} sana bir mesaj isteği gönderdi.`,
        data: { fromUserId: fromUserId },
        read: false,
        createdAt: serverTimestamp()
      });

      await batch.commit();
      console.log("socialService: Request batch committed successfully.");
      return 'SUCCESS';
    } catch (error) {
      console.error("socialService: CRITICAL ERROR in sendMessageRequest:", error);
      // Log more details if it's a Firebase error
      if (error && typeof error === 'object' && 'code' in error) {
        console.error("socialService: Firebase Error Code:", (error as any).code);
        console.error("socialService: Firebase Error Message:", (error as any).message);
      }
      return 'TECHNICAL_ERROR';
    }
  },

  // 4. Accept Request
  async acceptRequest(request: InteractionRequest) {
    const batch = writeBatch(db);
    
    // 1. Update request status
    batch.update(doc(db, "interactionRequests", request.id), {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });

    // 2. Create chat (this will add to the batch)
    const chatId = await this.createChat(request.fromUserId, request.toUserId, batch);
    
    // 3. Create notification for the sender
    const notifRef = doc(collection(db, "notifications"));
    batch.set(notifRef, {
      userId: request.fromUserId,
      type: "request_accepted",
      title: "İstek Kabul Edildi!",
      message: "Mesaj isteğin kabul edildi, sohbete başlayabilirsin! 🎉",
      data: { chatId },
      read: false,
      createdAt: serverTimestamp()
    });

    await batch.commit();
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
    if (!uid) return;
    try {
      await updateDoc(doc(db, "users", uid), {
        "social.isOnline": isOnline,
        "social.lastSeen": serverTimestamp()
      });
    } catch (error) {
      console.error("Error updating user status:", error);
    }
  },

  // --- Advanced Messaging Features ---

  async sendMessage(chatId: string, senderId: string, otherUserId: string, content: { text?: string, mediaUrl?: string, mediaType?: 'image' | 'video' }) {
    const batch = writeBatch(db);
    const msgRef = doc(collection(db, "messages"));
    
    const type = content.mediaType || 'text';
    const lastMessageText = type === 'text' ? content.text : (type === 'image' ? "📷 Görsel" : "🎥 Video");

    const messageData = {
      id: msgRef.id,
      chatId,
      senderId,
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

  async markAsSeen(chatId: string, currentUserId: string, otherUserId: string) {
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chatId),
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
  }
};
