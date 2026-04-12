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
  title = "Sosyal Dünya Seni Bekliyor ✨",
  description = "Enerjine uygun insanları keşfet, sohbet et ve uyumunu gör."
}: SocialDisabledViewProps) {
  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center p-8 overflow-hidden pointer-events-none">
      {/* Dark Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] pointer-events-none" />
      
      {/* Noise / Grain Texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      {/* Floating Glow Particles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%",
              opacity: 0 
            }}
            animate={{ 
              y: [null, "-20%", "20%"],
              opacity: [0, 0.3, 0],
              scale: [1, 1.2, 1]
            }}
            transition={{ 
              duration: 5 + Math.random() * 5, 
              repeat: Infinity,
              delay: Math.random() * 5
            }}
            className="absolute w-32 h-32 bg-purple-500/10 blur-[60px] rounded-full"
          />
        ))}
      </div>

      {/* Center Content (Minimalist) */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xs space-y-8">
        {/* Glow Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative"
        >
          <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-amber-400 shadow-2xl">
            <Sparkles className="w-8 h-8" />
          </div>
        </motion.div>

        {/* Text Content */}
        <div className="space-y-4">
          <motion.h3 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-3xl font-serif font-bold text-white tracking-tight leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
          >
            {title}
          </motion.h3>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-white/60 text-sm leading-relaxed font-medium px-4"
          >
            {description}
          </motion.p>
        </div>

        {/* Premium Glass CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="w-full pointer-events-auto"
        >
          <motion.button 
            whileHover={{ scale: 1.02, backgroundColor: "rgba(255, 255, 255, 0.1)" }}
            whileTap={{ scale: 0.98 }}
            animate={{ 
              boxShadow: [
                "0 0 0 rgba(255,255,255,0)", 
                "0 0 20px rgba(255,255,255,0.1)", 
                "0 0 0 rgba(255,255,255,0)"
              ]
            }}
            transition={{ 
              boxShadow: { repeat: Infinity, duration: 3 }
            }}
            onClick={() => onNavigate('social-intro')}
            className="group relative w-full py-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 text-white font-black text-sm transition-all overflow-hidden"
          >
            {/* Subtle Inner Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50" />
            
            {/* Shimmer Effect */}
            <motion.div 
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12"
            />

            <span className="relative z-10 flex items-center justify-center gap-2 tracking-widest uppercase">
              Hemen Başla ✨
            </span>
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
