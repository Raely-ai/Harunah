import { UserProfile } from "../types";

export const FREE_DAILY_LIMIT = 35;
export const MAX_DAILY_LIMIT = 300;

export const getRemainingSwipes = (user: UserProfile) => {
  const today = new Date().toISOString().split('T')[0];
  const used = user.dailySwipeUsed || 0;
  const limit = user.dailySwipeLimit || FREE_DAILY_LIMIT;
  const extra = user.extraSwipeLimit || 0;

  if (user.dailySwipeDate !== today) {
    return limit + extra;
  }

  return Math.max(0, limit + extra - used);
};

export const canSwipe = (user: UserProfile) => {
  return getRemainingSwipes(user) > 0;
};
