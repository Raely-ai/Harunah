export type FortuneType = 'coffee' | 'tarot' | 'water' | 'ebced' | 'yildizname' | 'havas' | 'horoscope' | 'dream';

export type AuthScreen = 'welcome' | 'login' | 'register' | 'forgot-password';

export type AppTab = 'home' | 'history' | 'wallet' | 'profile' | 'horoscopes' | 'social-intro' | 'social-main' | 'social-onboarding' | 'social-match' | 'social-messages' | 'social-profile' | 'social-wallet';

export type ReadingStatus = 'waiting' | 'interpreting' | 'completed';

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
  credits: number;
  adCredits: number;
  dailyAdCount: number;
  lastAdDate: string;
  dailyAdReadingsUsed?: {
    coffee: number;
    tarot: number;
    lastResetDate: string;
  };
  isBanned?: boolean;
  role?: 'user' | 'admin';
  
  // Social Fields
  socialEnabled?: boolean;
  socialProfileCompleted?: boolean;
  socialVisible?: boolean;
  nickname?: string;
  lookingFor?: string;
  interests?: string[];
  photos?: string[];
  bio?: string;
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
  socialBan?: boolean;
  
  // Social Wallet Fields
  superLikeCount?: number;
  analysisCount?: number;
  extraSwipeQuota?: number;
  discoverRefreshCount?: number;
  boostExpiresAt?: string;
  socialSubscriptionType?: 'none' | 'daily' | 'weekly' | 'monthly';
  socialSubscriptionExpireAt?: string;
  
  subscription?: {
    status: 'active' | 'inactive' | 'expired' | 'none';
    type: 'none' | 'daily' | 'weekly' | 'monthly';
    expiresAt?: string;
    dailyReadingsUsed: {
      coffee: number;
      tarot: number;
      advanced: number;
    };
  };
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
    extraQuestion: number;
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
  adRewardAmount: number;
  maxDailyAds: number;
  subscriptionLimits: {
    coffee: number;
    tarot: number;
    advanced: number;
  };
  interpretationTimes?: {
    coffee: {
      minInterpreterTime: number;
      maxInterpreterTime: number;
      minReadingTime: number;
      maxReadingTime: number;
    };
    tarot: {
      minInterpreterTime: number;
      maxInterpreterTime: number;
      minReadingTime: number;
      maxReadingTime: number;
    };
    advanced: {
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

export interface SocialProfile {
  uid: string;
  nickname: string;
  age: number;
  gender: string;
  birthDate: string;
  birthTime?: string;
  birthPlace?: string;
  vibe: string;
  socialPurpose: 'friendship' | 'chat' | 'networking' | 'dating';
  bio?: string;
  photoURL?: string;
  region: string;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
  onboardingStep?: number;
  completeness: number;
  blockedUids?: string[];
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
  lastActiveAt: string;
  isBanned?: boolean;
  hosting?: {
    freeTrialUntil?: string;
    donateEnabled?: boolean;
    activePackage?: {
      type: 'daily' | 'weekly' | 'monthly' | 'yearly';
      expiresAt: string;
      purchasedAt: string;
    };
    packageHistory?: {
      type: string;
      purchasedAt: string;
      expiresAt: string;
    }[];
  };
  withdrawableBalance: number;
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
