import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  Sparkles,
  X,
  MapPin,
  Info
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
  limit
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { UserProfile } from "../types";
import { toast } from "sonner";
import { calculateCompatibility } from "../lib/compatibilityEngine";

export default function SocialMatchScreen({ currentUser, onNavigate }: { currentUser: UserProfile, onNavigate: (tab: any) => void }) {
  const [potentialMatches, setPotentialMatches] = useState<UserProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPotentialMatches();
  }, [currentUser.uid]);

  const fetchPotentialMatches = async () => {
    setLoading(true);
    try {
      // 1. Get all users we've already swiped on
      const swipesQuery = query(
        collection(db, "swipes"),
        where("fromUserId", "==", currentUser.uid)
      );
      const swipesSnapshot = await getDocs(swipesQuery);
      const swipedUserIds = new Set(swipesSnapshot.docs.map(doc => doc.data().toUserId));
      swipedUserIds.add(currentUser.uid); // Add self to exclude

      // 2. Fetch users
      const usersQuery = query(
        collection(db, "users"),
        limit(50)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const users: UserProfile[] = [];
      
      usersSnapshot.forEach((doc) => {
        if (!swipedUserIds.has(doc.id)) {
          users.push({ uid: doc.id, ...doc.data() } as UserProfile);
        }
      });

      // Optional: Sort by compatibility
      users.sort((a, b) => {
        const scoreA = calculateCompatibility(currentUser, a).overallScore;
        const scoreB = calculateCompatibility(currentUser, b).overallScore;
        return scoreB - scoreA;
      });

      setPotentialMatches(users);
      setCurrentIndex(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "users");
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (type: 'like' | 'pass' | 'super_like') => {
    if (currentIndex >= potentialMatches.length) return;
    
    const targetUser = potentialMatches[currentIndex];
    setCurrentIndex(prev => prev + 1);

    try {
      // 1. Record the swipe
      await addDoc(collection(db, "swipes"), {
        fromUserId: currentUser.uid,
        toUserId: targetUser.uid,
        type: type,
        createdAt: serverTimestamp()
      });

      if (type === 'super_like') {
        // Record as interaction request
        await addDoc(collection(db, "interactionRequests"), {
          fromUserId: currentUser.uid,
          toUserId: targetUser.uid,
          type: 'super_like',
          status: 'pending',
          createdAt: serverTimestamp()
        });
        toast.success("Süper Like gönderildi! ✨");
      } else if (type === 'like') {
        // Check for mutual like
        const reverseSwipeQ = query(
          collection(db, "swipes"),
          where("fromUserId", "==", targetUser.uid),
          where("toUserId", "==", currentUser.uid),
          where("type", "in", ["like", "super_like"])
        );
        const reverseSnapshot = await getDocs(reverseSwipeQ);

        if (!reverseSnapshot.empty) {
          // It's a match!
          const matchId = [currentUser.uid, targetUser.uid].sort().join('_');
          
          // Create match document
          await setDoc(doc(db, "matches", matchId), {
            userIds: [currentUser.uid, targetUser.uid],
            createdAt: serverTimestamp()
          });

          // Create chat document
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
  };

  const activeUser = potentialMatches[currentIndex];

  return (
    <div className="h-full w-full bg-slate-50 text-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex flex-col gap-1 z-10">
        <h1 className="text-2xl font-serif font-bold text-slate-900">Eşleş</h1>
        <p className="text-xs font-medium text-slate-500">Ruh eşini bulmak için kaydır.</p>
      </header>

      {/* Content */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Kişiler aranıyor...</p>
          </div>
        ) : !activeUser ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 p-8">
            <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
              <Sparkles className="w-10 h-10 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Yakınlarda kimse kalmadı</h3>
              <p className="text-sm text-slate-500 mt-2">Daha fazla kişi görmek için arama kriterlerini genişletebilirsin.</p>
            </div>
            <button 
              onClick={fetchPotentialMatches}
              className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-sm hover:bg-indigo-700 transition-colors"
            >
              Tekrar Ara
            </button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              key={activeUser.uid}
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, x: -100 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="absolute inset-4 max-w-md mx-auto"
            >
              <div className="w-full h-full bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col border border-slate-100 relative">
                {/* Photo */}
                <div className="relative flex-1 bg-slate-100">
                  <img 
                    src={activeUser.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeUser.uid}`} 
                    alt={activeUser.nickname}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* User Info Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <div className="flex items-end justify-between mb-2">
                      <div>
                        <h2 className="text-3xl font-bold drop-shadow-md">
                          {activeUser.nickname}, {activeUser.age}
                        </h2>
                        {activeUser.location && (
                          <div className="flex items-center gap-1.5 text-white/90 mt-1">
                            <MapPin className="w-4 h-4" />
                            <span className="text-sm font-medium drop-shadow-sm">{activeUser.location.city}, {activeUser.location.country}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Compatibility Score */}
                      <div className="flex flex-col items-center justify-center bg-white/20 backdrop-blur-md rounded-2xl p-2 border border-white/30">
                        <span className="text-xs font-bold text-white/90 uppercase tracking-wider mb-0.5">Uyum</span>
                        <div className="text-xl font-black text-white drop-shadow-md">
                          %{calculateCompatibility(currentUser, activeUser).overallScore}
                        </div>
                      </div>
                    </div>
                    
                    {activeUser.bio && (
                      <p className="text-sm text-white/80 line-clamp-2 mt-2 drop-shadow-sm">
                        {activeUser.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="h-24 bg-white flex items-center justify-center gap-6 px-6">
                  <button 
                    onClick={() => handleSwipe('pass')}
                    className="w-14 h-14 rounded-full bg-white border-2 border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  
                  <button 
                    onClick={() => handleSwipe('super_like')}
                    className="w-12 h-12 rounded-full bg-white border-2 border-amber-200 text-amber-500 flex items-center justify-center hover:bg-amber-50 hover:text-amber-600 hover:border-amber-300 transition-all shadow-sm"
                  >
                    <Sparkles className="w-5 h-5" />
                  </button>
                  
                  <button 
                    onClick={() => handleSwipe('like')}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-400 to-rose-600 text-white flex items-center justify-center hover:from-rose-500 hover:to-rose-700 transition-all shadow-lg shadow-rose-500/30"
                  >
                    <Heart className="w-6 h-6 fill-white" />
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
