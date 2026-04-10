import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = admin.firestore(firebaseConfig.firestoreDatabaseId);

// Initialize Gemini
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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
      const decodedToken = await admin.auth().verifyIdToken(token);
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
        if (!userSnap.exists) throw new Error("User not found");
        const userData = userSnap.data() as any;

        const economySnap = await transaction.get(economyRef);
        const economy = economySnap.exists ? economySnap.data() as any : {
          fortunePricing: { coffee: 50, tarot: 40, water: 30, ebced: 30, yildizname: 30, havas: 30, extraQuestion: 10, priorityFee: 20 }
        };

        // Calculate Price
        const basePrice = Number(economy.fortunePricing?.[type]) || 50;
        const extraQuestionPrice = Number(economy.fortunePricing?.extraQuestion) || 10;
        const priorityFee = Number(economy.fortunePricing?.priorityFee) || 20;
        
        let extraQuestionsCost = 0;
        if (Array.isArray(questions) && questions.length > 3) {
          extraQuestionsCost = (questions.length - 3) * extraQuestionPrice;
        }
        
        const totalCost = basePrice + extraQuestionsCost + (priorityMode ? priorityFee : 0);

        // Check Balance
        if ((userData.mainCoins || 0) < totalCost) {
          throw new Error("Insufficient balance");
        }

        // Deduct Balance
        transaction.update(userRef, {
          mainCoins: admin.firestore.FieldValue.increment(-totalCost)
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
      res.status(500).json({ error: error.message });
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

      // Prepare Prompt
      const systemInstruction = `
        Sen LASYA isminde mistik, bilge ve sezgileri kuvvetli bir kahinsin. 
        Kullanıcının verdiği bilgileri ve sembolleri yorumlayarak onlara gelecekten haberler veriyorsun.
        Dilin mistik, etkileyici ama anlaşılır olmalı. 
        Kullanıcıya ismiyle hitap et.
        Yorumun mutlaka şu cümleyle başla: "Merhaba tekrardan hoşgeldin, şimdi hemen falına geçelim..."
        Yorumunu mutlaka şu cümleyle bitir: "Falın bu kadardı sabrın için teşekkür ederim."
        TÜM YORUMUN TEK BİR PARAGRAF OLMALI, SATIR ATLAMA KESİNLİKLE YASAK.
      `;

      const userPrompt = `
        Kullanıcı Bilgileri:
        Ad Soyad: ${reading.formData.adSoyad}
        Doğum Tarihi: ${reading.formData.dogumTarihi}
        İlişki Durumu: ${reading.formData.iliskiDurumu}
        Tür: ${reading.type}
        Sorular: ${reading.questions?.join(", ") || "Genel yorum"}
        Kartlar: ${reading.cards?.join(", ") || "Yok"}
        Görsel Sayısı: ${reading.images?.length || 0}
        
        Lütfen bu bilgilere göre detaylı bir fal yorumu yap.
      `;

      // Call Gemini
      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
        }
      });

      const content = result.text || "Yıldızlar şu an biraz bulanık, lütfen daha sonra tekrar deneyin.";

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
        if (!readingSnap.exists) throw new Error("Reading not found");
        const reading = readingSnap.data() as any;

        if (reading.userId !== userId) throw new Error("Unauthorized");
        if (reading.priorityMode) throw new Error("Already in priority mode");

        const economySnap = await transaction.get(economyRef);
        const priorityFee = economySnap.data()?.fortunePricing?.priorityFee || 20;

        const userSnap = await transaction.get(userRef);
        const userData = userSnap.data() as any;

        if ((userData.mainCoins || 0) < priorityFee) {
          throw new Error("Insufficient balance");
        }

        // Deduct Fee
        transaction.update(userRef, {
          mainCoins: admin.firestore.FieldValue.increment(-priorityFee)
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
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
