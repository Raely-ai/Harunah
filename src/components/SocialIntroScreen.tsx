import { motion } from "motion/react";
import { Sparkles, Heart, Zap, MessageCircle, ArrowRight } from "lucide-react";

interface SocialIntroScreenProps {
  onBack: () => void;
  onContinue: () => void;
}

export default function SocialIntroScreen({ onBack, onContinue }: SocialIntroScreenProps) {
  return (
    <div className="h-full w-full bg-[#050505] text-white overflow-hidden flex flex-col relative select-none">
      {/* Background Gradient Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[80%] h-[80%] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center max-w-lg mx-auto">
        {/* Animated Icon Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="relative mb-12"
        >
          <div className="w-20 h-20 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl shadow-indigo-500/10 relative z-10">
            <Sparkles className="w-10 h-10 text-indigo-400" />
          </div>
          {/* Decorative rings */}
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.1, 0.2] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 border border-indigo-500/20 rounded-[2rem] -m-2 z-0" 
          />
          <motion.div 
            animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0.05, 0.1] }}
            transition={{ duration: 4, repeat: Infinity, delay: 1 }}
            className="absolute inset-0 border border-indigo-500/10 rounded-[2rem] -m-4 z-0" 
          />
        </motion.div>

        {/* Typography Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <h1 className="text-4xl sm:text-5xl font-serif font-bold leading-[1.1] tracking-tight text-white">
            Frekansların <br />
            <span className="text-indigo-400 italic">Buluşma Noktası</span>
          </h1>

          <p className="text-lg text-white/60 leading-relaxed max-w-[280px] mx-auto">
            Ruhunun enerjisini yansıtan özel bir topluluğa davetlisin.
          </p>
        </motion.div>

        {/* Value Propositions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 gap-4 mt-12 w-full"
        >
          {[
            { icon: Zap, text: "Enerjinle tam uyumlu kişiler", color: "text-amber-400", bg: "bg-amber-500/10" },
            { icon: Heart, text: "Aşk, dostluk ve derin sohbetler", color: "text-rose-400", bg: "bg-rose-500/10" },
            { icon: MessageCircle, text: "Sana en yakın frekanstaki insanlar", color: "text-indigo-400", bg: "bg-indigo-500/10" }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
              <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center ${item.color} shrink-0`}>
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-sm font-medium text-white/80">{item.text}</span>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Action Area */}
      <footer className="relative z-10 p-8 pb-12 space-y-4 max-w-lg mx-auto w-full flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onContinue}
          className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-bold text-lg shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group"
        >
          Hemen Başla
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </motion.button>
        
        <button 
          onClick={onBack}
          className="w-full py-2 text-white/40 font-semibold text-sm hover:text-white/60 transition-colors"
        >
          Şimdilik Vazgeç
        </button>
      </footer>
    </div>
  );
}
