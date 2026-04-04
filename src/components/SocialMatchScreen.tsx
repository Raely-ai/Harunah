import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  Sparkles,
  X,
  Plus,
  AlertCircle
} from "lucide-react";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  limit,
  updateDoc
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile } from "../types";
import { toast } from "sonner";
import { calculateCompatibility } from "../lib/compatibilityEngine";
import { getTargetGender, isEligibleSocialUser } from "../lib/socialUtils";
import { canSwipe, getRemainingSwipes, FREE_DAILY_LIMIT } from "../lib/swipeHelper";
import { socialService } from "../lib/socialService";
import OptimizedImage from "./OptimizedImage";

export default function SocialMatchScreen({ currentUser, onNavigate, isActive }: { currentUser: UserProfile, onNavigate: (tab: any) => void, isActive?: boolean }) {
  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(new Set([currentUser.uid]));
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const displayMatches = useMemo(() => {
    return potentialMatches.filter(u => !swipedUserIds.has(u.uid));
  }, [potentialMatches, swipedUserIds]);

  const activeUser = displayMatches[0];

  // Listen for swipes to know who to exclude
  useEffect(() => {
    if (!currentUser.uid || !isActive) return;
    
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
  }, [currentUser.uid, isActive]);

  // Listen for potential matches in real-time
  useEffect(() => {
    if (!currentUser.uid || !isActive) return;

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
  }, [currentUser.uid, currentUser.social?.gender, isActive]); // Added isActive

  const handleSwipe = async (type: 'like' | 'pass' | 'super_like') => {
    if (!activeUser || isAnimating || isProcessing) return;
    
    if (!canSwipe(currentUser)) {
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
      await updateDoc(doc(db, "users", currentUser.uid), {
        dailySwipeUsed: newUsed,
        dailySwipeDate: today
      });
      
      await socialService.sendLike(currentUser, targetUser.uid, type);
      
      if (type === 'super_like') {
        toast.success("Süper Like gönderildi! ✨");
      }
    } catch (error) {
      console.error("Swipe error:", error);
      setIsProcessing(false);
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
    <div className="flex-1 bg-black flex flex-col overflow-hidden">
      {/* Main Area */}
      <div className="flex-1 relative overflow-hidden">
        {loading && potentialMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <div className="w-12 h-12 border-4 border-white/5 border-t-amber-500 rounded-full animate-spin" />
            <p className="text-zinc-500 text-sm font-medium">Yıldızlar eşleşiyor...</p>
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
                <div className="relative w-24 h-24 bg-white/[0.03] border border-white/10 rounded-[2.5rem] flex items-center justify-center mx-auto text-amber-500 shadow-2xl backdrop-blur-xl">
                  <Sparkles className="w-12 h-12" />
                </div>
              </div>
              <h3 className="text-2xl font-serif font-bold text-white mb-3">Keşif Bitti</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">
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
          <AnimatePresence mode="popLayout">
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
                <OptimizedImage 
                  src={photos[currentPhotoIndex]}
                  alt={activeUser.nickname}
                  className="w-full h-full object-cover"
                  containerClassName="w-full h-full"
                />
                
                {/* Photo Navigation Indicators */}
                {photos.length > 1 && (
                  <>
                    <div className="absolute top-14 left-6 right-6 flex gap-1.5 z-30">
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
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/60 pointer-events-none z-10" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none z-10" />

              {/* Screen Title */}
              <div className="absolute top-14 left-0 right-0 flex justify-center z-30 pointer-events-none">
                <h1 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40 drop-shadow-lg">
                  Karşılaşma
                </h1>
              </div>

              {/* Report Button */}
              <button className="absolute top-20 right-6 p-3 bg-black/40 backdrop-blur-xl rounded-2xl text-white/60 hover:text-white hover:bg-black/60 transition-all border border-white/5 z-30">
                <AlertCircle className="w-5 h-5" />
              </button>

              {/* Scores (Top Overlay) */}
              <div className="absolute top-28 left-6 right-6 flex gap-2.5 z-30 pointer-events-none">
                <div className="flex-1 bg-rose-500/20 backdrop-blur-xl rounded-2xl p-2.5 text-center border border-rose-500/30 shadow-lg">
                  <div className="text-[8px] uppercase text-rose-200/60 font-black tracking-widest mb-0.5">Aşk</div>
                  <div className="text-xl font-black text-rose-100">%{compatibility?.love || 0}</div>
                </div>
                <div className="flex-1 bg-blue-500/20 backdrop-blur-xl rounded-2xl p-2.5 text-center border border-blue-500/30 shadow-lg">
                  <div className="text-[8px] uppercase text-blue-200/60 font-black tracking-widest mb-0.5">Dost</div>
                  <div className="text-xl font-black text-blue-100">%{compatibility?.friendship || 0}</div>
                </div>
                <div className="flex-1 bg-amber-500/20 backdrop-blur-xl rounded-2xl p-2.5 text-center border border-amber-500/30 shadow-lg">
                  <div className="text-[8px] uppercase text-amber-200/60 font-black tracking-widest mb-0.5">Uyum</div>
                  <div className="text-xl font-black text-amber-100">%{compatibility?.understanding || 0}</div>
                </div>
              </div>

              {/* Info & Actions Container */}
              <div className="absolute bottom-28 left-0 right-0 px-8 z-30 flex flex-col gap-8">
                {/* User Info */}
                <div className="text-white">
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-4xl font-serif font-bold tracking-tight drop-shadow-lg">
                      {activeUser.social?.nickname || activeUser.nickname}, {activeUser.age}
                    </h2>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 backdrop-blur-xl px-3 py-1.5 rounded-full border border-white/10">
                      {activeUser.zodiacSign || "Burç"}
                    </span>
                  </div>
                  <p className="text-base text-zinc-200 line-clamp-2 leading-relaxed font-medium drop-shadow-md">
                    {activeUser.social?.bio || activeUser.bio || "Bio henüz eklenmemiş."}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-center gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSwipe('pass')} 
                      className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 text-white flex items-center justify-center hover:bg-black/60 transition-all shadow-2xl"
                    >
                      <X className="w-8 h-8" />
                    </motion.button>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Geç</span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleSwipe('super_like')} 
                      className="w-14 h-14 rounded-full bg-amber-500/20 backdrop-blur-2xl border border-amber-500/30 text-amber-400 flex items-center justify-center hover:bg-amber-500/30 transition-all shadow-2xl"
                    >
                      <Sparkles className="w-6 h-6" />
                    </motion.button>
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500/60">Süper</span>
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      animate={isActive ? { 
                        boxShadow: ["0 0 20px rgba(244,63,94,0.2)", "0 0 40px rgba(244,63,94,0.5)", "0 0 20px rgba(244,63,94,0.2)"]
                      } : { boxShadow: "0 0 20px rgba(244,63,94,0.2)" }}
                      transition={{ repeat: Infinity, duration: 3 }}
                      onClick={() => handleSwipe('like')} 
                      className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-600 to-rose-500 text-white flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.4)] border border-rose-400/20 transition-all"
                    >
                      <Heart className="w-8 h-8 fill-white" />
                    </motion.button>
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">Beğen</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
