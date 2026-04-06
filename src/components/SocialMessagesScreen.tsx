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
  AlertCircle
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
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, InteractionRequest as InteractionRequestType, Chat, Message } from "../types";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";
import SocialProfilePopup from "./SocialProfilePopup";
import { socialService } from "../lib/socialService";
import { isSocialProfileReady } from "../lib/socialUtils";
import SocialDisabledView from "./SocialDisabledView";

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
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const profilesCache = useRef<Record<string, UserProfile>>({});

  // Sync chat open state with parent
  useEffect(() => {
    onChatOpenChange?.(!!selectedChat);
    if (selectedChat && currentUser.uid) {
      // Mark as seen immediately when chat is selected from list
      socialService.markAsSeen(selectedChat.id, currentUser.uid, selectedChat.otherUser.uid);
    }
  }, [selectedChat, onChatOpenChange, currentUser.uid]);

  // Fetch Chats
  useEffect(() => {
    if (!currentUser.uid) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      
      const chatList = await Promise.all(chatDocs.map(async (chatData) => {
        const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
        
        // Use cache if available to speed up "live" updates
        let otherUser = profilesCache.current[otherUserId!];
        if (!otherUser) {
          const otherUserSnap = await getDoc(doc(db, "users", otherUserId!));
          otherUser = { uid: otherUserSnap.id, ...otherUserSnap.data() } as UserProfile;
          profilesCache.current[otherUserId!] = otherUser;
        }
        
        return {
          ...chatData,
          otherUser
        };
      }));
      
      // Improved sorting: Handle pending server timestamps by using current time as fallback
      chatList.sort((a, b) => {
        const timeA = a.lastMessageAt?.toMillis?.() || Date.now();
        const timeB = b.lastMessageAt?.toMillis?.() || Date.now();
        return timeB - timeA;
      });

      setChats(chatList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Fetch Requests
  useEffect(() => {
    if (!currentUser.uid) return;
    const q = query(
      collection(db, "interactionRequests"),
      where("toUserId", "==", currentUser.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InteractionRequestType));

      // Client-side sort
      requestList.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setRequests(requestList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "interactionRequests");
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Fetch Likers
  useEffect(() => {
    if (!currentUser.uid) return;
    const q = query(
      collection(db, "swipes"),
      where("toUserId", "==", currentUser.uid),
      where("type", "in", ["like", "super_like"])
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log(`SocialMessagesScreen: Likers query returned ${snapshot.docs.length} docs`);
      
      const likerList = await Promise.all(snapshot.docs.map(async (swipeDoc) => {
        try {
          const swipeData = swipeDoc.data();
          console.log(`SocialMessagesScreen: Processing swipe ${swipeDoc.id} from ${swipeData.fromUserId}`);
          
          const senderSnap = await getDoc(doc(db, "users", swipeData.fromUserId));
          
          if (!senderSnap.exists()) {
            console.warn(`SocialMessagesScreen: User ${swipeData.fromUserId} not found for swipe ${swipeDoc.id}`);
            return {
              id: swipeDoc.id,
              user: { 
                uid: swipeData.fromUserId, 
                nickname: "Gizli Kullanıcı",
                photoURL: "",
                social: { nickname: "Gizli Kullanıcı", photos: [] }
              } as any as UserProfile,
              createdAt: swipeData.createdAt
            };
          }

          return {
            id: swipeDoc.id,
            user: { uid: senderSnap.id, ...senderSnap.data() } as UserProfile,
            createdAt: swipeData.createdAt
          };
        } catch (err) {
          console.error(`SocialMessagesScreen: Error fetching profile for swipe ${swipeDoc.id}:`, err);
          return null;
        }
      }));

      // Filter out failed fetches and sort
      const validLikers = likerList.filter((l): l is NonNullable<typeof l> => l !== null);
      
      validLikers.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      console.log(`SocialMessagesScreen: Setting ${validLikers.length} valid likers`);
      setLikers(validLikers);
    }, (error) => {
      console.error("SocialMessagesScreen: Likers onSnapshot error:", error);
      handleFirestoreError(error, OperationType.LIST, "swipes");
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

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
      setActiveTab('chats');
      
      const chatSnap = await getDoc(doc(db, "chats", chatId));
      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as Chat;
        const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
        const otherUserSnap = await getDoc(doc(db, "users", otherUserId!));
        setSelectedChat({
          ...chatData,
          id: chatSnap.id,
          otherUser: { uid: otherUserSnap.id, ...otherUserSnap.data() } as UserProfile
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
      setActiveTab('chats');
      
      const chatSnap = await getDoc(doc(db, "chats", chatId));
      if (chatSnap.exists()) {
        const chatData = chatSnap.data() as Chat;
        const otherUserId = chatData.participants.find(id => id !== currentUser.uid);
        const otherUserSnap = await getDoc(doc(db, "users", otherUserId!));
        setSelectedChat({
          ...chatData,
          id: chatSnap.id,
          otherUser: { uid: otherUserSnap.id, ...otherUserSnap.data() } as UserProfile
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
  useEffect(() => {
    if (!currentUser || chats.length === 0) return;

    const chatIds = chats.map(c => c.id);
    const q = query(
      collection(db, "messages"),
      where("chatId", "in", chatIds),
      where("status", "==", "sent")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docs.forEach(doc => {
        const msg = doc.data() as Message;
        if (msg.senderId !== currentUser.uid) {
          socialService.markAsDelivered(msg.chatId, currentUser.uid, msg.senderId);
        }
      });
    });

    return () => unsubscribe();
  }, [chats, currentUser]);



  const isSocialEnabled = isSocialProfileReady(currentUser);

  if (!isSocialEnabled) {
    return (
      <div className="flex flex-col h-full bg-[#F6F4F8] text-body">
        <header className="header-gradient backdrop-blur-3xl border-b border-black/5 px-6 py-5 flex flex-col gap-1 z-10">
          <h1 className="text-2xl font-serif font-bold text-heading tracking-tight">Mesajlar</h1>
          <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Sohbetler, istekler ve beğeniler</p>
        </header>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <SocialDisabledView onNavigate={onNavigate} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#F6F4F8] text-body">
      {/* Header */}
      <header className="header-gradient backdrop-blur-3xl border-b border-black/5 px-6 py-5 flex flex-col gap-1 z-10">
        <h1 className="text-2xl font-serif font-bold text-heading tracking-tight">Mesajlar</h1>
        <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Sohbetler, istekler ve beğeniler</p>
      </header>

      {/* Tabs */}
      <div className="px-4 py-3 bg-black/5 border-b border-black/5">
        <div className="flex bg-black/[0.03] p-1 rounded-2xl border border-black/5 backdrop-blur-xl">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'chats' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-muted hover:text-body'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Sohbetler
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
              activeTab === 'requests' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-muted hover:text-body'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            İstekler
            {requests.length > 0 && (
              <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-[#F6F4F8] ${activeTab === 'requests' ? 'bg-white text-black' : 'bg-amber-500 text-black'}`}>
                {requests.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('likers')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
              activeTab === 'likers' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-muted hover:text-body'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            Beğeniler
            {likers.length > 0 && (
              <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-[#F6F4F8] ${activeTab === 'likers' ? 'bg-white text-black' : 'bg-amber-500 text-black'}`}>
                {likers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar (Only for Chats) */}
      {activeTab === 'chats' && chats.length > 0 && (
        <div className="px-4 py-3 border-b border-black/5">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-amber-600 transition-colors" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sohbetlerde ara..."
              className="w-full bg-black/[0.03] border border-black/5 rounded-xl py-3 pl-11 pr-4 text-xs text-heading placeholder:text-muted focus:outline-none focus:border-amber-500/30 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/5 text-muted"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'chats' && (
            <motion.div
              key="chats"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {loading ? (
                <div className="flex justify-center py-20">
                  <div className="w-10 h-10 border-4 border-white/5 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 px-10 text-center space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/10 blur-3xl rounded-full" />
                    <div className="relative p-8 rounded-[2rem] bg-black/[0.03] border border-black/10 backdrop-blur-xl">
                      <MessageCircle className="w-16 h-16 text-muted" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-serif font-bold text-heading">
                      {searchQuery ? "Sonuç bulunamadı" : "Henüz sohbet yok"}
                    </h3>
                    <p className="text-sm text-muted max-w-[200px] mx-auto">
                      {searchQuery ? "Aramanla eşleşen bir sohbet bulamadık." : "Karşılaştığın kişilerle burada sohbet edebilirsin."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-black/5">
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 space-y-4"
            >
              {requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/10 blur-3xl rounded-full" />
                    <div className="relative w-20 h-20 rounded-[1.5rem] bg-black/[0.03] flex items-center justify-center border border-black/10 backdrop-blur-xl">
                      <UserPlus className="w-10 h-10 text-muted" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-serif font-bold text-heading">İstek kutun boş</h3>
                    <p className="text-sm text-muted max-w-[200px] mx-auto">Gelen mesaj ve süper like istekleri burada görünür.</p>
                  </div>
                </div>
              ) : (
                requests.map(request => (
                  <div key={request.id} className="bg-white rounded-[2rem] p-5 border border-black/5 shadow-sm flex flex-col gap-4">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/5 flex-shrink-0 border border-black/5">
                        <img 
                          src={request.senderSnapshot.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request.fromUserId}`} 
                          alt="User"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-base text-heading">{request.senderSnapshot.nickname}</h4>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                            request.type === 'message_request' ? 'text-blue-600 bg-blue-500/10 border-blue-500/20' : 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                          }`}>
                            {request.type === 'message_request' ? 'Mesaj İsteği' : 'Süper Like'}
                          </span>
                        </div>
                        <p className="text-xs text-body line-clamp-2 italic opacity-60">"Sana bir mesaj isteği gönderdi."</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-4 border-t border-black/5">
                      <button 
                        onClick={() => handleRejectRequest(request.id)} 
                        disabled={isProcessing}
                        className="flex-1 py-3 rounded-xl bg-black/5 text-muted text-xs font-bold hover:bg-black/10 transition-all uppercase tracking-widest border border-black/5 disabled:opacity-50"
                      >
                        Reddet
                      </button>
                      <button 
                        onClick={() => handleAcceptRequest(request)} 
                        disabled={isProcessing}
                        className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-xs font-black hover:bg-amber-700 transition-all uppercase tracking-widest shadow-lg shadow-amber-500/20 disabled:opacity-50"
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
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 space-y-4"
            >
              {likers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-rose-500/10 blur-3xl rounded-full" />
                    <div className="relative w-20 h-20 rounded-[1.5rem] bg-black/[0.03] flex items-center justify-center border border-black/10 backdrop-blur-xl">
                      <Heart className="w-10 h-10 text-muted" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-serif font-bold text-heading">Henüz beğenen yok</h3>
                    <p className="text-sm text-muted max-w-[200px] mx-auto">Seni beğenenler burada görünecek.</p>
                  </div>
                </div>
              ) : (
                likers.map(liker => (
                  <div key={liker.id} className="bg-white rounded-[2rem] p-4 border border-black/5 shadow-sm flex items-center gap-4">
                    <div 
                      className="w-16 h-16 rounded-2xl overflow-hidden bg-black/5 flex-shrink-0 border border-black/5 cursor-pointer"
                      onClick={() => setSelectedLiker(liker.user)}
                    >
                      <img 
                        src={liker.user.social?.photos?.[0] || liker.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${liker.user.uid}`} 
                        alt="User"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 cursor-pointer" onClick={() => setSelectedLiker(liker.user)}>
                      <h4 className="font-bold text-base text-heading">{liker.user.social?.nickname || liker.user.nickname}, {liker.user.age}</h4>
                      <p className="text-xs text-rose-600 font-bold uppercase tracking-widest opacity-80">Seni beğendi!</p>
                    </div>
                    <button 
                      onClick={() => handleStartChatFromLiker(liker.user)} 
                      disabled={isProcessing}
                      className="py-3 px-6 rounded-xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 transition-all uppercase tracking-widest shadow-lg shadow-rose-500/20 disabled:opacity-50"
                    >
                      Sohbet Başlat
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
          />
        )}
      </AnimatePresence>

      {/* Profile Popup for Likers */}
      <AnimatePresence>
        {selectedLiker && (
          <SocialProfilePopup 
            user={selectedLiker}
            onClose={() => setSelectedLiker(null)}
            onCompatibilityCheck={() => {}} 
            onSendMessage={() => {}} 
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
      whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.02)" }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={`w-full p-5 flex items-center gap-4 transition-all text-left group relative border-l-2 ${
        unreadCount > 0 ? 'border-amber-500 bg-amber-500/5' : 'border-transparent'
      }`}
    >
      <div className="relative">
        <div className={`w-16 h-16 rounded-2xl overflow-hidden bg-black/5 border transition-all duration-300 ${
          unreadCount > 0 ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-black/5 group-hover:border-black/10'
        }`}>
          <img 
            src={otherUser.social?.photos?.[0] || otherUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.uid}`} 
            alt={otherUser.social?.nickname || otherUser.nickname}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        {otherUser.social?.isOnline && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-[#F6F4F8] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)]" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h3 className={`font-bold text-base truncate transition-colors ${unreadCount > 0 ? 'text-heading' : 'text-body'}`}>
            {otherUser.social?.nickname || otherUser.nickname}
          </h3>
          {chat.lastMessageAt && (
            <span className={`text-[10px] font-black whitespace-nowrap ml-2 uppercase tracking-widest ${unreadCount > 0 ? 'text-amber-600 animate-pulse' : 'text-muted'}`}>
              {format(chat.lastMessageAt.toDate?.() || new Date(), "HH:mm", { locale: tr })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isMe && (
              <div className="flex-shrink-0">
                {status === 'seen' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-amber-600" />
                ) : status === 'delivered' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-muted" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-zinc-300" />
                )}
              </div>
            )}
            <p className={`text-xs truncate transition-all ${unreadCount > 0 ? 'text-heading font-bold' : 'text-muted font-medium'}`}>
              {chat.typing?.[otherUser.uid] ? (
                <span className="text-amber-600 italic animate-pulse">Yazıyor...</span>
              ) : chat.lastMessage}
            </p>
          </div>
          {unreadCount > 0 && (
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/40"
            >
              <span className="text-[10px] font-black text-black">{unreadCount}</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function ChatDetail({ chat: initialChat, currentUser, onClose }: { chat: Chat & { otherUser: UserProfile }, currentUser: UserProfile, onClose: () => void }) {
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Sync chat doc updates (typing status, unread counts, etc.)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "chats", initialChat.id), (snap) => {
      if (snap.exists()) {
        setChat({ ...initialChat, ...snap.data() } as any);
      }
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

  // Listen for other user updates (online status)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "users", chat.otherUser.uid), (snap) => {
      if (snap.exists()) {
        setOtherUser({ uid: snap.id, ...snap.data() } as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [chat.otherUser.uid]);

  // Listen for messages and handle status updates
  useEffect(() => {
    const q = query(
      collection(db, "messages"),
      where("chatId", "==", chat.id),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));
      setMessages(msgs);
      
      // Mark as seen when chat is open
      socialService.markAsSeen(chat.id, currentUser.uid, otherUser.uid);
      
      // Mark as delivered if they were just 'sent'
      socialService.markAsDelivered(chat.id, currentUser.uid, otherUser.uid);

    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "messages");
    });

    return () => unsubscribe();
  }, [chat.id, currentUser.uid, otherUser.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || isSending) return;

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
        const type = currentMediaFile.type.startsWith('image/') ? 'image' : 'video';
        await socialService.sendMedia(chat.id, currentUser.uid, otherUser.uid, currentMediaFile, type);
      } else {
        await socialService.sendMessage(chat.id, currentUser.uid, otherUser.uid, { text: messageText });
      }
    } catch (error) {
      toast.error("Mesaj gönderilemedi.");
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

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
    // Keep focus on input
    inputRef.current?.focus();
  };

  const getPresenceText = () => {
    if (otherUser.social?.isOnline) return "Çevrimiçi";
    if (otherUser.social?.lastSeen) {
      try {
        const lastSeenDate = otherUser.social.lastSeen.toDate();
        return `Son görülme: ${formatDistanceToNow(lastSeenDate, { addSuffix: true, locale: tr })}`;
      } catch (e) {
        return "Çevrimdışı";
      }
    }
    return "Çevrimdışı";
  };

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[100] bg-[#F6F4F8] flex flex-col h-[100svh]"
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-3xl border-b border-black/5 px-4 py-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 text-muted transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setShowProfile(true)}
          >
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-black/5 border border-black/5 group-hover:border-amber-500/50 transition-all">
              <img 
                src={otherUser?.social?.photos?.[0] || otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid}`} 
                alt={otherUser?.social?.nickname || otherUser?.nickname}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="font-bold text-base text-heading group-hover:text-amber-600 transition-colors">{otherUser?.social?.nickname || otherUser?.nickname}</h2>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${otherUser.social?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-muted'}`} />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted">
                  {chat.typing?.[otherUser.uid] ? (
                    <span className="text-amber-600 animate-pulse">Yazıyor...</span>
                  ) : getPresenceText()}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowProfile(true)}
            className="p-2 rounded-full hover:bg-black/5 text-muted transition-all"
          >
            <Info className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-black/5 text-muted transition-all">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUser.uid;
          const isSystem = msg.type === 'system';
          const showAvatar = !isMe && !isSystem && (index === 0 || messages[index - 1].senderId !== msg.senderId);
          
          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-6">
                <span className="px-5 py-2 bg-black/5 rounded-full text-[10px] font-black uppercase tracking-widest text-muted border border-black/5">
                  {msg.text}
                </span>
              </div>
            );
          }

          if (msg.isDeleted && msg.deletedForEveryone) {
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-3`}>
                <div className="px-5 py-3.5 rounded-[1.5rem] text-xs italic text-muted bg-black/5 border border-black/5">
                  Bu mesaj silindi.
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-3 group/msg`}>
              {!isMe && (
                <div className="w-9 flex-shrink-0 flex items-end">
                  {showAvatar && (
                    <img 
                      src={otherUser?.social?.photos?.[0] || otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid}`} 
                      alt="avatar"
                      className="w-9 h-9 rounded-xl object-cover border border-black/10 shadow-lg"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              )}
              
              <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}>
                {/* Message Actions Menu */}
                <AnimatePresence>
                  {activeMessageId === msg.id && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      className={`absolute bottom-full mb-2 z-20 bg-white border border-black/10 rounded-2xl p-1.5 shadow-2xl flex gap-1 ${isMe ? 'right-0' : 'left-0'}`}
                    >
                      {isMe && !msg.mediaUrl && (
                        <button 
                          onClick={() => handleEditMessage(msg)}
                          className="p-2 hover:bg-black/5 rounded-xl text-muted hover:text-amber-600 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteMessage(msg, false)}
                        className="p-2 hover:bg-black/5 rounded-xl text-muted hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {isMe && (
                        <button 
                          onClick={() => handleDeleteMessage(msg, true)}
                          className="p-2 hover:bg-black/5 rounded-xl text-muted hover:text-red-500 transition-all flex items-center gap-1.5 px-3"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase">Herkesten Sil</span>
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div 
                  onClick={() => setActiveMessageId(activeMessageId === msg.id ? null : msg.id)}
                  className={`px-5 py-3.5 rounded-[1.5rem] text-sm leading-relaxed shadow-2xl cursor-pointer transition-all active:scale-[0.98] ${
                    isMe 
                      ? 'bg-amber-500 text-black rounded-br-sm shadow-amber-500/10 font-medium' 
                      : 'bg-white text-heading rounded-bl-sm border border-black/5 shadow-sm'
                  }`}
                >
                  {msg.mediaUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden bg-black/5">
                      {msg.mediaType === 'image' ? (
                        <img 
                          src={msg.mediaUrl} 
                          alt="Media" 
                          className="max-w-full max-h-64 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <video 
                          src={msg.mediaUrl} 
                          controls 
                          className="max-w-full max-h-64"
                        />
                      )}
                    </div>
                  )}
                  {msg.text}
                  {msg.editedAt && (
                    <span className={`block text-[9px] mt-1 opacity-40 italic ${isMe ? 'text-black' : 'text-muted'}`}>
                      (düzenlendi)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2 px-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted">
                    {msg.createdAt ? format(msg.createdAt.toDate(), "HH:mm", { locale: tr }) : "..."}
                  </span>
                  {isMe && (
                    <div className="flex items-center">
                      {msg.status === 'seen' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-amber-600" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-muted" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-muted" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="bg-white/80 backdrop-blur-3xl border-t border-black/5 p-4 pb-safe shrink-0 relative">
        {/* Media Preview */}
        <AnimatePresence>
          {mediaPreview && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-4 right-4 mb-4 p-4 bg-white border border-black/10 rounded-3xl shadow-2xl flex items-center gap-4"
            >
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-black/5 border border-black/5 relative">
                {mediaFile?.type.startsWith('image/') ? (
                  <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <video src={mediaPreview} className="w-full h-full object-cover" />
                )}
                <button 
                  onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                  className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-heading truncate">{mediaFile?.name}</p>
                <p className="text-[10px] text-muted uppercase tracking-widest">Gönderilmeye hazır</p>
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
              className="absolute bottom-full left-4 right-4 mb-4 p-4 bg-amber-500 border border-amber-600 rounded-3xl shadow-2xl flex items-center gap-4 text-black"
            >
              <Edit2 className="w-5 h-5" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Mesajı Düzenle</p>
                <p className="text-xs font-bold truncate">{editingMessage.text}</p>
              </div>
              <button 
                onClick={() => { setEditingMessage(null); setNewMessage(""); }}
                className="p-2 hover:bg-black/10 rounded-full transition-all"
              >
                <X className="w-4 h-4" />
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
              className="absolute bottom-full left-4 mb-4 z-[110] shadow-2xl"
            >
              <div className="rounded-2xl overflow-hidden border border-black/10 shadow-2xl">
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  theme={Theme.LIGHT}
                  emojiStyle={EmojiStyle.NATIVE}
                  lazyLoadEmojis={true}
                  searchPlaceholder="Emoji ara..."
                  width={300}
                  height={400}
                  previewConfig={{ showPreview: false }}
                  skinTonesDisabled
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSend} className="flex items-center gap-2 max-w-4xl mx-auto">
          <div className="flex items-center gap-1">
            <button 
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-3 rounded-2xl border transition-all ${
                showEmojiPicker 
                  ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' 
                  : 'bg-black/5 border-black/5 text-muted hover:text-amber-600'
              }`}
            >
              <Smile className="w-6 h-6" />
            </button>
            
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-2xl bg-black/5 border border-black/5 text-muted hover:text-amber-600 transition-all"
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
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={handleTyping}
              placeholder={editingMessage ? "Mesajı düzenle..." : "Bir şeyler yaz..."}
              className="w-full bg-black/5 border border-black/5 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-amber-500/50 transition-all text-heading placeholder:text-muted"
            />
          </div>

          <button 
            type="submit"
            disabled={(!newMessage.trim() && !mediaFile) || isSending}
            className="w-14 h-14 rounded-2xl bg-amber-500 text-black flex items-center justify-center disabled:opacity-20 disabled:grayscale transition-all shadow-xl shadow-amber-500/20 active:scale-95"
          >
            {isSending ? (
              <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <Send className="w-6 h-6 ml-1" />
            )}
          </button>
        </form>
      </div>

      {/* Profile Popup */}
      <AnimatePresence>
        {showProfile && (
          <SocialProfilePopup 
            user={otherUser}
            onClose={() => setShowProfile(false)}
            onCompatibilityCheck={() => {}}
            onSendMessage={() => setShowProfile(false)}
            context="match"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
