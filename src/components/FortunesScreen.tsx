import { motion } from "motion/react";
import { 
  Coffee, 
  CreditCard, 
  Droplets, 
  Heart, 
  Star, 
  Zap,
  ChevronRight,
  User,
  Coins
} from "lucide-react";
import { FortuneType, AppConfig, UserProfile } from "../types";

interface FortunesScreenProps {
  onSelectFortune: (type: FortuneType) => void;
  onBack?: () => void;
  config: AppConfig | null;
  userProfile: UserProfile | null;
}

export default function FortunesScreen({ onSelectFortune, onBack, config, userProfile }: FortunesScreenProps) {
  const renderBalanceIcon = (type: 'main' | 'ad') => {
    const icon = type === 'main' ? config?.icons?.mainBalance : config?.icons?.adBalance;
    if (icon) {
      if (icon.startsWith('http')) {
        return <img src={icon} alt={type} className="w-4 h-4 object-contain" />;
      }
      return <span className="text-sm">{icon}</span>;
    }
    return type === 'main' ? <Coins className="w-4 h-4 text-amber-500" /> : <Zap className="w-4 h-4 text-blue-500" />;
  };

  const CATEGORIES = [
    { 
      id: 'coffee' as FortuneType, 
      title: 'Kahve Falı', 
      description: 'Fincandaki sembollerin gizemli dünyası.',
      icon: Coffee, 
      color: 'from-amber-500/20 to-amber-900/40', 
      iconColor: 'text-amber-400',
      configIcon: config?.icons?.coffee,
      price: config?.prices?.coffee || 50
    },
    { 
      id: 'tarot' as FortuneType, 
      title: 'Tarot', 
      description: 'Kartların kadim bilgeliği.',
      icon: CreditCard, 
      color: 'from-purple-500/20 to-purple-900/40', 
      iconColor: 'text-purple-400',
      configIcon: config?.icons?.tarot,
      price: config?.prices?.tarot || 40
    },
    { 
      id: 'water' as FortuneType, 
      title: 'Su Falı', 
      description: 'Suyun duruluğunda saklı gerçekler.',
      icon: Droplets, 
      color: 'from-cyan-500/20 to-cyan-900/40', 
      iconColor: 'text-cyan-400',
      configIcon: config?.icons?.water,
      price: config?.prices?.water || 30
    },
    { 
      id: 'ebced' as FortuneType, 
      title: 'Ebced Aşk', 
      description: 'İsimlerin ve sayıların aşkı.',
      icon: Heart, 
      color: 'from-rose-500/20 to-rose-900/40', 
      iconColor: 'text-rose-400',
      configIcon: config?.icons?.ebced,
      price: config?.prices?.ebced || 30
    },
    { 
      id: 'yildizname' as FortuneType, 
      title: 'Yıldızname', 
      description: 'Yıldızların rehberliği.',
      icon: Star, 
      color: 'from-indigo-500/20 to-indigo-900/40', 
      iconColor: 'text-indigo-400',
      configIcon: config?.icons?.yildizname,
      price: config?.prices?.yildizname || 30
    },
    { 
      id: 'havas' as FortuneType, 
      title: 'İlmi Havas', 
      description: 'Gizli ilimlerin derinlikleri.',
      icon: Zap, 
      color: 'from-emerald-500/20 to-emerald-900/40', 
      iconColor: 'text-emerald-400',
      configIcon: config?.icons?.havas,
      price: config?.prices?.havas || 30
    },
  ];

  const renderIcon = (cat: any) => {
    if (cat.configIcon) {
      if (cat.configIcon.startsWith('http')) {
        return <img src={cat.configIcon} alt={cat.title} className="w-10 h-10 object-contain" />;
      }
      return <span className="text-4xl">{cat.configIcon}</span>;
    }
    const Icon = cat.icon;
    return <Icon className={`w-10 h-10 ${cat.iconColor}`} />;
  };

  return (
    <div className="relative min-h-screen space-y-8 pb-32 overflow-hidden">
      {/* Celestial Background Elements */}
      <div className="celestial-bg" />
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-600/10 blur-[120px] rounded-full animate-pulse-glow" style={{ animationDelay: '2s' }} />

      {/* 1. Header: Balances & Name */}
      {userProfile && (
        <section className="px-4 pt-6 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-500/20 blur-md rounded-2xl animate-pulse" />
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-800 to-black border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl relative z-10">
                    {userProfile.photoURL ? (
                      <img src={userProfile.photoURL} alt={userProfile.displayName || ""} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User className="w-7 h-7 text-amber-200/60" />
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-500/60 mb-1">Mistik Gezgin</p>
                  <h2 className="text-xl font-serif font-bold text-white leading-tight truncate max-w-[140px] drop-shadow-sm">
                    {userProfile.displayName}
                  </h2>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/20 shadow-[0_0_15px_rgba(212,175,55,0.05)]">
                  {renderBalanceIcon('main')}
                  <span className="text-sm font-bold text-amber-100 tracking-tight">{userProfile.credits}</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-500/10 to-transparent border border-purple-500/20 shadow-[0_0_15px_rgba(109,40,217,0.05)]">
                  {renderBalanceIcon('ad')}
                  <span className="text-sm font-bold text-purple-100 tracking-tight">{userProfile.adCredits}</span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      )}

      <header className="px-8 relative z-10">
        <div className="relative inline-block">
          <h1 className="text-4xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-400 to-amber-100">
            Kehanetler
          </h1>
          <div className="absolute -bottom-2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
        </div>
        <p className="text-zinc-500 text-sm mt-4 font-medium tracking-wide">Kaderini aydınlatacak bir yöntem seç.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 px-6 relative z-10">
        {CATEGORIES.map((cat, idx) => {
          // Dynamic theme colors based on category
          const getTheme = () => {
            switch(cat.id) {
              case 'coffee': return { glow: 'rgba(212,175,55,0.3)', border: 'border-amber-500/20', bg: 'from-amber-950/40 to-black' };
              case 'tarot': return { glow: 'rgba(109,40,217,0.3)', border: 'border-purple-500/20', bg: 'from-purple-950/40 to-black' };
              case 'water': return { glow: 'rgba(6,182,212,0.3)', border: 'border-cyan-500/20', bg: 'from-cyan-950/40 to-black' };
              case 'ebced': return { glow: 'rgba(244,63,94,0.3)', border: 'border-rose-500/20', bg: 'from-rose-950/40 to-black' };
              case 'yildizname': return { glow: 'rgba(79,70,229,0.3)', border: 'border-indigo-500/20', bg: 'from-indigo-950/40 to-black' };
              case 'havas': return { glow: 'rgba(16,185,129,0.3)', border: 'border-emerald-500/20', bg: 'from-emerald-950/40 to-black' };
              default: return { glow: 'rgba(255,255,255,0.1)', border: 'border-white/10', bg: 'from-zinc-900 to-black' };
            }
          };
          const theme = getTheme();

          return (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.03, translateY: -5 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelectFortune(cat.id)}
              className={`relative flex flex-col items-center p-6 rounded-[2.5rem] overflow-hidden bg-gradient-to-br ${theme.bg} border ${theme.border} text-center space-y-4 shadow-2xl group min-h-[200px] justify-center transition-all duration-500 animate-float`}
              style={{ animationDelay: `${idx * 0.5}s` }}
            >
              {/* Inner Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute -inset-[100%] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent group-hover:animate-[shimmer_2s_infinite] pointer-events-none" />
              
              <div className="p-4 rounded-3xl bg-white/[0.03] border border-white/10 group-hover:bg-white/[0.08] group-hover:border-white/20 transition-all duration-500 relative z-10 shadow-inner">
                <div className="group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_var(--glow)] transition-all duration-500" style={{ '--glow': theme.glow } as any}>
                  {renderIcon(cat)}
                </div>
              </div>
              
              <div className="space-y-1.5 relative z-10">
                <h3 className="text-base font-bold text-white group-hover:text-amber-200 transition-colors">{cat.title}</h3>
                <p className="text-[11px] text-zinc-500 font-medium line-clamp-2 leading-relaxed px-2">
                  {cat.description}
                </p>
              </div>

              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 border border-white/10 text-[11px] font-bold text-amber-400 relative z-10 group-hover:border-amber-500/30 transition-colors shadow-lg">
                {renderBalanceIcon('main')}
                <span className="tracking-tighter">{cat.price}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
