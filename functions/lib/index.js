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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runManualCompatibilityAnalysis = exports.processCompatibilityRequests = exports.runDiscoverCompatibilityAnalysis = exports.createChat = exports.createReport = exports.unmuteUser = exports.muteUser = exports.unblockUser = exports.blockUser = exports.setTypingStatus = exports.editMessage = exports.deleteMessage = exports.deleteChat = exports.markAsDelivered = exports.markAsSeen = exports.sendMessage = exports.rejectRequest = exports.acceptRequest = exports.sendMessageRequest = exports.sendLike = exports.refreshDiscover = exports.refreshDiscoverFeed = exports.updateSocialSettings = exports.updateSocialProfile = exports.completeSocialOnboarding = exports.updateReadingStatuses = exports.generateDailyMessage = exports.upgradeFortunePriority = exports.processFortuneAI = exports.createFortuneReading = exports.adminManagePromoCode = exports.adminUpdateReport = exports.adminUpdateConfig = exports.adminUpdateUser = exports.adminAdjustWallet = exports.adminSetWallet = exports.adminModerationAction = exports.getAdminChatMessages = exports.getAdminUserChats = exports.adminGrantWalletReward = exports.adminBroadcastNotification = exports.redeemPromoCode = exports.consumeSocialFeature = exports.purchaseSocialBundle = exports.purchaseSocialItem = exports.purchaseBoostPackage = exports.buyFortuneSubscription = exports.spendBalance = exports.purchaseCoins = exports.watchAdReward = void 0;
exports.checkDailyReminders = void 0;
const wallet = __importStar(require("./wallet"));
const admin = __importStar(require("./admin"));
const fortune = __importStar(require("./fortune"));
const social = __importStar(require("./social"));
exports.watchAdReward = wallet.watchAdReward;
exports.purchaseCoins = wallet.purchaseCoins;
exports.spendBalance = wallet.spendBalance;
exports.buyFortuneSubscription = wallet.buyFortuneSubscription;
exports.purchaseBoostPackage = wallet.purchaseBoostPackage;
exports.purchaseSocialItem = wallet.purchaseSocialItem;
exports.purchaseSocialBundle = wallet.purchaseSocialBundle;
exports.consumeSocialFeature = wallet.consumeSocialFeature;
exports.redeemPromoCode = wallet.redeemPromoCode;
exports.adminBroadcastNotification = admin.adminBroadcastNotification;
exports.adminGrantWalletReward = admin.adminGrantWalletReward;
exports.getAdminUserChats = admin.getAdminUserChats;
exports.getAdminChatMessages = admin.getAdminChatMessages;
exports.adminModerationAction = admin.adminModerationAction;
exports.adminSetWallet = admin.adminSetWallet;
exports.adminAdjustWallet = admin.adminAdjustWallet;
exports.adminUpdateUser = admin.adminUpdateUser;
exports.adminUpdateConfig = admin.adminUpdateConfig;
exports.adminUpdateReport = admin.adminUpdateReport;
exports.adminManagePromoCode = admin.adminManagePromoCode;
exports.createFortuneReading = fortune.createFortuneReading;
exports.processFortuneAI = fortune.processFortuneAI;
exports.upgradeFortunePriority = fortune.upgradeFortunePriority;
exports.generateDailyMessage = fortune.generateDailyMessage;
exports.updateReadingStatuses = fortune.updateReadingStatuses;
exports.completeSocialOnboarding = social.completeSocialOnboarding;
exports.updateSocialProfile = social.updateSocialProfile;
exports.updateSocialSettings = social.updateSocialSettings;
exports.refreshDiscoverFeed = social.refreshDiscoverFeed;
exports.refreshDiscover = social.refreshDiscover;
exports.sendLike = social.sendLike;
exports.sendMessageRequest = social.sendMessageRequest;
exports.acceptRequest = social.acceptRequest;
exports.rejectRequest = social.rejectRequest;
exports.sendMessage = social.sendMessage;
exports.markAsSeen = social.markAsSeen;
exports.markAsDelivered = social.markAsDelivered;
exports.deleteChat = social.deleteChat;
exports.deleteMessage = social.deleteMessage;
exports.editMessage = social.editMessage;
exports.setTypingStatus = social.setTypingStatus;
exports.blockUser = social.blockUser;
exports.unblockUser = social.unblockUser;
exports.muteUser = social.muteUser;
exports.unmuteUser = social.unmuteUser;
exports.createReport = social.createReport;
exports.createChat = social.createChat;
exports.runDiscoverCompatibilityAnalysis = social.runDiscoverCompatibilityAnalysis;
exports.processCompatibilityRequests = social.processCompatibilityRequests;
exports.runManualCompatibilityAnalysis = social.runManualCompatibilityAnalysis;
exports.checkDailyReminders = social.checkDailyReminders;
//# sourceMappingURL=index.js.map