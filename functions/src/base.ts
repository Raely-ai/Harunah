import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = getFirestore();
export const messaging = getMessaging();
export { FieldValue };

// Define OpenAI Secret - Declaration only
export const openAiKey = defineSecret("OPENAI_API_KEY");

let _openai: OpenAI | null = null;

/**
 * Lazy initialization of OpenAI.
 * Accessing .value() at module load time is dangerous.
 */
export function getOpenAI(): OpenAI {
  try {
    const key = openAiKey.value();
    if (!key) {
      throw new Error("OPENAI_API_KEY is not set in environment/secrets.");
    }
    if (!_openai) {
      _openai = new OpenAI({ apiKey: key });
    }
    return _openai;
  } catch (error: any) {
    console.error("OpenAI Access Error:", error);
    throw new functions.https.HttpsError('failed-precondition', 'AI servisine şu an ulaşılamıyor. Lütfen daha sonra tekrar deneyiniz.');
  }
}

/**
 * NOTIFICATION HELPERS
 */

export async function sendPushToUser(userId: string, payload: { title: string, body: string, data?: Record<string, string>, category?: string, senderId?: string }) {
  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) return;
    const userData = userSnap.data() as any;
    const fcmToken = userData.fcmToken;

    // Check if sender is muted
    const mutedUserIds = userData.social?.mutedUserIds || [];
    if (payload.senderId && mutedUserIds.includes(payload.senderId)) {
      console.log(`User ${userId} has muted sender ${payload.senderId}. Skipping push.`);
      return;
    }

    const settings = userData.notificationSettings || {
      messages: true,
      likes: true,
      superLikes: true,
      fortunes: true,
      compatibility: true,
      rewards: true,
      broadcasts: true,
      reminders: true,
      system: true
    };

    if (!fcmToken) return;

    // Check preference based on category
    if (payload.category && settings[payload.category] === false) {
      console.log(`User ${userId} has disabled ${payload.category} notifications.`);
      return;
    }

    const message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          }
        }
      }
    };

    await messaging.send(message);
    console.log(`Push sent to user ${userId}`);
  } catch (error: any) {
    console.error(`Error sending push to user ${userId}:`, error);
    if (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-registration-token') {
      console.log(`Cleaning up invalid token for user ${userId}`);
      await db.collection("users").doc(userId).update({ fcmToken: FieldValue.delete() });
    }
  }
}
