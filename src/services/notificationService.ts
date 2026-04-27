import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export const notificationService = {
  async createChannel() {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await PushNotifications.createChannel({
        id: 'lasya_messages',
        name: 'Lasya Bildirimleri',
        description: 'Mesaj ve fal bildirimleri',
        importance: 5, // High
        visibility: 1,
        vibration: true,
      });
      console.log("Notification channel created.");
    } catch (error) {
      console.error("Error creating notification channel:", error);
    }
  },

  async requestPermission(userId?: string) {
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
      await PushNotifications.register();
      
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
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmToken: token,
        fcmTokens: arrayUnion(token),
        fcmUpdatedAt: new Date().toISOString(),
        lastTokenUpdateAt: new Date().toISOString(),
        notificationPermission: 'granted'
      });
      console.log("FCM Token saved to Firestore for user:", userId);
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
    try {
      const currentToken = localStorage.getItem('lasya_fcm_token');
      const userRef = doc(db, "users", userId);
      const updates: any = { fcmToken: null };
      // Also try to remove from the array if we have the current token
      // But arrayRemove needs the exact value
      await updateDoc(userRef, updates);
    } catch (error) {
      console.error("Error removing FCM token:", error);
    }
  },

  setupListeners(userId?: string, onAction?: (data: any) => void) {
    if (!Capacitor.isNativePlatform()) return;

    PushNotifications.removeAllListeners();

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
        console.log("Push received: ", notification);
        toast(notification.title || "Yeni Bildirim", {
          description: notification.body,
          action: {
            label: "Görüntüle",
            onClick: () => {
              if (onAction && notification.data) {
                onAction(notification.data);
              }
            }
          }
        });
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log("Push action performed: ", notification);
        if (onAction && notification.notification.data) {
          onAction(notification.notification.data);
        }
    });
  }
};
