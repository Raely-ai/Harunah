export type FortuneType = 'coffee' | 'tarot' | 'water' | 'ebced' | 'yildizname' | 'havas' | 'horoscope' | 'dream';

export type AuthScreen = 'welcome' | 'login' | 'register' | 'forgot-password';

export type AppTab = 'home' | 'fortunes' | 'messages' | 'history' | 'wallet' | 'profile' | 'horoscopes' | 'social-intro' | 'social-onboarding' | 'social-profile' | 'social-management';

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
  priority?: boolean;
  priorityMode?: boolean;
  updatedAt?: string;
  
  // AI Metadata
  promptSource?: 'admin' | 'default';
  promptId?: string;
  promptVersion?: string;
  error?: string;
  resultText?: string;
  notificationFlags?: {
    searchingSent?: boolean;
    foundSent?: boolean;
    interpretingSent?: boolean;
    completedSent?: boolean;
  };

  // Form Data
  formData?: {
    adSoyad: string;
    dogumTarihi: string;
    iliskiDurumu: string;
    motherName?: string;
    fatherName?: string;
    targetName?: string;
    jobStatus?: string;
    extraInfo?: string;
  };
  priceBreakdown?: {
    base: number;
    extraQuestions: number;
    priority: number;
    total: number;
  };
}

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
  horoscope?: string;
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
  };

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
  extraSwipeLimit?: number;
  
  // Social Wallet Fields
  boostExpiresAt?: string;
  socialSubscriptionType?: 'none' | 'daily' | 'weekly' | 'monthly';
  socialSubscriptionExpireAt?: string;

  socialSubscription?: {
    status: 'active' | 'inactive' | 'expired' | 'none';
    type: 'weekly' | 'monthly' | 'none';
    expiresAt: string;
    dailyUsage: {
      superLikes: number;
      refreshes: number;
      compatibility: number;
      lastResetDate: string;
    };
  };

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
      gender: (data.gender as any) || 'erkek',
      lookingFor: data.lookingFor || 'arkadaş',
      bio: data.bio || '',
      photos: data.photos || [],
      interests: data.interests || [],
      visible: data.socialVisible !== undefined ? data.socialVisible : true,
      banned: data.socialBan || false,
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

  if (!profile.socialSubscription) {
    profile.socialSubscription = {
      status: 'none',
      type: 'none',
      expiresAt: new Date().toISOString(),
      dailyUsage: {
        superLikes: 0,
        refreshes: 0,
        compatibility: 0,
        lastResetDate: new Date().toISOString().split('T')[0]
      }
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

  // Social Subscriptions (TL)
  socialSubscriptions: {
    weekly: { 
      price: number, 
      dailyLimits: { superLikes: number, refreshes: number, compatibility: number },
      description: string 
    };
    monthly: { 
      price: number, 
      dailyLimits: { superLikes: number, refreshes: number, compatibility: number },
      description: string 
    };
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
    horoscope: number;
    dream: number;
    extraQuestion: number;
    priorityFee: number;
  };
  interpretationTimes: {
    coffee: { minSearchTime: number; maxSearchTime: number; minInterpreterTime: number; maxInterpreterTime: number; minReadingTime: number; maxReadingTime: number };
    tarot: { minSearchTime: number; maxSearchTime: number; minInterpreterTime: number; maxInterpreterTime: number; minReadingTime: number; maxReadingTime: number };
    advanced: { minSearchTime: number; maxSearchTime: number; minInterpreterTime: number; maxInterpreterTime: number; minReadingTime: number; maxReadingTime: number };
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
  socialSubscriptions: {
    weekly: { 
      priceTRY: number; 
      dailyLimits: { superLikes: number; refreshes: number; compatibility: number };
      description: string;
    };
    monthly: { 
      priceTRY: number; 
      dailyLimits: { superLikes: number; refreshes: number; compatibility: number };
      description: string;
    };
  };
  fortuneSubscriptions: {
    daily: { priceTRY: number; dailyLimit: number; description: string };
    weekly: { priceTRY: number; dailyLimit: number; description: string };
    monthly: { priceTRY: number; dailyLimit: number; description: string };
  };
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
    horoscope: number;
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

export interface Horoscope {
  id?: string;
  sign: string;
  content: string;
  date: string;
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
  | 'TECHNICAL_ERROR';

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
  text?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  createdAt: any;
  seen: boolean; // Deprecated, use status
  status: 'sent' | 'delivered' | 'seen';
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
