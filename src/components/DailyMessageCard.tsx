import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Heart, Briefcase, Star, Loader2 } from "lucide-react";
import { DailyMessage, AppConfig } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

const MESSAGES: { text: string; category: 'love' | 'career' | 'general' }[] = [
  { text: "Ruhun, evrenin sonsuz bilgeliğiyle konuşuyor. Bugün sessizliği dinle, cevaplar orada saklı.", category: 'general' },
  { text: "Kalbinin kapılarını arala, beklediğin o sıcak esinti çok yakında hayatına girecek.", category: 'love' },
  { text: "Emeklerinin karşılığını alma vakti geldi. Kariyerinde parlayacağın bir döneme giriyorsun.", category: 'career' },
  { text: "Yıldızlar bugün senin için diziliyor. Şansın ve bereketin arttığı bir gün seni bekliyor.", category: 'general' },
  { text: "Geçmişin yüklerini bırak, gelecek sana yepyeni ve tertemiz bir sayfa açıyor.", category: 'general' },
];

interface DailyMessageCardProps {
  config: AppConfig | null;
  compact?: boolean;
}

export default function DailyMessageCard({ config, compact }: DailyMessageCardProps) {
  const [message, setMessage] = useState<DailyMessage | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('daily_message');
    const today = new Date().toDateString();

    if (saved) {
      const parsed = JSON.parse(saved) as DailyMessage;
      if (parsed.date === today) {
        setMessage(parsed);
        return;
      }
    }

    // Initial state: not revealed
    const newMessage: DailyMessage = {
      text: "",
      category: 'general',
      revealed: false,
      date: today
    };
    setMessage(newMessage);
  }, []);

  const handleReveal = async () => {
    if (!message || message.revealed || isGenerating) return;
    
    setIsGenerating(true);
    setShowOverlay(true);

    // Play sound
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
      audio.volume = 0.5;
      audio.play();
    } catch (e) {
      console.error("Audio play failed", e);
    }

    try {
      let text = "";
      let category: 'love' | 'career' | 'general' = 'general';

      if (config?.dailyMessagePrompt) {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("Gemini API key is missing");
        }
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: config.dailyMessagePrompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                category: { type: Type.STRING, enum: ["love", "career", "general"] }
              },
              required: ["text", "category"]
            }
          }
        });
        const result = JSON.parse(response.text || "{}");
        text = result.text || MESSAGES[0].text;
        category = result.category || 'general';
      } else {
        const random = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        text = random.text;
        category = random.category;
      }

      setTimeout(() => {
        const updated = { ...message, text, category, revealed: true };
        setMessage(updated);
        localStorage.setItem('daily_message', JSON.stringify(updated));
        setShowOverlay(false);
        setIsGenerating(false);
      }, 2000);

    } catch (error) {
      console.error("Daily message generation failed:", error);
      const random = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
      const updated = { ...message, text: random.text, category: random.category, revealed: true };
      setMessage(updated);
      localStorage.setItem('daily_message', JSON.stringify(updated));
      setShowOverlay(false);
      setIsGenerating(false);
    }
  };

  if (!message) return null;

  if (compact) {
    return (
      <motion.div
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleReveal}
        className={`relative h-full p-5 rounded-[2rem] border transition-all duration-700 cursor-pointer overflow-hidden flex flex-col justify-between ${
          message.revealed 
            ? "border-amber-500/20 bg-gradient-to-br from-amber-900/20 to-transparent backdrop-blur-xl" 
            : "border-purple-500/10 bg-black/40 hover:border-purple-500/30"
        }`}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Sparkles className="w-12 h-12 text-amber-400" />
        </div>
        
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <h4 className="text-xs font-serif font-bold text-amber-50">Günün Mesajı</h4>
        </div>

        {message.revealed ? (
          <p className="text-[10px] text-amber-200/60 leading-relaxed line-clamp-3 italic">
            "{message.text}"
          </p>
        ) : (
          <div className="flex items-center gap-2 text-amber-400/60">
            <div className="w-1 h-1 rounded-full bg-amber-400 animate-ping" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Dokun ve Gör</span>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <section className="px-2">
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl"
          >
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(30)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: "50vw", 
                    y: "50vh", 
                    scale: 0,
                    opacity: 1
                  }}
                  animate={{ 
                    x: `${Math.random() * 100}vw`, 
                    y: `${Math.random() * 100}vh`,
                    scale: Math.random() * 2 + 1,
                    opacity: 0
                  }}
                  transition={{ 
                    duration: 2,
                    ease: "easeOut",
                    delay: Math.random() * 0.5
                  }}
                  className="absolute"
                >
                  <Sparkles className="w-8 h-8 text-amber-400" />
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="text-center z-10"
            >
              <div className="w-24 h-24 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-6 mx-auto">
                <Star className="w-12 h-12 text-amber-400 animate-pulse" />
              </div>
              <h2 className="text-3xl font-serif font-bold text-amber-50 mb-2">Evren Konuşuyor...</h2>
              <p className="text-purple-200/60 tracking-widest uppercase text-xs">Mesajın Hazırlanıyor</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <h3 className="text-xs font-bold uppercase tracking-widest text-purple-200/40">Bugün Senin İçin Mesaj</h3>
      </div>

      <motion.div
        layout
        onClick={handleReveal}
        className={`relative p-8 rounded-[2rem] border transition-all duration-700 cursor-pointer overflow-hidden ${
          message.revealed 
            ? "border-amber-500/20 bg-black/60 shadow-2xl shadow-amber-900/10" 
            : "border-purple-500/10 bg-black/40 hover:border-purple-500/30"
        }`}
      >
        <AnimatePresence mode="wait">
          {!message.revealed ? (
            <motion.div
              key="hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-4"
            >
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl"
                />
                <Star className="w-12 h-12 text-amber-400/40 relative z-10" />
              </div>
              <p className="text-sm font-serif italic text-purple-200/60 text-center">
                Günün mesajını öğrenmek ister misin?
              </p>
              <motion.span
                animate={{ y: [0, 4, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400/60"
              >
                Dokun ve Keşfet
              </motion.span>
            </motion.div>
          ) : (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10"
            >
              {/* Floating Particles based on category */}
              <div className="absolute inset-0 pointer-events-none">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ 
                      x: Math.random() * 200 - 100, 
                      y: Math.random() * 100 - 50, 
                      opacity: 0,
                      scale: 0
                    }}
                    animate={{ 
                      y: -150, 
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0.5],
                      rotate: 360
                    }}
                    transition={{ 
                      duration: 3 + Math.random() * 2, 
                      repeat: Infinity,
                      delay: i * 0.5
                    }}
                    className="absolute left-1/2 top-1/2"
                  >
                    {message.category === 'love' && <Heart className="w-4 h-4 text-red-400/40" />}
                    {message.category === 'career' && <Briefcase className="w-4 h-4 text-blue-400/40" />}
                    {message.category === 'general' && <Sparkles className="w-4 h-4 text-amber-400/40" />}
                  </motion.div>
                ))}
              </div>

              <p className="text-xl font-serif italic text-amber-100/90 leading-relaxed text-center">
                "{message.text}"
              </p>
              <div className="mt-6 flex justify-center">
                <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Background Glow */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${
          message.revealed ? "opacity-10" : "opacity-0"
        }`}>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-amber-500/20 via-transparent to-purple-500/20" />
        </div>
      </motion.div>
    </section>
  );
}
