import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { isNotificationProcessed, markNotificationProcessed } from '../lib/notificationStore';

let pushInitialized = false;

export const notificationService = {
  async createChannel() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      // Create our custom channel
      await PushNotifications.createChannel({
        id: 'lasya_default_channel',
        name: 'Mesajlar ve Bildirimler',
        description: 'Sohbet ve fal bildirimleri',
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: 'default'
      });
      
      // Also ensure a 'default' channel exists as many systems fallback to it
      await PushNotifications.createChannel({
        id: 'default',
        name: 'Varsayılan',
        importance: 3,
        visibility: 1,
        sound: 'default'
      });
      
      console.log("Notification channels created.");
    } catch (error) {
      console.error("Error creating notification channels:", error);
    }
  },

  async requestPermission(userId?: string, retryCount = 0) {
    if (!Capacitor.isNativePlatform()) {
      console.warn("Push notifications are only available on native platforms.");
      return null;
    }

    try {
      // First create the channel
      await this.createChannel();

      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn("Push Notification permission denied.");
        if (userId) {
          await updateDoc(doc(db, "users", userId), { notificationPermission: 'denied' });
        }
        return false;
      }

      if (userId) {
        await updateDoc(doc(db, "users", userId), { notificationPermission: 'granted' });
      }

      // Register with Apple / Google to receive push via APNS/FCM
      try {
        await PushNotifications.register();
      } catch (regErr: any) {
        console.error(`Push register failed (Attempt ${retryCount + 1}):`, regErr);
        if (retryCount < 3) {
          console.log("Retrying push registration in 5 seconds...");
          setTimeout(() => this.requestPermission(userId, retryCount + 1), 5000);
        }
      }
      
      return true;
    } catch (error) {
      console.error("Error requesting push notification permission:", error);
      return null;
    }
  },

  async saveToken(userId: string, token: string) {
    if (!userId || !token) return;
    try {
      localStorage.setItem('lasya_fcm_token', token);
      
      // 1. Cleanup: Remove this token from ANY other user that might have it
      const q = query(collection(db, "users"), where("fcmTokens", "array-contains", token));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      querySnapshot.forEach((userDoc) => {
        if (userDoc.id !== userId) {
          batch.update(userDoc.ref, {
            fcmTokens: arrayRemove(token),
            fcmToken: userDoc.data().fcmToken === token ? null : userDoc.data().fcmToken
          });
        }
      });
      
      // Also check fcmToken single field
      const qSingle = query(collection(db, "users"), where("fcmToken", "==", token));
      const querySnapshotSingle = await getDocs(qSingle);
      querySnapshotSingle.forEach((userDoc) => {
        if (userDoc.id !== userId) {
          batch.update(userDoc.ref, {
            fcmToken: null
          });
        }
      });
      
      await batch.commit();

      // 2. Add to actual user
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmToken: token,
        fcmTokens: arrayUnion(token),
        fcmUpdatedAt: new Date().toISOString(),
        lastTokenUpdateAt: new Date().toISOString(),
        notificationPermission: 'granted'
      });
      
      console.log("FCM Token cleaned up and saved for user:", userId);
    } catch (error) {
      console.error("Error saving FCM token:", error);
    }
  },

  async syncPendingToken(userId: string) {
    const pendingToken = localStorage.getItem('lasya_fcm_token');
    if (pendingToken) {
      await this.saveToken(userId, pendingToken);
    }
  },

  async removeToken(userId: string) {
    if (!userId) return;
    try {
      const currentToken = localStorage.getItem('lasya_fcm_token');
      if (!currentToken) return;

      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmToken: null,
        fcmTokens: arrayRemove(currentToken)
      });
      console.log("FCM Token removed for user:", userId);
    } catch (error) {
      console.error("Error removing FCM token:", error);
    }
  },

  setupListeners(userId?: string, onAction?: (data: any) => void) {
    if (!Capacitor.isNativePlatform()) return;

    if (pushInitialized && !userId) {
       console.log("Push listeners already initialized, skipping global setup.");
       return;
    }

    pushInitialized = true;
    PushNotifications.removeAllListeners();

    // Ensure channel exists on Android every time listeners are set up
    this.createChannel();

    // Disable native banners while app is in foreground to prevent double notifications
    // We handle foreground notifications via our own CustomToast
    if (Capacitor.getPlatform() === 'ios') {
      // Cast to any to bypass lint error if types are stale, 
      // but only call on iOS as guarded above.
      (PushNotifications as any).setPresentationOptions({
        presentationOptions: [], 
      });
    }

    PushNotifications.addListener('registration', async (token) => {
        console.log("Push registration success, token: " + token.value);
        localStorage.setItem('lasya_fcm_token', token.value);
        if (userId) {
          await notificationService.saveToken(userId, token.value);
        }
    });

    PushNotifications.addListener('registrationError', (error: any) => {
        console.error("Push registration error details: ", error, "Stringified:", JSON.stringify(error));
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log("Push received (foreground): ", notification);
        
        // Extract logical IDs for deduplication
        const { chatId, messageId, type, id: requestId } = notification.data || {};
        const logicalId = messageId ? `${chatId}_${messageId}` : (requestId || notification.id);
        
        // Always mark as processed in foreground so Firestore listener or actionPerformed
        // can handle logic, or just prevent triple processing.
        // We REMOVE the toast(notification.title...) call here because SocialMessages/Firestore
        // will show the CustomToast in foreground.
        if (logicalId) {
          markNotificationProcessed(logicalId);
        }
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log("Push action performed: ", notification);
        if (onAction && notification.notification.data) {
          onAction(notification.notification.data);
        }
    });
  }
};
