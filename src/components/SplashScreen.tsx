import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FDFCFE]"
    >
      <div className="relative flex flex-col items-center">
        <div className="relative mb-8">
          {/* LASYA Logo */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-amber-500/10 rounded-full blur-2xl" />
            <img 
              src="/logo.svg" 
              alt="LASYA Logo" 
              className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(212,175,55,0.1)]"
            />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold tracking-[0.2em] text-heading uppercase">
            LASYA
          </h1>
        </div>
      </div>
    </motion.div>
  );
}
