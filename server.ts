import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

const firebaseApp = admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(firebaseApp);

// Initialize OpenAI
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// Background Task: Update Reading Statuses
async function updateReadingStatuses() {
  try {
    const now = new Date().toISOString();
    
    // 1. Searching -> Found
    const searchingReadings = await db.collection("readings")
      .where("status", "==", "searching")
      .where("expectedReaderFoundAt", "<=", now)
      .limit(10)
      .get();

    for (const doc of searchingReadings.docs) {
      await doc.ref.update({ status: 'found', updatedAt: now });
    }

    // 2. Found -> Interpreting
    const foundReadings = await db.collection("readings")
      .where("status", "==", "found")
      .where("interpretationStartedAt", "<=", now)
      .limit(10)
      .get();

    for (const doc of foundReadings.docs) {
      await doc.ref.update({ status: 'interpreting', updatedAt: now });
    }

    // 3. Interpreting -> Completed (Trigger AI)
    const interpretingReadings = await db.collection("readings")
      .where("status", "==", "interpreting")
      .where("expectedCompletedAt", "<=", now)
      .limit(10)
      .get();

    for (const doc of interpretingReadings.docs) {
      const reading = doc.data();
      if (reading.isAIGenerated) {
        await doc.ref.update({ status: 'completed', updatedAt: now });
      }
    }
  } catch (error) {
    console.error("Background task error:", error);
  }
}

