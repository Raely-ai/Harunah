export type FortuneType = 'coffee' | 'tarot' | 'water' | 'ebced' | 'yildizname' | 'havas' | 'horoscope' | 'dream';

export type AuthScreen = 'welcome' | 'login' | 'register' | 'forgot-password';

export type AppTab = 'home' | 'history' | 'wallet' | 'profile' | 'horoscopes' | 'social';

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
  dailyAdCount: number;
  lastAdDate: string;
  dailyAdReadingsUsed?: {
    coffee: number;
    tarot: number;
    lastResetDate: string;
  };
  isBanned?: boolean;
  role?: 'user' | 'admin';
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
  hostPackagePrices: {
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

export interface GlobalNotification {
  id?: string;
  title: string;
  message: string;
  sentAt: string;
}

export interface SocialSettings {
  whoCanMessage: 'everyone' | 'friends' | 'nobody';
  whoCanAddFriend: 'everyone' | 'nobody';
  notifications: {
    messages: boolean;
    friendRequests: boolean;
    roomInvites: boolean;
    gifts: boolean;
  };
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
  socialPurpose: string;
  bio: string;
  photoURL?: string;
  region: string;
  createdAt: string;
  isCompleted: boolean;
  onboardingStep: number;
  completeness: number;
  blockedUids?: string[];
  settings?: SocialSettings;
  lastActiveAt: string;
  isBanned?: boolean;
  hosting?: {
    freeTrialUntil: string;
    donateEnabled?: boolean;
    activePackage?: {
      type: 'daily' | 'weekly' | 'monthly';
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
  totalEarnings?: number;
}

export interface Gift {
  id: string;
  name: string;
  price: number;
  icon: string;
  description: string;
}

export interface SocialGiftTransaction {
  id: string;
  senderId: string;
  receiverId: string;
  hostId: string;
  roomId: string;
  giftId: string;
  giftName: string;
  giftValue: number;
  receiverShare: number;
  hostShare: number;
  platformShare: number;
  timestamp: string;
}

export type SocialTransactionType = 'gift_sent' | 'gift_received' | 'host_package_purchase' | 'withdrawal' | 'room_earning' | 'top_up';

export interface SocialTransaction {
  id: string;
  uid: string;
  type: SocialTransactionType;
  amount: number;
  balanceType: 'main' | 'withdrawable';
  description: string;
  timestamp: string;
  metadata?: {
    fromUid?: string;
    toUid?: string;
    roomId?: string;
    packageType?: string;
    withdrawalId?: string;
  };
}

export interface WithdrawalRequest {
  id: string;
  uid: string;
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

export interface Match {
  id: string;
  uids: string[];
  createdAt: string;
  lastMessageAt?: string;
  lastMessageText?: string;
}

export interface SwipeAction {
  id: string;
  fromUid: string;
  toUid: string;
  type: 'like' | 'pass';
  timestamp: string;
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
  targetUid: string;
  action: 'warn' | 'mute' | 'ban' | 'unban' | 'unmute' | 'dismiss_report';
  reason: string;
  timestamp: string;
  reportId?: string;
}

export type SocialRoomRole = 'host' | 'speaker' | 'listener';

export interface SocialRoom {
  id: string;
  name: string;
  description: string;
  type: string;
  maxMembers: number;
  maxSpeakers: number;
  isPrivate: boolean;
  password?: string;
  isDonationEnabled: boolean;
  hostUid: string;
  status: 'active' | 'closed';
  createdAt: string;
  closedAt?: string;
  memberCount: number;
  activeSpeakerCount: number;
  tags?: string[];
}

export interface SocialRoomMember {
  id: string; // roomId_uid
  roomId: string;
  uid: string;
  role: SocialRoomRole;
  joinedAt: string;
  isMuted: boolean;
  nickname: string;
  photoURL: string;
}

export interface SocialChat {
  id: string;
  uids: string[];
  type: 'match' | 'friend' | 'room';
  createdAt: string;
  lastMessageAt: string;
  lastMessageText: string;
  lastMessageSenderId: string;
  unreadCount: Record<string, number>;
  metadata?: {
    matchId?: string;
    roomId?: string;
    friendshipId?: string;
  };
}

export interface SocialMessage {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  timestamp: string;
  readBy: string[];
}

export interface SocialNotification {
  id: string;
  userId: string;
  type: 'new_match' | 'new_friend_request' | 'new_message' | 'room_invite' | 'gift_received' | 'withdrawal_result' | 'host_package_expiry';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: {
    senderId?: string;
    senderName?: string;
    senderPhoto?: string;
    matchId?: string;
    roomId?: string;
    giftId?: string;
    withdrawalId?: string;
    status?: 'approved' | 'rejected';
    packageType?: string;
    roomName?: string;
  };
  link?: string;
}

export interface FriendshipRequest {
  id: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: string;
  message?: string;
}

export interface Friendship {
  id: string;
  uids: string[];
  status: 'active' | 'blocked';
  createdAt: string;
}
