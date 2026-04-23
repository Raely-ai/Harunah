import React from "react";
import { motion } from "motion/react";
import { Sparkles, Flower, Link as LinkIcon, Dot, MessageCircle, Heart, MoveRight } from "lucide-react";
import { AppTab } from "../types";

interface SocialDisabledViewProps {
  onNavigate: (tab: AppTab) => void;
  title?: string;
  description?: string;
}

export default function SocialDisabledView({ 
  onNavigate, 
  title,
  description = "Gerçek analiz sonuçlarına göre ruhuna en yakın kişilerle tanışmaya hazır mısın?"
}: SocialDisabledViewProps) {
  const displayTitle = title || "Frekansların Zarif Buluşması";

  // Luxury Palette
  const champagneGold = "#F1E5AC";
  const royalAmethyst = "#3B0764";
  const deepIndigo = "#4338CA";

  return (
    <div className="absolute inset-0 z-[100] text-white overflow-hidden flex flex-col pt-[env(safe-area-inset-top,2rem)] bg-[#0F172A]">
      {/* Background (High-End Atmosphere) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Base Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] to-[#3B0764]" />
        
        {/* Core Aura: Electric Indigo patlaması */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[70%] bg-[#4338CA] opacity-20 blur-[150px] rounded-full" />
        
        {/* Floating Mistik Elements (Opacity 10%) */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              opacity: 0, 
              y: "110%", 
              x: `${10 + i * 16}%`,
              rotate: Math.random() * 360 
            }}
            animate={{ 
              opacity: [0, 0.2, 0.2, 0], 
              y: "-10%",
              rotate: Math.random() * 360 + 120
            }}
            transition={{ 
              duration: 20 + Math.random() * 10, 
              repeat: Infinity, 
              delay: i * 3,
              ease: "linear"
            }}
            className="absolute z-0 pointer-events-none"
          >
             <div className="relative">
                <div className="absolute inset-0 bg-white/10 blur-[15px] rounded-full" />
                {i % 2 === 0 ? (
                  <Heart className="w-6 h-6 text-white/10 animate-pulse" strokeWidth={1} />
                ) : (
                  <Sparkles className="w-5 h-5 text-white/10 animate-pulse" strokeWidth={1} />
                )}
             </div>
          </motion.div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm shrink-0 flex flex-col items-center flex-1 py-10 mx-auto px-6 justify-between h-full">
        {/* Top Section */}
        <div className="w-full flex flex-col items-center">
          <div className="mb-10 relative flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.1, scale: 1.3 }}
              transition={{ duration: 5, repeat: Infinity, repeatType: "reverse" }}
              className="absolute -top-12"
            >
              <Flower className="w-32 h-32" style={{ color: champagneGold }} />
            </motion.div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="relative z-10 w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 backdrop-blur-xl shadow-2xl"
            >
              <MessageCircle className="w-9 h-9" style={{ color: champagneGold }} strokeWidth={1} />
            </motion.div>
          </div>

          {/* Frosted Glass Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full p-8 rounded-[40px] bg-white/10 backdrop-blur-3xl border border-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.5)] space-y-8"
          >
            {/* Typography Luxury Brand */}
            <div className="text-center space-y-4">
              <h3 className="text-3xl font-serif font-light text-transparent bg-clip-text bg-gradient-to-br from-[#F1E5AC] via-[#D4AF37] to-[#F1E5AC] leading-tight tracking-tight">
                {displayTitle.split(' ').map((word, i) => 
                  word === 'Zarif' ? <span key={i} className="italic font-normal">Zarif </span> : word + ' '
                )}
              </h3>
              <p className="text-[13px] font-sans font-light text-slate-200 tracking-wider leading-relaxed px-2 opacity-80">
                {description}
              </p>
            </div>

            {/* Jewelry Style Icons Grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Sparkles, label: "Uyum" },
                { icon: LinkIcon, label: "Keşfet" },
                { icon: Dot, label: "Sohbet" }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center text-center space-y-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5">
                    <item.icon 
                      className="w-5 h-5 filter drop-shadow-[0_0_8px_rgba(241,229,172,0.3)]" 
                      style={{ color: champagneGold }} 
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white uppercase tracking-[0.25em]">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom Section: The Statement Button */}
        <div className="w-full mt-auto mb-8 relative z-50 flex justify-center">
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onNavigate('social-intro')}
            className="group relative w-full py-5 rounded-3xl bg-gradient-to-r from-[#4338CA] via-[#6366F1] to-[#4338CA] bg-[length:200%_auto] hover:bg-right overflow-hidden shadow-[0_20px_50px_rgba(67,56,202,0.5)] flex items-center justify-center gap-4 transition-all duration-500"
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 opacity-30 bg-gradient-to-tr from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-100%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
            
            <span className="text-white font-bold text-[14px] tracking-[0.3em] uppercase drop-shadow-sm">
              BAĞ KURMAYA BAŞLA
            </span>
            
            <div className="relative">
              <div className="absolute inset-0 blur-[8px] bg-amber-400 opacity-0 group-hover:opacity-40 transition-opacity" />
              <MoveRight className="w-6 h-6 text-amber-300 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
