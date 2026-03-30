export const getDeterministicAuraBonuses = (
  userAId: string,
  userBId: string,
  userABirthDate: string = '',
  userBBirthDate: string = ''
) => {
  // Sort IDs to ensure same result regardless of order
  const sortedIds = [userAId, userBId].sort().join('');
  const seed = `${sortedIds}${userABirthDate}${userBBirthDate}mystic_salt_2026`;

  // Simple hash function to generate a seed
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }

  // LCG random number generator
  const nextRandom = () => {
    h = (Math.imul(h, 48271) % 2147483647) | 0;
    return (h & 2147483647) / 2147483647;
  };

  // Generate bonuses
  const loveAuraBonus = Math.floor(nextRandom() * 6); // 0-5
  const friendAuraBonus = Math.floor(nextRandom() * 6); // 0-5
  const logicAuraBonus = Math.floor(nextRandom() * 11); // 0-10

  return {
    loveAuraBonus,
    friendAuraBonus,
    logicAuraBonus
  };
};
