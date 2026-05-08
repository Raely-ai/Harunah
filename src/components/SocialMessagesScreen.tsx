import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageCircle, 
  ChevronLeft, 
  Send,
  MoreVertical,
  Check,
  CheckCheck,
  UserPlus,
  Heart,
  X,
  Search,
  Smile,
  Info,
  SmilePlus,
  Image as ImageIcon,
  Video,
  Paperclip,
  Camera,
  Trash2,
  Edit2,
  Clock,
  User,
  AlertCircle,
  AlertTriangle,
  Phone
} from "lucide-react";
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import OptimizedImage from './OptimizedImage';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  getDoc,
  getDocs,
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType, storage } from "../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { UserProfile, InteractionRequest as InteractionRequestType, Chat, Message, normalizeUserProfile } from "../types";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toSafeDate, formatSafeDate } from "../lib/dateUtils";
import { toast } from "sonner";
import SocialProfilePopup from "./SocialProfilePopup";
import { socialService } from "../lib/socialService";
import { isSocialProfileReady } from "../lib/socialUtils";
import { cacheManager } from "../lib/cacheManager";
import { useBadges } from "../lib/BadgeContext";
import SocialDisabledView from "./SocialDisabledView";
import { BlueTick } from "./BlueTick";

import { reportService } from "../services/reportService";

// Global cache for messages to enable instant switching between chats
const chatMessagesCache = new Map<string, Message[]>();

