import * as wallet from "./wallet";
import * as admin from "./admin";
import * as fortune from "./fortune";
import * as social from "./social";

// Wallet Functions
export const watchAdReward = wallet.watchAdReward;
export const purchaseCoins = wallet.purchaseCoins;
export const spendBalance = wallet.spendBalance;
export const buyFortuneSubscription = wallet.buyFortuneSubscription;
export const purchaseBoostPackage = wallet.purchaseBoostPackage;
export const purchaseSocialItem = wallet.purchaseSocialItem;
export const purchaseSocialBundle = wallet.purchaseSocialBundle;
export const consumeSocialFeature = wallet.consumeSocialFeature;
export const redeemPromoCode = wallet.redeemPromoCode;

// Admin Functions
export const adminBroadcastNotification = admin.adminBroadcastNotification;
export const adminGrantWalletReward = admin.adminGrantWalletReward;
export const getAdminUserChats = admin.getAdminUserChats;
export const getAdminChatMessages = admin.getAdminChatMessages;
export const adminModerationAction = admin.adminModerationAction;
export const adminSetWallet = admin.adminSetWallet;
export const adminAdjustWallet = admin.adminAdjustWallet;
export const adminUpdateUser = admin.adminUpdateUser;
export const adminUpdateConfig = admin.adminUpdateConfig;
export const adminUpdateReport = admin.adminUpdateReport;
export const adminManagePromoCode = admin.adminManagePromoCode;

// Fortune Functions
export const createFortuneReading = fortune.createFortuneReading;
export const processFortuneAI = fortune.processFortuneAI;
export const upgradeFortunePriority = fortune.upgradeFortunePriority;
export const generateDailyMessage = fortune.generateDailyMessage;
export const updateReadingStatuses = fortune.updateReadingStatuses;

// Social Functions
export const completeSocialOnboarding = social.completeSocialOnboarding;
export const updateSocialProfile = social.updateSocialProfile;
export const updateSocialSettings = social.updateSocialSettings;
export const refreshDiscoverFeed = social.refreshDiscoverFeed;
export const refreshDiscover = social.refreshDiscover;
export const sendLike = social.sendLike;
export const sendMessageRequest = social.sendMessageRequest;
export const acceptRequest = social.acceptRequest;
export const rejectRequest = social.rejectRequest;
export const sendMessage = social.sendMessage;
export const markAsSeen = social.markAsSeen;
export const markAsDelivered = social.markAsDelivered;
export const deleteChat = social.deleteChat;
export const deleteMessage = social.deleteMessage;
export const editMessage = social.editMessage;
export const setTypingStatus = social.setTypingStatus;
export const blockUser = social.blockUser;
export const unblockUser = social.unblockUser;
export const muteUser = social.muteUser;
export const unmuteUser = social.unmuteUser;
export const createReport = social.createReport;
export const createChat = social.createChat;
export const runDiscoverCompatibilityAnalysis = social.runDiscoverCompatibilityAnalysis;
export const processCompatibilityRequests = social.processCompatibilityRequests;
export const runManualCompatibilityAnalysis = social.runManualCompatibilityAnalysis;
export const checkDailyReminders = social.checkDailyReminders;
