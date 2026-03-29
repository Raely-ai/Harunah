import { Gift } from "../types";

export const SOCIAL_GIFTS: Gift[] = [
  {
    id: 'coffee',
    name: 'Kahve',
    price: 10,
    icon: '☕',
    description: 'Sıcak bir kahve ikram et.'
  },
  {
    id: 'rose',
    name: 'Gül',
    price: 25,
    icon: '🌹',
    description: 'Zarif bir gül gönder.'
  },
  {
    id: 'diamond',
    name: 'Elmas',
    price: 100,
    icon: '💎',
    description: 'Değerli bir elmas hediye et.'
  },
  {
    id: 'crown',
    name: 'Taç',
    price: 500,
    icon: '👑',
    description: 'Kraliyet tacı ile onurlandır.'
  },
  {
    id: 'rocket',
    name: 'Roket',
    price: 1000,
    icon: '🚀',
    description: 'Odayı uçuşa geçir!'
  }
];

export const GIFT_REVENUE_DISTRIBUTION = {
  RECEIVER_PERCENT: 60,
  HOST_PERCENT: 20,
  PLATFORM_PERCENT: 20
};

export const MIN_WITHDRAWAL_AMOUNT = 500; // TL or Credits
