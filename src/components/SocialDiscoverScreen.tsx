import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  collection, 
  query, 
  where, 
  limit, 
  onSnapshot, 
  updateDoc, 
  doc 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, AppConfig, Horoscope } from "../types";
import { calculateCompatibility } from "../lib/compatibilityEngine";
import { getTargetGender, isEligibleSocialUser } from "../lib/socialUtils";
import { toast } from "sonner";
import { Sparkles, Heart, Users, Star, Zap } from "lucide-react";
import SocialStoryArea from "./SocialStoryArea";
import SocialProfilePopup from "./SocialProfilePopup";
import SocialGridBlock from "./SocialGridBlock";
import { socialService } from "../lib/socialService";
import OptimizedImage from "./OptimizedImage";

interface SocialDiscoverScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  onBack?: () => void;
  config: AppConfig | null;
  horoscope?: Horoscope | null;
  isActive?: boolean;
}

function DiscoverCard({ user, currentUser, onClick, isActive }: { user: UserProfile, currentUser: UserProfile, onClick: () => void, isActive?: boolean }) {
  const compatibility = calculateCompatibility(currentUser, user);
  const score = Math.max(compatibility.love, compatibility.friendship);
  
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={isActive ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      className="relative aspect-[3/4] rounded-3xl overflow-hidden cursor-pointer group shadow-2xl shadow-purple-500/10"
      onClick={onClick}
    >
      <OptimizedImage 
        src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
        containerClassName="w-full h-full"
        alt={user.social?.nickname || user.nickname}
      />
      
      {/* Glass Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
      
      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h4 className="text-sm font-bold text-white truncate drop-shadow-md">
              {user.social?.nickname || user.nickname}, {user.age || 25}
            </h4>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">Aktif</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end">
            <div className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center gap-1 shadow-xl">
              <Zap className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
              <span className="text-[10px] font-black text-white">%{score}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Glow */}
      <motion.div 
        animate={isActive ? { 
          opacity: [0.1, 0.3, 0.1],
          scale: [1, 1.02, 1]
        } : { opacity: 0.1, scale: 1 }}
        transition={{ repeat: Infinity, duration: 4 }}
        className="absolute -inset-px rounded-3xl border border-white/10 group-hover:border-purple-500/50 transition-colors duration-500 z-20 pointer-events-none" 
      />
      
      {/* Aura Glow - Reduced for Android performance */}
      <div className="absolute -inset-2 bg-purple-500/0 group-hover:bg-purple-500/5 blur-xl rounded-full transition-all duration-700 -z-10" />
    </motion.div>
  );
}

