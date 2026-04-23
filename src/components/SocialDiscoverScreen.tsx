import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cacheManager } from "../lib/cacheManager";
import { 
  collection, 
  query, 
  where, 
  limit, 
  getDocs,
  startAfter
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, AppConfig, normalizeUserProfile, CompatibilityHistory } from "../types";
import { getTargetGender, isEligibleSocialUser, isSocialProfileReady } from "../lib/socialUtils";
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
  isActive?: boolean;
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
        src={user?.social?.photos?.[0] || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'default'}`} 
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
              {user?.social?.nickname || user?.nickname || 'Gizemli'}, {user?.age || 25}
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
const DISCOVER_CACHE_KEY = "discover_feed";
const DISCOVER_CACHE_TTL = 86400; // 24 hours - we only refresh manually

export default function SocialDiscoverScreen({ 
  currentUser, 
  onNavigate, 
  onBack, 
  config, 
  onRefresh,
  refreshTimer: externalRefreshTimer,
  isActive
}: SocialDiscoverScreenProps) {
  useEffect(() => {
    if (isActive && currentUser?.uid) {
      socialService.updateUserStatus(currentUser.uid, true);
    }
  }, [isActive, currentUser?.uid]);
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
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(new Set());
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const refreshTimer = externalRefreshTimer || internalRefreshTimer;

  const fetchData = async (forceRefresh = false, isLoadMore = false) => {
    if (!uid || !isSocialProfileReady(currentUser)) return;
    
    // 0. Avoid redundant fetches if data is already in state and not forced
    if (!forceRefresh && !isLoadMore && allUsers.length > 0) return;

    // 1. Cache-First: Try to load from cache and update UI immediately
    let hasCache = false;
    if (!forceRefresh && !isLoadMore) {
      const cached = cacheManager.get<any>(DISCOVER_CACHE_KEY);
      if (cached) {
        setFeaturedUsers(cached.featuredUsers || []);
        setActiveUsers(cached.activeUsers || []);
        setCompatibleUsers(cached.compatibleUsers || []);
        setFeelingEnergyUsers(cached.feelingEnergyUsers || []);
        setNewFrequencyUsers(cached.newFrequencyUsers || []);
        setCompatibilityHistory(cached.compatibilityHistory || []);
        setSwipedUserIds(new Set(cached.swipedUserIds || []));
        setAllUsers(cached.allUsers || []);
        setLastVisible(cached.lastVisible || null);
        setHasMore(cached.hasMore ?? true);
        setLoading(false);
        hasCache = true;
        // Continue to background fetch for sync
      }
    }

    // Only show loading state if we have no cache and it's not a background refresh
    if (!hasCache && !isLoadMore) {
      setLoading(true);
    }

    try {
      // 1. Fetch Compatibility History & Swipes
      // Use socialSwipedIds cache if available
      let swipedIds = cacheManager.get<string[]>("socialSwipedIds");
      
      const fetchHistory = getDocs(query(collection(db, "compatibilityHistory"), where("userId", "==", uid)));
      const fetchSwipes = swipedIds ? Promise.resolve(swipedIds) : socialService.getSwipedUserIds(uid);

      const [histSnap, finalSwipedIds] = await Promise.all([
        fetchHistory,
        fetchSwipes
      ]);

      if (!swipedIds) {
        cacheManager.set("socialSwipedIds", finalSwipedIds, 300);
      }
      
      const history = histSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompatibilityHistory));
      setCompatibilityHistory(history);
      
      const swipedSet = new Set([uid, ...finalSwipedIds]);
      setSwipedUserIds(swipedSet);

      // 2. Fetch Discover Users
      const targetGender = getTargetGender(currentUser);
      
      const usersRef = collection(db, "users");
      let discoverQ = query(
        usersRef,
        where("social.enabled", "==", true),
        where("social.profileCompleted", "==", true),
        where("social.visible", "==", true),
        where("social.gender", "==", targetGender),
        limit(10)
      );

      if (isLoadMore && lastVisible) {
        discoverQ = query(discoverQ, startAfter(lastVisible));
      }

      const snapshot = await getDocs(discoverQ);
      
      if (snapshot.empty) {
        setHasMore(false);
        if (!isLoadMore) {
          setCompatibleUsers([]);
          setFeelingEnergyUsers([]);
          setNewFrequencyUsers([]);
          setAllUsers([]);
        }
        return;
      }

      const newLastVisible = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(newLastVisible);
      setHasMore(snapshot.docs.length === 10);
      
      const rawUsers = snapshot.docs.map(doc => normalizeUserProfile(doc.data(), doc.id));
      const filteredUsers = rawUsers.filter(u => {
          const eligible = isEligibleSocialUser(u, uid, targetGender);
          const isSwiped = swipedSet.has(u.uid);
          return eligible && !isSwiped;
        });

      const updatedAllUsers = isLoadMore ? [...allUsers, ...filteredUsers] : filteredUsers;
      setAllUsers(updatedAllUsers);

      // Featured (Boosted) - We still want some featured users if possible
      const now = new Date().toISOString();
      const featured = updatedAllUsers
        .filter(u => u.boostExpiresAt && u.boostExpiresAt > now)
        .slice(0, 10);
      setFeaturedUsers(featured);
      
      // Active Users (First 10)
      const active = updatedAllUsers.filter(u => u.social?.isOnline).slice(0, 10);
      setActiveUsers(active);
      
      // Distribution Logic
      const compatibleIds = history.map(h => h.targetUserId);
      const matchedCompatible = updatedAllUsers.filter(u => compatibleIds.includes(u.uid));
      const others = updatedAllUsers.filter(u => !compatibleIds.includes(u.uid) && !featured.some(f => f.uid === u.uid));
      
      // Section A: Compatible (Up to 6)
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
        compatibilityHistory: history,
        swipedUserIds: Array.from(swipedSet),
        allUsers: updatedAllUsers,
        lastVisible: newLastVisible,
        hasMore: snapshot.docs.length === 10
      }, DISCOVER_CACHE_TTL, true);

    } catch (error) {
      console.error("Discover fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const hasFetchedRef = React.useRef(false);

  // Initial Fetch - Only if cache is empty or activation changes
  useEffect(() => {
    if (!uid || !isActive || !isSocialProfileReady(currentUser)) {
      if (!isActive) hasFetchedRef.current = false;
      return;
    }
    
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    fetchData();
  }, [uid, isActive]);

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
      const result = await walletService.runCompatibilityAnalysis(user.uid, 'arkadas');
      if (result.success) {
        toast.success("Uyum analizi süreci başladı! 5 dakika içinde hazır olacak. ✨");
      } else {
        toast.info("Yetersiz hak veya jeton. Cüzdandan takviye yapabilirsin.");
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
    
    // 1. Optimistic UI: Close the modal immediately
    setSelectedUser(null);
    setIsProcessing(true);
    
    // 2. Background process
    try {
      const result = await socialService.sendMessageRequest(currentUser, targetUser);
      switch (result) {
        case 'SUCCESS':
          toast.success("İstek gönderildi");
          break;
        case 'ALREADY_CHATTING':
          toast.info("Zaten sohbetiniz var.");
          break;
        case 'ALREADY_REQUESTED':
          toast.info("Zaten istek gönderdin.");
          break;
        case 'BLOCKED':
          toast.error("Bu kullanıcıyla iletişim kuramazsınız.");
          break;
        case 'SELF_ACTION':
          toast.error("Kendinize istek gönderemezsiniz.");
          break;
        case 'TARGET_NOT_FOUND':
          toast.error("Kullanıcı bulunamadı.");
          break;
        case 'TECHNICAL_ERROR':
          toast.error("Bir teknik hata oluştu. Lüften daha sonra tekrar deneyin.");
          break;
        default:
          console.error("SocialDiscoverScreen: Unexpected result:", result);
          toast.error("İşlem sırasında bir hata oluştu.");
          break;
      }
    } catch (error) {
      console.error("SocialDiscoverScreen: Background error:", error);
      toast.error("İstek gönderilirken bir hata oluştu, lütfen tekrar deneyin.");
      // Rollback: Not strictly necessary for a simple close, but we could re-open if needed.
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
        // Clear both caches and force re-fetch
        cacheManager.clear(DISCOVER_CACHE_KEY);
        cacheManager.clear("match_feed");
        setLastVisible(null);
        setHasMore(true);
        await fetchData(true);
        
        if (result.status === 'FREE_REFRESH_USED') {
          toast.success("Günlük ücretsiz yenileme hakkın kullanıldı! ✨");
        } else if (result.status === 'PAID_REFRESH_USED') {
          toast.success("Keşfet yenilendi! ✨");
        } else {
          toast.success("Keşfet güncellendi! ✨");
        }
        if (onRefresh) onRefresh();
      } else {
        if (result.status === 'INSUFFICIENT_FUNDS') {
          toast.info("Yenileme hakkın bitti. Cüzdandan alabilirsin.");
          onNavigate('wallet');
        } else if (result.status === 'COOLDOWN_ACTIVE') {
          toast.info("Lütfen biraz bekleyin.");
        } else {
          toast.error("Yenileme sırasında bir hata oluştu.");
        }
      }
    } catch (error: any) {
      console.error("Refresh error:", error);
      toast.error(error.message || "Yenileme işlemi başarısız oldu.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoadMore = () => {
    if (loading || !hasMore) return;
    fetchData(false, true);
  };

  return (
    <div className="w-full text-body relative pt-[calc(env(safe-area-inset-top,1rem)+64px)]">
      <div className="pb-28 relative z-10">
        {/* Header with Minimal Refresh */}
        <div className="px-6 pt-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Keşfet</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sanal Evrenin Enerjileri</p>
          </div>
          <motion.button 
            whileTap={{ rotate: 180 }}
            onClick={handleRefresh} 
            disabled={isProcessing}
            className="w-10 h-10 rounded-full bg-white shadow-sm border border-black/5 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {/* Section 1: Active Stories (Premium Circles) */}
        <div className="mt-8 space-y-4">
          <div className="px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">Şu An Aktif</h3>
            </div>
            <span className="text-[9px] font-bold text-slate-400 uppercase">Tümünü Gör</span>
          </div>
          
          <div className="flex items-center gap-5 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
            {activeUsers.map((u, i) => (
              <motion.button
                key={u.uid}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setSelectedUser(u)}
                className="flex-shrink-0 flex flex-col items-center gap-2 group"
              >
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-500">
                  <div className="w-[68px] h-[68px] rounded-full border-[3px] border-white overflow-hidden bg-slate-100">
                    <img 
                      src={u?.social?.photos?.[0] || u?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u?.uid || i}`} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  {/* Live Dot Overlay */}
                  <div className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-lg" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 truncate w-16 text-center">
                  {u?.social?.nickname?.split(' ')[0] || u?.nickname?.split(' ')[0] || 'Avatar'}
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Section 2: Uyumlu Ruhlar (Featured Horizontal Cards) */}
        {featuredUsers.length > 0 && (
          <div className="mt-10 space-y-4">
            <div className="px-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">Günün Parlayanları</h3>
              </div>
            </div>
            <div className="flex items-center gap-4 overflow-x-auto no-scrollbar px-6 pb-6 pt-2">
              {featuredUsers.map(u => (
                <div key={u.uid} className="flex-shrink-0 w-36">
                  <DiscoverCard 
                    user={u} 
                    onClick={() => setSelectedUser(u)} 
                    variant="premium" 
                    compatibility={compatibilityHistory.find(h => h.targetUserId === u.uid)}
                  />
                </div>
              ))}
              {/* Boost CTA */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate('wallet')}
                className="flex-shrink-0 w-36 aspect-[3/4] rounded-[2.5rem] bg-indigo-50 border-2 border-dashed border-indigo-200 flex flex-col items-center justify-center gap-3 group hover:bg-white transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-600/10 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="text-center px-4">
                  <span className="text-[9px] font-black text-indigo-600 uppercase leading-none block">Öne Çık</span>
                  <span className="text-[7px] font-bold text-indigo-400 uppercase mt-1 block">Limitleri Aş</span>
                </div>
              </motion.button>
            </div>
          </div>
        )}

        {/* Section A: Enerji Uyumu (Grid Layout) */}
        <div className="px-6 mt-6 space-y-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-indigo-600 rounded-full" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">Frekans Uyumu</h3>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-3">Aura Seviyeleriniz Birleşiyor</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
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

        {/* Section B: Gözlerin Üzerinde Olduğu Profiler */}
        <div className="px-6 mt-12 space-y-6">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 bg-rose-500 rounded-full" />
              <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.15em]">Ruhun Dikkat Çekti</h3>
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-3">Profilini İnceleyen Enerjiler</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {feelingEnergyUsers.map((u, i) => (
              <motion.div
                key={u.uid}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedUser(u)}
                className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden cursor-pointer group shadow-lg border border-black/5 bg-slate-100"
              >
                <img 
                  src={u?.social?.photos?.[0] || u?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u?.uid || i}`} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent opacity-80" />
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-[11px] font-black text-white truncate">{u?.social?.nickname || u?.nickname || 'Gizemli'}</p>
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  </div>
                  <p className="text-[8px] font-black text-indigo-300 uppercase tracking-widest">Sana Odaklandı</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Premium Refresh Button at Bottom */}
        <div className="px-6 mt-16 pb-12 flex flex-col items-center gap-6">
          <div className="w-16 h-1 bg-slate-200 rounded-full opacity-50" />
          <div className="text-center space-y-1">
            <p className="text-xs font-black text-slate-900 uppercase tracking-[0.1em]">Listeyi Yenile</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Yeni Evrenlere Yolculuk Başlasın</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRefresh}
            disabled={isProcessing}
            className="flex items-center gap-3 px-10 py-5 rounded-[2rem] bg-slate-900 text-white shadow-2xl shadow-slate-900/20 hover:bg-slate-800 transition-all font-black text-[12px] uppercase tracking-[0.2em]"
          >
            <RefreshCw className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>{refreshTimer === 'Yenile' ? 'Tazele' : refreshTimer}</span>
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
