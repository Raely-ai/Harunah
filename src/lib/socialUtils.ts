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

export const checkGenderPreference = (currentUser: UserProfile, targetUser: UserProfile): boolean => {
  const currentGender = (currentUser.social?.gender || "erkek").toLowerCase();
  const targetGender = (targetUser.social?.gender || "kadın").toLowerCase();

  const currentLookingFor = (currentUser.social?.lookingFor || "").toLowerCase();

  // "Kimleri istiyorsun?" - target'in ne istediğine asla bakmıyoruz.
  if (currentLookingFor.includes('herkes') || currentLookingFor.includes('arkadaş') || currentLookingFor.includes('all')) {
    return true;
  } 

  if (currentLookingFor.includes('kadın') || currentLookingFor.includes('female') || currentLookingFor.includes('kadin')) {
    if (targetGender.includes('kadın') || targetGender.includes('female') || targetGender.includes('kadin')) return true;
  }
  
  if (currentLookingFor.includes('erkek') || currentLookingFor.includes('male')) {
    if (targetGender.includes('erkek') || targetGender.includes('male')) return true;
  }

  // Fallback for "aşk", "dostluk", "sohbet" or empty - we default to everyone instead of opposite 
  // since this should not hard filter the pool if they haven't explicitly set a gender
  return true; 
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

  if (!checkGenderPreference(currentUser, user)) {
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
  
  // Basic Criteria: Require Nickname, Gender, BirthDate
  const userNickname = user?.social?.nickname || user?.nickname || user?.displayName || '';
  const hasNickname = userNickname.length >= 2;
  const hasBirthDate = !!(user?.birthDate || user?.social?.birthDate);
  const hasGender = !!(user?.social?.gender || user?.gender);
  
  const isActuallyComplete = hasNickname && hasGender && hasBirthDate;

  return isCompleted || isActuallyComplete;
};

export const getSocialProfileMissingFields = (user: UserProfile | null | undefined): string[] => {
  if (!user) return ['Hesap Bilgileri'];
  const missing: string[] = [];

  const hasEnoughBio = (user.social?.bio || '').length >= 10;
  if (!hasEnoughBio) missing.push("Kısa bio");

  const hasEnoughInterests = (user.social?.interests || []).length >= 5;
  if (!hasEnoughInterests) missing.push("İlgi alanları");

  const hasPhotos = (user.social?.photos || []).length > 0;
  if (!hasPhotos) missing.push("Fotoğraf");

  if (user.social?.visible === false) {
    missing.push("Profil görünürlüğü (Kapalı)");
  } else if (!user.social?.profileCompleted && missing.length === 0) {
     missing.push("Profil onayı");
  }

  return missing;
};
