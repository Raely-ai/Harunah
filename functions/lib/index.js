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
exports.createFortuneReading = exports.claimFreeCompatibilityReward = exports.claimVerificationReward = exports.claimDailyLoginReward = exports.redeemPromoCode = exports.purchaseSocialBundle = exports.purchaseSocialItem = exports.purchaseBoostPackage = exports.buyFortuneSubscription = exports.spendBalance = exports.purchaseCoins = exports.watchAdReward = exports.testPingV2 = exports.testPing = exports.generateThumbnails = exports.notifyDailyEngagement = exports.notifyUnlockedCompatibility = exports.onMessageCreated = exports.adminUpdateVerificationStatus = exports.submitProfileVerification = exports.claimProfileCompletionReward = exports.resetDailyDiscoverLikes = exports.claim10MinuteReward = exports.claimOnboardingDiscoverBonus = exports.speedUpCompatibilityAnalysis = exports.runManualCompatibilityAnalysis = exports.runDiscoverCompatibilityAnalysis = exports.createChat = exports.createReport = exports.unmuteUser = exports.muteUser = exports.unblockUser = exports.blockUser = exports.setTypingStatus = exports.editMessage = exports.deleteMessage = exports.deleteChat = exports.markAsDelivered = exports.markAsSeen = exports.sendMessage = exports.rejectRequest = exports.acceptRequest = exports.sendPriorityMessageRequest = exports.sendMessageRequest = exports.sendLike = exports.refreshDiscoverFeed = exports.refreshDiscover = exports.updateSocialSettings = exports.updateSocialProfile = exports.completeSocialOnboarding = void 0;
exports.adminManagePromoCode = exports.adminUpdateReport = exports.adminUpdateConfig = exports.adminUpdateUser = exports.adminAdjustWallet = exports.adminSetWallet = exports.adminModerationAction = exports.getAdminChatMessages = exports.getAdminUserChats = exports.adminGrantWalletReward = exports.adminBroadcastNotification = exports.updateReadingStatuses = exports.generateDailyMessage = exports.upgradeFortunePriority = exports.processFortuneAI = void 0;
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const corsHandler = (0, cors_1.default)({ origin: true });
const social = __importStar(require("./social"));
const wallet = __importStar(require("./wallet"));
const fortune = __importStar(require("./fortune"));
const adminFunctions = __importStar(require("./admin"));
const test = __importStar(require("./test"));
exports.completeSocialOnboarding = social.completeSocialOnboarding, exports.updateSocialProfile = social.updateSocialProfile, exports.updateSocialSettings = social.updateSocialSettings, exports.refreshDiscover = social.refreshDiscover, exports.refreshDiscoverFeed = social.refreshDiscoverFeed, exports.sendLike = social.sendLike, exports.sendMessageRequest = social.sendMessageRequest, exports.sendPriorityMessageRequest = social.sendPriorityMessageRequest, exports.acceptRequest = social.acceptRequest, exports.rejectRequest = social.rejectRequest, exports.sendMessage = social.sendMessage, exports.markAsSeen = social.markAsSeen, exports.markAsDelivered = social.markAsDelivered, exports.deleteChat = social.deleteChat, exports.deleteMessage = social.deleteMessage, exports.editMessage = social.editMessage, exports.setTypingStatus = social.setTypingStatus, exports.blockUser = social.blockUser, exports.unblockUser = social.unblockUser, exports.muteUser = social.muteUser, exports.unmuteUser = social.unmuteUser, exports.createReport = social.createReport, exports.createChat = social.createChat, exports.runDiscoverCompatibilityAnalysis = social.runDiscoverCompatibilityAnalysis, exports.runManualCompatibilityAnalysis = social.runManualCompatibilityAnalysis, exports.speedUpCompatibilityAnalysis = social.speedUpCompatibilityAnalysis, exports.claimOnboardingDiscoverBonus = social.claimOnboardingDiscoverBonus, exports.claim10MinuteReward = social.claim10MinuteReward, exports.resetDailyDiscoverLikes = social.resetDailyDiscoverLikes, exports.claimProfileCompletionReward = social.claimProfileCompletionReward, exports.submitProfileVerification = social.submitProfileVerification, exports.adminUpdateVerificationStatus = social.adminUpdateVerificationStatus, exports.onMessageCreated = social.onMessageCreated, exports.notifyUnlockedCompatibility = social.notifyUnlockedCompatibility, exports.notifyDailyEngagement = social.notifyDailyEngagement, exports.generateThumbnails = social.generateThumbnails;
exports.testPing = test.testPing, exports.testPingV2 = test.testPingV2;
exports.watchAdReward = wallet.watchAdReward, exports.purchaseCoins = wallet.purchaseCoins, exports.spendBalance = wallet.spendBalance, exports.buyFortuneSubscription = wallet.buyFortuneSubscription, exports.purchaseBoostPackage = wallet.purchaseBoostPackage, exports.purchaseSocialItem = wallet.purchaseSocialItem, exports.purchaseSocialBundle = wallet.purchaseSocialBundle, exports.redeemPromoCode = wallet.redeemPromoCode, exports.claimDailyLoginReward = wallet.claimDailyLoginReward, exports.claimVerificationReward = wallet.claimVerificationReward, exports.claimFreeCompatibilityReward = wallet.claimFreeCompatibilityReward;
exports.createFortuneReading = fortune.createFortuneReading, exports.processFortuneAI = fortune.processFortuneAI, exports.upgradeFortunePriority = fortune.upgradeFortunePriority, exports.generateDailyMessage = fortune.generateDailyMessage, exports.updateReadingStatuses = fortune.updateReadingStatuses;
exports.adminBroadcastNotification = adminFunctions.adminBroadcastNotification, exports.adminGrantWalletReward = adminFunctions.adminGrantWalletReward, exports.getAdminUserChats = adminFunctions.getAdminUserChats, exports.getAdminChatMessages = adminFunctions.getAdminChatMessages, exports.adminModerationAction = adminFunctions.adminModerationAction, exports.adminSetWallet = adminFunctions.adminSetWallet, exports.adminAdjustWallet = adminFunctions.adminAdjustWallet, exports.adminUpdateUser = adminFunctions.adminUpdateUser, exports.adminUpdateConfig = adminFunctions.adminUpdateConfig, exports.adminUpdateReport = adminFunctions.adminUpdateReport, exports.adminManagePromoCode = adminFunctions.adminManagePromoCode;
//# sourceMappingURL=index.js.map