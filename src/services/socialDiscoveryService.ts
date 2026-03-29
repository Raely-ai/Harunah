import { SocialProfile } from '../types';

export interface CompatibilityScore {
  total: number;
  vibeScore: number;
  purposeScore: number;
  energyScore: number;
  ageScore: number;
  activityScore: number;
  completenessScore: number;
  bonusScore: number;
}

/**
 * Social Discovery Service
 * Calculates compatibility scores between users based on various components.
 * Designed for social discovery, not just dating.
 */
export const calculateCompatibility = (
  current: SocialProfile,
  target: SocialProfile,
  isColdStart: boolean = false
): CompatibilityScore => {
  // 1. Vibe Compatibility (25 pts)
  // In cold start, we are more flexible (min 15 instead of 10)
  const vibeScore = current.vibe === target.vibe ? 25 : (isColdStart ? 15 : 10);

  // 2. Social Purpose Compatibility (20 pts)
  // In cold start, we are more flexible (min 12 instead of 8)
  const purposeScore = current.socialPurpose === target.socialPurpose ? 20 : (isColdStart ? 12 : 8);

  // 3. Birth Info / Energy Compatibility (20 pts)
  const currentBirthDate = current.birthDate ? new Date(current.birthDate) : null;
  const targetBirthDate = target.birthDate ? new Date(target.birthDate) : null;
  
  let energyScore = 5;
  if (currentBirthDate && targetBirthDate && !isNaN(currentBirthDate.getTime()) && !isNaN(targetBirthDate.getTime())) {
    const currentMonth = currentBirthDate.getMonth();
    const targetMonth = targetBirthDate.getMonth();
    const isSameSeason = Math.floor(currentMonth / 3) === Math.floor(targetMonth / 3);
    energyScore = currentMonth === targetMonth ? 20 : (isSameSeason ? 12 : 5);
  }

  // 4. Age Proximity (10 pts)
  const currentAge = current.age || 0;
  const targetAge = target.age || 0;
  const ageDiff = Math.abs(currentAge - targetAge);
  let ageScore = 0;
  if (ageDiff <= 3) ageScore = 10;
  else if (ageDiff <= 7) ageScore = 7;
  else if (ageDiff <= 12) ageScore = 4;
  else ageScore = isColdStart ? 3 : 1; // More generous in cold start

  // 5. Activity (10 pts)
  const lastActiveDate = target.lastActiveAt ? new Date(target.lastActiveAt) : null;
  const now = Date.now();
  let activityScore = isColdStart ? 3 : 1;
  
  if (lastActiveDate && !isNaN(lastActiveDate.getTime())) {
    const hoursSinceActive = (now - lastActiveDate.getTime()) / (1000 * 60 * 60);
    if (hoursSinceActive <= 24) activityScore = 10;
    else if (hoursSinceActive <= 72) activityScore = 7;
    else if (hoursSinceActive <= 168) activityScore = 4;
  }

  // 6. Profile Completeness (10 pts)
  const completenessScore = ((target.completeness || 0) / 100) * 10;

  // 7. Bonus Score (includes Cold Start Boosts)
  let bonusScore = Math.floor(Math.random() * 6);

  // Cold Start: New User Boost
  if (isColdStart) {
    const createdAtDate = target.createdAt ? new Date(target.createdAt) : null;
    if (createdAtDate && !isNaN(createdAtDate.getTime())) {
      const daysSinceCreated = (now - createdAtDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreated <= 7) {
        bonusScore += 15; // Significant boost for new users in cold start
      } else if (daysSinceCreated <= 30) {
        bonusScore += 5;
      }
    }
  }

  const total = Math.min(100, vibeScore + purposeScore + energyScore + ageScore + activityScore + completenessScore + bonusScore);

  return {
    total: Math.round(total),
    vibeScore,
    purposeScore,
    energyScore,
    ageScore,
    activityScore,
    completenessScore,
    bonusScore
  };
};

/**
 * Sorts profiles based on compatibility score and other factors.
 * In cold start mode, it adds variety to avoid repetitive feeds.
 */
export const rankProfiles = (
  current: SocialProfile,
  profiles: SocialProfile[],
  isColdStart: boolean = false
): { profile: SocialProfile; score: CompatibilityScore }[] => {
  const ranked = profiles.map(profile => ({
    profile,
    score: calculateCompatibility(current, profile, isColdStart)
  }));

  if (isColdStart) {
    // In cold start, we add a bit of randomness to the top results 
    // to ensure the feed doesn't feel static if the pool is small.
    return ranked.sort((a, b) => {
      const scoreDiff = b.score.total - a.score.total;
      // If scores are close (within 10 pts), randomize the order
      if (Math.abs(scoreDiff) < 10) {
        return Math.random() - 0.5;
      }
      return scoreDiff;
    });
  }

  return ranked.sort((a, b) => b.score.total - a.score.total);
};
