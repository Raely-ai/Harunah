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
    adSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 pt-12 pb-32 custom-scrollbar">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold text-indigo-50">Cüzdanım</h1>
            <p className="text-purple-200/40">Bakiyeni yönet ve ayrıcalıklarını gör.</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Wallet className="w-6 h-6 text-indigo-400" />
          </div>
        </div>

        {/* Balance Card */}
        <div className="grid grid-cols-1 gap-4">
          {/* Main Balance Card */}
          <motion.div 
            whileHover={{ y: -4 }}
            className="relative p-8 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-indigo-800 overflow-hidden shadow-2xl shadow-indigo-900/40"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-100/60">Ana Bakiye</span>
                <ShieldCheck className="w-5 h-5 text-indigo-200/40" />
              </div>
              <div className="flex items-end gap-3">
                <span className="text-5xl font-serif font-bold text-white">{user.credits}</span>
                <span className="text-lg font-bold text-indigo-200 mb-1">Kredi</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={onBuyCredits}
                  className="py-4 rounded-2xl bg-white text-indigo-900 font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Yükle</span>
                </button>
                <button 
                  onClick={onWatchAd}
                  className="py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors"
                >
                  <PlayCircle className="w-5 h-5" />
                  <span>Kazan</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Ad Credits Section */}
        <div ref={adSectionRef} className="space-y-4 scroll-mt-8">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-purple-200/40">Reklam Kredileri</h3>
            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-full">Sadece Kahve & Tarot</span>
          </div>
          
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <PlayCircle className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-indigo-50">Günlük Reklam Hakkı</p>
                  <p className="text-xs text-purple-200/40">İzledikçe kredi kazan</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-indigo-50">{user.dailyAdCount}/{config?.maxDailyAds || 10}</p>
                <p className="text-[10px] text-purple-200/40 uppercase tracking-widest">Kazanıldı</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(user.dailyAdCount / (config?.maxDailyAds || 10)) * 100}%` }}
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500"
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-purple-200/20 uppercase tracking-widest">
                <span>0</span>
                <span>{config?.maxDailyAds || 10}</span>
              </div>
            </div>

            <button 
              onClick={onWatchAd}
              disabled={user.dailyAdCount >= (config?.maxDailyAds || 10)}
              className="w-full py-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold flex items-center justify-center gap-2 hover:bg-purple-500/20 transition-all disabled:opacity-20 disabled:grayscale"
            >
              <Zap className="w-5 h-5" />
              <span>Reklam İzle (+{config?.adRewardAmount || 1} Kredi)</span>
            </button>

            <div className="flex items-center gap-2 px-2">
              <Clock className="w-4 h-4 text-purple-200/20" />
              <p className="text-[10px] text-purple-200/40 italic">Kazanılan reklam kredileri 7 gün sonra geçerliliğini yitirir.</p>
            </div>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-purple-200/40 px-2">Abonelik Durumu</h3>
          <div className={`p-6 rounded-3xl border transition-all ${
            user.subscription?.status === 'active' 
              ? 'bg-amber-500/10 border-amber-500/20' 
              : 'bg-white/5 border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  user.subscription?.status === 'active' ? 'bg-amber-500/20' : 'bg-white/5'
                }`}>
                  <Crown className={`w-6 h-6 ${
                    user.subscription?.status === 'active' ? 'text-amber-400' : 'text-purple-200/20'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-indigo-50">
                    {user.subscription?.status === 'active' ? 'Premium Üye' : 'Standart Üye'}
                  </p>
                  <p className="text-xs text-purple-200/40">
                    {user.subscription?.status === 'active' 
                      ? `Günde 15 fal hakkı aktif` 
                      : 'Ayrıcalıklardan faydalan'}
                  </p>
                </div>
              </div>
              {user.subscription?.status === 'active' && (
                <div className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
                  Aktif
                </div>
              )}
            </div>

            <button 
              onClick={onSubscribe}
              className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                user.subscription?.status === 'active'
                  ? 'bg-white/5 text-indigo-50 border border-white/10'
                  : 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-900/20'
              }`}
            >
              {user.subscription?.status === 'active' ? 'Aboneliği Yönet' : 'Premium\'a Geç'}
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-purple-200/40">Son İşlemler</h3>
            <button className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Tümünü Gör</button>
          </div>
          <div className="space-y-2">
            {[
              { title: 'Kahve Falı', date: 'Bugün, 14:20', amount: -250, type: 'expense' },
              { title: 'Kredi Yükleme', date: 'Dün, 18:45', amount: 1000, type: 'income' },
              { title: 'Reklam Ödülü', date: '25 Mar, 10:15', amount: 1, type: 'income' }
            ].map((t) => (
              <div key={`${t.title}-${t.date}`} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    t.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {t.type === 'income' ? <Plus className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-50">{t.title}</p>
                    <p className="text-[10px] text-purple-200/40">{t.date}</p>
                  </div>
                </div>
                <span className={`font-bold ${
                  t.type === 'income' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {t.type === 'income' ? '+' : ''}{t.amount}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
