import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile } from '../types';

interface BadgeContextType {
  unreadMessagesCount: number;
  pendingRequestsCount: number;
  unseenLikersCount: number;
  unseenReadingsCount: number;
  totalBadgeCount: number;
}

const BadgeContext = createContext<BadgeContextType>({
  unreadMessagesCount: 0,
  pendingRequestsCount: 0,
  unseenLikersCount: 0,
  unseenReadingsCount: 0,
  totalBadgeCount: 0,
});

export const useBadges = () => useContext(BadgeContext);

export const BadgeProvider: React.FC<{ children: React.ReactNode, userProfile: UserProfile | null, quotaExceeded?: boolean }> = ({ children, userProfile, quotaExceeded = false }) => {
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unseenLikersCount, setUnseenLikersCount] = useState(0);
  const [unseenReadingsCount, setUnseenReadingsCount] = useState(0);

  useEffect(() => {
    if (!userProfile?.uid || quotaExceeded) {
      setUnreadMessagesCount(0);
      setPendingRequestsCount(0);
      setUnseenLikersCount(0);
      setUnseenReadingsCount(0);
      return;
    }

    // 1. Listen for Unread Messages (from Chats collection)
    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", userProfile.uid)
    );

    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        totalUnread += (data.unreadCount?.[userProfile.uid] || 0);
      });
      setUnreadMessagesCount(totalUnread);
    }, (err) => console.error("BadgeProvider: Chats error:", err));

    // 2. Listen for Pending Requests
    const requestsQuery = query(
      collection(db, "interactionRequests"),
      where("toUserId", "==", userProfile.uid),
      where("status", "==", "pending")
    );

    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      setPendingRequestsCount(snapshot.size);
    }, (err) => console.error("BadgeProvider: Requests error:", err));

    // 3. Listen for Unseen Likers (from Swipes collection)
    const swipesQuery = query(
      collection(db, "swipes"),
      where("toUserId", "==", userProfile.uid),
      where("type", "in", ["like", "super_like"])
    );

    const unsubSwipes = onSnapshot(swipesQuery, (snapshot) => {
      const lastSeen = userProfile.social?.lastSeenLikersAt;
      let lastSeenTime = 0;
      
      if (lastSeen) {
        lastSeenTime = lastSeen.toMillis?.() || lastSeen.seconds * 1000 || 0;
      }

      const unseen = snapshot.docs.filter(doc => {
        const data = doc.data();
        const createdAt = data.createdAt;
        if (!createdAt) return false;
        
        const createdTime = createdAt.toMillis?.() || createdAt.seconds * 1000 || 0;
        return createdTime > lastSeenTime;
      });

      setUnseenLikersCount(unseen.length);
    }, (err) => console.error("BadgeProvider: Swipes error:", err));

    // 4. Listen for Unseen Readings
    const readingsQuery = query(
      collection(db, "readings"),
      where("userId", "==", userProfile.uid),
      where("status", "==", "completed"),
      where("isSeenByUser", "==", false),
      limit(20)
    );

    const unsubReadings = onSnapshot(readingsQuery, (snapshot) => {
      setUnseenReadingsCount(snapshot.size);
    }, (err) => console.error("BadgeProvider: Readings error:", err));

    return () => {
      unsubChats();
      unsubRequests();
      unsubSwipes();
      unsubReadings();
    };
  }, [userProfile?.uid, userProfile?.social?.lastSeenLikersAt, quotaExceeded]);

  const totalBadgeCount = unreadMessagesCount + pendingRequestsCount + unseenLikersCount + unseenReadingsCount;

  return (
    <BadgeContext.Provider value={{ 
      unreadMessagesCount, 
      pendingRequestsCount, 
      unseenLikersCount,
      unseenReadingsCount,
      totalBadgeCount 
    }}>
      {children}
    </BadgeContext.Provider>
  );
};

