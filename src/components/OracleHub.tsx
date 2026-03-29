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
  Wallet,
  ArrowUpRight,
  History,
  ChevronRight,
  Star
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
  const CATEGORIES = [
    { id: 'coffee' as FortuneType, title: 'Kahve Falı', icon: Coffee, color: 'from-amber-500/20 to-amber-700/20', iconColor: 'text-amber-400', configIcon: config?.icons?.coffee },
    { id: 'tarot' as FortuneType, title: 'Tarot', icon: CreditCard, color: 'from-purple-500/20 to-purple-700/20', iconColor: 'text-purple-400', configIcon: config?.icons?.tarot },
    { id: 'water' as FortuneType, title: 'Su Falı', icon: Droplets, color: 'from-blue-500/20 to-blue-700/20', iconColor: 'text-blue-400', configIcon: config?.icons?.water },
    { id: 'ebced' as FortuneType, title: 'Ebced Aşk Falı', icon: Heart, color: 'from-red-500/20 to-red-700/20', iconColor: 'text-red-400', configIcon: config?.icons?.ebced },
    { id: 'yildizname' as FortuneType, title: 'Yıldızname', icon: Star, color: 'from-indigo-500/20 to-indigo-700/20', iconColor: 'text-indigo-400', configIcon: config?.icons?.yildizname },
    { id: 'havas' as FortuneType, title: 'İlmi Havas', icon: Zap, color: 'from-emerald-500/20 to-emerald-700/20', iconColor: 'text-emerald-400', configIcon: config?.icons?.havas },
  ];

  const SIGNS = [
    { id: 'Koç', name: 'Koç', symbol: '♈' },
    { id: 'Boğa', name: 'Boğa', symbol: '♉' },
    { id: 'İkizler', name: 'İkizler', symbol: '♊' },
    { id: 'Yengeç', name: 'Yengeç', symbol: '♋' },
    { id: 'Aslan', name: 'Aslan', symbol: '♌' },
    { id: 'Başak', name: 'Başak', symbol: '♍' },
    { id: 'Terazi', name: 'Terazi', symbol: '♎' },
    { id: 'Akrep', name: 'Akrep', symbol: '♏' },
    { id: 'Yay', name: 'Yay', symbol: '♐' },
    { id: 'Oğlak', name: 'Oğlak', symbol: '♑' },
    { id: 'Kova', name: 'Kova', symbol: '♒' },
    { id: 'Balık', name: 'Balık', symbol: '♓' },
  ];

  const userSignData = SIGNS.find(s => s.id === userProfile.horoscope) || SIGNS[0];

  const renderIcon = (cat: any) => {
    if (cat.configIcon) {
      if (cat.configIcon.startsWith('http')) {
        return <img src={cat.configIcon} alt={cat.title} className="w-8 h-8 object-contain" />;
      }
      return <span className="text-3xl">{cat.configIcon}</span>;
    }
    const Icon = cat.icon;
    return <Icon className="w-8 h-8" />;
  };

  const renderBalanceIcon = (type: 'main' | 'ad') => {
    const icon = type === 'main' ? config?.icons?.mainBalance : config?.icons?.adBalance;
    if (icon) {
      if (icon.startsWith('http')) {
        return <img src={icon} alt={type} className="w-3 h-3 object-contain" />;
      }
      return <span className="text-xs">{icon}</span>;
    }
    return type === 'main' ? <CreditCard className="w-3 h-3 text-amber-400" /> : <Sparkles className="w-3 h-3 text-blue-400" />;
  };
  return (
    <div className="relative space-y-10 pb-32 pr-1">
      {/* Background Animations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={`heart-${i}`}
            initial={{ 
              opacity: 0,
              y: "110vh",
              x: `${Math.random() * 100}vw`,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              opacity: [0, 0.3, 0],
              y: "-10vh",
              x: `${(Math.random() * 100) + (Math.sin(i) * 10)}vw`
            }}
            transition={{ 
              duration: 15 + Math.random() * 10,
              repeat: Infinity,
              delay: i * 2,
              ease: "linear"
            }}
            className="absolute"
          >
            <Heart className="w-4 h-4 text-red-500/10 fill-red-500/5" />
          </motion.div>
        ))}
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={`snow-${i}`}
            initial={{ 
              opacity: 0,
              y: "-10vh",
              x: `${Math.random() * 100}vw`,
              scale: Math.random() * 0.3 + 0.2
            }}
            animate={{ 
              opacity: [0, 0.4, 0],
              y: "110vh",
              x: `${(Math.random() * 100) + (Math.cos(i) * 5)}vw`
            }}
            transition={{ 
              duration: 10 + Math.random() * 15,
              repeat: Infinity,
              delay: i * 1,
              ease: "linear"
            }}
            className="absolute"
          >
            <div className="w-2 h-2 bg-white/10 rounded-full blur-[1px]" />
          </motion.div>
        ))}
      </div>

      {/* Premium Greeting & Stats - Redesigned for Stability */}
      <section className="relative z-10 px-2">
        <div className="p-6 rounded-[2.5rem] bg-gradient-to-br from-white/5 to-transparent border border-white/10 backdrop-blur-2xl shadow-2xl">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate('profile')}
                className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center overflow-hidden group"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || ""} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-8 h-8 text-amber-400/60" />
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-purple-200/40">Mistik Rehberin</p>
                  {userProfile.subscription && userProfile.subscription.type !== 'none' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest border border-amber-500/20">Premium</span>
                  )}
                </div>
                <h2 className="text-lg font-serif font-bold text-amber-50 leading-tight">
                  {(userProfile.displayName || user.displayName || user.email?.split('@')[0]).slice(0, 9)}
                </h2>
              </div>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onNavigate('wallet')}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              <Wallet className="w-5 h-5" />
            </motion.button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 flex flex-col items-center justify-center text-center">
              <p className="text-[8px] font-black uppercase tracking-[0.2em] text-purple-200/30 mb-1">Ana Bakiye</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  {renderBalanceIcon('main')}
                </div>
                <span className="text-xl font-bold text-amber-50">{userProfile.credits}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Horoscope Card */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-200/40">Günün Gökyüzü</h3>
          </div>
          <button 
            onClick={() => onNavigate('horoscopes')}
            className="text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
          >
            Tüm Burçlar
          </button>
        </div>
        <motion.div
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onNavigate('horoscopes')}
          className="relative p-6 rounded-[2rem] border border-blue-500/20 bg-gradient-to-br from-blue-900/10 to-transparent backdrop-blur-xl overflow-hidden group cursor-pointer"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Moon className="w-24 h-24 text-blue-400" />
          </div>
          <div className="relative z-10 flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-4xl border border-blue-500/20">
              {userSignData.symbol}
            </div>
            <div>
              <h4 className="text-xl font-serif font-bold text-blue-50 mb-1">{userSignData.name} Burcu</h4>
              <p className="text-sm text-purple-200/60 leading-relaxed max-w-[200px] line-clamp-3">
                {horoscope ? horoscope.content : "Burcun için bugünün kehanetini keşfet..."}
              </p>
            </div>
            <div className="ml-auto">
              <ChevronRight className="w-6 h-6 text-blue-400/40" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Message for You Today */}
      <DailyMessageCard config={config} />

      {/* Fortune Categories Grid */}
      <section>
        <div className="flex items-center gap-2 mb-6 px-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-200/40">Ana Sayfa</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const price = config?.prices[cat.id as keyof typeof config.prices] || 0;
            const isAdEligible = ['coffee', 'tarot'].includes(cat.id);
            
            return (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectFortune(cat.id)}
                className={`relative p-6 rounded-[2rem] border border-white/5 bg-black/40 backdrop-blur-xl flex flex-col items-center text-center group overflow-hidden`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <div className={`p-4 rounded-2xl bg-white/5 mb-4 group-hover:scale-110 transition-transform duration-500 ${cat.iconColor}`}>
                  {renderIcon(cat)}
                </div>
                <h4 className="text-sm font-serif font-bold text-amber-50 group-hover:text-white transition-colors mb-2">{cat.title}</h4>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 group-hover:border-amber-500/30 transition-colors">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-amber-400">{price}</span>
                    {renderBalanceIcon('main')}
                  </div>
                  {isAdEligible && (
                    <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black text-blue-400">{price}</span>
                        {renderBalanceIcon('ad')}
                      </div>
                      <span className="text-[8px] font-bold text-blue-400 uppercase">Reklam</span>
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Recent Readings Preview */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-200/40">Son Kehanetlerin</h3>
          </div>
          <button 
            onClick={() => onNavigate('history')}
            className="text-[10px] font-bold uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
          >
            Tümünü Gör
          </button>
        </div>
        <div className="space-y-3">
          {history.length > 0 ? (
            history.slice(0, 2).map((reading) => (
              <motion.div
                key={reading.id}
                whileHover={{ x: 4 }}
                onClick={() => reading.status === 'completed' && onNavigate('history')}
                className="p-4 rounded-2xl border border-white/5 bg-white/5 flex items-center gap-4 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  reading.type === 'coffee' ? 'bg-amber-500/10 text-amber-400' : 'bg-purple-500/10 text-purple-400'
                }`}>
                  {reading.type === 'coffee' ? <Coffee className="w-6 h-6" /> : <CreditCard className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-50">{reading.title}</h4>
                  <p className="text-[10px] text-purple-200/40 uppercase tracking-widest">{reading.date}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-purple-200/20 group-hover:text-purple-400 transition-colors" />
              </motion.div>
            ))
          ) : (
            <div className="p-8 text-center rounded-2xl border border-dashed border-white/5">
              <p className="text-xs text-purple-200/20">Henüz bir kehanet kaydın yok.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
