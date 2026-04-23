import React from "react";
import { motion } from "motion/react";
import { Sparkles, Flower, Link as LinkIcon, Dot, Heart, Star, MoveRight } from "lucide-react";

interface SocialIntroScreenProps {
  onBack: () => void;
  onContinue: () => void;
}

export default function SocialIntroScreen({ onBack, onContinue }: SocialIntroScreenProps) {
  // Luxury Palette
  const champagneGold = "#F1E5AC";
  const deepMidnight = "#0F172A";
  const royalAmethyst = "#3B0764";
  const electricIndigo = "#4338CA";

  return (
    <div className="relative min-h-[100dvh] w-full text-white overflow-hidden flex flex-col pt-[env(safe-area-inset-top,2rem)] flex-shrink-0 bg-[#0F172A]">
      {/* Background (High-End Atmosphere) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Base Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] to-[#3B0764]" />
        
        {/* Core Aura: Electric Indigo patlaması */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[60%] bg-[#4338CA] opacity-20 blur-[150px] rounded-full" />
        
        {/* Floating elements with Shimmer effect */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              opacity: 0, 
              y: "110%", 
              x: `${5 + i * 12}%`,
              rotate: Math.random() * 360 
            }}
            animate={{ 
              opacity: [0, 0.2, 0.2, 0], 
              y: "-10%",
              rotate: Math.random() * 360 + 120
            }}
            transition={{ 
              duration: 20 + Math.random() * 20, 
              repeat: Infinity, 
              delay: i * 2,
              ease: "linear"
            }}
            className="absolute z-0 pointer-events-none"
          >
            <div className="relative">
              {/* Glow backdrop for icons */}
              <div className="absolute inset-0 bg-white/20 blur-[20px] rounded-full" />
              {i % 2 === 0 ? (
                <Heart className="w-6 h-6 text-white/10 animate-pulse" strokeWidth={1} />
              ) : (
                <Sparkles className="w-5 h-5 text-white/10 animate-pulse" strokeWidth={1} />
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-between px-6 w-full max-w-lg mx-auto pb-12">
        
        {/* Top Section: Gold & Pearl Typography */}
        <div className="w-full flex flex-col items-center pt-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 w-14 h-14 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl"
          >
             <Flower className="w-9 h-9" style={{ color: champagneGold }} strokeWidth={1} />
          </motion.div>

          <div className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-serif font-light leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-[#F1E5AC] via-[#D4AF37] to-[#F1E5AC]">
              Frekansların <br />
              <span className="italic font-normal">Zarif</span> Buluşması
            </h1>
            <p className="text-[13px] font-sans font-light text-slate-200 tracking-wider max-w-[280px] mx-auto leading-relaxed opacity-80">
              Gerçek analiz sonuçlarına göre ruhuna en yakın kişilerle tanışmaya hazır mısın?
            </p>
          </div>
        </div>

        {/* Middle Section: Frosted Glass Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full p-8 rounded-[40px] bg-white/10 backdrop-blur-3xl border border-white/20 shadow-[0_30px_60px_rgba(0,0,0,0.4)] space-y-8"
        >
          {/* Jewelry Style Icons Grid */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Sparkles, label: "Uyum", desc: "Ruhsal Analiz" },
              { icon: LinkIcon, label: "Keşfet", desc: "Bağ Kur" },
              { icon: Dot, label: "Sohbet", desc: "Derinlik" }
            ].map((prop, idx) => (
              <div key={idx} className="flex flex-col items-center text-center space-y-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5">
                  <prop.icon 
                    className="w-6 h-6 filter drop-shadow-[0_0_8px_rgba(241,229,172,0.4)]" 
                    style={{ color: champagneGold }} 
                    strokeWidth={1.5}
                  />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[10px] font-bold text-white uppercase tracking-[0.25em]">{prop.label}</h4>
                  <p className="text-[8px] text-slate-300 font-light uppercase tracking-widest">{prop.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Bottom Section: The Devasa Button */}
        <div className="w-full flex flex-col items-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full flex justify-center z-50"
          >
            <button
              onClick={onContinue}
              className="group relative w-full py-5 rounded-3xl bg-gradient-to-r from-[#4338CA] via-[#6366F1] to-[#4338CA] bg-[length:200%_auto] hover:bg-right overflow-hidden shadow-[0_20px_50px_rgba(67,56,202,0.5)] flex items-center justify-center gap-4 transition-all duration-500 hover:scale-[1.03] active:scale-95"
            >
              {/* Shimmer overlay */}
              <div className="absolute inset-0 opacity-30 bg-gradient-to-tr from-transparent via-white/20 to-transparent skew-x-12 translate-x-[-100%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out" />
              
              <span className="text-white font-bold text-[14px] uppercase tracking-[0.3em] drop-shadow-sm">
                BAĞ KURMAYA BAŞLA
              </span>
              
              <div className="relative">
                <div className="absolute inset-0 blur-[8px] bg-amber-400 opacity-0 group-hover:opacity-40 transition-opacity" />
                <MoveRight className="w-6 h-6 text-amber-300 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
              </div>
            </button>
          </motion.div>
          
          <button 
            onClick={onBack}
            className="relative z-50 py-1 text-white/30 font-medium text-[11px] uppercase tracking-[0.4em] hover:text-white transition-colors"
          >
            Daha Sonra
          </button>
        </div>
      </main>
    </div>
  );
}
