import React from 'react';
import { motion } from 'motion/react';
import { 
  Wallet, 
  Zap, 
  Crown, 
  History, 
  ArrowUpRight, 
  Plus, 
  PlayCircle,
  Clock,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { UserProfile, AppConfig } from '../types';

interface WalletScreenProps {
  user: UserProfile;
  config: AppConfig | null;
  onBuyCredits: () => void;
  onSubscribe: () => void;
  onWatchAd: () => void;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({ 
  user, 
  config,
  onBuyCredits, 
  onSubscribe,
  onWatchAd 
}) => {
  const adSectionRef = React.useRef<HTMLDivElement>(null);

  const scrollToAds = () => {
    adSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-8 pb-32 custom-scrollbar bg-[#050505]">
      <div className="max-w-md mx-auto space-y-8">
        {/* Header - Premium */}
        <div className="flex items-center justify-between px-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-serif font-bold text-white tracking-tight">Mistik Cüzdan</h1>
            <p className="text-[10px] text-amber-400/60 uppercase tracking-[0.3em] font-black">Enerjini Yönet, Geleceğini Şekillendir</p>
          </div>
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.1 }}
            className="w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-amber-500/10 to-purple-500/10 border border-white/10 flex items-center justify-center shadow-inner"
          >
            <Wallet className="w-7 h-7 text-amber-400 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]" />
          </motion.div>
        </div>

        {/* Balance Cards - Premium Glass */}
        <div className="grid grid-cols-2 gap-4">
          {/* Main Balance Card */}
          <motion.div 
            whileHover={{ y: -5, boxShadow: "0 20px 40px rgba(212,175,55,0.1)" }}
            whileTap={{ scale: 0.98 }}
            className="relative p-6 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl overflow-hidden border border-white/10 shadow-2xl group"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-colors" />
            <div className="relative z-10 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-400/60">Ana Jeton</span>
                <ShieldCheck className="w-4 h-4 text-amber-400/40" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-serif font-bold text-white">{user.credits}</span>
                <span className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest">🪙</span>
              </div>
              <button 
                onClick={onBuyCredits}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white text-xs font-black flex items-center justify-center gap-2 hover:from-amber-500 hover:to-amber-400 transition-all shadow-xl shadow-amber-900/40 relative overflow-hidden group/btn"
              >
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                <Plus className="w-3.5 h-3.5" />
                <span>Yükle</span>
              </button>
            </div>
          </motion.div>

          {/* Ad Balance Card */}
          <motion.div 
            whileHover={{ y: -5, boxShadow: "0 20px 40px rgba(59,130,246,0.1)" }}
            whileTap={{ scale: 0.98 }}
            className="relative p-6 rounded-[2.5rem] bg-white/[0.03] backdrop-blur-3xl overflow-hidden border border-white/10 shadow-2xl group"
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors" />
            <div className="relative z-10 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400/60">Enerji</span>
                <Zap className="w-4 h-4 text-blue-400/40" />
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-serif font-bold text-white">{user.adCredits || 0}</span>
                <span className="text-[10px] font-bold text-blue-400/60 uppercase tracking-widest">⚡</span>
              </div>
              <button 
                onClick={scrollToAds}
                className="w-full py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-black flex items-center justify-center gap-2 hover:bg-white/10 hover:border-white/20 transition-all shadow-xl"
              >
                <Zap className="w-3.5 h-3.5 text-blue-400" />
                <span>Kazan</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Ad Credits Section - Premium Engagement */}
        <div ref={adSectionRef} className="space-y-4 scroll-mt-24">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-blue-400" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Günlük Enerji Topla</h3>
            </div>
            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 backdrop-blur-md">Ücretsiz Fal İçin</span>
          </div>
          
          <div className="p-8 rounded-[3rem] bg-white/[0.03] backdrop-blur-3xl border border-white/10 space-y-6 relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-[80px] -mr-24 -mt-24 group-hover:bg-blue-500/10 transition-colors" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
                  <Zap className="w-7 h-7 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Enerji Topla & Kazan</p>
                  <p className="text-xs text-zinc-500 font-medium">Her video +{config?.adRewardAmount || 5} Enerji</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-serif font-bold text-blue-400">{user.dailyAdCount}/{config?.maxDailyAds || 10}</p>
                <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-black">Bugün</p>
              </div>
            </div>

            <div className="space-y-2 relative z-10">
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(user.dailyAdCount / (config?.maxDailyAds || 10)) * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)]"
                />
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(59,130,246,0.3)" }}
              whileTap={{ scale: 0.98 }}
              onClick={onWatchAd}
              disabled={user.dailyAdCount >= (config?.maxDailyAds || 10)}
              className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-black flex items-center justify-center gap-3 transition-all shadow-xl shadow-blue-900/40 disabled:opacity-20 disabled:grayscale relative z-10 overflow-hidden group/adbtn"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/adbtn:translate-x-[100%] transition-transform duration-700" />
              <PlayCircle className="w-6 h-6" />
              <span>Hemen İzle (+{config?.adRewardAmount || 5} Enerji)</span>
            </motion.button>

            <div className="flex items-center gap-2 px-2 relative z-10">
              <Clock className="w-3.5 h-3.5 text-zinc-600" />
              <p className="text-[10px] text-zinc-500 italic font-medium">Kazanılan enerji kredileri ile ücretsiz fal bakabilirsin.</p>
            </div>
          </div>
        </div>

        {/* Subscription Status - Premium */}
        <div className="space-y-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500 px-4">Ayrıcalıklı Üyelik</h3>
          <motion.div 
            whileHover={{ y: -5 }}
            className={`p-8 rounded-[3rem] border transition-all relative overflow-hidden shadow-2xl backdrop-blur-3xl ${
            user.subscription?.status === 'active' 
              ? 'bg-amber-500/[0.03] border-amber-500/20' 
              : 'bg-white/[0.03] border-white/10'
          }`}>
            {user.subscription?.status === 'active' && (
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-[80px] -mr-24 -mt-24" />
            )}
            
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner ${
                  user.subscription?.status === 'active' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/10'
                }`}>
                  <Crown className={`w-7 h-7 ${
                    user.subscription?.status === 'active' ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(212,175,55,0.5)]' : 'text-zinc-700'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {user.subscription?.status === 'active' ? 'Premium Üye' : 'Standart Üye'}
                  </p>
                  <p className="text-xs text-zinc-500 font-medium">
                    {user.subscription?.status === 'active' 
                      ? `Sınırsız Ayrıcalıklar Aktif` 
                      : 'Hemen Premium\'a Yükselt'}
                  </p>
                </div>
              </div>
              {user.subscription?.status === 'active' && (
                <div className="px-4 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] border border-amber-500/20 backdrop-blur-md">
                  Aktif
                </div>
              )}
            </div>

            <motion.button 
              whileHover={{ scale: 1.02, boxShadow: user.subscription?.status === 'active' ? "none" : "0 0 30px rgba(212,175,55,0.3)" }}
              whileTap={{ scale: 0.98 }}
              onClick={onSubscribe}
              className={`w-full py-4 rounded-[1.5rem] text-sm font-black flex items-center justify-center gap-3 transition-all relative overflow-hidden group/subbtn ${
                user.subscription?.status === 'active'
                  ? 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-xl shadow-amber-900/40'
              }`}
            >
              {user.subscription?.status !== 'active' && (
                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/subbtn:translate-x-[100%] transition-transform duration-700" />
              )}
              <span className="relative z-10">{user.subscription?.status === 'active' ? 'Aboneliği Yönet' : 'Ayrıcalıkları Keşfet'}</span>
              <ChevronRight className="w-5 h-5 relative z-10" />
            </motion.button>
          </motion.div>
        </div>

        {/* Recent Transactions - Premium Empty State */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Son İşlemler</h3>
          </div>
          <div className="p-12 text-center rounded-[3rem] border border-dashed border-white/10 bg-white/[0.02] backdrop-blur-sm">
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <History className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
            </motion.div>
            <p className="text-[11px] text-zinc-600 uppercase tracking-[0.3em] font-black">Henüz bir işlem kaydı bulunmuyor.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
