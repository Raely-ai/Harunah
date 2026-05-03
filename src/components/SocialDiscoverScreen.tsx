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
import { UserProfile, AppConfig, normalizeUserProfile, CompatibilityHistory } from "../types";
import { getTargetGender, isSocialProfileReady, checkMutualGenderPreference } from "../lib/socialUtils";
import { toast } from "sonner";
import { 
  Sparkles, 
  RefreshCw, 
  Plus, 
  Activity, 
  Zap, 
  Trophy, 
  Flame
} from "lucide-react";
import { socialService } from "../lib/socialService";
import { walletService } from "../lib/walletService";
import DiscoverProfilePopup from "./DiscoverProfilePopup";
import { BlueTick } from "./BlueTick";

interface SocialDiscoverScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  onBack?: () => void;
  config: AppConfig | null;
  onRefresh?: () => void;
  isActive?: boolean;
}

// 50 Users Limit
const DISCOVER_LIMIT = 50;
const DISCOVER_CACHE_KEY = "discover_v3_cache";

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
  const [compatibilityHistory, setCompatibilityHistory] = useState<CompatibilityHistory[]>([]);
  const [refreshTimer, setRefreshTimer] = useState<string>('Yenile');
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  
  // POPUP STATE
  const [selectedUserIndex, setSelectedUserIndex] = useState<number | null>(null);

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
        setCompatibilityHistory(cached.history || []);
        return;
      }
    }

    setLoading(true);
    try {
      // KRİTİK FİLTRE: Sadece kendimizi ve EŞLEŞTİĞİMİZ kişileri gizle.
      // Beğendiğimiz (swiped) kişiler Keşfet'te KALMALI (paralı özellikler için).
      const matches = await socialService.getMatches(uid);
      const matchIds = new Set(matches.map(m => m.uid));
      const exclusionSet = new Set([uid, ...Array.from(matchIds)]);

      // Fetch compatibility history for layer 5
      const histSnap = await getDocs(query(
        collection(db, "compatibilityHistory"), 
        where("userId", "==", uid),
        limit(20)
      ));
      const history = histSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompatibilityHistory));
      setCompatibilityHistory(history);

      const q = query(
        collection(db, "users"),
        where("social.enabled", "==", true),
        where("social.profileCompleted", "==", true),
        where("social.visible", "==", true),
        limit(300) // Fetch more to filter post-query since we cannot complex query "includes"
      );

      const snap = await getDocs(q);
      let fetchedUsers = snap.docs
        .map(doc => normalizeUserProfile(doc.data(), doc.id))
        .filter(u => !exclusionSet.has(u.uid) && checkMutualGenderPreference(currentUser, u));

      // Soft boost verified users (verified users go closer to the top)
      fetchedUsers.sort((a, b) => {
        const aVerified = a.social?.verified ? 1 : 0;
        const bVerified = b.social?.verified ? 1 : 0;
        return bVerified - aVerified;
      });

      fetchedUsers = fetchedUsers.slice(0, DISCOVER_LIMIT);

      setAllUsers(fetchedUsers);
      
      cacheManager.set(DISCOVER_CACHE_KEY, {
        users: fetchedUsers,
        history: history,
        timestamp: Date.now()
      }, 3600); // 1 hour internal cache

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

  // 4. Layer Partitioning (Hybrid Data Management)
  const layers = useMemo(() => {
    const now = new Date().toISOString();
    
    // 1. VIP LOJASI (Boosted)
    const boosted = allUsers.filter(u => u.boostExpiresAt && u.boostExpiresAt > now).slice(0, 10);
    
    // 2. ÖNERİLEN RUHLAR (Compat Score Based)
    const compatibleIds = new Set(compatibilityHistory.map(h => h.targetUserId));
    const suggested = allUsers.filter(u => compatibleIds.has(u.uid)).slice(0, 6);
    
    // 3. TAZE RUHLAR (Recently Updated)
    const fresh = allUsers.filter(u => !boosted.some(b => b.uid === u.uid) && !suggested.some(s => s.uid === u.uid)).slice(0, 12);
    
    // 4. ŞU AN AKTİF
    const active = allUsers.filter(u => u.social?.isOnline).slice(0, 15);
    
    // 5. FREKANS UYUMU (Zodiac matching - simple mock for UI)
    const matchingSigns = allUsers.filter(u => u.social?.interests?.length && u.uid !== uid).slice(0, 10);

    // 6. ANA MEYDAN (Rest)
    const processedIds = new Set([...boosted, ...suggested, ...fresh].map(u => u.uid));
    const mainStreet = allUsers.filter(u => !processedIds.has(u.uid));

    // FLAT LIST FOR POPUP NAVIGATION
    const flatUsers = [...new Set([...boosted, ...suggested, ...fresh, ...active, ...matchingSigns, ...mainStreet])];

    return { boosted, suggested, fresh, active, matchingSigns, mainStreet, flatUsers };
  }, [allUsers, compatibilityHistory, uid]);

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
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full shadow-lg"
        />
        <p className="font-serif italic text-amber-600/60 animate-pulse">Ruhlara giden yollar taranıyor...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F9F9F9] text-slate-800 overflow-y-auto no-scrollbar pt-[calc(env(safe-area-inset-top,1rem)+64px)] pb-32">
      
      {/* HEADER AREA */}
      <div className="px-6 pb-6 flex items-baseline justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tighter text-slate-900">Keşfet</h1>
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse fill-amber-500/10" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Zamanın Ruhuna Dokun</p>
        </div>
      </div>

      {/* 1. KATMAN: VIP LOJASI (BOOST) */}
      <div className="mb-10">
        <div className="px-6 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">VIP Lojası</span>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('wallet')}
            className="text-[9px] font-bold text-amber-600 uppercase tracking-widest flex items-center gap-1"
          >
            Sıranı Al <Plus className="w-2.5 h-2.5" />
          </motion.button>
        </div>
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar px-6">
          {/* USER SELF BOOST */}
          <motion.div 
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('wallet')}
            className="flex-shrink-0 flex flex-col items-center gap-2 group"
          >
            <div className="relative p-1 rounded-full bg-gradient-to-tr from-amber-500 via-amber-200 to-amber-600 shadow-xl shadow-amber-500/20">
              <div className="w-16 h-16 rounded-full border-[3px] border-white overflow-hidden bg-slate-100 flex items-center justify-center relative">
                <img 
                  src={currentUser.social?.photos?.[0] || currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`} 
                  className="w-full h-full object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter text-amber-600">Öne Çık</span>
          </motion.div>

          {layers.boosted.map((u) => (
            <div 
              key={u.uid} 
              className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer"
              onClick={() => openProfile(u)}
            >
              <div className={`relative p-1 rounded-full ${u.social?.verified ? 'bg-gradient-to-tr from-sky-400 via-sky-300 to-sky-600 shadow-[0_0_15px_rgba(14,165,233,0.5)]' : 'bg-gradient-to-tr from-amber-500 via-amber-200 to-amber-600'}`}>
                <div className="w-16 h-16 rounded-full border-[3px] border-white overflow-hidden bg-slate-50">
                  <img 
                    src={u.social?.photos?.[0] || u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 justify-center w-16">
                <span className="text-[9px] font-bold truncate">{u.social?.nickname?.split(' ')[0]}</span>
                {u.social?.verified && <BlueTick size={8} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. KATMAN: ÖNERİLEN RUHLAR (2'Lİ BÜYÜK GRID) */}
      {layers.suggested.length > 0 && (
        <div className="mb-12">
          <div className="px-6 mb-5 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 underline decoration-amber-400 decoration-2 underline-offset-4">Önerilen Ruhlar</h2>
          </div>
          <div className="flex items-center gap-4 overflow-x-auto no-scrollbar px-6 py-2">
            {layers.suggested.map((u) => (
              <motion.div 
                key={u.uid}
                whileTap={{ scale: 0.98 }}
                onClick={() => openProfile(u)}
                className={`flex-shrink-0 w-44 aspect-[3/4.2] bg-white rounded-3xl overflow-hidden shadow-sm relative border ${u.social?.verified ? 'border-sky-400/50 shadow-[0_0_15px_rgba(14,165,233,0.3)]' : 'border-slate-100'}`}
              >
                <img 
                  src={u.social?.photos?.[0] || u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-black text-white truncate">{u.social?.nickname}, {u.social?.age || 25}</h4>
                    {u.social?.verified && <BlueTick size={10} />}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                    <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Uyumlu Enerji</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 3. KATMAN: TAZE RUHLAR (3'LÜ GİZEMLİ GRID) */}
      <div className="mb-12 bg-white/40 py-8 border-y border-slate-200/50">
        <div className="px-6 mb-6 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Taze Ruhlar</h2>
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-6">Gizem Perdesi Aralanıyor</p>
        </div>
        <div className="grid grid-cols-3 gap-1 px-1">
          {layers.fresh.map(u => (
            <motion.div 
              key={u.uid}
              whileTap={{ scale: 0.96 }}
              onClick={() => openProfile(u)}
              className="aspect-square bg-slate-200 relative overflow-hidden"
            >
              <img 
                src={u.social?.photos?.[0] || u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
              <div className="absolute inset-0 bg-indigo-500/5 backdrop-blur-[1px]" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* 4. KATMAN: ŞU AN AKTİF ENERJİLER */}
      <div className="mb-12">
        <div className="px-6 mb-5 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Şu An Aktif</h2>
        </div>
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar px-6">
          {layers.active.map(u => (
            <div 
              key={u.uid} 
              className="flex-shrink-0 relative group cursor-pointer"
              onClick={() => openProfile(u)}
            >
              <div className={`w-14 h-14 rounded-full border-2 p-0.5 transition-all bg-slate-50 ${u.social?.verified ? 'border-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.4)]' : 'border-emerald-500/30 group-hover:border-emerald-500'}`}>
                <img 
                  src={u.social?.photos?.[0] || u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                  title={u.social?.nickname} 
                  className="w-full h-full rounded-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
              </div>
              <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-md" />
            </div>
          ))}
        </div>
      </div>

      {/* 5. KATMAN: FREKANS UYUMU */}
      <div className="mb-12 border-l-4 border-l-indigo-400/30 pl-6 pr-0">
        <div className="mb-5 flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">Frekans Uyumu</h2>
        </div>
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          {layers.matchingSigns.map(u => (
            <div 
              key={u.uid} 
              onClick={() => openProfile(u)}
              className={`flex-shrink-0 w-32 aspect-[4/5] bg-white rounded-2xl overflow-hidden shadow-sm border flex flex-col cursor-pointer ${u.social?.verified ? 'border-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.2)]' : 'border-slate-100'}`}
            >
              <img 
                src={u.social?.photos?.[0] || u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                className="w-full h-1/2 object-cover" 
                referrerPolicy="no-referrer" 
              />
              <div className="p-2 flex-1 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] font-black truncate">{u.social?.nickname}</span>
                  {u.social?.verified && <BlueTick size={8} />}
                </div>
                <div className="px-2 py-0.5 bg-indigo-50 rounded-full inline-block self-start">
                  <span className="text-[7px] font-bold text-indigo-500 uppercase tracking-tighter">Yüksek Uyum</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. KATMAN: ANA MEYDAN (GRID) */}
      <div className="px-1 mt-16">
        <div className="px-5 mb-8 flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Üniversumun Tamamı</h2>
          <span className="text-[9px] font-bold text-slate-300 uppercase">{allUsers.length} / 50</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {layers.mainStreet.map(u => (
            <motion.div 
              key={u.uid}
              whileTap={{ scale: 0.98 }}
              onClick={() => openProfile(u)}
              className="aspect-square bg-white relative overflow-hidden"
            >
              <img 
                src={u.social?.photos?.[0] || u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
              {u.social?.verified && (
                <div className="absolute top-1 right-1">
                  <BlueTick size={10} />
                </div>
              )}
              {/* Subtle Overlay */}
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
            </motion.div>
          ))}
        </div>

        {/* REFRESH AREA */}
        <div className="mt-16 pb-20 flex flex-col items-center gap-8">
          <div className="w-1.5 h-12 bg-gradient-to-b from-slate-200 to-transparent rounded-full" />
          
          <div className="text-center space-y-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Evren Döngüsü Tamamlandı</h3>
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed max-w-[200px]">
              Bu döngüde çekim merkezine giren ruhlar bunlardı. Evreni yenileyerek yeni kapıları arala.
            </p>
          </div>

          <div className="relative group">
            <div className="absolute inset-0 bg-slate-900 blur-2xl opacity-20 group-hover:opacity-40 transition-opacity" />
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefreshClick}
              disabled={isProcessing}
              className="relative px-12 py-5 bg-slate-900 text-white rounded-full flex flex-col items-center gap-1 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <RefreshCw className={`w-4 h-4 text-amber-500 ${isProcessing ? 'animate-spin' : ''}`} />
                <span className="text-sm font-black uppercase tracking-[0.2em]">Yenile</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter">
                {refreshTimer === 'Yenile' ? 'ÜCRETSİZ HAK' : refreshTimer}
              </span>
            </motion.button>
          </div>
          
          {refreshTimer !== 'Yenile' && (
            <button 
              onClick={handleRefreshClick}
              className="text-[9px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-4 py-2 rounded-full hover:bg-amber-100 transition-colors"
            >
              Cüzdanla Hemen Yenile
            </button>
          )}
        </div>
      </div>

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
