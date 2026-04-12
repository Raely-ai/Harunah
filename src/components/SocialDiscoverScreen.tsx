import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cacheManager } from "../lib/cacheManager";
import { 
  collection, 
  query, 
  where, 
  limit, 
  getDocs
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, AppConfig, normalizeUserProfile, CompatibilityHistory } from "../types";
import { getTargetGender, isEligibleSocialUser } from "../lib/socialUtils";
import { toast } from "sonner";
import { Sparkles, Users, RefreshCw, Plus, Lock, Eye } from "lucide-react";
import SocialProfilePopup from "./SocialProfilePopup";
import { socialService } from "../lib/socialService";
import { walletService } from "../lib/walletService";

interface SocialDiscoverScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  onBack?: () => void;
  config: AppConfig | null;
  onRefresh?: () => void;
  refreshTimer?: string;
}

const EMOTIONAL_LABELS = [
  "Mistik Enerji",
  "Ruh Eşi Adayı",
  "Yüksek Frekans",
  "Derin Bağlantı",
  "Yıldız Uyumlu"
];

const getEmotionalLabel = (uid: string) => {
  const hash = uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return EMOTIONAL_LABELS[hash % EMOTIONAL_LABELS.length];
};

function DiscoverCard({ user, onClick, variant = 'medium', compatibility }: { user: UserProfile, onClick: () => void, variant?: 'medium' | 'premium', compatibility?: CompatibilityHistory }) {
  const label = compatibility ? `%${compatibility.loveScore} Uyumlu` : getEmotionalLabel(user.uid);
  
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`relative aspect-[3/4] rounded-3xl overflow-hidden cursor-pointer group shadow-xl bg-black/5 ${variant === 'premium' ? 'border-2 border-purple-500/20' : 'border border-black/5'}`}
      onClick={onClick}
    >
      <img 
        src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
        className={`w-full h-full rounded-3xl object-cover transition-transform duration-700 group-hover:scale-110 ${variant === 'premium' ? 'blur-2xl opacity-40 scale-125' : ''}`} 
        referrerPolicy="no-referrer"
      />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Content */}
      <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col gap-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-white truncate text-sm drop-shadow-md">
              {user.social?.nickname || user.nickname}, {user.age || 25}
            </h4>
            {user.social?.isOnline && (
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-[9px] font-black uppercase tracking-widest ${compatibility ? 'text-amber-400' : 'text-white/60'}`}>
              {label}
            </span>
          </div>
        </div>
      </div>

      {/* Premium Lock Overlay */}
      {variant === 'premium' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-purple-900/10 backdrop-blur-sm">
          <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] drop-shadow-lg">Gizli Profil</p>
            <div className="inline-block text-[8px] font-black text-amber-400 uppercase tracking-widest bg-black/60 px-3 py-1.5 rounded-full border border-amber-400/30">
              Görmek için dokun
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// Simple Memory Cache for Social Discover
const DISCOVER_CACHE_KEY = "socialDiscoverData";
const DISCOVER_CACHE_TTL = 86400; // 24 hours - we only refresh manually

export default function SocialDiscoverScreen({ 
  currentUser, 
  onNavigate, 
  onBack, 
  config, 
  onRefresh,
  refreshTimer: externalRefreshTimer
}: SocialDiscoverScreenProps) {
  // Safe access with fallbacks
  const uid = currentUser?.uid || "";
  const social = currentUser?.social || { photos: [], nickname: "", bio: "", zodiacSign: "", lastDiscoverRefreshAt: undefined, lastFreeRefreshAt: undefined };
  const refreshCount = currentUser?.refreshCount || 0;

  const [compatibleUsers, setCompatibleUsers] = useState<UserProfile[]>([]);
  const [feelingEnergyUsers, setFeelingEnergyUsers] = useState<UserProfile[]>([]);
  const [newFrequencyUsers, setNewFrequencyUsers] = useState<UserProfile[]>([]);
  const [featuredUsers, setFeaturedUsers] = useState<UserProfile[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [internalRefreshTimer, setInternalRefreshTimer] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [compatibilityHistory, setCompatibilityHistory] = useState<CompatibilityHistory[]>([]);

  const refreshTimer = externalRefreshTimer || internalRefreshTimer;

  const fetchData = async (forceRefresh = false) => {
    if (!uid) return;
    
    // Check Cache First (unless forced)
    if (!forceRefresh) {
      const cached = cacheManager.get<any>(DISCOVER_CACHE_KEY);
      if (cached) {
        setFeaturedUsers(cached.featuredUsers);
        setActiveUsers(cached.activeUsers);
        setCompatibleUsers(cached.compatibleUsers);
        setFeelingEnergyUsers(cached.feelingEnergyUsers);
        setNewFrequencyUsers(cached.newFrequencyUsers);
        setCompatibilityHistory(cached.compatibilityHistory);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Fetch Compatibility History
      const histQ = query(
        collection(db, "compatibilityHistory"),
        where("userId", "==", uid)
      );
      const histSnap = await getDocs(histQ);
      const history = histSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompatibilityHistory));
      setCompatibilityHistory(history);

      // 2. Fetch Discover Users
      const targetGender = getTargetGender(currentUser);
      const usersRef = collection(db, "users");
      const discoverQ = query(
        usersRef,
        where("social.enabled", "==", true),
        where("social.profileCompleted", "==", true),
        where("social.visible", "==", true),
        where("social.gender", "==", targetGender),
        limit(40)
      );

      const snapshot = await getDocs(discoverQ);
      const allFetched = snapshot.docs
        .map(doc => normalizeUserProfile(doc.data(), doc.id))
        .filter(u => isEligibleSocialUser(u, uid, targetGender));

      // Shuffle for variety
      const shuffled = [...allFetched].sort(() => Math.random() - 0.5);

      // Featured (Boosted)
      const now = new Date().toISOString();
      const featured = allFetched
        .filter(u => u.boostExpiresAt && u.boostExpiresAt > now)
        .slice(0, 10);
      setFeaturedUsers(featured);
      
      // Active Users (First 10)
      const active = allFetched.slice(0, 10);
      setActiveUsers(active);
      
      // Section A: Compatible
      const compatibleIds = history.map(h => h.targetUserId);
      const matchedCompatible = shuffled.filter(u => compatibleIds.includes(u.uid));
      const others = shuffled.filter(u => !compatibleIds.includes(u.uid) && !featured.some(f => f.uid === u.uid));
      
      const sectionA = [...matchedCompatible, ...others].slice(0, 6);
      setCompatibleUsers(sectionA);

      // Section B: Feeling Energy (Next 4)
      const usedIds = new Set([...featured.map(u => u.uid), ...sectionA.map(u => u.uid)]);
      const sectionB = others.filter(u => !usedIds.has(u.uid)).slice(0, 4);
      setFeelingEnergyUsers(sectionB);

      // Section C: New Frequencies (Next 6)
      const usedIdsFinal = new Set([...usedIds, ...sectionB.map(u => u.uid)]);
      const sectionC = others.filter(u => !usedIdsFinal.has(u.uid)).slice(0, 6);
      setNewFrequencyUsers(sectionC);

      // Update Cache
      cacheManager.set(DISCOVER_CACHE_KEY, {
        featuredUsers: featured,
        activeUsers: active,
        compatibleUsers: sectionA,
        feelingEnergyUsers: sectionB,
        newFrequencyUsers: sectionC,
        compatibilityHistory: history
      }, DISCOVER_CACHE_TTL);

    } catch (error) {
      console.error("Discover fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial Fetch - Only if cache is empty
  useEffect(() => {
    fetchData();
  }, [uid]);

  // Local Timer for Refresh Button
  useEffect(() => {
    const updateTimer = () => {
      if (!social?.lastFreeRefreshAt) {
        setInternalRefreshTimer('Yenile');
        return;
      }
      const lastRefresh = new Date(social.lastFreeRefreshAt).getTime();
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

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [social?.lastFreeRefreshAt]);

  const handleCompatibilityCheck = async (user: UserProfile) => {
    if (isProcessing || !uid) return;
    
    setIsProcessing(true);
    try {
      const success = await walletService.consumeSocialFeature(uid, 'compatibility');
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
          setSelectedUser(null);
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
      const result = await walletService.refreshDiscoverFeed();
      if (result.success) {
        // Clear cache and force re-fetch
        cacheManager.clear(DISCOVER_CACHE_KEY);
        await fetchData(true);
        
        if ((result as any).consumedFrom === 'daily_bonus') {
          toast.success("Günlük ücretsiz yenileme hakkın kullanıldı! ✨");
        } else {
          toast.success("Keşfet yenilendi! ✨");
        }
        if (onRefresh) onRefresh();
      }
    } catch (error: any) {
      console.error("Refresh error:", error);
      if (error.message?.includes("Yetersiz")) {
        toast.info("Yenileme hakkın bitti. Cüzdandan alabilirsin.");
        onNavigate('wallet');
      } else {
        toast.error(error.message || "Yenileme sırasında bir hata oluştu.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full text-body relative pt-[calc(env(safe-area-inset-top,1rem)+64px)]">
      <div className="pb-28 relative z-10">
        {/* Header with Refresh */}
        <div className="px-6 pt-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-heading tracking-tight">Keşfet</h2>
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Senin için seçilen enerjiler</p>
          </div>
          <button 
            onClick={handleRefresh} 
            disabled={isProcessing}
            className="p-2.5 rounded-2xl bg-black/5 text-muted hover:text-amber-600 transition-all flex items-center gap-2 border border-black/5"
          >
            <span className="text-[10px] font-black">{refreshTimer === 'Yenile' ? refreshCount : refreshTimer}</span>
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Section 1: Active Users (Horizontal Circles) */}
        <div className="px-6 mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-heading uppercase tracking-[0.2em]">Şu an aktif kişiler</h3>
            <div className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest">Canlı</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
            {activeUsers.map(u => (
              <motion.button
                key={u.uid}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedUser(u)}
                className="flex-shrink-0 flex flex-col items-center gap-1.5 group"
              >
                <div className="relative">
                  <div className="absolute -inset-0.5 bg-gradient-to-tr from-emerald-400 to-emerald-600 rounded-full opacity-0 group-hover:opacity-40 blur-[2px] transition-opacity" />
                  <div className="relative w-14 h-14 rounded-full border-2 border-white p-0.5 bg-white shadow-sm overflow-hidden">
                    <img 
                      src={u.social?.photos?.[0] || u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                </div>
                <span className="text-[9px] font-bold text-muted group-hover:text-heading truncate w-14 text-center transition-colors">
                  {u.social?.nickname?.split(' ')[0] || u.nickname?.split(' ')[0]}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Section 2: Featured (Boosted Horizontal Cards) */}
        {featuredUsers.length > 0 && (
          <div className="mt-8 space-y-3">
            <div className="px-6 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <h3 className="text-[10px] font-black text-heading uppercase tracking-[0.2em]">Öne Çıkanlar</h3>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto no-scrollbar px-6 pb-4">
              {featuredUsers.map(u => (
                <div key={u.uid} className="flex-shrink-0 w-32">
                  <DiscoverCard 
                    user={u} 
                    onClick={() => setSelectedUser(u)} 
                    variant="medium" 
                    compatibility={compatibilityHistory.find(h => h.targetUserId === u.uid)}
                  />
                </div>
              ))}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate('wallet')}
                className="flex-shrink-0 w-32 aspect-[3/4] rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 flex flex-col items-center justify-center gap-2 group"
              >
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                  <Plus className="w-5 h-5 text-amber-600" />
                </div>
                <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">Sende Katıl</span>
              </motion.button>
            </div>
          </div>
        )}

        {/* Section A: Sana En Uyumlu Enerjiler (Grid 2x3) */}
        <div className="px-6 mt-8 space-y-4">
          <div className="flex flex-col">
            <h3 className="text-[10px] font-black text-heading uppercase tracking-[0.2em]">Sana En Uyumlu Enerjiler</h3>
            <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest">Yıldız Haritanız Fısıldıyor</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {compatibleUsers.map((u) => (
              <DiscoverCard 
                key={u.uid} 
                user={u} 
                onClick={() => setSelectedUser(u)} 
                variant="medium" 
                compatibility={compatibilityHistory.find(h => h.targetUserId === u.uid)}
              />
            ))}
          </div>
        </div>

        {/* Section B: Enerjini Hissedenler (Small Grid) */}
        <div className="px-6 mt-10 space-y-4">
          <div className="flex flex-col">
            <h3 className="text-[10px] font-black text-heading uppercase tracking-[0.2em]">Enerjini Hissedenler</h3>
            <p className="text-[8px] font-bold text-purple-600 uppercase tracking-widest">Ruhun Dikkat Çekti</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {feelingEnergyUsers.map((u) => (
              <motion.div
                key={u.uid}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedUser(u)}
                className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group border border-black/5"
              >
                <img 
                  src={u.social?.photos?.[0] || u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-[10px] font-bold text-white truncate">{u.social?.nickname || u.nickname}</p>
                  <p className="text-[7px] font-black text-purple-300 uppercase tracking-tighter">Sana Bakıyor</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Section C: Yeni Frekanslar */}
        <div className="px-6 mt-10 space-y-4">
          <div className="flex flex-col">
            <h3 className="text-[10px] font-black text-heading uppercase tracking-[0.2em]">Yeni Frekanslar</h3>
            <p className="text-[8px] font-bold text-blue-600 uppercase tracking-widest">Evrene Yeni Katılanlar</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {newFrequencyUsers.map((u) => (
              <DiscoverCard 
                key={u.uid} 
                user={u} 
                onClick={() => setSelectedUser(u)} 
                variant="medium" 
              />
            ))}
          </div>
        </div>

        {/* Refresh Trigger at Bottom */}
        <div className="px-6 mt-12 pb-8 flex flex-col items-center gap-4">
          <div className="w-12 h-1px bg-black/5" />
          <p className="text-[10px] font-bold text-muted text-center max-w-[200px]">
            Daha fazla kişi görmek ve enerjini tazelemek için yenile
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isProcessing}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-black text-white shadow-xl shadow-black/10 hover:bg-black/90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span className="text-xs font-black uppercase tracking-widest">
              {refreshTimer === 'Yenile' ? 'Yenile' : refreshTimer}
            </span>
          </motion.button>
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
