export type FortuneType = 'coffee' | 'tarot' | 'water' | 'ebced' | 'yildizname' | 'havas' | 'dream';

export type AuthScreen = 'welcome' | 'login' | 'register' | 'forgot-password';

export type AppTab = 'home' | 'fortunes' | 'messages' | 'history' | 'wallet' | 'profile' | 'social-intro' | 'social-onboarding' | 'social-profile' | 'social-management';

export type ReadingStatus = 'pending' | 'waiting' | 'interpreting' | 'completed' | 'error' | 'searching' | 'found';

export interface FortuneReading {
  id: string;
  type: FortuneType;
  title: string;
  content: string;
  date: string;
  status: ReadingStatus;
  images?: string[];
  cards?: string[];
  questions?: string[];
  isFavorite?: boolean;
  isPriority?: boolean;
  userId: string;
  creditsUsed?: number;
  balanceType?: 'main' | 'ad' | 'subscription';
  
  // New Timestamp Fields for Queue Management
  queueStartedAt?: string;
  interpretationStartedAt?: string;
  expectedReaderFoundAt?: string;
  expectedCompletedAt?: string;
  expectedReadyAt?: string;
  isAIGenerated?: boolean;
  isAIGenerating?: boolean;
  priority?: boolean;
  priorityMode?: boolean;
  updatedAt?: string;
  createdAt?: string;
  isSeenByUser?: boolean;
  
  // AI Metadata
  promptSource?: 'admin' | 'default';
  promptId?: string;
  promptVersion?: string;
  error?: string;
  resultText?: string;
  hiddenResult?: string;
  notificationFlags?: {
    searchingSent?: boolean;
    foundSent?: boolean;
    interpretingSent?: boolean;
    completedSent?: boolean;
  };

  // Form Data
  formData: {
    adSoyad: string;
    dogumTarihi: string;
    iliskiDurumu: string;
    motherName?: string;
    fatherName?: string;
  };
  priceBreakdown?: {
    base: number;
    extraQuestions: number;
    priority: number;
    total: number;
  };
}

export interface PromoCode {
  id: string;
  code: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
  maxTotalUses: number;
  maxUsesPerUser: number;
  currentUses: number;
  onlyNewUsers: boolean;
  description: string;
  source: string;
  sourceName: string;
  rewards: {
    energy?: number;
    mainCoins?: number;
    fortuneSubscription?: 'daily' | 'weekly' | 'monthly';
    boostDays?: number;
    socialFeatures?: {
      superLike?: number;
      refresh?: number;
      analysis?: number;
    };
  };
  createdAt: string;
  createdBy: string;
}

export interface PromoCodeRedemption {
  id: string;
  promoCodeId: string;
  code: string;
  userId: string;
  userEmail: string;
  redeemedAt: string;
  rewards: any;
}

export interface CompatibilityHistory {
  id: string;
  userId: string;
  source: 'discover' | 'manual';
  targetUserId: string;
  targetName: string;
  targetPhoto: string;
  relationshipType: RelationshipType;
  loveScore: number;
  friendshipScore: number;
  energyScore: number;
  summaryShort: string;
  summaryLong: string;
  aiComment?: string;
  createdAt: string;
  cacheKey: string;
  person1?: {
    name: string;
    birthDate: string;
    status: string;
    photo: string;
  };
  person2?: {
    name: string;
    birthDate: string;
    status: string;
    photo: string;
  };
}

