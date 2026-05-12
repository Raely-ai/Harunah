import * as crypto from 'crypto';

interface CompatPerson {
  name?: string;
  birthDate?: string; // YYYY-MM-DD
  uid?: string;
  zodiacSign?: string;
  element?: string;
  interests?: string[];
  lookingFor?: string;
}

interface DeterministicScores {
  love: number;
  friendship: number;
  energy: number;
  understanding: number;
  dominantType: 'love' | 'friendship' | 'balanced';
  signals: {
    attractionLevel: 'low' | 'medium' | 'high';
    communicationTone: string;
    tensionRisk: 'low' | 'medium' | 'high';
    bondType: string;
  };
}

const zodiacDates = [
  { sign: 'Oğlak', element: 'Toprak', start: '01-01', end: '01-19' },
  { sign: 'Kova', element: 'Hava', start: '01-20', end: '02-18' },
  { sign: 'Balık', element: 'Su', start: '02-19', end: '03-20' },
  { sign: 'Koç', element: 'Ateş', start: '03-21', end: '04-19' },
  { sign: 'Boğa', element: 'Toprak', start: '04-20', end: '05-20' },
  { sign: 'İkizler', element: 'Hava', start: '05-21', end: '06-20' },
  { sign: 'Yengeç', element: 'Su', start: '06-21', end: '07-22' },
  { sign: 'Aslan', element: 'Ateş', start: '07-23', end: '08-22' },
  { sign: 'Başak', element: 'Toprak', start: '08-23', end: '09-22' },
  { sign: 'Terazi', element: 'Hava', start: '09-23', end: '10-22' },
  { sign: 'Akrep', element: 'Su', start: '10-23', end: '11-21' },
  { sign: 'Yay', element: 'Ateş', start: '11-22', end: '12-21' },
  { sign: 'Oğlak', element: 'Toprak', start: '12-22', end: '12-31' }
];

function getZodiacInfo(birthDate?: string): { sign: string; element: string } {
  if (!birthDate) return { sign: '', element: '' };
  
  // Format check
  const parts = birthDate.split('-');
  if (parts.length !== 3) return { sign: '', element: '' };
  
  // Accept standard YYYY-MM-DD or DD.MM.YYYY, but here we expect ISO from frontend or we parse it flexibly
  let monthStr = parts[1];
  let dayStr = parts[2];
  
  // If it's DD.MM.YYYY
  if (birthDate.includes('.')) {
      const p = birthDate.split('.');
      if(p.length === 3) {
          dayStr = p[0];
          monthStr = p[1];
      }
  } else if (parts[0].length === 2 && parts[2].length === 4) {
      // DD-MM-YYYY
      dayStr = parts[0];
      monthStr = parts[1];
  }

  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (isNaN(month) || isNaN(day) || month < 1 || month > 12) return { sign: '', element: '' };

  const md = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  
  for (const z of zodiacDates) {
    if (md >= z.start && md <= z.end) {
      return { sign: z.sign, element: z.element };
    }
  }
  return { sign: '', element: '' };
}

function calculateDeterministicHash(str1: string, str2: string): number {
  const combined = [str1, str2].sort().join('|'); // sort ensures symmetry
  const hash = crypto.createHash('md5').update(combined).digest('hex');
  // Return a number between 0 and 100 based on hash
  const sub = hash.substring(0, 8);
  return parseInt(sub, 16) % 101; 
}

