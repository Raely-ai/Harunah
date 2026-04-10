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
import { db, auth, storage, handleFirestoreError, OperationType } from "./firebase";
import { UserProfile, InteractionRequest, SocialActionResult, Message } from "../types";
import { walletService } from "./walletService";

export const socialService = {
  // 1. Create or Get Chat
  async createChat(userAId: string, userBId: string, existingBatch?: any): Promise<string> {
    const chatId = `chat_${[userAId, userBId].sort().join('_')}`;
    const chatRef = doc(db, "chats", chatId);
    
    let chatSnap;
    try {
      chatSnap = await getDoc(chatRef);
    } catch (err) {
      // Ignore read errors on non-existent docs
    }

    if (chatSnap?.exists()) {
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
    } catch (err) {
      console.warn("socialService: Error checking legacy chats:", err);
    }

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
      
      // Standalone cleanup
      const deleteSafe = async (collectionName: string, docId: string) => {
        try {
          await deleteDoc(doc(db, collectionName, docId));
        } catch (err) {
          // Cleanup failed, likely already deleted or no permission (safe to ignore)
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
    if (!toUserId) {
      return 'INVALID_TARGET';
    }
    if (fromUser.uid === toUserId) {
      return 'SELF_ACTION';
    }

    try {
      if (type === 'super_like') {
        const consumed = await walletService.consumeSocialFeature(fromUser.uid, 'superLike');
        if (!consumed) return 'TECHNICAL_ERROR'; // Or a custom 'NOT_ENOUGH_CREDITS' if I had one
      }

      const swipeId = `swipe_${fromUser.uid}_${toUserId}`;
      let swipeRef = doc(db, "swipes", swipeId);
      let swipeSnap = await getDoc(swipeRef);

      // Backward Compatibility: Check for legacy swipe with random ID
      if (!swipeSnap.exists()) {
        const q = query(
          collection(db, "swipes"),
          where("fromUserId", "==", fromUser.uid),
          where("toUserId", "==", toUserId),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          swipeRef = doc(db, "swipes", snap.docs[0].id);
          swipeSnap = snap.docs[0];
        }
      }

      if (swipeSnap.exists()) {
        const existingData = swipeSnap.data();
        // If it's the same type, ignore
        if (existingData.type === type) {
          return 'SUCCESS';
        }
        
        // If changing from 'pass' to 'like'/'super_like', we allow it
        if (existingData.type === 'pass' && (type === 'like' || type === 'super_like')) {
          // Continue to update
        } else {
          return 'SUCCESS'; // Already swiped, treat as success
        }
      }

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
    
    if (!toUser?.uid) {
      return 'INVALID_TARGET';
    }
    
    // CRITICAL: Use auth.currentUser.uid as the ONLY source of truth for the sender ID
    if (!currentUid) {
      return 'TECHNICAL_ERROR';
    }
    
    const fromUserId = currentUid;
    
    if (fromUserId === toUser.uid) {
      return 'SELF_ACTION';
    }

    try {
      // 1. Check if chat already exists (Deterministic Chat ID)
      const chatId = `chat_${[fromUserId, toUser.uid].sort().join('_')}`;
      
      let chatSnap;
      try {
        chatSnap = await getDoc(doc(db, "chats", chatId));
      } catch (err) {
        // Ignore read errors
      }

      if (chatSnap?.exists()) {
        return 'ALREADY_CHATTING';
      }

      // 2. Check if request already exists (Deterministic Request ID)
      const requestId = `request_${fromUserId}_${toUser.uid}`;
      let requestRef = doc(db, "interactionRequests", requestId);
      let requestSnap;
      
      try {
        requestSnap = await getDoc(requestRef);
      } catch (err) {
        // Ignore read errors
      }
      
      // Backward Compatibility: Check for legacy request with random ID
      if (!requestSnap?.exists()) {
        try {
          const q = query(
            collection(db, "interactionRequests"),
            where("fromUserId", "==", fromUserId),
            where("toUserId", "==", toUser.uid),
            limit(1)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            requestRef = doc(db, "interactionRequests", snap.docs[0].id);
            requestSnap = snap.docs[0];
          }
        } catch (queryErr) {
          // Ignore query errors
        }
      }

      if (requestSnap?.exists()) {
        const existingData = requestSnap.data();
        if (existingData.status === 'pending') {
          return 'ALREADY_REQUESTED';
        }
        if (existingData.status === 'accepted') {
          return 'ALREADY_CHATTING';
        }
      }

      // 3. Create request with deterministic ID or update legacy one
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
      return 'SUCCESS';
    } catch (error) {
      console.error("socialService: Error in sendMessageRequest:", error);
      return 'TECHNICAL_ERROR';
    }
  },

  // 4. Accept Request (DEBUG MODE - Sequential)
  async acceptRequest(request: InteractionRequest) {
    const currentUid = auth.currentUser?.uid;
    
    const chatId = `chat_${[request.fromUserId, request.toUserId].sort().join('_')}`;
    const chatRef = doc(db, "chats", chatId);

    // STEP 1: REQUEST UPDATE
    try {
      await updateDoc(doc(db, "interactionRequests", request.id), {
        status: 'accepted',
        updatedAt: serverTimestamp()
      });
    } catch (error: any) {
      console.error("socialService: request update failed", error?.code, error?.message);
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
    } catch (error: any) {
      console.error("socialService: chat create failed", error?.code, error?.message);
    }

    // STEP 3: MESSAGE CREATE
    try {
      const msgRef = doc(collection(db, "messages"));
      await setDoc(msgRef, {
        chatId,
        senderId: "system",
        text: "Sohbet başlayabilir.",
        createdAt: serverTimestamp(),
        seen: false,
        status: 'sent',
        type: 'system'
      });
    } catch (error: any) {
      console.error("socialService: message create failed", error?.code, error?.message);
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
    } catch (error: any) {
      console.error("socialService: notification create failed", error?.code, error?.message);
    }

    // STEP 5: CLEANUP DELETE (Request)
    try {
      await deleteDoc(doc(db, "interactionRequests", request.id));
    } catch (error: any) {
      console.error("socialService: cleanup delete (request) failed", error?.code, error?.message);
    }

    // STEP 6: CLEANUP DELETE (Swipes)
    try {
      const swipeId1 = `swipe_${request.fromUserId}_${request.toUserId}`;
      await deleteDoc(doc(db, "swipes", swipeId1));
    } catch (error: any) {
      console.error("socialService: cleanup delete (swipe) failed", error?.code, error?.message);
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
      await setDoc(doc(db, "users", uid), {
        social: {
          isOnline: isOnline,
          lastSeen: serverTimestamp()
        }
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  },

  async updateSocialField(uid: string, field: string, value: any) {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    await setDoc(userRef, {
      social: {
        [field]: value
      }
    }, { merge: true });
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
