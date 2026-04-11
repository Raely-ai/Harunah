import { EconomyConfig, FortuneAIConfig } from "./types";

export const DEFAULT_AI_CONFIG: FortuneAIConfig = {
  systemPrompt: "Sen Ahlas adında, karizmatik, gizemli ve hafif flörtöz bir erkek falcısın. Robot gibi değil, gerçek bir insan gibi konuşuyorsun. Fazla noktalama işareti kullanmıyorsun. Tüm yorumun tek bir paragraf olmalı, satır atlamamalısın. Toplam yorumun 350-400 kelime arasında olmalı. Eğer sorular varsa, her soruya 90-150 kelime arasında cevap vermelisin. Kullanıcı bilgilerini yorum içinde açıkça yazma. Yorumuna 'Merhaba tekrardan hoşgeldin {isim}, şimdi hemen falına geçelim...' cümlesiyle başla. Sonunda 'Falın bu kadardı sabrın için teşekkür ederim.' diyerek bitir. Hafif erkek empatisi ekle, küçük uyarılar yap ve sonunda bir merak kapısı bırak. En az 3 moral cümlesi kur. Semboller uydur ve zaman aralıkları ver.",
  templatePrompt: "Kullanıcı Bilgileri:\nİsim: {adsoyad}\nDoğum Tarihi: {dogumtarihi}\nİlişki Durumu: {iliskidurumu}\nAnne Adı: {anneadi}\nBaba Adı: {babaadi}\n\nFal Detayları:\nTür: {tur}\nSorular: {sorular}",
  tone: "Karizmatik & Flörtöz",
  minLength: 350,
  maxLength: 400,
  mysticLevel: 9,
  extraQuestionBehavior: "Soruları derinlemesine ve gizemli bir dille yanıtla."
};

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  fortunePricing: {
    coffee: 100,
    tarot: 150,
    water: 200,
    ebced: 250,
    yildizname: 300,
    havas: 500,
    horoscope: 100,
    dream: 100,
    extraQuestion: 50,
    priorityFee: 100
  },
  interpretationTimes: {
    coffee: { minSearchTime: 1, maxSearchTime: 3, minInterpreterTime: 5, maxInterpreterTime: 10, minReadingTime: 10, maxReadingTime: 20 },
    tarot: { minSearchTime: 1, maxSearchTime: 3, minInterpreterTime: 5, maxInterpreterTime: 10, minReadingTime: 10, maxReadingTime: 20 },
    advanced: { minSearchTime: 2, maxSearchTime: 5, minInterpreterTime: 10, maxInterpreterTime: 15, minReadingTime: 15, maxReadingTime: 30 }
  },
  fakeProcessing: {
    readerFindingMinDelay: 60000, // 1 dk
    readerFindingMaxDelay: 180000, // 3 dk
    interpretationMinDelay: 300000, // 5 dk
    interpretationMaxDelay: 1200000 // 20 dk
  },
  energyPaymentEnabled: true,
  subscriptionLimits: {
    totalDaily: 10
  },
  aiSettings: {
    coffee: { ...DEFAULT_AI_CONFIG, systemPrompt: DEFAULT_AI_CONFIG.systemPrompt + " Kahve falı için: 'Fincanına baktım, tabağına baktım...' ifadesini kullan. Kahve telvelerindeki sembolleri (kuş, balık, yol vb.) Ahlas tarzıyla yorumla." },
    tarot: { ...DEFAULT_AI_CONFIG, systemPrompt: DEFAULT_AI_CONFIG.systemPrompt + " Tarot falı için 3 kart (geçmiş/şimdi/gelecek) yorumu yap. Eğer sorular varsa, seçilen kartlar üzerinden cevap ver." },
    water: { ...DEFAULT_AI_CONFIG, systemPrompt: DEFAULT_AI_CONFIG.systemPrompt + " Su falı için: 'Suda yansıyan, suda beliren...' ifadesini kullan. Suyun duruluğundaki yansımaları mistik bir dille anlat." },
    ebced: { ...DEFAULT_AI_CONFIG, systemPrompt: DEFAULT_AI_CONFIG.systemPrompt + " Ebced falı için: 'Ebced hesabına göre...' ifadesini kullan. İsimlerin sayısal değerlerinden kader analizi yap." },
    yildizname: { ...DEFAULT_AI_CONFIG, systemPrompt: DEFAULT_AI_CONFIG.systemPrompt + " Yıldızname için: 'Yıldızlarının etkisine göre...' ifadesini kullan. Doğum haritası ve yıldız konumlarını Ahlas'ın gizemli diliyle yorumla." },
    havas: { ...DEFAULT_AI_CONFIG, systemPrompt: DEFAULT_AI_CONFIG.systemPrompt + " İlmi Havas için: 'Varlıklarıma sorduğumda...' ifadesini kullan. Gizli ilimler ve manevi enerjiler üzerinden derin bir analiz yap." },
    horoscope: { ...DEFAULT_AI_CONFIG, systemPrompt: DEFAULT_AI_CONFIG.systemPrompt + " Burç yorumu için yıldızların konumunu kullan." },
    dream: { ...DEFAULT_AI_CONFIG, systemPrompt: DEFAULT_AI_CONFIG.systemPrompt + " Rüya tabiri için sembolleri analiz et." }
  },
  rewards: {
    adRewardEnergy: 10,
    maxDailyAds: 5,
    adRewardExpiryDays: 7,
    dailyLoginRewardEnergy: 5,
    dailyLoginExpiryDays: 1,
    customRewards: []
  },
  coinPackages: [
    { id: 'pkg_1', coins: 100, priceTRY: 19.99, bonus: 0 },
    { id: 'pkg_2', coins: 500, priceTRY: 89.99, bonus: 50 },
    { id: 'pkg_3', coins: 1000, priceTRY: 169.99, bonus: 150 }
  ],
  socialPricing: {
    superLike: [
      { id: 'sl_1', count: 1, priceCoins: 10 },
      { id: 'sl_5', count: 5, priceCoins: 45 },
      { id: 'sl_10', count: 10, priceCoins: 80 }
    ],
    refresh: [
      { id: 'rf_1', count: 1, priceCoins: 5 },
      { id: 'rf_5', count: 5, priceCoins: 20 }
    ],
    compatibility: [
      { id: 'cm_1', count: 1, priceCoins: 25 }
    ]
  },
  socialSubscriptions: {
    weekly: { 
      priceTRY: 49.99, 
      dailyLimits: { superLikes: 5, refreshes: 3, compatibility: 1 },
      description: "Haftalık Sosyal Paket",
      boostDuration: "7 Gün Boost"
    },
    monthly: { 
      priceTRY: 149.99, 
      dailyLimits: { superLikes: 10, refreshes: 5, compatibility: 3 },
      description: "Aylık Sosyal Paket",
      boostDuration: "30 Gün Boost"
    }
  },
  fortuneSubscriptions: {
    daily: { priceTRY: 9.99, dailyLimit: 10, description: "Günlük Fal Paketi" },
    weekly: { priceTRY: 59.99, dailyLimit: 10, description: "Haftalık Fal Paketi" },
    monthly: { priceTRY: 199.99, dailyLimit: 10, description: "Aylık Fal Paketi" }
  }
};
