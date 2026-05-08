import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  Sparkles,
  X,
  Flag,
  ShieldAlert,
  ChevronRight,
  Handshake,
  Star
} from "lucide-react";
import { cacheManager } from "../lib/cacheManager";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  limit,
  updateDoc,
  increment,
  setDoc,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile, normalizeUserProfile } from "../types";
import { toast } from "sonner";
import { calculateCompatibility } from "../lib/compatibilityEngine";
import { getTargetGender, isEligibleSocialUser, isSocialProfileReady } from "../lib/socialUtils";
import { canSwipe, getRemainingSwipes, getDailySwipeLimit } from "../lib/swipeHelper";
import { socialService } from "../lib/socialService";
import { walletService } from "../lib/walletService";
import { reportService } from "../services/reportService";
import { matchingService } from "../services/matchingService";
import OptimizedImage from "./OptimizedImage";
import MatchingProfilePopup from "./MatchingProfilePopup";
import { BlueTick } from "./BlueTick";

export default function SocialMatchScreen({ currentUser, onNavigate, isActive }: { currentUser: UserProfile, onNavigate: (tab: any) => void, isActive?: boolean }) {
  const uid = currentUser?.uid || "";
  
  // Real-time user profile sync for accurate limits
  const [liveUser, setLiveUser] = useState<UserProfile>(currentUser);
  
  useEffect(() => {
    if (!uid || !isActive) return;
    const unsubscribe = onSnapshot(doc(db, "users", uid), (snapshot) => {
      if (snapshot.exists()) {
        setLiveUser(normalizeUserProfile(snapshot.data(), snapshot.id));
      }
    }, (err) => {
      console.error("Live user sync error:", err);
    });
    return () => unsubscribe();
  }, [uid, isActive]);

  const superLikes = liveUser?.superLikes || 0;

  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(() => {
    const isValid = cacheManager.isValid("match_feed");
    console.log(`[MATCH_PERF_LOADING_REASON] Initializing. Cache valid: ${isValid}`);
    return !isValid;
  });
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(() => {
    const startTime = performance.now();
    const cached = cacheManager.get<any>("match_feed");
    console.log(`[MATCH_PERF_CACHE_READ_MS] ${ (performance.now() - startTime).toFixed(2) }ms`);
    return new Set([uid, ...(cached?.swipedUserIds || [])]);
  });
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);

  const displayMatches = useMemo(() => {
    return potentialMatches.filter(u => !swipedUserIds.has(u.uid));
  }, [potentialMatches, swipedUserIds]);

  const activeUser = displayMatches[0];

  const hasFetchedRef = React.useRef(false);
  const prevLookingForRef = React.useRef(liveUser?.social?.lookingFor || liveUser?.lookingFor);
  const prevGenderRef = React.useRef(liveUser?.social?.gender || liveUser?.gender);

  useEffect(() => {
    console.log("[MATCH_PERF_MOUNT] SocialMatchScreen mounted/updated");
    if (!uid || !isActive) {
      // DO NOT reset hasFetchedRef.current here to avoid re-fetching when switching tabs
      return;
    }
    
    // Profile check
    if (!isSocialProfileReady(liveUser)) {
      setLoading(false);
      return;
    }

    const currentLookingFor = liveUser?.social?.lookingFor || liveUser?.lookingFor;
    const currentGender = liveUser?.social?.gender || liveUser?.gender;

    // Fast cache check to decide if we need to show loader during preference change
    const cached = cacheManager.get<any>("match_feed");

    if (
      (prevLookingForRef.current && prevLookingForRef.current !== currentLookingFor) || 
      (prevGenderRef.current && prevGenderRef.current !== currentGender)
    ) {
      console.log("SocialMatch: User preference changed. Resetting feed.");
      prevLookingForRef.current = currentLookingFor;
      prevGenderRef.current = currentGender;
      
      hasFetchedRef.current = false;
      setPotentialMatches([]);
      setSwipedUserIds(new Set([uid]));
      
      // Only show loader if we don't have cache (though we just cleared it above, so it will show)
      setLoading(true);
      cacheManager.clear("match_feed");
    }

    if (hasFetchedRef.current) return;
    
    const fetchData = () => {
      const startTime = performance.now();
      let dataLoadedFromCache = false;
      hasFetchedRef.current = true;
      const initialCached = cacheManager.get<any>("match_feed");
      
      if (initialCached && initialCached.potentialMatches && initialCached.potentialMatches.length > 0) {
        console.log(`[MATCH_PERF_CACHE_HIT] Count: ${initialCached.potentialMatches.length}`);
        setPotentialMatches(initialCached.potentialMatches);
        setSwipedUserIds(new Set(initialCached.swipedUserIds || [uid]));
        setLoading(false);
        dataLoadedFromCache = true;
        
        const ageInSeconds = (Date.now() - (initialCached._timestamp || 0)) / 1000;
        if (ageInSeconds < 60) {
          console.log(`[SocialMatchScreen] Cache is fresh (${Math.round(ageInSeconds)}s), skipping background fetch.`);
          return;
        }
      } else {
        console.log("[MATCH_PERF_CACHE_MISS]");
        setLoading(true); 
      }

      const loaderTimeout = setTimeout(() => {
        console.log(`[MATCH_PERF_LOADER_TIMEOUT] 1500ms reached. loading was: ${loading}`);
        setLoading(false);
      }, 1500);

      console.log("[MATCH_PERF_BACKGROUND_FETCH_START]");
      const fetchStart = performance.now();
      matchingService.fetchPotentialMatches(liveUser).then(fetchedUsers => {
        const fetchEnd = performance.now();
        console.log(`[MATCH_PERF_BACKEND_MS] ${ (fetchEnd - fetchStart).toFixed(2) }ms. count: ${fetchedUsers?.length || 0}`);
        if (fetchedUsers && fetchedUsers.length > 0) {
          const setStart = performance.now();
          setPotentialMatches(fetchedUsers);
          console.log(`[MATCH_PERF_SET_STATE_MS] ${ (performance.now() - setStart).toFixed(2) }ms`);
        }
      }).catch(error => {
        console.error("[SocialMatchScreen] Match fetch background error:", error);
        if (!dataLoadedFromCache) toast.error("Keşfet şu an yüklenemedi.");
      }).finally(() => {
        clearTimeout(loaderTimeout);
        setLoading(false);
        console.log(`[MATCH_PERF_BACKGROUND_FETCH_DONE] Total fetchData time: ${ (performance.now() - startTime).toFixed(2) }ms`);
      });
    };

    fetchData();
  }, [uid, isActive, liveUser]);

  const handleSwipe = (type: 'like' | 'pass' | 'super_like') => {
    if (!activeUser || isAnimating) return;
    
    // STRICT LIMIT CHECKS
    if (type !== 'pass') {
      const remaining = getRemainingSwipes(liveUser);
      if (remaining <= 0) {
        toast.error("Günlük kaydırma hakkın bitti! ✨", {
          description: "Yeni haklar için cüzdanı ziyaret et."
        });
        onNavigate('wallet');
        return;
      }

      if (type === 'super_like' && (liveUser.superLikes || 0) <= 0) {
        toast.error("Süper Like hakkın kalmadı! ✨", {
          description: "Cüzdandan Süper Like alabilirsin."
        });
        onNavigate('wallet');
        return;
      }
    }

    const targetUser = activeUser;
    
    // OPTIMISTIC UI: Remove from view immediately
    const updatedSwipedIds = new Set(swipedUserIds).add(targetUser.uid);
    setSwipedUserIds(updatedSwipedIds);
    
    // Background fetch if low on candidates
    const remaining = displayMatches.length - 1;
    if (remaining < 5) {
      console.log("SocialMatch: Pool low, background fetching... Pool size:", displayMatches.length);
      const startTime = performance.now();
      matchingService.fetchPotentialMatches(liveUser).then(moreUsers => {
        const renderTime = performance.now() - startTime;
        console.log(`SocialMatch: Fetch triggered and finished. Render time estimate: ${renderTime.toFixed(2)}ms`);
        if (moreUsers.length > 0) {
          setPotentialMatches(prev => {
            const all = [...prev, ...moreUsers];
            // Deduplicate
            const unique = Array.from(new Map(all.map(u => [u.uid, u])).values());
            console.log(`SocialMatch: Pool updated. New size: ${unique.length}`);
            return unique;
          });
        }
      });
    }
    
    // START ANIMATION
    setIsAnimating(true);
    setExitDirection(type === 'pass' ? 'left' : type === 'like' ? 'right' : 'up');

    // FIRE AND FORGET BACKEND CALL (Optimistic)
    socialService.sendLike(liveUser, targetUser.uid, type)
      .then(result => {
        if (result === 'DAILY_LIMIT_REACHED' || result === 'INSUFFICIENT_FUNDS') {
          toast.error("Hakkınız yetersiz.");
        } else if (result === 'SUCCESS' && type === 'super_like') {
          toast.success("Süper Like gönderildi! ✨");
        }
      })
      .catch(err => {
        console.error("Swipe API error:", err);
      })
      .finally(() => {
        // Reset animation states after the transition completes
        setTimeout(() => {
          setExitDirection(null);
          setIsAnimating(false);
        }, 400); 
      });
  };

  const handleReport = async (reason: string) => {
    if (!activeUser) return;
    try {
      await reportService.reportUser({
        reportedUserId: activeUser.uid,
        source: 'discover',
        reason: reason,
        description: "Keşfet üzerinden raporlandı.",
        metadata: { activeUserId: activeUser.uid }
      });
      setShowReportModal(false);
      handleSwipe('pass');
    } catch (error) {
      console.error("Report error:", error);
      toast.error("Bildirim gönderilirken bir hata oluştu.");
    }
  };

  const compatibility = useMemo(() => {
    if (!activeUser) return null;
    return calculateCompatibility(liveUser, activeUser);
  }, [liveUser, activeUser]);

  console.log(`[SocialMatchScreen] DEBUG RENDER: loading=${loading}, activeUserExists=${!!activeUser}, potentialLen=${potentialMatches.length}, displayLen=${displayMatches.length}, swipedIdsLen=${swipedUserIds.size}`);

  return (
    <div className="flex-1 flex flex-col relative w-full h-full bg-[#FAFAFA] pt-[calc(env(safe-area-inset-top,1rem)+72px)] pb-18 overflow-hidden">
      
      {/* EXPLANATION NOTICE */}
      <div className="absolute top-[calc(env(safe-area-inset-top,1rem)+32px)] inset-x-0 flex justify-center z-10 pointer-events-none px-4">
        <p className="text-[9px] text-slate-400 font-medium text-center bg-white/60 backdrop-blur-md px-3 py-1 rounded-full shadow-sm border border-slate-200/50">
          Karşılaşma'da sana varsayılan olarak karşı cins profiller gösterilir. Daha geniş keşif için Keşfet'i kullan.
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="w-12 h-12 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
            <Sparkles className="absolute inset-0 m-auto w-5 h-5 text-amber-500 animate-pulse" />
          </div>
          <p className="text-slate-500 text-sm font-medium animate-pulse">Yıldızlar hizalanıyor...</p>
        </div>
      ) : !activeUser ? (
        <div className="flex-1 flex items-center justify-center px-8 bg-[#FAFAFA]">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm space-y-8">
            <div className="relative mx-auto w-20 h-20">
              <div className="absolute inset-0 bg-amber-500/10 blur-2xl rounded-full" />
              <div className="relative h-full bg-white border border-slate-100 rounded-[2rem] flex items-center justify-center shadow-lg">
                 <Sparkles className="w-8 h-8 text-amber-500" />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-serif font-bold text-slate-900 leading-tight">Şu an yeni ruh bulunamadı</h3>
              <p className="text-slate-500 text-sm leading-relaxed px-4">
                Biraz sonra tekrar deneyebilirsin.
              </p>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="flex-1 relative">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeUser.uid}
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ 
                scale: 1, 
                opacity: 1, 
                y: exitDirection === 'up' ? -1000 : 0,
                x: exitDirection === 'left' ? -1000 : exitDirection === 'right' ? 1000 : 0,
                rotate: exitDirection === 'left' ? -30 : exitDirection === 'right' ? 30 : 0
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: "spring", damping: 25, stiffness: 120 }}
              className={`absolute inset-0 w-full h-full overflow-hidden bg-white group cursor-pointer ${
                activeUser.social?.verified 
                  ? 'shadow-[0_0_50px_-12px_rgba(14,165,233,0.4)] border border-sky-500/20' 
                  : 'shadow-2xl'
              }`}
              onClick={() => setSelectedProfile(activeUser)}
            >
              {/* TOP LIMIT INDICATORS */}
              {!selectedProfile && (
                <div className="absolute top-4 left-0 right-0 z-20 flex justify-center items-center gap-3 pointer-events-none">
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span className="text-[10px] font-black text-white tabular-nums tracking-widest">
                      {getRemainingSwipes(liveUser)} / {getDailySwipeLimit(liveUser)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-[10px] font-black text-white tabular-nums tracking-widest">
                      {superLikes}
                    </span>
                  </div>
                </div>
              )}

              {/* PHOTO BOX */}
              <div className="absolute inset-0 z-0 bg-slate-100">
                {activeUser.social?.verified && (
                   <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 via-transparent to-transparent z-[1] pointer-events-none mix-blend-overlay" />
                )}
                <OptimizedImage 
                  src={activeUser.social?.photos?.[0] || activeUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeUser.uid}`} 
                  alt={activeUser.social?.nickname || activeUser.nickname}
                  className="w-full h-full object-cover"
                />
                
                {/* REFINED OVERLAY GRADIENT */}
                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-[1]" />
              </div>

              {/* REPORT BUTTON */}
              {!selectedProfile && (
                <div className="absolute top-5 right-5 z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                    className="p-2.5 bg-black/30 backdrop-blur-md rounded-full text-white/70 hover:text-white transition-all border border-white/10"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* MINIMAL INFORMATION LAYER */}
              {!selectedProfile && (
                <div className="absolute inset-x-0 bottom-0 z-10 p-6 space-y-4 pointer-events-none">
                  
                  {/* IDENTITY & ZODIAC */}
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl md:text-3xl font-serif font-black text-white tracking-tight drop-shadow-lg flex items-center gap-2">
                      {activeUser.social?.nickname || activeUser.nickname}, {activeUser.age || 25}
                      {activeUser.social?.verified && <BlueTick size={12} />}
                      {activeUser.level && (
                        <div className="px-1.5 py-0.5 bg-indigo-500/80 backdrop-blur-sm rounded-md text-[8px] font-black text-white uppercase tracking-wider shadow-md">
                          LVL {activeUser.level}
                        </div>
                      )}
                    </h2>
                    <div className="px-2 py-0.5 bg-amber-500/90 backdrop-blur-sm rounded-lg text-[9px] font-black text-white uppercase tracking-widest shadow-md">
                      {activeUser.zodiacSign || "Mistik"}
                    </div>
                  </div>

                  {/* ELEGANT COMPATIBILITY STRIP */}
                  <div className="flex items-center justify-between p-3 bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl">
                    <div className="flex flex-col items-center flex-1 border-r border-white/10">
                      <div className="flex items-center gap-1">
                        <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                        <span className="text-lg font-black text-white">%{compatibility?.love || 0}</span>
                      </div>
                      <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest">TENSEL</span>
                    </div>
                    <div className="flex flex-col items-center flex-1 border-r border-white/10">
                      <div className="flex items-center gap-1">
                        <Handshake className="w-3 h-3 text-blue-400" />
                        <span className="text-lg font-black text-white">%{compatibility?.friendship || 0}</span>
                      </div>
                      <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest">RUHSAL</span>
                    </div>
                    <div className="flex flex-col items-center flex-1">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span className="text-lg font-black text-white">%{compatibility?.understanding || 0}</span>
                      </div>
                      <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest">YILDIZ</span>
                    </div>
                  </div>

                  {/* REFINED CIRCULAR BUTTONS */}
                  <div className="flex items-center justify-center gap-6 pt-2 pointer-events-auto">
                    {/* PASS (X) */}
                    <div className="flex flex-col items-center gap-1">
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleSwipe('pass'); }}
                        className="w-14 h-14 bg-black/40 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-all shadow-lg"
                      >
                        <X className="w-6 h-6" />
                      </motion.button>
                      <span className="text-[10px] text-white/70 font-bold uppercase tracking-wider">GEÇ</span>
                    </div>

                    {/* SUPER LIKE (STAR) */}
                    <div className="flex flex-col items-center gap-1">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); handleSwipe('super_like'); }}
                        className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-full flex items-center justify-center text-white shadow-lg shadow-amber-500/20 border-2 border-white/20 transition-all"
                      >
                        <Sparkles className="w-7 h-7 drop-shadow-md" />
                      </motion.button>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-white/70 font-bold uppercase tracking-wider">SÜPER LİKE</span>
                        <span className="text-[8px] text-white/50 font-medium uppercase">{superLikes} KALDI</span>
                      </div>
                    </div>

                    {/* LIKE (HEART) */}
                    <div className="flex flex-col items-center gap-1">
                      <motion.button 
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => { e.stopPropagation(); handleSwipe('like'); }}
                        className="w-14 h-14 bg-gradient-to-tr from-rose-600 to-pink-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-600/20 border border-white/10 transition-all"
                      >
                        <Heart className="w-6 h-6 fill-white drop-shadow-md" />
                      </motion.button>
                      <span className="text-[10px] text-white/70 font-bold uppercase tracking-wider">BEĞEN</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* REPORT MODAL */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="w-full max-w-xs bg-white rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-8 text-center border-b border-black/5">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-serif font-black text-heading">Güven Bölgesi</h3>
                <p className="text-xs text-body mt-2">Bu profilde seni rahatsız eden nedir?</p>
              </div>
              <div className="p-3">
                {['Spam / Sahte', 'Uygunsuz İçerik', 'Rahatsız Edici'].map((reason) => (
                  <button key={reason} onClick={() => handleReport(reason)} className="w-full px-6 py-4 text-left text-sm font-bold text-heading hover:bg-black/5 transition-colors rounded-2xl flex items-center justify-between group">
                    {reason}
                    <ChevronRight className="w-4 h-4 text-muted group-hover:text-heading transition-all" />
                  </button>
                ))}
              </div>
              <button onClick={() => setShowReportModal(false)} className="w-full py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] hover:text-heading transition-colors bg-slate-50">
                VAZGEÇ
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROFILE POPUP */}
      <AnimatePresence>
        {selectedProfile ? (
          <div className="fixed inset-0 z-[99999] bg-black overflow-y-auto">
            <MatchingProfilePopup 
              user={selectedProfile}
              currentUser={liveUser}
              onClose={() => setSelectedProfile(null)}
              onAction={(type) => {
                setSelectedProfile(null);
                handleSwipe(type);
              }}
            />
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
