import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Clock, Zap, ShieldCheck, Stars, CheckCircle2, Search, User, Loader2, ArrowRight, MessageCircle } from "lucide-react";
import { FortuneType, FortuneReading } from "../types";
import { httpsCallable } from "firebase/functions";
import { doc, updateDoc } from "firebase/firestore";
import { functions, auth, db } from "../lib/firebase";
import { toast } from "sonner";

interface RitualScreenProps {
  type: FortuneType;
  reading?: FortuneReading;
  onClose: () => void;
  onSocialClick?: () => void;
}

const STATUS_CONFIG = {
  searching: { label: 'Yorumcu Aranıyor', text: 'Sana en uygun yorumcu aranıyor...', icon: Search, color: 'text-purple-400' },
  found: { label: 'Yorumcu Bulundu', text: 'Mistik bir bağ kuruldu, yorumcu hazır!', icon: User, color: 'text-indigo-400' },
  interpreting: { label: 'Yorumlanıyor', text: 'Semboller ve yıldızlar geleceğin kapılarını aralıyor...', icon: Sparkles, color: 'text-emerald-400' },
  completed: { label: 'Yorumlandı', text: 'Kehanetin hazır, hemen incele!', icon: CheckCircle2, color: 'text-amber-400' },
  error: { label: 'Hata', text: 'Bir sorun oluştu, lütfen tekrar dene.', icon: Clock, color: 'text-red-400' }
};

export default function RitualScreen({ type, reading, onClose, onSocialClick }: RitualScreenProps) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showPriorityOption, setShowPriorityOption] = useState(false);
  const [isAIProcessing, setIsAIProcessing] = useState(false);

  useEffect(() => {
    if (reading?.status === 'searching' && !reading.priorityMode) {
      const timer = setTimeout(() => setShowPriorityOption(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [reading]);

  // Simulate status flow and trigger AI
  useEffect(() => {
    if (!reading || isAIProcessing) return;

    // Only trigger if status is one that needs progression
    if (!['searching', 'found', 'interpreting'].includes(reading.status)) return;

    const runFlow = async () => {
      const now = new Date();
      const expectedReaderFoundAt = reading.expectedReaderFoundAt ? new Date(reading.expectedReaderFoundAt) : null;
      const interpretationStartedAt = reading.interpretationStartedAt ? new Date(reading.interpretationStartedAt) : null;
      const expectedCompletedAt = reading.expectedCompletedAt ? new Date(reading.expectedCompletedAt) : null;

      setIsAIProcessing(true);
      try {
        // 1. Searching -> Found
        if (reading.status === 'searching' && expectedReaderFoundAt && now >= expectedReaderFoundAt) {
          await updateDoc(doc(db, "readings", reading.id), {
            status: 'found',
            updatedAt: now.toISOString()
          });
          setIsAIProcessing(false);
          return;
        }

        // 2. Found -> Interpreting
        if (reading.status === 'found' && interpretationStartedAt && now >= interpretationStartedAt) {
          await updateDoc(doc(db, "readings", reading.id), {
            status: 'interpreting',
            updatedAt: now.toISOString()
          });
          setIsAIProcessing(false);
          return;
        }

        // 3. Interpreting -> Completed
        if (reading.status === 'interpreting' && expectedCompletedAt && now >= expectedCompletedAt) {
          // Only complete if AI has finished
          if (reading.isAIGenerated) {
            await updateDoc(doc(db, "readings", reading.id), {
              status: 'completed',
              updatedAt: now.toISOString()
            });
          }
        }
        
        // 4. Fallback for 'searching' feedback
        if (reading.status === 'searching' && (!expectedReaderFoundAt || now < expectedReaderFoundAt)) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error("AI Flow error:", error);
      } finally {
        setIsAIProcessing(false);
      }
    };

    // Run every 5 seconds while on this screen to check times
    const interval = setInterval(runFlow, 5000);
    runFlow(); // Initial run
    
    return () => clearInterval(interval);
  }, [reading?.status, reading?.id]);

  const handleUpgrade = async () => {
    if (!reading) return;
    setIsUpgrading(true);
    try {
      const upgradePriority = httpsCallable(functions, 'upgradeFortunePriority');
      await upgradePriority({ readingId: reading.id });
      
      toast.success("Öncelikli sıraya alındınız!");
      setShowPriorityOption(false);
    } catch (error: any) {
      toast.error(error.message || "Hata oluştu");
    } finally {
      setIsUpgrading(false);
    }
  };

  const currentStatus = reading?.status || 'searching';
  const config = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.searching;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center space-y-12"
    >
      {/* Mystical Animation Center */}
      <div className="relative">
        <div className="w-64 h-64 rounded-full border border-dashed border-black/5 flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border border-dashed border-amber-500/10 rounded-full" 
          />
          <div className="w-48 h-48 rounded-full border border-dashed border-amber-500/10 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border border-purple-500/10" />
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStatus}
              initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.5, opacity: 0, rotate: 45 }}
              transition={{ type: "spring", damping: 12 }}
              className={`p-8 rounded-full bg-white border border-black/5 shadow-2xl ${config.color.replace('400', '600')}`}
            >
              <Icon className="w-16 h-16" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Status Text Area */}
      <div className="space-y-6 max-w-xs mx-auto">
        <div className="space-y-3">
          <h2 className={`text-2xl font-serif font-bold tracking-wide ${config.color.replace('400', '600')}`}>
            {config.label}
          </h2>
          <p className="text-muted text-sm leading-relaxed italic">
            {config.text}
          </p>
        </div>

        {/* Priority Option */}
        <AnimatePresence>
          {showPriorityOption && currentStatus === 'searching' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-100 p-6 rounded-3xl space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest">Sıra Bekleme!</p>
                  <p className="text-[10px] text-muted">Ek bakiye kullanarak öncelikli sıraya geçebilirsin.</p>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className="w-full py-3 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>Öncelikli Sıraya Geç</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Social Suggestion */}
        {currentStatus === 'searching' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-4"
          >
            <button
              onClick={onSocialClick}
              className="flex items-center gap-2 mx-auto text-[10px] font-bold uppercase tracking-widest text-purple-600 hover:text-purple-700 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Bu sırada sosyalde gezin</span>
            </button>
          </motion.div>
        )}

        {/* Progress Bar Experience */}
        <div className="pt-4 space-y-4">
          <div className="h-1 w-full bg-black/5 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r from-amber-600 to-amber-400`}
              initial={{ width: "0%" }}
              animate={{ width: currentStatus === 'completed' ? '100%' : '60%' }}
              transition={{ duration: 2 }}
            />
          </div>
          
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40">
            <ShieldCheck className="w-3 h-3" />
            <span>Güvenli & Mistik Bağlantı</span>
          </div>
        </div>
      </div>

      {/* Action Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={onClose}
        className="px-10 py-4 rounded-2xl bg-white border border-black/5 text-heading font-bold text-sm hover:bg-black/5 transition-all flex items-center gap-2 group shadow-lg"
      >
        <span>{currentStatus === 'completed' ? 'Yorumu Oku' : 'Anladım, Bekliyorum'}</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </motion.button>
    </motion.div>
  );
}
