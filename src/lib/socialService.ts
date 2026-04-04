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
  async createChat(userAId: string, userBId: string): Promise<string> {
    const chatId = `chat_${[userAId, userBId].sort().join('_')}`;
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) return chatId;

    // Fetch snapshots for denormalization
    const [userASnap, userBSnap] = await Promise.all([
      getDoc(doc(db, "users", userAId)),
      getDoc(doc(db, "users", userBId))
    ]);

    const userAData = userASnap.data() as UserProfile;
    const userBData = userBSnap.data() as UserProfile;

    const participantSnapshots = {
      [userAId]: {
        nickname: userAData?.social?.nickname || userAData?.displayName || "Kullanıcı",
        photoURL: userAData?.social?.photos?.[0] || userAData?.photoURL || ""
      },
      [userBId]: {
        nickname: userBData?.social?.nickname || userBData?.displayName || "Kullanıcı",
        photoURL: userBData?.social?.photos?.[0] || userBData?.photoURL || ""
      }
    };

    // Create new deterministic chat
    const batch = writeBatch(db);
    
    batch.set(chatRef, {
      id: chatId,
      participants: [userAId, userBId],
      participantSnapshots,
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

    await batch.commit();
    return chatId;
  },

  // 2. Send Like (Encounter Module)
  async sendLike(fromUser: UserProfile, toUserId: string, type: 'like' | 'super_like' | 'pass'): Promise<SocialActionResult> {
    if (!toUserId) return 'INVALID_TARGET';
    if (fromUser.uid === toUserId) return 'SELF_ACTION';

    try {
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
        if (existingData.type === type) return 'SUCCESS';
        
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
      return 'SUCCESS';
    } catch (error) {
      console.error("Error in sendLike:", error);
      return 'TECHNICAL_ERROR';
    }
  },

  // 3. Send Message Request (Discover Module)
  async sendMessageRequest(fromUser: UserProfile, toUser: UserProfile): Promise<SocialActionResult> {
    const currentUid = auth.currentUser?.uid;
    
    console.log("sendMessageRequest called:", { 
      passedFromUserId: fromUser?.uid, 
      authCurrentUserId: currentUid,
      toUserId: toUser?.uid,
      fromUserNickname: fromUser?.social?.nickname || fromUser?.displayName,
      toUserNickname: toUser?.social?.nickname || toUser?.displayName
    });

    if (!toUser?.uid) {
      console.warn("sendMessageRequest: INVALID_TARGET (toUser.uid missing)");
      return 'INVALID_TARGET';
    }
    
    // Use auth.currentUser.uid as the source of truth for the sender ID
    const fromUserId = currentUid || fromUser?.uid;
    
    if (!fromUserId) {
      console.warn("sendMessageRequest: TECHNICAL_ERROR (fromUserId missing)");
      return 'TECHNICAL_ERROR';
    }
    
    if (fromUserId === toUser.uid) {
      console.warn("sendMessageRequest: SELF_ACTION");
      return 'SELF_ACTION';
    }

    try {
      // 1. Check if chat already exists (Deterministic Chat ID)
      const chatId = `chat_${[fromUserId, toUser.uid].sort().join('_')}`;
      console.log("Checking chat existence:", chatId);
      const chatSnap = await getDoc(doc(db, "chats", chatId));
      if (chatSnap.exists()) {
        console.log("Chat already exists.");
        return 'ALREADY_CHATTING';
      }

      // 2. Check if request already exists (Deterministic Request ID)
      const requestId = `request_${fromUserId}_${toUser.uid}`;
      console.log("Checking request existence:", requestId);
      let requestRef = doc(db, "interactionRequests", requestId);
      let requestSnap = await getDoc(requestRef);
      
      // Backward Compatibility: Check for legacy request with random ID
      if (!requestSnap.exists()) {
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
      }

      if (requestSnap.exists()) {
        const existingData = requestSnap.data();
        console.log("Request already exists with status:", existingData.status);
        if (existingData.status === 'pending') return 'ALREADY_REQUESTED';
        if (existingData.status === 'accepted') return 'ALREADY_CHATTING';
        // If rejected, we allow resubmitting (overwriting the existing doc)
      }

      // 3. Create request with deterministic ID or update legacy one
      console.log("Creating/Updating interaction request...");
      const batch = writeBatch(db);
      
      const requestData = {
        id: requestRef.id,
        fromUserId: fromUserId,
        toUserId: toUser.uid,
        status: "pending",
        type: "message_request",
        createdAt: requestSnap.exists() ? requestSnap.data().createdAt : serverTimestamp(),
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

      console.log("Committing batch...");
      await batch.commit();
      console.log("Batch committed successfully.");
      return 'SUCCESS';
    } catch (error) {
      console.error("CRITICAL ERROR in sendMessageRequest:", error);
      // Log more details if it's a Firebase error
      if (error && typeof error === 'object' && 'code' in error) {
        console.error("Firebase Error Code:", (error as any).code);
        console.error("Firebase Error Message:", (error as any).message);
      }
      return 'TECHNICAL_ERROR';
    }
  },

  // 4. Accept Request
  async acceptRequest(request: InteractionRequest) {
    await updateDoc(doc(db, "interactionRequests", request.id), {
      status: 'accepted',
      updatedAt: serverTimestamp()
    });

    return await this.createChat(request.fromUserId, request.toUserId);
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
    const batch = writeBatch(db);

    if (!snap.empty) {
      snap.docs.forEach(d => {
        batch.update(d.ref, { status: 'seen', seen: true });
      });
    }

    // Always reset unreadCount and update lastMessageStatus if applicable
    const chatRef = doc(db, "chats", chatId);
    batch.update(chatRef, {
      [`unreadCount.${currentUserId}`]: 0
    });

    // If the last message was from the other user, update its status in the chat doc too
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists() && chatSnap.data().lastMessageSenderId === otherUserId) {
      batch.update(chatRef, {
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

    // Update lastMessageStatus in chat doc if applicable
    const chatRef = doc(db, "chats", chatId);
    const chatSnap = await getDoc(chatRef);
    if (chatSnap.exists() && chatSnap.data().lastMessageSenderId === otherUserId && chatSnap.data().lastMessageStatus === 'sent') {
      batch.update(chatRef, {
        lastMessageStatus: 'delivered'
      });
    }
    
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
