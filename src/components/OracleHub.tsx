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
  const CATEGORIES = [
    { id: 'coffee' as FortuneType, title: 'Kahve Falı', icon: Coffee, color: 'from-amber-500/10 via-amber-500/5 to-transparent', iconColor: 'text-amber-600', configIcon: config?.icons?.coffee },
    { id: 'tarot' as FortuneType, title: 'Tarot', icon: CreditCard, color: 'from-purple-500/10 via-purple-500/5 to-transparent', iconColor: 'text-purple-600', configIcon: config?.icons?.tarot },
    { id: 'water' as FortuneType, title: 'Su Falı', icon: Droplets, color: 'from-cyan-500/10 via-cyan-500/5 to-transparent', iconColor: 'text-cyan-600', configIcon: config?.icons?.water },
    { id: 'ebced' as FortuneType, title: 'Ebced Aşk Falı', icon: Heart, color: 'from-rose-500/10 via-rose-500/5 to-transparent', iconColor: 'text-rose-600', configIcon: config?.icons?.ebced },
    { id: 'yildizname' as FortuneType, title: 'Yıldızname', icon: Star, color: 'from-indigo-500/10 via-indigo-500/5 to-transparent', iconColor: 'text-indigo-600', configIcon: config?.icons?.yildizname },
    { id: 'havas' as FortuneType, title: 'İlmi Havas', icon: Zap, color: 'from-emerald-500/10 via-emerald-500/5 to-transparent', iconColor: 'text-emerald-600', configIcon: config?.icons?.havas },
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
    return <Icon className="w-9 h-9" />;
  };

  const renderBalanceIcon = (type: 'main' | 'ad') => {
    const icon = type === 'main' ? config?.icons?.mainBalance : config?.icons?.adBalance;
    if (icon) {
      if (icon.startsWith('http')) {
        return <img src={icon} alt={type} className="w-5 h-5 object-contain" />;
      }
      return <span className="text-base">{icon}</span>;
    }
    return type === 'main' ? <Coins className="w-5 h-5 text-amber-500" /> : <Zap className="w-5 h-5 text-blue-500" />;
  };
  return (
    <div className="relative space-y-8 pb-40 pr-1 min-h-screen bg-[#050505]">
      {/* Background Animations - Dark & Mystical */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 -right-40 w-[400px] h-[400px] bg-amber-900/10 rounded-full blur-[100px]"
        />
      </div>

      {/* 1. Header: Balances & Name */}
      <section className="relative z-10 px-4 pt-6">
        <div className="p-6 rounded-[2.5rem] bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onNavigate('profile')}
                className="relative cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-900/40 to-amber-900/20 border border-white/10 flex items-center justify-center overflow-hidden shadow-sm group">
                  {userProfile.photoURL ? (
                    <img src={userProfile.photoURL} alt={userProfile.displayName || ""} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  ) : (
                    <User className="w-8 h-8 text-purple-400" />
                  )}
                </div>
              </motion.div>
              
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 mb-1">Hoş Geldin</p>
                <h2 className="text-xl font-serif font-bold text-amber-50 leading-tight truncate max-w-[140px]">
                  {userProfile.displayName || user.displayName || user.email?.split('@')[0]}
                </h2>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onNavigate('wallet')}
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400 hover:bg-white/10 transition-colors shadow-sm"
            >
              <Wallet className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Balance Row */}
          <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-white/10">
            <div className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 mb-2">Ana Jeton</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  {renderBalanceIcon('main')}
                </div>
                <span className="text-xl font-bold text-amber-50">{userProfile.credits}</span>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/5 relative group shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 mb-2">Enerji Kredisi</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  {renderBalanceIcon('ad')}
                </div>
                <span className="text-xl font-bold text-amber-50">{userProfile.adCredits}</span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); onNavigate('wallet'); }}
                  className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 hover:bg-blue-500/30 transition-colors shadow-sm"
                >
                  <span className="text-sm font-bold">+</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ANA SOSYAL KART (EN ÖNEMLİ) */}
      <section className="px-4">
        <motion.div
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            if (userProfile.social?.profileCompleted) {
              onNavigate('social-main');
            } else {
              onNavigate('social-intro');
            }
          }}
          className="relative p-8 rounded-[2.5rem] overflow-hidden group cursor-pointer shadow-[0_20px_40px_rgba(0,0,0,0.3)] bg-gradient-to-br from-purple-900/80 to-indigo-900/80 border border-purple-500/30"
        >
          {/* Animated Glow Elements */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay" />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-20 -right-20 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl"
          />
          
          <div className="relative z-10 flex flex-col items-center text-center space-y-5">
            <motion.div 
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-400 border border-white/20 shadow-inner"
            >
              <Sparkles className="w-8 h-8" />
            </motion.div>
            
            <div>
              <h3 className="text-3xl font-serif font-bold text-amber-50 mb-2 tracking-tight">Sosyal Alan</h3>
              <p className="text-purple-200/80 font-medium text-sm max-w-[240px] mx-auto leading-relaxed">
                Enerjine en uygun insanlarla tanış.
              </p>
            </div>
            
            <button className="mt-2 px-8 py-3.5 rounded-full bg-amber-500 text-black font-bold text-sm shadow-[0_8px_20px_rgba(245,158,11,0.2)] hover:shadow-[0_8px_25px_rgba(245,158,11,0.3)] hover:scale-105 transition-all">
              Sosyal Alana Gir
            </button>
          </div>
        </motion.div>
      </section>

      {/* 3. Günün Mesajı */}
      <section className="px-4">
        <DailyMessageCard config={config} />
      </section>

      {/* 4. Kehanet Kapıları */}
      <section className="px-4">
        <div className="flex items-center gap-2 mb-4 px-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-purple-200/40">Kehanet Kapıları</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CATEGORIES.map((cat) => {
            const price = config?.prices[cat.id as keyof typeof config.prices] || 0;
            const isAdEligible = ['coffee', 'tarot'].includes(cat.id);
            
            return (
              <motion.button
                key={cat.id}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectFortune(cat.id)}
                className="relative rounded-[2rem] border border-white/10 bg-white/5 p-5 group overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                
                <div className="relative z-10 flex items-center">
                  <div className={`w-14 h-14 rounded-2xl bg-black/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 ${cat.iconColor} border border-white/5`}>
                    {renderIcon(cat)}
                  </div>
                  
                  <div className="flex-1 ml-4 text-left">
                    <h4 className="text-lg font-serif font-bold text-amber-50 group-hover:text-amber-400 transition-colors">
                      {cat.title}
                    </h4>
                    <p className="text-[10px] text-purple-200/40 font-medium uppercase tracking-widest mt-1">
                      {cat.id === 'coffee' ? 'Fincandaki Sırlar' : 
                       cat.id === 'tarot' ? 'Kartların Bilgeliği' :
                       cat.id === 'water' ? 'Suyun Fısıltısı' :
                       cat.id === 'ebced' ? 'İlahi Hesaplama' :
                       cat.id === 'yildizname' ? 'Burçların Kaderi' : 'Gizli İlimler'}
                    </p>
                  </div>
                </div>
                
                <div className="relative z-10 flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 font-bold text-xs">
                    {price} {renderBalanceIcon('main')}
                  </div>
                  {isAdEligible && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 font-bold text-xs">
                      {price} {renderBalanceIcon('ad')}
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* 5. Son Kehanetlerin */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-200/40">Son Kehanetlerin</h3>
          </div>
          <button 
            onClick={() => onNavigate('history')}
            className="text-[10px] font-bold uppercase tracking-widest text-amber-500 hover:text-amber-400 transition-colors"
          >
            Hepsi
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {history.length > 0 ? (
            history.slice(0, 2).map((reading) => (
              <motion.div
                key={reading.id}
                whileHover={{ y: -2, scale: 1.02 }}
                onClick={() => reading.status === 'completed' && onNavigate('history')}
                className="p-4 rounded-[1.5rem] border border-white/10 bg-white/5 flex items-center gap-3 cursor-pointer shadow-sm hover:shadow-md transition-all"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  reading.type === 'coffee' ? 'bg-amber-500/10 text-amber-400' : 'bg-purple-500/10 text-purple-400'
                }`}>
                  {reading.type === 'coffee' ? <Coffee className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-amber-50 truncate">{reading.title}</h4>
                  <p className="text-[9px] text-purple-200/40 uppercase tracking-widest truncate mt-0.5">{reading.date}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-2 p-6 text-center rounded-[1.5rem] border border-dashed border-white/10 bg-white/5">
              <p className="text-xs text-purple-200/40 font-medium">Henüz bir kehanet kaydın yok.</p>
            </div>
          )}
        </div>
      </section>

      {/* 6. Burç Alanı */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-200/40">Günün Gökyüzü</h3>
          </div>
          <button 
            onClick={() => onNavigate('horoscopes')}
            className="text-[10px] font-bold uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors"
          >
            Tüm Burçlar
          </button>
        </div>
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onNavigate('horoscopes')}
          className="relative p-6 rounded-[2.5rem] border border-blue-500/20 bg-gradient-to-br from-blue-900/20 to-black overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all"
        >
          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
            <Moon className="w-32 h-32 text-blue-500" />
          </div>
          <div className="relative z-10 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center text-4xl border border-blue-500/20 shadow-sm text-blue-400">
              {userSignData.symbol}
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-serif font-bold text-amber-50 mb-1">{userSignData.name} Burcu</h4>
              <p className="text-xs text-purple-200/60 leading-relaxed line-clamp-2">
                {horoscope ? horoscope.content : "Yıldızların bugün senin için ne fısıldadığını öğren..."}
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-400/50" />
          </div>
        </motion.div>
      </section>
    </div>
  );
}
