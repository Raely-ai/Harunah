import { motion } from "motion/react";
import { Heart } from "lucide-react";
import { AppTab } from "../types";

interface SocialDisabledViewProps {
  onNavigate: (tab: AppTab) => void;
  title?: string;
  description?: string;
}

export default function SocialDisabledView({ 
  onNavigate, 
  title = "Sosyal Profilin Hazır Değil",
  description = "Yeni insanlarla tanışmak ve ruh eşini bulmak için mistik profilini oluşturmalısın."
}: SocialDisabledViewProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-10 text-center space-y-8 min-h-[60vh]">
      <div className="relative">
        <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full" />
        <div className="relative w-24 h-24 rounded-[2.5rem] bg-white/[0.03] border border-white/10 flex items-center justify-center text-amber-500 shadow-2xl backdrop-blur-xl">
          <Heart className="w-12 h-12" />
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-2xl font-serif font-bold text-white tracking-tight">{title}</h3>
        <p className="text-zinc-400 text-sm leading-relaxed max-w-[260px] mx-auto">
          {description}
        </p>
      </div>
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onNavigate('social-intro')}
        className="px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-sm shadow-2xl shadow-amber-900/20 transition-all"
      >
        Hemen Başla ✨
      </motion.button>
    </div>
  );
}
