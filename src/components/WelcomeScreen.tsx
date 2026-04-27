import { motion } from "motion/react";
import { Sparkles, ArrowRight } from "lucide-react";

interface WelcomeScreenProps {
  onNavigate: (screen: 'login' | 'register') => void;
}

export default function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-8 bg-[#FAFAFA] relative overflow-hidden">
      {/* Soft Brand Auroras */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-400/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-400/10 rounded-full blur-[100px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full max-w-sm mt-12">
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative mb-10"
        >
          <div className="relative w-28 h-28 flex items-center justify-center drop-shadow-sm mx-auto">
            <div className="absolute -inset-6 bg-gradient-to-tr from-purple-500/15 to-amber-500/15 blur-[24px] rounded-full" />
            <img 
              src="assets/logo.png" 
              alt="LASYA Logo" 
              className="w-full h-full object-contain relative z-10"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h1 className="text-4xl font-serif font-bold tracking-[0.1em] text-slate-900 mb-4 uppercase">
            LASYA
          </h1>
          <p className="text-[15px] font-medium text-slate-500 leading-relaxed px-4">
            Astroloji, uyum ve içgörü dolu yepyeni bir deneyime hoş geldin.
          </p>
        </motion.div>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm space-y-4 relative z-10 pb-8"
      >
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onNavigate('login')}
          className="w-full py-4.5 rounded-2xl bg-slate-900 text-white font-semibold text-[15px] hover:shadow-[0_8px_25px_rgba(15,23,42,0.2)] transition-all flex items-center justify-center relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <span className="relative z-10 flex items-center justify-center gap-2">
            Giriş Yap <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
          </span>
        </motion.button>

        <button
          onClick={() => onNavigate('register')}
          className="w-full py-4.5 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold text-[15px] shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-slate-50 transition-all flex items-center justify-center"
        >
          Hesap Oluştur
        </button>
      </motion.div>
    </div>
  );
}
