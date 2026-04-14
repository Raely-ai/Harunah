import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from './firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

interface BadgeContextType {
  unreadMessagesCount: number;
  unseenReadingsCount: number;
}

const BadgeContext = createContext<BadgeContextType>({
  unreadMessagesCount: 0,
  unseenReadingsCount: 0,
});

export const useBadges = () => useContext(BadgeContext);

export const BadgeProvider: React.FC<{ children: React.ReactNode, userProfile: UserProfile | null }> = ({ children, userProfile }) => {
  const [unseenReadingsCount, setUnseenReadingsCount] = useState(0);

  // 1. Unread Messages Count from User Profile (Aggregated server-side)
  const unreadMessagesCount = userProfile?.unreadMessagesCount || 0;

  useEffect(() => {
    if (!userProfile?.uid) {
      setUnseenReadingsCount(0);
      return;
    }

    // 2. Listen for unseen completed readings (Keep this as it's usually small and specific)
    const readingsQuery = query(
      collection(db, "readings"),
      where("userId", "==", userProfile.uid),
      where("status", "==", "completed"),
      where("isSeenByUser", "==", false)
    );

    const unsubscribeReadings = onSnapshot(readingsQuery, (snapshot) => {
      setUnseenReadingsCount(snapshot.size);
    }, (error) => {
      console.error("BadgeProvider: Error listening to readings:", error);
    });

    return () => {
      unsubscribeReadings();
    };
  }, [userProfile?.uid]);

  return (
    <BadgeContext.Provider value={{ unreadMessagesCount, unseenReadingsCount }}>
      {children}
    </BadgeContext.Provider>
  );
};
