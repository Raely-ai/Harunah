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

const db = getFirestore(firebaseApp);
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
      const reading = doc.data();
      await doc.ref.update({ status: 'interpreting', updatedAt: now });
      
      // Notify
      await db.collection("notifications").add({
        userId: reading.userId,
        type: 'system',
        title: 'Falınız Yorumlanıyor',
        message: `${reading.title} yorumunuz LASYA tarafından hazırlanıyor.`,
        read: false,
        createdAt: now,
        data: { readingId: doc.id }
      });
    }

    // 3. Interpreting -> Completed
    const interpretingReadings = await db.collection("readings")
      .where("status", "==", "interpreting")
      .where("expectedCompletedAt", "<=", now)
      .limit(10)
      .get();

    for (const doc of interpretingReadings.docs) {
      const reading = doc.data();
      if (reading.isAIGenerated && reading.hiddenResult) {
        await doc.ref.update({ 
          status: 'completed', 
          content: reading.hiddenResult,
          resultText: reading.hiddenResult,
          updatedAt: now 
        });
        
        // Notify
        await db.collection("notifications").add({
          userId: reading.userId,
          type: 'system',
          title: 'Falınız Hazır!',
          message: `${reading.title} yorumunuz tamamlandı. Hemen inceleyin!`,
          read: false,
          createdAt: now,
          data: { readingId: doc.id }
        });
      }
    }
  } catch (error) {
    // Silent error in preview to avoid cluttering logs if permissions are missing
    if (process.env.NODE_ENV === 'production') {
      console.error("Background task error:", error);
    }
  }
}

// Run background task in both production and preview to ensure timing works
// If it fails due to permissions in preview, it will be silent
setInterval(updateReadingStatuses, 30000); // Every 30 seconds

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
    // This endpoint is now deprecated in favor of Firebase Functions
    res.status(410).json({ error: "Bu endpoint kullanımdan kaldırıldı. Lütfen Firebase Functions kullanın." });
  });

  // 2. Process Fortune AI (Gemini)
  app.post("/api/fortune/process", authenticate, async (req: any, res) => {
    // This endpoint is now deprecated in favor of Firebase Functions
    res.status(410).json({ error: "Bu endpoint kullanımdan kaldırıldı. Lütfen Firebase Functions kullanın." });
  });

  // 3. Upgrade Fortune Priority
  app.post("/api/fortune/upgrade", authenticate, async (req: any, res) => {
    // This endpoint is now deprecated in favor of Firebase Functions
    res.status(410).json({ error: "Bu endpoint kullanımdan kaldırıldı. Lütfen Firebase Functions kullanın." });
  });

  // 4. Daily Message
  app.post("/api/daily-message", authenticate, async (req: any, res) => {
    // This endpoint is now deprecated in favor of Firebase Functions
    res.status(410).json({ error: "Bu endpoint kullanımdan kaldırıldı. Lütfen Firebase Functions kullanın." });
  });

  // --- Wallet Endpoints (DEPRECATED) ---

  app.post("/api/wallet/watch-ad", authenticate, (req, res) => res.status(410).json({ error: "Deprecated" }));
  app.post("/api/wallet/purchase-coins", authenticate, (req, res) => res.status(410).json({ error: "Deprecated" }));
  app.post("/api/wallet/spend-balance", authenticate, (req, res) => res.status(410).json({ error: "Deprecated" }));
  app.post("/api/wallet/purchase-social-item", authenticate, (req, res) => res.status(410).json({ error: "Deprecated" }));
  app.post("/api/wallet/purchase-social-bundle", authenticate, (req, res) => res.status(410).json({ error: "Deprecated" }));
  app.post("/api/wallet/consume-social-feature", authenticate, (req, res) => res.status(410).json({ error: "Deprecated" }));
  app.post("/api/wallet/buy-fortune-subscription", authenticate, (req, res) => res.status(410).json({ error: "Deprecated" }));
  app.post("/api/wallet/buy-social-subscription", authenticate, (req, res) => res.status(410).json({ error: "Deprecated" }));

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
