import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';

export const notificationService = {
  async requestPermission(userId: string) {
    if (!Capacitor.isNativePlatform()) {
      console.warn("Push notifications are only available on native platforms.");
      return null;
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn("Push Notification permission denied.");
        return null;
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
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmToken: token,
        lastTokenUpdateAt: new Date().toISOString()
      });
      console.log("FCM Token saved to Firestore.");
    } catch (error) {
      console.error("Error saving FCM token:", error);
    }
  },

  async removeToken(userId: string) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { fcmToken: null });
    } catch (error) {
      console.error("Error removing FCM token:", error);
    }
  },

  setupListeners(userId: string, onAction?: (data: any) => void) {
    if (!Capacitor.isNativePlatform()) return;

    PushNotifications.removeAllListeners();

    PushNotifications.addListener('registration', async (token) => {
        console.log("Push registration success, token: " + token.value);
        await notificationService.saveToken(userId, token.value);
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
