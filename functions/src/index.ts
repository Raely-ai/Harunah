import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import cors from "cors";

// Ensure admin is initialized before anything else
if (!admin.apps.length) {
  admin.initializeApp();
}

// Global CORS handler for any future onRequest functions
const corsHandler = cors({ origin: true });

/**
 * SOURCE OF TRUTH:
 * All function implementations use https.onCall for automatic CORS and Auth handling.
 * If net::ERR_FAILED persists, consider migrating to Firebase Functions v2 which
 * supports explicit CORS configuration.
 */
import * as social from "./social";
import * as wallet from "./wallet";
import * as fortune from "./fortune";
import * as adminFunctions from "./admin";
import * as test from "./test";

/**
 * EXPORT SOCIAL FUNCTIONS
 */
export const {
  completeSocialOnboarding,
  updateSocialProfile,
  updateSocialSettings,
  refreshDiscover,
  refreshDiscoverFeed,
  sendLike,
  sendMessageRequest,
  sendPriorityMessageRequest,
  acceptRequest,
  rejectRequest,
  sendMessage,
  markAsSeen,
  markAsDelivered,
  deleteChat,
  deleteMessage,
  editMessage,
  setTypingStatus,
  blockUser,
  unblockUser,
  muteUser,
  unmuteUser,
  createReport,
  createChat,
  runDiscoverCompatibilityAnalysis,
  runManualCompatibilityAnalysis,
  speedUpCompatibilityAnalysis,
  claimOnboardingDiscoverBonus,
  claim10MinuteReward,
  resetDailyDiscoverLikes,
  claimProfileCompletionReward,
  submitProfileVerification,
  adminUpdateVerificationStatus,
  onMessageCreated,
  notifyUnlockedCompatibility,
  notifyDailyEngagement,
  generateThumbnails
} = social;

/**
 * EXPORT TEST FUNCTIONS
 */
export const {
  testPing,
  testPingV2
} = test;

/**
 * EXPORT WALLET FUNCTIONS
 */
export const {
  watchAdReward,
  purchaseCoins,
  spendBalance,
  buyFortuneSubscription,
  purchaseBoostPackage,
  purchaseSocialItem,
  purchaseSocialBundle,
  redeemPromoCode,
  claimDailyLoginReward,
  claimVerificationReward,
  claimFreeCompatibilityReward
} = wallet;

/**
 * EXPORT FORTUNE FUNCTIONS
 */
export const {
  createFortuneReading,
  processFortuneAI,
  upgradeFortunePriority,
  generateDailyMessage,
  updateReadingStatuses
} = fortune;

/**
 * EXPORT ADMIN FUNCTIONS
 */
export const {
  adminBroadcastNotification,
  adminGrantWalletReward,
  getAdminUserChats,
  getAdminChatMessages,
  adminModerationAction,
  adminSetWallet,
  adminAdjustWallet,
  adminUpdateUser,
  adminUpdateConfig,
  adminUpdateReport,
  adminManagePromoCode
} = adminFunctions;