export type RelationshipType = 
  | 'ask' 
  | 'arkadas' 
  | 'flirt' 
  | 'platonik' 
  | 'gorucu_usulu' 
  | 'eski_sevgili' 
  | 'karsiliksiz_sevgi' 
  | 'evlilik_adayi';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  birthDate?: string;
  relationshipStatus?: string;
  jobStatus?: string;
  gender?: string;
  extraInfo?: string;
  createdAt: string;
  // Wallet & Economy (New Structure)
  mainCoins: number;
  energy: number;
  superLikes: number;
  refreshCount: number;
  compatibilityCount: number;
  dailyAdWatchCount: number;
  lastAdReset: string;

  // Deprecated Wallet Fields (Do not use in new code)
  credits?: number;
  adCredits?: number;
  dailyAdCount?: number;
  lastAdDate?: string;
  superLikeCount?: number;
  analysisCount?: number;
  discoverRefreshCount?: number;
  extraSwipeQuota?: number;
  dailyAdReadingsUsed?: {
    coffee: number;
    tarot: number;
    lastResetDate: string;
  };
  isBanned?: boolean;
  role?: 'user' | 'admin' | 'social_operator';
  lastLoginAt?: string;
  
  // Managed Profiles for Social Operators
  isManagedProfile?: boolean;
  profileType?: 'operator' | 'user';
  
  // Social Fields (Deprecated, use 'social' object)
  socialEnabled?: boolean;
  socialProfileCompleted?: boolean;
  socialVisible?: boolean;
  nickname?: string;
  lookingFor?: string;
  interests?: string[];
  photos?: string[];
  bio?: string;
  socialBan?: boolean;
  
  // New Social Structure
  social?: {
    enabled: boolean;
    profileCompleted: boolean;
    nickname: string;
    gender: 'erkek' | 'kadın';
    age?: number;
    lookingFor: string;
    bio: string;
    photos: string[];
    interests: string[];
    visible: boolean;
    banned: boolean;
    isOnline?: boolean;
    lastSeen?: any;
    updatedAt?: string;
    settings: {
      whoCanMessage: 'everyone' | 'friends' | 'nobody';
      whoCanAddFriend: 'everyone' | 'nobody';
      notifications: {
        messages: boolean;
        friendRequests: boolean;
        roomInvites: boolean;
        gifts: boolean;
      };
    };
    lastDiscoverRefreshAt?: string;
    discoverRefreshCredits?: number;
    lastFreeRefreshAt?: string;
    recentDiscoverIds?: string[];
    blockedUserIds?: string[];
    mutedUserIds?: string[];
  };

  // Notification & FCM
  fcmToken?: string;
  notificationSettings?: {
    messages: boolean;
    likes: boolean;
    superLikes: boolean;
    fortunes: boolean;
    compatibility: boolean;
    rewards: boolean;
    broadcasts: boolean;
    reminders: boolean;
    system: boolean;
  };
  
  // Reminder Timestamps
  lastFreeDiscoverReminderAt?: string;
  lastDailyEnergyReminderAt?: string;
  lastCompatibilityRewardReminderAt?: string;
  lastAdRewardReminderAt?: string;

  zodiacSign?: string;
  element?: string;
  rulingPlanet?: string;
  friendlySign?: string;
  enemySign?: string;
  age?: number;
  location?: {
    city: string;
    country: string;
  };
  dailySwipeCount?: number;
  lastSwipeDate?: string;

  // Swipe Limit Fields
  dailySwipeLimit?: number;
  dailySwipeUsed?: number;
  dailySwipeDate?: string;
  dailyFreeRefreshUsed?: boolean;
  dailyFreeSuperLikeUsed?: boolean;
  extraSwipeLimit?: number;
  
  // Social Wallet Fields
  boostExpiresAt?: string;
  
  subscription?: {
    status: 'active' | 'inactive' | 'expired' | 'none';
    type: 'none' | 'daily' | 'weekly' | 'monthly';
    expiresAt?: string;
    dailyLimitUsed: number;
    dailyLimit?: number;
    lastResetAt?: string;
    dailyReadingsUsed?: {
      coffee: number;
      tarot: number;
      advanced: number;
    };
  };
}

/**
 * Normalizes a UserProfile object from Firestore, ensuring new fields are populated
 * from old fields if they are missing (Backward Compatibility).
 */
