import { UserProfile } from "../types";

export const getDailySwipeLimit = (user: UserProfile) => {
  const sub = user.subscription;
  const now = new Date();
  const isPremium = sub && sub.status === 'active' && sub.expiresAt && new Date(sub.expiresAt) > now;

  if (!isPremium) return 15;
  
  switch (sub?.type) {
    case 'daily': return 100;
    case 'weekly': return 150;
    case 'monthly': return 200;
    default: return 15;
  }
};

export const getRemainingSwipes = (user: UserProfile) => {
  const today = new Date().toISOString().split('T')[0];
  const used = user.dailySwipeUsed || 0;
  const limit = getDailySwipeLimit(user);
  const extra = user.extraSwipeLimit || 0;

  if (user.dailySwipeDate !== today) {
    return limit + extra;
  }

  return Math.max(0, limit + extra - used);
};

export const canSwipe = (user: UserProfile) => {
  return getRemainingSwipes(user) > 0;
};
