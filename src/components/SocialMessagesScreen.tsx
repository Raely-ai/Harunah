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
  Trash2,
  Edit2,
  Clock,
  User,
  AlertCircle,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
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
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, InteractionRequest as InteractionRequestType, Chat, Message, normalizeUserProfile } from "../types";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toSafeDate, formatSafeDate } from "../lib/dateUtils";
import { toast } from "sonner";
import SocialProfilePopup from "./SocialProfilePopup";
import { socialService } from "../lib/socialService";
import { isSocialProfileReady } from "../lib/socialUtils";
import { cacheManager } from "../lib/cacheManager";
import SocialDisabledView from "./SocialDisabledView";

import { reportService } from "../services/reportService";

export default function SocialMessagesScreen({ 
  currentUser, 
  onBack, 
  onNavigate,
  onChatOpenChange 
}: { 
  currentUser: UserProfile, 
  onBack?: () => void, 
  onNavigate: (tab: any) => void,
  onChatOpenChange?: (isOpen: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<'chats' | 'requests' | 'likers'>('chats');
  const [chats, setChats] = useState<(Chat & { otherUser: UserProfile })[]>([]);
  const [requests, setRequests] = useState<InteractionRequestType[]>([]);
  const [likers, setLikers] = useState<{ id: string, user: UserProfile, createdAt: any }[]>([]);
  const [selectedChat, setSelectedChat] = useState<(Chat & { otherUser: UserProfile }) | null>(null);
  const [selectedLiker, setSelectedLiker] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const profilesCache = useRef<Record<string, UserProfile>>({});

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
  }, [selectedChat, onChatOpenChange, currentUser.uid]);

  useEffect(() => {
    if (currentUser?.uid) {
      socialService.updateUserStatus(currentUser.uid, true);
      return () => {
        // We can optionally set offline here, but since multiple components might be mounted
        // or user might toggle tabs fast, we rely on the debounced service logic.
        // For a safe refactor, we just mark as online when entering.
      };
    }
  }, [currentUser?.uid]);

  // Real-time data fetching based on active tab
  useEffect(() => {
    if (!currentUser.uid || !isSocialProfileReady(currentUser)) return;

    let unsubscribe: () => void = () => {};

    const handleFetch = async () => {
      if (activeTab === 'chats') {
        const cached = cacheManager.get<any>(CHAT_LIST_CACHE_KEY);
        if (cached) {
          setChats(cached);
          // If cache is fresh (< 30s), don't background fetch
          if (Date.now() - (cached._timestamp || 0) < 30000) return;
        }

        setLoading(true);
        try {
          const q = query(
            collection(db, "chats"),
            where("participants", "array-contains", currentUser.uid),
            orderBy("lastMessageAt", "desc"),
            limit(30)
          );
          
          const snapshot = await getDocs(q);
          const chatDocs = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Chat))
            .filter(chat => !chat.deletedFor?.includes(currentUser.uid));
          
          // Batch fetch user profiles to avoid N+1
          const otherUserIds = Array.from(new Set(chatDocs.map(c => c.participants.find(id => id !== currentUser.uid)).filter(Boolean))) as string[];
          const missingUserIds = otherUserIds.filter(id => !profilesCache.current[id]);
          
          if (missingUserIds.length > 0) {
            // Firestore 'in' query limit is 30, which perfectly matches our chat limit
            const usersQ = query(collection(db, "users"), where("uid", "in", missingUserIds));
            const usersSnap = await getDocs(usersQ);
            usersSnap.forEach(uDoc => {
              const uData = uDoc.data();
              profilesCache.current[uDoc.id] = normalizeUserProfile(uData, uDoc.id);
            });
          }

          const chatList = chatDocs.map((chatData) => {
            const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
            const otherUser = profilesCache.current[otherUserId!];
            return { ...chatData, otherUser };
          });
          
          chatList.sort((a, b) => {
            const timeA = toSafeDate(a.lastMessageAt).getTime();
            const timeB = toSafeDate(b.lastMessageAt).getTime();
            return timeB - timeA;
          });

          setChats(chatList);
          cacheManager.set(CHAT_LIST_CACHE_KEY, chatList, 600, true);
        } catch (error: any) {
          if (error.message?.toLowerCase().includes("quota")) {
            toast.error("Sohbet listesi güncellenemedi.");
          }
          console.error("Error fetching chats:", error);
        } finally {
          setLoading(false);
        }
      } else if (activeTab === 'requests') {
        const cached = cacheManager.get<any>(REQUESTS_CACHE_KEY);
        if (cached) {
          setRequests(cached);
          if (Date.now() - (cached._timestamp || 0) < 30000) return;
        }

        setLoading(true);
        try {
          const q = query(
            collection(db, "interactionRequests"),
            where("toUserId", "==", currentUser.uid),
            where("status", "==", "pending"),
            orderBy("createdAt", "desc"),
            limit(20)
          );
          
          const snapshot = await getDocs(q);
          const requestList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InteractionRequestType));
          setRequests(requestList);
          cacheManager.set(REQUESTS_CACHE_KEY, requestList, 600, true);
        } catch (error) {
          console.error("Error fetching requests:", error);
        } finally {
          setLoading(false);
        }
      } else if (activeTab === 'likers') {
        const cached = cacheManager.get<any>(LIKERS_CACHE_KEY);
        if (cached) {
          setLikers(cached);
          if (Date.now() - (cached._timestamp || 0) < 60000) return;
        }

        setLoading(true);
        try {
          const q = query(
            collection(db, "swipes"),
            where("toUserId", "==", currentUser.uid),
            where("type", "in", ["like", "super_like"]),
            limit(40)
          );
          
          const snapshot = await getDocs(q);
          const likerList = await Promise.all(snapshot.docs.map(async (swipeDoc) => {
            const swipeData = swipeDoc.data();
            let sender = profilesCache.current[swipeData.fromUserId];
            
            if (!sender) {
              const senderSnap = await getDoc(doc(db, "users", swipeData.fromUserId));
              if (senderSnap.exists()) {
                sender = normalizeUserProfile(senderSnap.data(), senderSnap.id);
                profilesCache.current[swipeData.fromUserId] = sender;
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
        } catch (error) {
          console.error("Error fetching likers:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    handleFetch();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeTab, currentUser.uid]);

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
        const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
        const otherUserSnap = await getDoc(doc(db, "users", otherUserId!));
        setSelectedChat({
          ...chatData,
          id: chatSnap.id,
          otherUser: normalizeUserProfile(otherUserSnap.data(), otherUserSnap.id)
        });
      }
    } catch (error: any) {
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
        const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
        const otherUserSnap = await getDoc(doc(db, "users", otherUserId!));
        setSelectedChat({
          ...chatData,
          id: chatSnap.id,
          otherUser: normalizeUserProfile(otherUserSnap.data(), otherUserSnap.id)
        });
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

  if (!isSocialEnabled) {
    return (
      <div className="flex flex-col h-full bg-[#F6F4F8] text-body relative overflow-hidden">
        {/* Header */}
        <header className="header-gradient backdrop-blur-3xl border-b border-black/5 px-6 py-5 flex flex-col gap-1 z-10">
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
        <header className="px-6 py-5 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Mesajlar</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">İletişim & Enerji Merkezi</p>
          </div>
          <motion.button 
            whileTap={{ rotate: 180 }}
            onClick={() => {
              cacheManager.clear(CHAT_LIST_CACHE_KEY);
              cacheManager.clear(REQUESTS_CACHE_KEY);
              cacheManager.clear(LIKERS_CACHE_KEY);
              window.location.reload();
            }}
            className="w-10 h-10 rounded-full bg-white shadow-sm border border-black/5 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </motion.button>
        </header>

        {/* Premium Segmented Control (Tabs) */}
        <div className="px-6 pb-4">
          <div className="relative flex bg-slate-100/50 backdrop-blur-sm p-1 rounded-2xl border border-black/5 shadow-inner">
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
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'chats' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Sohbetler</span>
            </button>

            <button 
              onClick={() => setActiveTab('requests')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
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
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                activeTab === 'likers' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Beğeniler</span>
              {(likers.length > 0) && (
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
        <div className="px-6 py-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sohbetlerde ara..."
              className="w-full bg-slate-100/50 border border-black/5 rounded-2xl py-3.5 pl-11 pr-4 text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-indigo-500/30 transition-all shadow-sm"
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
              {loading ? (
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
                      {searchQuery ? "Sonuç Bulunamadı" : "Sohbetlerin Burada"}
                    </h3>
                    <p className="text-[13px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                      {searchQuery ? "Aramanla eşleşen bir sohbet bulamadık." : "Eşleştiğin kişilerle olan tüm konuşmaların burada listelenir."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 px-4">
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
              {requests.length === 0 ? (
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
                requests.map(request => (
                  <div key={request.id} className="bg-white rounded-[2.5rem] p-6 border border-black/5 shadow-sm flex flex-col gap-6">
                    <div className="flex gap-5">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                        <img 
                          src={request?.senderSnapshot?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request?.fromUserId || 'default'}`} 
                          alt="User"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-black text-slate-900 truncate uppercase text-xs tracking-tight">{request?.senderSnapshot?.nickname || 'Bilinmiyor'}</h4>
                          <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-slate-100 text-slate-500 border border-black/5">
                            {request.type === 'message_request' ? 'Mesaj İsteği' : 'Süper Like'}
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-400 font-medium italic">"Sana bir mesaj isteği gönderdi."</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-6 border-t border-slate-100">
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
                ))
              )}
            </motion.div>
          )}

          {activeTab === 'likers' && (
            <motion.div 
              key="likers"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 pt-2 space-y-3"
            >
              {likers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-rose-500/5 blur-3xl rounded-full" />
                    <div className="relative w-24 h-24 rounded-[2.5rem] bg-white flex items-center justify-center border border-black/5 shadow-xl text-rose-500/20">
                      <Heart className="w-10 h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">Henüz Beğenen Yok</h3>
                    <p className="text-[13px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">Seni beğenenler burada görünür. Keşfetmeye devam et!</p>
                  </div>
                </div>
              ) : (
                likers.map(liker => (
                  <div key={liker.id} className="bg-white rounded-[2rem] p-4 border border-black/5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all group">
                    <div 
                      className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200 cursor-pointer group-hover:border-rose-400/50 transition-all"
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
                      <h4 className="font-black text-slate-900 truncate uppercase text-xs">
                        {liker?.user?.social?.nickname || liker?.user?.nickname || 'Gizemli'}, {liker?.user?.age || ''}
                      </h4>
                      <p className="text-[9px] text-rose-500 font-black uppercase tracking-widest mt-0.5">Seni Beğendi!</p>
                    </div>
                    <button 
                      onClick={() => handleStartChatFromLiker(liker.user)} 
                      disabled={isProcessing}
                      className="py-3 px-6 rounded-2xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-[0.15em] hover:bg-rose-700 transition-all shadow-xl shadow-rose-600/10 disabled:opacity-50"
                    >
                      Sohbet
                    </button>
                  </div>
                ))
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
            onClose={() => setSelectedChat(null)} 
            onNavigate={onNavigate}
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
      className={`w-full px-4 py-4 flex items-center gap-4 transition-all text-left group bg-white rounded-[2.25rem] border border-black/5 shadow-sm hover:shadow-md hover:bg-slate-50 relative ${
        unreadCount > 0 ? 'border-indigo-100' : ''
      }`}
    >
      <div className="relative flex-shrink-0">
        <div className={`w-14 h-14 rounded-2xl overflow-hidden bg-slate-100 border transition-all duration-300 ${
          unreadCount > 0 ? 'border-indigo-300 shadow-lg shadow-indigo-500/10' : 'border-slate-200'
        }`}>
          <img 
            src={otherUser?.social?.photos?.[0] || otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || 'chat'}`} 
            alt={otherUser?.social?.nickname || otherUser?.nickname || 'Sohbet'}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        {otherUser.social?.isOnline && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-lg shadow-emerald-500/20" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <h3 className={`font-black text-xs uppercase tracking-tight truncate ${unreadCount > 0 ? 'text-slate-900' : 'text-slate-700'}`}>
            {otherUser.social?.nickname || otherUser.nickname}
          </h3>
          {chat.lastMessageAt && (
            <span className={`text-[9px] font-black whitespace-nowrap ml-2 uppercase tracking-tighter ${unreadCount > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
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
            <p className={`text-[12px] truncate transition-all leading-tight ${unreadCount > 0 ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium'}`}>
              {chat.typing?.[otherUser.uid] ? (
                <span className="text-indigo-600 italic animate-pulse font-black">Yazıyor...</span>
              ) : chat.lastMessage}
            </p>
          </div>
          {unreadCount > 0 && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/20"
            >
              <span className="text-[9px] font-black text-white">{unreadCount}</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function ChatDetail({ chat: initialChat, currentUser, onClose, onNavigate }: { chat: Chat & { otherUser: UserProfile }, currentUser: UserProfile, onClose: () => void, onNavigate: (tab: any) => void }) {
  const [chat, setChat] = useState(initialChat);
  const [messages, setMessages] = useState<Message[]>([]);
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

  // Sync chat doc updates (typing status, unread counts, etc.)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "chats", initialChat.id), (snap) => {
      if (snap.exists()) {
        setChat({ ...initialChat, ...snap.data() } as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `chats/${initialChat.id}`);
    });
    return () => unsubscribe();
  }, [initialChat.id]);

  // Handle typing status
  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      socialService.setTypingStatus(chat.id, currentUser.uid, true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socialService.setTypingStatus(chat.id, currentUser.uid, false);
    }, 2000);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Size limits
    if (file.type.startsWith('video/') && file.size > 10 * 1024 * 1024) {
      toast.error("Video boyutu 10MB'dan küçük olmalıdır.");
      return;
    }

    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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
          setOtherUser({ uid: snap.id, ...snap.data() } as UserProfile);
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

    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chat.id),
      where("participants", "array-contains", currentUser.uid),
      orderBy("createdAt", "asc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      
      setMessages(msgs);
      cacheManager.set(CACHE_KEY, msgs, 1800, true); // Cache for 30 mins persistently
      
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

    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "messages");
    });

    return () => unsubscribe();
  }, [chat.id, currentUser.uid, otherUser.uid]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || isSending) return;

    setIsSending(true);
    const messageText = newMessage.trim();
    const currentMediaFile = mediaFile;
    
    // Optimistic UI
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: Message = {
      id: tempId,
      chatId: chat.id,
      senderId: currentUser.uid,
      receiverId: otherUser.uid,
      participants: [currentUser.uid, otherUser.uid],
      text: messageText,
      mediaUrl: mediaPreview,
      mediaType: currentMediaFile ? (currentMediaFile.type.startsWith('image/') ? 'image' : 'video') : null,
      createdAt: { toDate: () => new Date() } as any,
      status: 'sending',
      seen: false,
      type: currentMediaFile ? (currentMediaFile.type.startsWith('image/') ? 'image' : 'video') : 'text'
    };

    setMessages(prev => [...prev, optimisticMsg]);
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
        const type = currentMediaFile.type.startsWith('image/') ? 'image' : 'video';
        await socialService.sendMedia(chat.id, currentUser.uid, otherUser.uid, currentMediaFile, type);
      } else {
        await socialService.sendMessage(chat.id, currentUser.uid, otherUser.uid, { text: messageText });
      }
    } catch (error: any) {
      const errorMessage = error?.message || "Mesaj gönderilemedi.";
      toast.error(errorMessage);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId));
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
    if (otherUser.social?.isOnline) return "Çevrimiçi";
    if (otherUser.social?.lastSeen) {
      return `Son görülme: ${formatDistanceToNow(toSafeDate(otherUser.social.lastSeen), { addSuffix: true, locale: tr })}`;
    }
    return "Çevrimdışı";
  };

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[100] bg-white flex flex-col h-[100svh] overflow-hidden"
    >
      {/* Header */}
      <header className="bg-white/40 backdrop-blur-3xl border-b border-white/20 px-4 py-4 flex items-center justify-between shrink-0 z-30 sticky top-0 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
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
              <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200 border-2 border-white shadow-md transition-transform group-hover:scale-105">
                <img 
                  src={otherUser?.social?.photos?.[0] || otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || 'chat'}`} 
                  alt={otherUser?.social?.nickname || otherUser?.nickname || 'Sohbet'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              {otherUser?.social?.isOnline && (
                <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-lg text-[#1A1A2E] leading-tight truncate tracking-tight">
                {otherUser?.social?.nickname || otherUser?.nickname || 'Gizemli'}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                {otherUser?.social?.isOnline && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
                <p className="text-[11px] font-medium text-[#1A1A2E]/50 tracking-wide uppercase">
                  {otherUser?.uid && chat?.typing?.[otherUser.uid] ? (
                    <span className="text-indigo-600 animate-pulse font-bold">Yazıyor...</span>
                  ) : (otherUser?.social?.isOnline ? "Aktif" : getPresenceText())}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 relative">
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
      <div className="flex-1 overflow-y-auto px-4 py-8 space-y-4 no-scrollbar bg-[#FBFCFF]">
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

            {messages.map((msg, index) => {
              const isMe = msg.senderId === currentUser.uid;
              const isSystem = msg.type === 'system';
              const nextMsg = messages[index + 1];
              const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;
              const isFirstInGroup = index === 0 || messages[index - 1].senderId !== msg.senderId;
              
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

              const isEmojiOnly = msg.text && /^\p{Emoji}$/u.test(msg.text.trim());

              return (
                <div key={msg.id} className={`relative z-10 flex ${isMe ? 'justify-end' : 'justify-start'} mb-1 group/msg`}>
                  {!isMe && (
                    <div className="w-10 flex-shrink-0 flex items-end mb-1">
                      {isLastInGroup && (
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-white shadow-sm">
                          <img 
                            src={otherUser?.social?.photos?.[0] || otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || 'chat'}`} 
                            alt="avatar"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className={`max-w-[78%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
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
                      className={`px-4 py-3 text-[15px] leading-[1.6] cursor-pointer transition-all active:scale-[0.99] relative overflow-hidden ${
                        isEmojiOnly 
                          ? 'bg-transparent text-5xl p-0 shadow-none' 
                          : isMe 
                            ? `bg-[#1A1A2E] text-white font-normal shadow-[0_4px_15px_rgba(26,26,46,0.15)] ring-1 ring-white/10 ${
                                isFirstInGroup && isLastInGroup ? 'rounded-2xl' :
                                isFirstInGroup ? 'rounded-t-2xl rounded-bl-2xl rounded-br-md' :
                                isLastInGroup ? 'rounded-b-2xl rounded-tl-2xl rounded-tr-md' :
                                'rounded-l-2xl rounded-r-md'
                              }` 
                            : `bg-[#E0E0F8] text-[#1A1A2E] font-normal shadow-[0_4px_15px_rgba(224,224,248,0.3)] ring-1 ring-black/5 ${
                                isFirstInGroup && isLastInGroup ? 'rounded-2xl' :
                                isFirstInGroup ? 'rounded-t-2xl rounded-br-2xl rounded-bl-md' :
                                isLastInGroup ? 'rounded-b-2xl rounded-tr-2xl rounded-tl-md' :
                                'rounded-r-2xl rounded-l-md'
                              }`
                      }`}
                    >
                      {/* Suble inner glow for outgoing */}
                      {isMe && !isEmojiOnly && (
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none" />
                      )}

                      {msg.mediaUrl && (
                        <div className="mb-2 rounded-xl overflow-hidden bg-black/5 shadow-inner border border-white/10">
                          {msg.mediaType === 'image' ? (
                            <img 
                              src={msg.mediaUrl} 
                              alt="Media" 
                              className="max-w-full max-h-72 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <video 
                              src={msg.mediaUrl} 
                              controls 
                              className="max-w-full max-h-72"
                            />
                          )}
                        </div>
                      )}
                      <p className="relative">{msg.text}</p>
                      {msg.editedAt && (
                        <span className={`block text-[8px] mt-1 opacity-50 italic ${isMe ? 'text-white' : 'text-[#1A1A2E]'}`}>
                          (düzenlendi)
                        </span>
                      )}
                    </div>
                    
                    {isLastInGroup && (
                      <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatSafeDate(msg.createdAt, "HH:mm")}
                        </span>
                        {isMe && (
                          <div className="flex items-center">
                            {msg.status === 'seen' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.3)]" />
                            ) : msg.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-300" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-300" />
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
      <div className="bg-white/70 backdrop-blur-3xl border-t border-black/5 p-4 pb-[calc(env(safe-area-inset-bottom,1rem)+0.5rem)] shrink-0 relative z-40">
        {/* Media Preview */}
        <AnimatePresence>
          {mediaPreview && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-4 right-4 mb-4 p-3 bg-white border border-slate-100 rounded-[2rem] shadow-2xl flex items-center gap-4 z-50"
            >
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 relative shadow-inner">
                {mediaFile?.type.startsWith('image/') ? (
                  <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <video src={mediaPreview} className="w-full h-full object-cover" />
                )}
                <button 
                  onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                  className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-black transition-all shadow-lg"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1A1A2E] truncate">{mediaFile?.name}</p>
                <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Gönderilmeye hazır</p>
              </div>
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
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2.5 rounded-full transition-all ${
                showEmojiPicker 
                  ? 'bg-[#1A1A2E] text-white shadow-lg shadow-indigo-200' 
                  : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Smile className="w-6 h-6" />
            </button>
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            >
              <Paperclip className="w-6 h-6" />
            </button>
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
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
              className="w-full bg-slate-100/50 border-none rounded-2xl py-3 px-4 text-[15px] text-[#1A1A2E] placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-100 transition-all resize-none max-h-36 no-scrollbar"
            />
          </div>

          <button
            type="submit"
            disabled={(!newMessage.trim() && !mediaFile) || isSending || isBlockedByMe || isBlockedByOther}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 disabled:opacity-50 flex-shrink-0 ${
              newMessage.trim() || mediaFile 
                ? 'bg-[#1A1A2E] text-white shadow-[#1A1A2E]/20' 
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
