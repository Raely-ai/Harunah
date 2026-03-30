import { UserProfile } from '../types';
import { getDeterministicAuraBonuses } from './deterministicAuraHelper';

export interface CompatibilityScores {
  love: number;
  friendship: number;
  understanding: number;
  overallScore?: number;
  dominantType?: 'love' | 'friendship' | 'balanced';
  comment?: string;
}

const getCommonInterestsCount = (userA: UserProfile, userB: UserProfile): number => {
  const interestsA = userA.interests || [];
  const interestsB = userB.interests || [];
  return interestsA.filter(interest => interestsB.includes(interest)).length;
};

const getAgeDifference = (userA: UserProfile, userB: UserProfile): number => {
  const ageA = userA.age || 25;
  const ageB = userB.age || 25;
  return Math.abs(ageA - ageB);
};

const getPurposeScore = (userA: UserProfile, userB: UserProfile, type: 'love' | 'friend' | 'logic'): number => {
  const pA = userA.lookingFor?.toLowerCase() || '';
  const pB = userB.lookingFor?.toLowerCase() || '';

  const isLove = (s: string) => s.includes('aşk') || s.includes('ilişki') || s.includes('love');
  const isSohbet = (s: string) => s.includes('sohbet') || s.includes('chat');
  const isDostluk = (s: string) => s.includes('dostluk') || s.includes('arkadaşlık') || s.includes('friend');

  if (type === 'love') {
    if (isLove(pA) && isLove(pB)) return 25;
    if ((isLove(pA) && isSohbet(pB)) || (isSohbet(pA) && isLove(pB))) return 16;
    if (isSohbet(pA) && isSohbet(pB)) return 10;
    if ((isLove(pA) && isDostluk(pB)) || (isDostluk(pA) && isLove(pB))) return 7;
    if ((isDostluk(pA) && isSohbet(pB)) || (isSohbet(pA) && isDostluk(pB))) return 4;
    return 0;
  }

  if (type === 'friend') {
    if (isDostluk(pA) && isDostluk(pB)) return 20;
    if ((isDostluk(pA) && isSohbet(pB)) || (isSohbet(pA) && isDostluk(pB))) return 16;
    if (isSohbet(pA) && isSohbet(pB)) return 12;
    if ((isLove(pA) && isDostluk(pB)) || (isDostluk(pA) && isLove(pB))) return 8;
    if ((isLove(pA) && isSohbet(pB)) || (isSohbet(pA) && isLove(pB))) return 5;
    if (isLove(pA) && isLove(pB)) return 3;
    return 5;
  }

  if (type === 'logic') {
    if (pA === pB && pA !== '') return 20;
    if ((isDostluk(pA) && isSohbet(pB)) || (isSohbet(pA) && isDostluk(pB))) return 16;
    if ((isLove(pA) && isSohbet(pB)) || (isSohbet(pA) && isLove(pB))) return 12;
    if ((isLove(pA) && isDostluk(pB)) || (isDostluk(pA) && isLove(pB))) return 8;
    return 4;
  }

  return 0;
};

const getInterestsScore = (count: number, type: 'love' | 'friend' | 'logic'): number => {
  if (type === 'love') {
    const scores = [0, 5, 10, 14, 18, 20];
    return scores[Math.min(count, 5)];
  }
  if (type === 'friend') {
    const scores = [0, 7, 14, 20, 26, 30];
    return scores[Math.min(count, 5)];
  }
  if (type === 'logic') {
    const scores = [0, 6, 12, 18, 24, 30];
    return scores[Math.min(count, 5)];
  }
  return 0;
};

const getAgeScore = (diff: number, type: 'love' | 'friend' | 'logic'): number => {
  if (type === 'love') {
    if (diff <= 2) return 10;
    if (diff <= 5) return 8;
    if (diff <= 8) return 5;
    if (diff <= 12) return 2;
    return 0;
  }
  if (type === 'friend') {
    if (diff <= 3) return 15;
    if (diff <= 6) return 12;
    if (diff <= 10) return 8;
    if (diff <= 15) return 4;
    return 1;
  }
  if (type === 'logic') {
    if (diff <= 4) return 10;
    if (diff <= 8) return 7;
    if (diff <= 12) return 4;
    return 1;
  }
  return 0;
};

const getMysticScore = (userA: UserProfile, userB: UserProfile, type: 'love' | 'friend'): number => {
  let score = 10; // Base

  if (userA.element === userB.element) score += 10;
  if (userA.friendlySign === userB.zodiacSign) score += 10;
  if (userA.enemySign === userB.zodiacSign) score -= 10;
  if (userA.rulingPlanet === userB.rulingPlanet) score += 10;

  if (type === 'love') return Math.max(0, Math.min(40, score + 10)); // Adjust for 0-40
  return Math.max(0, Math.min(30, score + 5)); // Adjust for 0-30
};

const getNatureScore = (userA: UserProfile, userB: UserProfile): number => {
  const eA = userA.element;
  const eB = userB.element;

  if (eA === eB) return 30;
  if ((eA === 'Ateş' && eB === 'Toprak') || (eA === 'Toprak' && eB === 'Ateş')) return 20;
  if ((eA === 'Toprak' && eB === 'Su') || (eA === 'Su' && eB === 'Toprak')) return 20;
  if ((eA === 'Ateş' && eB === 'Su') || (eA === 'Su' && eB === 'Ateş')) return 0;
  return 10;
};

export function calculateCompatibility(currentUser: UserProfile, candidateUser: UserProfile): CompatibilityScores {
  const aura = getDeterministicAuraBonuses(
    currentUser.uid,
    candidateUser.uid,
    currentUser.birthDate,
    candidateUser.birthDate
  );

  const commonInterests = getCommonInterestsCount(currentUser, candidateUser);
  const ageDiff = getAgeDifference(currentUser, candidateUser);

  // Love Score
  const loveScore = 
    getMysticScore(currentUser, candidateUser, 'love') +
    getPurposeScore(currentUser, candidateUser, 'love') +
    getInterestsScore(commonInterests, 'love') +
    getAgeScore(ageDiff, 'love') +
    aura.loveAuraBonus;

  // Friend Score
  const friendScore = 
    getMysticScore(currentUser, candidateUser, 'friend') +
    getPurposeScore(currentUser, candidateUser, 'friend') +
    getInterestsScore(commonInterests, 'friend') +
    getAgeScore(ageDiff, 'friend') +
    aura.friendAuraBonus;

  // Logic Score (Anlaşabilirlik)
  const logicScore = 
    getNatureScore(currentUser, candidateUser) +
    getInterestsScore(commonInterests, 'logic') +
    getPurposeScore(currentUser, candidateUser, 'logic') +
    getAgeScore(ageDiff, 'logic') +
    aura.logicAuraBonus;

  // Dominant Type
  let dominantType: 'love' | 'friendship' | 'balanced' = 'balanced';
  if (loveScore > friendScore + 10) dominantType = 'love';
  else if (friendScore > loveScore + 10) dominantType = 'friendship';

  // Comment
  let comment = '';
  if (dominantType === 'love') comment = 'Aranızda romantik çekim oldukça yüksek.';
  else if (dominantType === 'friendship') comment = 'Dostluk enerjiniz daha baskın görünüyor.';
  else comment = 'Mantık ve anlaşma yönünüz oldukça dengeli.';

  return {
    love: Math.min(100, loveScore),
    friendship: Math.min(100, friendScore),
    understanding: Math.min(100, logicScore),
    dominantType,
    comment
  };
}
