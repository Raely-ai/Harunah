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
  getDocs, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc,
  getDoc,
  limit,
  updateDoc,
  onSnapshot
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile } from "../types";
import { toast } from "sonner";
import { calculateCompatibility } from "../lib/compatibilityEngine";
import { getTargetGender, isEligibleSocialUser } from "../lib/socialUtils";
import { canSwipe, getRemainingSwipes, FREE_DAILY_LIMIT } from "../lib/swipeHelper";

export default function SocialMatchScreen({ currentUser, onNavigate }: { currentUser: UserProfile, onNavigate: (tab: any) => void }) {
  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipedUserIds, setSwipedUserIds] = useState<Set<string>>(new Set());
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs for stable access in listeners without re-subscribing
  const currentIndexRef = useRef(currentIndex);
  const swipedUserIdsRef = useRef(swipedUserIds);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    swipedUserIdsRef.current = swipedUserIds;
  }, [swipedUserIds]);

  // Listen for swipes to know who to exclude
  useEffect(() => {
    if (!currentUser.uid) return;
    
    const q = query(
      collection(db, "swipes"),
      where("fromUserId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set(snapshot.docs.map(doc => doc.data().toUserId));
      ids.add(currentUser.uid);
      setSwipedUserIds(ids);
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
        .filter(u => isEligibleSocialUser(u, currentUser.uid, targetGender) && !swipedUserIdsRef.current.has(u.uid));

      setPotentialMatches(prev => {
        const fetchedIds = new Set(fetchedUsers.map(u => u.uid));
        const currentIdx = currentIndexRef.current;
        
        let shift = 0;
        prev.forEach((user, idx) => {
          if (idx < currentIdx && !fetchedIds.has(user.uid)) {
            shift++;
          }
        });

        const existingStillEligible = prev.filter(u => fetchedIds.has(u.uid));
        const existingIds = new Set(existingStillEligible.map(u => u.uid));
        const newUsers = fetchedUsers.filter(u => !existingIds.has(u.uid));

        newUsers.sort((a, b) => {
          const scoreA = calculateCompatibility(currentUser, a).overallScore || 0;
          const scoreB = calculateCompatibility(currentUser, b).overallScore || 0;
          return scoreB - scoreA;
        });

        if (shift > 0) {
          setCurrentIndex(old => Math.max(0, old - shift));
        }

        return [...existingStillEligible, ...newUsers];
      });
      
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser.uid, currentUser.social?.gender]); // Minimal dependencies

  const handleSwipe = async (type: 'like' | 'pass' | 'super_like') => {
    if (currentIndex >= potentialMatches.length || isAnimating) return;
    
    if (!canSwipe(currentUser)) {
      toast.error("Günlük swipe hakkın bitti!");
      onNavigate('wallet');
      return;
    }

    setIsAnimating(true);
    if (type === 'pass') setExitDirection('left');
    else if (type === 'like') setExitDirection('right');
    else setExitDirection('up');

    const targetUser = potentialMatches[currentIndex];
    
    const today = new Date().toISOString().split('T')[0];
    const newUsed = (currentUser.dailySwipeDate === today ? (currentUser.dailySwipeUsed || 0) : 0) + 1;
    
    try {
      await updateDoc(doc(db, "users", currentUser.uid), {
        dailySwipeUsed: newUsed,
        dailySwipeDate: today
      });
    } catch (error) {
      console.error("Swipe count update error:", error);
    }

    try {
      await addDoc(collection(db, "swipes"), {
        fromUserId: currentUser.uid,
        toUserId: targetUser.uid,
        type: type,
        createdAt: serverTimestamp()
      });

      if (type === 'super_like') {
        await addDoc(collection(db, "interactionRequests"), {
          fromUserId: currentUser.uid,
          toUserId: targetUser.uid,
          status: 'pending',
          type: 'super_like',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          senderSnapshot: {
            nickname: currentUser.social?.nickname || currentUser.displayName || "İsimsiz",
            photoURL: currentUser.social?.photos?.[0] || currentUser.photoURL || ""
          },
          receiverSnapshot: {
            nickname: targetUser.social?.nickname || targetUser.displayName || "İsimsiz",
            photoURL: targetUser.social?.photos?.[0] || targetUser.photoURL || ""
          }
        });
        
        // Create notification for super like
        await addDoc(collection(db, "notifications"), {
          userId: targetUser.uid,
          type: "message_request",
          title: "Yeni Süper Like!",
          message: `${currentUser.social?.nickname || currentUser.displayName} sana bir Süper Like gönderdi! ✨`,
          data: { fromUserId: currentUser.uid },
          read: false,
          createdAt: serverTimestamp()
        });

        toast.success("Süper Like gönderildi! ✨");
      } else if (type === 'like') {
        // Create notification for like if it doesn't exist to avoid duplicates
        const existingNotificationQ = query(
          collection(db, "notifications"),
          where("userId", "==", targetUser.uid),
          where("type", "==", "like"),
          where("data.fromUserId", "==", currentUser.uid),
          limit(1)
        );
        const existingNotificationSnapshot = await getDocs(existingNotificationQ);

        if (existingNotificationSnapshot.empty) {
          await addDoc(collection(db, "notifications"), {
            userId: targetUser.uid,
            type: "like",
            title: "Yeni Beğeni!",
            message: `${currentUser.social?.nickname || currentUser.displayName} seni beğendi! ❤️`,
            data: { fromUserId: currentUser.uid },
            read: false,
            createdAt: serverTimestamp()
          });
        }

        const reverseSwipeQ = query(
          collection(db, "swipes"),
          where("fromUserId", "==", targetUser.uid),
          where("toUserId", "==", currentUser.uid),
          where("type", "in", ["like", "super_like"])
        );
        const reverseSnapshot = await getDocs(reverseSwipeQ);

        if (!reverseSnapshot.empty) {
          const matchId = [currentUser.uid, targetUser.uid].sort().join('_');
          await setDoc(doc(db, "matches", matchId), {
            userIds: [currentUser.uid, targetUser.uid],
            createdAt: serverTimestamp()
          });

          const chatDoc = await getDoc(doc(db, "chats", matchId));
          if (!chatDoc.exists()) {
            await setDoc(doc(db, "chats", matchId), {
              id: matchId,
              participants: [currentUser.uid, targetUser.uid],
              createdAt: serverTimestamp(),
              lastMessage: "Yeni eşleşme! 👋",
              lastMessageAt: serverTimestamp(),
              status: 'active'
            });

            // Create match notifications for both users
            await addDoc(collection(db, "notifications"), {
              userId: targetUser.uid,
              type: "match",
              title: "Yeni Eşleşme!",
              message: `${currentUser.social?.nickname || currentUser.displayName} ile eşleştin! 🎉`,
              data: { matchId, otherUserId: currentUser.uid },
              read: false,
              createdAt: serverTimestamp()
            });

            await addDoc(collection(db, "notifications"), {
              userId: currentUser.uid,
              type: "match",
              title: "Yeni Eşleşme!",
              message: `${targetUser.social?.nickname || targetUser.displayName} ile eşleştin! 🎉`,
              data: { matchId, otherUserId: targetUser.uid },
              read: false,
              createdAt: serverTimestamp()
            });

            await addDoc(collection(db, "messages"), {
              chatId: matchId,
              senderId: "system",
              text: "Yeni eşleşme! Sohbet başlayabilir.",
              createdAt: serverTimestamp(),
              seen: false,
              type: 'system'
            });
          }
          toast.success("Yeni bir eşleşme! 🎉");
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "swipes");
    }

    setTimeout(() => {
      setCurrentIndex(prev => prev + 1);
      setExitDirection(null);
      setIsAnimating(false);
    }, 400);
  };

  const activeUser = potentialMatches[currentIndex];

  // Safety check for currentIndex
  useEffect(() => {
    if (potentialMatches.length === 0) {
      setCurrentIndex(0);
    } else if (currentIndex >= potentialMatches.length) {
      setCurrentIndex(Math.max(0, potentialMatches.length - 1));
    }
  }, [potentialMatches.length, currentIndex]);

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [currentIndex]);

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
    <div className="h-full w-full bg-slate-50 flex flex-col overflow-hidden pb-24">
      {/* Swipe Counter Bar */}
      <div className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-100 shrink-0 z-10">
        <span className="text-sm font-bold text-slate-700">
          Bugün kalan: {getRemainingSwipes(currentUser)} / { (currentUser.dailySwipeLimit || FREE_DAILY_LIMIT) + (currentUser.extraSwipeLimit || 0) }
        </span>
        <button 
          onClick={() => onNavigate('wallet')}
          className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-400 text-sm font-medium">Yıldızlar eşleşiyor...</p>
          </div>
        ) : !activeUser ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-12 max-w-xs"
          >
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-500 shadow-inner">
              <Sparkles className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Keşif Bitti</h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Şu an için kriterlerine uygun yeni kimse kalmadı. Yeni birileri gelince burada görünecek!
            </p>
            <button 
              onClick={() => onNavigate('discover')}
              className="mt-8 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
            >
              Keşfet'e Göz At
            </button>
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeUser.uid}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ 
                scale: 1, 
                opacity: 1,
                x: exitDirection === 'left' ? -400 : exitDirection === 'right' ? 400 : 0,
                y: exitDirection === 'up' ? -400 : 0,
                rotate: exitDirection === 'left' ? -20 : exitDirection === 'right' ? 20 : 0
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full max-w-md relative rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Photo Gallery */}
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
                    <div className="absolute top-4 left-4 right-4 flex gap-1 z-10">
                      {photos.map((_, idx) => (
                        <div key={idx} className={`h-1 flex-1 rounded-full ${idx === currentPhotoIndex ? 'bg-white' : 'bg-white/50'}`} />
                      ))}
                    </div>
                    <div className="absolute inset-y-0 left-0 w-1/4" onClick={prevPhoto} />
                    <div className="absolute inset-y-0 right-0 w-1/4" onClick={nextPhoto} />
                  </>
                )}
              </div>
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent pointer-events-none" />

              {/* Report Button */}
              <button className="absolute top-12 right-4 p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 z-20">
                <AlertCircle className="w-5 h-5" />
              </button>

              {/* Scores (Top of overlay) */}
              <div className="absolute top-20 left-4 right-4 flex gap-2 pointer-events-none">
                <div className="flex-1 bg-rose-500/30 backdrop-blur-md rounded-xl p-2 text-center border border-rose-400/30">
                  <div className="text-[10px] uppercase text-white/80 font-bold">Aşk</div>
                  <div className="text-xl font-black text-white">%{compatibility?.love || 0}</div>
                </div>
                <div className="flex-1 bg-blue-500/30 backdrop-blur-md rounded-xl p-2 text-center border border-blue-400/30">
                  <div className="text-[10px] uppercase text-white/80 font-bold">Dost</div>
                  <div className="text-xl font-black text-white">%{compatibility?.friendship || 0}</div>
                </div>
                <div className="flex-1 bg-purple-500/30 backdrop-blur-md rounded-xl p-2 text-center border border-purple-400/30">
                  <div className="text-[10px] uppercase text-white/80 font-bold">Uyum</div>
                  <div className="text-xl font-black text-white">%{compatibility?.understanding || 0}</div>
                </div>
              </div>

              {/* Info (Bottom of overlay) */}
              <div className="absolute bottom-32 left-6 right-6 text-white pointer-events-none">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-3xl font-bold">{activeUser.social?.nickname || activeUser.nickname}, {activeUser.age}</h2>
                  <span className="text-xs bg-white/20 backdrop-blur-md px-2 py-1 rounded-full">{activeUser.zodiacSign || "Burç"}</span>
                </div>
                <p className="text-sm text-white/80 line-clamp-2">{activeUser.social?.bio || activeUser.bio || "Bio yok."}</p>
              </div>

              {/* Action Buttons (Overlay) */}
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between gap-2 z-20">
                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => handleSwipe('pass')} className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20">
                    <X className="w-8 h-8" />
                  </button>
                  <span className="text-xs font-bold text-white">Geç</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => handleSwipe('super_like')} className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/20">
                    <Sparkles className="w-7 h-7" />
                  </button>
                  <span className="text-xs font-bold text-white">Süper Beğeni</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <button onClick={() => handleSwipe('like')} className="w-16 h-16 rounded-full bg-rose-500/80 backdrop-blur-md border border-rose-400 text-white flex items-center justify-center hover:bg-rose-600/90">
                    <Heart className="w-8 h-8 fill-white" />
                  </button>
                  <span className="text-xs font-bold text-white">Beğeni</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
