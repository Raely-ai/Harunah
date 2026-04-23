import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Ensure admin is initialized before anything else
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * SOURCE OF TRUTH:
 * All function implementations are moved to their respective modules for 
 * maintainability and to avoid code duplication errors.
 */
import * as social from "./social";
import * as wallet from "./wallet";
import * as fortune from "./fortune";
import * as adminFunctions from "./admin";

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
  processCompatibilityRequests,
  checkDailyReminders
} = social;

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
  redeemPromoCode
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
