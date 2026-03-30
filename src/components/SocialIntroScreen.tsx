import { motion } from "motion/react";
import { Sparkles, ChevronLeft, Heart, Zap, MessageCircle } from "lucide-react";

interface SocialIntroScreenProps {
  onBack: () => void;
  onContinue: () => void;
}

export default function SocialIntroScreen({ onBack, onContinue }: SocialIntroScreenProps) {
  return (
    <div className="h-full w-full bg-white text-slate-900 overflow-y-auto flex flex-col relative overscroll-behavior-y-contain">
      {/* Background Effects - Premium Light Theme */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-indigo-50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-50 rounded-full blur-[120px]" />
        
        {/* Subtle Floating Elements */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.1, y: Math.random() * 100 + "%", x: Math.random() * 100 + "%" }}
            animate={{ 
              opacity: [0.1, 0.2, 0.1],
              y: ["-10%", "110%"],
            }}
            transition={{ 
              duration: 25 + Math.random() * 20, 
              repeat: Infinity, 
              ease: "linear",
            }}
            className="absolute w-2 h-2 bg-indigo-200/30 rounded-full"
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center flex-shrink-0">
        <motion.button 
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
      </header>

      {/* Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 text-center max-w-lg mx-auto py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center mb-10 shadow-xl shadow-indigo-500/5 relative group"
        >
          <Sparkles className="w-12 h-12 text-indigo-500 relative z-10" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          <h1 className="text-4xl sm:text-5xl font-serif font-bold leading-tight tracking-tight text-slate-900">
            Herkesle tanışamazsın…
            <span className="block italic text-indigo-600 mt-2">Ama doğru enerji seni bulur.</span>
          </h1>

          <div className="space-y-4">
            <p className="text-lg text-slate-600 leading-relaxed">
              Burada insanlar fotoğraflarıyla değil, <br />
              <span className="text-indigo-600 font-semibold">uyumlarıyla ve enerjileriyle</span> <br />
              karşına çıkar.
            </p>

            <p className="text-sm text-slate-400 leading-relaxed italic max-w-xs mx-auto">
              Aşk, dostluk ya da sadece sohbet… <br />
              Ne arıyorsan sistem seni ona yaklaştırır.
            </p>
          </div>
        </motion.div>

        {/* Feature Icons */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex gap-10 mt-16"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 shadow-sm">
              <Heart className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Aşk</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 shadow-sm">
              <MessageCircle className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sohbet</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shadow-sm">
              <Zap className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Enerji</span>
          </div>
        </motion.div>
      </main>

      {/* Footer Actions */}
      <footer className="relative z-10 p-8 pb-12 space-y-4 max-w-lg mx-auto w-full flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onContinue}
          className="w-full py-5 rounded-2xl bg-slate-900 text-white font-bold text-lg shadow-xl shadow-slate-900/10 hover:bg-slate-800 transition-all"
        >
          Devam Et
        </motion.button>
        
        <button 
          onClick={onBack}
          className="w-full py-2 text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors tracking-widest uppercase"
        >
          Geri Dön
        </button>
      </footer>
    </div>
  );
}
