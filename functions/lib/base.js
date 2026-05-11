"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openAiKey = exports.FieldValue = exports.corsHandler = exports.storage = exports.messaging = exports.db = void 0;
exports.getOpenAI = getOpenAI;
exports.sendPushToUser = sendPushToUser;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const storage_1 = require("firebase-admin/storage");
const openai_1 = __importDefault(require("openai"));
const params_1 = require("firebase-functions/params");
const cors_1 = __importDefault(require("cors"));
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.db = (0, firestore_1.getFirestore)();
exports.messaging = (0, messaging_1.getMessaging)();
exports.storage = (0, storage_1.getStorage)();
exports.corsHandler = (0, cors_1.default)({ origin: true });
exports.FieldValue = firestore_1.FieldValue;
exports.openAiKey = (0, params_1.defineSecret)("OPENAI_API_KEY");
let _openai = null;
function getOpenAI() {
    try {
        const key = exports.openAiKey.value();
        if (!key) {
            throw new Error("OPENAI_API_KEY is not set in environment/secrets.");
        }
        if (!_openai) {
            _openai = new openai_1.default({ apiKey: key });
        }
        return _openai;
    }
    catch (error) {
        console.error("OpenAI Access Error:", error);
        throw new functions.https.HttpsError('failed-precondition', 'AI servisine şu an ulaşılamıyor. Lütfen daha sonra tekrar deneyiniz.');
    }
}
async function sendPushToUser(userId, payload) {
    try {
        const userSnap = await exports.db.collection("users").doc(userId).get();
        if (!userSnap.exists) {
            console.log(`PUSH_LOG: User ${userId} not found in Firestore.`);
            return;
        }
        const userData = userSnap.data();
        const fcmToken = userData.fcmToken;
        const fcmTokens = userData.fcmTokens || [];
        const allTokens = Array.from(new Set([fcmToken, ...fcmTokens])).filter(t => typeof t === 'string' && t.length > 10);
        console.log(`PUSH_LOG: Found ${allTokens.length} tokens for user ${userId}. Tokens:`, allTokens);
        if (allTokens.length === 0) {
            console.log(`PUSH_LOG: No valid tokens for user ${userId}. userData keys:`, Object.keys(userData));
            return;
        }
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
        const safeData = {
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
        if (payload.category) {
            safeData['category'] = String(payload.category);
        }
        if (payload.senderId) {
            safeData['senderId'] = String(payload.senderId);
        }
        const messages = allTokens.map(token => {
            const msg = {
                token,
                notification: {
                    title: payload.title,
                    body: payload.body,
                },
                data: safeData,
                android: {
                    priority: 'high',
                    notification: {
                        channelId: 'lasya_default_channel',
                        icon: 'ic_stat_lasya',
                        color: '#8B5CF6',
                        sound: 'default',
                        priority: 'max',
                        visibility: 'public',
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
            const response = await exports.messaging.send(messages[0]);
            console.log(`PUSH_LOG: Successfully sent single push to ${userId}. MessageId:`, response);
        }
        else {
            const response = await exports.messaging.sendEach(messages);
            console.log(`PUSH_LOG: Multicast push response for ${userId}: Success: ${response.successCount}, Failure: ${response.failureCount}`);
            const tokensToRemove = [];
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
                const updates = {
                    fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove)
                };
                if (userData.fcmToken && tokensToRemove.includes(userData.fcmToken)) {
                    updates.fcmToken = admin.firestore.FieldValue.delete();
                }
                await exports.db.collection("users").doc(userId).update(updates);
            }
        }
    }
    catch (error) {
        console.error(`PUSH_LOG: FATAL Error sending push to user ${userId}:`, error);
    }
}
//# sourceMappingURL=base.js.map