import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Filter, 
  Heart, 
  MessageCircle, 
  Zap, 
  Star, 
  ChevronRight, 
  ChevronLeft,
  X, 
  MapPin, 
  Info,
  ShieldAlert,
  MoreHorizontal,
  UserPlus,
  Sparkles,
  ArrowRight,
  User,
  Wallet,
  Compass,
  Coins
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  limit, 
  getDocs, 
  startAfter, 
  DocumentData, 
  QueryDocumentSnapshot,
  addDoc,
  serverTimestamp,
  setDoc,
  doc
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { UserProfile } from "../types";
import { calculateCompatibility, CompatibilityScores } from "../lib/compatibilityEngine";
import { toast } from "sonner";
import { Send } from "lucide-react";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface SocialDiscoverScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  onBack?: () => void;
}

export default function SocialDiscoverScreen({ currentUser, onNavigate, onBack }: SocialDiscoverScreenProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [featuredUsers, setFeaturedUsers] = useState<UserProfile[]>([]);
  const [compatibleUsers, setCompatibleUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInitialUsers();
  }, []);

  const fetchInitialUsers = async () => {
    setLoading(true);
    try {
      // Query for social users
      // Note: In a real app, we might need a composite index for these filters
      const usersRef = collection(db, "users");
      
      // Basic filters
      let q = query(
        usersRef,
        where("socialEnabled", "==", true),
        where("socialProfileCompleted", "==", true),
        where("socialVisible", "==", true),
        limit(40) // Fetch more initially to distribute between sections
      );

      // Gender filter (opposite gender)
      if (currentUser.gender) {
        const targetGender = currentUser.gender === "Erkek" ? "Kadın" : "Erkek";
        q = query(q, where("gender", "==", targetGender));
      }

      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "users");
        return;
      }
      const allFetched = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== currentUser.uid); // Filter self on client

      // Distribute users
      // 1. Featured (those with photos or just first 5)
      setFeaturedUsers(allFetched.slice(0, 8));
      
      // 2. Compatible (calculate on client for now, or just pick some)
      const compatible = allFetched
        .slice(8, 14)
        .sort((a, b) => {
          const scoreA = calculateCompatibility(currentUser, a).understanding;
          const scoreB = calculateCompatibility(currentUser, b).understanding;
          return scoreB - scoreA;
        });
      setCompatibleUsers(compatible);

      // 3. Main Grid
      setUsers(allFetched.slice(14, 34));
      
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      if (snapshot.docs.length < 40) {
        setHasMore(false);
      }

    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMoreUsers = async () => {
    if (!lastDoc || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const usersRef = collection(db, "users");
      let q = query(
        usersRef,
        where("socialEnabled", "==", true),
        where("socialProfileCompleted", "==", true),
        where("socialVisible", "==", true),
        startAfter(lastDoc),
        limit(20)
      );

      if (currentUser.gender) {
        const targetGender = currentUser.gender === "Erkek" ? "Kadın" : "Erkek";
        q = query(q, where("gender", "==", targetGender));
      }

      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "users");
        return;
      }
      const newUsers = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== currentUser.uid);

      setUsers(prev => [...prev, ...newUsers]);
      
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      
      if (snapshot.docs.length < 20) {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error fetching more users:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      fetchMoreUsers();
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-bold text-slate-900 leading-tight">Sosyal</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Senin için seçilen enerjiler.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('wallet')}
            className="px-4 py-2 rounded-2xl bg-white border border-slate-100 flex items-center gap-2 text-indigo-600 shadow-sm"
          >
            <Coins className="w-4 h-4" />
            <span className="text-sm font-bold">{currentUser.credits}</span>
          </motion.button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32" onScroll={handleScroll}>
        {loading && users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-400 font-medium italic">Yıldızlar hizalanıyor...</p>
          </div>
        ) : (
          <div className="space-y-10 py-8">
          {/* A) Featured Users (Horizontal Scroll) */}
          <section className="space-y-4">
            <div className="px-6 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Öne Çıkanlar</h2>
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            </div>
            <div className="flex overflow-x-auto gap-5 px-6 no-scrollbar pb-2">
              {featuredUsers.map((user) => (
                <motion.button
                  key={user.uid}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedUser(user)}
                  className="flex-shrink-0 flex flex-col items-center gap-3"
                >
                  <div className="relative p-1 rounded-full bg-gradient-to-tr from-indigo-400 to-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                    <div className="w-16 h-16 rounded-full border-2 border-white overflow-hidden bg-slate-50">
                      <img 
                        src={user.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        alt={user.nickname}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    {user.subscription?.status === 'active' && (
                      <div className="absolute -bottom-1 -right-1 bg-amber-400 rounded-full p-1 border-2 border-white shadow-sm">
                        <Star className="w-2.5 h-2.5 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-slate-700 truncate w-16 text-center">
                    {user.nickname}
                  </span>
                </motion.button>
              ))}
            </div>
          </section>

          {/* B) Main Grid (First 10) */}
          <section className="px-6 grid grid-cols-2 gap-5">
            {users.slice(0, 10).map((user) => (
              <UserCard 
                key={user.uid} 
                user={user} 
                currentUser={currentUser}
                onClick={() => setSelectedUser(user)} 
              />
            ))}
          </section>

          {/* C) Compatible Section (Horizontal Card) */}
          <section className="px-6">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-[2.5rem] p-8 border border-indigo-100/50 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Sparkles className="w-32 h-32 text-indigo-600" />
              </div>
              
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-white text-indigo-600 shadow-sm">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-serif font-bold text-slate-900">Enerjinle Uyumlu Olanlar</h2>
                    <p className="text-xs text-slate-500 font-medium">Sana en yakın frekanstaki ruhlar</p>
                  </div>
                </div>
                
                <div className="flex overflow-x-auto gap-5 no-scrollbar py-2">
                  {compatibleUsers.map((user) => {
                    const scores = calculateCompatibility(currentUser, user);
                    return (
                      <motion.button
                        key={user.uid}
                        whileHover={{ y: -4 }}
                        onClick={() => setSelectedUser(user)}
                        className="flex-shrink-0 w-44 bg-white rounded-3xl p-4 border border-slate-100 space-y-4 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="relative">
                          <img 
                            src={user.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                            alt={user.nickname}
                            className="w-full aspect-square rounded-2xl object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-lg">
                            %{scores.understanding}
                          </div>
                        </div>
                        <div className="text-left space-y-1">
                          <p className="font-bold text-sm text-slate-900 truncate">{user.nickname}</p>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                              <span className="text-[10px] font-bold text-rose-600">%{scores.love}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <UserPlus className="w-3 h-3 text-blue-500 fill-blue-500" />
                              <span className="text-[10px] font-bold text-blue-600">%{scores.friendship}</span>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">{user.zodiacSign} • {user.age} Yaş</p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                
                <button className="w-full py-4 rounded-2xl bg-white border border-indigo-100 text-sm font-bold text-indigo-600 flex items-center justify-center gap-2 hover:bg-indigo-50/50 transition-colors shadow-sm">
                  Tümünü Gör <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>

          {/* D) More Grid items */}
          <section className="px-6 grid grid-cols-2 gap-5">
            {users.slice(10).map((user) => (
              <UserCard 
                key={user.uid} 
                user={user} 
                currentUser={currentUser}
                onClick={() => setSelectedUser(user)} 
              />
            ))}
          </section>

          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          )}
          
          {!hasMore && users.length > 0 && (
            <div className="text-center py-12 text-slate-400 text-sm font-medium italic">
              Tüm yıldızlar keşfedildi ✨
            </div>
          )}
        </div>
      )}
      </div>

      {/* User Profile Preview Modal */}
      <AnimatePresence>
        {selectedUser && (
          <UserProfilePreview 
            user={selectedUser} 
            currentUser={currentUser}
            onClose={() => setSelectedUser(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function UserCard({ user, currentUser, onClick }: { user: UserProfile, currentUser: UserProfile, onClick: () => void }) {
  const scores = calculateCompatibility(currentUser, user);
  
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative group aspect-[3/4] rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-sm"
    >
      <img 
        src={user.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
        alt={user.nickname}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-white truncate">{user.nickname}, {user.age}</h3>
            {user.subscription?.status === 'active' && (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            )}
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
              {user.lookingFor === 'aşk' ? '❤️ Aşk' : user.lookingFor === 'dostluk' ? '🤝 Dostluk' : '💬 Sohbet'}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/40 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
              %{scores.understanding} Uyum
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function UserProfilePreview({ user, currentUser, onClose }: { user: UserProfile, currentUser: UserProfile, onClose: () => void }) {
  const scores = calculateCompatibility(currentUser, user);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleLike = async () => {
    try {
      await addDoc(collection(db, "swipes"), {
        fromUserId: currentUser.uid,
        toUserId: user.uid,
        type: 'like',
        createdAt: serverTimestamp()
      });
      toast.success("Beğenildi! Karşılık gelirse eşleşeceksiniz.");
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "swipes");
    }
  };

  const handleSuperLike = async () => {
    try {
      await addDoc(collection(db, "interactionRequests"), {
        fromUserId: currentUser.uid,
        toUserId: user.uid,
        type: 'super_like',
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success("Süper Like gönderildi! ✨");
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "interactionRequests");
    }
  };

  const handleSendMessageRequest = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "interactionRequests"), {
        fromUserId: currentUser.uid,
        toUserId: user.uid,
        type: 'message_request',
        messagePreview: message.trim(),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      toast.success("Mesaj isteği gönderildi! 👋");
      setShowMessageModal(false);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "interactionRequests");
    } finally {
      setSending(false);
    }
  };
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-6"
      >
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="w-full max-w-lg bg-white rounded-t-[40px] sm:rounded-[40px] overflow-hidden flex flex-col max-h-[90vh] border border-slate-100 shadow-2xl"
        >
          {/* Top Image Section */}
          <div className="relative h-[40vh] flex-shrink-0">
            <img 
              src={user.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              alt={user.nickname}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
            
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full bg-white/40 backdrop-blur-md border border-white/10 text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="absolute bottom-6 left-8 right-8">
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-serif font-bold text-slate-900">{user.nickname}, {user.age}</h2>
                {user.subscription?.status === 'active' && (
                  <div className="px-3 py-1 rounded-full bg-amber-400 text-white text-[10px] font-black uppercase tracking-wider">
                    PREMIUM
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-500 mt-1">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">Yakınlarda • {user.zodiacSign} Burcu</span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 no-scrollbar">
            {/* Compatibility Scores */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center space-y-1">
                <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                <p className="text-[10px] text-slate-400 uppercase font-bold">Aşk</p>
                <p className="text-xl font-serif font-bold text-rose-600">%{scores.love}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center space-y-1">
                <UserPlus className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                <p className="text-[10px] text-slate-400 uppercase font-bold">Dostluk</p>
                <p className="text-xl font-serif font-bold text-indigo-600">%{scores.friendship}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center space-y-1">
                <Sparkles className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <p className="text-[10px] text-slate-400 uppercase font-bold">Uyum</p>
                <p className="text-xl font-serif font-bold text-amber-600">%{scores.understanding}</p>
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Hakkında</h3>
              <p className="text-slate-600 leading-relaxed italic">
                "{user.bio || "Henüz bir biyografi eklenmemiş."}"
              </p>
            </div>

            {/* Interests */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">İlgi Alanları</h3>
              <div className="flex flex-wrap gap-2">
                {user.interests?.map((interest, idx) => (
                  <span 
                    key={idx}
                    className="px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-600 font-medium"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Element</p>
                <p className="text-sm font-medium text-slate-900">{user.element || "Bilinmiyor"}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-1">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Yönetici Gezegen</p>
                <p className="text-sm font-medium text-slate-900">{user.rulingPlanet || "Bilinmiyor"}</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-8 bg-white border-t border-slate-100 flex gap-4">
            <button 
              onClick={() => setShowMessageModal(true)}
              className="flex-1 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center gap-2 font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <MessageCircle className="w-5 h-5 text-indigo-500" />
              Mesaj
            </button>
            <button 
              onClick={handleLike}
              className="flex-1 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center gap-2 font-bold shadow-lg shadow-indigo-600/20"
            >
              <Heart className="w-5 h-5 fill-white" />
              Beğen
            </button>
            <button 
              onClick={handleSuperLike}
              className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/20"
            >
              <Zap className="w-6 h-6 text-white fill-white" />
            </button>
          </div>
        </motion.div>
      </motion.div>

      {/* Message Request Modal */}
      <AnimatePresence>
        {showMessageModal && (
          <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-white rounded-[32px] border border-slate-100 p-8 space-y-6 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">Mesaj İsteği Gönder</h3>
                <button onClick={() => setShowMessageModal(false)} className="p-2 rounded-full hover:bg-slate-50">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <img 
                    src={user.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                    alt={user.nickname}
                    className="w-12 h-12 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <p className="font-bold text-slate-900">{user.nickname}</p>
                    <p className="text-xs text-slate-400">Mesaj isteği gönderiliyor</p>
                  </div>
                </div>
                <textarea 
                  autoFocus
                  rows={4}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-900 outline-none focus:border-indigo-500/50"
                  placeholder="Mesajını buraya yaz..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <button 
                onClick={handleSendMessageRequest}
                disabled={sending || !message.trim()}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all active:scale-95 disabled:opacity-50"
              >
                {sending ? 'Gönderiliyor...' : 'Gönder'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

