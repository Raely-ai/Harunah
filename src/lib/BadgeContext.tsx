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

export const BadgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user] = useAuthState(auth);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unseenReadingsCount, setUnseenReadingsCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadMessagesCount(0);
      setUnseenReadingsCount(0);
      return;
    }

    // 1. Listen for unread messages in chats
    const chatsQuery = query(
      collection(db, "chats"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribeChats = onSnapshot(chatsQuery, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const unreadCount = data.unreadCount?.[user.uid] || 0;
        // Only count if the chat is not deleted for the user
        if (!data.deletedFor?.includes(user.uid)) {
          totalUnread += unreadCount;
        }
      });
      setUnreadMessagesCount(totalUnread);
    }, (error) => {
      console.error("BadgeProvider: Error listening to chats:", error);
    });

    // 2. Listen for unseen completed readings
    const readingsQuery = query(
      collection(db, "readings"),
      where("userId", "==", user.uid),
      where("status", "==", "completed"),
      where("isSeenByUser", "==", false)
    );

    const unsubscribeReadings = onSnapshot(readingsQuery, (snapshot) => {
      setUnseenReadingsCount(snapshot.size);
    }, (error) => {
      console.error("BadgeProvider: Error listening to readings:", error);
    });

    return () => {
      unsubscribeChats();
      unsubscribeReadings();
    };
  }, [user]);

  return (
    <BadgeContext.Provider value={{ unreadMessagesCount, unseenReadingsCount }}>
      {children}
    </BadgeContext.Provider>
  );
};
