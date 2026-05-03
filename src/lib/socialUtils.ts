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

export const checkMutualGenderPreference = (currentUser: UserProfile, targetUser: UserProfile): boolean => {
  const currentGender = (currentUser.social?.gender || "erkek").toLowerCase();
  const targetGender = (targetUser.social?.gender || "kadın").toLowerCase();

  const currentLookingFor = (currentUser.social?.lookingFor || "").toLowerCase();
  const targetLookingFor = (targetUser.social?.lookingFor || "").toLowerCase();

  // 1) Does current user accept target gender?
  let currentLikesTarget = false;
  if (currentLookingFor.includes('herkes') || currentLookingFor.includes('arkadaş')) {
    currentLikesTarget = true;
  } else if (currentLookingFor.includes(targetGender)) {
    currentLikesTarget = true;
  } else if (!currentLookingFor || currentLookingFor === 'aşk' || currentLookingFor === 'dostluk' || currentLookingFor === 'sohbet') {
    // Fallback: Default to opposite gender
    const defaultTarget = currentGender === 'erkek' ? 'kadın' : 'erkek';
    currentLikesTarget = (targetGender === defaultTarget);
  }

  // 2) Does target user accept current gender?
  let targetLikesCurrent = false;
  if (targetLookingFor.includes('herkes') || targetLookingFor.includes('arkadaş')) {
    targetLikesCurrent = true;
  } else if (targetLookingFor.includes(currentGender)) {
    targetLikesCurrent = true;
  } else if (!targetLookingFor || targetLookingFor === 'aşk' || targetLookingFor === 'dostluk' || targetLookingFor === 'sohbet') {
    // Fallback: Default to opposite gender
    const defaultTarget = targetGender === 'erkek' ? 'kadın' : 'erkek';
    targetLikesCurrent = (currentGender === defaultTarget);
  }

  return currentLikesTarget && targetLikesCurrent;
};

/**
 * Common filters for social users to ensure they are eligible for discovery/matching.
 */
export const isEligibleSocialUser = (user: UserProfile, currentUser: UserProfile): boolean => {
  if (!user || user.uid === currentUser.uid) return false;
  
  if (
    !user.social?.enabled ||
    !user.social?.profileCompleted ||
    user.social?.visible === false ||
    user.social?.banned === true
  ) {
    return false;
  }

  if (!checkMutualGenderPreference(currentUser, user)) {
    return false;
  }

  return true;
};

/**
 * Checks if a user's social profile is considered "ready" or "completed".
 * A profile is ready if:
 * 1. profileCompleted is explicitly true (legacy/manual system)
 * 2. Basic required info exists (gender and birthDate) - Fast Track logic
 */
export const isSocialProfileReady = (user: UserProfile | null | undefined): boolean => {
  if (!user) return false;
  if (user.uid === 'guest') return false;

  const isCompleted = user.social?.profileCompleted === true;
  const hasBasicInfo = !!(user.gender || user.social?.gender) && !!user.birthDate;

  return isCompleted || hasBasicInfo;
};
