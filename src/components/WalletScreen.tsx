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
      <div className="max-w-md mx-auto space-y-6">
        {/* Header - More Compact */}
        <div className="flex items-center justify-between px-2">
          <div>
            <h1 className="text-2xl font-serif font-bold text-amber-50">Mistik Cüzdan</h1>
            <p className="text-[10px] text-purple-200/40 uppercase tracking-widest font-bold">Enerjini Yönet, Geleceğini Şekillendir</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Balance Cards - Redesigned & Compact */}
        <div className="grid grid-cols-2 gap-3">
          {/* Main Balance Card */}
          <motion.div 
            whileHover={{ y: -2 }}
            className="relative p-5 rounded-[2rem] bg-gradient-to-br from-amber-600/90 to-amber-900/90 overflow-hidden border border-amber-500/20 shadow-xl shadow-amber-900/20"
          >
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-100/60">Ana Jeton</span>
                <ShieldCheck className="w-3 h-3 text-amber-200/40" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-serif font-bold text-white">{user.credits}</span>
                <span className="text-[10px] font-bold text-amber-200/60 uppercase">Jeton</span>
              </div>
              <button 
                onClick={onBuyCredits}
                className="w-full py-2.5 rounded-xl bg-white text-amber-900 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-amber-50 transition-all active:scale-95 shadow-lg shadow-black/20"
              >
                <Plus className="w-3 h-3" />
                <span>Yükle</span>
              </button>
            </div>
          </motion.div>

          {/* Ad Balance Card */}
          <motion.div 
            whileHover={{ y: -2 }}
            className="relative p-5 rounded-[2rem] bg-gradient-to-br from-blue-600/90 to-blue-900/90 overflow-hidden border border-blue-500/20 shadow-xl shadow-blue-900/20"
          >
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-blue-100/60">Enerji Kredisi</span>
                <PlayCircle className="w-3 h-3 text-blue-200/40" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-serif font-bold text-white">{user.adCredits || 0}</span>
                <span className="text-[10px] font-bold text-blue-200/60 uppercase">Enerji</span>
              </div>
              <button 
                onClick={scrollToAds}
                className="w-full py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black flex items-center justify-center gap-1.5 hover:bg-white/20 transition-all active:scale-95"
              >
                <Zap className="w-3 h-3" />
                <span>Kazan</span>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Ad Credits Section - More Engaging */}
        <div ref={adSectionRef} className="space-y-3 scroll-mt-24">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <PlayCircle className="w-3 h-3 text-blue-400" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-200/40">Günlük Enerji Topla</h3>
            </div>
            <span className="text-[8px] font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20">Kahve & Tarot İçin</span>
          </div>
          
          <div className="p-5 rounded-[2rem] bg-white/5 border border-white/10 space-y-5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />
            
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Zap className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-50">Enerji Topla & Kazan</p>
                  <p className="text-[10px] text-purple-200/40">Her video +{config?.adRewardAmount || 5} Enerji</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-blue-400">{user.dailyAdCount}/{config?.maxDailyAds || 10}</p>
                <p className="text-[8px] text-purple-200/40 uppercase tracking-widest font-black">Bugün</p>
              </div>
            </div>

            <div className="space-y-1.5 relative z-10">
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(user.dailyAdCount / (config?.maxDailyAds || 10)) * 100}%` }}
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                />
              </div>
            </div>

            <button 
              onClick={onWatchAd}
              disabled={user.dailyAdCount >= (config?.maxDailyAds || 10)}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-black flex items-center justify-center gap-2 hover:from-blue-500 hover:to-indigo-500 transition-all active:scale-95 shadow-lg shadow-blue-900/20 disabled:opacity-20 disabled:grayscale relative z-10"
            >
              <PlayCircle className="w-5 h-5" />
              <span>Hemen İzle (+{config?.adRewardAmount || 5} Enerji)</span>
            </button>

            <div className="flex items-center gap-2 px-1 relative z-10">
              <Clock className="w-3 h-3 text-purple-200/20" />
              <p className="text-[9px] text-purple-200/40 italic">Kazanılan enerji kredileri ile ücretsiz fal bakabilirsin.</p>
            </div>
          </div>
        </div>

        {/* Subscription Status - Compact */}
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-200/40 px-2">Ayrıcalıklı Üyelik</h3>
          <div className={`p-5 rounded-[2rem] border transition-all relative overflow-hidden ${
            user.subscription?.status === 'active' 
              ? 'bg-amber-500/10 border-amber-500/20' 
              : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  user.subscription?.status === 'active' ? 'bg-amber-500/20 border-amber-500/20' : 'bg-white/5 border-white/10'
                }`}>
                  <Crown className={`w-5 h-5 ${
                    user.subscription?.status === 'active' ? 'text-amber-400' : 'text-purple-200/20'
                  }`} />
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-50">
                    {user.subscription?.status === 'active' ? 'Premium Üye' : 'Standart Üye'}
                  </p>
                  <p className="text-[10px] text-purple-200/40">
                    {user.subscription?.status === 'active' 
                      ? `Sınırsız Ayrıcalıklar Aktif` 
                      : 'Hemen Premium\'a Yükselt'}
                  </p>
                </div>
              </div>
              {user.subscription?.status === 'active' && (
                <div className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-widest border border-amber-500/20">
                  Aktif
                </div>
              )}
            </div>

            <button 
              onClick={onSubscribe}
              className={`w-full py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-95 ${
                user.subscription?.status === 'active'
                  ? 'bg-white/5 text-amber-50 border border-white/10'
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-900/20'
              }`}
            >
              {user.subscription?.status === 'active' ? 'Aboneliği Yönet' : 'Ayrıcalıkları Keşfet'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Recent Transactions - Only if exists */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-200/40">Son İşlemler</h3>
          </div>
          <div className="p-8 text-center rounded-[2rem] border border-dashed border-white/5 bg-white/2">
            <History className="w-8 h-8 text-purple-200/10 mx-auto mb-2" />
            <p className="text-[10px] text-purple-200/20 uppercase tracking-widest font-bold">Henüz bir işlem kaydı bulunmuyor.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
