import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, Sparkles, Heart, Briefcase } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { AppConfig } from '../types';

interface DailyMessageCardProps {
  config: AppConfig | null;
}

interface DailyMessage {
  text: string;
  category: 'love' | 'career' | 'general';
  revealed: boolean;
  timestamp: number;
}

export default function DailyMessageCard({ config }: DailyMessageCardProps) {
  const [message, setMessage] = useState<DailyMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedMessage = localStorage.getItem('daily_message');
    if (savedMessage) {
      const parsed = JSON.parse(savedMessage);
      const today = new Date().setHours(0, 0, 0, 0);
      const messageDate = new Date(parsed.timestamp).setHours(0, 0, 0, 0);
      
      if (today === messageDate) {
        setMessage(parsed);
        return;
      }
    }
    generateNewMessage();
  }, []);

  const generateNewMessage = async () => {
    setLoading(true);
    setError(null);
    try {
      const generateFn = httpsCallable(functions, 'generateDailyMessage');
      const result = await generateFn();
      const { text, category } = result.data as any;
      
      const newMessage: DailyMessage = {
        text,
        category,
        revealed: false,
        timestamp: Date.now()
      };

      setMessage(newMessage);
      localStorage.setItem('daily_message', JSON.stringify(newMessage));
    } catch (err) {
      console.error("Daily message error:", err);
      setError("Yıldızlarla bağlantı kurulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const handleReveal = () => {
    if (!message || message.revealed) return;
    
    const updated = { ...message, revealed: true };
    setMessage(updated);
    localStorage.setItem('daily_message', JSON.stringify(updated));
  };

  if (loading) {
    return (
      <div className="p-8 rounded-[2rem] border border-white/5 bg-black/40 animate-pulse flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-white/5" />
        <div className="h-4 w-32 bg-white/5 rounded" />
      </div>
    );
  }

  if (!message) return null;

  return (
    <section className="relative">
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
