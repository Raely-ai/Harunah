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
exports.openAiKey = exports.FieldValue = exports.messaging = exports.db = void 0;
exports.getOpenAI = getOpenAI;
exports.sendPushToUser = sendPushToUser;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const openai_1 = __importDefault(require("openai"));
const params_1 = require("firebase-functions/params");
if (!admin.apps.length) {
    admin.initializeApp();
}
exports.db = (0, firestore_1.getFirestore)();
exports.messaging = (0, messaging_1.getMessaging)();
exports.FieldValue = admin.firestore.FieldValue;
exports.openAiKey = (0, params_1.defineSecret)("OPENAI_API_KEY");
let _openai = null;
/**
 * Lazy initialization of OpenAI.
 * Accessing .value() at module load time is dangerous.
 */
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
        if (!userSnap.exists)
            return;
        const userData = userSnap.data();
        const fcmToken = userData.fcmToken;
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
        if (!fcmToken)
            return;
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
                priority: 'high',
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
        await exports.messaging.send(message);
        console.log(`Push sent to user ${userId}`);
    }
    catch (error) {
        console.error(`Error sending push to user ${userId}:`, error);
        if (error.code === 'messaging/registration-token-not-registered' || error.code === 'messaging/invalid-registration-token') {
            console.log(`Cleaning up invalid token for user ${userId}`);
            await exports.db.collection("users").doc(userId).update({ fcmToken: exports.FieldValue.delete() });
        }
    }
}
//# sourceMappingURL=base.js.map