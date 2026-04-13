import { RelationshipType, EconomyConfig, FortuneAIConfig } from "./types";

export const RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: 'ask', label: 'Aşk' },
  { value: 'arkadas', label: 'Arkadaşlık' },
  { value: 'flirt', label: 'Flört' },
  { value: 'platonik', label: 'Platonik' },
  { value: 'gorucu_usulu', label: 'Görücü Usulü' },
  { value: 'eski_sevgili', label: 'Eski Sevgili' },
  { value: 'karsiliksiz_sevgi', label: 'Karşılıksız Sevgi' },
  { value: 'evlilik_adayi', label: 'Evlilik Adayı' },
];

export const ZODIAC_SIGNS = [
  'Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak', 
  'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'
];

export const GENDERS = [
  { value: 'erkek', label: 'Erkek' },
  { value: 'kadın', label: 'Kadın' }
];

export const LOOKING_FOR_OPTIONS = [
  { value: 'arkadaş', label: 'Arkadaşlık' },
  { value: 'ilişki', label: 'Ciddi İlişki' },
  { value: 'sohbet', label: 'Sohbet' },
  { value: 'evlilik', label: 'Evlilik' }
];

export const DEFAULT_AI_CONFIG: FortuneAIConfig = {
  systemPrompt: "Sen uzman bir falcısın. Kullanıcının bilgilerine ve seçtiği fal türüne göre derinlemesine, mistik ve yol gösterici yorumlar yaparsın.",
  templatePrompt: "Kullanıcı: {isim}, Cinsiyet: {cinsiyet}, İlişki: {iliskidurumu}, İş: {isdurumu}, Doğum: {dogumtarihi}. Ekstra: {ekbilgi}.",
  tone: "mystic",
  minLength: 500,
  maxLength: 2000,
  mysticLevel: 5,
  extraQuestionBehavior: "detailed"
};

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  fortunePricing: {
    coffee: 100,
    tarot: 150,
    water: 200,
    ebced: 250,
    yildizname: 300,
    havas: 500,
    dream: 100,
    extraQuestion: 50,
    priorityFee: 100
  },
  interpretationTimes: {
    coffee: { minSearchTime: 30, maxSearchTime: 60, minInterpreterTime: 300, maxInterpreterTime: 600, minReadingTime: 60, maxReadingTime: 120 },
    tarot: { minSearchTime: 30, maxSearchTime: 60, minInterpreterTime: 300, maxInterpreterTime: 600, minReadingTime: 60, maxReadingTime: 120 },
    advanced: { minSearchTime: 30, maxSearchTime: 60, minInterpreterTime: 300, maxInterpreterTime: 600, minReadingTime: 60, maxReadingTime: 120 }
  },
  energyPaymentEnabled: true,
  subscriptionLimits: {
    totalDaily: 10
  },
  aiSettings: {
    coffee: DEFAULT_AI_CONFIG,
    tarot: DEFAULT_AI_CONFIG,
    water: DEFAULT_AI_CONFIG,
    ebced: DEFAULT_AI_CONFIG,
    yildizname: DEFAULT_AI_CONFIG,
    havas: DEFAULT_AI_CONFIG,
    dream: DEFAULT_AI_CONFIG
  },
  rewards: {
    adRewardEnergy: 10,
    maxDailyAds: 5,
    adRewardExpiryDays: 7,
    dailyLoginRewardEnergy: 20,
    dailyLoginExpiryDays: 7,
    customRewards: []
  },
  coinPackages: [
    { id: "100_coins", coins: 100, priceTRY: 49.99, bonus: 0 },
    { id: "500_coins", coins: 500, priceTRY: 199.99, bonus: 50 }
  ],
  socialPricing: {
    superLike: [{ id: "1_sl", count: 1, priceCoins: 20 }],
    refresh: [{ id: "1_rf", count: 1, priceCoins: 15 }],
    compatibility: [{ id: "1_cp", count: 1, priceCoins: 25 }]
  },
  boostPackages: {
    weekly: { priceTRY: 49.99, days: 7, description: "1 Hafta Boost" },
    monthly: { priceTRY: 149.99, days: 30, description: "1 Ay Boost" }
  },
  fortuneSubscriptions: {
    daily: { priceTRY: 19.99, dailyLimit: 10, description: "Günlük" },
    weekly: { priceTRY: 59.99, dailyLimit: 10, description: "Haftalık" },
    monthly: { priceTRY: 149.99, dailyLimit: 10, description: "Aylık" }
  },
  manualCompatibilityPrompt: "Sen uzman bir ilişki danışmanı ve astroloğusun. {person1_name} ({person1_birthDate}, {person1_status}) ve {person2_name} ({person2_birthDate}, {person2_status}) arasındaki {relationshipType} uyumunu analiz et. Yıldız haritalarını, numerolojiyi ve enerji frekanslarını kullanarak derinlemesine bir yorum yap. \n\nKurallar:\n1. Kesinlikle fotoğraflardan bahsetme (fotoğrafları görmüyorsun).\n2. Yorumun mistik, etkileyici ve profesyonel olsun.\n3. Toplam 3-4 paragraf olsun.\n4. Sonuçta mutlaka bir tavsiye ver.\n5. Yanıtın sadece analiz metni olsun."
};
