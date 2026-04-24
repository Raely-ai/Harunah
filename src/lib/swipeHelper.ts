import { UserProfile, EconomyConfig, AppConfig } from "../types";
import { cacheManager } from "./cacheManager";

export const getDailySwipeLimit = (user: UserProfile) => {
  // 1. Get Global Limit from Cache
  const economy = cacheManager.get<EconomyConfig>("economyConfig");
  const appConfig = cacheManager.get<AppConfig>("appConfig");
  
  // Try to find the limit in economy or appConfig (various possible names based on prompt)
  const globalLimit = (economy as any)?.socialPricing?.dailySwipeLimit ?? 
                      (appConfig as any)?.social?.global_daily_limit ?? 
                      (appConfig as any)?.subscriptionLimits?.totalDaily ?? 
                      15; // Fallback to 15

  // 2. Get User's Subscription Limit
  // If user has a specific subscription package, it might have a higher limit
  const subLimit = (user.subscription as any)?.dailySwipeLimit ?? 0;

  return Math.max(globalLimit, subLimit);
};

export const getRemainingSwipes = (user: UserProfile) => {
  const today = new Date().toISOString().split('T')[0];
  const used = user.dailySwipeUsed || 0;
  const limit = getDailySwipeLimit(user);
  
  if (user.dailySwipeDate !== today) {
    return limit;
  }

  return Math.max(0, limit - used);
};

export const canSwipe = (user: UserProfile) => {
  return getRemainingSwipes(user) > 0;
};
