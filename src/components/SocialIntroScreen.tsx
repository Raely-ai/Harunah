import { motion } from "motion/react";
import { Sparkles, Heart, Zap, MessageCircle, ArrowRight } from "lucide-react";

interface SocialIntroScreenProps {
  onBack: () => void;
  onContinue: () => void;
}

export default function SocialIntroScreen({ onBack, onContinue }: SocialIntroScreenProps) {
  return (
    <div className="relative h-[100dvh] w-full bg-[#F6F4F8] text-heading overflow-hidden flex flex-col select-none touch-none">
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[80%] h-[80%] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[80%] h-[80%] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-lg mx-auto w-full">
        <div className="w-full space-y-8 sm:space-y-12">
          {/* Animated Icon Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="relative flex justify-center"
          >
            <div className="w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center relative z-10">
              <img 
                src="/logo.svg" 
                alt="LASYA Logo" 
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(99,102,241,0.1)]"
              />
            </div>
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.1, 0.2] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute inset-0 border border-indigo-500/10 rounded-full -m-2 z-0" 
            />
          </motion.div>

          {/* Typography Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4 sm:space-y-6"
          >
            <h1 className="text-3xl sm:text-5xl font-serif font-bold leading-tight tracking-tight text-heading">
              Frekansların <br />
              <span className="text-indigo-600 italic">Buluşma Noktası</span>
            </h1>

            <p className="text-sm sm:text-base text-body leading-relaxed max-w-[260px] sm:max-w-[320px] mx-auto">
              Ruhunun enerjisini yansıtan özel bir topluluğa davetlisin.
            </p>
          </motion.div>

          {/* Value Propositions */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 gap-3 sm:gap-4 w-full"
          >
            {[
              { icon: Zap, text: "Enerjinle tam uyumlu kişiler", color: "text-amber-600", bg: "bg-amber-500/10" },
              { icon: Heart, text: "Aşk, dostluk ve derin sohbetler", color: "text-rose-600", bg: "bg-rose-500/10" },
              { icon: MessageCircle, text: "Sana en yakın frekanstaki insanlar", color: "text-indigo-600", bg: "bg-indigo-500/10" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-white border border-black/5 text-left shadow-sm">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${item.bg} flex items-center justify-center ${item.color} shrink-0`}>
                  <item.icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="text-sm sm:text-base font-medium text-body">{item.text}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </main>

      {/* Action Area */}
      <footer className="relative z-10 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:p-8 sm:pb-12 space-y-4 max-w-lg mx-auto w-full flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onContinue}
          className="w-full py-5 sm:py-6 rounded-2xl bg-indigo-600 text-white font-bold text-base sm:text-lg shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group"
        >
          Hemen Başla
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </motion.button>
        
        <button 
          onClick={onBack}
          className="w-full py-1 text-muted font-semibold text-xs sm:text-sm hover:text-body transition-colors"
        >
          Şimdilik Vazgeç
        </button>
      </footer>
    </div>
  );
}
