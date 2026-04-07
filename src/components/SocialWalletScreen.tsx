import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Wallet, 
  Sparkles,
  Crown,
  Check,
  ChevronLeft,
  Zap,
  RefreshCw,
  Heart,
  Plus,
  Play,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
  Calendar
} from "lucide-react";
import { UserProfile, AdminWalletConfig, WalletTransaction } from "../types";
import { walletService } from "../lib/walletService";
import { toast } from "sonner";

interface SocialWalletScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
}

export default function SocialWalletScreen({ currentUser, onNavigate }: SocialWalletScreenProps) {
  const [config, setConfig] = useState<AdminWalletConfig | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'market' | 'history'>('market');

  useEffect(() => {
    const fetchData = async () => {
      console.log("[DEBUG] SocialWalletScreen - fetchData started for user:", currentUser.uid);
      try {
        console.log("[DEBUG] SocialWalletScreen - Calling getAdminConfig");
        const configData = await walletService.getAdminConfig();
        console.log("[DEBUG] SocialWalletScreen - getAdminConfig success");
        
        console.log("[DEBUG] SocialWalletScreen - Calling getTransactions");
        const txData = await walletService.getTransactions(currentUser.uid);
        console.log("[DEBUG] SocialWalletScreen - getTransactions success, count:", txData.length);
        
        setConfig(configData);
        setTransactions(txData);
      } catch (error) {
        console.error("[DEBUG] SocialWalletScreen - Error fetching wallet data:", error);
        toast.error("Cüzdan verileri yüklenirken yetki hatası oluştu. Lütfen yönetici ile iletişime geçin.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser.uid]);

  const refreshData = async () => {
    const txData = await walletService.getTransactions(currentUser.uid);
    setTransactions(txData);
  };

  const handleWatchAd = async () => {
    setProcessing(true);
    try {
      const result = await walletService.watchAd(currentUser.uid);
      if (result.success) {
        toast.success(`Tebrikler! ${config?.adRewardEnergy} enerji kazandınız.`);
        refreshData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Reklam izlenirken bir hata oluştu.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePurchaseCoins = async (amount: number, packageId: string) => {
    setProcessing(true);
    try {
      await walletService.purchaseCoins(currentUser.uid, amount, packageId);
      toast.success(`${amount} jeton başarıyla eklendi!`);
      refreshData();
    } catch (error) {
      toast.error("Satın alma işlemi başarısız oldu.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePurchaseSocialRight = async (type: 'superLike' | 'refresh' | 'compatibility') => {
    setProcessing(true);
    try {
      const result = await walletService.purchaseSocialRight(currentUser.uid, type);
      if (result.success) {
        toast.success("Satın alma başarılı!");
        refreshData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("İşlem başarısız oldu.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePurchaseBundle = async (bundleId: string) => {
    setProcessing(true);
    try {
      const result = await walletService.purchaseSocialBundle(currentUser.uid, bundleId);
      if (result.success) {
        toast.success("Paket başarıyla satın alındı!");
        refreshData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("İşlem başarısız oldu.");
    } finally {
      setProcessing(false);
    }
  };

  const handleBuyFortuneSubscription = async (type: 'daily' | 'weekly' | 'monthly') => {
    setProcessing(true);
    try {
      const result = await walletService.buyFortuneSubscription(currentUser.uid, type);
      if (result.success) {
        toast.success("Abonelik başarıyla başlatıldı!");
        refreshData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("İşlem başarısız oldu.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePurchaseSocialSubscription = async (type: 'weekly' | 'monthly') => {
    setProcessing(true);
    try {
      const result = await walletService.purchaseSocialSubscription(currentUser.uid, type);
      if (result.success) {
        toast.success("Social Premium aboneliğiniz başlatıldı!");
        refreshData();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error("Abonelik işlemi başarısız oldu.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading || !config) return null;

  const adProgress = Array.from({ length: config.maxDailyAds }).map((_, i) => i < (currentUser.dailyAdWatchCount || 0));

  return (
    <div className="flex flex-col h-full bg-[#F6F4F8] text-body relative overflow-hidden">
      {/* Header */}
      <header className="relative z-20 header-gradient backdrop-blur-2xl border-b border-black/5 px-6 py-6 flex items-center gap-4">
        <button 
          onClick={() => onNavigate('social-main')}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 text-muted transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-bold text-heading tracking-tight">Mistik Cüzdan</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Ayrıcalıkları Keşfet</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 relative z-10">
        <div className="p-6 space-y-8">
          
          {/* Tabs */}
          <div className="flex p-1 bg-black/5 rounded-2xl">
            <button 
              onClick={() => setActiveTab('market')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'market' ? 'bg-white text-heading shadow-sm' : 'text-muted'}`}
            >
              Market
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${activeTab === 'history' ? 'bg-white text-heading shadow-sm' : 'text-muted'}`}
            >
              Geçmiş
            </button>
          </div>

          {activeTab === 'market' ? (
            <>
              {/* Active Fortune Subscription Card */}
              {currentUser.subscription?.status === 'active' && currentUser.subscription.expiresAt && (
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-[2.5rem] shadow-xl shadow-amber-500/20 text-white space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-20">
                    <Crown className="w-16 h-16" />
                  </div>
                  
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Star className="w-4 h-4 text-amber-200 fill-amber-200" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">Aktif Abonelik</p>
                      </div>
                      <h3 className="text-2xl font-serif font-bold capitalize">
                        {currentUser.subscription.type === 'daily' ? 'Günlük' : currentUser.subscription.type === 'weekly' ? 'Haftalık' : 'Aylık'} Mistik
                      </h3>
                    </div>
                    <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
                      <p className="text-[10px] font-black uppercase tracking-widest">
                        {(() => {
                          const expiresAt = new Date(currentUser.subscription.expiresAt);
                          const now = new Date();
                          const diff = expiresAt.getTime() - now.getTime();
                          if (diff <= 0) return "Süresi Doldu";
                          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                          return `${days}g ${hours}s kaldı`;
                        })()}
                      </p>
                    </div>
                  </div>

                  <div className="relative z-10 grid grid-cols-1 gap-4">
                    <div className="bg-white/10 backdrop-blur-md p-5 rounded-2xl border border-white/10 space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">Günlük Fal Hakkı</p>
                        <p className="text-sm font-bold">{currentUser.subscription.dailyLimit || 10}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">Kullanılan Hak</p>
                        <p className="text-sm font-bold">
                          {(currentUser.subscription.dailyReadingsUsed?.coffee || 0) + 
                           (currentUser.subscription.dailyReadingsUsed?.tarot || 0) + 
                           (currentUser.subscription.dailyReadingsUsed?.advanced || 0)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-white/10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">Kalan Hak</p>
                        <p className="text-lg font-serif font-bold">
                          {Math.max(0, (currentUser.subscription.dailyLimit || 10) - (
                            (currentUser.subscription.dailyReadingsUsed?.coffee || 0) + 
                            (currentUser.subscription.dailyReadingsUsed?.tarot || 0) + 
                            (currentUser.subscription.dailyReadingsUsed?.advanced || 0)
                          ))}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-200" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-100">Limit Sıfırlanma</p>
                      </div>
                      <p className="text-sm font-bold">
                        {(() => {
                          const now = new Date();
                          const tomorrow = new Date(now);
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          tomorrow.setHours(0, 0, 0, 0);
                          const diff = tomorrow.getTime() - now.getTime();
                          const hours = Math.floor(diff / (1000 * 60 * 60));
                          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                          return `${hours}s ${minutes}dk sonra`;
                        })()}
                      </p>
                    </div>
                  </div>

                  {((currentUser.subscription.dailyReadingsUsed?.coffee || 0) + 
                    (currentUser.subscription.dailyReadingsUsed?.tarot || 0) + 
                    (currentUser.subscription.dailyReadingsUsed?.advanced || 0)) >= (currentUser.subscription.dailyLimit || 10) && (
                    <div className="relative z-10 bg-amber-900/20 backdrop-blur-md p-3 rounded-xl border border-amber-400/30 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-400 text-amber-900">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest">Bugünkü fal hakkın doldu</p>
                        <p className="text-[9px] text-amber-100">Yarın gece yarısı yenilenecek.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Balances */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <Wallet className="w-5 h-5 text-indigo-600" />
                    <TrendingUp className="w-4 h-4 text-indigo-200" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Ana Jeton</p>
                    <p className="text-2xl font-serif font-bold text-heading">{currentUser.mainCoins || 0}</p>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <Clock className="w-4 h-4 text-amber-200" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Enerji</p>
                    <p className="text-2xl font-serif font-bold text-heading">{currentUser.energy || 0}</p>
                  </div>
                </div>
              </div>

              {/* Earn Energy Section */}
              <div className="space-y-4">
                <h2 className="text-sm font-black text-muted uppercase tracking-widest px-2">Enerji Kazan</h2>
                <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-6">
                  {/* Ad Progress */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-amber-50 text-amber-600">
                        <Play className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-heading">Reklam İzle</p>
                        <p className="text-[10px] text-muted">Her reklam +{config.adRewardEnergy} Enerji</p>
                      </div>
                    </div>
                    <button 
                      onClick={handleWatchAd}
                      disabled={processing || (currentUser.dailyAdWatchCount || 0) >= config.maxDailyAds}
                      className="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black shadow-lg shadow-amber-500/20 disabled:opacity-50"
                    >
                      İzle
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest">Günlük İlerleme</p>
                      <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{currentUser.dailyAdWatchCount || 0}/{config.maxDailyAds}</p>
                    </div>
                    <div className="flex gap-2">
                      {adProgress.map((filled, i) => (
                        <div 
                          key={i}
                          className={`h-2 flex-1 rounded-full transition-all duration-500 ${filled ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-black/5'}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Daily Login Reward */}
                  <div className="pt-4 border-t border-black/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-heading">Günlük Giriş Ödülü</p>
                        <p className="text-[10px] text-muted">7 gün geçerli +{config.dailyLoginRewardEnergy} Enerji</p>
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-green-50 text-green-600">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Premium Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-sm font-black text-muted uppercase tracking-widest">Social Premium</h2>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-indigo-50 text-indigo-600">
                    <Crown className="w-3 h-3" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Ayrıcalıklı</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {Object.entries(config.socialSubscriptions).map(([key, sub]) => {
                    const isActive = currentUser.socialSubscription?.status === 'active' && 
                                   currentUser.socialSubscription?.type === key &&
                                   new Date(currentUser.socialSubscription?.expiresAt) > new Date();
                    
                    return (
                      <div 
                        key={key}
                        className={`relative overflow-hidden bg-white p-6 rounded-3xl border transition-all ${isActive ? 'border-indigo-500 ring-1 ring-indigo-500/20' : 'border-black/5 shadow-sm'}`}
                      >
                        {isActive && (
                          <div className="absolute top-0 right-0 p-3">
                            <div className="bg-indigo-500 text-white p-1 rounded-full">
                              <Check className="w-3 h-3" />
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-start justify-between mb-4">
                          <div className="space-y-1">
                            <h3 className="text-lg font-serif font-bold text-heading capitalize">
                              {key === 'weekly' ? 'Haftalık' : 'Aylık'} Premium
                            </h3>
                            <p className="text-xs text-muted leading-relaxed max-w-[200px]">
                              {sub.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-serif font-bold text-indigo-600">₺{sub.price}</p>
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                              {key === 'weekly' ? '/ Hafta' : '/ Ay'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-6">
                          <div className="bg-rose-50/50 p-3 rounded-2xl text-center space-y-1">
                            <p className="text-lg font-serif font-bold text-rose-500">{sub.dailyLimits.superLikes}</p>
                            <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest">S. Like</p>
                          </div>
                          <div className="bg-amber-50/50 p-3 rounded-2xl text-center space-y-1">
                            <p className="text-lg font-serif font-bold text-amber-500">{sub.dailyLimits.refreshes}</p>
                            <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Yenileme</p>
                          </div>
                          <div className="bg-indigo-50/50 p-3 rounded-2xl text-center space-y-1">
                            <p className="text-lg font-serif font-bold text-indigo-500">{sub.dailyLimits.compatibility}</p>
                            <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Analiz</p>
                          </div>
                        </div>

                        <button 
                          onClick={() => handlePurchaseSocialSubscription(key as 'weekly' | 'monthly')}
                          disabled={processing || isActive}
                          className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                            isActive 
                            ? 'bg-indigo-50 text-indigo-600 cursor-default' 
                            : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:scale-[1.02] active:scale-[0.98]'
                          }`}
                        >
                          {isActive ? 'Aktif Kullanımda' : 'Şimdi Abone Ol'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Jeton Market */}
              <div className="space-y-4">
                <h2 className="text-sm font-black text-muted uppercase tracking-widest px-2">Jeton Market</h2>
                <div className="grid grid-cols-2 gap-3">
                  {config.coinPackages.map((pkg) => (
                    <button 
                      key={pkg.id}
                      onClick={() => handlePurchaseCoins(pkg.coins + pkg.bonus, pkg.id)}
                      disabled={processing}
                      className="bg-white p-5 rounded-3xl border border-black/5 shadow-sm text-left space-y-3 hover:scale-[1.02] transition-all"
                    >
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <ShoppingBag className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-lg font-serif font-bold text-heading">{pkg.coins} Jeton</p>
                        {pkg.bonus > 0 && <p className="text-[10px] font-black text-green-600">+{pkg.bonus} Bonus</p>}
                      </div>
                      <p className="text-sm font-black text-indigo-600">₺{pkg.price}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Social Rights Section */}
              <div className="space-y-4">
                <h2 className="text-sm font-black text-muted uppercase tracking-widest px-2">Sosyal Market</h2>
                <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                        <Heart className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest">Süper Like</p>
                      <p className="text-lg font-black text-heading">{currentUser.superLikes || 0}</p>
                      <button 
                        onClick={() => handlePurchaseSocialRight('superLike')}
                        className="w-full py-2 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-black"
                      >
                        {config.socialRightsPrices.superLike} J
                      </button>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mx-auto">
                        <RefreshCw className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest">Yenileme</p>
                      <p className="text-lg font-black text-heading">{currentUser.refreshCount || 0}</p>
                      <button 
                        onClick={() => handlePurchaseSocialRight('refresh')}
                        className="w-full py-2 rounded-xl bg-indigo-50 text-indigo-600 text-[10px] font-black"
                      >
                        {config.socialRightsPrices.refresh} J
                      </button>
                    </div>
                    <div className="text-center space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                        <Sparkles className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest">Analiz</p>
                      <p className="text-lg font-black text-heading">{currentUser.compatibilityCount || 0}</p>
                      <button 
                        onClick={() => handlePurchaseSocialRight('compatibility')}
                        className="w-full py-2 rounded-xl bg-amber-50 text-amber-600 text-[10px] font-black"
                      >
                        {config.socialRightsPrices.compatibility} J
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Bundles */}
              <div className="space-y-4">
                <h2 className="text-sm font-black text-muted uppercase tracking-widest px-2">Sosyal Paketler</h2>
                <div className="space-y-4">
                  {config.socialBundles.map((bundle) => (
                    <div key={bundle.id} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm space-y-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4">
                        <Package className="w-12 h-12 text-indigo-50 opacity-50 group-hover:scale-110 transition-transform" />
                      </div>
                      <div className="relative z-10">
                        <h3 className="text-lg font-serif font-bold text-heading">{bundle.name}</h3>
                        <p className="text-xs text-muted mb-4">{bundle.description}</p>
                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-600 text-[10px] font-black">+{bundle.contents.superLikes} Süper Like</span>
                          <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-black">+{bundle.contents.refreshes} Yenileme</span>
                          <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-black">+{bundle.contents.compatibility} Analiz</span>
                          <span className="px-2 py-1 rounded-lg bg-purple-50 text-purple-600 text-[10px] font-black">{bundle.contents.boostDays} Gün Öne Çık</span>
                        </div>
                        <button 
                          onClick={() => handlePurchaseBundle(bundle.id)}
                          disabled={processing}
                          className="w-full py-4 rounded-2xl bg-heading text-white font-black text-sm shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                          {bundle.price} Jeton ile Al
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fortune Subscriptions */}
              <div className="space-y-4">
                <h2 className="text-sm font-black text-muted uppercase tracking-widest px-2">Fal Abonelikleri</h2>
                <div className="space-y-4">
                  {Object.entries(config.fortuneSubscriptions).map(([type, sub]) => (
                    <div key={type} className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm space-y-4 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                      <div className="flex justify-between items-start relative z-10">
                        <div>
                          <h3 className="text-xl font-serif font-bold text-heading capitalize">{type === 'daily' ? 'Günlük' : type === 'weekly' ? 'Haftalık' : 'Aylık'} Mistik</h3>
                          <p className="text-xs text-body">{sub.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-serif font-bold text-amber-600">₺{sub.price}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleBuyFortuneSubscription(type as any)}
                        disabled={processing}
                        className="w-full py-4 rounded-2xl bg-amber-500 text-white font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        Hemen Başlat
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Transaction History Section */
            <div className="space-y-4">
              <h2 className="text-sm font-black text-muted uppercase tracking-widest px-2">İşlem Geçmişi</h2>
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <div className="bg-white p-12 rounded-3xl border border-black/5 text-center space-y-4">
                    <History className="w-12 h-12 text-black/5 mx-auto" />
                    <p className="text-sm text-muted">Henüz bir işlem bulunmuyor.</p>
                  </div>
                ) : (
                  transactions.map((tx) => (
                    <div key={tx.id} className="bg-white p-4 rounded-2xl border border-black/5 flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          tx.type === 'earn' || tx.type === 'purchase' ? 'bg-green-50 text-green-600' : 
                          tx.type === 'expire' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {tx.type === 'earn' || tx.type === 'purchase' ? <ArrowDownLeft className="w-5 h-5" /> : 
                           tx.type === 'expire' ? <Clock className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-heading">{tx.description || 'Cüzdan İşlemi'}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted">{new Date(tx.createdAt).toLocaleDateString('tr-TR')}</p>
                            {tx.expiresAt && (
                              <p className="text-[10px] text-amber-600 font-bold">Skt: {new Date(tx.expiresAt).toLocaleDateString('tr-TR')}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-black ${
                          tx.amount > 0 ? 'text-green-600' : 'text-rose-600'
                        }`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount} {tx.balanceType === 'main' ? 'J' : 'E'}
                        </p>
                        {tx.remainingAmount > 0 && (
                          <p className="text-[10px] text-muted">Kalan: {tx.remainingAmount}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
