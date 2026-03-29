import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Users, MessageSquare, Send, Mic, MicOff, MoreVertical, 
  UserPlus, Shield, Gift, Flag, Ban, LogOut, Heart, Sparkles,
  ChevronDown, Crown, Star, Info, Coffee, Zap, Rocket, Wallet
} from "lucide-react";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  doc, collection, query, where, onSnapshot, orderBy, 
  addDoc, serverTimestamp, updateDoc, deleteDoc, getDoc, setDoc,
  increment, arrayUnion, runTransaction, getDocs
} from "firebase/firestore";
import { SocialRoom, SocialRoomMember, SocialMessage, SocialProfile, UserProfile, SocialGiftTransaction } from "../types";
import { toast } from "sonner";
import { SOCIAL_GIFTS, GIFT_REVENUE_DISTRIBUTION } from "../constants/social";
import { ReportModal } from "./ReportModal";
import { createSocialNotification } from "../services/socialNotificationService";

interface SocialRoomViewProps {
  room: SocialRoom;
  userProfile: UserProfile | null;
  onLeave: () => void;
  onViewProfile: (profile: SocialProfile) => void;
}

export default function SocialRoomView({ room, userProfile, onLeave, onViewProfile }: SocialRoomViewProps) {
  const [members, setMembers] = useState<SocialRoomMember[]>([]);
  const [messages, setMessages] = useState<SocialMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [myMember, setMyMember] = useState<SocialRoomMember | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<SocialRoomMember | null>(null);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friends, setFriends] = useState<SocialProfile[]>([]);
  const [giftRecipient, setGiftRecipient] = useState<SocialRoomMember | null>(null);
  const [isSendingGift, setIsSendingGift] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to members
    const membersQuery = query(
      collection(db, "socialRoomMembers"),
      where("roomId", "==", room.id)
    );

    const unsubMembers = onSnapshot(membersQuery, (snapshot) => {
      const memberData = snapshot.docs.map(doc => doc.data() as SocialRoomMember);
      
      // Deduplicate members by uid to prevent duplicate key errors
      const uniqueMembers = Array.from(new Map(memberData.map(m => [m.uid, m])).values());
      
      setMembers(uniqueMembers);
      const me = uniqueMembers.find(m => m.uid === auth.currentUser?.uid);
      if (me) setMyMember(me);
    });

    // Listen to messages (using socialMessages with chatId = room.id)
    const messagesQuery = query(
      collection(db, "socialMessages"),
      where("chatId", "==", room.id),
      orderBy("timestamp", "asc")
    );

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgData = snapshot.docs.map(doc => doc.data() as SocialMessage);
      
      // Deduplicate messages by id to prevent duplicate key errors
      const uniqueMessages = Array.from(new Map(msgData.map(m => [m.id, m])).values());
      
      setMessages(uniqueMessages);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => {
      unsubMembers();
      unsubMessages();
    };
  }, [room.id]);

  useEffect(() => {
    if (!showInviteModal || !auth.currentUser) return;

    const fetchFriends = async () => {
      try {
        const uid = auth.currentUser!.uid;
        const q = query(
          collection(db, "friendships"),
          where("uids", "array-contains", uid),
          where("status", "==", "active")
        );
        const snapshot = await getDocs(q);
        const friendProfiles = await Promise.all(snapshot.docs.map(async (d) => {
          const otherUid = d.data().uids.find((id: string) => id !== uid);
          const pDoc = await getDoc(doc(db, "socialProfiles", otherUid));
          return pDoc.exists() ? pDoc.data() as SocialProfile : null;
        }));
        
        const filtered = friendProfiles.filter(Boolean) as SocialProfile[];
        // Deduplicate by uid
        const unique = Array.from(new Map(filtered.map(f => [f.uid, f])).values());
        setFriends(unique);
      } catch (error) {
        console.error("Fetch friends error:", error);
      }
    };

    fetchFriends();
  }, [showInviteModal]);

  const handleInvite = async (friendId: string, friendName: string) => {
    if (!auth.currentUser) return;

    try {
      await createSocialNotification(
        friendId,
        'room_invite',
        'Oda Daveti!',
        `${auth.currentUser.displayName || 'Birisi'} seni "${room.name}" odasına davet etti.`,
        {
          senderId: auth.currentUser.uid,
          senderName: auth.currentUser.displayName || 'Birisi',
          roomId: room.id,
          roomName: room.name
        },
        `/social/room/${room.id}`
      );
      toast.success(`${friendName} davet edildi!`);
    } catch (error) {
      console.error("Invite error:", error);
      toast.error("Davet gönderilemedi.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser || !myMember) return;
    if (myMember.isMuted) {
      toast.error("Susturuldunuz, mesaj gönderemezsiniz.");
      return;
    }

    const text = newMessage.trim();
    setNewMessage('');

    try {
      const messageId = doc(collection(db, "socialMessages")).id;
      await setDoc(doc(db, "socialMessages", messageId), {
        id: messageId,
        chatId: room.id,
        senderId: auth.currentUser.uid,
        text,
        timestamp: new Date().toISOString(),
        readBy: [auth.currentUser.uid]
      });

      // Update room last active (optional)
      await updateDoc(doc(db, "socialRooms", room.id), {
        lastMessageAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Send message error:", error);
      toast.error("Mesaj gönderilemedi.");
    }
  };

  const handleLeaveRoom = async () => {
    if (!auth.currentUser) return;
    try {
      const memberId = `${room.id}_${auth.currentUser.uid}`;
      await deleteDoc(doc(db, "socialRoomMembers", memberId));
      
      // Update room member count
      await updateDoc(doc(db, "socialRooms", room.id), {
        memberCount: increment(-1)
      });

      onLeave();
    } catch (error) {
      console.error("Leave room error:", error);
      onLeave();
    }
  };

  const handleAction = async (action: string, member: SocialRoomMember) => {
    if (!auth.currentUser || !myMember) return;

    try {
      switch (action) {
        case 'view_profile':
          const profileDoc = await getDoc(doc(db, "socialProfiles", member.uid));
          if (profileDoc.exists()) {
            onViewProfile(profileDoc.data() as SocialProfile);
          }
          break;
        case 'send_gift':
          if (!room.isDonationEnabled) {
            toast.error("Bu odada hediye gönderimi kapalıdır.");
            return;
          }
          setGiftRecipient(member);
          setShowGiftModal(true);
          break;
        case 'add_friend':
          // Add friendship request logic
          await addDoc(collection(db, "friendshipRequests"), {
            fromUid: auth.currentUser.uid,
            toUid: member.uid,
            status: 'pending',
            timestamp: new Date().toISOString(),
            message: `${myMember.nickname} seni arkadaş olarak eklemek istiyor.`
          });
          toast.success("Arkadaşlık isteği gönderildi.");
          break;
        case 'mute':
          if (myMember.role !== 'host') return;
          await updateDoc(doc(db, "socialRoomMembers", member.id), {
            isMuted: !member.isMuted
          });
          toast.success(member.isMuted ? "Sesi açıldı." : "Susturuldu.");
          break;
        case 'kick':
          if (myMember.role !== 'host') return;
          await deleteDoc(doc(db, "socialRoomMembers", member.id));
          await updateDoc(doc(db, "socialRooms", room.id), {
            memberCount: increment(-1)
          });
          toast.success("Kullanıcı odadan çıkarıldı.");
          break;
        case 'report':
          setShowReportModal(true);
          break;
      }
    } catch (error) {
      console.error("Action error:", error);
      toast.error("İşlem başarısız oldu.");
    }
    setSelectedMember(null);
  };

  const handleSendGift = async (gift: typeof SOCIAL_GIFTS[0]) => {
    if (!auth.currentUser || !userProfile || !giftRecipient) return;
    
    if (userProfile.credits < gift.price) {
      toast.error("Yetersiz bakiye. Lütfen cüzdanınızdan yükleme yapın.");
      return;
    }

    setIsSendingGift(true);
    try {
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, "users", auth.currentUser!.uid);
        const receiverRef = doc(db, "socialProfiles", giftRecipient.uid);
        const hostRef = doc(db, "socialProfiles", room.hostUid);
        
        const senderDoc = await transaction.get(senderRef);
        if (!senderDoc.exists() || senderDoc.data().credits < gift.price) {
          throw new Error("Yetersiz bakiye.");
        }

        // Calculate shares
        const receiverShare = (gift.price * GIFT_REVENUE_DISTRIBUTION.RECEIVER_PERCENT) / 100;
        const hostShare = (gift.price * GIFT_REVENUE_DISTRIBUTION.HOST_PERCENT) / 100;
        const platformShare = (gift.price * GIFT_REVENUE_DISTRIBUTION.PLATFORM_PERCENT) / 100;

        // Deduct from sender
        transaction.update(senderRef, {
          credits: increment(-gift.price)
        });

        // Add to receiver
        transaction.update(receiverRef, {
          withdrawableBalance: increment(receiverShare),
          totalEarnings: increment(receiverShare)
        });

        // Add to host (if different from receiver)
        if (room.hostUid !== giftRecipient.uid) {
          transaction.update(hostRef, {
            withdrawableBalance: increment(hostShare),
            totalEarnings: increment(hostShare)
          });
        } else {
          // If host is the receiver, they get both shares? 
          // Usually host share is for the room owner. If owner is receiver, they get both.
          transaction.update(hostRef, {
            withdrawableBalance: increment(hostShare),
            totalEarnings: increment(hostShare)
          });
        }

        // Create Gift Transaction Record
        const giftTxId = doc(collection(db, "socialGiftTransactions")).id;
        const giftTx: SocialGiftTransaction = {
          id: giftTxId,
          senderId: auth.currentUser!.uid,
          receiverId: giftRecipient.uid,
          hostId: room.hostUid,
          roomId: room.id,
          giftId: gift.id,
          giftName: gift.name,
          giftValue: gift.price,
          receiverShare,
          hostShare,
          platformShare,
          timestamp: new Date().toISOString()
        };
        transaction.set(doc(db, "socialGiftTransactions", giftTxId), giftTx);

        // Create Social Transaction for sender
        const senderTxId = doc(collection(db, "socialTransactions")).id;
        transaction.set(doc(db, "socialTransactions", senderTxId), {
          id: senderTxId,
          uid: auth.currentUser!.uid,
          type: 'gift_sent',
          amount: gift.price,
          balanceType: 'main',
          description: `${giftRecipient.nickname} kullanıcısına ${gift.name} gönderildi.`,
          timestamp: new Date().toISOString(),
          metadata: {
            toUid: giftRecipient.uid,
            roomId: room.id,
            giftId: gift.id
          }
        });

        // Create Social Transaction for receiver
        const receiverTxId = doc(collection(db, "socialTransactions")).id;
        transaction.set(doc(db, "socialTransactions", receiverTxId), {
          id: receiverTxId,
          uid: giftRecipient.uid,
          type: 'gift_received',
          amount: receiverShare,
          balanceType: 'withdrawable',
          description: `${myMember?.nickname} kullanıcısından ${gift.name} alındı.`,
          timestamp: new Date().toISOString(),
          metadata: {
            fromUid: auth.currentUser!.uid,
            roomId: room.id,
            giftId: gift.id
          }
        });

        // Create Social Transaction for host (if different)
        if (room.hostUid !== auth.currentUser!.uid && room.hostUid !== giftRecipient.uid) {
          const hostTxId = doc(collection(db, "socialTransactions")).id;
          transaction.set(doc(db, "socialTransactions", hostTxId), {
            id: hostTxId,
            uid: room.hostUid,
            type: 'room_earning',
            amount: hostShare,
            balanceType: 'withdrawable',
            description: `Odanızda gönderilen ${gift.name} hediyesinden komisyon alındı.`,
            timestamp: new Date().toISOString(),
            metadata: {
              fromUid: auth.currentUser!.uid,
              toUid: giftRecipient.uid,
              roomId: room.id,
              giftId: gift.id
            }
          });
        }

        // Add message to chat
        const messageId = doc(collection(db, "socialMessages")).id;
        transaction.set(doc(db, "socialMessages", messageId), {
          id: messageId,
          chatId: room.id,
          senderId: 'system',
          text: `🎁 ${myMember?.nickname}, ${giftRecipient.nickname} kullanıcısına ${gift.icon} ${gift.name} gönderdi!`,
          timestamp: new Date().toISOString(),
          readBy: []
        });

        // Send notification to recipient
        createSocialNotification(
          giftRecipient.uid,
          'gift_received',
          'Yeni Bir Hediye!',
          `${myMember?.nickname || 'Birisi'} sana ${gift.icon} ${gift.name} gönderdi!`,
          {
            senderId: auth.currentUser?.uid,
            senderName: myMember?.nickname || 'Birisi',
            senderPhoto: auth.currentUser?.photoURL || undefined,
            giftId: gift.id,
            roomId: room.id
          },
          `/social/room/${room.id}`
        );
      });

      toast.success(`${gift.name} başarıyla gönderildi!`);
      setShowGiftModal(false);
    } catch (error) {
      console.error("Gift send error:", error);
      toast.error(error instanceof Error ? error.message : "Hediye gönderilemedi.");
    } finally {
      setIsSendingGift(false);
    }
  };

  const speakers = members.filter(m => m.role === 'host' || m.role === 'speaker');
  const listeners = members.filter(m => m.role === 'listener');

  return (
    <div className="fixed inset-0 z-50 bg-stone-50 flex flex-col md:flex-row overflow-hidden">
      {/* Main Content (Stage & Chat) */}
      <div className="flex-1 flex flex-col h-full relative">
        {/* Header */}
        <div className="p-4 bg-white border-b border-stone-200 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button onClick={handleLeaveRoom} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
              <LogOut className="w-5 h-5 text-stone-500" />
            </button>
            <div>
              <h2 className="font-bold text-stone-900 flex items-center gap-2">
                {room.name}
                {room.isPrivate && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
              </h2>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {members.length} kişi
                </span>
                <span className="w-1 h-1 bg-stone-300 rounded-full" />
                <span className="text-amber-600 font-medium">{room.type}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowInviteModal(true)}
              className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
              title="Arkadaşlarını Davet Et"
            >
              <UserPlus className="w-5 h-5 text-stone-600" />
            </button>
            <button 
              onClick={() => setShowMembers(!showMembers)}
              className="p-2 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors relative"
            >
              <Users className="w-5 h-5 text-stone-600" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {members.length}
              </span>
            </button>
            <button 
              onClick={() => {
                if (!room.isDonationEnabled) {
                  toast.error("Bu odada bağışlar kapalıdır.");
                  return;
                }
                // Default recipient is host if not selected
                const host = members.find(m => m.role === 'host');
                if (host) setGiftRecipient(host);
                setShowGiftModal(true);
              }}
              className={`p-2 rounded-xl transition-colors ${room.isDonationEnabled ? 'bg-amber-100 hover:bg-amber-200 text-amber-600' : 'bg-stone-100 text-stone-300 cursor-not-allowed'}`}
              title={room.isDonationEnabled ? "Hediye Gönder" : "Bağışlar Kapalı"}
            >
              <Gift className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stage Area */}
        <div className="p-6 bg-stone-900 text-white flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-stone-400 flex items-center gap-2">
              <Crown className="w-3 h-3 text-amber-500" /> Konuşmacılar
            </h3>
            <button className="text-xs font-bold text-amber-500 hover:underline">Söz İste</button>
          </div>
          
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-6">
            {speakers.map(speaker => (
              <div key={speaker.uid} className="flex flex-col items-center gap-2 group relative">
                <button 
                  onClick={() => setSelectedMember(speaker)}
                  className="relative"
                >
                  <div className={`w-16 h-16 rounded-3xl overflow-hidden border-2 transition-all group-hover:scale-105 ${
                    speaker.role === 'host' ? 'border-amber-500 shadow-lg shadow-amber-500/20' : 'border-stone-700'
                  }`}>
                    <img 
                      src={speaker.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${speaker.uid}`} 
                      alt={speaker.nickname}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {speaker.isMuted && (
                    <div className="absolute -bottom-1 -right-1 p-1 bg-red-500 rounded-lg border-2 border-stone-900">
                      <MicOff className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {speaker.role === 'host' && (
                    <div className="absolute -top-2 -left-2 p-1 bg-amber-500 rounded-lg border-2 border-stone-900">
                      <Crown className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
                <span className="text-xs font-bold text-stone-300 truncate w-full text-center">
                  {speaker.nickname}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0 bg-white">
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2">
                <MessageSquare className="w-12 h-12 opacity-20" />
                <p className="text-sm">Sohbeti başlatmak için bir şeyler yaz...</p>
              </div>
            ) : (
              messages.map((msg, i) => {
                const sender = members.find(m => m.uid === msg.senderId);
                const isMe = msg.senderId === auth.currentUser?.uid;
                
                return (
                  <div key={msg.id} className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <img 
                      src={sender?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderId}`} 
                      className="w-8 h-8 rounded-xl flex-shrink-0"
                    />
                    <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      {!isMe && <span className="text-[10px] font-bold text-stone-500 mb-1 ml-1">{sender?.nickname}</span>}
                      <div className={`p-3 rounded-2xl text-sm ${
                        isMe ? 'bg-stone-900 text-white rounded-tr-none' : 'bg-stone-100 text-stone-800 rounded-tl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-stone-100 bg-white">
            <div className="flex items-center gap-2 bg-stone-100 p-2 rounded-2xl">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder={myMember?.isMuted ? "Susturuldunuz..." : "Mesaj yaz..."}
                disabled={myMember?.isMuted}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm p-2"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || myMember?.isMuted}
                className="p-2 bg-stone-900 text-white rounded-xl disabled:opacity-50 transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Members Sidebar (Desktop) or Modal (Mobile) */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute md:relative inset-y-0 right-0 w-full md:w-80 bg-white border-l border-stone-200 z-20 shadow-2xl md:shadow-none"
          >
            <div className="p-4 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-stone-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Katılımcılar ({members.length})
              </h3>
              <button onClick={() => setShowMembers(false)} className="p-2 hover:bg-stone-100 rounded-full">
                <X className="w-5 h-5 text-stone-500" />
              </button>
            </div>
            <div className="overflow-y-auto h-full pb-20 p-2 space-y-1 custom-scrollbar">
              <div className="px-3 py-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Host & Konuşmacılar</div>
              {speakers.map(member => (
                <button
                  key={member.uid}
                  onClick={() => setSelectedMember(member)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-2xl transition-all group"
                >
                  <div className="relative">
                    <img src={member.photoURL} className="w-10 h-10 rounded-xl" />
                    {member.role === 'host' && <Crown className="absolute -top-1 -left-1 w-4 h-4 text-amber-500 fill-amber-500" />}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-stone-800">{member.nickname}</p>
                    <p className="text-[10px] text-stone-500 capitalize">{member.role}</p>
                  </div>
                  {member.isMuted && <MicOff className="w-4 h-4 text-red-400" />}
                </button>
              ))}
              
              <div className="px-3 py-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-4">Dinleyiciler</div>
              {listeners.map(member => (
                <button
                  key={member.uid}
                  onClick={() => setSelectedMember(member)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-stone-50 rounded-2xl transition-all group"
                >
                  <img src={member.photoURL} className="w-10 h-10 rounded-xl" />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-bold text-stone-800">{member.nickname}</p>
                    <p className="text-[10px] text-stone-500">Dinleyici</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Member Action Modal */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-xs overflow-hidden shadow-2xl"
            >
              <div className="p-6 text-center border-b border-stone-100">
                <img 
                  src={selectedMember.photoURL} 
                  className="w-20 h-20 rounded-3xl mx-auto mb-4 border-4 border-stone-50 shadow-lg" 
                />
                <h3 className="text-lg font-bold text-stone-900">{selectedMember.nickname}</h3>
                <p className="text-xs text-stone-500 capitalize">{selectedMember.role}</p>
              </div>
              <div className="p-2 grid grid-cols-2 gap-1">
                <button 
                  onClick={() => handleAction('view_profile', selectedMember)}
                  className="flex flex-col items-center gap-2 p-4 hover:bg-stone-50 rounded-2xl transition-all"
                >
                  <Info className="w-5 h-5 text-blue-500" />
                  <span className="text-[10px] font-bold text-stone-600">Profil</span>
                </button>
                {selectedMember.uid !== auth.currentUser?.uid && room.isDonationEnabled && (
                  <button 
                    onClick={() => handleAction('send_gift', selectedMember)}
                    className="flex flex-col items-center gap-2 p-4 hover:bg-stone-50 rounded-2xl transition-all"
                  >
                    <Gift className="w-5 h-5 text-amber-500" />
                    <span className="text-[10px] font-bold text-stone-600">Hediye</span>
                  </button>
                )}
                {selectedMember.uid !== auth.currentUser?.uid && (
                  <>
                    <button 
                      onClick={() => handleAction('add_friend', selectedMember)}
                      className="flex flex-col items-center gap-2 p-4 hover:bg-stone-50 rounded-2xl transition-all"
                    >
                      <UserPlus className="w-5 h-5 text-green-500" />
                      <span className="text-[10px] font-bold text-stone-600">Ekle</span>
                    </button>
                    <button 
                      onClick={() => handleAction('report', selectedMember)}
                      className="flex flex-col items-center gap-2 p-4 hover:bg-stone-50 rounded-2xl transition-all"
                    >
                      <Flag className="w-5 h-5 text-orange-500" />
                      <span className="text-[10px] font-bold text-stone-600">Şikayet</span>
                    </button>
                  </>
                )}
                {myMember?.role === 'host' && selectedMember.uid !== auth.currentUser?.uid && (
                  <>
                    <button 
                      onClick={() => handleAction('mute', selectedMember)}
                      className="flex flex-col items-center gap-2 p-4 hover:bg-stone-50 rounded-2xl transition-all"
                    >
                      {selectedMember.isMuted ? <Mic className="w-5 h-5 text-amber-500" /> : <MicOff className="w-5 h-5 text-amber-500" />}
                      <span className="text-[10px] font-bold text-stone-600">{selectedMember.isMuted ? 'Sesi Aç' : 'Sustur'}</span>
                    </button>
                    <button 
                      onClick={() => handleAction('kick', selectedMember)}
                      className="flex flex-col items-center gap-2 p-4 hover:bg-stone-50 rounded-2xl transition-all"
                    >
                      <Ban className="w-5 h-5 text-red-500" />
                      <span className="text-[10px] font-bold text-stone-600">At</span>
                    </button>
                  </>
                )}
              </div>
              <button 
                onClick={() => setSelectedMember(null)}
                className="w-full py-4 text-sm font-bold text-stone-400 hover:text-stone-600 transition-all"
              >
                Kapat
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Report Modal */}
      {showReportModal && selectedMember && (
        <ReportModal
          targetUid={selectedMember.uid}
          targetName={selectedMember.nickname}
          context="room"
          onClose={() => {
            setShowReportModal(false);
            setSelectedMember(null);
          }}
        />
      )}
      {/* Gift Modal */}
      <AnimatePresence>
        {showGiftModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-stone-900">Hediye Gönder</h3>
                    <p className="text-sm text-stone-500 mt-1">
                      {giftRecipient ? `${giftRecipient.nickname} kullanıcısına hediye gönderiyorsun` : 'Alıcı seçilmedi'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowGiftModal(false)}
                    className="w-10 h-10 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Recipient Selection if not fixed */}
                <div className="mb-8">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3 block px-1">Alıcı Seç</label>
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {members.map(m => (
                      <button
                        key={m.uid}
                        onClick={() => setGiftRecipient(m)}
                        className={`flex-shrink-0 flex flex-col items-center gap-2 p-2 rounded-2xl border-2 transition-all ${
                          giftRecipient?.uid === m.uid ? 'border-amber-500 bg-amber-50' : 'border-stone-50 bg-stone-50'
                        }`}
                      >
                        <img src={m.photoURL} className="w-10 h-10 rounded-xl" />
                        <span className="text-[10px] font-bold text-stone-600 max-w-[60px] truncate">{m.nickname}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {SOCIAL_GIFTS.map(gift => (
                    <button
                      key={gift.id}
                      disabled={isSendingGift}
                      onClick={() => handleSendGift(gift)}
                      className="group p-4 rounded-3xl bg-stone-50 border border-stone-100 hover:border-amber-500 hover:bg-amber-50 transition-all flex flex-col items-center gap-2 relative overflow-hidden"
                    >
                      <div className="text-3xl group-hover:scale-125 transition-transform duration-500">{gift.icon}</div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-stone-900">{gift.name}</p>
                        <p className="text-[10px] font-bold text-amber-600">{gift.price} Kredi</p>
                      </div>
                      {isSendingGift && (
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-8 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
                      <Wallet className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Bakiyen</p>
                      <p className="text-sm font-bold text-stone-900">{userProfile?.credits || 0} Kredi</p>
                    </div>
                  </div>
                  <button className="text-[10px] font-bold text-amber-600 uppercase tracking-widest hover:underline">Yükle</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Invite Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-stone-900">Arkadaşlarını Davet Et</h3>
                <button onClick={() => setShowInviteModal(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                {friends.length === 0 ? (
                  <div className="text-center py-8 text-stone-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Henüz arkadaşın yok.</p>
                  </div>
                ) : (
                  friends.map(friend => (
                    <div key={friend.uid} className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 border border-stone-100">
                      <div className="flex items-center gap-3">
                        <img 
                          src={friend.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.uid}`} 
                          className="w-10 h-10 rounded-xl"
                        />
                        <span className="font-bold text-stone-900">{friend.nickname}</span>
                      </div>
                      <button 
                        onClick={() => handleInvite(friend.uid, friend.nickname)}
                        className="px-4 py-2 bg-stone-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-stone-800 transition-colors"
                      >
                        Davet Et
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