export default function SocialDiscoverScreen({ currentUser, onNavigate, onBack, config, horoscope, isActive }: SocialDiscoverScreenProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [featuredUsers, setFeaturedUsers] = useState<UserProfile[]>([]);
  const [loveUsers, setLoveUsers] = useState<UserProfile[]>([]);
  const [friendUsers, setFriendUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTimer, setRefreshTimer] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const targetGender = getTargetGender(currentUser);
    const usersRef = collection(db, "users");
    
    const q = query(
      usersRef,
      where("social.enabled", "==", true),
      where("social.profileCompleted", "==", true),
      where("social.visible", "==", true),
      where("social.gender", "==", targetGender),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allFetched = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => isEligibleSocialUser(u, currentUser.uid, targetGender));

      const usedUserIds = new Set<string>();

      const featured = allFetched.filter(u => u.subscription?.status === 'active').slice(0, 5);
      featured.forEach(u => usedUserIds.add(u.uid));
      setFeaturedUsers(featured);
      
      const sortedByLove = [...allFetched].filter(u => !usedUserIds.has(u.uid)).sort((a, b) => calculateCompatibility(currentUser, b).love - calculateCompatibility(currentUser, a).love);
      const love = sortedByLove.slice(0, 3);
      love.forEach(u => usedUserIds.add(u.uid));
      setLoveUsers(love);
      
      const sortedByFriend = [...allFetched].filter(u => !usedUserIds.has(u.uid)).sort((a, b) => calculateCompatibility(currentUser, b).friendship - calculateCompatibility(currentUser, a).friendship);
      const friend = sortedByFriend.slice(0, 3);
      friend.forEach(u => usedUserIds.add(u.uid));
      setFriendUsers(friend);

      setUsers(allFetched.filter(u => !usedUserIds.has(u.uid)).slice(0, 21));
      setLoading(false);
    }, (error) => {
      console.error("Discover onSnapshot error:", error);
      setLoading(false);
    });

    const interval = setInterval(updateTimer, 1000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser.uid, currentUser.social?.gender]);

  const updateTimer = () => {
    if (!currentUser.social?.lastDiscoverRefreshAt) {
      setRefreshTimer('00:00:00');
      return;
    }
    const lastRefresh = new Date(currentUser.social.lastDiscoverRefreshAt).getTime();
    const nextRefresh = lastRefresh + 24 * 60 * 60 * 1000;
    const now = Date.now();
    const diff = nextRefresh - now;

    if (diff <= 0) {
      setRefreshTimer('Yenile');
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setRefreshTimer(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }
  };

  const handleCompatibilityCheck = async (user: UserProfile) => {
    if (isProcessing) return;
    if ((currentUser.social?.compatibilityCredits || 0) <= 0) {
      toast.error("Uyum hesaplama için paket almalısınız.");
      return;
    }
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), { "social.compatibilityCredits": (currentUser.social?.compatibilityCredits || 0) - 1 });
      toast.success("Uyum hesaplanıyor...");
      // Compatibility logic here
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (targetUser: UserProfile) => {
    console.log("SocialDiscoverScreen: handleSendMessage called", {
      currentUserId: currentUser?.uid,
      targetUserId: targetUser?.uid,
      targetUserNickname: targetUser?.social?.nickname || targetUser?.nickname || targetUser?.displayName
    });

    if (isProcessing) {
      console.warn("SocialDiscoverScreen: handleSendMessage ignored (already processing)");
      return;
    }
    setIsProcessing(true);
    try {
      console.log("SocialDiscoverScreen: Calling socialService.sendMessageRequest...");
      const result = await socialService.sendMessageRequest(currentUser, targetUser);
      console.log("SocialDiscoverScreen: socialService.sendMessageRequest result:", result);
      
      switch (result) {
        case 'SUCCESS':
          toast.success("Mesaj isteğin gönderildi");
          setSelectedUser(null);
          break;
        case 'ALREADY_CHATTING':
          toast.info("Zaten sohbetiniz var.");
          setSelectedUser(null);
          break;
        case 'ALREADY_REQUESTED':
          toast.info("Zaten istek gönderdin.");
          setSelectedUser(null);
          break;
        case 'SELF_ACTION':
          toast.error("Kendine mesaj gönderemezsin.");
          break;
        case 'INVALID_TARGET':
          toast.error("Geçersiz kullanıcı.");
          break;
        default:
          toast.error("İstek gönderilirken bir hata oluştu.");
          break;
      }
    } catch (error) {
      console.error("SocialDiscoverScreen: Error in handleSendMessage catch block:", error);
      toast.error("İstek gönderilirken bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#050505] text-white relative overflow-hidden">
      {/* Background Effects - Simplified for performance */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-900/10 via-black to-black pointer-events-none" />
      <div className="absolute top-[-5%] left-[-5%] w-[30%] h-[30%] bg-purple-600/5 blur-[80px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[5%] right-[-5%] w-[30%] h-[30%] bg-amber-600/5 blur-[80px] rounded-full pointer-events-none" />
      
      {/* Floating Particles - Reduced count for Android */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {isActive && [...Array(10)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%",
              opacity: Math.random() * 0.5 + 0.2
            }}
            animate={{ 
              y: [null, "-20%", "120%"],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: Math.random() * 10 + 10, 
              repeat: Infinity,
              ease: "linear",
              delay: Math.random() * 10
            }}
            className="absolute w-1 h-1 bg-white rounded-full"
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-28 relative z-10">
        {/* Featured Section Header */}
        <div className="px-6 pt-8 pb-2 flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-xl font-serif font-bold text-white tracking-tight flex items-center gap-2">
              Öne Çıkanlar <Sparkles className="w-4 h-4 text-amber-400" />
            </h3>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
              Bugün öne çıkan enerjiler
            </p>
          </div>
        </div>

        <SocialStoryArea featuredUsers={featuredUsers} onSelect={setSelectedUser} />
        
        {/* Main Discover Section Header */}
        <div className="px-6 pt-10 pb-4">
          <h3 className="text-lg font-serif font-bold text-white tracking-tight flex items-center gap-2">
            Ruh Eşini Keşfet <Star className="w-4 h-4 text-purple-400" />
          </h3>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
            Frekansına en yakın ruhlar
          </p>
        </div>

        {/* Main Discover Grid */}
        <div className="px-6 grid grid-cols-2 gap-5">
          {users.slice(0, 4).map(u => (
            <DiscoverCard 
              key={u.uid} 
              user={u} 
              currentUser={currentUser} 
              onClick={() => setSelectedUser(u)} 
              isActive={isActive}
            />
          ))}
        </div>

        <SocialGridBlock 
          title="Aşk Enerjinle Yüksek Uyum" 
          users={loveUsers} 
          color="red" 
          onSelect={setSelectedUser} 
          currentUser={currentUser}
          isActive={isActive}
        />
        
        {/* Secondary Grid */}
        <div className="px-6 grid grid-cols-2 gap-4">
          {users.slice(4, 8).map(u => (
            <DiscoverCard 
              key={u.uid} 
              user={u} 
              currentUser={currentUser} 
              onClick={() => setSelectedUser(u)} 
              isActive={isActive}
            />
          ))}
        </div>

        <SocialGridBlock 
          title="Dostluk Frekansın Uyuşanlar" 
          users={friendUsers} 
          color="blue" 
          onSelect={setSelectedUser} 
          currentUser={currentUser}
          isActive={isActive}
        />
        
        {/* Final Grid */}
        <div className="px-6 grid grid-cols-2 gap-4">
          {users.slice(8, 16).map(u => (
            <DiscoverCard 
              key={u.uid} 
              user={u} 
              currentUser={currentUser} 
              onClick={() => setSelectedUser(u)} 
              isActive={isActive}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <SocialProfilePopup 
            user={selectedUser} 
            onClose={() => setSelectedUser(null)} 
            onCompatibilityCheck={handleCompatibilityCheck}
            onSendMessage={handleSendMessage}
            context="discover"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
