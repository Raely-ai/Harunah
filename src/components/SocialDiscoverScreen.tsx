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
  const [hasMore, setHasMore] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser.social?.gender) {
      onNavigate('profile');
      toast.error("Keşfet'i kullanmak için profilini tamamlamalısın.");
      return;
    }
    fetchInitialUsers();
  }, []);

  const fetchInitialUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      
      const userGender = currentUser.social?.gender === "kadın" ? "kadın" : "erkek";
      const targetGender = userGender === "erkek" ? "kadın" : "erkek";

      let q = query(
        usersRef,
        where("social.enabled", "==", true),
        where("social.profileCompleted", "==", true),
        where("social.visible", "==", true),
        where("social.gender", "==", targetGender),
        limit(50)
      );

      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "users");
        return;
      }
      
      const allFetched = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== currentUser.uid && u.social?.banned !== true);

      console.log(`Fetched: ${snapshot.docs.length} kullanıcı.`);
      console.log(`Filtre sonrası kalan: ${allFetched.length} kullanıcı.`);

      // Distribute users
      // 1. Featured (those with photos or just first 5)
      setFeaturedUsers(allFetched.slice(0, 8));
      
      // 2. Compatible
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
      
      if (snapshot.docs.length < 50) {
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
      
      const userGender = currentUser.social?.gender === "kadın" ? "kadın" : "erkek";
      const targetGender = userGender === "erkek" ? "kadın" : "erkek";

      let q = query(
        usersRef,
        where("social.enabled", "==", true),
        where("social.profileCompleted", "==", true),
        where("social.visible", "==", true),
        where("social.gender", "==", targetGender),
        startAfter(lastDoc),
        limit(20)
      );

      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "users");
        return;
      }
      const newUsers = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.uid !== currentUser.uid && u.social?.banned !== true);

      console.log(`Fetched more: ${snapshot.docs.length} kullanıcı.`);
      console.log(`Filtre sonrası kalan: ${newUsers.length} kullanıcı.`);

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
    </div>
  );
}

function UserCard({ user, currentUser }: { user: UserProfile, currentUser: UserProfile }) {
  const scores = calculateCompatibility(currentUser, user);
  
  return (
    <div className="relative group aspect-[3/4] rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-sm">
      <img 
        src={user.social?.photos?.[0] || user.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
        alt={user.nickname}
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex flex-col justify-end p-4">
        <div className="space-y-1.5 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-white truncate">{user.social?.nickname || user.nickname || user.displayName}, {user.age || 0}</h3>
            {user.subscription?.status === 'active' && (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            )}
          </div>
          
          <p className="text-xs text-white/80 line-clamp-2">{user.social?.bio || user.bio || "Bio yok."}</p>

          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/40 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
              %{scores.understanding} Uyum
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold text-white border border-white/20">
              {user.zodiacSign || "Burç yok"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

