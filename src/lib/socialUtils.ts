import { UserProfile } from "../types";

/**
 * Determines the target gender based on the current user's social gender.
 * Default logic: erkek -> kadın, kadın -> erkek
 */
export const getTargetGender = (user: UserProfile): "erkek" | "kadın" => {
  const gender = user.social?.gender || (user as any).gender;
  
  if (!gender) {
    console.warn(`[SocialUtils] User ${user.uid} has no gender defined. Defaulting target to 'kadın'.`);
    return "kadın";
  }

  // Strict opposite gender logic
  const target = gender === "kadın" ? "erkek" : "kadın";
  console.log(`[SocialUtils] Current User Gender: ${gender}, Target Gender: ${target}`);
  return target;
};

/**
 * Common filters for social users to ensure they are eligible for discovery/matching.
 */
export const isEligibleSocialUser = (user: UserProfile, currentUserId: string, targetGender: string): boolean => {
  if (!user || user.uid === currentUserId) return false;

  // Basic social eligibility
  const isBasicEligible = 
    user.social?.enabled === true &&
    user.social?.profileCompleted === true &&
    user.social?.visible === true &&
    user.social?.banned !== true;

  if (!isBasicEligible) return false;

  // Strict Gender Filter
  const userGender = user.social?.gender || (user as any).gender;
  const genderMatch = userGender === targetGender;

  if (!genderMatch) {
    console.log(`[SocialUtils] Filtering out user ${user.uid} due to gender mismatch. User Gender: ${userGender}, Target: ${targetGender}`);
  }

  return genderMatch;
};

/**
 * Checks if a user's social profile is considered "ready" or "completed".
 * This is used to decide whether to show the social features or the onboarding flow.
 * Required fields: nickname, at least 1 photo, gender, birthDate, lookingFor
 */
export const isSocialProfileReady = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  
  const social = user.social;
  
  // 1. Primary check: The explicit flag or deep merge readiness
  if (social?.profileCompleted) return true;
  
  // 2. Fallback check: Minimum viable profile identification
  // A profile is considered ready if it has the core identity fields
  // even if the boolean flag is missing (legacy sync case)
  const nickname = social?.nickname || (user as any).nickname;
  const gender = social?.gender || (user as any).gender;
  const photos = social?.photos || (user as any).photos;
  const hasPhotos = (photos?.length || 0) > 0;
  
  const isReady = !!(nickname && gender && hasPhotos);
  
  if (isReady) {
    console.log(`[SocialUtils] User ${user.uid} profile is ready via legacy data check.`);
  }

  return isReady;
};
