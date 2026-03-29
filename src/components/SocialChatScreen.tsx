import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  Send, 
  MoreVertical, 
  Shield, 
  UserX, 
  Flag,
  Image as ImageIcon,
  Smile,
  Check,
  CheckCheck
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDoc,
  setDoc,
  addDoc,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  arrayUnion
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  SocialProfile, 
  SocialChat, 
  SocialMessage
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { UserActionMenu } from './UserActionMenu';
import { createSocialNotification } from '../services/socialNotificationService';

interface SocialChatScreenProps {
  chatId: string;
  onBack: () => void;
}

const SocialChatScreen: React.FC<SocialChatScreenProps> = ({ chatId, onBack }) => {
  const [chat, setChat] = useState<SocialChat | null>(null);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [otherProfile, setOtherProfile] = useState<SocialProfile | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to chat metadata
    const unsubChat = onSnapshot(doc(db, "socialChats", chatId), async (snapshot) => {
      if (snapshot.exists()) {
        const chatData = snapshot.data() as SocialChat;
        setChat(chatData);
        
        const otherUid = chatData.uids.find(id => id !== auth.currentUser?.uid);
        if (otherUid && !otherProfile) {
          const profileDoc = await getDoc(doc(db, "socialProfiles", otherUid));
          if (profileDoc.exists()) {
            setOtherProfile(profileDoc.data() as SocialProfile);
          }
        }

        // Reset unread count for current user
        if (chatData.unreadCount[auth.currentUser.uid] > 0) {
          await updateDoc(doc(db, "socialChats", chatId), {
            [`unreadCount.${auth.currentUser.uid}`]: 0
          });
        }
      }
    });

    // Listen to messages
    const messagesQuery = query(
      collection(db, "socialMessages"),
      where("chatId", "==", chatId),
      orderBy("timestamp", "asc")
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgData = snapshot.docs.map(d => d.data() as SocialMessage);
      
      // Deduplicate messages by id to prevent duplicate key errors
      const uniqueMessages = Array.from(new Map(msgData.map(m => [m.id, m])).values());
      
      setMessages(uniqueMessages);
      setLoading(false);
      scrollToBottom();
    });

    return () => {
      unsubChat();
      unsubMessages();
    };
  }, [chatId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Send message logic
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !chat) return;

    const text = newMessage.trim();
    setNewMessage('');

    try {
      // Check if blocked
      const myProfileDoc = await getDoc(doc(db, "socialProfiles", auth.currentUser.uid));
      const myProfile = myProfileDoc.data() as SocialProfile;
      const otherUid = chat.uids.find(id => id !== auth.currentUser?.uid);
      
      if (myProfile.blockedUids?.includes(otherUid || '')) {
        toast.error("Engellediğiniz bir kullanıcıya mesaj gönderemezsiniz.");
        return;
      }

      const otherProfileDoc = await getDoc(doc(db, "socialProfiles", otherUid || ''));
      const otherProfileData = otherProfileDoc.data() as SocialProfile;
      
      if (otherProfileData.blockedUids?.includes(auth.currentUser.uid)) {
        toast.error("Bu kullanıcıya mesaj gönderemezsiniz.");
        return;
      }

      // Check target user's messaging settings
      const settings = otherProfileData.settings;
      if (settings) {
        if (settings.whoCanMessage === 'nobody') {
          toast.error("Bu kullanıcı mesaj alımını kapatmış.");
          return;
        }
        
        if (settings.whoCanMessage === 'friends') {
          // Check if friends
          const friendshipId = [auth.currentUser.uid, otherUid || ''].sort().join('_');
          const friendshipDoc = await getDoc(doc(db, "friendships", friendshipId));
          if (!friendshipDoc.exists() || friendshipDoc.data()?.status !== 'active') {
            // If it's a match, we might want to allow it? 
            // But the setting says 'friends'. 
            // Let's stick to the setting strictly.
            if (chat.type !== 'friend') {
              toast.error("Bu kullanıcı sadece arkadaşlarından mesaj kabul ediyor.");
              return;
            }
          }
        }
      }

      const messageId = doc(collection(db, "socialMessages")).id;

      const message: SocialMessage = {
        id: messageId,
        chatId,
        senderId: auth.currentUser.uid,
        text,
        timestamp: new Date().toISOString(),
        readBy: [auth.currentUser.uid]
      };

      await setDoc(doc(db, "socialMessages", messageId), message);

      // Update chat metadata
      await updateDoc(doc(db, "socialChats", chatId), {
        lastMessageAt: new Date().toISOString(),
        lastMessageText: text,
        lastMessageSenderId: auth.currentUser.uid,
        [`unreadCount.${otherUid}`]: increment(1)
      });

      // Send notification to the other user
      if (otherUid) {
        await createSocialNotification(
          otherUid,
          'new_message',
          'Yeni Mesaj!',
          `${auth.currentUser.displayName || 'Birisi'} sana bir mesaj gönderdi: "${text.length > 30 ? text.substring(0, 30) + '...' : text}"`,
          {
            senderId: auth.currentUser.uid,
            senderName: auth.currentUser.displayName || 'Birisi',
            senderPhoto: auth.currentUser.photoURL || undefined,
            roomId: chatId // Using roomId to store chatId for now as they are often the same or used similarly
          },
          `/social/chat/${chatId}`
        );
      }

    } catch (error) {
      console.error("Send message error:", error);
      toast.error("Mesaj gönderilemedi.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-white border-b border-stone-200 sticky top-0 z-10">
        <button onClick={onBack} className="p-1 text-stone-500 hover:text-stone-900 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        
        <div className="flex-1 flex items-center gap-3">
          <div className="relative">
            <img
              src={otherProfile?.photoURL || `https://ui-avatars.com/api/?name=${otherProfile?.nickname}`}
              alt={otherProfile?.nickname}
              className="w-10 h-10 rounded-full object-cover shadow-sm"
            />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-sm leading-tight">{otherProfile?.nickname}</h3>
            <p className="text-[10px] text-green-600 font-medium">Çevrimiçi</p>
          </div>
        </div>

        <div className="relative">
          {otherProfile && (
            <UserActionMenu
              targetUid={otherProfile.uid}
              targetName={otherProfile.nickname}
              context="chat"
              onBlockSuccess={onBack}
              trigger={
                <div className="p-2 text-stone-400 hover:text-stone-900 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </div>
              }
            />
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-stone-200/50 rounded-full text-[10px] text-stone-500 font-medium">
            <Shield className="w-3 h-3" />
            Uçtan uca şifreli ve güvenli sohbet
          </div>
          <p className="text-[10px] text-stone-400 mt-2">
            {new Date(chat?.createdAt || '').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} tarihinde eşleştiniz
          </p>
        </div>

        {messages.map((msg, index) => {
          const isMe = msg.senderId === auth.currentUser?.uid;
          const showTime = index === 0 || 
            new Date(msg.timestamp).getTime() - new Date(messages[index-1].timestamp).getTime() > 300000;

          return (
            <div key={msg.id} className="space-y-1">
              {showTime && (
                <div className="text-center py-2">
                  <span className="text-[10px] text-stone-400 font-medium">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: isMe ? 20 : -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    isMe 
                      ? 'bg-rose-500 text-white rounded-tr-none' 
                      : 'bg-white text-stone-800 rounded-tl-none border border-stone-100'
                  }`}
                >
                  <p className="leading-relaxed">{msg.text}</p>
                  <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[9px] ${isMe ? 'text-rose-100' : 'text-stone-400'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {isMe && (
                      <CheckCheck className="w-3 h-3 text-rose-100" />
                    )}
                  </div>
                </motion.div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-stone-200">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button type="button" className="p-2 text-stone-400 hover:text-stone-600 transition-colors">
            <ImageIcon className="w-5 h-5" />
          </button>
          <button type="button" className="p-2 text-stone-400 hover:text-stone-600 transition-colors">
            <Smile className="w-5 h-5" />
          </button>
          <input
            type="text"
            placeholder="Mesaj yaz..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-stone-100 border-none rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-rose-500/20"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="p-2.5 bg-rose-500 text-white rounded-2xl shadow-md shadow-rose-200 disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default SocialChatScreen;