setInterval(updateReadingStatuses, 60000); // Every minute

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Auth Middleware
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Auth error:", error);
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // 1. Create Fortune Reading
  app.post("/api/fortune/create", authenticate, async (req: any, res) => {
    const userId = req.user.uid;
    const { type, formData, images, cards, questions, priorityMode } = req.body;

    if (!type || !formData) {
      return res.status(400).json({ error: "Missing data" });
    }

    try {
      const userRef = db.collection("users").doc(userId);
      const economyRef = db.collection("adminSettings").doc("economy");

      const result = await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
          const error: any = new Error("Kullanıcı bulunamadı");
          error.status = 404;
          throw error;
        }
        const userData = userSnap.data() as any;

        const economySnap = await transaction.get(economyRef);
        const economy = economySnap.exists ? economySnap.data() as any : {
          fortunePricing: { coffee: 50, tarot: 40, water: 30, ebced: 30, yildizname: 30, havas: 30, extraQuestion: 10, priorityFee: 20 }
        };

        // Calculate Price with safe defaults and Number.isFinite checks
        const getSafePrice = (val: any, fallback: number) => {
          const num = Number(val);
          return Number.isFinite(num) ? num : fallback;
        };

        const basePrice = getSafePrice(economy.fortunePricing?.[type], 50);
        const extraQuestionPrice = getSafePrice(economy.fortunePricing?.extraQuestion, 10);
        const priorityFee = getSafePrice(economy.fortunePricing?.priorityFee, 20);
        
        let extraQuestionsCost = 0;
        if (Array.isArray(questions) && questions.length > 3) {
          extraQuestionsCost = (questions.length - 3) * extraQuestionPrice;
        }
        
        const totalCost = basePrice + extraQuestionsCost + (priorityMode ? priorityFee : 0);

        // Final validation for totalCost
        if (!Number.isFinite(totalCost) || totalCost < 0) {
          const error: any = new Error("Geçersiz ücret hesaplaması");
          error.status = 400;
          throw error;
        }

        // Check Balance
        const userBalance = Number.isFinite(Number(userData.mainCoins)) ? Number(userData.mainCoins) : 0;
        if (userBalance < totalCost) {
          const error: any = new Error("Yetersiz bakiye");
          error.status = 400;
          throw error;
        }

        // Deduct Balance - Guaranteed valid number
        transaction.update(userRef, {
          mainCoins: FieldValue.increment(-totalCost)
        });

        // Create Reading
        const readingRef = db.collection("readings").doc();
        const now = new Date();
        
        const readingData = {
          id: readingRef.id,
          userId,
          type,
          status: 'searching',
          formData,
          images: Array.isArray(images) ? images : [],
          cards: Array.isArray(cards) ? cards : [],
          questions: Array.isArray(questions) ? questions : [],
          priorityMode: !!priorityMode,
          creditsUsed: totalCost,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          title: type === 'coffee' ? 'Kahve Falı' : type === 'tarot' ? 'Tarot Açılımı' : type.charAt(0).toUpperCase() + type.slice(1)
        };

        transaction.set(readingRef, readingData);

        return { readingId: readingRef.id };
      });

      res.json(result);
    } catch (error: any) {
      console.error("Create fortune error:", error);
      const status = error.status || 500;
      const message = error.message || "Sunucu hatası";
      res.status(status).json({ error: message });
    }
  });

  // 2. Process Fortune AI (Gemini)
  app.post("/api/fortune/process", authenticate, async (req: any, res) => {
    const userId = req.user.uid;
    const { readingId } = req.body;

    if (!readingId) {
      return res.status(400).json({ error: "Missing readingId" });
    }

    try {
      const readingRef = db.collection("readings").doc(readingId);
      const readingSnap = await readingRef.get();

      if (!readingSnap.exists) {
        return res.status(404).json({ error: "Reading not found" });
      }

      const reading = readingSnap.data() as any;
      if (reading.userId !== userId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      if (reading.status === 'completed') {
        return res.json({ success: true, content: reading.content });
      }

      // Update status to interpreting
      await readingRef.update({ status: 'interpreting', updatedAt: new Date().toISOString() });

      // Fetch Economy Config for AI Settings
      const economyRef = db.collection("adminSettings").doc("economy");
      const economySnap = await economyRef.get();
      const economy = economySnap.exists ? economySnap.data() as any : null;
      const aiConfig = economy?.aiSettings?.[reading.type] || {};

      // Prepare Placeholders
      const placeholders: Record<string, string> = {
        adsoyad: reading.formData.adSoyad || "Canım",
        dogumtarihi: reading.formData.dogumTarihi || "Bilinmiyor",
        iliskidurumu: reading.formData.iliskiDurumu || "Bilinmiyor",
        annebaba: `${reading.formData.motherName || ""}/${reading.formData.fatherName || ""}`,
        sorular: reading.questions?.join(", ") || "Genel yorum",
        kartlar: reading.cards?.join(", ") || "Seçim yok",
        gorseller: reading.images?.length > 0 ? `${reading.images.length} adet görsel yüklendi.` : "Görsel yok",
        tur: reading.type,
        isim: reading.formData.adSoyad?.split(" ")[0] || "Canım"
      };

      let systemPrompt = aiConfig.systemPrompt || `
        Sen LASYA isminde mistik, bilge ve sezgileri kuvvetli bir kahinsin. 
        Kullanıcının verdiği bilgileri ve sembolleri yorumlayarak onlara gelecekten haberler veriyorsun.
        Dilin mistik, etkileyici ama anlaşılır olmalı. 
        Kullanıcıya ismiyle hitap et.
        Yorumun mutlaka şu cümleyle başla: "Merhaba tekrardan hoşgeldin, şimdi hemen falına geçelim..."
        Yorumunu mutlaka şu cümleyle bitir: "Falın bu kadardı sabrın için teşekkür ederim."
        TÜM YORUMUN TEK BİR PARAGRAF OLMALI, SATIR ATLAMA KESİNLİKLE YASAK.
      `;

      let templatePrompt = aiConfig.templatePrompt || `
        Kullanıcı Bilgileri:
        Ad Soyad: {adsoyad}
        Doğum Tarihi: {dogumtarihi}
        İlişki Durumu: {iliskidurumu}
        Tür: {tur}
        Sorular: {sorular}
        Kartlar: {kartlar}
        Görsel Sayısı: {gorseller}
        
        Lütfen bu bilgilere göre detaylı bir fal yorumu yap.
      `;

      // Replace Placeholders
      Object.entries(placeholders).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        systemPrompt = systemPrompt.replace(regex, value);
        templatePrompt = templatePrompt.replace(regex, value);
      });

      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: templatePrompt }
        ],
        temperature: 0.8,
      });

      const content = response.choices[0].message.content || "Yıldızlar şu an biraz bulanık, lütfen daha sonra tekrar deneyin.";

      // Save Result
      await readingRef.update({
        status: 'completed',
        content,
        resultText: content,
        updatedAt: new Date().toISOString()
      });

      res.json({ success: true, content });
    } catch (error: any) {
      console.error("Process AI error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Upgrade Fortune Priority
  app.post("/api/fortune/upgrade", authenticate, async (req: any, res) => {
    const userId = req.user.uid;
    const { readingId } = req.body;

    if (!readingId) {
      return res.status(400).json({ error: "Missing readingId" });
    }

    try {
      const readingRef = db.collection("readings").doc(readingId);
      const userRef = db.collection("users").doc(userId);
      const economyRef = db.collection("adminSettings").doc("economy");

      const result = await db.runTransaction(async (transaction) => {
        const readingSnap = await transaction.get(readingRef);
        if (!readingSnap.exists) {
          const error: any = new Error("Fal kaydı bulunamadı");
          error.status = 404;
          throw error;
        }
        const reading = readingSnap.data() as any;

        if (reading.userId !== userId) {
          const error: any = new Error("Yetkisiz işlem");
          error.status = 403;
          throw error;
        }
        if (reading.priorityMode) {
          const error: any = new Error("Zaten öncelikli modda");
          error.status = 400;
          throw error;
        }

        const economySnap = await transaction.get(economyRef);
        const priorityFee = economySnap.data()?.fortunePricing?.priorityFee || 20;

        const userSnap = await transaction.get(userRef);
        const userData = userSnap.data() as any;

        if ((userData.mainCoins || 0) < priorityFee) {
          const error: any = new Error("Yetersiz bakiye");
          error.status = 400;
          throw error;
        }

        // Deduct Fee
        transaction.update(userRef, {
          mainCoins: FieldValue.increment(-priorityFee)
        });

        // Update Reading
        transaction.update(readingRef, {
          priorityMode: true,
          updatedAt: new Date().toISOString()
        });

        return { success: true };
      });

      res.json(result);
    } catch (error: any) {
      console.error("Upgrade error:", error);
      const status = error.status || 500;
      const message = error.message || "Sunucu hatası";
      res.status(status).json({ error: message });
    }
  });

  // 4. Daily Message
  app.post("/api/daily-message", authenticate, async (req: any, res) => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Sen bilge bir kahinsin. Kullanıcılara günlük kısa, etkileyici ve mistik mesajlar veriyorsun." },
          { role: "user", content: "Günün falı için kısa, gizemli ve motive edici bir cümle yaz. Aşk, kariyer veya genel bir tavsiye olsun. Sadece cümleyi döndür. Maksimum 15 kelime." }
        ],
        temperature: 0.8,
        max_tokens: 100
      });

      const text = response.choices[0].message.content || "Yıldızlar bugün senin için parlıyor.";
      const categories: ('love' | 'career' | 'general')[] = ['love', 'career', 'general'];
      const category = categories[Math.floor(Math.random() * categories.length)];
      
      res.json({ text, category });
    } catch (error: any) {
      console.error("Daily message AI error:", error);
      res.json({ text: "Yıldızlar bugün senin için parlıyor.", category: 'general' });
    }
  });

  // --- Wallet Endpoints ---

  app.post("/api/wallet/watch-ad", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { config } = req.body;
      const userRef = db.collection("users").doc(userId);
      
      await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data() as any;
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // Reset daily count if needed
        let dailyCount = userData.dailyAdWatchCount || 0;
        if (userData.lastAdReset !== today) {
          dailyCount = 0;
        }

        if (dailyCount >= (config.maxDailyAds || 5)) {
          throw new Error("Günlük reklam izleme sınırına ulaştınız.");
        }

        const rewardAmount = config.adRewardEnergy || 10;
        const expiresAt = new Date();
        expiresAt.setDate(now.getDate() + (config.adRewardExpiryDays || 7));

        transaction.update(userRef, {
          energy: FieldValue.increment(rewardAmount),
          dailyAdWatchCount: dailyCount + 1,
          lastAdReset: today
        });

        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'earn',
          source: 'ad',
          amount: rewardAmount,
          balanceType: 'energy',
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
          status: 'active',
          remainingAmount: rewardAmount,
          description: 'Reklam izleme ödülü'
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/wallet/purchase-coins", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { amount, packageId } = req.body;
      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (transaction) => {
        transaction.update(userRef, {
          mainCoins: FieldValue.increment(amount)
        });

        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'purchase',
          source: 'purchase',
          amount: amount,
          balanceType: 'main',
          createdAt: new Date().toISOString(),
          status: 'active',
          description: `${amount} Jeton satın alımı (${packageId})`
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/wallet/spend-balance", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { balanceType, amount, source, description } = req.body;
      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data() as any;

        const currentBalance = userData[balanceType === 'main' ? 'mainCoins' : 'energy'] || 0;
        if (currentBalance < amount) throw new Error("Yetersiz bakiye.");

        transaction.update(userRef, {
          [balanceType === 'main' ? 'mainCoins' : 'energy']: FieldValue.increment(-amount)
        });

        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'spend',
          source,
          amount: -amount,
          balanceType,
          createdAt: new Date().toISOString(),
          status: 'spent',
          description
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/wallet/purchase-social-item", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { type, description } = req.body;
      const userRef = db.collection("users").doc(userId);
      const economyRef = db.collection("adminSettings").doc("economy");

      await db.runTransaction(async (transaction) => {
        const economySnap = await transaction.get(economyRef);
        const economy = economySnap.data() as any;
        const priceKey = type === 'superLike' ? 'superLike' : type === 'refresh' ? 'refresh' : 'compatibility';
        const price = (economy?.socialPricing?.[priceKey]?.[0]?.priceCoins) || 20;

        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data() as any;

        if ((userData.mainCoins || 0) < price) throw new Error("Yetersiz bakiye.");

        const updates: any = {
          mainCoins: FieldValue.increment(-price)
        };
        if (type === 'superLike') updates.superLikes = FieldValue.increment(1);
        if (type === 'refresh') updates.refreshCount = FieldValue.increment(1);
        if (type === 'compatibility') updates.compatibilityCount = FieldValue.increment(1);

        transaction.update(userRef, updates);

        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'spend',
          source: 'social_action',
          amount: -price,
          balanceType: 'main',
          createdAt: new Date().toISOString(),
          status: 'spent',
          description: `${description} satın alımı`
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/wallet/purchase-social-bundle", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { bundleId } = req.body;
      const userRef = db.collection("users").doc(userId);
      const economyRef = db.collection("adminSettings").doc("economy");

      await db.runTransaction(async (transaction) => {
        const economySnap = await transaction.get(economyRef);
        const economy = economySnap.data() as any;
        const bundles = economy?.socialBundles || [
          { id: "starter_bundle", name: "Başlangıç Paketi", price: 150, contents: { superLikes: 5, refreshes: 5, compatibility: 5, boostDays: 7 } }
        ];
        const bundle = bundles.find((b: any) => b.id === bundleId);
        if (!bundle) throw new Error("Paket bulunamadı.");

        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data() as any;

        if ((userData.mainCoins || 0) < bundle.price) throw new Error("Yetersiz bakiye.");

        const now = new Date();
        const boostExpiry = new Date();
        boostExpiry.setDate(now.getDate() + bundle.contents.boostDays);

        transaction.update(userRef, {
          mainCoins: FieldValue.increment(-bundle.price),
          superLikes: FieldValue.increment(bundle.contents.superLikes),
          refreshCount: FieldValue.increment(bundle.contents.refreshes),
          compatibilityCount: FieldValue.increment(bundle.contents.compatibility),
          boostExpiresAt: boostExpiry.toISOString()
        });

        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'spend',
          source: 'social_action',
          amount: -bundle.price,
          balanceType: 'main',
          createdAt: now.toISOString(),
          status: 'spent',
          description: `${bundle.name} satın alımı`
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/wallet/consume-social-feature", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { type, config } = req.body;
      const userRef = db.collection("users").doc(userId);

      const result = await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data() as any;

        const sub = userData.socialSubscription;
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        if (sub && sub.status === 'active' && new Date(sub.expiresAt) > now) {
          const dailyUsage = sub.dailyUsage || { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: today };
          if (dailyUsage.lastResetDate !== today) {
            dailyUsage.superLikes = 0;
            dailyUsage.refreshes = 0;
            dailyUsage.compatibility = 0;
            dailyUsage.lastResetDate = today;
          }

          const limits = config.socialSubscriptions[sub.type].dailyLimits;
          if (type === 'superLike' && dailyUsage.superLikes < limits.superLikes) {
            dailyUsage.superLikes++;
            transaction.update(userRef, { "socialSubscription.dailyUsage": dailyUsage });
            return { success: true };
          } else if (type === 'refresh' && dailyUsage.refreshes < limits.refreshes) {
            dailyUsage.refreshes++;
            transaction.update(userRef, { "socialSubscription.dailyUsage": dailyUsage });
            return { success: true };
          } else if (type === 'compatibility' && dailyUsage.compatibility < limits.compatibility) {
            dailyUsage.compatibility++;
            transaction.update(userRef, { "socialSubscription.dailyUsage": dailyUsage });
            return { success: true };
          }
        }

        const field = type === 'superLike' ? 'superLikes' : type === 'refresh' ? 'refreshCount' : 'compatibilityCount';
        if ((userData[field] || 0) <= 0) throw new Error("Yetersiz hak.");

        transaction.update(userRef, { [field]: FieldValue.increment(-1) });
        return { success: true };
      });

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/wallet/buy-fortune-subscription", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { type, subConfig } = req.body;
      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data() as any;

        const price = subConfig.price;
        if ((userData.mainCoins || 0) < price) throw new Error("Yetersiz bakiye.");

        const now = new Date();
        const expiresAt = new Date();
        if (type === 'daily') expiresAt.setDate(now.getDate() + 1);
        else if (type === 'weekly') expiresAt.setDate(now.getDate() + 7);
        else if (type === 'monthly') expiresAt.setMonth(now.getMonth() + 1);

        transaction.update(userRef, {
          mainCoins: FieldValue.increment(-price),
          subscription: {
            status: 'active',
            type,
            expiresAt: expiresAt.toISOString(),
            dailyLimitUsed: 0,
            dailyLimit: subConfig.dailyLimit,
            lastResetAt: now.toISOString()
          }
        });

        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'spend',
          source: 'subscription',
          amount: -price,
          balanceType: 'main',
          createdAt: now.toISOString(),
          status: 'spent',
          description: `Fal Aboneliği (${type})`
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/wallet/buy-social-subscription", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { type, subConfig } = req.body;
      const userRef = db.collection("users").doc(userId);

      await db.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) throw new Error("Kullanıcı bulunamadı.");
        const userData = userSnap.data() as any;

        const price = subConfig.price;
        if ((userData.mainCoins || 0) < price) throw new Error("Yetersiz bakiye.");

        const now = new Date();
        const expiresAt = new Date();
        if (type === 'weekly') expiresAt.setDate(now.getDate() + 7);
        else if (type === 'monthly') expiresAt.setMonth(now.getMonth() + 1);

        transaction.update(userRef, {
          mainCoins: FieldValue.increment(-price),
          socialSubscription: {
            status: 'active',
            type,
            expiresAt: expiresAt.toISOString(),
            dailyUsage: { superLikes: 0, refreshes: 0, compatibility: 0, lastResetDate: now.toISOString().split('T')[0] }
          },
          boostExpiresAt: expiresAt.toISOString()
        });

        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId,
          type: 'spend',
          source: 'subscription',
          amount: -price,
          balanceType: 'main',
          createdAt: now.toISOString(),
          status: 'spent',
          description: `Sosyal Aboneliği (${type})`
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/moderation-action", authenticate, async (req: any, res) => {
    try {
      const adminId = req.user.uid;
      const adminSnap = await db.collection("users").doc(adminId).get();
      const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                      (req.user.email === "hpferdicakir@gmail.com" && req.user.email_verified === true);
      
      if (!isAdmin) return res.status(403).json({ error: "Yetkisiz işlem." });

      const { targetUserId, action, reason, reportId } = req.body;
      const userRef = db.collection("users").doc(targetUserId);

      await db.runTransaction(async (transaction) => {
        const updates: any = {};
        if (action === 'ban') updates.isBanned = true;
        if (action === 'unban') updates.isBanned = false;
        if (action === 'mute') updates.isMuted = true;
        if (action === 'unmute') updates.isMuted = false;

        transaction.update(userRef, updates);

        const logRef = db.collection("moderationLogs").doc();
        transaction.set(logRef, {
          id: logRef.id,
          adminId,
          adminEmail: req.user.email || "",
          targetUid: targetUserId,
          action,
          reason,
          timestamp: new Date().toISOString(),
          reportId
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/admin/adjust-wallet", authenticate, async (req: any, res) => {
    try {
      const adminId = req.user.uid;
      const adminSnap = await db.collection("users").doc(adminId).get();
      const isAdmin = (adminSnap.exists && adminSnap.data()?.role === 'admin') || 
                      (req.user.email === "hpferdicakir@gmail.com" && req.user.email_verified === true);
      
      if (!isAdmin) return res.status(403).json({ error: "Yetkisiz işlem." });

      const { targetUserId, field, amount } = req.body;
      const userRef = db.collection("users").doc(targetUserId);

      await db.runTransaction(async (transaction) => {
        transaction.update(userRef, {
          [field]: FieldValue.increment(amount)
        });

        const txRef = db.collection("walletTransactions").doc();
        transaction.set(txRef, {
          id: txRef.id,
          userId: targetUserId,
          type: amount > 0 ? 'earn' : 'spend',
          source: 'admin_grant',
          amount,
          balanceType: field === 'mainCoins' ? 'main' : 'energy',
          createdAt: new Date().toISOString(),
          status: 'active',
          description: `Admin tarafından düzenlendi`
        });
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true'
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Retrying in 1 second...`);
      setTimeout(() => {
        server.close();
        server.listen(PORT, "0.0.0.0");
      }, 1000);
    } else {
      console.error('Server error:', e);
    }
  });
}

startServer();
