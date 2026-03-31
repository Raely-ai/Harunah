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
