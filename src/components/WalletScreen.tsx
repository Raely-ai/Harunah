import { motion } from "motion/react";
import { 
  CreditCard, 
  Zap, 
  ChevronRight, 
  Star, 
  ShieldCheck, 
  Clock, 
  History,
  ArrowUpRight,
  Sparkles,
  Coins
} from "lucide-react";
import { AppConfig, UserProfile } from "../types";

interface WalletScreenProps {
  user: UserProfile | null;
  config: AppConfig | null;
  onBuyCredits: () => void;
  onSubscribe: () => void;
  onWatchAd: () => void;
}

export default function WalletScreen({ user, config, onBuyCredits, onSubscribe, onWatchAd }: WalletScreenProps) {
  const PACKS = [
    { id: 'pack1', credits: 100, price: '₺49.99', bonus: '10 Bonus', popular: false, color: 'from-amber-500/10 to-amber-900/20' },
    { id: 'pack2', credits: 250, price: '₺99.99', bonus: '30 Bonus', popular: true, color: 'from-purple-500/10 to-purple-900/20' },
    { id: 'pack3', credits: 600, price: '₺199.99', bonus: '100 Bonus', popular: false, color: 'from-indigo-500/10 to-indigo-900/20' },
    { id: 'pack4', credits: 1500, price: '₺449.99', bonus: '300 Bonus', popular: false, color: 'from-rose-500/10 to-rose-900/20' },
  ];

  const renderBalanceIcon = (type: 'main' | 'ad') => {
    const icon = type === 'main' ? config?.icons?.mainBalance : config?.icons?.adBalance;
    if (icon) {
      if (icon.startsWith('http')) {
        return <img src={icon} alt={type} className="w-5 h-5 object-contain" />;
      }
      return <span className="text-lg">{icon}</span>;
    }
    return type === 'main' ? <Coins className="w-5 h-5 text-amber-500" /> : <Zap className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="relative min-h-screen space-y-10 pb-40 overflow-hidden bg-[#F6F4F8]">
      {/* 1. Full-Screen Ambient Background (Seamless) */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Large soft radial glows instead of rectangular patches */}
        <div className="absolute top-[-30%] left-[-20%] w-[140%] h-[80%] bg-purple-900/5 blur-[200px] rounded-full opacity-30" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[140%] h-[80%] bg-amber-900/5 blur-[200px] rounded-full opacity-30" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-b from-transparent via-[#F6F4F8]/40 to-[#F6F4F8] opacity-90" />
      </div>

      {/* 2. Header: Balance Summary */}
      <section className="px-6 pt-8 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-10 rounded-[3.5rem] overflow-hidden bg-white border border-black/5 shadow-sm"
        >
          {/* Background Glows */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 blur-[80px] rounded-full" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/5 blur-[80px] rounded-full" />
          
          <div className="relative z-10 space-y-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted">Cüzdan Bakiyesi</p>
                <h2 className="text-4xl font-serif font-bold text-heading tracking-tight">Mistik Cüzdan</h2>
              </div>
              <div className="p-4 rounded-3xl bg-black/5 border border-black/5">
                <CreditCard className="w-8 h-8 text-amber-600/60" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="p-6 rounded-[2.5rem] bg-white border border-black/5 shadow-sm group hover:border-amber-500/20 transition-all duration-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    {renderBalanceIcon('main')}
                  </div>
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Kredi</span>
                </div>
                <p className="text-3xl font-serif font-bold text-heading group-hover:text-amber-600 transition-colors">{user?.credits || 0}</p>
              </div>
              
              <div className="p-6 rounded-[2.5rem] bg-white border border-black/5 shadow-sm group hover:border-purple-500/20 transition-all duration-500">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    {renderBalanceIcon('ad')}
                  </div>
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Bonus</span>
                </div>
                <p className="text-3xl font-serif font-bold text-heading group-hover:text-purple-600 transition-colors">{user?.adCredits || 0}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* 3. Purchase Packs */}
      <section className="px-6 space-y-8 relative z-10">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-2xl font-serif font-bold text-heading tracking-tight">Kredi Paketleri</h3>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/5 border border-black/5 text-[10px] font-black uppercase tracking-widest text-muted">
            <Sparkles className="w-3 h-3" /> Güvenli Ödeme
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {PACKS.map((pack, idx) => (
            <motion.button
              key={pack.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02, x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onBuyCredits()}
              className={`relative p-8 rounded-[2.5rem] bg-white border border-black/5 flex items-center justify-between group shadow-sm transition-all duration-500 hover:border-indigo-600/30`}
            >
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-black/5 border border-black/5 flex items-center justify-center relative z-10">
                    <Coins className="w-8 h-8 text-amber-600" />
                  </div>
                </div>
                <div className="text-left space-y-1">
                  <div className="flex items-center gap-3">
                    <h4 className="text-2xl font-serif font-bold text-heading tracking-tight">{pack.credits} Kredi</h4>
                    {pack.popular && (
                      <span className="px-3 py-1 rounded-full bg-amber-600 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-amber-600/20">Popüler</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-muted tracking-wide">+{pack.bonus} Hediye Kredi</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <span className="text-xl font-serif font-bold text-heading tracking-tight">{pack.price}</span>
                <div className="p-2 rounded-xl bg-black/5 border border-black/5 group-hover:bg-amber-600 group-hover:text-white transition-all duration-500">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* 4. Earn Free Credits */}
      <section className="px-6 relative z-10">
        <motion.div
          whileHover={{ y: -5 }}
          onClick={() => onSubscribe()}
          className="p-10 rounded-[3rem] bg-white border border-black/5 overflow-hidden relative group shadow-sm"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 blur-[80px] rounded-full" />
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                  <Zap className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-heading tracking-tight">Ücretsiz Kredi Kazan</h3>
              </div>
              <p className="text-muted text-base font-medium max-w-[240px] leading-relaxed">
                Reklam izleyerek anında 5 bonus kredi kazanabilirsin.
              </p>
              <button 
                onClick={() => onWatchAd()}
                className="px-8 py-4 rounded-2xl bg-purple-600 text-white font-black text-sm shadow-lg shadow-purple-600/20 hover:bg-purple-500 transition-all"
              >
                Hemen İzle ✨
              </button>
            </div>
            <div className="relative hidden md:block">
              <Star className="w-24 h-24 text-purple-500/10 animate-spin-slow" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* 5. Transaction History Link */}
      <section className="px-6 pb-10 relative z-10">
        <button 
          onClick={() => onBuyCredits()}
          className="w-full p-8 rounded-[2.5rem] bg-white border border-black/5 flex items-center justify-between group hover:bg-black/5 transition-all duration-500 shadow-sm"
        >
          <div className="flex items-center gap-5">
            <div className="p-3 rounded-2xl bg-black/5 border border-black/5">
              <History className="w-6 h-6 text-muted" />
            </div>
            <div className="text-left">
              <h4 className="text-lg font-serif font-bold text-heading tracking-tight">İşlem Geçmişi</h4>
              <p className="text-xs font-medium text-muted tracking-wide">Tüm harcamalarını ve yüklemelerini gör.</p>
            </div>
          </div>
          <ChevronRight className="w-6 h-6 text-muted group-hover:text-heading transition-colors" />
        </button>
      </section>
    </div>
  );
}
