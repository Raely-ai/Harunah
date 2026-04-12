import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { AppTab } from "../types";

interface SocialDisabledViewProps {
  onNavigate: (tab: AppTab) => void;
  title?: string;
  description?: string;
}

export default function SocialDisabledView({ 
  onNavigate, 
  title = "Sosyal Dünyaya Katıl ✨",
  description = "Enerjine uygun insanları keşfet, sohbet et ve uyumunu gör."
}: SocialDisabledViewProps) {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 overflow-hidden pointer-events-none">
      {/* Glassmorphism Card */}
      <motion.div 
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative w-full max-w-sm bg-white/10 backdrop-blur-[20px] border border-white/20 rounded-[2.5rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-col items-center text-center space-y-6 pointer-events-auto"
      >
        {/* Glow Effects */}
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-purple-500/20 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-amber-500/20 blur-[80px] rounded-full pointer-events-none" />

        {/* Icon / Sparkles */}
        <div className="relative">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full" 
          />
          <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 border border-white/20 flex items-center justify-center text-amber-500 shadow-2xl">
            <Sparkles className="w-10 h-10" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-2xl font-serif font-bold text-white tracking-tight drop-shadow-md">
            {title}
          </h3>
          <p className="text-white/70 text-sm leading-relaxed max-w-[240px] mx-auto font-medium">
            {description}
          </p>
        </div>

        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={{ 
            boxShadow: [
              "0 0 0 rgba(245,158,11,0)", 
              "0 0 20px rgba(245,158,11,0.4)", 
              "0 0 0 rgba(245,158,11,0)"
            ]
          }}
          transition={{ 
            boxShadow: { repeat: Infinity, duration: 2 }
          }}
          onClick={() => onNavigate('social-intro')}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-black text-sm shadow-2xl transition-all uppercase tracking-widest"
        >
          Hemen Başla ✨
        </motion.button>
      </motion.div>
    </div>
  );
}
