import { motion } from "motion/react";
import { Sparkles, ArrowRight } from "lucide-react";

interface WelcomeScreenProps {
  onNavigate: (screen: 'login' | 'register') => void;
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-8 bg-[#050505] overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-900/5 rounded-full blur-[120px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative mb-12"
        >
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-amber-500/20 rounded-full blur-2xl" />
            <img 
              src="/logo.svg" 
              alt="LASYA Logo" 
              className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(212,175,55,0.3)]"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center"
        >
          <h1 className="text-5xl font-serif font-bold tracking-tighter text-amber-50 mb-4">
            LASYA
          </h1>
          <p className="text-lg text-purple-200/40 font-medium leading-relaxed">
            Kaderinin fısıltılarını duyma vaktin geldi. Mistik bir yolculuğa hazır mısın?
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 1 }}
        className="w-full max-w-sm space-y-4 relative z-10 pb-12"
      >
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('login')}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-lg shadow-2xl shadow-amber-900/20 flex items-center justify-center gap-3"
        >
          <span>Hemen Başla</span>
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        <button
          onClick={() => onNavigate('register')}
          className="w-full py-5 rounded-2xl border border-white/10 bg-white/5 text-purple-100 font-bold hover:bg-white/10 transition-all"
        >
          Kayıt Ol
        </button>
      </motion.div>
    </div>
  );
}
