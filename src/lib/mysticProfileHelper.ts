export interface MysticProfile {
  zodiacSign: string;
  element: string;
  rulingPlanet: string;
  friendlySign: string;
  enemySign: string;
  age: number;
}

export const getZodiacSign = (date: Date): string => {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Koç';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Boğa';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'İkizler';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Yengeç';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Aslan';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Başak';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Terazi';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Akrep';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Yay';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Oğlak';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Kova';
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Balık';
  return 'Koç';
};

export const getElement = (zodiac: string): string => {
  const elements: Record<string, string> = {
    'Koç': 'Ateş', 'Aslan': 'Ateş', 'Yay': 'Ateş',
    'Boğa': 'Toprak', 'Başak': 'Toprak', 'Oğlak': 'Toprak',
    'İkizler': 'Hava', 'Terazi': 'Hava', 'Kova': 'Hava',
    'Yengeç': 'Su', 'Akrep': 'Su', 'Balık': 'Su'
  };
  return elements[zodiac] || 'Ateş';
};

export const getRulingPlanet = (zodiac: string): string => {
  const planets: Record<string, string> = {
    'Koç': 'Mars', 'Boğa': 'Venüs', 'İkizler': 'Merkür',
    'Yengeç': 'Ay', 'Aslan': 'Güneş', 'Başak': 'Merkür',
    'Terazi': 'Venüs', 'Akrep': 'Plüton', 'Yay': 'Jüpiter',
    'Oğlak': 'Satürn', 'Kova': 'Uranüs', 'Balık': 'Neptün'
  };
  return planets[zodiac] || 'Güneş';
};

export const getFriendlySign = (zodiac: string): string => {
  const friendly: Record<string, string> = {
    'Koç': 'Aslan', 'Boğa': 'Başak', 'İkizler': 'Terazi',
    'Yengeç': 'Akrep', 'Aslan': 'Yay', 'Başak': 'Oğlak',
    'Terazi': 'Kova', 'Akrep': 'Balık', 'Yay': 'Koç',
    'Oğlak': 'Boğa', 'Kova': 'İkizler', 'Balık': 'Yengeç'
  };
  return friendly[zodiac] || 'Aslan';
};

export const getEnemySign = (zodiac: string): string => {
  const enemy: Record<string, string> = {
    'Koç': 'Yengeç', 'Boğa': 'Aslan', 'İkizler': 'Başak',
    'Yengeç': 'Terazi', 'Aslan': 'Akrep', 'Başak': 'Yay',
    'Terazi': 'Oğlak', 'Akrep': 'Kova', 'Yay': 'Balık',
    'Oğlak': 'Koç', 'Kova': 'Boğa', 'Balık': 'İkizler'
  };
  return enemy[zodiac] || 'Yengeç';
};

export const calculateAge = (birthDate: string): number => {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

export const calculateMysticProfile = (birthDate: string): MysticProfile => {
  const date = new Date(birthDate);
  const zodiacSign = getZodiacSign(date);
  const element = getElement(zodiacSign);
  const rulingPlanet = getRulingPlanet(zodiacSign);
  const friendlySign = getFriendlySign(zodiacSign);
  const enemySign = getEnemySign(zodiacSign);
  const age = calculateAge(birthDate);

  return {
    zodiacSign,
    element,
    rulingPlanet,
    friendlySign,
    enemySign,
    age
  };
};