export function calculateBackendCompatibility(p1: CompatPerson, p2: CompatPerson, relationshipType?: string): DeterministicScores {
  try {
    const name1 = (p1.name || '').trim().toLowerCase();
    const name2 = (p2.name || '').trim().toLowerCase();
    const bd1 = p1.birthDate || '';
    const bd2 = p2.birthDate || '';

    const z1 = getZodiacInfo(bd1);
    const z2 = getZodiacInfo(bd2);

    const sign1 = p1.zodiacSign || z1.sign || 'unknown';
    const sign2 = p2.zodiacSign || z2.sign || 'unknown';
    const el1 = p1.element || z1.element || 'unknown';
    const el2 = p2.element || z2.element || 'unknown';

    // Base scores from names
    let baseL = calculateDeterministicHash(name1 + '_love', name2 + '_love');
    let baseF = calculateDeterministicHash(name1 + '_friend', name2 + '_friend');
    let baseE = calculateDeterministicHash(name1 + '_energy', name2 + '_energy');

    // Add birthdate influence
    if (bd1 && bd2) {
      baseL = (baseL + calculateDeterministicHash(bd1 + '_l', bd2 + '_l')) / 2;
      baseF = (baseF + calculateDeterministicHash(bd1 + '_f', bd2 + '_f')) / 2;
      baseE = (baseE + calculateDeterministicHash(bd1 + '_e', bd2 + '_e')) / 2;
    }

    // Element compatibility
    let elementBonus = 0;
    if (el1 !== 'unknown' && el2 !== 'unknown') {
      if (el1 === el2) elementBonus = 15; // Same element
      else if (
        (el1 === 'Ateş' && el2 === 'Hava') || (el1 === 'Hava' && el2 === 'Ateş') ||
        (el1 === 'Toprak' && el2 === 'Su') || (el1 === 'Su' && el2 === 'Toprak')
      ) {
        elementBonus = 20; // Highly compatible elements
      } else {
        elementBonus = -10; // Challenging elements
      }
    }

    let love = baseL * 0.6 + 30 + elementBonus; // Range approx 20-110
    let friendship = baseF * 0.6 + 30 + (elementBonus * 0.5);
    let energy = baseE * 0.6 + 30 + (elementBonus > 0 ? 10 : -10);

    // Relationship type influence
    const rType = relationshipType || p1.lookingFor || 'ask';
    if (rType === 'arkadaslik') {
      friendship += 10;
      love -= 10;
    } else if (rType === 'ask') {
      love += 10;
    }

    // Interests
    let sharedInterests = 0;
    if (p1.interests && p2.interests && p1.interests.length && p2.interests.length) {
      sharedInterests = p1.interests.filter(i => p2.interests?.includes(i)).length;
      if (sharedInterests > 0) {
        friendship += sharedInterests * 3;
        energy += sharedInterests * 2;
      }
    }

    // Clamp
    const clamp = (v: number) => Math.min(100, Math.max(40, Math.round(v)));
    
    love = clamp(love);
    friendship = clamp(friendship);
    energy = clamp(energy);
    const understanding = clamp((friendship + energy) / 2);

    let dominantType: 'love' | 'friendship' | 'balanced' = 'balanced';
    if (love > friendship + 10) dominantType = 'love';
    else if (friendship > love + 10) dominantType = 'friendship';

    let attractionLevel: 'low' | 'medium' | 'high' = 'medium';
    if (love > 85) attractionLevel = 'high';
    else if (love < 60) attractionLevel = 'low';

    let tensionRisk: 'low' | 'medium' | 'high' = 'medium';
    if (elementBonus < 0 && energy < 60) tensionRisk = 'high';
    else if (elementBonus > 0 && energy > 75) tensionRisk = 'low';

    return {
      love,
      friendship,
      energy,
      understanding,
      dominantType,
      signals: {
        attractionLevel,
        communicationTone: friendship > 75 ? 'akıcı ve şeffaf' : 'zaman zaman kapalı',
        tensionRisk,
        bondType: love > 80 ? 'Karmik Bağ' : (sharedInterests >= 3 ? 'Zihinsel Eşleşme' : 'Geliştirilebilir Bağ')
      }
    };
  } catch (err) {
    console.error("calculateBackendCompatibility error fallback", err);
    return {
      love: 75,
      friendship: 80,
      energy: 70,
      understanding: 75,
      dominantType: 'balanced',
      signals: {
        attractionLevel: 'medium',
        communicationTone: 'stabil',
        tensionRisk: 'medium',
        bondType: 'Standart Bağ'
      }
    };
  }
}
