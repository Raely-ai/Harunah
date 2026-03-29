import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, getDoc, doc } from 'firebase/firestore';
import { SocialNotification, SocialProfile } from '../types';

export const createSocialNotification = async (
  userId: string,
  type: SocialNotification['type'],
  title: string,
  message: string,
  data?: SocialNotification['data'],
  link?: string
) => {
  try {
    // Check user settings first
    const profileDoc = await getDoc(doc(db, 'socialProfiles', userId));
    if (profileDoc.exists()) {
      const profile = profileDoc.data() as SocialProfile;
      const settings = profile.settings;

      if (settings?.notifications) {
        // Check specific notification type
        if (type === 'new_message' && !settings.notifications.messages) return;
        if (type === 'new_friend_request' && !settings.notifications.friendRequests) return;
        if (type === 'room_invite' && !settings.notifications.roomInvites) return;
        if (type === 'gift_received' && !settings.notifications.gifts) return;
      }
    }

    const notificationData: Omit<SocialNotification, 'id'> = {
      userId,
      type,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
      data,
      link
    };

    await addDoc(collection(db, 'socialNotifications'), notificationData);
  } catch (error) {
    // We don't want to break the main flow if notification fails, but we log it
    console.error('Failed to create notification:', error);
  }
};
