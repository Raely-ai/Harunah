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
import OptimizedImage from "./OptimizedImage";

export default function SocialMessagesScreen({ 
  currentUser, 
  onBack, 
  onNavigate,
  onChatOpenChange,
  isActive
}: { 
  currentUser: UserProfile, 
  onBack?: () => void, 
  onNavigate: (tab: any) => void,
  onChatOpenChange?: (isOpen: boolean) => void,
  isActive?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'chats' | 'requests' | 'likers'>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [requests, setRequests] = useState<InteractionRequestType[]>([]);
  const [likers, setLikers] = useState<{ id: string, user: UserProfile, createdAt: any }[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [selectedLiker, setSelectedLiker] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const profilesCache = useRef<Record<string, UserProfile>>({});

  // Sync chat open state with parent
  useEffect(() => {
    onChatOpenChange?.(!!selectedChat);
    if (selectedChat && currentUser.uid && isActive) {
      const otherUserId = selectedChat.participants.find(id => id !== currentUser.uid);
      if (otherUserId) {
        // Mark as seen immediately when chat is selected from list
        socialService.markAsSeen(selectedChat.id, currentUser.uid, otherUserId);
      }
    }
  }, [selectedChat, onChatOpenChange, currentUser.uid, isActive]);

  // Fetch Chats
  useEffect(() => {
    if (!currentUser.uid || !isActive) return;
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      
      // Improved sorting
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
  }, [currentUser.uid, isActive]);

  // Fetch Requests
  useEffect(() => {
    if (!currentUser.uid || !isActive) return;
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
  }, [currentUser.uid, isActive]);

  // Fetch Likers
  useEffect(() => {
    if (!currentUser.uid || !isActive) return;
    const q = query(
      collection(db, "swipes"),
      where("toUserId", "==", currentUser.uid),
      where("type", "in", ["like", "super_like"])
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const likerList = await Promise.all(snapshot.docs.map(async (swipeDoc) => {
        const swipeData = swipeDoc.data();
        const senderSnap = await getDoc(doc(db, "users", swipeData.fromUserId));
        return {
          id: swipeDoc.id,
          user: { uid: senderSnap.id, ...senderSnap.data() } as UserProfile,
          createdAt: swipeData.createdAt
        };
      }));

      // Client-side sort
      likerList.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setLikers(likerList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "swipes");
    });

    return () => unsubscribe();
  }, [currentUser.uid, isActive]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    return chats.filter(chat => {
      const otherUserId = chat.participants.find(id => id !== currentUser.uid);
      const otherUserSnapshot = chat.participantSnapshots?.[otherUserId!];
      const name = (otherUserSnapshot?.nickname || "Kullanıcı").toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    });
  }, [chats, searchQuery, currentUser.uid]);

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
        setSelectedChat({
          ...chatData,
          id: chatSnap.id
        });
      }
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("İstek kabul edilirken bir hata oluştu.");
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
        setSelectedChat({
          ...chatData,
          id: chatSnap.id
        });
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      toast.error("Sohbet başlatılırken bir hata oluştu.");
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

  // In-app notifications for new messages
  useEffect(() => {
    if (!currentUser || chats.length === 0) return;

    const chatIds = chats.map(c => c.id);
    const q = query(
      collection(db, "messages"),
      where("chatId", "in", chatIds),
      where("status", "==", "sent"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const msg = change.doc.data() as Message;
          // Only notify if it's not from me and not in the currently open chat
          if (msg.senderId !== currentUser.uid && selectedChat?.id !== msg.chatId) {
            const chat = chats.find(c => c.id === msg.chatId);
            if (chat) {
              const otherUserId = chat.participants.find(id => id !== currentUser.uid);
              const otherUserSnapshot = chat.participantSnapshots?.[otherUserId!];
              toast(otherUserSnapshot?.nickname || "Yeni Mesaj", {
                description: msg.text || (msg.mediaType === 'image' ? "📷 Fotoğraf" : "🎥 Video"),
                action: {
                  label: "Görüntüle",
                  onClick: () => setSelectedChat(chat)
                }
              });
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [chats, currentUser, selectedChat]);

  const isSocialEnabled = isSocialProfileReady(currentUser);

  if (!isSocialEnabled) {
    return (
      <div className="flex flex-col h-full bg-[#050505] text-zinc-100">
        <header className="bg-black/40 backdrop-blur-3xl border-b border-white/5 px-6 py-5 flex flex-col gap-1 z-10">
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight">Mesajlar</h1>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sohbetler, istekler ve beğeniler</p>
        </header>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <SocialDisabledView onNavigate={onNavigate} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-3xl border-b border-white/5 px-6 py-5 flex flex-col gap-1 z-10">
        <h1 className="text-2xl font-serif font-bold text-white tracking-tight">Mesajlar</h1>
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Sohbetler, istekler ve beğeniler</p>
      </header>

      {/* Tabs */}
      <div className="px-4 py-3 bg-black/20 border-b border-white/5">
        <div className="flex bg-white/[0.03] p-1 rounded-2xl border border-white/5 backdrop-blur-xl">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === 'chats' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Sohbetler
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
              activeTab === 'requests' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            İstekler
            {requests.length > 0 && (
              <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-[#050505] ${activeTab === 'requests' ? 'bg-white text-black' : 'bg-amber-500 text-black'}`}>
                {requests.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('likers')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
              activeTab === 'likers' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            Beğeniler
            {likers.length > 0 && (
              <span className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-[#050505] ${activeTab === 'likers' ? 'bg-white text-black' : 'bg-amber-500 text-black'}`}>
                {likers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar (Only for Chats) */}
      {activeTab === 'chats' && chats.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-amber-500 transition-colors" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Sohbetlerde ara..."
              className="w-full bg-white/[0.03] border border-white/5 rounded-xl py-3 pl-11 pr-4 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/30 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-white/5 text-zinc-500"
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
                    <div className="relative p-8 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-xl">
                      <MessageCircle className="w-16 h-16 text-zinc-700" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-serif font-bold text-white">
                      {searchQuery ? "Sonuç bulunamadı" : "Henüz sohbet yok"}
                    </h3>
                    <p className="text-sm text-zinc-500 max-w-[200px] mx-auto">
                      {searchQuery ? "Aramanla eşleşen bir sohbet bulamadık." : "Karşılaştığın kişilerle burada sohbet edebilirsin."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
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
                    <div className="relative w-20 h-20 rounded-[1.5rem] bg-white/[0.03] flex items-center justify-center border border-white/10 backdrop-blur-xl">
                      <UserPlus className="w-10 h-10 text-zinc-700" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-serif font-bold text-white">İstek kutun boş</h3>
                    <p className="text-sm text-zinc-500 max-w-[200px] mx-auto">Gelen mesaj ve süper like istekleri burada görünür.</p>
                  </div>
                </div>
              ) : (
                requests.map(request => (
                  <div key={request.id} className="bg-white/[0.03] rounded-[2rem] p-5 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col gap-4">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/10">
                        <img 
                          src={request.senderSnapshot.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request.fromUserId}`} 
                          alt="User"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-base text-white">{request.senderSnapshot.nickname}</h4>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                            request.type === 'message_request' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                          }`}>
                            {request.type === 'message_request' ? 'Mesaj İsteği' : 'Süper Like'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2 italic opacity-60">"Sana bir mesaj isteği gönderdi."</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                      <button 
                        onClick={() => handleRejectRequest(request.id)} 
                        disabled={isProcessing}
                        className="flex-1 py-3 rounded-xl bg-white/5 text-zinc-400 text-xs font-bold hover:bg-white/10 transition-all uppercase tracking-widest border border-white/5 disabled:opacity-50"
                      >
                        Reddet
                      </button>
                      <button 
                        onClick={() => handleAcceptRequest(request)} 
                        disabled={isProcessing}
                        className="flex-1 py-3 rounded-xl bg-amber-500 text-black text-xs font-black hover:bg-amber-600 transition-all uppercase tracking-widest shadow-lg shadow-amber-500/20 disabled:opacity-50"
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
                    <div className="relative w-20 h-20 rounded-[1.5rem] bg-white/[0.03] flex items-center justify-center border border-white/10 backdrop-blur-xl">
                      <Heart className="w-10 h-10 text-zinc-700" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-serif font-bold text-white">Henüz beğenen yok</h3>
                    <p className="text-sm text-zinc-500 max-w-[200px] mx-auto">Seni beğenenler burada görünecek.</p>
                  </div>
                </div>
              ) : (
                likers.map(liker => (
                  <div key={liker.id} className="bg-white/[0.03] rounded-[2rem] p-4 border border-white/10 backdrop-blur-xl shadow-2xl flex items-center gap-4">
                    <div 
                      className="w-16 h-16 rounded-2xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/10 cursor-pointer"
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
                      <h4 className="font-bold text-base text-white">{liker.user.social?.nickname || liker.user.nickname}, {liker.user.age}</h4>
                      <p className="text-xs text-rose-400 font-bold uppercase tracking-widest opacity-80">Seni beğendi!</p>
                    </div>
                    <button 
                      onClick={() => handleStartChatFromLiker(liker.user)} 
                      disabled={isProcessing}
                      className="py-3 px-6 rounded-xl bg-rose-500 text-white text-xs font-black hover:bg-rose-600 transition-all uppercase tracking-widest shadow-lg shadow-rose-500/20 disabled:opacity-50"
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


function ChatListItem({ chat, onClick, currentUser }: { chat: Chat, onClick: () => void, currentUser: UserProfile }) {
  const otherUserId = chat.participants.find(id => id !== currentUser.uid);
  const otherUserSnapshot = chat.participantSnapshots?.[otherUserId!];
  
  if (!otherUserId) return null;

  const unreadCount = chat.unreadCount?.[currentUser.uid] || 0;
  const isMe = chat.lastMessageSenderId === currentUser.uid;
  const status = chat.lastMessageStatus || 'sent';

  return (
    <motion.button
      whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className={`w-full p-5 flex items-center gap-4 transition-all text-left group relative border-l-2 ${
        unreadCount > 0 ? 'border-amber-500 bg-amber-500/5' : 'border-transparent'
      }`}
    >
      <div className="relative">
        <div className={`w-16 h-16 rounded-2xl overflow-hidden bg-zinc-900 border transition-all duration-300 ${
          unreadCount > 0 ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-white/10 group-hover:border-white/20'
        }`}>
          <OptimizedImage 
            src={otherUserSnapshot?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`} 
            alt={otherUserSnapshot?.nickname || "Kullanıcı"}
            className="w-full h-full object-cover"
            containerClassName="w-full h-full"
          />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h3 className={`font-bold text-base truncate transition-colors ${unreadCount > 0 ? 'text-white' : 'text-zinc-300'}`}>
            {otherUserSnapshot?.nickname || "Kullanıcı"}
          </h3>
          {chat.lastMessageAt && (
            <span className={`text-[10px] font-black whitespace-nowrap ml-2 uppercase tracking-widest ${unreadCount > 0 ? 'text-amber-500 animate-pulse' : 'text-zinc-500'}`}>
              {format(chat.lastMessageAt.toDate?.() || new Date(), "HH:mm", { locale: tr })}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isMe && (
              <div className="flex-shrink-0">
                {status === 'seen' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-amber-500" />
                ) : status === 'delivered' ? (
                  <CheckCheck className="w-3.5 h-3.5 text-zinc-500" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-zinc-700" />
                )}
              </div>
            )}
            <p className={`text-xs truncate transition-all ${unreadCount > 0 ? 'text-zinc-100 font-bold' : 'text-zinc-500 font-medium'}`}>
              {chat.typing?.[otherUserId] ? (
                <span className="text-amber-500 italic animate-pulse">Yazıyor...</span>
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

function ChatDetail({ chat: initialChat, currentUser, onClose }: { chat: Chat, currentUser: UserProfile, onClose: () => void }) {
  const [chat, setChat] = useState(initialChat);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
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

  const otherUserId = chat.participants.find(id => id !== currentUser.uid)!;
  const otherUserSnapshot = chat.participantSnapshots?.[otherUserId];

  // Sync chat doc updates (typing status, unread counts, etc.)
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "chats", initialChat.id), (snap) => {
      if (snap.exists()) {
        setChat({ id: snap.id, ...snap.data() } as Chat);
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

  // Listen for other user updates (online status) - ONLY when detail is open
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, "users", otherUserId), (snap) => {
      if (snap.exists()) {
        setOtherUser({ uid: snap.id, ...snap.data() } as UserProfile);
      }
    });
    return () => unsubscribe();
  }, [otherUserId]);

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
      
      // Mark as seen if detail is open and messages are from other user
      const hasUnseen = msgs.some(m => m.senderId === otherUserId && m.status !== 'seen');
      if (hasUnseen) {
        socialService.markAsSeen(chat.id, currentUser.uid, otherUserId);
      }
      
      // Mark as delivered if they were just 'sent'
      const hasSent = msgs.some(m => m.senderId === otherUserId && m.status === 'sent');
      if (hasSent) {
        socialService.markAsDelivered(chat.id, currentUser.uid, otherUserId);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "messages");
    });

    return () => unsubscribe();
  }, [chat.id, currentUser.uid, otherUserId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || isSending) return;

    setIsSending(true);
    const textToSend = newMessage.trim();
    setNewMessage("");
    setMediaFile(null);
    setMediaPreview(null);
    setShowEmojiPicker(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      setIsTyping(false);
      socialService.setTypingStatus(chat.id, currentUser.uid, false);
    }

    try {
      if (editingMessage) {
        await socialService.editMessage(editingMessage.id, textToSend);
        setEditingMessage(null);
      } else if (mediaFile) {
        const type = mediaFile.type.startsWith('video/') ? 'video' : 'image';
        await socialService.sendMedia(chat.id, currentUser.uid, otherUserId, mediaFile, type);
      } else {
        await socialService.sendMessage(chat.id, currentUser.uid, otherUserId, { text: textToSend });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Mesaj gönderilemedi.");
    } finally {
      setIsSending(false);
    }
  };

  const onEmojiClick = (emojiData: any) => {
    setNewMessage(prev => prev + emojiData.emoji);
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

  const getPresenceText = () => {
    if (otherUser?.social?.isOnline) return "Çevrimiçi";
    if (otherUser?.social?.lastSeen) {
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
      className="fixed inset-0 z-[100] bg-[#050505] flex flex-col h-[100svh]"
    >
      {/* Header */}
      <header className="bg-black/60 backdrop-blur-3xl border-b border-white/5 px-4 py-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-white/5 text-zinc-400 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setShowProfile(true)}
          >
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 group-hover:border-amber-500/50 transition-all">
              <OptimizedImage 
                src={otherUser?.social?.photos?.[0] || otherUserSnapshot?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUserId}`} 
                alt={otherUserSnapshot?.nickname || "Kullanıcı"}
                className="w-full h-full object-cover"
                containerClassName="w-full h-full"
              />
            </div>
            <div>
              <h2 className="font-bold text-base text-white group-hover:text-amber-500 transition-colors">{otherUserSnapshot?.nickname || "Kullanıcı"}</h2>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${otherUser?.social?.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  {chat.typing?.[otherUserId] ? (
                    <span className="text-amber-500 animate-pulse">Yazıyor...</span>
                  ) : getPresenceText()}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setShowProfile(true)}
            className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-all"
          >
            <Info className="w-5 h-5" />
          </button>
          <button className="p-2 rounded-full hover:bg-white/5 text-zinc-400 transition-all">
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
                <span className="px-5 py-2 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-white/5">
                  {msg.text}
                </span>
              </div>
            );
          }

          if (msg.isDeleted && msg.deletedForEveryone) {
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-3`}>
                <div className="px-5 py-3.5 rounded-[1.5rem] text-xs italic text-zinc-500 bg-white/[0.02] border border-white/5">
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
                      className="w-9 h-9 rounded-xl object-cover border border-white/10 shadow-lg"
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
                      className={`absolute bottom-full mb-2 z-20 bg-zinc-900 border border-white/10 rounded-2xl p-1.5 shadow-2xl flex gap-1 ${isMe ? 'right-0' : 'left-0'}`}
                    >
                      {isMe && !msg.mediaUrl && (
                        <button 
                          onClick={() => handleEditMessage(msg)}
                          className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-amber-500 transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteMessage(msg, false)}
                        className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {isMe && (
                        <button 
                          onClick={() => handleDeleteMessage(msg, true)}
                          className="p-2 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-red-500 transition-all flex items-center gap-1.5 px-3"
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
                      : 'bg-white/5 text-zinc-200 rounded-bl-sm border border-white/10 backdrop-blur-xl'
                  }`}
                >
                  {msg.mediaUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden bg-black/20">
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
                    <span className={`block text-[9px] mt-1 opacity-40 italic ${isMe ? 'text-black' : 'text-zinc-400'}`}>
                      (düzenlendi)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2 px-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                    {msg.createdAt ? format(msg.createdAt.toDate(), "HH:mm", { locale: tr }) : "..."}
                  </span>
                  {isMe && (
                    <div className="flex items-center">
                      {msg.status === 'seen' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-amber-500" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-zinc-700" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-zinc-800" />
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
      <div className="bg-black/40 backdrop-blur-3xl border-t border-white/5 p-4 pb-safe shrink-0 relative">
        {/* Media Preview */}
        <AnimatePresence>
          {mediaPreview && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-4 right-4 mb-4 p-4 bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl flex items-center gap-4"
            >
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-black border border-white/10 relative">
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
                <p className="text-xs font-bold text-white truncate">{mediaFile?.name}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Gönderilmeye hazır</p>
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
              <div className="rounded-2xl overflow-hidden border border-white/10">
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  theme={Theme.DARK}
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

        <form onSubmit={handleSendMessage} className="flex items-center gap-2 max-w-4xl mx-auto">
          <div className="flex items-center gap-1">
            <button 
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-3 rounded-2xl border transition-all ${
                showEmojiPicker 
                  ? 'bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20' 
                  : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:text-amber-500'
              }`}
            >
              <Smile className="w-6 h-6" />
            </button>
            
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 text-zinc-500 hover:text-amber-500 transition-all"
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
              className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-amber-500/50 transition-all text-white placeholder:text-zinc-600"
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
