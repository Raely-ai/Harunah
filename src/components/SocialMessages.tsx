import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Heart, 
  MessageSquare, 
  UserPlus, 
  Check, 
  X, 
  MoreVertical,
  Search,
  ChevronRight,
  Clock
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
  deleteDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { 
  SocialProfile, 
  SocialChat, 
  FriendshipRequest, 
  Friendship,
  Match
} from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import SocialChatScreen from './SocialChatScreen';

type Tab = 'matches' | 'friends' | 'requests';

const SocialMessages: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('matches');
  const [chats, setChats] = useState<SocialChat[]>([]);
  const [matches, setMatches] = useState<(Match & { profile: SocialProfile })[]>([]);
  const [friends, setFriends] = useState<(Friendship & { profile: SocialProfile, chat?: SocialChat })[]>([]);
  const [requests, setRequests] = useState<(FriendshipRequest & { profile: SocialProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const uid = auth.currentUser.uid;

    // Listen to matches
    const matchesQuery = query(
      collection(db, "matches"),
      where("uids", "array-contains", uid),
      orderBy("createdAt", "desc")
    );

    const unsubMatches = onSnapshot(matchesQuery, async (snapshot) => {
      const matchData = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data() as Match;
        const otherUid = data.uids.find(id => id !== uid);
        if (!otherUid) return null;
        
        const profileDoc = await getDoc(doc(db, "socialProfiles", otherUid));
        if (!profileDoc.exists()) return null;
        
        return { ...data, profile: profileDoc.data() as SocialProfile };
      }));
      
      const filtered = matchData.filter(Boolean) as (Match & { profile: SocialProfile })[];
      // Deduplicate by id
      const unique = Array.from(new Map(filtered.map(m => [m.id, m])).values());
      setMatches(unique);
    });

    // Listen to friendship requests
    const requestsQuery = query(
      collection(db, "friendshipRequests"),
      where("toUid", "==", uid),
      where("status", "==", "pending"),
      orderBy("timestamp", "desc")
    );

    const unsubRequests = onSnapshot(requestsQuery, async (snapshot) => {
      const requestData = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data() as FriendshipRequest;
        const profileDoc = await getDoc(doc(db, "socialProfiles", data.fromUid));
        if (!profileDoc.exists()) return null;
        
        return { ...data, profile: profileDoc.data() as SocialProfile };
      }));
      
      const filtered = requestData.filter(Boolean) as (FriendshipRequest & { profile: SocialProfile })[];
      // Deduplicate by id
      const unique = Array.from(new Map(filtered.map(r => [r.id, r])).values());
      setRequests(unique);
    });

    // Listen to friendships
    const friendshipsQuery = query(
      collection(db, "friendships"),
      where("uids", "array-contains", uid),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );

    const unsubFriendships = onSnapshot(friendshipsQuery, async (snapshot) => {
      const friendshipData = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data() as Friendship;
        const otherUid = data.uids.find(id => id !== uid);
        if (!otherUid) return null;
        
        const profileDoc = await getDoc(doc(db, "socialProfiles", otherUid));
        if (!profileDoc.exists()) return null;
        
        return { ...data, profile: profileDoc.data() as SocialProfile };
      }));
      
      const filtered = friendshipData.filter(Boolean) as (Friendship & { profile: SocialProfile })[];
      // Deduplicate by id
      const unique = Array.from(new Map(filtered.map(f => [f.id, f])).values());
      setFriends(unique);
    });

    // Listen to all chats
    const chatsQuery = query(
      collection(db, "socialChats"),
      where("uids", "array-contains", uid),
      orderBy("lastMessageAt", "desc")
    );

    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      const chatData = snapshot.docs.map(d => d.data() as SocialChat);
      setChats(Array.from(new Map(chatData.map(c => [c.id, c])).values()));
      setLoading(false);
    });

    return () => {
      unsubMatches();
      unsubRequests();
      unsubFriendships();
      unsubChats();
    };
  }, []);

  const handleAcceptRequest = async (request: FriendshipRequest) => {
    if (!auth.currentUser) return;
    try {
      const friendshipId = [request.fromUid, request.toUid].sort().join('_');
      
      // Update request status
      await updateDoc(doc(db, "friendshipRequests", request.id), {
        status: 'accepted'
      });

      // Create friendship
      const newFriendship: Friendship = {
        id: friendshipId,
        uids: [request.fromUid, request.toUid],
        status: 'active',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, "friendships", friendshipId), newFriendship);

      // Create chat
      const newChat: SocialChat = {
        id: friendshipId,
        uids: [request.fromUid, request.toUid],
        type: 'friend',
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        lastMessageText: '',
        lastMessageSenderId: '',
        unreadCount: {
          [request.fromUid]: 0,
          [request.toUid]: 0
        },
        metadata: {
          friendshipId: friendshipId
        }
      };
      await setDoc(doc(db, "socialChats", friendshipId), newChat);

      toast.success("Arkadaşlık isteği kabul edildi!");
    } catch (error) {
      console.error("Accept request error:", error);
      toast.error("İşlem başarısız oldu.");
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, "friendshipRequests", requestId), {
        status: 'rejected'
      });
      toast.success("İstek reddedildi.");
    } catch (error) {
      console.error("Reject request error:", error);
      toast.error("İşlem başarısız oldu.");
    }
  };

  const getChatForMatch = (matchId: string) => {
    return chats.find(c => c.metadata?.matchId === matchId);
  };

  const getChatForFriend = (friendshipId: string) => {
    return chats.find(c => c.metadata?.friendshipId === friendshipId);
  };

  const filteredMatches = matches.filter(m => 
    m.profile.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFriends = friends.filter(f => 
    f.profile.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRequests = requests.filter(r => 
    r.profile.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedChatId) {
    return <SocialChatScreen chatId={selectedChatId} onBack={() => setSelectedChatId(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-zinc-50/50">
      {/* Header */}
      <div className="p-6 bg-white border-b border-zinc-100">
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight mb-6">Mesajlar</h2>
        
        {/* Search */}
        <div className="relative mb-6 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-zinc-900 transition-colors" />
          <input
            type="text"
            placeholder="Mesajlarda veya kişilerde ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-zinc-50 border border-zinc-100 rounded-2xl text-sm focus:bg-white focus:ring-2 focus:ring-zinc-900/5 focus:border-zinc-900 transition-all outline-none"
          />
        </div>

        {/* Tabs */}
        <div className="flex p-1.5 bg-zinc-100 rounded-2xl">
          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'matches' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${activeTab === 'matches' ? 'fill-current' : ''}`} />
            Eşleşmeler
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all ${
              activeTab === 'friends' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Arkadaşlar
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all relative ${
              activeTab === 'requests' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            İstekler
            {requests.length > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 bg-zinc-900 text-white text-[10px] font-bold rounded-full border-2 border-white">
                {requests.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'matches' && (
              <motion.div
                key="matches"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {filteredMatches.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-zinc-200">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-8 h-8 text-zinc-200" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">Eşleşme Yok</h3>
                    <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-2">Keşfet'e git ve yeni insanlarla tanışmaya başla!</p>
                  </div>
                ) : (
                  filteredMatches.map((match) => {
                    const chat = getChatForMatch(match.id);
                    return (
                      <button
                        key={match.id}
                        onClick={() => setSelectedChatId(match.id)}
                        className="w-full flex items-center gap-4 p-4 bg-white rounded-[2rem] border border-zinc-100 hover:border-zinc-900 transition-all group shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 hover:-translate-y-0.5 active:scale-[0.98]"
                      >
                        <div className="relative">
                          <img
                            src={match.profile.photoURL || `https://ui-avatars.com/api/?name=${match.profile.nickname}`}
                            alt={match.profile.nickname}
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
                          />
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-zinc-900 tracking-tight">{match.profile.nickname}</h3>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                              {chat?.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Yeni'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 line-clamp-1 font-medium">
                            {chat?.lastMessageText || 'Yeni bir eşleşme! İlk mesajı sen at.'}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:text-zinc-900 group-hover:bg-zinc-100 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </button>
                    );
                  })
                )}
              </motion.div>
            )}

            {activeTab === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {filteredFriends.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-zinc-200">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-zinc-200" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">Arkadaş Yok</h3>
                    <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-2">Henüz kimseyle arkadaş olmadın.</p>
                  </div>
                ) : (
                  filteredFriends.map((friend) => {
                    const chat = getChatForFriend(friend.id);
                    return (
                      <button
                        key={friend.id}
                        onClick={() => setSelectedChatId(friend.id)}
                        className="w-full flex items-center gap-4 p-4 bg-white rounded-[2rem] border border-zinc-100 hover:border-zinc-900 transition-all group shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 hover:-translate-y-0.5 active:scale-[0.98]"
                      >
                        <img
                          src={friend.profile.photoURL || `https://ui-avatars.com/api/?name=${friend.profile.nickname}`}
                          alt={friend.profile.nickname}
                          className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-sm"
                        />
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-zinc-900 tracking-tight">{friend.profile.nickname}</h3>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                              {chat?.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 line-clamp-1 font-medium">
                            {chat?.lastMessageText || 'Sohbeti başlat...'}
                          </p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-300 group-hover:text-zinc-900 group-hover:bg-zinc-100 transition-all">
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </button>
                    );
                  })
                )}
              </motion.div>
            )}

            {activeTab === 'requests' && (
              <motion.div
                key="requests"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {filteredRequests.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-zinc-200">
                    <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <UserPlus className="w-8 h-8 text-zinc-200" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900">İstek Yok</h3>
                    <p className="text-zinc-500 text-sm max-w-xs mx-auto mt-2">Bekleyen arkadaşlık isteği bulunmuyor.</p>
                  </div>
                ) : (
                  filteredRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center gap-4 p-5 bg-white rounded-[2rem] border border-zinc-100 shadow-sm"
                    >
                      <img
                        src={request.profile.photoURL || `https://ui-avatars.com/api/?name=${request.profile.nickname}`}
                        alt={request.profile.nickname}
                        className="w-14 h-14 rounded-2xl object-cover shadow-sm"
                      />
                      <div className="flex-1">
                        <h3 className="font-bold text-zinc-900 tracking-tight">{request.profile.nickname}</h3>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">Arkadaşlık İsteği</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="w-10 h-10 rounded-xl bg-zinc-50 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 transition-all flex items-center justify-center active:scale-90"
                        >
                          <X className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleAcceptRequest(request)}
                          className="w-10 h-10 rounded-xl bg-zinc-900 text-white shadow-lg shadow-zinc-900/20 hover:bg-zinc-800 transition-all flex items-center justify-center active:scale-90"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default SocialMessages;
