import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Clock, Zap, ShieldCheck, Stars, CheckCircle2, Search, User, Loader2, ArrowRight, MessageCircle } from "lucide-react";
import { FortuneType, FortuneReading } from "../types";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { functions, auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
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

const THEMES: Record<string, {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
  bg: string;
  border: string;
  glow: string;
  pattern: string;
}> = {
  water: {
    primary: 'cyan-600',
    secondary: 'blue-500',
    accent: 'cyan-400',
    gradient: 'from-cyan-600 to-blue-500',
    bg: 'bg-cyan-50/30',
    border: 'border-cyan-100',
    glow: 'shadow-cyan-500/20',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
  },
  ebced: {
    primary: 'rose-500',
    secondary: 'pink-500',
    accent: 'rose-400',
    gradient: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-50/30',
    border: 'border-rose-100',
    glow: 'shadow-rose-500/20',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/pinstripe.png')]"
  },
  yildizname: {
    primary: 'amber-600',
    secondary: 'yellow-600',
    accent: 'amber-400',
    gradient: 'from-amber-600 to-yellow-600',
    bg: 'bg-amber-50/30',
    border: 'border-amber-100',
    glow: 'shadow-amber-500/20',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"
  },
  havas: {
    primary: 'emerald-700',
    secondary: 'emerald-600',
    accent: 'emerald-500',
    gradient: 'from-emerald-800 to-emerald-600',
    bg: 'bg-emerald-50/30',
    border: 'border-emerald-100',
    glow: 'shadow-emerald-500/20',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]"
  },
  coffee: {
    primary: 'amber-700',
    secondary: 'amber-600',
    accent: 'amber-500',
    gradient: 'from-amber-700 to-amber-500',
    bg: 'bg-amber-50/30',
    border: 'border-amber-100',
    glow: 'shadow-amber-500/20',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"
  },
  tarot: {
    primary: 'indigo-600',
    secondary: 'purple-600',
    accent: 'indigo-400',
    gradient: 'from-indigo-600 to-purple-600',
    bg: 'bg-indigo-50/30',
    border: 'border-indigo-100',
    glow: 'shadow-indigo-500/20',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"
  }
};

export default function RitualScreen({ type, reading: initialReading, onClose, onSocialClick }: RitualScreenProps) {
  const theme = THEMES[type] || THEMES.tarot;
  const [reading, setReading] = useState<FortuneReading | undefined>(initialReading);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [showPriorityOption, setShowPriorityOption] = useState(false);

  // Sync with Firestore for real-time status updates
  useEffect(() => {
    if (!initialReading?.id) return;
    const unsubscribe = onSnapshot(doc(db, "readings", initialReading.id), (snapshot) => {
      if (snapshot.exists()) {
        setReading({ id: snapshot.id, ...snapshot.data() } as FortuneReading);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `readings/${initialReading.id}`);
    });
    return () => unsubscribe();
  }, [initialReading?.id]);

  useEffect(() => {
    if (reading?.status === 'searching' && !reading.priorityMode) {
      const timer = setTimeout(() => setShowPriorityOption(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [reading]);

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
      className="flex flex-col items-center justify-center py-12 text-center space-y-12 relative min-h-[60vh]"
    >
      {/* Subtle Background Texture */}
      <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${theme.pattern}`} />

      {/* Mystical Animation Center */}
      <div className="relative">
        <div className="w-64 h-64 rounded-full border border-dashed border-black/5 flex items-center justify-center">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className={`absolute inset-0 border border-dashed border-${theme.primary}/10 rounded-full`} 
          />
          <div className={`w-48 h-48 rounded-full border border-dashed border-${theme.primary}/10 flex items-center justify-center`}>
            <div className={`w-32 h-32 rounded-full border border-${theme.primary}/10`} />
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
              className={`p-8 rounded-full bg-white border border-black/5 shadow-2xl text-${theme.primary}`}
            >
              <Icon className="w-16 h-16" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Status Text Area */}
      <div className="space-y-6 max-w-xs mx-auto relative z-10">
        <div className="space-y-3">
          <h2 className={`text-2xl font-serif font-bold tracking-wide text-${theme.primary}`}>
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
              className={`${theme.bg} border ${theme.border} p-6 rounded-3xl space-y-4 shadow-sm`}
            >
              <div className="flex items-center gap-3 text-left">
                <div className={`w-10 h-10 rounded-full bg-white flex items-center justify-center text-${theme.primary}`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <p className={`text-xs font-bold text-${theme.primary} uppercase tracking-widest`}>Sıra Bekleme!</p>
                  <p className="text-[10px] text-muted">Ek bakiye kullanarak öncelikli sıraya geçebilirsin.</p>
                </div>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={isUpgrading}
                className={`w-full py-3 rounded-xl bg-${theme.primary} text-white font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-md`}
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
              className={`flex items-center gap-2 mx-auto text-[10px] font-bold uppercase tracking-widest text-${theme.primary} hover:opacity-80 transition-colors`}
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
              className={`h-full bg-gradient-to-r ${theme.gradient}`}
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
        className={`px-10 py-4 rounded-2xl bg-white border border-black/5 text-heading font-bold text-sm hover:bg-black/5 transition-all flex items-center gap-2 group shadow-lg`}
      >
        <span>{currentStatus === 'completed' ? 'Yorumu Oku' : 'Anladım, Bekliyorum'}</span>
        <ArrowRight className={`w-4 h-4 group-hover:translate-x-1 transition-transform text-${theme.primary}`} />
      </motion.button>
    </motion.div>
  );
}
