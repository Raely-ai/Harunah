import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
  Heart, 
  X, 
  Info, 
  MoreVertical, 
  ShieldAlert, 
  Ban, 
  User, 
  MapPin, 
  Sparkles,
  MessageCircle,
  Flag,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  arrayUnion,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { SocialProfile, SwipeAction, Match, SocialChat } from '../types';
import { toast } from 'sonner';
import { createSocialNotification } from '../services/socialNotificationService';
import { calculateCompatibility, rankProfiles, CompatibilityScore } from '../services/socialDiscoveryService';
import { UserActionMenu } from './UserActionMenu';

interface DiscoverFeedProps {
  currentSocialProfile: SocialProfile;
  onViewProfile: (profile: SocialProfile) => void;
}

const DiscoverFeed: React.FC<DiscoverFeedProps> = ({ currentSocialProfile, onViewProfile }) => {
  const [profiles, setProfiles] = useState<{ profile: SocialProfile; score: CompatibilityScore }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [swipedUids, setSwipedUids] = useState<Set<string>>(new Set());
  const [showMenu, setShowMenu] = useState<string | null>(null);
  const [isColdStart, setIsColdStart] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      setIsLoading(true);
      try {
        // 1. Fetch already swiped users
        const swipesQuery = query(
          collection(db, "swipes"),
          where("fromUid", "==", auth.currentUser.uid)
        );
        const swipesSnapshot = await getDocs(swipesQuery);
        const swiped = new Set(swipesSnapshot.docs.map(doc => (doc.data() as SwipeAction).toUid));
        setSwipedUids(swiped);

        // 2. Fetch potential profiles
        // We fetch a larger batch to determine if we are in cold start mode
        const profilesQuery = query(
          collection(db, "socialProfiles"),
          limit(100) // Fetch more to have a better pool
        );
        const profilesSnapshot = await getDocs(profilesQuery);
        const allProfiles = profilesSnapshot.docs.map(doc => doc.data() as SocialProfile);
        
        // Cold Start Logic: If total profiles are low
        const totalCount = allProfiles.length;
        
        let filteredProfiles = allProfiles.filter(p => 
          p.uid !== auth.currentUser?.uid && 
          !swiped.has(p.uid) &&
          !(currentSocialProfile.blockedUids || []).includes(p.uid) &&
          !(p.blockedUids || []).includes(auth.currentUser?.uid || '') &&
          p.settings?.whoCanAddFriend !== 'nobody' &&
          p.isBanned !== true
        );

        // In cold start mode, we might include profiles that are not fully completed 
        // as long as they have a photo and nickname to avoid empty screens.
        const coldStartActive = totalCount < 30 || filteredProfiles.filter(p => p.isCompleted).length < 10;
        setIsColdStart(coldStartActive);

        if (coldStartActive) {
          // If cold start is active, we prioritize completed ones but include others if needed
          const completed = filteredProfiles.filter(p => p.isCompleted);
          const partial = filteredProfiles.filter(p => !p.isCompleted && p.photoURL && p.nickname);
          
          // Combine them, completed ones will naturally rank higher due to completeness score
          filteredProfiles = [...completed, ...partial];
        } else {
          // Normal mode: only completed profiles
          filteredProfiles = filteredProfiles.filter(p => p.isCompleted);
        }

        // Rank profiles using the algorithm with cold start awareness
        const ranked = rankProfiles(currentSocialProfile, filteredProfiles, coldStartActive);
        
        // Deduplicate ranked profiles by uid to prevent duplicate key errors
        const uniqueRanked = Array.from(new Map(ranked.map(r => [r.profile.uid, r])).values());
        
        // To avoid "same person first" after refresh if they haven't swiped:
        // We use session storage to track users seen in this session but not swiped
        let sessionSeen: Set<string>;
        try {
          const sessionSeenStr = sessionStorage.getItem('session_seen_uids') || '[]';
          sessionSeen = new Set<string>(JSON.parse(sessionSeenStr));
        } catch {
          sessionSeen = new Set();
        }
        
        // Move session-seen users to the end of the list to ensure variety
        const unseen = uniqueRanked.filter(r => !sessionSeen.has(r.profile.uid));
        const seen = uniqueRanked.filter(r => sessionSeen.has(r.profile.uid));
        const reordered = [...unseen, ...seen];

        // To avoid "same person first" after refresh if they haven't swiped:
        // We can shuffle the top results slightly if in cold start
        if (coldStartActive && reordered.length > 1) {
          const topBatch = reordered.slice(0, 5);
          const shuffledTop = [...topBatch].sort(() => Math.random() - 0.5);
          const finalRanked = [...shuffledTop, ...reordered.slice(5)];
          setProfiles(finalRanked);
        } else {
          setProfiles(reordered);
        }
      } catch (error) {
        console.error("Error fetching discover data:", error);
        toast.error("Keşfet verileri yüklenirken bir hata oluştu.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentSocialProfile.uid]);

  // Track seen users in session storage
  useEffect(() => {
    if (profiles[currentIndex]) {
      const uid = profiles[currentIndex].profile.uid;
      try {
        const sessionSeenStr = sessionStorage.getItem('session_seen_uids') || '[]';
        const sessionSeen = JSON.parse(sessionSeenStr);
        if (!sessionSeen.includes(uid)) {
          sessionSeen.push(uid);
          // Keep only the last 50 seen to avoid bloat
          if (sessionSeen.length > 50) sessionSeen.shift();
          sessionStorage.setItem('session_seen_uids', JSON.stringify(sessionSeen));
        }
      } catch (e) {
        console.error("Session storage error:", e);
      }
    }
  }, [currentIndex, profiles]);

  const handleSwipe = async (direction: 'left' | 'right', targetProfile: SocialProfile) => {
    if (!auth.currentUser) return;

    const type = direction === 'right' ? 'like' : 'pass';
    
    try {
      // Optimistically update UI
      setCurrentIndex(prev => prev + 1);
      setSwipedUids(prev => new Set(prev).add(targetProfile.uid));

      // Save swipe to database
      await addDoc(collection(db, "swipes"), {
        fromUid: auth.currentUser.uid,
        toUid: targetProfile.uid,
        type: type,
        timestamp: new Date().toISOString()
      });

      if (type === 'like') {
        // Check for mutual match
        const mutualSwipeQuery = query(
          collection(db, "swipes"),
          where("fromUid", "==", targetProfile.uid),
          where("toUid", "==", auth.currentUser.uid),
          where("type", "==", "like"),
          limit(1)
        );
        
        const mutualSnapshot = await getDocs(mutualSwipeQuery);
        
        if (!mutualSnapshot.empty) {
          // It's a match!
          const matchId = [auth.currentUser.uid, targetProfile.uid].sort().join('_');
          
          // Check if match already exists to avoid duplicates
          const matchDoc = await getDoc(doc(db, "matches", matchId));
          
          if (!matchDoc.exists()) {
            const newMatch: Match = {
              id: matchId,
              uids: [auth.currentUser.uid, targetProfile.uid],
              createdAt: new Date().toISOString()
            };
            
            await setDoc(doc(db, "matches", matchId), newMatch);

            // Create a chat for this match
            const newChat: SocialChat = {
              id: matchId,
              uids: [auth.currentUser.uid, targetProfile.uid],
              type: 'match',
              createdAt: new Date().toISOString(),
              lastMessageAt: new Date().toISOString(),
              lastMessageText: '',
              lastMessageSenderId: '',
              unreadCount: {
                [auth.currentUser.uid]: 0,
                [targetProfile.uid]: 0
              },
              metadata: {
                matchId: matchId
              }
            };
            await setDoc(doc(db, "socialChats", matchId), newChat);

            await createSocialNotification(
              targetProfile.uid,
              'new_match',
              'Yeni Bir Eşleşme!',
              `${auth.currentUser?.displayName || 'Birisi'} ile eşleştiniz!`,
              {
                senderId: auth.currentUser?.uid,
                senderName: auth.currentUser?.displayName || 'Birisi',
                senderPhoto: auth.currentUser?.photoURL || undefined,
                matchId: matchId
              },
              `/social/chat/${matchId}`
            );

            toast.success(`Tebrikler! ${targetProfile.nickname} ile eşleştiniz!`, {
              icon: <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />,
              duration: 5000
            });
          }
        }
      }
    } catch (error) {
      console.error("Swipe error:", error);
      toast.error("İşlem kaydedilemedi.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 font-bold text-xs uppercase tracking-widest">Kaderin Yıldızları Diziliyor...</p>
        </div>
      </div>
    );
  }

  const currentProfile = profiles[currentIndex];

  if (!currentProfile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-24 h-24 rounded-[2.5rem] bg-zinc-50 flex items-center justify-center shadow-inner">
          <Sparkles className="w-10 h-10 text-zinc-200" strokeWidth={1} />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-bold text-zinc-900">Keşfedilecek Kimse Kalmadı</h3>
          <p className="text-zinc-400 text-sm max-w-[240px] mx-auto">Şu an için çevrendeki tüm yıldızları gördün. Daha sonra tekrar gel!</p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 rounded-2xl bg-zinc-900 text-white font-bold text-xs uppercase tracking-widest shadow-xl shadow-zinc-900/20 active:scale-95 transition-all"
        >
          Yenile
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center justify-start py-6 pb-24 w-full max-w-[400px] mx-auto">
      {/* Card Container */}
      <div className="relative w-full aspect-[3/4] flex-shrink-0 mb-6">
        <AnimatePresence>
          {profiles.slice(currentIndex, currentIndex + 2).reverse().map((item, index) => {
            const isTop = index === 1 || profiles.length - currentIndex === 1;
            return (
              <SwipeCard 
                key={item.profile.uid}
                profile={item.profile}
                score={item.score}
                isTop={isTop}
                onSwipe={(dir) => handleSwipe(dir, item.profile)}
                onViewProfile={() => onViewProfile(item.profile)}
                onBlockSuccess={() => {
                  setProfiles(prev => prev.filter(p => p.profile.uid !== item.profile.uid));
                }}
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Action Buttons Container */}
      <div className="w-full flex flex-col items-center gap-6 pb-12 z-30">
        {isColdStart && profiles.length > 0 && (
          <div className="px-4 py-1.5 rounded-full bg-zinc-50 border border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase tracking-widest shadow-sm">
            Keşif Modu: Yeni Yıldızlar Aranıyor
          </div>
        )}
        
        <div className="flex items-center justify-center gap-8">
          {/* Pass Button */}
          <button 
            onClick={() => handleSwipe('left', currentProfile.profile)}
            className="w-16 h-16 rounded-full bg-white border border-zinc-100 flex items-center justify-center text-zinc-400 hover:text-rose-500 hover:border-rose-100 hover:bg-rose-50 shadow-xl shadow-zinc-200/40 transition-all active:scale-90 group"
          >
            <X className="w-7 h-7 transition-transform group-hover:rotate-12" />
          </button>

          {/* Info Button */}
          <button 
            onClick={() => onViewProfile(currentProfile.profile)}
            className="w-14 h-14 rounded-full bg-zinc-900 flex items-center justify-center text-white shadow-lg shadow-zinc-900/20 transition-all active:scale-90"
          >
            <Info className="w-6 h-6" />
          </button>

          {/* Like Button */}
          <button 
            onClick={() => handleSwipe('right', currentProfile.profile)}
            className="w-16 h-16 rounded-full bg-white border border-zinc-100 flex items-center justify-center text-zinc-400 hover:text-emerald-500 hover:border-emerald-100 hover:bg-emerald-50 shadow-xl shadow-zinc-200/40 transition-all active:scale-90 group"
          >
            <Heart className="w-7 h-7 transition-transform group-hover:scale-110" />
          </button>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-50 border border-zinc-100">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Günlük 20 Beğeni Hakkın Kaldı</span>
        </div>
      </div>
    </div>
  );
};

interface SwipeCardProps {
  profile: SocialProfile;
  score: CompatibilityScore;
  isTop: boolean;
  onSwipe: (direction: 'left' | 'right') => void;
  onViewProfile: () => void;
  onBlockSuccess: () => void;
}

const SwipeCard: React.FC<SwipeCardProps> = ({ 
  profile, 
  score,
  isTop, 
  onSwipe, 
  onViewProfile, 
  onBlockSuccess
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);
  const heartOpacity = useTransform(x, [50, 150], [0, 1]);
  const xOpacity = useTransform(x, [-150, -50], [1, 0]);

  const handleDragEnd = (_: any, info: any) => {
    if (info.offset.x > 100) {
      onSwipe('right');
    } else if (info.offset.x < -100) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      style={{ x, rotate, opacity, zIndex: isTop ? 10 : 0 }}
      drag={isTop ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: x.get() < 0 ? -500 : 500, opacity: 0, transition: { duration: 0.3 } }}
      className="absolute w-full max-w-[360px] aspect-[3/4.2] rounded-[3.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.1)] cursor-grab active:cursor-grabbing bg-white border border-zinc-100"
    >
      {/* Swipe Indicators */}
      {isTop && (
        <>
          <motion.div 
            style={{ opacity: heartOpacity }}
            className="absolute top-12 left-12 z-20 bg-emerald-500/10 backdrop-blur-md border-2 border-emerald-500/50 px-6 py-2 rounded-2xl rotate-[-15deg]"
          >
            <span className="text-emerald-500 font-black text-2xl uppercase tracking-widest">BEĞEN</span>
          </motion.div>
          <motion.div 
            style={{ opacity: xOpacity }}
            className="absolute top-12 right-12 z-20 bg-rose-500/10 backdrop-blur-md border-2 border-rose-500/50 text-rose-500 px-6 py-2 rounded-2xl rotate-[15deg]"
          >
            <span className="text-rose-500 font-black text-2xl uppercase tracking-widest">PAS</span>
          </motion.div>
        </>
      )}

      {/* Profile Image */}
      <div className="absolute inset-0 bg-zinc-100">
        <img 
          src={profile.photoURL || `https://picsum.photos/seed/${profile.uid}/800/1200`} 
          alt={profile.nickname}
          className="w-full h-full object-cover pointer-events-none"
        />
      </div>


      {/* Glassmorphism Content Area */}
      <div className="absolute bottom-6 left-6 right-6 p-6 rounded-[2.5rem] bg-white/90 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.1)] pointer-events-auto cursor-default">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">
                {profile.nickname}, {profile.age || '??'}
              </h2>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" />
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
              <MapPin className="w-3.5 h-3.5" />
              {profile.region || 'Türkiye'}
            </div>
          </div>
          
          {/* Compatibility Badge */}
          {score && !isNaN(score.total) && score.total > 0 && (
            <div className="px-3 py-2 rounded-2xl bg-zinc-900 text-white flex flex-col items-center shadow-lg shadow-zinc-900/20">
              <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest leading-none mb-1">Uyum</span>
              <span className="text-xs font-black leading-none tracking-tighter">%{score.total}</span>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <p className="text-zinc-500 text-xs leading-relaxed line-clamp-3 font-medium italic">
            {profile.bio ? `"${profile.bio}"` : 'Gizemli bir ruh...'}
          </p>

          <div className="flex flex-wrap gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-100 text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="w-3 h-3 text-amber-500" />
              {profile.vibe || 'Enerji'}
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile();
              }}
              className="ml-auto flex items-center gap-1 text-[10px] font-bold text-zinc-900 uppercase tracking-widest hover:translate-x-1 transition-transform"
            >
              Detaylar
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      <div className="absolute top-6 right-6 z-30">
        <UserActionMenu
          targetUid={profile.uid}
          targetName={profile.nickname}
          context="explore"
          onViewProfile={onViewProfile}
          onBlockSuccess={onBlockSuccess}
          trigger={
            <div className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-black/40 transition-colors">
              <MoreVertical className="w-5 h-5" />
            </div>
          }
        />
      </div>
    </motion.div>
  );
};

export default DiscoverFeed;
