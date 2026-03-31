import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Zap, RefreshCw, Star, Heart, UserPlus, ArrowRight } from "lucide-react";
import { collection, query, where, limit, getDocs, updateDoc, doc, serverTimestamp, getDoc, addDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile } from "../types";
import { calculateCompatibility } from "../lib/compatibilityEngine";
import { getTargetGender, isEligibleSocialUser } from "../lib/socialUtils";
import { toast } from "sonner";
import SocialStoryArea from "./SocialStoryArea";
import SocialProfilePopup from "./SocialProfilePopup";
import SocialGridBlock from "./SocialGridBlock";

interface SocialDiscoverScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  onBack?: () => void;
}

export default function SocialDiscoverScreen({ currentUser, onNavigate, onBack }: SocialDiscoverScreenProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [featuredUsers, setFeaturedUsers] = useState<UserProfile[]>([]);
  const [loveUsers, setLoveUsers] = useState<UserProfile[]>([]);
  const [friendUsers, setFriendUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTimer, setRefreshTimer] = useState<string>('');

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  const updateTimer = () => {
    if (!currentUser.social?.lastDiscoverRefreshAt) {
      setRefreshTimer('00:00:00');
      return;
    }
    const lastRefresh = new Date(currentUser.social.lastDiscoverRefreshAt).getTime();
    const nextRefresh = lastRefresh + 24 * 60 * 60 * 1000;
    const now = Date.now();
    const diff = nextRefresh - now;

    if (diff <= 0) {
      setRefreshTimer('Yenile');
    } else {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setRefreshTimer(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const targetGender = getTargetGender(currentUser);
      
      const q = query(
        usersRef,
        where("social.enabled", "==", true),
        where("social.profileCompleted", "==", true),
        where("social.visible", "==", true),
        where("social.gender", "==", targetGender),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const allFetched = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => isEligibleSocialUser(u, currentUser.uid, targetGender));

      const usedUserIds = new Set<string>();

      const featured = allFetched.filter(u => u.subscription?.status === 'active').slice(0, 5);
      featured.forEach(u => usedUserIds.add(u.uid));
      setFeaturedUsers(featured);
      
      const sortedByLove = [...allFetched].filter(u => !usedUserIds.has(u.uid)).sort((a, b) => calculateCompatibility(currentUser, b).love - calculateCompatibility(currentUser, a).love);
      const love = sortedByLove.slice(0, 3);
      love.forEach(u => usedUserIds.add(u.uid));
      setLoveUsers(love);
      
      const sortedByFriend = [...allFetched].filter(u => !usedUserIds.has(u.uid)).sort((a, b) => calculateCompatibility(currentUser, b).friendship - calculateCompatibility(currentUser, a).friendship);
      const friend = sortedByFriend.slice(0, 3);
      friend.forEach(u => usedUserIds.add(u.uid));
      setFriendUsers(friend);

      setUsers(allFetched.filter(u => !usedUserIds.has(u.uid)).slice(0, 21));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    const lastRefresh = currentUser.social?.lastDiscoverRefreshAt ? new Date(currentUser.social.lastDiscoverRefreshAt).getTime() : 0;
    if (Date.now() - lastRefresh < 24 * 60 * 60 * 1000) {
      toast.error("Anlık yenileme için yenileme paketi almalısınız.");
      return;
    }
    await updateDoc(doc(db, "users", currentUser.uid), { "social.lastDiscoverRefreshAt": new Date().toISOString() });
    fetchUsers();
  };

  const handleCompatibilityCheck = async (user: UserProfile) => {
    if ((currentUser.social?.compatibilityCredits || 0) <= 0) {
      toast.error("Uyum hesaplama için paket almalısınız.");
      return;
    }
    await updateDoc(doc(db, "users", currentUser.uid), { "social.compatibilityCredits": (currentUser.social?.compatibilityCredits || 0) - 1 });
    toast.success("Uyum hesaplanıyor...");
    // Compatibility logic here
  };

  const handleSendMessage = async (targetUser: UserProfile) => {
    try {
      // 1. Check if chat already exists
      const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
      const chatDoc = await getDoc(doc(db, "chats", chatId));
      
      if (chatDoc.exists()) {
        onNavigate('social-messages');
        return;
      }

      // 2. Check if pending request already exists
      const requestsRef = collection(db, "interactionRequests");
      const q = query(
        requestsRef,
        where("fromUserId", "==", currentUser.uid),
        where("toUserId", "==", targetUser.uid),
        where("status", "==", "pending")
      );
      const requestSnapshot = await getDocs(q);

      if (!requestSnapshot.empty) {
        toast.info("Bu kullanıcıya zaten bir mesaj isteği gönderdiniz.");
        return;
      }

      // 3. Create interaction request
      await addDoc(collection(db, "interactionRequests"), {
        fromUserId: currentUser.uid,
        toUserId: targetUser.uid,
        status: "pending",
        type: "message_request",
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

      // 4. Create notification
      await addDoc(collection(db, "notifications"), {
        userId: targetUser.uid,
        type: "message_request",
        title: "Yeni Mesaj İsteği",
        message: `${currentUser.social?.nickname || currentUser.displayName} sana bir mesaj isteği gönderdi.`,
        data: { fromUserId: currentUser.uid },
        read: false,
        createdAt: serverTimestamp()
      });

      toast.success("Mesaj isteği başarıyla gönderildi!");
      setSelectedUser(null);
    } catch (error) {
      console.error("Error sending message request:", error);
      toast.error("İstek gönderilirken bir hata oluştu.");
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white text-slate-900">
      {/* Header - Only Refresh Button */}
      <div className="flex justify-end p-4 sticky top-0 bg-white/95 backdrop-blur-sm z-20">
        <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold tracking-wider uppercase hover:bg-slate-200 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
          {refreshTimer}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-28">
        <SocialStoryArea featuredUsers={featuredUsers} onSelect={setSelectedUser} />
        
        {/* Grid 1 */}
        <div className="px-3 grid grid-cols-3 gap-2 pt-4">
          {users.slice(0, 3).map(u => <img key={u.uid} src={u.social?.photos?.[0] || u.photoURL} className="aspect-square rounded-xl object-cover shadow-sm" onClick={() => setSelectedUser(u)} />)}
        </div>

        <SocialGridBlock title="Aşk Enerjinle Yüksek Uyum" users={loveUsers} color="red" onSelect={setSelectedUser} />
        
        {/* Grid 2 */}
        <div className="px-3 grid grid-cols-3 gap-2">
          {users.slice(3, 6).map(u => <img key={u.uid} src={u.social?.photos?.[0] || u.photoURL} className="aspect-square rounded-xl object-cover shadow-sm" onClick={() => setSelectedUser(u)} />)}
        </div>

        <SocialGridBlock title="Dostluk Frekansın Uyuşanlar" users={friendUsers} color="blue" onSelect={setSelectedUser} />
        
        {/* Grid 3 */}
        <div className="px-3 grid grid-cols-3 gap-2">
          {users.slice(6, 12).map(u => <img key={u.uid} src={u.social?.photos?.[0] || u.photoURL} className="aspect-square rounded-xl object-cover shadow-sm" onClick={() => setSelectedUser(u)} />)}
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <SocialProfilePopup 
            user={selectedUser} 
            onClose={() => setSelectedUser(null)} 
            onCompatibilityCheck={handleCompatibilityCheck}
            onSendMessage={handleSendMessage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

