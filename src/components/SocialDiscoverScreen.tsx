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
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, AppConfig, Horoscope, normalizeUserProfile } from "../types";
import { calculateCompatibility } from "../lib/compatibilityEngine";
import { getTargetGender, isEligibleSocialUser } from "../lib/socialUtils";
import { toast } from "sonner";
import { Sparkles, Heart, Users, Star, Zap, RefreshCw, Plus, Lock, Eye } from "lucide-react";
import SocialStoryArea from "./SocialStoryArea";
import SocialProfilePopup from "./SocialProfilePopup";
import { socialService } from "../lib/socialService";
import { walletService } from "../lib/walletService";

interface SocialDiscoverScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  onBack?: () => void;
  config: AppConfig | null;
  horoscope?: Horoscope | null;
  onRefresh?: () => void;
  refreshTimer?: string;
}

const EMOTIONAL_LABELS = [
  "Sana bakıyor",
  "Enerjin dikkatini çekti",
  "Seni fark etti",
  "Kararsız ama yakın"
];

const getEmotionalLabel = (uid: string) => {
  const hash = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return EMOTIONAL_LABELS[hash % EMOTIONAL_LABELS.length];
};

function DiscoverCard({ user, onClick, variant = 'medium' }: { user: UserProfile, onClick: () => void, variant?: 'medium' | 'large' | 'dense' | 'premium' }) {
  const label = getEmotionalLabel(user.uid);
  
  const cardClasses = {
    large: "relative aspect-[4/5] w-full rounded-2xl overflow-hidden cursor-pointer group shadow-xl",
    medium: "relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group shadow-md",
    dense: "relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group shadow-sm",
    premium: "relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group shadow-md bg-black/5",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cardClasses[variant]}
      onClick={onClick}
    >
      <img 
        src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
        className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${variant === 'premium' ? 'blur-xl opacity-50' : ''}`} 
        referrerPolicy="no-referrer"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
      
      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-0.5">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <h4 className={`font-bold text-white truncate drop-shadow-md ${variant === 'large' ? 'text-lg' : variant === 'dense' ? 'text-[11px]' : 'text-sm'}`}>
              {user.social?.nickname || user.nickname}, {user.age || 25}
            </h4>
            {user.social?.isOnline && (
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            )}
          </div>
          {variant !== 'dense' && (
            <span className={`font-medium text-white/80 uppercase tracking-wider italic ${variant === 'large' ? 'text-[10px]' : 'text-[9px]'}`}>
              {label}
            </span>
          )}
        </div>
      </div>

      {/* Premium Lock Overlay */}
      {variant === 'premium' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-xl">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-bold text-white uppercase tracking-widest">Seni Merak Edenler</p>
            <button className="text-[8px] font-black text-amber-400 uppercase tracking-tighter bg-black/40 px-2.5 py-1 rounded-full border border-amber-400/30 backdrop-blur-sm">
              Görmek için aç
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function SocialDiscoverScreen({ 
  currentUser, 
  onNavigate, 
  onBack, 
  config, 
  horoscope,
  onRefresh,
  refreshTimer: externalRefreshTimer
}: SocialDiscoverScreenProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [featuredUsers, setFeaturedUsers] = useState<UserProfile[]>([]);
  const [loveUsers, setLoveUsers] = useState<UserProfile[]>([]);
  const [newUsers, setNewUsers] = useState<UserProfile[]>([]);
  const [nearUsers, setNearUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [internalRefreshTimer, setInternalRefreshTimer] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const refreshTimer = externalRefreshTimer || internalRefreshTimer;

  useEffect(() => {
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
        .map(doc => normalizeUserProfile(doc.data(), doc.id))
        .filter(u => isEligibleSocialUser(u, currentUser.uid, targetGender));

      const usedUserIds = new Set<string>();

      // Featured (Stories)
      const featured = allFetched.filter(u => u.subscription?.status === 'active').slice(0, 10);
      setFeaturedUsers(featured);
      
      // Section 1: Sana Yakın Enerjiler (Large)
      const near = allFetched.slice(0, 2);
      near.forEach(u => usedUserIds.add(u.uid));
      setNearUsers(near);
      
      // Section 2: Aşk Enerjine Yakın (Grid 2-col)
      const love = allFetched.filter(u => !usedUserIds.has(u.uid)).slice(0, 4);
      love.forEach(u => usedUserIds.add(u.uid));
      setLoveUsers(love);
      
      // Section 3: Yeni Gelenler (Grid 3-col)
      const newly = [...allFetched].reverse().filter(u => !usedUserIds.has(u.uid)).slice(0, 6);
      newly.forEach(u => usedUserIds.add(u.uid));
      setNewUsers(newly);

      setUsers(allFetched.filter(u => !usedUserIds.has(u.uid)).slice(0, 20));
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
      setInternalRefreshTimer('00:00:00');
      return;
    }
    const lastRefresh = new Date(currentUser.social.lastDiscoverRefreshAt).getTime();
    const nextRefresh = lastRefresh + 24 * 60 * 60 * 1000;
    const now = Date.now();
    const diff = nextRefresh - now;

    if (diff <= 0) {
      setInternalRefreshTimer('Yenile');
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setInternalRefreshTimer(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }
  };

  const handleCompatibilityCheck = async (user: UserProfile) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const success = await walletService.consumeSocialFeature(currentUser.uid, 'compatibility');
      if (success) {
        toast.success("Uyum hesaplanıyor...");
      } else {
        toast.info("Uyum analizi hakkın bitti. Cüzdandan alabilirsin.");
        onNavigate('wallet');
      }
    } catch (e: any) {
      toast.error(e.message || "İşlem başarısız.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (targetUser: UserProfile) => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await socialService.sendMessageRequest(currentUser, targetUser);
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
        default:
          toast.error("İstek gönderilirken bir hata oluştu.");
          break;
      }
    } catch (error) {
      console.error(error);
      toast.error("İstek gönderilirken bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefresh = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const result = await walletService.refreshDiscover();
      if (result.success) {
        toast.success("Keşfet yenilendi! ✨");
        if (onRefresh) onRefresh();
      } else {
        toast.info("Yenileme hakkın bitti. Cüzdandan alabilirsin.");
        onNavigate('wallet');
      }
    } catch (error: any) {
      console.error("Refresh error:", error);
      toast.error(error.message || "Yenileme sırasında bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full text-body relative">
      <div className="pb-28 relative z-10">
        {/* Story System */}
        <SocialStoryArea featuredUsers={featuredUsers} onSelect={setSelectedUser} onNavigate={onNavigate} />
        
        {/* Section 1: Sana Yakın Enerjiler (Large Cards) */}
        <div className="px-6 space-y-3 mt-1">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-base font-serif font-bold text-heading tracking-tight">Sana Yakın Enerjiler</h3>
              <p className="text-[9px] font-bold text-muted uppercase tracking-widest">Frekansına en yakın ruhlar</p>
            </div>
            <button 
              onClick={handleRefresh} 
              disabled={isProcessing}
              className="p-2 rounded-xl bg-black/5 text-muted hover:text-amber-600 transition-colors flex items-center gap-2"
            >
              <span className="text-[10px] font-black">{currentUser.refreshCount || 0}</span>
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="space-y-4">
            {nearUsers.map(u => (
              <DiscoverCard key={u.uid} user={u} onClick={() => setSelectedUser(u)} variant="large" />
            ))}
          </div>
        </div>

        {/* Section 2: Aşk Enerjine Yakın (2-Column Grid) */}
        <div className="px-6 mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <Heart className="w-3.5 h-3.5 text-rose-500" />
            <h3 className="text-[10px] font-black text-heading uppercase tracking-widest">Aşk Enerjine Yakın</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {loveUsers.map(u => (
              <DiscoverCard key={u.uid} user={u} onClick={() => setSelectedUser(u)} variant="medium" />
            ))}
          </div>
        </div>

        {/* Section 3: Yeni Gelenler (3-Column Grid) */}
        <div className="px-6 mt-8 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <h3 className="text-[10px] font-black text-heading uppercase tracking-widest">Yeni Gelenler</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {newUsers.map(u => (
              <DiscoverCard key={u.uid} user={u} onClick={() => setSelectedUser(u)} variant="dense" />
            ))}
          </div>
        </div>

        {/* Section 4: Seni Merak Edenler (Premium Blur) */}
        <div className="px-6 mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-purple-500" />
              <h3 className="text-[10px] font-black text-heading uppercase tracking-widest">Seni Merak Edenler</h3>
            </div>
            <span className="text-[8px] font-black text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-full uppercase">Premium</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {users.slice(0, 2).map(u => (
              <DiscoverCard key={u.uid} user={u} onClick={() => onNavigate('wallet')} variant="premium" />
            ))}
          </div>
        </div>

        {/* Extra Content to fill (2-Column Grid) */}
        <div className="px-6 mt-8 grid grid-cols-2 gap-3">
          {users.slice(2, 10).map(u => (
            <DiscoverCard key={u.uid} user={u} onClick={() => setSelectedUser(u)} variant="medium" />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <SocialProfilePopup 
            user={selectedUser} 
            currentUser={currentUser}
            onClose={() => setSelectedUser(null)} 
            onCompatibilityCheck={handleCompatibilityCheck}
            onSendMessage={handleSendMessage}
            onNavigate={onNavigate}
            context="discover"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
