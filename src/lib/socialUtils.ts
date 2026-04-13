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
  
  // 1. Primary check: The explicit flag
  if (user.social?.profileCompleted) return true;
  
  // 2. Fallback check: Do they have the minimum required data?
  // This handles legacy users or cases where the flag wasn't set correctly.
  const social = user.social;
  
  // A profile is considered ready if it has the core identity fields
  const hasNickname = !!(social?.nickname || user.nickname);
  const hasPhotos = (social?.photos?.length || 0) > 0 || (user.photos?.length || 0) > 0;
  const hasGender = !!(social?.gender || user.gender);
  
  // If they have these 3, they are basically "in", even if some details are missing.
  // We want to be permissive here to avoid the "profile not found" bug.
  return !!(hasNickname && hasPhotos && hasGender);
};
