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
export const FieldValue = NativeFieldValue;

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
    if (!userSnap.exists) {
      console.log(`PUSH_LOG: User ${userId} not found in Firestore.`);
      return;
    }
    const userData = userSnap.data() as any;
    const fcmToken = userData.fcmToken;
    const fcmTokens = userData.fcmTokens || [];
    
    // Combine tokens and remove duplicates/empty
    const allTokens: string[] = Array.from(new Set([fcmToken, ...fcmTokens])).filter(t => typeof t === 'string' && t.length > 10);

    console.log(`PUSH_LOG: Found ${allTokens.length} tokens for user ${userId}. Tokens:`, allTokens);

    if (allTokens.length === 0) {
      console.log(`PUSH_LOG: No valid tokens for user ${userId}. userData keys:`, Object.keys(userData));
      return;
    }

    // Check if sender is muted
    const mutedUserIds = userData.social?.mutedUserIds || [];
    if (payload.senderId && mutedUserIds.includes(payload.senderId)) {
      console.log(`PUSH_LOG: User ${userId} has muted sender ${payload.senderId}. Skipping push.`);
      return;
    }

    const settings = userData.notificationSettings || userData.social?.settings?.notifications || {
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

    console.log(`PUSH_LOG: Notification settings for ${userId}:`, JSON.stringify(settings));

    if (payload.category && settings[payload.category] === false) {
      console.log(`PUSH_LOG: User ${userId} has disabled ${payload.category} notifications.`);
      return;
    }

    // FCM HTTP v1 requires all data values to be strictly strings
    const safeData: Record<string, string> = {
      title: String(payload.title),
      body: String(payload.body)
    };

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

    const messages = allTokens.map(token => {
      const msg: any = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: safeData,
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'lasya_default_channel',
            icon: 'ic_stat_lasya',
            color: '#8B5CF6',
            sound: 'default',
            priority: 'max' as const,
            visibility: 'public' as const,
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

      if (safeData.chatId) {
        msg.android.notification.tag = safeData.chatId;
      }

      return msg;
    });

    console.log("PUSH_LOG: Final Payload (first token):", JSON.stringify(messages[0]));

    if (messages.length === 1) {
      const response = await messaging.send(messages[0]);
      console.log(`PUSH_LOG: Successfully sent single push to ${userId}. MessageId:`, response);
    } else {
      const response = await messaging.sendEach(messages);
      console.log(`PUSH_LOG: Multicast push response for ${userId}: Success: ${response.successCount}, Failure: ${response.failureCount}`);
      const tokensToRemove: string[] = [];
      response.responses.forEach((res, idx) => {
        if (!res.success && res.error) {
          const code = res.error.code;
          console.error(`PUSH_LOG: Detailed failure for token ${allTokens[idx]}:`, res.error);
          if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
            tokensToRemove.push(allTokens[idx]);
          }
        }
      });

      if (tokensToRemove.length > 0) {
        console.log(`PUSH_LOG: Removing ${tokensToRemove.length} invalid tokens for user ${userId}`);
        const updates: any = {
          fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove)
        };
        if (userData.fcmToken && tokensToRemove.includes(userData.fcmToken)) {
          updates.fcmToken = admin.firestore.FieldValue.delete();
        }
        await db.collection("users").doc(userId).update(updates);
      }
    }
  } catch (error: any) {
    console.error(`PUSH_LOG: FATAL Error sending push to user ${userId}:`, error);
  }
}
