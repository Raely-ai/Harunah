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
import { canSwipe, getRemainingSwipes, FREE_DAILY_LIMIT } from "../lib/swipeHelper";
import { socialService } from "../lib/socialService";
import { walletService } from "../lib/walletService";

export default function SocialMatchScreen({ currentUser, onNavigate }: { currentUser: UserProfile, onNavigate: (tab: any) => void }) {
  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(new Set([currentUser.uid]));
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
    if (!currentUser.uid) return;
    
    const q = query(
      collection(db, "swipes"),
      where("fromUserId", "==", currentUser.uid)
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
    if (!currentUser.uid) return;

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
        .filter(u => isEligibleSocialUser(u, currentUser.uid, targetGender));

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
  }, [currentUser.uid, currentUser.social?.gender]); // Minimal dependencies

  const handleSwipe = async (type: 'like' | 'pass' | 'super_like') => {
    if (!activeUser || isAnimating || isProcessing) return;
    
    // Super Like Check
    if (type === 'super_like' && (currentUser.superLikes || 0) <= 0) {
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
    
    const today = new Date().toISOString().split('T')[0];
    const newUsed = (currentUser.dailySwipeDate === today ? (currentUser.dailySwipeUsed || 0) : 0) + 1;
    
    // Optimistic update local state after animation
    setTimeout(() => {
      setSwipedUserIds(prev => new Set(prev).add(targetUser.uid));
      setExitDirection(null);
      setIsAnimating(false);
      setIsProcessing(false);
    }, 400);

    try {
      const updateData: any = {
        dailySwipeUsed: newUsed,
        dailySwipeDate: today
      };

      if (type === 'super_like') {
        const consumed = await walletService.consumeSocialFeature(currentUser.uid, 'superLike');
        if (!consumed) {
          toast.error("Süper Like hakkın bitti!");
          onNavigate('wallet');
          return;
        }
      }

      await updateDoc(doc(db, "users", currentUser.uid), updateData);
      
      await socialService.sendLike(currentUser, targetUser.uid, type);
      
      if (type === 'super_like') {
        toast.success("Süper Like gönderildi! ✨");
      }
    } catch (error) {
      console.error("Swipe error:", error);
      setIsProcessing(false);
    }
  };

  const handleReport = async (reason: string) => {
    if (!activeUser) return;
    try {
      await socialService.reportUser(currentUser.uid, activeUser.uid, 'explore', reason);
      toast.success("Bildirimin alındı, teşekkürler.");
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
    <div className="h-full w-full relative">
      {loading ? (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="w-12 h-12 border-4 border-black/5 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-muted text-sm font-medium">Yıldızlar eşleşiyor...</p>
        </div>
      ) : !activeUser ? (
        <div className="flex items-center justify-center h-full px-6">
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
        <AnimatePresence>
          <motion.div
            key={activeUser.uid}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 1,
              x: exitDirection === 'left' ? -400 : exitDirection === 'right' ? 400 : 0,
              y: exitDirection === 'up' ? -400 : 0,
              rotate: exitDirection === 'left' ? -20 : exitDirection === 'right' ? 20 : 0
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 w-full h-full"
          >
            {/* Full Screen Photo */}
            <div 
              className="w-full h-full relative"
              onTouchStart={(e) => {
                const touch = e.touches[0];
                const startX = touch.clientX;
                (e.currentTarget as any).startX = startX;
              }}
              onTouchEnd={(e) => {
                const touch = e.changedTouches[0];
                const startX = (e.currentTarget as any).startX;
                const diff = touch.clientX - startX;
                if (Math.abs(diff) > 50) {
                  if (diff > 0) prevPhoto(e as any);
                  else nextPhoto(e as any);
                }
              }}
            >
              <img 
                src={photos[currentPhotoIndex]}
                alt={activeUser.nickname}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              
              {/* Photo Navigation Indicators */}
              {photos.length > 1 && (
                <>
                  <div className="absolute top-32 left-6 right-6 flex gap-1.5 z-30">
                    {photos.map((_, idx) => (
                      <div key={idx} className={`h-1 flex-1 rounded-full transition-all ${idx === currentPhotoIndex ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-white/30'}`} />
                    ))}
                  </div>
                  <div className="absolute inset-y-0 left-0 w-1/3 cursor-pointer z-20" onClick={prevPhoto} />
                  <div className="absolute inset-y-0 right-0 w-1/3 cursor-pointer z-20" onClick={nextPhoto} />
                </>
              )}
            </div>
            
            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#F6F4F8] via-transparent to-black/40 pointer-events-none z-10" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#F6F4F8] via-[#F6F4F8]/40 to-transparent pointer-events-none z-10" />

            {/* Report Button */}
            <button 
              onClick={() => setShowReportModal(true)}
              className="absolute top-32 right-6 p-2.5 bg-white/20 backdrop-blur-md rounded-xl text-white/80 hover:text-white hover:bg-white/30 transition-all border border-white/10 z-30 shadow-lg"
            >
              <Flag className="w-4 h-4" />
            </button>

            {/* User Limit Display (Top Center) */}
            <div className="absolute top-32 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white shadow-lg">
                <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                <span className="text-[10px] font-black tabular-nums">{getRemainingSwipes(currentUser)}</span>
                <button 
                  onClick={() => onNavigate('wallet')}
                  className="ml-1 p-0.5 rounded-full bg-white/20 hover:bg-white/40 transition-colors"
                >
                  <Plus className="w-2.5 h-2.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white shadow-lg">
                <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span className="text-[10px] font-black tabular-nums">{currentUser.superLikes || 0}</span>
              </div>
            </div>

            {/* Scores (Top Overlay) */}
            <div className="absolute top-44 left-6 right-6 flex flex-col gap-3 z-30">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/10 shadow-2xl flex items-center justify-around">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Heart className="w-2.5 h-2.5 text-rose-500 fill-rose-500" />
                    <span className="text-[8px] uppercase text-white/60 font-black tracking-widest">Aşk</span>
                  </div>
                  <div className={`text-lg font-black ${
                    (compatibility?.love || 0) < 50 ? 'text-rose-400' : 
                    (compatibility?.love || 0) < 75 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    %{compatibility?.love || 0}
                  </div>
                </div>
                
                <div className="w-px h-8 bg-white/10" />

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Users className="w-2.5 h-2.5 text-blue-400 fill-blue-400" />
                    <span className="text-[8px] uppercase text-white/60 font-black tracking-widest">Dost</span>
                  </div>
                  <div className={`text-lg font-black ${
                    (compatibility?.friendship || 0) < 50 ? 'text-rose-400' : 
                    (compatibility?.friendship || 0) < 75 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    %{compatibility?.friendship || 0}
                  </div>
                </div>

                <div className="w-px h-8 bg-white/10" />

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1 mb-0.5">
                    <Sparkles className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                    <span className="text-[8px] uppercase text-white/60 font-black tracking-widest">Uyum</span>
                  </div>
                  <div className={`text-lg font-black ${
                    (compatibility?.understanding || 0) < 50 ? 'text-rose-400' : 
                    (compatibility?.understanding || 0) < 75 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    %{compatibility?.understanding || 0}
                  </div>
                </div>
              </div>

              {/* Emotional Hint Text */}
              <div className="text-center">
                <p className="text-[10px] font-medium text-white/80 italic drop-shadow-sm">
                  { (compatibility?.overallScore || 0) > 80 ? "Aranızda gerçek bir kıvılcım var!" :
                    (compatibility?.overallScore || 0) > 60 ? "Enerjiniz kararsız ama açık." :
                    "Düşük ama sürpriz olabilir." }
                </p>
              </div>
            </div>

            {/* Info & Actions Container */}
            <div className="absolute bottom-32 left-0 right-0 px-8 z-30 flex flex-col gap-6">
              {/* User Info */}
              <div className="text-heading">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-3xl font-serif font-bold tracking-tight drop-shadow-sm">
                    {activeUser.social?.nickname || activeUser.nickname}, {activeUser.age}
                  </h2>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-black/5 backdrop-blur-xl px-2.5 py-1 rounded-full border border-black/5">
                    {activeUser.zodiacSign || "Burç"}
                  </span>
                </div>
                <p className="text-sm text-body line-clamp-2 leading-relaxed font-medium drop-shadow-sm">
                  {activeUser.social?.bio || activeUser.bio || "Bio henüz eklenmemiş."}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-8">
                <div className="flex flex-col items-center gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSwipe('pass')} 
                    className="w-14 h-14 rounded-full bg-white/40 backdrop-blur-2xl border border-black/5 text-muted flex items-center justify-center hover:bg-white/60 transition-all shadow-xl"
                  >
                    <X className="w-7 h-7" />
                  </motion.button>
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted">Geç</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleSwipe('super_like')} 
                    className="w-16 h-16 rounded-full bg-amber-500/10 backdrop-blur-2xl border border-amber-500/20 text-amber-600 flex items-center justify-center hover:bg-amber-500/20 transition-all shadow-2xl relative"
                  >
                    <Sparkles className="w-7 h-7" />
                    <div className="absolute -bottom-1 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-sm">
                      {currentUser.superLikes || 0} kaldı
                    </div>
                  </motion.button>
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-600/60 mt-1">Süper</span>
                </div>

                <div className="flex flex-col items-center gap-2">
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    animate={{ 
                      boxShadow: ["0 0 20px rgba(244,63,94,0.1)", "0 0 40px rgba(244,63,94,0.3)", "0 0 20px rgba(244,63,94,0.1)"]
                    }}
                    transition={{ repeat: Infinity, duration: 3 }}
                    onClick={() => handleSwipe('like')} 
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-600 to-rose-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.3)] border border-rose-400/20 transition-all"
                  >
                    <Heart className="w-7 h-7 fill-white" />
                  </motion.button>
                  <span className="text-[8px] font-black uppercase tracking-widest text-rose-600">Beğen</span>
                </div>
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
