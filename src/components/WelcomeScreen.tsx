import { motion } from "motion/react";
import { Sparkles, ArrowRight } from "lucide-react";

interface WelcomeScreenProps {
  onNavigate: (screen: 'login' | 'register') => void;
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-8 bg-[#F8F9FB] overflow-hidden relative">
      {/* Immersive Background - subtle and clean */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[80%] bg-amber-100/40 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[80%] bg-purple-100/30 rounded-full blur-[120px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative mb-12"
        >
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 bg-white rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100" />
            <img 
              src="/logo.svg" 
              alt="LASYA Logo" 
              className="w-20 h-20 object-contain relative z-10 grayscale-[0.2]"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-center"
        >
          <h1 className="text-6xl font-serif font-bold tracking-tighter text-slate-900 mb-4">
            LASYA
          </h1>
          <p className="text-lg text-slate-500 font-medium leading-relaxed px-4">
            Kaderinin fısıltılarını duyma vaktin geldi. Mistik bir yolculuğa hazır mısın?
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="w-full max-w-sm space-y-4 relative z-10 pb-12"
      >
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onNavigate('login')}
          className="w-full py-5 rounded-2xl bg-slate-900 text-white font-bold text-lg shadow-xl shadow-slate-200 flex items-center justify-center gap-3"
        >
          <span>Hemen Başla</span>
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        <button
          onClick={() => onNavigate('register')}
          className="w-full py-5 rounded-2xl border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 transition-all"
        >
          Kayıt Ol
        </button>
      </motion.div>
    </div>
  );
}
