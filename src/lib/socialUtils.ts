import { UserProfile } from "../types";

/**
 * Determines the target gender based on the current user's social gender.
 * Default logic: erkek -> kadın, kadın -> erkek
 */
export const getTargetGender = (user: UserProfile): "erkek" | "kadın" => {
  const gender = user.social?.gender;
  return gender === "kadın" ? "erkek" : "kadın";
};

/**
 * Common filters for social users to ensure they are eligible for discovery/matching.
 */
export const isEligibleSocialUser = (user: UserProfile, currentUserId: string, targetGender: string): boolean => {
  return (
    user.uid !== currentUserId &&
    user.social?.enabled === true &&
    user.social?.profileCompleted === true &&
    user.social?.visible === true &&
    user.social?.banned !== true &&
    user.social?.gender === targetGender
  );
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
  
  const hasNickname = !!(social?.nickname || user.nickname);
  const hasPhotos = (social?.photos?.length || 0) > 0 || (user.photos?.length || 0) > 0;
  const hasGender = !!(social?.gender || user.gender);
  const hasBirthDate = !!(user.birthDate);
  const hasLookingFor = !!(social?.lookingFor || user.lookingFor);
  
  // All fields must be present for the profile to be considered "ready" as a fallback
  return !!(hasNickname && hasPhotos && hasGender && hasBirthDate && hasLookingFor);
};
