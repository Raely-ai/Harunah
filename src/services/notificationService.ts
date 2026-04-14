import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { toast } from "sonner";

export const notificationService = {
  async requestPermission(userId: string) {
    try {
      const messagingSupported = await isSupported();
      if (!messagingSupported) {
        console.warn("FCM Messaging is not supported in this browser/environment.");
        return null;
      }

      const messaging = getMessaging();
      
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn("Notification permission denied.");
        return null;
      }

      // Get token
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) {
        console.warn("VITE_FIREBASE_VAPID_KEY is missing. FCM token will not be obtained.");
        return null;
      }

      const token = await getToken(messaging, {
        vapidKey: vapidKey
      });

      if (token) {
        console.log("FCM Token obtained:", token);
        await this.saveToken(userId, token);
        return token;
      }
      return null;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
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
    } catch (error) {
      console.error("Error saving FCM token:", error);
    }
  },

  async removeToken(userId: string) {
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmToken: null
      });
    } catch (error) {
      console.error("Error removing FCM token:", error);
    }
  },

  setupOnMessageListener() {
    isSupported().then(supported => {
      if (!supported) return;
      
      const messaging = getMessaging();
      onMessage(messaging, (payload) => {
        console.log("Foreground message received:", payload);
        
        // Show a toast for foreground notifications
        if (payload.notification) {
          toast(payload.notification.title || "Yeni Bildirim", {
            description: payload.notification.body,
            action: {
              label: "Görüntüle",
              onClick: () => {
                // Handle navigation if needed
                console.log("Notification clicked:", payload.data);
              }
            }
          });
        }
      });
    });
  }
};
