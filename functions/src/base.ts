import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue as NativeFieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getStorage } from "firebase-admin/storage";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import cors from "cors";

if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = getFirestore();
export const messaging = getMessaging();
export const storage = getStorage();

export const corsHandler = cors({ origin: true });

/**
 * Robust FieldValue export to prevent 'undefined' issues in some environments.
 */
export const FieldValue = admin.firestore.FieldValue;

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

export async function sendPushToUser(userId: string, payload: { title: string, body: string, data?: Record<string, string>, category?: string, senderId?: string, imageUrl?: string }) {
  try {
    const userSnap = await db.collection("users").doc(userId).get();
    if (!userSnap.exists) return;
    const userData = userSnap.data() as any;
    const fcmToken = userData.fcmToken;
    const fcmTokens = userData.fcmTokens || [];
    
    // Combine tokens and remove duplicates/empty
    const allTokens: string[] = Array.from(new Set([fcmToken, ...fcmTokens])).filter(t => typeof t === 'string' && t.length > 10);

    if (allTokens.length === 0) return;

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

    if (payload.category && settings[payload.category] === false) {
      console.log(`User ${userId} has disabled ${payload.category} notifications.`);
      return;
    }

    // FCM HTTP v1 requires all data values to be strictly strings
    const safeData: Record<string, string> = {};
    if (payload.data) {
      for (const [key, value] of Object.entries(payload.data)) {
        if (value !== undefined && value !== null && value !== '') {
          safeData[key] = String(value);
        }
      }
    }
    
    // Add category and senderId into data payload if they exist
    if (payload.category) {
      safeData['category'] = String(payload.category);
    }
    if (payload.senderId) {
      safeData['senderId'] = String(payload.senderId);
    }
    if (payload.imageUrl) {
      safeData['imageUrl'] = String(payload.imageUrl);
    }

    const messages = allTokens.map(token => ({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        image: payload.imageUrl,
      },
      data: safeData,
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'lasya_messages',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
          image: payload.imageUrl,
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'mutable-content': payload.imageUrl ? 1 : 0
          }
        },
        fcm_options: {
          image: payload.imageUrl
        }
      }
    }));

    if (messages.length === 1) {
      await messaging.send(messages[0]);
    } else {
      const response = await messaging.sendEach(messages);
      const tokensToRemove: string[] = [];
      response.responses.forEach((res, idx) => {
        if (!res.success && res.error) {
          const code = res.error.code;
          if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
            tokensToRemove.push(allTokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        await db.collection("users").doc(userId).update({
          fcmTokens: FieldValue.arrayRemove(...tokensToRemove)
        });
      }
    }
    console.log(`Push sent to user ${userId}`);
  } catch (error: any) {
    console.error(`Error sending push to user ${userId}:`, error);
  }
}
