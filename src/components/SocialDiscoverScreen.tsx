import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cacheManager } from "../lib/cacheManager";
import { 
  collection, 
  query, 
  where, 
  limit, 
  getDocs
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, AppConfig, normalizeUserProfile, CompatibilityHistory, isExternalPhotoUrl } from "../types";
import { getTargetGender, isSocialProfileReady, checkGenderPreference } from "../lib/socialUtils";
import { toast } from "sonner";
import { 
  Sparkles, 
  RefreshCw, 
  Zap, 
  Flame,
  Star,
  Users,
  Award
} from "lucide-react";
import { socialService } from "../lib/socialService";
import { walletService } from "../lib/walletService";
import DiscoverProfilePopup from "./DiscoverProfilePopup";
import { BlueTick } from "./BlueTick";
import SocialVisibilityWarning from "./SocialVisibilityWarning";

interface SocialDiscoverScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  onBack?: () => void;
  config: AppConfig | null;
  onRefresh?: () => void;
  isActive?: boolean;
}

const DISCOVER_LIMIT = 50;
const DISCOVER_CACHE_KEY = "discover_v4_cache";

export default function SocialDiscoverScreen({ 
  currentUser, 
  onNavigate, 
  config,
  onRefresh,
  isActive 
}: SocialDiscoverScreenProps) {
  
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshTimer, setRefreshTimer] = useState<string>('Yenile');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  
  // POPUP STATE
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);

  const preferredGender = useMemo(() => {
    const lookingFor = (currentUser?.social?.lookingFor || currentUser?.lookingFor || 'arkadaş').toLowerCase();
    if (lookingFor === 'kadın' || lookingFor === 'kadin' || lookingFor === 'female') return 'female';
    if (lookingFor === 'erkek' || lookingFor === 'male') return 'male';
    return 'all';
  }, [currentUser]);

  // NEW: Sticky Filter State
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>(preferredGender);

  const uid = currentUser?.uid || "";
  const social = currentUser?.social;

  // 1. Initial State Sync
  useEffect(() => {
    if (social?.lastFreeRefreshAt) {
      setLastRefreshedAt(social.lastFreeRefreshAt);
    }
  }, [social?.lastFreeRefreshAt]);

  // 2. Fetch Logic
  const fetchDiscoverList = async (force = false) => {
    if (!uid || !isActive || !isSocialProfileReady(currentUser)) return;

    if (!force) {
      const cached = cacheManager.get<any>(DISCOVER_CACHE_KEY);
      if (cached && cached.users && cached.users.length > 0) {
        setAllUsers(cached.users);
        return;
      }
    }

    setLoading(true);
    try {
      const matches = await socialService.getMatches(uid);
      const matchIds = new Set(matches.map(m => m.uid));
      const exclusionSet = new Set([uid, ...Array.from(matchIds)]);

      const q = query(
        collection(db, "users"),
        where("social.enabled", "==", true),
        where("social.profileCompleted", "==", true),
        where("social.visible", "==", true),
        limit(300)
      );

      const snap = await getDocs(q);
      let fetchedUsers = snap.docs
        .map(doc => normalizeUserProfile(doc.data(), doc.id))
        .filter(u => !exclusionSet.has(u.uid) && checkGenderPreference(currentUser, u));

      // Sort logic
      fetchedUsers.sort((a, b) => {
        const aVerified = a.social?.verified ? 1 : 0;
        const bVerified = b.social?.verified ? 1 : 0;
        return bVerified - aVerified;
      });

      fetchedUsers = fetchedUsers.slice(0, DISCOVER_LIMIT);
      setAllUsers(fetchedUsers);
      
      cacheManager.set(DISCOVER_CACHE_KEY, {
        users: fetchedUsers,
        timestamp: Date.now()
      }, 3600); // 1 hr
    } catch (err) {
      console.error("Discover fetch error:", err);
      toast.error("Ruhlar çekilirken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      fetchDiscoverList();
      socialService.updateUserStatus(uid, true);
    }
  }, [uid, isActive]);

  // 3. Refresh Timer Logic
  useEffect(() => {
    const itv = setInterval(() => {
      if (!lastRefreshedAt) {
        setRefreshTimer('Yenile');
        return;
      }
      const next = new Date(lastRefreshedAt).getTime() + 24 * 60 * 60 * 1000;
      const diff = next - Date.now();

      if (diff <= 0) {
        setRefreshTimer('Yenile');
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
        setRefreshTimer(`${h}:${m}:${s}`);
      }
    }, 1000);
    return () => clearInterval(itv);
  }, [lastRefreshedAt]);

  const handleRefreshClick = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await walletService.refreshDiscover();
      if (result.success) {
        cacheManager.clear(DISCOVER_CACHE_KEY);
        setLastRefreshedAt(new Date().toISOString());
        await fetchDiscoverList(true);
        if (onRefresh) onRefresh();
        toast.success("Keşfet yenilendi! ✨");
      } else {
        if (result.status === 'INSUFFICIENT_FUNDS') {
          toast.info("Yenileme hakkın bitti. Cüzdandan alabilirsin.");
          onNavigate('wallet');
        } else {
          toast.info("Yenileme için biraz bekleyin...");
        }
      }
    } catch (err) {
      console.error("Manual refresh error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Boost Logic
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [boostConfig, setBoostConfig] = useState<any>(null);

  useEffect(() => {
    walletService.getAdminConfig().then(cfg => {
      setBoostConfig(cfg.boostPackages);
    });
  }, []);

  const handlePurchaseBoost = async (type: 'weekly' | 'monthly') => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const result = await walletService.purchaseBoostPackage(uid, type);
      if (result.success) {
        toast.success("Artık daha fazla kişiye görünüyorsun ✨");
        if (onRefresh) onRefresh();
        setShowBoostModal(false);
      } else {
        if (result.message?.includes("yetersiz") || result.message?.includes("Cüzdan")) {
          toast.error("Yetersiz bakiye. Cüzdana yönlendiriliyorsun.");
          onNavigate('wallet');
        } else {
          toast.error(result.message || "Boost alınamadı.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Bir hata oluştu.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Client-side Layer Partitioning
  const { layers, isEmptyFilter } = useMemo(() => {
    const now = new Date().getTime();
    
    // Filtre
    let filtered = allUsers.filter(u => {
      if (genderFilter === 'all') return true;
      const uGender = u.gender?.toLowerCase() || u.social?.gender?.toLowerCase() || '';
      if (genderFilter === 'female') return uGender === 'female' || uGender === 'kadin' || uGender === 'kadın';
      if (genderFilter === 'male') return uGender === 'male' || uGender === 'erkek';
      return true;
    });

    let isEmpty = false;
    if (filtered.length === 0 && allUsers.length > 0) {
      isEmpty = true;
    }

    // 1. Günün Parlayanları (Sadece Boost aktif olanlar)
    const parlayanlar = filtered.filter(u => {
      const boostTime = u.boostExpiresAt ? new Date(u.boostExpiresAt).getTime() : 0;
      return boostTime > now;
    }).slice(0, 10);

    // 2. Yeni Katılanlar (sort by createdAt)
    const yeniKatilanlar = [...filtered].sort((a,b) => {
      const aTime = new Date(a.createdAt).getTime() || 0;
      const bTime = new Date(b.createdAt).getTime() || 0;
      return bTime - aTime;
    }).slice(0, 10);

    // 3. Şu An Aktif
    const aktifOlanlar = filtered.filter(u => u.social?.isOnline).slice(0, 10);

    // 4. Onaylı Profiller
    const onayliProfiller = filtered.filter(u => u.social?.verified).slice(0, 10);

    // 5. Ana Akış
    const anaAkis = filtered;

    // Flat list for popups
    const flatUsers = [...new Set([...parlayanlar, ...yeniKatilanlar, ...aktifOlanlar, ...onayliProfiller, ...anaAkis])];

    return { 
      layers: { parlayanlar, yeniKatilanlar, aktifOlanlar, onayliProfiller, anaAkis, flatUsers },
      isEmptyFilter: isEmpty
    };
  }, [allUsers, genderFilter]);

  const openProfile = (user: UserProfile) => {
    const idx = layers.flatUsers.findIndex(u => u.uid === user.uid);
    if (idx !== -1) {
      setSelectedUserIndex(idx);
    }
  };

  if (loading && allUsers.length === 0) {
    return (
      <div className="flex-1 bg-[#F9F9F9] flex flex-col items-center justify-center p-8 gap-4">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full"
        />
        <p className="text-[13px] font-medium text-amber-600/60 animate-pulse">Evren hazırlanıyor...</p>
      </div>
    );
  }

  // Extracted Component for Horizontal Scroll Card
  const CatalogCard = ({ user, isGrid = false, isFeatured = false }: { user: UserProfile, isGrid?: boolean, isFeatured?: boolean }) => {
    // Robust Data Extraction
    const gender = (user.gender || user.social?.gender || "unknown").toLowerCase();
    const isFemale = gender === 'female' || gender === 'kadin' || gender === 'kadın';
    const isMale = gender === 'male' || gender === 'erkek';
    
    const nickname = user.social?.nickname || user.displayName || "İsimsiz";
    
    // Age calculation fallback
    const calculateAge = (bDay: string | null | undefined): number | null => {
      if (!bDay) return null;
      try {
        const birthDate = new Date(bDay);
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
      } catch (e) { return null; }
    };
    const u = user as any;
    const age = u.social?.age || u.age || calculateAge(u.birthDate);
    
    const zodiac = u.social?.zodiacSign || u.zodiacSign || null;
    const level = u.social?.level || u.level || null;
    const isVerified = u.social?.verified || u.isVerified || u.social?.verificationStatus === "approved";
    const bio = u.social?.bio || u.bio || null;
    const interests = u.social?.interests || u.interests || [];
    
    const boostTime = u.boostExpiresAt ? new Date(u.boostExpiresAt).getTime() : 0;
    const isBoosted = boostTime > Date.now();

    // Theme colors based on gender
    const glowClass = isBoosted ? 'border-2 border-amber-400 shadow-sm' : 
      isFemale 
      ? 'shadow-sm border-rose-100/30' 
      : isMale 
        ? 'shadow-sm border-indigo-100/30' 
        : 'shadow-sm border-purple-100/30';

    const cardWidth = isGrid ? 'w-full' : isFeatured ? 'w-40' : 'w-32'; 
    const cardAspect = 'aspect-[3/4.5]';

    return (
      <motion.div 
        whileTap={{ scale: 0.98 }}
        onClick={() => openProfile(user)}
        className={`${cardWidth} ${cardAspect} bg-white rounded-[24px] overflow-hidden relative ${glowClass} ${!isBoosted ? 'border' : ''} cursor-pointer group flex-shrink-0`}
      >
        <img 
          src={user.social?.photos?.[0] || (!isExternalPhotoUrl(user.photoURL) ? user.photoURL : "") || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" 
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer" 
        />
        
        {/* Premium Grade Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        
        {/* Top Indicators */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start z-10">
          {isBoosted && (
            <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-1.5 py-0.5 rounded-md border border-amber-300/30 flex items-center gap-1 shadow-sm">
              <Zap className="w-2.5 h-2.5 text-white fill-white" />
              <span className="text-white text-[8px] font-black uppercase tracking-widest">Öne Çıkan</span>
            </div>
          )}
          {level && (
            <div className="bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-lg border border-white/10">
              <span className="text-white text-[8px] font-black uppercase">Lv.{level}</span>
            </div>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5 flex items-center">
          {user.social?.isOnline && (
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
          )}
        </div>

        {/* Bottom Metadata */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-0.5">
          {/* Main Info Line */}
          <div className="flex items-center gap-1 w-full">
            <h4 className="text-white font-black text-xs truncate flex items-center gap-1 leading-none max-w-[80%]">
              {nickname.split(' ')[0]}
              {isVerified && <BlueTick size={10} />}
            </h4>
          </div>

          {/* Meta Info Line: Age • Zodiac • Level (Compact) */}
          <div className="flex items-center gap-1 min-h-[12px] flex-wrap">
            {age && (
              <span className="text-white text-[9px] font-black leading-none">{age} Yaş</span>
            )}
            {age && zodiac && <span className="text-white/40 text-[8px]">/</span>}
            {zodiac && (
              <span className="text-white/80 text-[8px] font-bold uppercase tracking-tight truncate leading-none">
                {zodiac}
              </span>
            )}
            {zodiac && level && <span className="text-white/40 text-[8px]">/</span>}
            {!zodiac && age && level && <span className="text-white/40 text-[8px]">/</span>}
            {level && !zodiac && !age ? null : level ? (
              <span className="text-white/80 text-[8px] font-black leading-none">Lv.{level}</span>
            ) : null}
          </div>

          {/* Bio Line if space allows */}
          {bio && !isGrid && (
            <p className="text-white/60 text-[7px] leading-tight line-clamp-1 italic font-medium w-full overflow-hidden mt-0.5">
              "{bio}"
            </p>
          )}

          {/* Interest Chips - Only show in grid or if few info */}
          {interests.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {interests.slice(0, 1).map((interest: string, idx: number) => (
                <span 
                  key={idx} 
                  className={`px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase border border-white/10 ${
                    isFemale ? 'bg-rose-500/30 text-rose-100' : isMale ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/10 text-white/80'
                  }`}
                >
                  {interest}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 bg-[#F9F9F9] text-slate-800 overflow-y-auto no-scrollbar pb-32 relative">
      {/* Spacer for fixed top bar */}
      <div className="w-full shrink-0" style={{ height: "calc(env(safe-area-inset-top, 1rem) + 64px)" }} />
      
      <SocialVisibilityWarning user={currentUser} onNavigate={onNavigate} />

      {/* 1. STICKY FILTER BAR */}
      <div className="sticky z-40 bg-[#F9F9F9]/90 backdrop-blur-sm border-b border-slate-200/50" style={{ top: "calc(env(safe-area-inset-top, 1rem) + 64px)" }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-black tracking-tighter text-slate-900 ml-2">Keşfet</h1>
          <div className="flex bg-slate-200/80 rounded-full p-1 border border-slate-300/50">
            {[
              { id: 'all', label: 'Herkes' },
              { id: 'female', label: 'Kadınlar' },
              { id: 'male', label: 'Erkekler' }
            ].map((gen) => (
              <button 
                key={gen.id}
                onClick={() => setGenderFilter(gen.id as any)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  genderFilter === gen.id 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {gen.label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 pb-2 text-center text-[9px] text-slate-400 font-medium">
          Seçimin sadece sana gösterilen profilleri etkiler. Karşı tarafın tercihleri bu listeyi sınırlamaz.
        </div>
      </div>

      {/* DISCOVER LIMIT WARNING */}
      {(() => {
        const rm = currentUser?.social?.discoverLikesRemaining ?? 15;
        if (rm > 3) return null;
        return (
          <div className="mx-4 mt-4 bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <h3 className="text-rose-600 font-bold text-xs uppercase tracking-wider mb-0.5">
                {rm === 0 ? "Günlük Keşfet Beğeni Hakkın Bitti!" : "Keşfet Beğeni Hakkın Bitiyor"}
              </h3>
              <p className="text-rose-500/80 text-[10px] font-medium">
                {rm === 0 ? "Yarın tekrar gel veya cüzdandan sınırsız Swipe al." : `Sadece ${rm} bedava beğeni hakkın kaldı.`}
              </p>
            </div>
            <button onClick={() => onNavigate('wallet')} className="bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md">
              Cüzdan
            </button>
          </div>
        );
      })()}

      {allUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center mt-12 gap-4">
          <div className="w-16 h-16 bg-slate-900 rounded-3xl flex items-center justify-center shadow-lg shadow-slate-900/5 rotate-12">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black text-slate-900 mt-4">Henüz Kimse Yok</h3>
          <p className="text-sm font-bold text-slate-400">Şu anki kriterlerine uygun ruhlar aranıyor. Birazdan tekrar kontrol et.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-10 mt-6">
          
          {/* GÜNÜN PARLAYANLARI */}
          {layers.parlayanlar.length > 0 && (
            <div className="sticky top-0 z-40 bg-white/30 backdrop-blur-sm pt-4 pb-4 border-b border-black/5 -mx-6 px-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-900 leading-none">Günün Parlayanları</h2>
                </div>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-6 px-6">
                
                {/* PROMO CARD - Öne Çık */}
                <motion.div 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowBoostModal(true)}
                  className="flex-shrink-0 w-40 aspect-[3/4.5] bg-slate-900 rounded-[24px] overflow-hidden relative shadow-lg flex flex-col items-center justify-center p-4 text-center border border-slate-800 cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent" />
                  <div className="w-11 h-11 bg-white/5 rounded-full flex items-center justify-center mb-3 border border-white/5 shadow-inner">
                    <Zap className="w-6 h-6 text-amber-400 fill-amber-400" />
                  </div>
                  <h4 className="text-white font-black text-[11px] leading-tight mb-3">Burada Öne Çıkmak İster misin?</h4>
                  <button className="bg-amber-500 hover:bg-amber-400 text-white text-[9px] font-black px-4 py-2 rounded-full uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all">
                    Öne Çık
                  </button>
                </motion.div>

                {layers.parlayanlar.map(u => <CatalogCard key={u.uid} user={u} isFeatured={true} />)}
              </div>
            </div>
          )}

          {/* YENİ KATILANLAR */}
          {layers.yeniKatilanlar.length > 0 && (
            <div>
              <div className="px-6 mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-900">Yeni Katılanlar</h2>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar px-6 pb-2">
                {layers.yeniKatilanlar.map(u => <CatalogCard key={u.uid} user={u} />)}
              </div>
            </div>
          )}

          {/* ŞU AN AKTİF */}
          {layers.aktifOlanlar.length > 0 && (
            <div>
              <div className="px-6 mb-3 flex items-center gap-2">
                <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full border border-[#F9F9F9] animate-pulse" />
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-900">Şu An Aktif</h2>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar px-6 pb-2">
                {layers.aktifOlanlar.map(u => <CatalogCard key={u.uid} user={u} />)}
              </div>
            </div>
          )}

          {/* ONAYLI PROFİLLER */}
          {layers.onayliProfiller.length > 0 && (
            <div>
              <div className="px-6 mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-sky-500" />
                <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-900">Onaylı Profiller</h2>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar px-6 pb-2">
                {layers.onayliProfiller.map(u => <CatalogCard key={u.uid} user={u} />)}
              </div>
            </div>
          )}

          {/* ANA AKIŞ - GRID */}
          <div className="px-5 mt-4">
            <div className="mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-400" />
              <h2 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-500">Tüm Evren</h2>
            </div>
            
            {isEmptyFilter && (
              <div className="mb-4 bg-slate-200/50 border border-slate-300/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-600 text-[11px] font-bold uppercase tracking-wider mb-4 leading-relaxed">
                  Bu seçimde şimdilik az profil var. Herkes'i deneyebilirsin.
                </p>
                <button 
                  onClick={() => setGenderFilter('all')}
                  className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-[0.98]"
                >
                  Herkes'i Göster
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              {layers.anaAkis.map((u, i) => {
                const promo = (i > 0 && i % 4 === 0) ? (
                   <motion.div key={`promo-${i}`} onClick={() => setShowBoostModal(true)} className="aspect-[3/4.5] bg-slate-900 rounded-[24px] overflow-hidden relative shadow-sm flex flex-col items-center justify-center p-3 text-center border border-slate-800 cursor-pointer">
                     <div className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center mb-2">
                       <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                     </div>
                     <h4 className="text-white font-black text-[11px] leading-tight mb-2 px-2">Profilini VIP Vitrine Taşı</h4>
                     <button className="bg-amber-500 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                       Öne Çık
                     </button>
                   </motion.div>
                ) : null;

                const card = <CatalogCard key={u.uid} user={u} isGrid={true} />;

                return (
                  <React.Fragment key={`wrap-${u.uid}`}>
                    {promo}
                    {card}
                  </React.Fragment>
                );
              })}

              {/* Az kart varsa araya manuel bir promo sıkıştır */}
              {layers.anaAkis.length > 0 && layers.anaAkis.length < 4 && (
                 <motion.div onClick={() => setShowBoostModal(true)} className="aspect-[3/4.5] bg-slate-900 rounded-[24px] overflow-hidden relative shadow-sm flex flex-col items-center justify-center p-3 text-center border border-slate-800 cursor-pointer">
                   <div className="w-9 h-9 bg-white/5 rounded-full flex items-center justify-center mb-2">
                     <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                   </div>
                   <h4 className="text-white font-black text-[11px] leading-tight mb-2 px-2">Profilini Parlat</h4>
                   <button className="bg-amber-500 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">
                     Öne Çık
                   </button>
                 </motion.div>
              )}
            </div>
          </div>

          {/* REFRESH AREA */}
          <div className="mt-8 pb-20 flex flex-col items-center gap-6 px-6">
            <div className="w-full h-px bg-slate-200" />
            <div className="text-center space-y-1">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Evren Döngüsü Tamamlandı</h3>
            </div>
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={handleRefreshClick}
              disabled={isProcessing}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl flex items-center justify-center gap-2 border border-slate-800 shadow-sm disabled:opacity-80"
            >
              <RefreshCw className={`w-4 h-4 text-amber-400 ${isProcessing ? 'animate-spin' : ''}`} />
              <span className="text-xs font-black uppercase tracking-[0.1em]">
                {isProcessing ? 'Yenileniyor...' : 'Yeni Ruhlar Keşfet'}
              </span>
            </motion.button>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {refreshTimer === 'Yenile' ? 'Ücretsiz Yenileme Hazır' : `Kalan Süre: ${refreshTimer}`}
            </span>
          </div>
        </div>
      )}

      {/* BOOST PURCHASE MODAL */}
      <AnimatePresence>
        {showBoostModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBoostModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-8 pb-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-amber-100 rounded-[30px] flex items-center justify-center mb-6 shadow-sm border border-amber-200/50">
                  <Zap className="w-10 h-10 text-amber-500 fill-amber-500" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2">VIP Vitrin'e Çık!</h3>
                <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed px-4">
                  Profilini öne çıkar ve 10 kat daha fazla etkileşim al. Parlayanlar listesinde en üstte görün! ✨
                </p>

                <div className="w-full space-y-4">
                  <button 
                    onClick={() => handlePurchaseBoost('weekly')}
                    disabled={isProcessing}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white p-5 rounded-3xl flex items-center justify-between group transition-all active:scale-[0.98]"
                  >
                    <div className="text-left">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-400">Gelişmiş</span>
                      <span className="text-sm font-black">7 Gün Boyunca</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Fiyat</span>
                      <span className="text-lg font-black text-amber-400">{boostConfig?.weekly?.price || 49.99} Coin</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => handlePurchaseBoost('monthly')}
                    disabled={isProcessing}
                    className="w-full bg-slate-50 hover:bg-slate-100 text-slate-900 p-5 rounded-3xl flex items-center justify-between border border-slate-200 group transition-all active:scale-[0.98]"
                  >
                    <div className="text-left">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-indigo-500">Kral Paketi</span>
                      <span className="text-sm font-black">30 Gün Boyunca</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Fiyat</span>
                      <span className="text-lg font-black text-indigo-600">{boostConfig?.monthly?.price || 149.99} Coin</span>
                    </div>
                  </button>
                </div>

                <div className="mt-8 flex flex-col items-center gap-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bakiyen: {currentUser.mainCoins || 0} Coin</p>
                  <button 
                    onClick={() => setShowBoostModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest py-2"
                  >
                    Belki Daha Sonra
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROFILE POPUP */}
      <AnimatePresence>
        {selectedUserIndex !== null && (
          <DiscoverProfilePopup 
            users={layers.flatUsers}
            initialIndex={selectedUserIndex}
            currentUser={currentUser}
            onClose={() => setSelectedUserIndex(null)}
            onNavigate={onNavigate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

