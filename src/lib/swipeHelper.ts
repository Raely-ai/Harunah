import { UserProfile } from "../types";

export const getDailySwipeLimit = (_user: UserProfile) => {
  return 15;
};

export const getRemainingSwipes = (user: UserProfile) => {
  const today = new Date().toISOString().split('T')[0];
  const used = user.dailySwipeUsed || 0;
  
  if (user.dailySwipeDate !== today) {
    return 15;
  }

  return Math.max(0, 15 - used);
};

export const canSwipe = (user: UserProfile) => {
  return getRemainingSwipes(user) > 0;
};
