import React, { useState, useEffect, useRef } from "react";
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
  X
} from "lucide-react";
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
  setDoc,
  getDocs
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile } from "../types";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { toast } from "sonner";

interface Chat {
  id: string;
  participants: string[];
  lastMessage: string;
  lastMessageAt: any;
  unreadCount?: number;
  otherUser?: UserProfile;
}

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: any;
  seen: boolean;
  type: 'text' | 'system';
}

interface InteractionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: 'message_request' | 'super_like';
  messagePreview?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
  fromUser?: UserProfile;
}

interface Liker {
  uid: string;
  swipeId: string;
  user: UserProfile;
  createdAt: any;
}

export default function SocialMessagesScreen({ currentUser, onNavigate }: { currentUser: UserProfile, onNavigate: (tab: any) => void }) {
  const [activeTab, setActiveTab] = useState<'chats' | 'requests' | 'likers'>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [requests, setRequests] = useState<InteractionRequest[]>([]);
  const [likers, setLikers] = useState<Liker[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch Chats
  useEffect(() => {
    const q = query(
      collection(db, "chats"),
      where("participants", "array-contains", currentUser.uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const chatList: Chat[] = [];
      for (const chatDoc of snapshot.docs) {
        const data = chatDoc.data();
        const otherUserId = data.participants.find((id: string) => id !== currentUser.uid);
        
        // Fetch other user profile
        const userDoc = await getDoc(doc(db, "users", otherUserId));
        const otherUser = userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } as UserProfile : undefined;

        chatList.push({
          id: chatDoc.id,
          ...data,
          otherUser
        } as Chat);
      }
      setChats(chatList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "chats");
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Fetch Requests
  useEffect(() => {
    const q = query(
      collection(db, "interactionRequests"),
      where("toUserId", "==", currentUser.uid),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requestList: InteractionRequest[] = [];
      for (const reqDoc of snapshot.docs) {
        const data = reqDoc.data();
        const userDoc = await getDoc(doc(db, "users", data.fromUserId));
        const fromUser = userDoc.exists() ? { uid: userDoc.id, ...userDoc.data() } as UserProfile : undefined;

        requestList.push({
          id: reqDoc.id,
          ...data,
          fromUser
        } as InteractionRequest);
      }
      setRequests(requestList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "interactionRequests");
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Fetch Likers
  useEffect(() => {
    const q = query(
      collection(db, "swipes"),
      where("toUserId", "==", currentUser.uid),
      where("type", "==", "like"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const likerList: Liker[] = [];
      for (const swipeDoc of snapshot.docs) {
        const data = swipeDoc.data();
        
        // Check if already matched
        const reverseSwipeQ = query(
          collection(db, "swipes"),
          where("fromUserId", "==", currentUser.uid),
          where("toUserId", "==", data.fromUserId)
        );
        const reverseSnapshot = await getDocs(reverseSwipeQ);
        
        if (reverseSnapshot.empty) {
          const userDoc = await getDoc(doc(db, "users", data.fromUserId));
          if (userDoc.exists()) {
            likerList.push({
              uid: data.fromUserId,
              swipeId: swipeDoc.id,
              user: { uid: userDoc.id, ...userDoc.data() } as UserProfile,
              createdAt: data.createdAt
            });
          }
        }
      }
      setLikers(likerList);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "swipes");
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  const handleAcceptRequest = async (request: InteractionRequest) => {
    try {
      await updateDoc(doc(db, "interactionRequests", request.id), {
        status: 'accepted'
      });

      const matchId = [currentUser.uid, request.fromUserId].sort().join('_');
      
      // Create match
      const matchDoc = await getDoc(doc(db, "matches", matchId));
      if (!matchDoc.exists()) {
        await setDoc(doc(db, "matches", matchId), {
          userIds: [currentUser.uid, request.fromUserId],
          createdAt: serverTimestamp()
        });
      }

      // Create chat
      const chatDoc = await getDoc(doc(db, "chats", matchId));
      if (!chatDoc.exists()) {
        await setDoc(doc(db, "chats", matchId), {
          id: matchId,
          participants: [currentUser.uid, request.fromUserId],
          createdAt: serverTimestamp(),
          lastMessage: request.type === 'super_like' ? "Süper Like kabul edildi! ✨" : "Mesaj isteği kabul edildi! 👋",
          lastMessageAt: serverTimestamp(),
          status: 'active'
        });

        await addDoc(collection(db, "messages"), {
          chatId: matchId,
          senderId: "system",
          text: request.type === 'super_like' ? "Süper Like kabul edildi! Sohbet başlayabilir." : "Mesaj isteği kabul edildi! Sohbet başlayabilir.",
          createdAt: serverTimestamp(),
          seen: false,
          type: 'system'
        });

        if (request.type === 'message_request' && request.messagePreview) {
          await addDoc(collection(db, "messages"), {
            chatId: matchId,
            senderId: request.fromUserId,
            text: request.messagePreview,
            createdAt: serverTimestamp(),
            seen: false,
            type: 'text'
          });
        }
      }

      toast.success("İstek kabul edildi! Sohbetler bölümünden yazışabilirsiniz.");
    } catch (error) {
      toast.error("Bir hata oluştu.");
      handleFirestoreError(error, OperationType.UPDATE, `interactionRequests/${request.id}`);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "interactionRequests", requestId), {
        status: 'rejected'
      });
      toast.success("İstek reddedildi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `interactionRequests/${requestId}`);
    }
  };

  const handleLikeBack = async (liker: Liker) => {
    try {
      await addDoc(collection(db, "swipes"), {
        fromUserId: currentUser.uid,
        toUserId: liker.uid,
        type: 'like',
        createdAt: serverTimestamp()
      });

      const chatId = [currentUser.uid, liker.uid].sort().join('_');
      await setDoc(doc(db, "chats", chatId), {
        id: chatId,
        participants: [currentUser.uid, liker.uid],
        createdAt: serverTimestamp(),
        lastMessage: "Yeni eşleşme! 👋",
        lastMessageAt: serverTimestamp(),
        status: 'active'
      });

      await addDoc(collection(db, "messages"), {
        chatId,
        senderId: "system",
        text: "Yeni eşleşme! Sohbet başlayabilir.",
        createdAt: serverTimestamp(),
        seen: false,
        type: 'system'
      });

      toast.success("Eşleşme sağlandı! Sohbetler bölümünden yazışabilirsiniz.");
    } catch (error) {
      toast.error("Bir hata oluştu.");
      handleFirestoreError(error, OperationType.CREATE, "swipes");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex flex-col gap-1 z-10">
        <h1 className="text-2xl font-serif font-bold text-slate-900">Mesajlar</h1>
        <p className="text-xs font-medium text-slate-500">Sohbetler, istekler ve beğeniler.</p>
      </header>

      {/* Tabs */}
      <div className="px-4 py-3 bg-white border-b border-slate-100">
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
          <button 
            onClick={() => setActiveTab('chats')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all ${
              activeTab === 'chats' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Sohbetler
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all ${
              activeTab === 'requests' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            İstekler
            {requests.length > 0 && (
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${activeTab === 'requests' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                {requests.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('likers')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-bold transition-all ${
              activeTab === 'likers' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            Beğenenler
            {likers.length > 0 && (
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${activeTab === 'likers' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>
                {likers.length}
              </span>
            )}
          </button>
        </div>
      </div>

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
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                </div>
              ) : chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center space-y-4">
                  <div className="p-6 rounded-full bg-indigo-50 border border-indigo-100">
                    <MessageCircle className="w-12 h-12 text-indigo-300" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-900">Henüz sohbet yok</h3>
                    <p className="text-sm text-slate-500">Eşleştiğin kişilerle burada sohbet edebilirsin.</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 bg-white">
                  {chats.map(chat => (
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
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                    <UserPlus className="w-8 h-8 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">İstek kutun boş</h3>
                    <p className="text-sm text-slate-500 mt-1">Gelen mesaj ve süper like istekleri burada görünür.</p>
                  </div>
                </div>
              ) : (
                requests.map(request => (
                  <div key={request.id} className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex flex-col gap-3">
                    <div className="flex gap-4">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0">
                        <img 
                          src={request.fromUser?.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${request.fromUserId}`} 
                          alt="User"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-sm text-slate-900">{request.fromUser?.nickname}, {request.fromUser?.age}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            request.type === 'super_like' ? 'text-amber-600 bg-amber-50' : 'text-indigo-600 bg-indigo-50'
                          }`}>
                            {request.type === 'super_like' ? 'Süper Like' : 'Mesaj İsteği'}
                          </span>
                        </div>
                        {request.type === 'super_like' && (
                          <p className="text-xs text-amber-600 font-medium mb-1">"Bu kişi sana güçlü bir ilgi gönderdi. Tanımak ister misin?"</p>
                        )}
                        {request.messagePreview && (
                          <p className="text-xs text-slate-500 line-clamp-2 italic">"{request.messagePreview}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                      <button onClick={() => handleRejectRequest(request.id)} className="flex-1 py-2 rounded-xl bg-slate-50 text-slate-500 text-xs font-bold hover:bg-slate-100 transition-colors">
                        Reddet
                      </button>
                      <button onClick={() => handleAcceptRequest(request)} className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
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
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                    <Heart className="w-8 h-8 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Henüz beğenen yok</h3>
                    <p className="text-sm text-slate-500 mt-1">Seni beğenenler burada görünecek.</p>
                  </div>
                </div>
              ) : (
                likers.map(liker => (
                  <div key={liker.swipeId} className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0">
                      <img 
                        src={liker.user.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${liker.uid}`} 
                        alt="User"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-sm text-slate-900">{liker.user.nickname}, {liker.user.age}</h4>
                      <p className="text-xs text-slate-500">Seni beğendi!</p>
                    </div>
                    <button onClick={() => handleLikeBack(liker)} className="py-2 px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200">
                      Beğen
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
    </div>
  );
}


function ChatListItem({ chat, onClick, currentUser }: { chat: Chat, onClick: () => void, currentUser: UserProfile }) {
  const otherUser = chat.otherUser;
  if (!otherUser) return null;

  // Simulate unread count for demo purposes (in a real app, this would be tracked in DB)
  const isUnread = chat.lastMessageAt && chat.lastMessageAt.toMillis() > Date.now() - 1000 * 60 * 60 * 24; // Just a mock condition

  return (
    <motion.button
      whileHover={{ backgroundColor: "rgba(248, 250, 252, 1)" }}
      onClick={onClick}
      className="w-full p-4 flex items-center gap-4 transition-colors text-left"
    >
      <div className="relative">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
          <img 
            src={otherUser.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser.uid}`} 
            alt={otherUser.nickname}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        {isUnread && (
          <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-indigo-500 border-2 border-white rounded-full shadow-sm" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h3 className={`font-bold text-sm truncate ${isUnread ? 'text-slate-900' : 'text-slate-700'}`}>
            {otherUser.nickname}
          </h3>
          {chat.lastMessageAt && (
            <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-2">
              {format(chat.lastMessageAt.toDate(), "HH:mm", { locale: tr })}
            </span>
          )}
        </div>
        <p className={`text-xs truncate ${isUnread ? 'text-indigo-600 font-semibold' : 'text-slate-500 font-medium'}`}>
          {chat.lastMessage}
        </p>
      </div>
    </motion.button>
  );
}

function ChatDetail({ chat, currentUser, onClose }: { chat: Chat, currentUser: UserProfile, onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const otherUser = chat.otherUser;

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
      
      // Mark as seen
      msgs.forEach(msg => {
        if (msg.senderId !== currentUser.uid && !msg.seen) {
          updateDoc(doc(db, "messages", msg.id), { seen: true }).catch(err => {
            handleFirestoreError(err, OperationType.UPDATE, `messages/${msg.id}`);
          });
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "messages");
    });

    return () => unsubscribe();
  }, [chat.id, currentUser.uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const messageText = newMessage.trim();
    setNewMessage("");

    try {
      await addDoc(collection(db, "messages"), {
        chatId: chat.id,
        senderId: currentUser.uid,
        text: messageText,
        createdAt: serverTimestamp(),
        seen: false,
        type: 'text'
      });

      await updateDoc(doc(db, "chats", chat.id), {
        lastMessage: messageText,
        lastMessageAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "messages");
    }
  };

  return (
    <motion.div 
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
              <img 
                src={otherUser?.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid}`} 
                alt={otherUser?.nickname}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">{otherUser?.nickname}</h2>
              <p className="text-[10px] font-medium text-slate-400">Çevrimiçi</p>
            </div>
          </div>
        </div>
        
        <button className="p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
          <MoreVertical className="w-5 h-5" />
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === currentUser.uid;
          const isSystem = msg.type === 'system';
          const showAvatar = !isMe && !isSystem && (index === 0 || messages[index - 1].senderId !== msg.senderId);

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <span className="px-4 py-1.5 bg-slate-200/50 rounded-full text-[10px] font-bold text-slate-500">
                  {msg.text}
                </span>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
              {!isMe && (
                <div className="w-8 flex-shrink-0 flex items-end">
                  {showAvatar && (
                    <img 
                      src={otherUser?.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid}`} 
                      alt="avatar"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              )}
              
              <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`px-4 py-2.5 rounded-2xl text-sm ${
                    isMe 
                      ? 'bg-indigo-600 text-white rounded-br-sm shadow-sm shadow-indigo-600/20' 
                      : 'bg-white text-slate-800 rounded-bl-sm border border-slate-100 shadow-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <div className="flex items-center gap-1 mt-1 px-1">
                  <span className="text-[9px] font-medium text-slate-400">
                    {msg.createdAt ? format(msg.createdAt.toDate(), "HH:mm", { locale: tr }) : "..."}
                  </span>
                  {isMe && (
                    msg.seen ? <CheckCheck className="w-3 h-3 text-indigo-500" /> : <Check className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100 pb-safe">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Mesaj yaz..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-5 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-900 placeholder:text-slate-400"
          />
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:opacity-50 disabled:bg-slate-200 disabled:text-slate-400 transition-all shadow-sm shadow-indigo-600/20"
          >
            <Send className="w-5 h-5 ml-1" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}
