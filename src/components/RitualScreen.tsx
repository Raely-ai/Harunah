import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Clock, Zap, ShieldCheck, Stars, CheckCircle2 } from "lucide-react";
import { FortuneType, FortuneReading } from "../types";

interface RitualScreenProps {
  type: FortuneType;
  reading?: FortuneReading;
  onClose: () => void;
}

const STATUS_STEPS = [
  { id: 'energy', text: 'Enerji toplanıyor...', icon: Stars, color: 'text-amber-400' },
  { id: 'connect', text: 'Yorumcu bağlanıyor...', icon: Zap, color: 'text-purple-400' },
  { id: 'interpret', text: 'Yorumlanıyor...', icon: Sparkles, color: 'text-emerald-400' }
];

export default function RitualScreen({ type, reading, onClose }: RitualScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showDensityMessage, setShowDensityMessage] = useState(false);

  useEffect(() => {
    if (!reading || !reading.queueStartedAt || !reading.expectedReadyAt) {
      // Fallback for old readings or missing data
      const energyTimer = setTimeout(() => setCurrentStep(1), 3500);
      const connectTimer = setTimeout(() => setCurrentStep(2), 8000);
      const densityTimer = setTimeout(() => setShowDensityMessage(true), 15000);
      return () => {
        clearTimeout(energyTimer);
        clearTimeout(connectTimer);
        clearTimeout(densityTimer);
      };
    }

    const updateStatus = () => {
      const now = new Date().getTime();
      const start = new Date(reading.queueStartedAt!).getTime();
      const interpretStart = reading.interpretationStartedAt ? new Date(reading.interpretationStartedAt).getTime() : start + 5000;
      const end = new Date(reading.expectedReadyAt!).getTime();
      
      const totalDuration = end - start;
      const elapsed = now - start;
      const currentProgress = Math.min(Math.max((elapsed / totalDuration) * 100, 0), 100);
      
      setProgress(currentProgress);

      if (now < interpretStart) {
        setCurrentStep(0); // Energy
      } else if (now < (interpretStart + (end - interpretStart) / 2)) {
        setCurrentStep(1); // Connect
      } else {
        setCurrentStep(2); // Interpret
      }

      if (elapsed > 15000) {
        setShowDensityMessage(true);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, [reading]);

  const currentStatus = STATUS_STEPS[currentStep];
  const Icon = currentStatus.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12 text-center space-y-12"
    >
      {/* Mystical Animation Center */}
      <div className="relative">
        {/* Outer Rotating Rings Simplified */}
        <div className="w-64 h-64 rounded-full border border-dashed border-white/10 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full border border-dashed border-amber-500/20 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full border border-purple-500/30" />
          </div>
        </div>

        {/* Floating Icons based on type */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStatus.id}
              initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 1.5, opacity: 0, rotate: 45 }}
              transition={{ type: "spring", damping: 12 }}
              className={`p-8 rounded-full bg-white/5 backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.05)] ${currentStatus.color}`}
            >
              <Icon className="w-16 h-16" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Orbiting Particles Removed */}
      </div>

      {/* Status Text Area */}
      <div className="space-y-6 max-w-xs mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStatus.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            <h2 className={`text-2xl font-serif font-bold tracking-wide ${currentStatus.color}`}>
              {currentStatus.text}
            </h2>
            <p className="text-purple-200/40 text-sm leading-relaxed italic">
              {currentStep === 0 && "Evrenin frekansları senin için hizalanıyor..."}
              {currentStep === 1 && "LASYA'nın en bilge yorumcuları enerjine odaklanıyor..."}
              {currentStep === 2 && "Semboller ve yıldızlar geleceğin kapılarını aralıyor..."}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Progress Bar Experience */}
        <div className="pt-4 space-y-4">
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className={`h-full bg-gradient-to-r from-amber-600 to-amber-400`}
              initial={{ width: "0%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/20">
            <ShieldCheck className="w-3 h-3" />
            <span>Güvenli & Mistik Bağlantı</span>
          </div>
        </div>
      </div>

      {/* Density Fallback Message */}
      <AnimatePresence>
        {showDensityMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl max-w-xs mx-auto"
          >
            <div className="flex items-center gap-3 text-amber-400/80 text-xs font-medium text-left">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <p>Şu an yoğunluk var, enerjine odaklanılıyor. Lütfen ayrılma, kehanetin hazırlanıyor.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Button */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        onClick={onClose}
        className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-amber-50 font-bold text-sm hover:bg-white/10 transition-all flex items-center gap-2 group"
      >
        <span>Anladım, Bekliyorum</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </motion.button>
    </motion.div>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
  );
}