export function normalizeUserProfile(data: any, uid: string): UserProfile {
  const profile = { ...data, uid } as UserProfile;

  // 1. Wallet Normalization
  if (profile.mainCoins === undefined && data.credits !== undefined) profile.mainCoins = data.credits;
  if (profile.energy === undefined && data.adCredits !== undefined) profile.energy = data.adCredits;
  if (profile.dailyAdWatchCount === undefined && data.dailyAdCount !== undefined) profile.dailyAdWatchCount = data.dailyAdCount;
  if (profile.lastAdReset === undefined && data.lastAdDate !== undefined) profile.lastAdReset = data.lastAdDate;
  if (profile.superLikes === undefined && data.superLikeCount !== undefined) profile.superLikes = data.superLikeCount;
  if (profile.refreshCount === undefined && data.discoverRefreshCount !== undefined) profile.refreshCount = data.discoverRefreshCount;
  if (profile.compatibilityCount === undefined && data.analysisCount !== undefined) profile.compatibilityCount = data.analysisCount;
  if (profile.compatibilityCount === undefined && data.social?.compatibilityCredits !== undefined) profile.compatibilityCount = data.social.compatibilityCredits;

  // Defaults for required wallet fields
  if (profile.mainCoins === undefined) profile.mainCoins = 0;
  if (profile.energy === undefined) profile.energy = 0;
  if (profile.superLikes === undefined) profile.superLikes = 0;
  if (profile.refreshCount === undefined) profile.refreshCount = 0;
  if (profile.compatibilityCount === undefined) profile.compatibilityCount = 0;
  if (profile.dailyAdWatchCount === undefined) profile.dailyAdWatchCount = 0;
  if (profile.lastAdReset === undefined) profile.lastAdReset = new Date().toISOString();

  // 2. Social Normalization
  if (!profile.social) {
    profile.social = {
      enabled: data.socialEnabled || false,
      profileCompleted: data.socialProfileCompleted || false,
      nickname: data.nickname || data.displayName || "Gezgin",
      gender: (data.gender as any) || (data.social?.gender as any) || 'erkek',
      lookingFor: data.lookingFor || 'arkadaş',
      bio: data.bio || '',
      photos: data.photos || [],
      interests: data.interests || [],
      visible: data.socialVisible !== undefined ? data.socialVisible : true,
      banned: data.socialBan || false,
      lastFreeRefreshAt: data.social?.lastFreeRefreshAt || "",
      recentDiscoverIds: data.social?.recentDiscoverIds || [],
      blockedUserIds: data.social?.blockedUserIds || [],
      mutedUserIds: data.social?.mutedUserIds || [],
      settings: {
        whoCanMessage: 'everyone',
        whoCanAddFriend: 'everyone',
        notifications: {
          messages: true,
          friendRequests: true,
          roomInvites: true,
          gifts: true
        }
      }
    };
  } else if (!profile.social.gender) {
    // Ensure gender exists even if social object was partially present
    profile.social.gender = (data.gender as any) || (data.social?.gender as any) || 'erkek';
  }

  if (!profile.notificationSettings) {
    profile.notificationSettings = {
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
  }

  // 3. Subscription Normalization
  if (!profile.subscription) {
    profile.subscription = {
      status: 'none',
      type: 'none',
      expiresAt: new Date().toISOString(),
      dailyLimit: 0,
      dailyLimitUsed: 0,
      dailyReadingsUsed: { coffee: 0, tarot: 0, advanced: 0 },
      lastResetAt: new Date().toISOString()
    };
  }

  return profile;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'earn' | 'spend' | 'purchase' | 'expire';
  source: 'ad' | 'daily_login' | 'admin_promo' | 'purchase' | 'fortune_reading' | 'social_action' | 'subscription_bonus';
  amount: number;
  balanceType: 'main' | 'energy';
  createdAt: string;
  expiresAt: string | null; // null for permanent (main coins)
  remainingAmount: number;
  status: 'active' | 'spent' | 'expired';
  description?: string;
  metadata?: any;
}

export interface AdminWalletConfig {
  adRewardEnergy: number;
  maxDailyAds: number;
  adRewardExpiryDays: number;
  dailyLoginRewardEnergy: number;
  dailyLoginExpiryDays: number;
  
  // Fortune Subscriptions (TL)
  fortuneSubscriptions: {
    daily: { price: number, dailyLimit: number, description: string };
    weekly: { price: number, dailyLimit: number, description: string };
    monthly: { price: number, dailyLimit: number, description: string };
  };

  // Boost Packages (TL)
  boostPackages: {
    weekly: { price: number, days: number, description: string };
    monthly: { price: number, days: number, description: string };
  };

  // Social Rights (Bought with Main Coins)
  socialRightsPrices: {
    superLike: number;
    refresh: number;
    compatibility: number;
  };

  // Social Bundles (Bought with Main Coins)
  socialBundles: {
    id: string;
    name: string;
    description: string;
    price: number;
    contents: {
      superLikes: number;
      refreshes: number;
      compatibility: number;
      boostDays: number;
    };
  }[];
  
  // Main Coin Packages (TL)
  coinPackages: {
    id: string;
    coins: number;
    price: number;
    bonus: number;
  }[];
}

export interface EconomyConfig {
  fortunePricing: {
    coffee: number;
    tarot: number;
    water: number;
    ebced: number;
    yildizname: number;
    havas: number;
    dream: number;
    extraQuestion: number;
    priorityFee: number;
  };
  interpretationTimes: {
    coffee: { minSearchTime: number; maxSearchTime: number; minInterpreterTime: number; maxInterpreterTime: number; minReadingTime: number; maxReadingTime: number };
    tarot: { minSearchTime: number; maxSearchTime: number; minInterpreterTime: number; maxInterpreterTime: number; minReadingTime: number; maxReadingTime: number };
    advanced: { minSearchTime: number; maxSearchTime: number; minInterpreterTime: number; maxInterpreterTime: number; minReadingTime: number; maxReadingTime: number };
  };
  fakeProcessing?: {
    readerFindingMinDelay: number;
    readerFindingMaxDelay: number;
    interpretationMinDelay: number;
    interpretationMaxDelay: number;
  };
  energyPaymentEnabled: boolean;
  subscriptionLimits: {
    totalDaily: number;
  };
  aiSettings: {
    [key in FortuneType]: FortuneAIConfig;
  };
  rewards: {
    adRewardEnergy: number;
    maxDailyAds: number;
    adRewardExpiryDays: number;
    dailyLoginRewardEnergy: number;
    dailyLoginExpiryDays: number;
    customRewards: {
      id: string;
      name: string;
      amount: number;
      balanceType: 'main' | 'energy';
      description: string;
    }[];
  };
  coinPackages: {
    id: string;
    coins: number;
    priceTRY: number;
    bonus: number;
  }[];
  socialPricing: {
    superLike: { id: string; count: number; priceCoins: number }[];
    refresh: { id: string; count: number; priceCoins: number }[];
    compatibility: { id: string; count: number; priceCoins: number }[];
  };
  boostPackages: {
    weekly: { priceTRY: number; days: number; description: string };
    monthly: { priceTRY: number; days: number; description: string };
  };
  fortuneSubscriptions: {
    daily: { priceTRY: number; dailyLimit: number; description: string };
    weekly: { priceTRY: number; dailyLimit: number; description: string };
    monthly: { priceTRY: number; dailyLimit: number; description: string };
  };
  manualCompatibilityPrompt?: string;
}

export interface FortuneAIConfig {
  systemPrompt: string;
  templatePrompt: string;
  tone: string;
  minLength: number;
  maxLength: number;
  mysticLevel: number;
  extraQuestionBehavior: string;
}

export interface DailyMessage {
  text: string;
  category: 'love' | 'career' | 'general';
  revealed: boolean;
  date: string;
}

export interface AppConfig {
  prices: {
    coffee: number;
    tarot: number;
    water: number;
    ebced: number;
    yildizname: number;
    havas: number;
    dream: number;
    extraQuestion: number;
    priorityFee: number;
  };
  icons: {
    coffee: string;
    tarot: string;
    water: string;
    ebced: string;
    yildizname: string;
    havas: string;
    mainBalance: string;
    adBalance: string;
  };
  dailyMessagePrompt: string;
  adRewardEnergy: number;
  maxDailyAds: number;
  subscriptionLimits: {
    coffee: number;
    tarot: number;
    advanced: number;
    totalDaily: number;
  };
  interpretationTimes?: {
    coffee: {
      minSearchTime: number;
      maxSearchTime: number;
      minInterpreterTime: number;
      maxInterpreterTime: number;
      minReadingTime: number;
      maxReadingTime: number;
    };
    tarot: {
      minSearchTime: number;
      maxSearchTime: number;
      minInterpreterTime: number;
      maxInterpreterTime: number;
      minReadingTime: number;
      maxReadingTime: number;
    };
    advanced: {
      minSearchTime: number;
      maxSearchTime: number;
      minInterpreterTime: number;
      maxInterpreterTime: number;
      minReadingTime: number;
      maxReadingTime: number;
    };
  };
  packagePrices: Record<string, number>;
  hostPackagePrices?: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

export interface SocialTransaction {
  id: string;
  uid: string;
  type: 'gift_sent' | 'gift_received' | 'host_package_purchase' | 'withdrawal' | 'room_earning' | 'top_up';
  amount: number;
  balanceType: 'main' | 'withdrawable';
  description: string;
  timestamp: string;
  metadata?: any;
}

export interface WithdrawalRequest {
  id: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  iban?: string;
  accountHolder?: string;
  bankName?: string;
  createdAt: string;
  processedAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
}

export interface SocialReport {
  id: string;
  fromUid: string;
  toUid: string;
  chatId?: string;
  reason: string;
  description?: string;
  context: 'explore' | 'profile' | 'chat' | 'room';
  timestamp: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  adminNotes?: string;
  actionTaken?: 'none' | 'warned' | 'muted' | 'banned';
}

export interface ModerationLog {
  id: string;
  adminId: string;
  adminEmail?: string;
  targetUid: string;
  action: 'warn' | 'mute' | 'ban' | 'unban' | 'unmute' | 'dismiss_report';
  reason: string;
  timestamp: string;
  reportId?: string;
}

export interface SocialRoom {
  id: string;
  name: string;
  description?: string;
  type: string;
  maxMembers: number;
  maxSpeakers?: number;
  isPrivate?: boolean;
  password?: string;
  isDonationEnabled?: boolean;
  hostUid: string;
  status: 'active' | 'closed';
  createdAt: string;
  closedAt?: string;
  memberCount: number;
  activeSpeakerCount?: number;
  tags?: string[];
}

export interface HostingPackage {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: 'daily' | 'weekly' | 'monthly';
  features: string[];
  isActive: boolean;
}

export interface SocialGiftTransaction {
  id: string;
  senderUid: string;
  receiverUid: string;
  giftId: string;
  giftName: string;
  amount: number;
  timestamp: string;
}

export interface SocialCommerceConfig {
  boostPackages: CommercePackage[];
  superLikePackages: CommercePackage[];
  analysisPackages: CommercePackage[];
  extraSwipePackages: CommercePackage[];
  discoverRefreshPackages: CommercePackage[];
  subscriptions: SocialSubscriptionPackage[];
}

export interface CommercePackage {
  id: string;
  name: string;
  description: string;
  price: number;
  value: number; // generic value
  durationHours?: number; // for boost
  count?: number; // for counts
}

export interface SocialSubscriptionPackage {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  name: string;
  price: number;
  durationDays: number;
  features: {
    superLikes: number;
    analyses: number;
    dailySwipeLimit: number;
    boostDuration: number;
  };
}

export interface CompatibilityResult {
  loveScore: number;
  friendScore: number;
  logicScore: number;
  dominantType?: 'love' | 'friendship' | 'balanced';
  comment?: string;
}

export interface CompatibilityRequest {
  id: string;
  userId: string;
  person1: any;
  person2: any;
  relationshipType: string;
  status: 'pending' | 'completed' | 'error';
  createdAt: string;
  readyAt: string;
  loveScore?: number;
  friendshipScore?: number;
  energyScore?: number;
  summaryShort?: string;
  summaryLong?: string;
  aiComment?: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'purchase' | 'spend';
  source: 'boost' | 'super_like' | 'analysis' | 'extra_swipe' | 'discover_refresh' | 'subscription' | 'fortune';
  amount: number;
  quantity?: number;
  createdAt: any;
}

export type SocialActionResult = 
  | 'SUCCESS' 
  | 'ALREADY_REQUESTED' 
  | 'ALREADY_CHATTING' 
  | 'SELF_ACTION' 
  | 'INVALID_TARGET' 
  | 'BLOCKED'
  | 'TECHNICAL_ERROR';

export type RefreshActionResult = 
  | 'SUCCESS'
  | 'FREE_REFRESH_USED'
  | 'PAID_REFRESH_USED'
  | 'INSUFFICIENT_FUNDS'
  | 'COOLDOWN_ACTIVE'
  | 'ERROR';

export type PurchaseActionResult = 
  | 'SUCCESS'
  | 'INSUFFICIENT_FUNDS'
  | 'INVALID_ITEM'
  | 'INVALID_QUANTITY'
  | 'ERROR';

export interface InteractionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  type: 'message_request' | 'super_like';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any;
  updatedAt: any;
  senderSnapshot: {
    nickname: string;
    photoURL: string;
  };
  receiverSnapshot: {
    nickname: string;
    photoURL: string;
  };
}

export interface Chat {
  id: string;
  participants: string[];
  participantSnapshots?: Record<string, {
    nickname: string;
    photoURL: string;
  }>;
  lastMessage: string;
  lastMessageAt: any;
  lastMessageSenderId?: string;
  lastMessageStatus?: 'sent' | 'delivered' | 'seen';
  createdAt: any;
  type?: 'direct' | 'group';
  unreadCount?: Record<string, number>;
  typing?: Record<string, boolean>;
  deletedFor?: string[];
}

export interface CentralizedReport {
  id: string;
  reporterId: string;
  reportedUserId: string;
  source: 'discover' | 'match' | 'messages' | 'profile' | 'room';
  reason: string;
  description?: string;
  createdAt: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  adminNotes?: string;
  actionTaken?: 'none' | 'warned' | 'muted' | 'banned' | 'social_banned';
  metadata?: any; // e.g. chatId, messageId
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  receiverId?: string;
  participants?: string[];
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt: any;
  seen: boolean; // Deprecated, use status
  status: 'sent' | 'delivered' | 'seen' | 'sending';
  type: 'text' | 'image' | 'video' | 'system';
  editedAt?: any;
  isDeleted?: boolean;
  deletedForEveryone?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message_request' | 'match' | 'system' | 'like';
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: any;
}