export default function SocialMessagesScreen({ 
  currentUser, 
  onBack, 
  onNavigate,
  onChatOpenChange,
  setActiveChatId
}: { 
  currentUser: UserProfile, 
  onBack?: () => void, 
  onNavigate: (tab: any) => void,
  onChatOpenChange?: (isOpen: boolean) => void,
  setActiveChatId?: (id: string | null) => void
}) {
  const { unseenLikersCount } = useBadges();
  const [activeTab, setActiveTab] = useState<'chats' | 'requests' | 'likers'>('chats');
  const [chats, setChats] = useState<(Chat & { otherUser: UserProfile })[]>([]);
  const [requests, setRequests] = useState<InteractionRequestType[]>([]);
  const [likers, setLikers] = useState<{ id: string, user: UserProfile, createdAt: any }[]>([]);
  const [selectedChat, setSelectedChat] = useState<(Chat & { otherUser: UserProfile }) | null>(null);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);

  // Update lastSeenLikersAt when user switches to 'likers' tab
  useEffect(() => {
    if (activeTab === 'likers' && currentUser.uid) {
      socialService.updateLastSeenLikersAt(currentUser.uid);
    }
  }, [activeTab, currentUser.uid]);

  // Handle open-chat event from notifications
  useEffect(() => {
    const handleOpenChat = async (e: any) => {
      const { chatId, messageId } = e.detail;
      if (!chatId) return;

      if (messageId) {
        setPendingMessageId(messageId);
      }

      // First check if it's already in our local chats list
      const existingChat = chats.find(c => c.id === chatId);
      if (existingChat) {
        setSelectedChat(existingChat);
        setActiveTab('chats');
        return;
      }

      // If not in list, fetch it manually (could be a new match/request)
      try {
        const chatSnap = await getDoc(doc(db, "chats", chatId));
        if (chatSnap.exists()) {
          const chatData = chatSnap.data() as Chat;
          const participants = chatData.participants || [];
          const otherUserId = participants.find(id => id && id !== currentUser.uid);
          
          if (otherUserId) {
            const otherUserSnap = await getDoc(doc(db, "users", otherUserId));
            if (otherUserSnap.exists()) {
              const otherUser = normalizeUserProfile(otherUserSnap.data(), otherUserSnap.id);
              setSelectedChat({
                ...chatData,
                id: chatSnap.id,
                otherUser
              });
              setActiveTab('chats');
            }
          }
        }
      } catch (err) {
        console.error("Error opening chat from event:", err);
      }
    };

    window.addEventListener('openChatFromToast', handleOpenChat);
    window.addEventListener('open-chat', handleOpenChat);

    const handleSwitchTab = (e: any) => {
      const { tab } = e.detail;
      if (['chats', 'requests', 'likers'].includes(tab)) {
        setActiveTab(tab as any);
      }
    };
    window.addEventListener('switch-social-tab', handleSwitchTab);

    return () => {
      window.removeEventListener('openChatFromToast', handleOpenChat);
      window.removeEventListener('open-chat', handleOpenChat);
      window.removeEventListener('switch-social-tab', handleSwitchTab);
    };
  }, [chats, currentUser.uid]);

  useEffect(() => {
    setActiveChatId?.(selectedChat ? selectedChat.id : null);
  }, [selectedChat, setActiveChatId]);

  const [selectedLiker, setSelectedLiker] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const profilesCache = useRef<Record<string, UserProfile>>({});
  const deliveredProcessedChatsRef = useRef<Map<string, string>>(new Map());
  const selectedChatIdRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    selectedChatIdRef.current = selectedChat ? selectedChat.id : null;
  }, [selectedChat]);

  const CHAT_LIST_CACHE_KEY = "socialChatList";
  const REQUESTS_CACHE_KEY = "socialRequestsList";
  const LIKERS_CACHE_KEY = "socialLikersList";

  // Sync chat open state with parent and Presence update
  useEffect(() => {
    onChatOpenChange?.(!!selectedChat);
    if (selectedChat && currentUser.uid) {
      // Mark as seen immediately when chat is selected from list
      socialService.markAsSeen(selectedChat.id, currentUser.uid, selectedChat.otherUser.uid);
    }
  }, [selectedChat?.id, onChatOpenChange, currentUser.uid]); // Dep intentionally stripped down to just ID to prevent loops

  // Update selectedChat local state if the global chats array changes (e.g., typing updates)
  useEffect(() => {
    if (selectedChat) {
      const updated = chats.find(c => c.id === selectedChat.id);
      if (updated && (JSON.stringify(updated.typing) !== JSON.stringify(selectedChat.typing) || updated.lastMessage !== selectedChat.lastMessage)) {
        setSelectedChat(updated);
      }
    }
  }, [chats]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    
    // Initial update
    socialService.updateLastActiveAt(currentUser.uid);
    
    // Update every 60 seconds
    const intervalId = setInterval(() => {
      socialService.updateLastActiveAt(currentUser.uid);
    }, 60000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser?.uid]);

  // 1. Initial Cache Load (Instant Preview)
  useEffect(() => {
    const cachedChats = cacheManager.get<(Chat & { otherUser: UserProfile })[]>(CHAT_LIST_CACHE_KEY);
    const cachedRequests = cacheManager.get<InteractionRequestType[]>(REQUESTS_CACHE_KEY);
    const cachedLikers = cacheManager.get<{ id: string, user: UserProfile, createdAt: any }[]>(LIKERS_CACHE_KEY);

    if (cachedChats) setChats(cachedChats);
    if (cachedRequests) setRequests(cachedRequests);
    if (cachedLikers) setLikers(cachedLikers);
    
    // If we have cached data for the current tab, we can stop "hard" loading
    const hasDataForTab = (activeTab === 'chats' && cachedChats?.length) || 
                         (activeTab === 'requests' && cachedRequests?.length) || 
                         (activeTab === 'likers' && cachedLikers?.length);
    
    if (hasDataForTab) setIsLoading(false);
  }, [activeTab]);

  // 2. Real-time persistent listeners
  useEffect(() => {
    console.log("SOCIAL_MESSAGES_LISTENER_TRIGGER", {
      uid: currentUser.uid,
      isReady: isSocialProfileReady(currentUser),
      activeTab
    });

    if (!currentUser.uid || !isSocialProfileReady(currentUser)) {
      console.log("SOCIAL_MESSAGES_LISTENER_ABORT: User not ready or missing UID");
      setIsLoading(false); // Move out of loading if not ready to avoid spinner
      return;
    }

    let unsubChats: () => void = () => {};
    let unsubRequests: () => void = () => {};
    let unsubLikers: () => void = () => {};

    // 1. CHATS LISTENER
    const setupChatsListener = () => {
      try {
        console.log("SETTING_UP_CHATS_LISTENER", currentUser.uid);
        unsubChats = socialService.listenToMatches(currentUser.uid, async (matches) => {
          try {
            console.log("CHATS_SNAPSHOT_RECEIVED", { size: matches.length });
            
            // Filter out deleted chats
            const activeChatDocs = matches.filter(chat => !chat.deletedFor?.includes(currentUser.uid));
            
            if (activeChatDocs.length === 0) {
              setChats([]);
              setIsLoading(false);
              return;
            }

            // Fetch profiles for each chat. User request: Use direct getDoc instead of where("uid", "in")
            const updatedChatList = await Promise.all(activeChatDocs.map(async (chatData) => {
              const participants = chatData.participants || [];
              const otherUserId = participants.find((id: string) => id && id !== currentUser.uid);
              
              if (!otherUserId) return null;

              let otherUser: UserProfile | null = profilesCache.current[otherUserId];
              
              if (!otherUser) {
                try {
                  const userDoc = await getDoc(doc(db, "users", otherUserId));
                  if (userDoc.exists()) {
                    otherUser = normalizeUserProfile(userDoc.data(), userDoc.id);
                    profilesCache.current[otherUserId] = otherUser;
                  }
                } catch (err: any) {
                  if (err?.message?.includes('offline')) {
                    console.warn(`Profile fetch offline for ${otherUserId}, using fallback.`);
                  } else {
                    console.error(`Profile fetch error for ${otherUserId}:`, err);
                  }
                }
              }

              // User's request: Fallback profile if not found. Guarantee chat stays in list.
              if (!otherUser) {
                otherUser = {
                  uid: otherUserId,
                  displayName: "Kullanıcı",
                  nickname: "Kullanıcı",
                  email: "",
                  createdAt: new Date().toISOString(),
                  mainCoins: 0,
                  energy: 0,
                  superLikes: 0,
                  refreshCount: 0,
                  compatibilityCount: 0,
                  dailyAdWatchCount: 0,
                  lastAdReset: new Date().toISOString(),
                  social: {
                    enabled: true,
                    profileCompleted: true,
                    nickname: "Kullanıcı",
                    gender: 'erkek',
                    lookingFor: 'arkadaş',
                    bio: '',
                    photos: [],
                    interests: [],
                    visible: false,
                    banned: false,
                    isOnline: false,
                    settings: {
                      whoCanMessage: 'everyone',
                      whoCanAddFriend: 'everyone',
                      notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true }
                    }
                  }
                } as unknown as UserProfile;
              }

              return { ...chatData, otherUser } as Chat & { otherUser: UserProfile };
            }));

            // Filter out any chats where we couldn't even determine otherUserId
            const finalChatList = updatedChatList.filter((c): c is Chat & { otherUser: UserProfile } => c !== null);
            
            // Sort by last message time
            finalChatList.sort((a, b) => toSafeDate(b.lastMessageAt).getTime() - toSafeDate(a.lastMessageAt).getTime());
            
            // Mark incoming 'sent' messages as 'delivered' when app is open but chat is not
            finalChatList.forEach(chat => {
              if (chat.lastMessageSenderId && chat.lastMessageSenderId !== currentUser.uid) {
                const isSentStatus = chat.lastMessageStatus === 'sent';
                // Also check if unreadCount exists for the current user and is > 0, just in case
                const unreadCount = chat.unreadCount?.[currentUser.uid] || 0;
                
                if (isSentStatus || unreadCount > 0) {
                  const currentLastMsgAt = toSafeDate(chat.lastMessageAt).toISOString();
                  const lastProcessedMsgAt = deliveredProcessedChatsRef.current.get(chat.id);
                  
                  // Only mark if we haven't processed this specific message yet
                  if (currentLastMsgAt !== lastProcessedMsgAt) {
                    deliveredProcessedChatsRef.current.set(chat.id, currentLastMsgAt);
                    // Don't mark as delivered if the chat is currently open, let the message listener handle it (seen)
                    if (selectedChatIdRef.current !== chat.id) {
                      socialService.markAsDelivered(chat.id, currentUser.uid, chat.otherUser.uid);
                    }
                  }
                }
              }
            });

            setChats(finalChatList);
            cacheManager.set(CHAT_LIST_CACHE_KEY, finalChatList, 600, true);
          } catch (err) {
            console.error("CHAT_PROCESSING_ERROR:", err);
          } finally {
            // User's request: setIsLoading(false) must always run
            setIsLoading(false);
          }
        }, (error) => {
          console.error("Chats onSnapshot error:", error);
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Chats setup error:", err);
        setIsLoading(false);
      }
    };

    // 2. REQUESTS LISTENER (REAL-TIME)
    const setupRequestsListener = () => {
      try {
        console.log("SETTING_UP_REQUESTS_LISTENER", currentUser.uid);
        const q = query(
          collection(db, "interactionRequests"),
          where("toUserId", "==", currentUser.uid),
          where("status", "==", "pending"),
          limit(50)
        );

        unsubRequests = onSnapshot(q, async (snapshot) => {
          console.log("REQUESTS_SNAPSHOT_RECEIVED", { size: snapshot.size });
          const rawRequestList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InteractionRequestType));
          
          // Enqueue fetching user details
          const requestList = await Promise.all(rawRequestList.map(async (req) => {
            if (!req.senderSnapshot || !req.senderSnapshot.social) {
               try {
                  const uDoc = await getDoc(doc(db, "users", req.fromUserId));
                  if (uDoc.exists()) {
                     const uData = uDoc.data();
                     return {
                        ...req,
                        senderSnapshot: {
                           nickname: uData.social?.nickname || uData.nickname || 'Bilinmiyor',
                           photoURL: uData.social?.photos?.[0] || uData.photoURL,
                           social: uData.social
                        }
                     } as InteractionRequestType;
                  }
               } catch(e: any) {
                 if (e?.message?.includes('offline')) {
                   console.warn(`Sender profile fetch offline for ${req.fromUserId}`);
                 } else {
                   console.error("Error fetching sender profile", e);
                 }
               }
            }
            return req;
          }));

          requestList.sort((a, b) => {
             const aVerified = (a.senderSnapshot as any)?.social?.verified ? 1 : 0;
             const bVerified = (b.senderSnapshot as any)?.social?.verified ? 1 : 0;
             if (aVerified !== bVerified) return bVerified - aVerified;
             return toSafeDate(b.createdAt).getTime() - toSafeDate(a.createdAt).getTime();
          });
          
          setRequests(requestList);
          cacheManager.set(REQUESTS_CACHE_KEY, requestList, 600, true);
          setIsLoading(false);
        }, (err) => {
          console.error("Requests listener error callback:", err);
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Requests listener setup error:", err);
        setIsLoading(false);
      }
    };

    // 3. LIKERS LISTENER (REAL-TIME)
    const setupLikersListener = () => {
      try {
        console.log("SETTING_UP_LIKERS_LISTENER", currentUser.uid);
        const q = query(
          collection(db, "swipes"),
          where("toUserId", "==", currentUser.uid),
          where("type", "in", ["like", "super_like"]),
          limit(40)
        );

        unsubLikers = onSnapshot(q, async (snapshot) => {
          console.log("LIKERS_SNAPSHOT_RECEIVED", { size: snapshot.size });
          const likerList = await Promise.all(snapshot.docs.map(async (swipeDoc) => {
            const swipeData = swipeDoc.data();
            let sender = profilesCache.current[swipeData.fromUserId];
            
            if (!sender) {
              try {
                const senderSnap = await getDoc(doc(db, "users", swipeData.fromUserId));
                if (senderSnap.exists()) {
                  sender = normalizeUserProfile(senderSnap.data(), senderSnap.id);
                  profilesCache.current[swipeData.fromUserId] = sender;
                }
              } catch (e: any) {
                if (e?.message?.includes('offline')) {
                  console.warn(`Liker profile fetch offline for ${swipeData.fromUserId}`);
                } else {
                  console.error("Error fetching liker profile:", e);
                }
              }
            }

            if (!sender) return null;

            return {
              id: swipeDoc.id,
              user: sender,
              createdAt: swipeData.createdAt
            };
          }));

          const validLikers = likerList.filter((l): l is NonNullable<typeof l> => l !== null);
          validLikers.sort((a, b) => toSafeDate(b.createdAt).getTime() - toSafeDate(a.createdAt).getTime());
          setLikers(validLikers);
          cacheManager.set(LIKERS_CACHE_KEY, validLikers, 600, true);
          setIsLoading(false);
        }, (err) => {
          console.error("Likers listener error callback:", err);
          setIsLoading(false);
        });
      } catch (err) {
        console.error("Likers listener setup error:", err);
        setIsLoading(false);
      }
    };

    setupChatsListener();
    setupRequestsListener();
    setupLikersListener();

    // Safety timeout to ensure loading never gets stuck
    const loadingTimeout = setTimeout(() => {
      console.log("SOCIAL_MESSAGES_LOADING_TIMEOUT_REACHED");
      setIsLoading(false);
    }, 8000);

    return () => {
      clearTimeout(loadingTimeout);
      unsubChats();
      unsubRequests();
      unsubLikers();
    };
  }, [currentUser.uid, isSocialProfileReady(currentUser)]);


  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    return chats.filter(chat => {
      const name = (chat.otherUser.social?.nickname || chat.otherUser.nickname || "").toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    });
  }, [chats, searchQuery]);

  const handleAcceptRequest = async (request: InteractionRequestType) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    // Optimistic UI Update: Remove from list immediately
    setRequests(prev => prev.filter(r => r.id !== request.id));
    
    try {
      const chatId = await socialService.acceptRequest(request);
      toast.success("İstek kabul edildi!");
      
      // Clear cache to force refresh
      cacheManager.clear(CHAT_LIST_CACHE_KEY);
      cacheManager.clear(REQUESTS_CACHE_KEY);
      
      setActiveTab('chats');
      
      const chatSnap = await getDoc(doc(db, "chats", chatId));
      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as Chat;
        const participants = chatData.participants || [];
        const others = participants.filter(id => id && id !== currentUser.uid);
        const otherUserId = others.length > 0 ? others[0] : null;
        
        if (otherUserId) {
          const otherUserSnap = await getDoc(doc(db, "users", otherUserId));
          if (otherUserSnap.exists()) {
            setSelectedChat({
              ...chatData,
              id: chatSnap.id,
              otherUser: normalizeUserProfile(otherUserSnap.data(), otherUserSnap.id)
            });
          }
        }
      }
    } catch (error: any) {
      // Revert if error occurs ? (Actually onSnapshot will handle it if it's still in DB)
      console.error("Error accepting request:", error);
      const errorMessage = error?.message || "İstek kabul edilirken bir hata oluştu.";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    // Optimistic UI Update
    setRequests(prev => prev.filter(r => r.id !== requestId));

    try {
      await socialService.rejectRequest(requestId);
      toast.info("İstek reddedildi.");
      cacheManager.clear(REQUESTS_CACHE_KEY);
    } catch (error) {
      console.error("Error rejecting request:", error);
    } finally {
      setIsProcessing(false);
    }
  };


  const handleStartChatFromLiker = async (liker: UserProfile) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const chatId = await socialService.createChat(currentUser.uid, liker.uid);
      setSelectedLiker(null);
      
      // Clear cache
      cacheManager.clear(CHAT_LIST_CACHE_KEY);
      
      setActiveTab('chats');
      
      const chatSnap = await getDoc(doc(db, "chats", chatId));
      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as Chat;
        const participants = chatData.participants || [];
        const others = participants.filter(id => id && id !== currentUser.uid);
        const otherUserId = others.length > 0 ? others[0] : null;

        if (otherUserId) {
          const otherUserSnap = await getDoc(doc(db, "users", otherUserId));
          if (otherUserSnap.exists()) {
            setSelectedChat({
              ...chatData,
              id: chatSnap.id,
              otherUser: normalizeUserProfile(otherUserSnap.data(), otherUserSnap.id)
            });
          }
        }
      }
    } catch (error: any) {
      console.error("Error starting chat:", error);
      const errorMessage = error?.message || "Sohbet başlatılırken bir hata oluştu.";
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Mark all incoming messages as delivered for all chats
  // REMOVED: Global onSnapshot for all messages is too expensive.
  // Delivery status is now handled per-chat when the chat list or chat detail is active.



  const isSocialEnabled = isSocialProfileReady(currentUser);

  // Loading safety to prevent flicker
  if (isLoading && !isSocialEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#F6F4F8] p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-black/5 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-500 text-sm font-medium">Sohbetler hazırlanıyor...</p>
      </div>
    );
  }

  if (!isSocialEnabled) {
    return (
      <div className="flex flex-col h-full bg-[#F6F4F8] text-body relative overflow-hidden">
        {/* Header */}
        <header className="header-gradient backdrop-blur-3xl border-b border-black/5 px-4 py-5 flex flex-col gap-1 z-10">
          <h1 className="text-2xl font-serif font-bold text-heading tracking-tight">Mesajlar</h1>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Sohbetler, istekler ve beğeniler</p>
        </header>

        {/* Blurred Mock Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar blur-[25px] opacity-40 pointer-events-none">
          {/* Tabs Mock */}
          <div className="px-4 py-3 bg-black/5 border-b border-black/5">
            <div className="flex bg-black/[0.03] p-1 rounded-2xl border border-black/5">
              <div className="flex-1 h-10 bg-white/50 rounded-xl" />
              <div className="flex-1 h-10 rounded-xl" />
              <div className="flex-1 h-10 rounded-xl" />
            </div>
          </div>

          {/* Search Mock */}
          <div className="px-4 py-3 border-b border-black/5">
            <div className="h-10 bg-black/[0.03] rounded-xl" />
          </div>

          {/* Chat List Mock */}
          <div className="divide-y divide-black/5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="p-5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-black/10 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 w-24 bg-black/10 rounded" />
                    <div className="h-3 w-10 bg-black/5 rounded" />
                  </div>
                  <div className="h-3 w-full bg-black/5 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overlay */}
        <SocialDisabledView 
          onNavigate={onNavigate} 
          title="Sohbet Başlatmak İçin Hazır Mısın?" 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-slate-50 text-body relative overflow-hidden">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-black/5 pt-[env(safe-area-inset-top,1rem)]">
        <header className="px-4 py-5 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mesajlar</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">İletişim & Enerji Merkezi</p>
          </div>
        </header>

        {/* Premium Segmented Control (Tabs) */}
        <div className="px-4 pb-3">
          <div className="relative flex bg-slate-100/70 p-1 rounded-2xl">
            {/* Sliding Pill Indicator */}
            <motion.div
              layoutId="messageTabHighlight"
              className="absolute inset-y-1 rounded-xl bg-white shadow-sm z-0"
              initial={false}
              animate={{
                left: activeTab === 'chats' ? '4px' : activeTab === 'requests' ? 'calc(33.33% + 2px)' : 'calc(66.66% + 1px)',
                width: 'calc(33.33% - 4px)',
              }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.5 }}
            />

            <button 
              onClick={() => setActiveTab('chats')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
                activeTab === 'chats' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Sohbetler</span>
            </button>

            <button 
              onClick={() => setActiveTab('requests')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
                activeTab === 'requests' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>İstekler</span>
              {(requests.length > 0) && (
                <div className="absolute top-1.5 right-2 w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
                  <span className="relative block w-2 h-2 rounded-full bg-rose-500 border border-white" />
                </div>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('likers')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all duration-300 ${
                activeTab === 'likers' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Beğeniler</span>
              {(unseenLikersCount > 0) && (
                <div className="absolute top-1.5 right-2 w-2 h-2">
                  <span className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-75" />
                  <span className="relative block w-2 h-2 rounded-full bg-rose-500 border border-white" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar (Only for Chats) */}
      {activeTab === 'chats' && chats.length > 0 && (
        <div className="px-4 pb-2">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sohbetlerde ara..."
              className="w-full bg-slate-100/70 border-none rounded-2xl py-3 pl-11 pr-4 text-[13px] text-slate-900 placeholder:text-slate-500 focus:outline-none focus:bg-slate-200/50 transition-all"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'chats' && (
            <motion.div
              key="chats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-2 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 px-10 text-center space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-full" />
                    <div className="relative w-24 h-24 rounded-[2.5rem] bg-white flex items-center justify-center border border-black/5 shadow-xl">
                      <MessageCircle className="w-10 h-10 text-indigo-500/20" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                      {searchQuery ? "Sonuç Bulunamadı" : "Henüz sohbet yok"}
                    </h3>
                    <p className="text-[13px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                      {searchQuery ? "Aramanla eşleşen bir sohbet bulamadık." : "Eşleştiğin kişilerle olan tüm konuşmaların burada listelenir."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {filteredChats.map(chat => (
                    <ChatListItem 
                      key={chat.id} 
                      chat={chat} 
                      onClick={() => setSelectedChat(chat)} 
                      currentUser={currentUser}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div 
              key="requests"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pt-2 space-y-4"
            >
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-2 border-slate-100 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/5 blur-3xl rounded-full" />
                    <div className="relative w-24 h-24 rounded-[2.5rem] bg-white flex items-center justify-center border border-black/5 shadow-xl text-amber-500/20">
                      <UserPlus className="w-10 h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">İstek Kutun Boş</h3>
                    <p className="text-[13px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">Gelen mesaj ve süper like istekleri burada görünür.</p>
                  </div>
                </div>
              ) : (
                requests.map(request => {
                  const isVerified = (request.senderSnapshot as any)?.social?.verified;
                  return (
                  <div key={request.id} className={`bg-white rounded-[2.5rem] p-6 border ${isVerified ? 'border-sky-500/30 ring-4 ring-sky-500/5 shadow-sky-500/10' : 'border-black/5'} shadow-sm flex flex-col gap-6 relative overflow-hidden`}>
                    {isVerified && <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent pointer-events-none" />}
                    <div className="flex gap-5 relative z-10">
                      <div className={`w-16 h-16 rounded-[1.25rem] overflow-hidden bg-slate-100 flex-shrink-0 border-2 ${isVerified ? 'border-sky-500/30 p-0.5' : 'border-black/5'}`}>
                        <div className="w-full h-full rounded-2xl overflow-hidden relative">
                          {isVerified && <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/20 to-transparent pointer-events-none" />}
                          <OptimizedImage 
                            src={request?.senderSnapshot?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request?.fromUserId || 'default'}`} 
                            alt="User"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="font-black text-slate-900 truncate uppercase text-xs tracking-tight">{request?.senderSnapshot?.nickname || 'Bilinmiyor'}</h4>
                            {isVerified && <BlueTick size={12} />}
                          </div>
                          <span className={`${isVerified ? 'bg-sky-50 text-sky-600 border-sky-100' : 'bg-slate-100 text-slate-500 border-black/5'} text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border whitespace-nowrap ml-2`}>
                            {request.type === 'message_request' ? 'Mesaj İsteği' : 'Süper Like'}
                          </span>
                        </div>
                        <p className={`text-[12px] font-medium italic truncate ${isVerified ? 'text-sky-600/60' : 'text-slate-400'}`}>"Sana bir mesaj isteği gönderdi."</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-6 border-t border-slate-100 relative z-10">
                      <button 
                        onClick={() => handleRejectRequest(request.id)} 
                        disabled={isProcessing}
                        className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 transition-all disabled:opacity-50"
                      >
                        Reddet
                      </button>
                      <button 
                        onClick={() => handleAcceptRequest(request)} 
                        disabled={isProcessing}
                        className="flex-1 py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-900/10 disabled:opacity-50"
                      >
                        Kabul Et
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </motion.div>
          )}

          {activeTab === 'likers' && (
            <motion.div 
              key="likers"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pt-2 pb-10"
            >
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 border-2 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                </div>
              ) : likers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center border border-black/[0.04] text-slate-300">
                    <Heart className="w-6 h-6 stroke-[2]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-[15px] font-semibold text-slate-900">Henüz seni beğenen yok</h3>
                    <p className="text-[13px] text-slate-500 max-w-[240px] mx-auto">Seni beğenenler burada görünür.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {likers.map(liker => (
                    <div 
                      key={liker.id} 
                      className="w-full px-6 py-4 flex items-center gap-4 border-b border-black/[0.04] last:border-none active:bg-black/[0.04] transition-colors duration-150"
                    >
                      <div 
                        className="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-black/[0.04] cursor-pointer"
                        onClick={() => setSelectedLiker(liker.user)}
                      >
                        <img 
                          src={liker?.user?.social?.photos?.[0] || liker?.user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${liker?.user?.uid || 'default'}`} 
                          alt="User"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 cursor-pointer min-w-0" onClick={() => setSelectedLiker(liker.user)}>
                        <h4 className="font-semibold text-slate-900 truncate text-[15px]">
                          {liker?.user?.social?.nickname || liker?.user?.nickname || 'Gizemli'}, {liker?.user?.age || ''}
                        </h4>
                        <p className="text-xs text-rose-500 font-medium tracking-wide mt-0.5">Seni beğendi!</p>
                      </div>
                      <button 
                        onClick={() => handleStartChatFromLiker(liker.user)} 
                        disabled={isProcessing}
                        className="bg-slate-900 text-white rounded-full px-5 py-2.5 text-xs font-semibold tracking-wide active:scale-95 transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        Sohbet
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Detail Modal */}
      <AnimatePresence>
        {selectedChat && (
          <ChatDetail 
            chat={selectedChat} 
            currentUser={currentUser} 
            onClose={() => {
              setSelectedChat(null);
              setPendingMessageId(null);
            }} 
            onNavigate={onNavigate}
            initialMessageId={pendingMessageId}
          />
        )}
      </AnimatePresence>

      {/* Profile Popup for Likers */}
      <AnimatePresence>
        {selectedLiker && (
          <SocialProfilePopup 
            user={selectedLiker}
            currentUser={currentUser}
            onClose={() => setSelectedLiker(null)}
            onCompatibilityCheck={() => {}} 
            onSendMessage={() => {}} 
            onNavigate={onNavigate}
            onStartChat={handleStartChatFromLiker}
            context="likers"
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function ChatListItem({ chat, onClick, currentUser }: { chat: Chat & { otherUser: UserProfile }, onClick: () => void, currentUser: UserProfile }) {
  const otherUser = chat.otherUser;
  if (!otherUser) return null;

  const unreadCount = chat.unreadCount?.[currentUser.uid] || 0;
  const isMe = chat.lastMessageSenderId === currentUser.uid;
  const status = chat.lastMessageStatus || 'sent';

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full pl-6 pr-5 flex items-center gap-4 transition-colors duration-150 text-left group hover:bg-black/[0.02] active:bg-black/[0.04] relative ${
        unreadCount > 0 ? '' : ''
      }`}
    >
      <div className="relative flex-shrink-0 w-12 h-12 my-3.5">
        <div className={`w-12 h-12 rounded-full overflow-hidden bg-slate-100 border transition-all duration-300 ${
          unreadCount > 0 ? 'border-indigo-300 shadow-lg shadow-indigo-500/10' : 'border-slate-200'
        }`}>
          <OptimizedImage 
            src={otherUser?.social?.photos?.[0] || otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || 'chat'}`} 
            alt={otherUser?.social?.nickname || otherUser?.nickname || 'Sohbet'}
            className="w-full h-full object-cover block"
          />
        </div>
        {otherUser.social?.isOnline && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 ring-2 ring-white rounded-full shadow-[0_0_8px_rgba(16,185,129,0.55)]" />
        )}
      </div>
      
      <div className="flex-1 min-w-0 py-3.5 border-b border-black/[0.04] group-last:border-none">
        <div className="flex justify-between items-center mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className={`font-medium tracking-tight truncate ${unreadCount > 0 ? 'text-slate-900 font-semibold' : 'text-slate-900'}`}>
              {otherUser.social?.nickname || otherUser.nickname}
            </h3>
            {otherUser.social?.verified && <BlueTick size={8} />}
          </div>
          {chat.lastMessageAt && (
            <span className={`text-[11px] ml-2 whitespace-nowrap ${unreadCount > 0 ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`}>
              {formatSafeDate(chat.lastMessageAt, "HH:mm")}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isMe && (
              <div className="flex-shrink-0">
                {status === 'seen' ? (
                  <CheckCheck className="w-3 h-3 text-indigo-500" />
                ) : status === 'delivered' ? (
                  <CheckCheck className="w-3 h-3 text-slate-300" />
                ) : (
                  <Check className="w-3 h-3 text-slate-200" />
                )}
              </div>
            )}
            <p className={`text-[13px] truncate transition-all leading-tight ${unreadCount > 0 ? 'text-slate-600 font-medium' : 'text-slate-400'}`}>
              {chat.typing?.[otherUser.uid] ? (
                <span className="text-indigo-600 italic animate-pulse font-medium">Yazıyor...</span>
              ) : (
                chat.lastMessage || (chat.lastMessageImageUrl ? "📷 Fotoğraf" : "")
              )}
            </p>
          </div>
          {unreadCount > 0 && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex-shrink-0 min-w-[20px] h-[20px] px-1.5 bg-rose-500 rounded-full flex items-center justify-center shadow-sm"
            >
              <span className="text-[11px] font-semibold text-white leading-none">{unreadCount}</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function ChatDetail({ 
  chat: initialChat, 
  currentUser, 
  onClose, 
  onNavigate, 
  initialMessageId 
}: { 
  chat: Chat & { otherUser: UserProfile }, 
  currentUser: UserProfile, 
  onClose: () => void, 
  onNavigate: (tab: any) => void,
  initialMessageId?: string | null
}) {
  const [chat, setChat] = useState(initialChat);
  const [messages, setMessages] = useState<Message[]>(() => chatMessagesCache.get(initialChat.id) || []);
  const [displayCount, setDisplayCount] = useState(20);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<UserProfile>(initialChat.otherUser);
  const [isSending, setIsSending] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [isPrivacyProcessing, setIsPrivacyProcessing] = useState(false);
  const [isUserScrollingUp, setIsUserScrollingUp] = useState(false);
  const [isInitialScrolled, setIsInitialScrolled] = useState(false);

  const prevScrollHeightRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isBlockedByMe = useMemo(() => {
    if (!currentUser.social?.blockedUserIds) return false;
    return currentUser.social.blockedUserIds.includes(otherUser.uid);
  }, [currentUser.social?.blockedUserIds, otherUser.uid]);

  const isMutedByMe = useMemo(() => {
    if (!currentUser.social?.mutedUserIds) return false;
    return currentUser.social.mutedUserIds.includes(otherUser.uid);
  }, [currentUser.social?.mutedUserIds, otherUser.uid]);

  useEffect(() => {
    if (currentUser.uid && otherUser.uid) {
      socialService.isBlocked(currentUser.uid, otherUser.uid).then(setIsBlockedByOther);
    }
  }, [currentUser.uid, otherUser.uid]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastProcessedSeenId = useRef<string | null>(null);
  const lastProcessedDeliveredId = useRef<string | null>(null);
  const lastMessageTimeRef = useRef<number>(0);
  const lastTypingSentAtRef = useRef<number>(0);

  // Sync chat doc updates (typing status, unread counts, etc.) from props
  useEffect(() => {
    setChat(initialChat);
  }, [initialChat]);

  // Reset pagination on chat change
  useEffect(() => {
    setDisplayCount(20);
    setIsUserScrollingUp(false);
    setIsInitialScrolled(false);
    prevScrollHeightRef.current = 0;
  }, [chat.id]);

  const visibleMessages = useMemo(() => {
    return messages.slice(-displayCount);
  }, [messages, displayCount]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Check if scrolled near top
    if (scrollTop < 80 && displayCount < messages.length) {
      prevScrollHeightRef.current = scrollHeight;
      setDisplayCount(prev => Math.min(prev + 20, messages.length));
    }

    // Check if scrolling up
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsUserScrollingUp(!isAtBottom);
  };

  useEffect(() => {
    if (scrollContainerRef.current && prevScrollHeightRef.current > 0) {
      const newScrollHeight = scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop += (newScrollHeight - prevScrollHeightRef.current);
      prevScrollHeightRef.current = 0;
    }
  }, [visibleMessages]);

  // Handle typing status
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Throttle typing true signal to once every 3 seconds
    const now = Date.now();
    if (!isTyping || now - lastTypingSentAtRef.current > 3000) {
      if (!isTyping) setIsTyping(true);
      lastTypingSentAtRef.current = now;
      socialService.setTypingStatus(chat.id, currentUser.uid, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      lastTypingSentAtRef.current = 0; // Reset so next type sends immediate true
      socialService.setTypingStatus(chat.id, currentUser.uid, false);
    }, 2000);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Lütfen sadece fotoğraf seçin.");
      return;
    }

    // Size limits - 20MB
    if (file.size > 20 * 1024 * 1024) { 
      toast.error("Dosya boyutu 20MB'dan küçük olmalıdır.");
      return;
    }

    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch other user updates (online status) once on mount
  useEffect(() => {
    const fetchOtherUser = async () => {
      try {
        const snap = await getDoc(doc(db, "users", chat.otherUser.uid));
        if (snap.exists()) {
          setOtherUser(normalizeUserProfile(snap.data(), snap.id));
        }
      } catch (error) {
        console.error("Error fetching other user profile:", error);
      }
    };
    fetchOtherUser();
  }, [chat.otherUser.uid]);

  // Listen for messages and handle status updates with Cache-First approach
  useEffect(() => {
    const CACHE_KEY = `chatMessages_${chat.id}`;
    const cachedMessages = cacheManager.get<Message[]>(CACHE_KEY);
    if (cachedMessages) setMessages(cachedMessages);

    const unsubscribe = socialService.listenToMessages(chat.id, (fetchedMsgs) => {
      const msgs = fetchedMsgs as Message[];
      
      // Client-side sort by createdAt to avoid index requirement
      setMessages(prev => {
        const msgMap = new Map(prev.map(m => [m.id, m]));
        msgs.forEach(m => msgMap.set(m.id, m));
        const merged = Array.from(msgMap.values());
        merged.sort((a, b) => {
          const timeA = a.createdAt?.toMillis?.() || a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.toMillis?.() || b.createdAt?.seconds || 0;
          return timeA - timeB;
        });

        // Update local memory cache (LRU approach with Map order)
        chatMessagesCache.delete(chat.id);
        chatMessagesCache.set(chat.id, merged);
        if (chatMessagesCache.size > 20) {
          const earliestKey = chatMessagesCache.keys().next().value;
          if (earliestKey) chatMessagesCache.delete(earliestKey);
        }

        cacheManager.set(CACHE_KEY, merged, 1800, true); // Cache for 30 mins persistently
        return merged;
      });
      
      // Mark as seen when chat is open and there are unread messages for current user
      const unseenMessages = msgs.filter(m => m.senderId !== currentUser.uid && m.status !== 'seen' && m.type !== 'system');
      if (unseenMessages.length > 0) {
        const latestUnseenId = unseenMessages[unseenMessages.length - 1].id;
        if (lastProcessedSeenId.current !== latestUnseenId) {
          lastProcessedSeenId.current = latestUnseenId;
          socialService.markAsSeen(chat.id, currentUser.uid, otherUser.uid);
        }
      }
      
      // Mark as delivered if there are messages with status 'sent' that are not from me
      const undeliveredMessages = msgs.filter(m => m.senderId !== currentUser.uid && m.status === 'sent' && m.type !== 'system');
      if (undeliveredMessages.length > 0) {
        const latestUndeliveredId = undeliveredMessages[undeliveredMessages.length - 1].id;
        if (lastProcessedDeliveredId.current !== latestUndeliveredId) {
          lastProcessedDeliveredId.current = latestUndeliveredId;
          socialService.markAsDelivered(chat.id, currentUser.uid, otherUser.uid);
        }
      }
    });

    return () => unsubscribe();
  }, [chat.id, currentUser.uid, otherUser.uid]);

  useEffect(() => {
    if (visibleMessages.length > 0 && !isUserScrollingUp) {
      const behavior = isInitialScrolled ? "smooth" : "auto";
      if (initialMessageId) {
        const element = document.getElementById(`msg-${initialMessageId}`);
        if (element) {
          element.scrollIntoView({ behavior, block: "center" });
          if (!isInitialScrolled) {
            requestAnimationFrame(() => setIsInitialScrolled(true));
          }
          return;
        }
      }
      messagesEndRef.current?.scrollIntoView({ behavior });
      if (!isInitialScrolled) {
        requestAnimationFrame(() => setIsInitialScrolled(true));
      }
    }
  }, [visibleMessages, initialMessageId, isUserScrollingUp, isInitialScrolled]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || isSending) return;

    // Rate Limiting
    const now = Date.now();
    if (now - lastMessageTimeRef.current < 1000) {
      toast.error("Lütfen mesaj göndermeden önce biraz bekleyin.");
      return;
    }
    lastMessageTimeRef.current = now;

    setIsSending(true);
    const messageText = newMessage.trim();
    const currentMediaFile = mediaFile;
    
    setNewMessage("");
    setMediaFile(null);
    setMediaPreview(null);
    setIsTyping(false);
    socialService.setTypingStatus(chat.id, currentUser.uid, false);

    try {
      if (editingMessage) {
        await socialService.editMessage(editingMessage.id, messageText);
        setEditingMessage(null);
      } else if (currentMediaFile) {
        const type = currentMediaFile.type.startsWith('image/') ? 'image' : currentMediaFile.type.startsWith('video/') ? 'video' : 'file';
        await socialService.sendMedia(chat.id, currentUser.uid, otherUser.uid, currentMediaFile, type);
      } else {
        await socialService.sendMessage(chat.id, currentUser.uid, otherUser.uid, { text: messageText });
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Mesaj gönderilemedi.";
      toast.error(errorMessage);
      console.error(error);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleDeleteMessage = async (msg: Message, forEveryone: boolean) => {
    try {
      await socialService.deleteMessage(msg.id, chat.id, forEveryone);
      toast.success(forEveryone ? "Mesaj herkesten silindi" : "Mesaj silindi");
      setActiveMessageId(null);
    } catch (error) {
      toast.error("Mesaj silinemedi.");
    }
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessage(msg);
    setNewMessage(msg.text || "");
    setActiveMessageId(null);
    inputRef.current?.focus();
  };

  const handleDeleteChat = async () => {
    try {
      await socialService.deleteChat(chat.id, currentUser.uid);
      toast.success("Konuşma silindi.");
      onClose();
    } catch (error) {
      toast.error("Konuşma silinirken bir hata oluştu.");
    }
  };

  const handleReportUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason) {
      toast.error("Lütfen bir sebep seçin.");
      return;
    }
    setIsReporting(true);
    try {
      await reportService.reportUser({
        reportedUserId: otherUser.uid,
        source: 'messages',
        reason: reportReason,
        description: reportDescription,
        metadata: { chatId: chat.id }
      });
      setShowReportModal(false);
      setReportReason("");
      setReportDescription("");
    } catch (error) {
      toast.error("Şikayet gönderilirken bir hata oluştu.");
    } finally {
      setIsReporting(false);
    }
  };

  const handleBlockToggle = async () => {
    if (isPrivacyProcessing) return;
    
    setIsPrivacyProcessing(true);
    try {
      if (isBlockedByMe) {
        await socialService.unblockUser(otherUser.uid);
        toast.success("Engelleme kaldırıldı.");
      } else {
        await socialService.blockUser(otherUser.uid);
        toast.success("Kullanıcı engellendi.");
      }
      setShowActionMenu(false);
    } catch (error) {
      toast.error("İşlem başarısız oldu.");
    } finally {
      setIsPrivacyProcessing(false);
    }
  };

  const handleMuteToggle = async () => {
    if (isPrivacyProcessing) return;
    
    setIsPrivacyProcessing(true);
    try {
      if (isMutedByMe) {
        await socialService.unmuteUser(otherUser.uid);
        toast.success("Sessizden çıkarıldı.");
      } else {
        await socialService.muteUser(otherUser.uid);
        toast.success("Sohbet sessize alındı.");
      }
      setShowActionMenu(false);
    } catch (error) {
      toast.error("İşlem başarısız oldu.");
    } finally {
      setIsPrivacyProcessing(false);
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    // Keep focus on input
    inputRef.current?.focus();
  };

  const getPresenceText = () => {
    const lastActiveAt = otherUser?.social?.lastActiveAt;
    
    if (lastActiveAt) {
      const activeDate = toSafeDate(lastActiveAt);
      const diffInMinutes = (Date.now() - activeDate.getTime()) / (1000 * 60);

      if (diffInMinutes < 3) return "AKTİF";
      if (diffInMinutes < 60) return `son görülme ${Math.floor(diffInMinutes)} dk önce`;
      if (diffInMinutes < 24 * 60) return `son görülme ${Math.floor(diffInMinutes / 60)} saat önce`;
      return "son görülme yakın zamanda";
    }

    if (otherUser.social?.isOnline) return "AKTİF";
    if (otherUser.social?.lastSeen) {
      return `son görülme: ${formatDistanceToNow(toSafeDate(otherUser.social.lastSeen), { addSuffix: true, locale: tr })}`;
    }
    return "son görülme yakın zamanda";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.14, ease: "easeOut" }}
      className="fixed inset-0 z-[100] bg-white flex flex-col h-[100svh] overflow-hidden"
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 flex items-center justify-between shrink-0 z-30 sticky top-0 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2">
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/5 text-[#1A1A2E] transition-all active:scale-90"
          >
            <ChevronLeft className="w-7 h-7" strokeWidth={1.5} />
          </button>
          
          <div 
            className="flex items-center gap-3 cursor-pointer group py-1"
            onClick={() => setShowProfile(true)}
          >
            <div className="relative">
              <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-200 ring-2 ring-white shadow-sm transition-transform group-hover:scale-105">
                <OptimizedImage 
                  src={otherUser?.social?.photos?.[0] || otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || 'chat'}`} 
                  alt={otherUser?.social?.nickname || otherUser?.nickname || 'Sohbet'}
                  className="w-full h-full object-cover"
                />
              </div>
              {getPresenceText() === "AKTİF" && (
                <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h2 className="font-semibold text-lg text-[#1A1A2E] leading-tight truncate tracking-tight">
                  {otherUser?.social?.nickname || otherUser?.nickname || 'Gizemli'}
                </h2>
                {otherUser?.social?.verified && <BlueTick size={10} />}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {getPresenceText() === "AKTİF" && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
                <div className="text-[11px] font-medium text-[#1A1A2E]/50 tracking-wide uppercase">
                  {otherUser?.uid && chat?.typing?.[otherUser.uid] ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-indigo-600 font-bold">Yazıyor</span>
                      <div className="flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                      </div>
                    </div>
                  ) : getPresenceText()}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 relative">
          <button 
            onClick={() => toast.info("Bu özellik yakında aktif olacak", { position: 'top-center' })}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-90 transition-all duration-200 ease-out"
          >
            <Phone className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => toast.info("Bu özellik yakında aktif olacak", { position: 'top-center' })}
            className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-90 transition-all duration-200 ease-out"
          >
            <Video className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setShowActionMenu(!showActionMenu)}
            className="p-2.5 rounded-full hover:bg-black/5 text-[#1A1A2E]/40 transition-all active:scale-90"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {showActionMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setShowActionMenu(false)}
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-white rounded-3xl shadow-2xl border border-black/5 overflow-hidden z-50 py-2"
                >
                  <button 
                    onClick={() => {
                      setShowActionMenu(false);
                      setShowProfile(true);
                    }}
                    className="w-full px-5 py-3 text-left text-sm font-semibold text-heading hover:bg-black/5 transition-colors flex items-center gap-3"
                  >
                    <User className="w-4 h-4 text-muted" />
                    Profili Gör
                  </button>
                  <button 
                    onClick={() => {
                      setShowActionMenu(false);
                      handleMuteToggle();
                    }}
                    className="w-full px-5 py-3 text-left text-sm font-semibold text-heading hover:bg-black/5 transition-colors flex items-center gap-3"
                  >
                    <Clock className={`w-4 h-4 ${isMutedByMe ? 'text-amber-500' : 'text-muted'}`} />
                    {isMutedByMe ? 'Sessizden Çıkar' : 'Sohbeti Sustur'}
                  </button>
                  <div className="h-px bg-black/5 my-1 mx-4" />
                  <button 
                    onClick={() => {
                      setShowActionMenu(false);
                      handleDeleteChat();
                    }}
                    className="w-full px-5 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <Trash2 className="w-4 h-4" />
                    Sohbeti Sil
                  </button>
                  <button 
                    onClick={() => {
                      setShowActionMenu(false);
                      handleBlockToggle();
                    }}
                    className="w-full px-5 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <AlertCircle className="w-4 h-4" />
                    {isBlockedByMe ? 'Engeli Kaldır' : 'Engelle'}
                  </button>
                  <button 
                    onClick={() => {
                      setShowActionMenu(false);
                      setShowReportModal(true);
                    }}
                    className="w-full px-5 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Şikayet Et
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto ${isInitialScrolled ? 'scroll-smooth' : ''} px-4 py-8 space-y-1.5 no-scrollbar bg-[#F6F7FA] bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.03)_1px,transparent_0)] bg-[size:20px_20px] transition-opacity duration-75 ${!isInitialScrolled ? "opacity-0" : "opacity-100"}`}
      >
        {/* Subtle Aura Background Elements */}
        <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-1/4 right-0 w-64 h-64 bg-indigo-50/50 blur-[120px] rounded-full" />
          <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-purple-50/50 blur-[120px] rounded-full" />
        </div>
        {/* Blocked Banner */}
        {(isBlockedByMe || isBlockedByOther) && (
          <div className="mb-8 mx-auto max-w-sm">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-100 rounded-[2rem] p-6 flex flex-col items-center text-center gap-4 shadow-sm"
            >
              <div className="w-14 h-14 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shadow-inner">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-[15px] font-bold text-red-900">
                  {isBlockedByMe ? "Bu kullanıcıyı engellediniz" : "Bu kullanıcıyla iletişim kuramazsınız"}
                </h4>
                <p className="text-xs text-red-700/70 font-medium leading-relaxed">
                  {isBlockedByMe 
                    ? "Mesaj göndermek için engeli kaldırmanız gerekmektedir." 
                    : "Karşı taraf sizi engellediği için mesaj gönderemezsiniz."}
                </p>
              </div>
              {isBlockedByMe && (
                <button 
                  onClick={handleBlockToggle}
                  className="w-full py-3 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-600/20"
                >
                  Engeli Kaldır
                </button>
              )}
            </motion.div>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-40">
            <div className="w-24 h-24 rounded-[2.5rem] bg-black/[0.03] flex items-center justify-center">
              <MessageCircle className="w-12 h-12 text-muted" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-serif font-bold text-heading">Henüz mesaj yok</h3>
              <p className="text-sm font-medium max-w-[200px]">İlk mesajı sen atarak sohbeti başlatabilirsin.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Security Warning */}
            <div className="flex justify-center mb-10">
              <div className="max-w-[85%] bg-amber-500/5 border border-amber-500/10 rounded-[1.5rem] px-5 py-4 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-amber-900/70 font-bold leading-relaxed">
                  Kişisel bilgilerinizi paylaşırken dikkatli olun. Uygulama dışı paylaşımlar kullanıcı sorumluluğundadır.
                </p>
              </div>
            </div>

            {visibleMessages.map((msg, index) => {
              const isMe = msg.senderId === currentUser.uid;
              const isSystem = msg.type === 'system';
              const nextMsg = visibleMessages[index + 1];
              const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
              const isFirstInGroup = index === 0 || visibleMessages[index - 1].senderId !== msg.senderId;
              
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-8">
                    <span className="px-5 py-1.5 bg-black/[0.03] rounded-full text-[10px] font-black text-muted/60 uppercase tracking-widest border border-black/5">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              if (msg.isDeleted && msg.deletedForEveryone) {
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-1`}>
                    <div className="px-4 py-2.5 rounded-2xl text-[13px] italic text-muted/40 bg-black/[0.02] border border-black/5">
                      Bu mesaj silindi.
                    </div>
                  </div>
                );
              }

              const isEmojiOnly = msg.text && /^[\p{Extended_Pictographic}\s]+$/u.test(msg.text.trim());

              return (
                <div 
                  key={msg.id} 
                  id={`msg-${msg.id}`}
                  className={`relative z-10 flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 group/msg w-full min-w-0 px-3 animate-in fade-in duration-150 ease-out`}
                >
                  {!isMe && (
                    <div className="w-10 flex-shrink-0 flex items-end mb-1">
                      {isLastInGroup && (
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white shadow-sm">
                          <OptimizedImage 
                            src={otherUser?.social?.photos?.[0] || otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || 'chat'}`} 
                            alt="avatar"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={`max-w-[75%] min-w-0 flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
                    {/* Message Actions Menu */}
                    <AnimatePresence>
                      {activeMessageId === msg.id && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: 10 }}
                          className={`absolute bottom-full mb-3 z-20 bg-white border border-slate-100 rounded-2xl p-1.5 shadow-2xl flex gap-1 ${isMe ? 'right-0' : 'left-0'}`}
                        >
                          {isMe && !msg.mediaUrl && (
                            <button 
                              onClick={() => handleEditMessage(msg)}
                              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDeleteMessage(msg, false)}
                            className="p-2 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div 
                      onClick={() => setActiveMessageId(activeMessageId === msg.id ? null : msg.id)}
                      className={`cursor-pointer transition-all duration-100 active:scale-[0.99] relative max-w-full min-w-0 break-words whitespace-pre-wrap [overflow-wrap:anywhere] ${
                        isEmojiOnly 
                          ? 'p-0 bg-transparent shadow-none ring-0 border-0' 
                          : `px-3.5 py-2 text-[15px] leading-[1.45] tracking-tight ${
                              isMe 
                                ? `bg-gradient-to-br from-[#2F2F46] to-[#5B4B8A] text-white font-normal shadow-sm ${
                                    isFirstInGroup && isLastInGroup ? 'rounded-2xl' :
                                    isFirstInGroup ? 'rounded-t-2xl rounded-bl-2xl rounded-br-[4px]' :
                                    isLastInGroup ? 'rounded-b-2xl rounded-tl-2xl rounded-tr-[4px]' :
                                    'rounded-l-2xl rounded-r-[4px]'
                                  }` 
                                : `bg-white text-slate-800 font-normal shadow-sm border border-black/[0.04] ${
                                    isFirstInGroup && isLastInGroup ? 'rounded-2xl' :
                                    isFirstInGroup ? 'rounded-t-2xl rounded-br-2xl rounded-bl-[4px]' :
                                    isLastInGroup ? 'rounded-b-2xl rounded-tr-2xl rounded-tl-[4px]' :
                                    'rounded-r-2xl rounded-l-[4px]'
                                  }`
                            }`
                      }`}
                    >
                      {/* Suble inner glow for outgoing */}
                      {isMe && !isEmojiOnly && (
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none rounded-[inherit]" />
                      )}

                      {msg.mediaUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden bg-black/5 shadow-sm border border-white/10">
                          {msg.mediaType === 'image' ? (
                            <OptimizedImage 
                              src={msg.mediaUrl} 
                              alt="Media" 
                              className="max-w-full max-h-72 object-contain"
                            />
                          ) : msg.mediaType === 'video' ? (
                            <video 
                              src={msg.mediaUrl} 
                              controls 
                              className="max-w-full max-h-72"
                            />
                          ) : (
                            <a 
                              href={msg.mediaUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 transition-all rounded-lg"
                            >
                              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                <Paperclip className="w-5 h-5 text-indigo-400" />
                              </div>
                              <span className="text-sm font-medium underline underline-offset-2 opacity-90 break-all line-clamp-2">
                                {(msg as any).fileName || "Ekli Dosya"}
                              </span>
                            </a>
                          )}
                        </div>
                      )}
                      <p className={`relative z-10 block max-w-full min-w-0 break-words whitespace-pre-wrap [overflow-wrap:anywhere] ${isEmojiOnly ? 'text-[48px] leading-none tracking-normal' : ''}`}>{msg.text}</p>
                      {msg.editedAt && (
                        <span className={`block text-[10px] mt-0.5 opacity-50 italic leading-none ${isMe ? 'text-white' : 'text-[#1A1A2E]'}`}>
                          (düzenlendi)
                        </span>
                      )}
                    </div>
                    
                    {isLastInGroup && (
                      <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs font-medium ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                          {formatSafeDate(msg.createdAt, "HH:mm")}
                        </span>
                        {isMe && (
                          <div className="flex items-center">
                            {msg.status === 'seen' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.3)] opacity-90" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400 opacity-90" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-400 opacity-90" />
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* Input Bar */}
      <div className="bg-white/80 backdrop-blur-sm border-t border-black/[0.04] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] p-4 pb-[calc(env(safe-area-inset-bottom,1rem)+0.5rem)] shrink-0 relative z-40">
        {/* Media Preview */}
        <AnimatePresence>
          {mediaPreview && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-4 mb-4 p-2.5 bg-white rounded-2xl shadow-md ring-1 ring-black/5 flex items-center gap-3 z-50 max-w-[280px] animate-in fade-in zoom-in-95 slide-in-from-bottom-1 duration-150 ease-out"
            >
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-50 relative border border-slate-100 shrink-0">
                <OptimizedImage src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-sm font-semibold text-slate-800 truncate">{mediaFile?.name || 'Fotoğraf'}</p>
                <p className="text-[11px] font-medium text-emerald-600 tracking-wide mt-0.5">Gönderilmeye hazır</p>
              </div>
              <button 
                onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors shrink-0 mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Editing Indicator */}
        <AnimatePresence>
          {editingMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-4 right-4 mb-4 p-4 bg-[#1A1A2E] border border-white/10 rounded-[2rem] shadow-2xl flex items-center gap-4 text-white z-50"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <Edit2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Mesajı Düzenle</p>
                <p className="text-sm font-medium truncate">{editingMessage.text}</p>
              </div>
              <button 
                onClick={() => { setEditingMessage(null); setNewMessage(""); }}
                className="p-2 hover:bg-white/10 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div 
              ref={emojiPickerRef}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-4 mb-4 z-[110]"
            >
              <div className="rounded-[2.5rem] overflow-hidden border border-black/10 shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  theme={Theme.LIGHT}
                  emojiStyle={EmojiStyle.NATIVE}
                  lazyLoadEmojis={true}
                  searchPlaceholder="Emoji ara..."
                  width={320}
                  height={400}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-end gap-3 px-1">
          {/* Action Icons Left */}
          <div className="flex items-center gap-1">
            <button 
              type="button"
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              className="p-2.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-200 ease-out active:scale-90"
            >
              <ImageIcon className="w-6 h-6" />
            </button>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button 
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2.5 rounded-full transition-all ${
                showEmojiPicker 
                  ? 'bg-[#1A1A2E] text-white shadow-lg shadow-indigo-200' 
                  : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Smile className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef as any}
              rows={1}
              value={newMessage}
              placeholder={(isBlockedByMe || isBlockedByOther) ? "Bu kullanıcıyla iletişim kuramazsınız" : "Bir mesaj yaz..."}
              disabled={(isBlockedByMe || isBlockedByOther) || isSending}
              onChange={(e) => {
                handleTyping(e as any);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e as any);
                }
              }}
              className="w-full bg-slate-50 border-transparent rounded-full py-3 px-4 text-sm text-[#1A1A2E] placeholder:text-slate-400 focus:bg-white focus:shadow-[0_1px_8px_rgba(0,0,0,0.04)] focus:ring-2 focus:ring-[#5B4B8A]/15 transition-[background-color,box-shadow,border-color] duration-200 ease-out resize-none max-h-36 no-scrollbar"
            />
          </div>

          <button
            type="submit"
            disabled={(!newMessage.trim() && !mediaFile) || isSending || isBlockedByMe || isBlockedByOther}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ease-out disabled:opacity-50 flex-shrink-0 hover:scale-105 active:scale-90 ${
              newMessage.trim() || mediaFile 
                ? 'bg-gradient-to-br from-[#2F2F46] to-[#5B4B8A] text-white shadow-md shadow-[#5B4B8A]/30' 
                : 'bg-slate-100 text-slate-300 shadow-none'
            }`}
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5 ml-0.5" />
            )}
          </button>
        </form>
      </div>

      {/* Profile Popup */}
      <AnimatePresence>
        {showProfile && (
          <SocialProfilePopup 
            user={otherUser}
            currentUser={currentUser}
            onClose={() => setShowProfile(false)}
            onCompatibilityCheck={() => {}}
            onSendMessage={() => setShowProfile(false)}
            onNavigate={onNavigate}
            context="match"
            inChat={true}
          />
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowReportModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-lg font-bold text-heading">Kullanıcıyı Şikayet Et</h3>
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="p-2 rounded-full hover:bg-black/5 text-muted transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleReportUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-heading mb-2">Şikayet Sebebi</label>
                  <select 
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-black/5 border border-black/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all text-heading"
                    required
                  >
                    <option value="">Sebep Seçin...</option>
                    <option value="spam">Spam / Sahte Hesap</option>
                    <option value="inappropriate">Uygunsuz İçerik</option>
                    <option value="harassment">Taciz / Zorbalık</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-heading mb-2">Açıklama (Opsiyonel)</label>
                  <textarea 
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Lütfen durumu kısaca açıklayın..."
                    className="w-full bg-black/5 border border-black/5 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all text-heading min-h-[100px] resize-none"
                  />
                </div>
                <div className="pt-2">
                  <button 
                    type="submit"
                    disabled={isReporting || !reportReason}
                    className="w-full bg-red-500 text-white rounded-xl py-3.5 font-bold disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isReporting ? "Gönderiliyor..." : "Şikayet Et"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
