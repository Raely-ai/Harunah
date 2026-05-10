import { useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, getDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';

import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { CustomToast } from './CustomToast';

import { UserProfile, normalizeUserProfile, AppTab } from '../types';
import { isNotificationProcessed, markNotificationProcessed } from '../lib/notificationStore';

// Cache for user profiles to avoid redundant fetches
const profileCache = new Map<string, { name: string, photo: string }>();

export const NotificationToastListener: React.FC<{ 
  userProfile: UserProfile | null; 
  activeChatId?: string | null;
  activeTab: AppTab;
  onNavigate: (tab: any) => void;
}> = ({ 
  userProfile,
  activeChatId,
  activeTab,
  onNavigate
}) => {
  const mountTime = useRef(new Date());
  const activeChatIdRef = useRef(activeChatId);
  const onNavigateRef = useRef(onNavigate);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    activeTabRef.current = activeTab;
  }, [onNavigate, activeTab]);

  // Helper to calculate profile completion
  const calculateProfileCompletion = (social: any) => {
    if (!social) return 0;
    let score = 0;
    if (social.nickname) score += 20;
    if (social.bio && social.bio.length > 20) score += 20;
    else if (social.bio) score += 10;
    
    if (social.photos && social.photos.length >= 3) score += 20;
    else if (social.photos && social.photos.length > 0) score += 10;
    
    if (social.interests && social.interests.length >= 5) score += 20;
    else if (social.interests && social.interests.length > 0) score += 10;
    
    if (social.birthDate && social.gender) score += 20;
    else if (social.birthDate || social.gender) score += 10;
    
    return score;
  };

  // Helper to safely parse Firestore Timestamps or strings
  const parseDate = (val: any) => {
    if (!val) return null;
    if (val.toDate) return val.toDate(); // Firestore Timestamp
    return new Date(val); // String or number
  };

  useEffect(() => {
    if (!userProfile?.uid) return;

    console.log("TOAST_LISTENER_ACTIVE", userProfile.uid);

    // 1. Profile Completion Reminder (In-App Only)
    const checkProfileReminder = async () => {
      if (userProfile.uid === 'guest') return;
      const social = userProfile.social;
      if (!social) return;

      const completion = calculateProfileCompletion(social);
      if (completion < 80) {
        const lastRem = social.notifications?.lastProfileReminderAt;
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const lastRemTime = lastRem?.toMillis ? lastRem.toMillis() : (lastRem ? new Date(lastRem).getTime() : 0);
        
        if (!lastRem || lastRemTime < oneDayAgo) {
          if (activeTabRef.current !== 'social-profile') {
            toast(<CustomToast 
              name="Profilini Güçlendir ✨"
              message="Profilini biraz daha tamamlarsan Keşfet'te çok daha fazla kişinin önüne çıkabilirsin!"
              avatar=""
              onNavigate={() => onNavigateRef.current('social-profile')}
              onDismiss={() => {}}
            />, { duration: 6000 });

            try {
              await updateDoc(doc(db, "users", userProfile.uid), {
                "social.notifications.lastProfileReminderAt": Timestamp.now()
              });
            } catch (err) {
              console.error("Failed to update profile reminder timestamp:", err);
            }
          }
        }
      }
    };
    
    const reminderTimer = setTimeout(checkProfileReminder, 5000);

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
          if (isNotificationProcessed(docId)) return;

          const data = change.doc.data();
          const createdAt = parseDate(data.createdAt);
          
          if (createdAt && createdAt > mountTime.current) {
            markNotificationProcessed(docId);
            
            // Skip if user is already looking at history
            if (activeTabRef.current === 'history') return;

            toast(<CustomToast 
                name="Kahve Falı"
                message="Kahve falın yorumlandı, hemen incele! ☕"
                avatar=""
                onNavigate={() => onNavigateRef.current('history')} 
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
            activeChatId: activeChatIdRef.current,
            createdAt: lastMessageAt,
            isOwnMessage: senderId === userProfile.uid,
            isActiveChat: activeChatIdRef.current && String(chatId).trim() === String(activeChatIdRef.current).trim(),
            alreadyProcessed: uniqueMessageKey ? isNotificationProcessed(uniqueMessageKey) : false,
            passesTimeCheck: lastMessageAt && lastMessageAt > mountTime.current,
            changeType: change.type,
            hasPendingWrites: change.doc.metadata.hasPendingWrites
          });
  
          const hasPendingWrites = change.doc.metadata.hasPendingWrites;
  
          if ((change.type === "added" || change.type === "modified") && !hasPendingWrites) {
            // Strict suppression: Current chat or sender is me
            const isActiveChat = activeChatIdRef.current && String(chatId).trim() === String(activeChatIdRef.current).trim();
            const isOwnMessage = senderId === userProfile.uid;
            const passesTimeCheck = lastMessageAt && lastMessageAt > mountTime.current;
  
            if (isActiveChat) console.log("BLOCK_ACTIVE_CHAT", chatId);
            if (isOwnMessage) console.log("BLOCK_OWN_MESSAGE", senderId);
            if (!passesTimeCheck) console.log("BLOCK_TIME_CHECK", { lastMessageAt, mountTime: mountTime.current });
            if (!messageId) console.log("BLOCK_NO_MESSAGE_ID");
  
            if (isActiveChat || isOwnMessage || !passesTimeCheck || !messageId) continue;
  
            if (isNotificationProcessed(uniqueMessageKey)) {
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
            markNotificationProcessed(uniqueMessageKey);

          // Using consistent ID per chat prevents spamming multiple toasts for same conversation
          toast(<CustomToast 
            name={senderName || 'Yeni Mesaj'}
            message={lastMessage || 'Yeni bir mesajın var.'}
            avatar={senderPhoto || ''}
            onNavigate={() => {
              onNavigateRef.current('messages');
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
      unsubReadings();
      unsubChats();
      clearTimeout(reminderTimer);
    };
  }, [userProfile?.uid, activeTab]); 

  // 4. Listen for System Notifications
  useEffect(() => {
    if (!userProfile?.uid) return;

    const notifQuery = query(
      collection(db, "notifications"),
      where("userId", "==", userProfile.uid),
      where("read", "==", false)
    );

    const unsubNotifs = onSnapshot(notifQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !change.doc.metadata.hasPendingWrites) {
          const docId = change.doc.id;
          if (isNotificationProcessed(docId)) return;

          const data = change.doc.data();
          const createdAt = parseDate(data.createdAt);
          
          if (createdAt && createdAt > mountTime.current) {
            markNotificationProcessed(docId);
            
            // Customize based on type
            let name = data.fromUserName || data.title || 'Lasya';
            let message = data.message || 'Yeni bir bildiriminiz var.';
            let avatar = data.fromUserPhoto || '';
            let targetTab: any = 'home';
            let subTab: string | null = null;
            let onNav = () => {
              onNavigateRef.current(targetTab);
              if (subTab) {
                const eventPrefix = targetTab === 'messages' ? 'social' : 'home';
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent(`switch-${eventPrefix}-tab`, { detail: { tab: subTab } }));
                }, 100);
              }
            };

            if (data.type === 'compatibility_ready' || data.type === 'system' || data.type === 'compatibility_started') {
                targetTab = 'history';
                if (data.type === 'compatibility_ready') {
                  const analysisId = data.metadata?.analysisId || data.compatibilityHistoryId;
                  if (analysisId) {
                    onNav = () => {
                      onNavigateRef.current('history');
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('open-compatibility-details', { detail: { id: analysisId } }));
                      }, 100);
                    };
                  }
                }
            } else if (data.type === 'like' || data.type === 'super_like') {
                targetTab = 'messages';
                subTab = 'likers';
            } else if (data.type === 'compatibility_peek') {
                targetTab = 'messages';
                subTab = 'peeks';
            } else if (data.type === 'message_request' || data.type === 'priority_message_request') {
                targetTab = 'messages';
                subTab = 'requests';
            } else if (data.type === 'request_accepted') {
                targetTab = 'messages';
                subTab = 'chats';
            } else if (data.type === 'discover_return' || data.type === 'daily_likes_reset') {
                targetTab = 'home';
                subTab = 'discover';
            } else if (data.type === 'profile_completed') {
                targetTab = 'social-profile';
            }

            if ('vibrate' in navigator) {
              if (data.type === 'super_like' || data.type === 'priority_message_request' || data.type === 'compatibility_ready') {
                try {
                  navigator.vibrate([10, 30, 10]);
                } catch(e){}
              }
            }

            toast(<CustomToast 
                name={name}
                message={message}
                avatar={avatar}
                type={data.type}
                onNavigate={onNav}
                onDismiss={() => {}}
            />, { id: `notif-${docId}` });
          }
        }
      });
    });

    return () => unsubNotifs();
  }, [userProfile?.uid]);

  // 5. Foreground Return Experience
  useEffect(() => {
    let backgroundTime: number | null = null;
    let unreadCountLocally = 0;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backgroundTime = Date.now();
        unreadCountLocally = 0; // reset
      } else if (document.visibilityState === 'visible') {
        if (backgroundTime) {
          const diffInMinutes = (Date.now() - backgroundTime) / (1000 * 60);
          if (diffInMinutes > 120) { // 2 hours
            // Soft welcome after long absence
            setTimeout(() => {
              toast(<CustomToast 
                name="Tekrar Hoş Geldin ✨"
                message="Sen yokken her şey yolundaydı. Yeni neler var keşfetmeye başla!"
                avatar=""
                type="system"
                onNavigate={() => {}}
                onDismiss={() => {}}
              />, { duration: 4000 });
            }, 1500);
          }
        }
        backgroundTime = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return null;
};
