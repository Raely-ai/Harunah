import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';

import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { CustomToast } from './CustomToast';

import { UserProfile, normalizeUserProfile } from '../types';

// Use a ref to track shown message IDs to prevent double processing same message snapshot
const processedMessageIds = new Set<string>();
// Cache for user profiles to avoid redundant fetches
const profileCache = new Map<string, { name: string, photo: string }>();

export const NotificationToastListener: React.FC<{ 
  userProfile: UserProfile | null; 
  activeChatId?: string | null;
  onNavigate: (tab: any) => void;
}> = ({ 
  userProfile,
  activeChatId,
  onNavigate
}) => {
  const mountTime = useRef(new Date());

  // Helper to safely parse Firestore Timestamps or strings
  const parseDate = (val: any) => {
    if (!val) return null;
    if (val.toDate) return val.toDate(); // Firestore Timestamp
    return new Date(val); // String or number
  };

  useEffect(() => {
    if (!userProfile?.uid) return;

    console.log("TOAST_LISTENER_ACTIVE", userProfile.uid);

    // 1. Listen for new Interaction Requests (Likes, Friend Requests)
    const requestsQuery = query(
      collection(db, "interactionRequests"),
      where("toUserId", "==", userProfile.uid),
      where("status", "==", "pending")
    );

    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !change.doc.metadata.hasPendingWrites) {
          const docId = change.doc.id;
          if (processedMessageIds.has(docId)) return;

          const data = change.doc.data();
          const createdAt = parseDate(data.createdAt);
          
          if (createdAt && createdAt > mountTime.current) {
            processedMessageIds.add(docId);
            toast(<CustomToast 
                name={data.senderName || 'Yeni Beğeni'}
                message={data.type === 'super_like' ? 'Sana bir Süper Like gönderdi! 🔥' : 'Seni beğendi, hemen bak! ❤️'}
                avatar={data.senderPhoto || ''}
                onNavigate={() => onNavigate('messages')} 
                onDismiss={() => {}}
            />, { id: `request-${docId}` });
          }
        }
      });
    });

    // 2. Listen for new Completed Readings
    const readingsQuery = query(
      collection(db, "readings"),
      where("userId", "==", userProfile.uid),
      where("status", "==", "completed")
    );

    const unsubReadings = onSnapshot(readingsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !change.doc.metadata.hasPendingWrites) {
          const docId = change.doc.id;
          if (processedMessageIds.has(docId)) return;

          const data = change.doc.data();
          const createdAt = parseDate(data.createdAt);
          
          if (createdAt && createdAt > mountTime.current) {
            processedMessageIds.add(docId);
            toast(<CustomToast 
                name="Kahve Falı"
                message="Kahve falın yorumlandı, hemen incele! ☕"
                avatar=""
                onNavigate={() => onNavigate('history')} 
                onDismiss={() => {}}
            />, { id: `reading-${docId}` });
          }
        }
      });
    });

    // 3. Listen for new Messages
    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", userProfile.uid)
    );

    const unsubChats = onSnapshot(chatsQuery, async (snapshot) => {
      console.log("MESSAGE_CHANGES", snapshot.docChanges().length);
      for (const change of snapshot.docChanges()) {
        const chatId = change.doc.id;
        const data = change.doc.data();
        const senderId = data.lastMessageSenderId;
        const lastMessageAt = parseDate(data.lastMessageAt);
        const lastMessage = data.lastMessage || '';
        
        // Improve messageId derivation with fallbacks - include timestamp and text snippet for uniqueness
        const messageId = data.lastMessageId || 
                         (lastMessageAt && senderId ? `${lastMessageAt.getTime()}_${senderId}_${lastMessage.slice(0, 10)}` : null);

        const uniqueMessageKey = `${chatId}_${messageId}`;
        console.log("UNIQUE_MESSAGE_KEY", uniqueMessageKey);

        console.log("MESSAGE_DEBUG", {
          chatId,
          messageId,
          uniqueMessageKey,
          senderId,
          rawLastMessageId: data.lastMessageId,
          currentUserId: userProfile.uid,
          activeChatId,
          createdAt: lastMessageAt,
          isOwnMessage: senderId === userProfile.uid,
          isActiveChat: activeChatId && String(chatId).trim() === String(activeChatId).trim(),
          alreadyProcessed: uniqueMessageKey ? processedMessageIds.has(uniqueMessageKey) : false,
          passesTimeCheck: lastMessageAt && lastMessageAt > mountTime.current,
          changeType: change.type,
          hasPendingWrites: change.doc.metadata.hasPendingWrites
        });

        const hasPendingWrites = change.doc.metadata.hasPendingWrites;

        if ((change.type === "added" || change.type === "modified") && !hasPendingWrites) {
          // Strict suppression: Current chat or sender is me
          const isActiveChat = activeChatId && String(chatId).trim() === String(activeChatId).trim();
          const isOwnMessage = senderId === userProfile.uid;
          const passesTimeCheck = lastMessageAt && lastMessageAt > mountTime.current;

          if (isActiveChat) console.log("BLOCK_ACTIVE_CHAT", chatId);
          if (isOwnMessage) console.log("BLOCK_OWN_MESSAGE", senderId);
          if (!passesTimeCheck) console.log("BLOCK_TIME_CHECK", { lastMessageAt, mountTime: mountTime.current });
          if (!messageId) console.log("BLOCK_NO_MESSAGE_ID");

          if (isActiveChat || isOwnMessage || !passesTimeCheck || !messageId) continue;

          if (processedMessageIds.has(uniqueMessageKey)) {
            console.log("BLOCK_ALREADY_PROCESSED", uniqueMessageKey);
            continue;
          }

          // Fetch Sender Profile for Toast
          let senderName = data.lastMessageSenderName;
          let senderPhoto = data.lastMessageSenderPhoto;

          if (!senderName || senderName === 'Yeni Mesaj') {
            if (profileCache.has(senderId)) {
              senderName = profileCache.get(senderId)?.name;
              senderPhoto = profileCache.get(senderId)?.photo;
            } else {
              try {
                const userSnap = await getDoc(doc(db, "users", senderId));
                if (userSnap.exists()) {
                  const uData = userSnap.data();
                  const profile = normalizeUserProfile(uData, userSnap.id) as any;
                  senderName = profile.social?.nickname || profile.displayName || profile.username || profile.nickname || profile.name || 
                               profile.email?.split('@')[0] || 'Kullanıcı';
                  senderPhoto = (profile.social?.photos?.[0]) || profile.photoURL || profile.profilePhoto || profile.avatar || profile.photo || '';
                  profileCache.set(senderId, { name: senderName, photo: senderPhoto });
                }
              } catch (e) {
                console.error("Error fetching sender profile for toast:", e);
              }
            }
          }

          console.log("SHOW_TOAST", { chatId, messageId, senderId });
          processedMessageIds.add(uniqueMessageKey);

          // Using consistent ID per chat prevents spamming multiple toasts for same conversation
          toast(<CustomToast 
            name={senderName || 'Yeni Mesaj'}
            message={lastMessage || 'Yeni bir mesajın var.'}
            avatar={senderPhoto || ''}
            onNavigate={() => {
              onNavigate('messages');
              // Trigger direct chat opening with scrolling
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('openChatFromToast', { detail: { chatId, messageId: data.lastMessageId || messageId } }));
              }, 100);
            }}
            onDismiss={() => {}}
          />, { 
            id: `chat-${chatId}`,
            duration: 4000
          });
        }
      }
    });

    return () => {
      unsubRequests();
      unsubReadings();
      unsubChats();
      // Only clear if needed, keeping processed ids might prevent repeats on toggle
      // processedMessageIds.clear(); 
    };
  }, [userProfile?.uid, activeChatId, onNavigate]);

  return null;
};
