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
  Users
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  limit,
  updateDoc,
  increment,
  setDoc,
  serverTimestamp
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile } from "../types";
import { toast } from "sonner";
import { calculateCompatibility } from "../lib/compatibilityEngine";
import { getTargetGender, isEligibleSocialUser } from "../lib/socialUtils";
import { canSwipe, getRemainingSwipes, getDailySwipeLimit } from "../lib/swipeHelper";
import { socialService } from "../lib/socialService";
import { walletService } from "../lib/walletService";

import { reportService } from "../services/reportService";

export default function SocialMatchScreen({ currentUser, onNavigate }: { currentUser: UserProfile, onNavigate: (tab: any) => void }) {
  // Safe access with fallbacks
  const uid = currentUser?.uid || "";
  const superLikes = currentUser?.superLikes || 0;
  const social = currentUser?.social || { photos: [], nickname: "", bio: "", zodiacSign: "" };

  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(new Set([uid]));
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");

  const displayMatches = useMemo(() => {
    return potentialMatches.filter(u => !swipedUserIds.has(u.uid));
  }, [potentialMatches, swipedUserIds]);

  const activeUser = displayMatches[0];

  // Listen for swipes to know who to exclude
  useEffect(() => {
    if (!uid) return;
    
    const q = query(
      collection(db, "swipes"),
      where("fromUserId", "==", uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreIds = snapshot.docs.map(doc => doc.data().toUserId);
      setSwipedUserIds(prev => {
        const next = new Set(prev);
        firestoreIds.forEach(id => next.add(id));
        return next;
      });
    }, (error) => {
      console.error("Swipes listener error:", error);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Listen for potential matches in real-time
  useEffect(() => {
    if (!uid) return;

    const targetGender = getTargetGender(currentUser);
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("social.enabled", "==", true),
      where("social.profileCompleted", "==", true),
      where("social.visible", "==", true),
      where("social.gender", "==", targetGender),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => isEligibleSocialUser(u, uid, targetGender));

      // Sort by compatibility score
      fetchedUsers.sort((a, b) => {
        const scoreA = calculateCompatibility(currentUser, a).overallScore || 0;
        const scoreB = calculateCompatibility(currentUser, b).overallScore || 0;
        return scoreB - scoreA;
      });

      setPotentialMatches(fetchedUsers);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid, currentUser?.social?.gender]); // Minimal dependencies

  const handleSwipe = async (type: 'like' | 'pass' | 'super_like') => {
    if (!activeUser || isAnimating || isProcessing) return;
    
    // Super Like Check
    if (type === 'super_like' && superLikes <= 0) {
      onNavigate('wallet');
      return;
    }

    if (type !== 'pass' && !canSwipe(currentUser)) {
      toast.error("Günlük swipe hakkın bitti!");
      onNavigate('wallet');
      return;
    }

    setIsProcessing(true);
    setIsAnimating(true);
    if (type === 'pass') setExitDirection('left');
    else if (type === 'like') setExitDirection('right');
    else setExitDirection('up');

    const targetUser = activeUser;
    
    // Optimistic update local state after animation
    setTimeout(() => {
      setSwipedUserIds(prev => new Set(prev).add(targetUser.uid));
      setExitDirection(null);
      setIsAnimating(false);
      setIsProcessing(false);
    }, 400);

    try {
      if (type === 'super_like') {
        const res = await walletService.consumeSocialFeature(uid, 'superLike');
        if (!res.success) {
          toast.error("Süper Like hakkın bitti!");
          onNavigate('wallet');
          return;
        }
        if (res.consumedFrom === 'daily_bonus') {
          toast.success("Günlük ücretsiz Süper Like hakkın kullanıldı! ✨");
        }
      } else if (type === 'like') {
        const res = await walletService.consumeSocialFeature(uid, 'swipe');
        if (!res.success) {
          toast.error("Günlük kaydırma hakkın bitti!");
          onNavigate('wallet');
          return;
        }
      }
      
      await socialService.sendLike(currentUser, targetUser.uid, type);
      
      if (type === 'super_like') {
        toast.success("Süper Like gönderildi! ✨");
      }
    } catch (error: any) {
      console.error("Swipe error:", error);
      toast.error(error.message || "İşlem sırasında bir hata oluştu.");
      setIsProcessing(false);
    }
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
            <div className="absolute top-[calc(env(safe-area-inset-top,1rem)+5.5rem)] left-6 z-20 flex flex-col gap-2">
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/10 text-white"
              >
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                <span className="text-[10px] font-black tabular-nums">
                  {getRemainingSwipes(currentUser)} / {getDailySwipeLimit(currentUser)}
                </span>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/10 text-white"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="text-[10px] font-black tabular-nums">{superLikes}</span>
              </motion.div>
            </div>

            {/* REPORT BUTTON */}
            <div className="absolute top-[calc(env(safe-area-inset-top,1rem)+5.5rem)] right-6 z-20">
              <button 
                onClick={() => setShowReportModal(true)}
                className="p-2.5 bg-black/20 backdrop-blur-sm rounded-full text-white/70 hover:text-white border border-white/10 transition-colors"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>

            {/* BOTTOM CONTENT AREA */}
            <div className="absolute inset-x-0 bottom-0 z-20 pb-[calc(env(safe-area-inset-bottom,1.5rem)+1rem)] px-6 flex flex-col items-center">
              
              {/* COMPATIBILITY CIRCLES (WOW AREA) */}
              <div className="flex items-center justify-center gap-6 mb-8">
                {[
                  { label: 'Aşk', value: compatibility?.love || 0, color: '#f43f5e', icon: Heart },
                  { label: 'Dost', value: compatibility?.friendship || 0, color: '#3b82f6', icon: Users },
                  { label: 'Uyum', value: compatibility?.understanding || 0, color: '#f59e0b', icon: Sparkles }
                ].map((item, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.1, type: "spring" }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div className="relative w-14 h-14 flex items-center justify-center bg-black/20 rounded-full border border-white/5">
                      <svg className="w-full h-full -rotate-90 p-1">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="white" strokeWidth="3" className="opacity-10" />
                        <motion.circle 
                          cx="28" cy="28" r="24" fill="none" stroke={item.color} strokeWidth="3" 
                          strokeDasharray="150.8"
                          initial={{ strokeDashoffset: 150.8 }}
                          animate={{ strokeDashoffset: 150.8 - (150.8 * item.value) / 100 }}
                          transition={{ duration: 2, ease: "easeOut", delay: 0.6 + idx * 0.1 }}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className="absolute text-[10px] font-black text-white">%{item.value}</span>
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/80">{item.label}</span>
                  </motion.div>
                ))}
              </div>

              {/* USER INFO */}
              <div className="w-full text-center space-y-2 mb-8">
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center justify-center gap-3"
                >
                  <h2 className="text-3xl font-serif font-black text-white drop-shadow-lg">
                    {activeUser.social?.nickname || activeUser.nickname}, {activeUser.age}
                  </h2>
                  <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-[9px] font-black text-white uppercase tracking-widest backdrop-blur-sm">
                    {activeUser.zodiacSign || "Burç"}
                  </div>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-1"
                >
                  <p className="text-sm text-white/80 font-medium max-w-sm mx-auto drop-shadow-md line-clamp-2">
                    {activeUser.social?.bio || activeUser.bio || "Bio henüz eklenmemiş."}
                  </p>
                  {compatibility && (
                    <motion.p 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 1.2 }}
                      className="text-[10px] text-amber-300/90 font-bold italic"
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
                  <div className="h-px w-4 bg-amber-500/50" />
                  <p className="text-[9px] font-black text-amber-400 uppercase tracking-[0.2em]">
                    Karşılaştığın için uyumunu ücretsiz görüyorsun
                  </p>
                  <div className="h-px w-4 bg-amber-500/50" />
                </motion.div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-center gap-6 w-full max-w-xs">
                {/* PASS BUTTON */}
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleSwipe('pass')} 
                  className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/60 flex items-center justify-center transition-all hover:text-white"
                >
                  <X className="w-6 h-6" />
                </motion.button>

                {/* SUPER LIKE BUTTON */}
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSwipe('super_like')} 
                  className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.3)] border border-amber-300/30 relative group overflow-hidden"
                >
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0"
                  />
                  <Sparkles className="w-7 h-7 fill-white/20 relative z-10" />
                  <div className="absolute -top-1 -right-1 bg-white text-amber-600 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-500 shadow-lg z-20">
                    {superLikes}
                  </div>
                </motion.button>

                {/* LIKE BUTTON */}
                <motion.button 
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSwipe('like')} 
                  className="w-20 h-20 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.4)] border border-rose-400/30 relative overflow-hidden"
                >
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-white/10 rounded-full"
                  />
                  <Heart className="w-9 h-9 fill-white relative z-10" />
                </motion.button>
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
