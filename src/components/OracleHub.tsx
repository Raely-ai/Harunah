import { motion } from "motion/react";
import { 
  Coffee, 
  CreditCard, 
  Droplets, 
  Heart, 
  Moon, 
  Sparkles,
  Zap,
  User,
  Users,
  Wallet,
  ArrowUpRight,
  History,
  ChevronRight,
  Star,
  Coins
} from "lucide-react";
import { UserProfile, FortuneType, FortuneReading, AppTab, AppConfig } from "../types";
import DailyMessageCard from "./DailyMessageCard";

interface OracleHubProps {
  user: any;
  userProfile: UserProfile;
  history: FortuneReading[];
  onSelectFortune: (type: FortuneType) => void;
  onNavigate: (tab: AppTab) => void;
  config: AppConfig | null;
  horoscope?: any;
}

export default function OracleHub({ user, userProfile, history, onSelectFortune, onNavigate, config, horoscope }: OracleHubProps) {
  return (
    <div className="relative space-y-8 pb-40 pr-1 min-h-screen">
      {/* 1. Hero Section (Premium & Immersive) */}
      <section className="relative z-10 px-4 pt-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative p-8 md:p-12 rounded-[3rem] overflow-hidden text-center space-y-6 bg-white/[0.03] backdrop-blur-3xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col justify-center min-h-[40vh]"
        >
          {/* Animated Background Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/20 rounded-full blur-[80px] animate-pulse-glow pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />
          
          <div className="relative z-10 space-y-4">
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1], 
                rotate: [0, 10, -10, 0],
                filter: ["drop-shadow(0 0 0px rgba(212,175,55,0))", "drop-shadow(0 0 15px rgba(212,175,55,0.5))", "drop-shadow(0 0 0px rgba(212,175,55,0))"]
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-purple-500/10 border border-white/10 mb-2 shadow-inner"
            >
              <Sparkles className="w-8 h-8 text-amber-400" />
            </motion.div>
            
            <div className="space-y-3">
              <h1 className="text-3xl md:text-5xl font-serif font-bold text-white leading-tight tracking-tight">
                Bugün kaderin sana <br /> <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 animate-pulse-glow">bir şey söylüyor…</span>
              </h1>
              <p className="text-zinc-400 text-sm md:text-base max-w-[280px] mx-auto font-medium tracking-wide">
                Enerjin değişiyor. Gizemli bir kapı senin için aralanmak üzere.
              </p>
            </div>
          </div>
          
          <div className="relative z-10 pt-4">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(212,175,55,0.3)" }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('fortunes')}
              className="px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-base shadow-2xl shadow-amber-900/40 transition-all relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative z-10 flex items-center justify-center gap-2">
                Kehaneti Başlat <Sparkles className="w-5 h-5" />
              </span>
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* 2. Günün Mesajı (Refined) */}
      <section className="px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative"
        >
          <DailyMessageCard config={config} />
        </motion.div>
      </section>

      {/* 3. ANA SOSYAL KART (Luxury Redesign) */}
      <section className="px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ y: -5 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (userProfile.social?.profileCompleted) {
              onNavigate('social-main');
            } else {
              onNavigate('social-intro');
            }
          }}
          className="relative p-10 rounded-[3rem] overflow-hidden group cursor-pointer shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-white/[0.03] backdrop-blur-3xl border border-white/10"
        >
          {/* Background Pattern & Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-amber-900/10 opacity-50" />
          <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500/5 rounded-full blur-[100px] group-hover:bg-purple-500/10 transition-colors" />
          
          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative w-20 h-20 rounded-[2rem] bg-gradient-to-br from-amber-500/10 to-purple-500/10 backdrop-blur-2xl flex items-center justify-center text-amber-400 border border-white/10 shadow-inner group-hover:border-amber-500/30 transition-colors"
            >
              <div className="absolute inset-0 bg-amber-400/5 blur-xl group-hover:bg-amber-400/10 transition-colors" />
              <Heart className="w-10 h-10 fill-amber-400/20 drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
            </motion.div>
            
            <div className="space-y-3">
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-white tracking-tight">Yeni İnsanlarla Tanış</h3>
              <p className="text-zinc-400 font-medium text-sm md:text-base max-w-[300px] mx-auto leading-relaxed">
                Senin ruh eşin ve enerjine en yakın kişiler burada seni bekliyor.
              </p>
            </div>
            
            <button className="px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm shadow-xl hover:bg-white/10 hover:border-white/20 transition-all backdrop-blur-md">
              Sosyal Alana Gir ✨
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
