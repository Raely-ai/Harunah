import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { UserProfile } from '../types';

interface BadgeContextType {
  unreadMessagesCount: number;
  unseenReadingsCount: number;
}

const BadgeContext = createContext<BadgeContextType>({
  unreadMessagesCount: 0,
  unseenReadingsCount: 0,
});

export const useBadges = () => useContext(BadgeContext);

export const BadgeProvider: React.FC<{ children: React.ReactNode, userProfile: UserProfile | null, quotaExceeded?: boolean }> = ({ children, userProfile, quotaExceeded = false }) => {
  const [unseenReadingsCount, setUnseenReadingsCount] = useState(0);

  // 1. Unread Messages Count from User Profile (Aggregated server-side)
  const unreadMessagesCount = userProfile?.unreadMessagesCount || 0;

  useEffect(() => {
    if (!userProfile?.uid || quotaExceeded) {
      setUnseenReadingsCount(0);
      return;
    }

    // 2. Fetch unseen completed readings once on mount or profile change
    const fetchUnseenCount = async () => {
      try {
        const readingsQuery = query(
          collection(db, "readings"),
          where("userId", "==", userProfile.uid),
          where("status", "==", "completed"),
          where("isSeenByUser", "==", false),
          limit(20) // Optimization: limit enough for badge
        );
        const snapshot = await getDocs(readingsQuery);
        setUnseenReadingsCount(snapshot.size);
      } catch (error: any) {
        console.error("BadgeProvider: Error fetching readings:", error);
      }
    };

    fetchUnseenCount();
  }, [userProfile?.uid, quotaExceeded]);

  return (
    <BadgeContext.Provider value={{ unreadMessagesCount, unseenReadingsCount }}>
      {children}
    </BadgeContext.Provider>
  );
};
