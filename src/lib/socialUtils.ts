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
 */
export const isSocialProfileReady = (user: UserProfile | null | undefined): boolean => {
  return user?.social?.profileCompleted === true;
};
