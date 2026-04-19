import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  Sparkles,
  X,
  Plus,
  AlertCircle,
  Flag,
  MoreVertical,
  ShieldAlert,
  ChevronRight,
  Handshake
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
  serverTimestamp
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

// Simple Memory Cache for Social Match
const matchCache = {
  potentialMatches: [] as UserProfile[],
  swipedUserIds: new Set<string>(),
  isLoaded: false,
  lastFetched: 0
};

export default function SocialMatchScreen({ currentUser, onNavigate, isActive }: { currentUser: UserProfile, onNavigate: (tab: any) => void, isActive?: boolean }) {
  // Safe access with fallbacks
  const uid = currentUser?.uid || "";
  const superLikes = currentUser?.superLikes || 0;
  const social = currentUser?.social || { photos: [], nickname: "", bio: "", zodiacSign: "" };

  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>(matchCache.potentialMatches);
  const [loading, setLoading] = useState(!matchCache.isLoaded);
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(matchCache.swipedUserIds.size > 0 ? matchCache.swipedUserIds : new Set([uid]));
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const displayMatches = useMemo(() => {
    return potentialMatches.filter(u => !swipedUserIds.has(u.uid));
  }, [potentialMatches, swipedUserIds]);

  const activeUser = displayMatches[0];

  const hasFetchedRef = React.useRef(false);

  // Fetch swipes and potential matches (One-time fetch per activation with cache)
  useEffect(() => {
    if (!uid || !isActive || !isSocialProfileReady(currentUser)) {
      if (!isActive) hasFetchedRef.current = false; // Reset when tab inactive
      return;
    }
    
    // Prevent redundant fetches within the same active session
    if (hasFetchedRef.current) return;
    
    const fetchData = async () => {
      if (!isActive || !isSocialProfileReady(currentUser)) return;
      
      hasFetchedRef.current = true;
      // 1. Cache-First: Try to load from cache and update UI immediately
      let hasCache = false;
      const cached = cacheManager.get<any>("match_feed");
      if (cached) {
        setPotentialMatches(cached.potentialMatches || []);
        setSwipedUserIds(new Set(cached.swipedUserIds || [uid]));
        setLoading(false);
        hasCache = true;
        // If cache is fresh (e.g. < 1 min), don't even background fetch
        if (Date.now() - (cached._timestamp || 0) < 60000) {
          return;
        }
      }

      if (!hasCache) {
        setLoading(true);
      }
      try {
        // 1. Get Swipes (Use local cache first to avoid re-fetching)
        let swipedIds = cacheManager.get<string[]>("socialSwipedIds");
        if (!swipedIds) {
          swipedIds = await socialService.getSwipedUserIds(uid);
          // Cache the swipes globally for this session
          cacheManager.set("socialSwipedIds", swipedIds, 300); 
        }
        const newSwipedIds = new Set([uid, ...swipedIds]);
        setSwipedUserIds(newSwipedIds);

        // 2. Fetch Potential Matches
        const targetGender = getTargetGender(currentUser);
        
        const usersRef = collection(db, "users");
        const matchQ = query(
          usersRef,
          where("social.enabled", "==", true),
          where("social.profileCompleted", "==", true),
          where("social.visible", "==", true),
          where("social.gender", "==", targetGender),
          limit(20) // Reduced from 100 to 20 for better performance
        );

        const snapshot = await getDocs(matchQ);
        
        const rawUsers = snapshot.docs.map(doc => normalizeUserProfile(doc.data(), doc.id));
        const fetchedUsers = rawUsers.filter(u => {
            const eligible = isEligibleSocialUser(u, uid, targetGender);
            const isSwiped = newSwipedIds.has(u.uid);
            return eligible && !isSwiped;
          });

        console.log(`[SocialMatch] Summary: Total Raw: ${rawUsers.length}, Swiped/Ineligible: ${rawUsers.length - fetchedUsers.length}, Final: ${fetchedUsers.length}`);

        // Sort by compatibility score
        fetchedUsers.sort((a, b) => {
          const scoreA = calculateCompatibility(currentUser, a).overallScore || 0;
          const scoreB = calculateCompatibility(currentUser, b).overallScore || 0;
          return scoreB - scoreA;
        });

        // Optimization: Show first card immediately, prepare others in background
        if (fetchedUsers.length > 0) {
          setPotentialMatches([fetchedUsers[0]]);
          setTimeout(() => {
            setPotentialMatches(fetchedUsers);
          }, 200);
        } else {
          setPotentialMatches([]);
        }
        
        // Update Cache
        cacheManager.set("match_feed", {
          potentialMatches: fetchedUsers,
          swipedUserIds: Array.from(newSwipedIds)
        }, 600, true);

      } catch (error) {
        console.error("Match fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [uid, isActive]);

  const handleSwipe = async (type: 'like' | 'pass' | 'super_like') => {
    if (!activeUser || isAnimating || isProcessing) return;
    
    // Super Like Check
    if (type === 'super_like' && superLikes <= 0) {
      onNavigate('wallet');
      return;
    }

    if (type !== 'super_like' && !canSwipe(currentUser)) {
      toast.error("Günlük swipe hakkın bitti!");
      onNavigate('wallet');
      return;
    }

    setIsProcessing(true);
    const targetUser = activeUser;
    const oldSwipedUserIds = new Set(swipedUserIds);
    
    // 1. Optimistic UI Update: Move to next card and animate Card immediately
    setSwipedUserIds(prev => new Set(prev).add(targetUser.uid));
    setIsAnimating(true);
    if (type === 'pass') setExitDirection('left');
    else if (type === 'like') setExitDirection('right');
    else setExitDirection('up');

    // 2. Clear animation state after transition
    setTimeout(() => {
      setExitDirection(null);
      setIsAnimating(false);
      setIsProcessing(false);
      
      // Update Cache (Arka planda)
      const cached = cacheManager.get<any>("match_feed");
      if (cached) {
        cacheManager.set("match_feed", {
          ...cached,
          swipedUserIds: Array.from(new Set([...cached.swipedUserIds || [], targetUser.uid]))
        }, 600, true);
      }
      cacheManager.clear("discover_feed");
    }, 400);

    // 3. Background API Call
    (async () => {
      try {
        if (type === 'super_like') {
          const res = await walletService.consumeSocialFeature(uid, 'superLike');
          if (!res.success) {
            // Rollback
            setSwipedUserIds(oldSwipedUserIds);
            toast.error("Süper Like hakkın bitti!");
            onNavigate('wallet');
            return;
          }
        } else {
          const res = await walletService.consumeSocialFeature(uid, 'swipe');
          if (!res.success) {
            // Rollback
            setSwipedUserIds(oldSwipedUserIds);
            toast.error("Günlük kaydırma hakkın bitti!");
            onNavigate('wallet');
            return;
          }
        }
        
        const result = await socialService.sendLike(currentUser, targetUser.uid, type);
        
        if (result !== 'SUCCESS' && type !== 'pass') {
          // If it's a critical failure (not just a pass), alert user but don't necessarily rollback swipes 
          // unless it's a specific "already swiped" etc.
          // For simplicity, we only rollback if limits are hit or technical error occurs.
          if (result === 'TECHNICAL_ERROR') {
             setSwipedUserIds(oldSwipedUserIds);
             toast.error("İşlem gerçekleştirilemedi.");
          }
        }
      } catch (error: any) {
        console.error("Background swipe error:", error);
        setSwipedUserIds(oldSwipedUserIds);
        toast.error("Bir hata oluştu, geri alınıyor.");
      }
    })();
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
      // Skip user after report
      handleSwipe('pass');
    } catch (error) {
      console.error("Report error:", error);
      toast.error("Bildirim gönderilirken bir hata oluştu.");
    }
  };

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [activeUser?.uid]);

  const photos = useMemo(() => {
    if (!activeUser) return [];
    return activeUser.social?.photos?.length 
      ? activeUser.social.photos 
      : [activeUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeUser.uid}`];
  }, [activeUser]);

  const compatibility = useMemo(() => {
    if (!activeUser) return null;
    return calculateCompatibility(currentUser, activeUser);
  }, [currentUser, activeUser]);

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photos.length > 0) {
      setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
    }
  };

  return (
    <div className="h-full w-full relative bg-black overflow-hidden">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full space-y-4 bg-[#FDFCFE]">
          <div className="w-12 h-12 border-4 border-black/5 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-muted text-sm font-medium">Yıldızlar eşleşiyor...</p>
        </div>
      ) : !activeUser ? (
        <div className="flex items-center justify-center h-full px-6 bg-[#FDFCFE]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-xs"
          >
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
              <div className="relative w-24 h-24 bg-white border border-black/5 rounded-[2.5rem] flex items-center justify-center mx-auto text-amber-600 shadow-2xl backdrop-blur-xl">
                <Sparkles className="w-12 h-12" />
              </div>
            </div>
            <h3 className="text-2xl font-serif font-bold text-heading mb-3">Keşif Bitti</h3>
            <p className="text-body text-sm leading-relaxed">
              Şu an için kriterlerine uygun yeni kimse kalmadı. Yeni birileri gelince burada görünecek!
            </p>
            <button 
              onClick={() => onNavigate('home')}
              className="mt-10 px-8 py-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-2xl font-bold text-sm shadow-2xl shadow-amber-900/20 hover:bg-amber-600 transition-all"
            >
              Ana Sayfaya Dön
            </button>
          </motion.div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeUser.uid}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              x: exitDirection === 'left' ? -500 : exitDirection === 'right' ? 500 : 0,
              y: exitDirection === 'up' ? -500 : 0,
              rotate: exitDirection === 'left' ? -30 : exitDirection === 'right' ? 30 : 0,
              scale: exitDirection ? 0.8 : 1
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="absolute inset-0 w-full h-full"
          >
            {/* FULL SCREEN PHOTO */}
            <div className="absolute inset-0 z-0">
              <img 
                src={photos[currentPhotoIndex]}
                alt={activeUser.nickname}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              
              {/* Photo Navigation Overlay (Invisible areas for tapping) */}
              <div className="absolute inset-0 flex z-10">
                <div className="flex-1 h-full cursor-pointer" onClick={prevPhoto} />
                <div className="flex-1 h-full cursor-pointer" onClick={nextPhoto} />
              </div>

              {/* Photo Navigation Indicators (Top) */}
              {photos.length > 1 && (
                <div className="absolute top-[calc(env(safe-area-inset-top,1rem)+4rem)] left-6 right-6 flex gap-1.5 z-20">
                  {photos.map((_, idx) => (
                    <div key={idx} className={`h-1 flex-1 rounded-full transition-all duration-300 ${idx === currentPhotoIndex ? 'bg-white shadow-lg' : 'bg-white/30'}`} />
                  ))}
                </div>
              )}

              {/* Subtle Bottom Shadow for Text Readability */}
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-[5]" />
            </div>

            {/* TOP STATS (Swipe/Super Like Rights) */}
            <div className="absolute top-[calc(env(safe-area-inset-top,1rem)+72px)] left-0 right-0 z-20 flex justify-center px-6">
              <div className="flex items-center gap-3">
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 text-white shadow-2xl"
                >
                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <span className="text-[11px] font-black tabular-nums tracking-wider drop-shadow-md">
                    {getRemainingSwipes(currentUser)} / {getDailySwipeLimit(currentUser)}
                  </span>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 text-white shadow-2xl"
                >
                  <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="text-[11px] font-black tabular-nums tracking-wider drop-shadow-md">{superLikes}</span>
                </motion.div>
              </div>
            </div>

            {/* REPORT BUTTON */}
            <div className="absolute top-[calc(env(safe-area-inset-top,1rem)+72px)] right-6 z-20">
              <button 
                onClick={() => setShowReportModal(true)}
                className="p-2.5 bg-black/40 backdrop-blur-xl rounded-full text-white/70 hover:text-white border border-white/20 transition-colors shadow-xl"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>

            {/* ACTION BAR (Elevated to avoid BottomNav overlap) */}
            <div 
              className="absolute inset-x-0 z-30 px-6 flex justify-center pointer-events-none"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 1.5rem) + 80px)' }}
            >
              <div className="flex items-end justify-center gap-8 w-full max-w-sm pointer-events-auto">
                {/* PASS BUTTON */}
                <div className="flex flex-col items-center gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSwipe('pass')} 
                    className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/70 flex items-center justify-center transition-all hover:text-white shadow-lg"
                  >
                    <X className="w-6 h-6" />
                  </motion.button>
                  <span className="text-[10px] font-black text-white/80 uppercase tracking-widest drop-shadow-md">GEÇ</span>
                </div>

                {/* SUPER LIKE BUTTON */}
                <div className="flex flex-col items-center gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSwipe('super_like')} 
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-white flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.5)] border-2 border-amber-300/40 relative group overflow-hidden"
                  >
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0"
                    />
                    <Sparkles className="w-9 h-9 fill-white/30 relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                    <div className="absolute top-1 right-1 bg-white text-amber-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-500 shadow-lg z-20 scale-90">
                      {superLikes}
                    </div>
                  </motion.button>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest drop-shadow-md">SÜPER LIKE</span>
                    <span className="text-[8px] font-bold text-amber-300/80 uppercase tracking-tighter">{superLikes} kaldı</span>
                  </div>
                </div>

                {/* LIKE BUTTON */}
                <div className="flex flex-col items-center gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleSwipe('like')} 
                    className="w-18 h-18 rounded-full bg-gradient-to-br from-rose-500 via-rose-600 to-pink-600 text-white flex items-center justify-center shadow-[0_0_30_rgba(244,63,94,0.5)] border-2 border-rose-400/40 relative overflow-hidden"
                  >
                    <motion.div 
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-white/20 rounded-full"
                    />
                    <Heart className="w-9 h-9 fill-white relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  </motion.button>
                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest drop-shadow-md">BEĞEN</span>
                </div>
              </div>
            </div>

            {/* INFO AREA (Positioned above Action Bar) */}
            <div 
              className="absolute inset-x-0 z-20 px-6 flex flex-col items-center pointer-events-none"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 1.5rem) + 200px)' }}
            >
              {/* COMPATIBILITY INLINE (Minimal) */}
              <div className="flex items-center justify-center gap-4 mb-2 pointer-events-auto">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                  <span className="text-sm font-black text-white drop-shadow-lg">%{compatibility?.love || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Handshake className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm font-black text-white drop-shadow-lg">%{compatibility?.friendship || 0}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-sm font-black text-white drop-shadow-lg">%{compatibility?.understanding || 0}</span>
                </div>
              </div>

              {/* USER INFO */}
              <div className="w-full text-center space-y-2 pointer-events-auto">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-center gap-3"
                >
                  <h2 className="text-3xl font-serif font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                    {activeUser.social?.nickname || activeUser.nickname}, {activeUser.age}
                  </h2>
                  <div className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-[9px] font-black text-white uppercase tracking-widest backdrop-blur-md shadow-lg">
                    {activeUser.zodiacSign || "Burç"}
                  </div>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-1"
                >
                  <p className="text-xs text-white/90 font-medium max-w-sm mx-auto drop-shadow-md line-clamp-2">
                    {activeUser.social?.bio || activeUser.bio || "Bio henüz eklenmemiş."}
                  </p>
                  {compatibility && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 }}
                      className="text-[9px] text-amber-300/90 font-bold italic drop-shadow-md"
                    >
                      {compatibility.understanding > 80 ? "✨ Ruh ikizi potansiyeli çok yüksek!" : 
                       compatibility.understanding > 60 ? "💫 Yıldızlarınız oldukça uyumlu görünüyor." :
                       "🌙 Enerjileriniz keşfedilmeyi bekliyor."}
                    </motion.p>
                  )}
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex items-center justify-center gap-2 pt-1"
                >
                  <div className="h-px w-4 bg-white/30" />
                  <p className="text-[8px] font-black text-white/60 uppercase tracking-[0.2em] drop-shadow-md">
                    Karşılaştığın için uyumunu ücretsiz görüyorsun
                  </p>
                  <div className="h-px w-4 bg-white/30" />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-xs bg-white rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-6 text-center border-b border-black/5">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-serif font-bold text-heading">Kullanıcıyı Bildir</h3>
                <p className="text-xs text-body mt-1">Lütfen bildirme nedenini seçin</p>
              </div>
              
              <div className="p-2">
                {['Spam', 'Sahte profil', 'Rahatsız edici', 'Diğer'].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => handleReport(reason)}
                    className="w-full px-6 py-4 text-left text-sm font-bold text-heading hover:bg-black/5 transition-colors rounded-2xl flex items-center justify-between group"
                  >
                    {reason}
                    <ChevronRight className="w-4 h-4 text-muted group-hover:text-heading transition-colors" />
                  </button>
                ))}
              </div>
              
              <div className="p-4 bg-black/5">
                <button 
                  onClick={() => setShowReportModal(false)}
                  className="w-full py-3 text-sm font-black text-muted uppercase tracking-widest hover:text-heading transition-colors"
                >
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
