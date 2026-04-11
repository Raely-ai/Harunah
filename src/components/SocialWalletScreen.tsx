import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  Calendar,
  X,
  ShieldCheck,
  ZapOff,
  ChevronRight,
  Ticket
} from "lucide-react";
import { UserProfile, WalletTransaction, EconomyConfig } from "../types";
import { walletService } from "../lib/walletService";
import { toast } from "sonner";

interface SocialWalletScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  economyConfig: EconomyConfig | null;
}

export default function SocialWalletScreen({ currentUser, onNavigate, economyConfig }: SocialWalletScreenProps) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'market' | 'history'>('market');
  const [showFortuneSubModal, setShowFortuneSubModal] = useState(false);
  const [showSocialSubModal, setShowSocialSubModal] = useState(false);
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const txData = await walletService.getTransactions(currentUser.uid);
        setTransactions(txData);
      } catch (error) {
        console.error("Error fetching transactions:", error);
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
        toast.success(`Tebrikler! ${config?.rewards?.adRewardEnergy || 10} enerji kazandınız.`);
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

  const handleBuyFortuneSubscription = async (type: 'daily' | 'weekly' | 'monthly') => {
    setProcessing(true);
    try {
      const result = await walletService.buyFortuneSubscription(currentUser.uid, type);
      if (result.success) {
        toast.success("Abonelik başarıyla başlatıldı!");
        setShowFortuneSubModal(false);
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
        setShowSocialSubModal(false);
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

  const handleRedeemPromoCode = async () => {
    if (!promoCode.trim()) return;
    setProcessing(true);
    try {
      const result = await walletService.redeemPromoCode(promoCode);
      if (result.success) {
        toast.success("Kod başarıyla kullanıldı! Ödülleriniz eklendi.");
        setPromoCode("");
        refreshData();
      } else {
        toast.error(result.message || "Kod geçersiz veya süresi dolmuş.");
      }
    } catch (error: any) {
      toast.error(error.message || "Kod kullanılırken bir hata oluştu.");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return null;

  const config: EconomyConfig = (economyConfig || {
    fortunePricing: { 
      coffee: 10, tarot: 15, water: 20, ebced: 25, yildizname: 30, 
      havas: 35, horoscope: 10, dream: 15, extraQuestion: 10, priorityFee: 5 
    },
    rewards: { adRewardEnergy: 10, maxDailyAds: 5, dailyLoginRewardEnergy: 5 },
    coinPackages: [],
    socialPricing: { superLike: [], refresh: [], compatibility: [] },
    fortuneSubscriptions: {
      daily: { priceTRY: 19.99, dailyLimit: 3, description: "Günlük Mistik" },
      weekly: { priceTRY: 99.99, dailyLimit: 5, description: "Haftalık Mistik" },
      monthly: { priceTRY: 299.99, dailyLimit: 10, description: "Aylık Mistik" }
    },
    socialSubscriptions: {
      weekly: { priceTRY: 149.99, description: "Haftalık Premium", dailyLimits: { superLikes: 5, refreshes: 3, compatibility: 2 } },
      monthly: { priceTRY: 449.99, description: "Aylık Premium", dailyLimits: { superLikes: 10, refreshes: 5, compatibility: 5 } }
    },
    interpretationTimes: {} as any,
    energyPaymentEnabled: true,
    subscriptionLimits: { coffee: 3, tarot: 3, advanced: 1 },
    aiSettings: { model: "gemini-pro", temperature: 0.7 }
  }) as EconomyConfig;

  const isFortunePremium = currentUser.subscription?.status === 'active';
  const isSocialPremium = currentUser.socialSubscription?.status === 'active';

  return (
    <div className="flex flex-col h-full bg-[#FDFCFE] text-body relative overflow-hidden">
      {/* Header */}
      <header className="relative z-20 bg-white/80 backdrop-blur-2xl border-b border-black/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('home')} className="p-2 -ml-2 rounded-full hover:bg-black/5 text-muted transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-serif font-bold text-heading tracking-tight">Market</h1>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">Avantajlar Merkezi</p>
          </div>
        </div>
        <button 
          onClick={() => setActiveTab(activeTab === 'market' ? 'history' : 'market')}
          className={`p-2.5 rounded-2xl transition-all ${activeTab === 'history' ? 'bg-indigo-50 text-indigo-600' : 'bg-black/5 text-muted hover:bg-black/10'}`}
        >
          {activeTab === 'market' ? <History className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 relative z-10">
        <div className="p-6 space-y-8">
          
          {/* A) BALANCE SUMMARY */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                      <Wallet className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Ana Jeton</p>
                  </div>
                  <p className="text-2xl font-serif font-bold text-heading">{currentUser.mainCoins || 0}</p>
                </div>
                <div className="w-px h-10 bg-black/5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Enerji</p>
                  </div>
                  <p className="text-2xl font-serif font-bold text-heading">{currentUser.energy || 0}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-tighter italic leading-none">"Bugün enerjin yüksek"</p>
              </div>
            </div>

            {(isFortunePremium || isSocialPremium) && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-black/5">
                {isFortunePremium && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                    <Crown className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Fal Premium</span>
                  </div>
                )}
                {isSocialPremium && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                    <Star className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Sosyal Premium</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {activeTab === 'market' ? (
            <>
              {/* B) PREMIUM / SUBSCRIPTIONS (TL) */}
              <div className="space-y-4">
                <h2 className="text-xs font-black text-muted uppercase tracking-widest px-2 flex items-center gap-2">
                  <Crown className="w-3.5 h-3.5" />
                  Premium Paketler (TL)
                </h2>

                {/* Fortune Premium Hero Card */}
                <motion.div 
                  whileHover={{ y: -4 }}
                  className={`relative overflow-hidden p-8 rounded-[3rem] shadow-2xl transition-all border ${
                    isFortunePremium 
                    ? 'bg-gradient-to-br from-amber-50 to-white border-amber-200 shadow-amber-500/5' 
                    : 'bg-gradient-to-br from-purple-700 via-indigo-800 to-amber-600 border-white/10 text-white shadow-indigo-900/20'
                  }`}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Crown className="w-32 h-32 rotate-12" />
                  </div>

                  <div className="relative z-10 space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${isFortunePremium ? 'bg-amber-100 text-amber-600' : 'bg-white/20 backdrop-blur-md text-amber-300'}`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isFortunePremium ? 'text-amber-600' : 'text-amber-200'}`}>
                          {isFortunePremium ? 'Premium Aktif' : 'Sınırsız Kehanet Paketi'}
                        </span>
                      </div>
                      <h2 className={`text-3xl font-serif font-bold leading-tight ${isFortunePremium ? 'text-heading' : 'text-white'}`}>
                        {isFortunePremium ? 'Mistik Ayrıcalık' : 'Fal Deneyimini\nGüçlendir'}
                      </h2>
                      {!isFortunePremium && (
                        <p className="text-xs text-white/70 leading-relaxed max-w-[240px]">
                          Fal deneyimini hızlandıran ve güçlendiren premium üyelik.
                        </p>
                      )}
                    </div>

                    {isFortunePremium ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center px-1">
                            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Günlük Fal Hakkı</p>
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                              {(() => {
                                const used = (currentUser.subscription?.dailyReadingsUsed?.coffee || 0) + 
                                             (currentUser.subscription?.dailyReadingsUsed?.tarot || 0) + 
                                             (currentUser.subscription?.dailyReadingsUsed?.advanced || 0);
                                const limit = currentUser.subscription?.dailyLimit || 10;
                                return `${used}/${limit}`;
                              })()}
                            </p>
                          </div>
                          <div className="h-2.5 bg-black/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(( (currentUser.subscription?.dailyReadingsUsed?.coffee || 0) + (currentUser.subscription?.dailyReadingsUsed?.tarot || 0) + (currentUser.subscription?.dailyReadingsUsed?.advanced || 0) ) / (currentUser.subscription?.dailyLimit || 10)) * 100}%` }}
                              className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          `Günde ${config?.fortuneSubscriptions?.monthly?.dailyLimit || 10} fal hakkı`,
                          "Öncelikli yorum sırası",
                          "Daha detaylı analiz",
                          "Beklemeden yorum"
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                              <Check className="w-3 h-3 text-amber-300" />
                            </div>
                            <span className="text-sm font-medium text-white/90">{item}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isFortunePremium && (
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowFortuneSubModal(true)}
                        className="w-full py-5 rounded-[2rem] bg-white text-indigo-900 font-black text-sm shadow-xl flex items-center justify-center gap-2 group"
                      >
                        Hemen Başlat
                        <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </motion.button>
                    )}
                  </div>
                </motion.div>

                {/* Social Premium Card */}
                <motion.div 
                  whileHover={{ y: -4 }}
                  onClick={() => !isSocialPremium && setShowSocialSubModal(true)}
                  className={`relative overflow-hidden p-6 rounded-[2.5rem] border transition-all cursor-pointer ${
                    isSocialPremium ? 'bg-white border-indigo-200 shadow-sm' : 'bg-white border-black/5 shadow-sm hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-3xl flex items-center justify-center ${isSocialPremium ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Star className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-lg font-serif font-bold text-heading">Sosyal Premium</h3>
                        <p className="text-[10px] text-muted uppercase tracking-widest">
                          {isSocialPremium ? 'Ayrıcalıkların Tadını Çıkar' : 'Keşfette Öne Çık'}
                        </p>
                      </div>
                    </div>
                    {isSocialPremium ? (
                      <div className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Aktif</div>
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center text-muted"><Plus className="w-5 h-5" /></div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* C) JETON SATIN AL (TL) */}
              <div className="space-y-4">
                <h2 className="text-xs font-black text-muted uppercase tracking-widest px-2 flex items-center gap-2">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Jeton Paketleri (TL)
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  {(config?.coinPackages || []).map((pkg, i) => (
                    <motion.button 
                      key={pkg.id}
                      whileHover={{ y: -4, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePurchaseCoins(pkg.coins + pkg.bonus, pkg.id)}
                      disabled={processing}
                      className="relative bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm text-center space-y-4 group overflow-hidden"
                    >
                      {pkg.bonus > 0 && (
                        <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest z-10">
                          %{Math.round((pkg.bonus / pkg.coins) * 100)} BONUS
                        </div>
                      )}
                      <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto group-hover:scale-110 transition-transform">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xl font-serif font-bold text-heading">{pkg.coins} Jeton</p>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Paket ID: {pkg.id}</p>
                      </div>
                      <div className="pt-2">
                        <p className="text-lg font-black text-indigo-600">₺{pkg.priceTRY}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* JETON SATIN AL (TL) SECTION ... */}

              {/* PROMO CODE SECTION */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Ticket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-heading">Promosyon Kodu</h3>
                    <p className="text-[10px] text-muted uppercase tracking-widest">Özel ödülleri topla</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="KODUNU BURAYA YAZ"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-black/5 border-none rounded-2xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-muted/50"
                  />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleRedeemPromoCode}
                    disabled={processing || !promoCode.trim()}
                    className="px-6 py-3 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                  >
                    Kullan
                  </motion.button>
                </div>
              </div>

              {/* D) FREE ENERGY (EARN) */}
              <div className="space-y-4">
                <h2 className="text-xs font-black text-muted uppercase tracking-widest px-2 flex items-center gap-2">
                  <Zap className="w-3.5 h-3.5" />
                  Ücretsiz Enerji Topla
                </h2>
                <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm space-y-6 relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-serif font-bold text-heading">Bugünkü Enerjini Topla</h3>
                      <p className="text-[10px] text-muted uppercase tracking-widest">Dopamin etkisini hisset</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 text-amber-600"><Zap className="w-6 h-6" /></div>
                  </div>
                  <div className="space-y-4 relative z-10">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/5 p-4 rounded-2xl space-y-1">
                        <div className="flex items-center gap-2 text-amber-600"><Play className="w-3 h-3" /><p className="text-[10px] font-black uppercase tracking-widest">Reklam</p></div>
                        <p className="text-sm font-bold">+{config?.rewards?.adRewardEnergy || 0} Enerji</p>
                      </div>
                      <div className="bg-black/5 p-4 rounded-2xl space-y-1">
                        <div className="flex items-center gap-2 text-indigo-600"><Calendar className="w-3 h-3" /><p className="text-[10px] font-black uppercase tracking-widest">Günlük</p></div>
                        <p className="text-sm font-bold">+{config?.rewards?.dailyLoginRewardEnergy || 0} Enerji</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <p className="text-[10px] font-black text-muted uppercase tracking-widest">Günlük Hak</p>
                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{currentUser.dailyAdWatchCount || 0}/{config?.rewards?.maxDailyAds || 5}</p>
                      </div>
                      <div className="h-2.5 bg-black/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${((currentUser.dailyAdWatchCount || 0) / (config?.rewards?.maxDailyAds || 5)) * 100}%` }} className="h-full bg-gradient-to-r from-amber-400 to-amber-600" />
                      </div>
                    </div>
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleWatchAd} disabled={processing || (currentUser.dailyAdWatchCount || 0) >= (config?.rewards?.maxDailyAds || 5)} className="w-full py-4 rounded-2xl bg-amber-500 text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 disabled:opacity-50">Enerji Topla</motion.button>
                  </div>
                </div>
              </div>

              {/* E) SOSYAL MARKET (COINS) */}
              <div className="space-y-4">
                <h2 className="text-xs font-black text-muted uppercase tracking-widest px-2 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Sosyal Market (Jeton)
                </h2>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { type: 'superLike' as const, icon: Heart, color: 'rose', label: 'Süper Like', desc: 'Daha fazla görün', count: currentUser.superLikes || 0, pricing: config?.socialPricing?.superLike || [] },
                    { type: 'refresh' as const, icon: RefreshCw, color: 'indigo', label: 'Yenileme', desc: 'Keşfette öne çık', count: currentUser.refreshCount || 0, pricing: config?.socialPricing?.refresh || [] },
                    { type: 'compatibility' as const, icon: Sparkles, color: 'amber', label: 'Uyum Analizi', desc: 'Uyumunuzu gör', count: currentUser.compatibilityCount || 0, pricing: config?.socialPricing?.compatibility || [] }
                  ].map((item) => (
                    <div key={item.type} className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm flex items-center justify-between group">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-3xl bg-${item.color}-50 text-${item.color}-500 flex items-center justify-center group-hover:scale-110 transition-transform`}><item.icon className="w-7 h-7" /></div>
                        <div>
                          <h3 className="text-sm font-bold text-heading">{item.label}</h3>
                          <p className="text-[10px] text-muted uppercase tracking-widest">{item.desc}</p>
                          <p className={`text-[10px] font-black text-${item.color}-500 mt-1`}>Mevcut: {item.count}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {(item.pricing || []).map(pkg => (
                          <button key={pkg.id} onClick={() => handlePurchaseSocialRight(item.type)} className={`px-4 py-2 rounded-xl bg-${item.color}-50 text-${item.color}-600 text-[10px] font-black border border-${item.color}-100`}>
                            {pkg.count} Adet: {pkg.priceCoins} J
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* TRANSACTION HISTORY */
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h2 className="text-xs font-black text-muted uppercase tracking-widest">İşlem Geçmişi</h2>
                <button onClick={refreshData} className="p-2 rounded-full hover:bg-black/5 text-muted transition-colors"><RefreshCw className="w-4 h-4" /></button>
              </div>
              <div className="space-y-3">
                {transactions.length === 0 ? (
                  <div className="bg-white p-12 rounded-[2.5rem] border border-black/5 text-center space-y-4">
                    <History className="w-12 h-12 text-black/5 mx-auto" /><p className="text-sm text-muted">Henüz bir işlem bulunmuyor.</p>
                  </div>
                ) : (
                  transactions.map((tx, i) => (
                    <motion.div key={tx.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="bg-white p-5 rounded-3xl border border-black/5 flex items-center justify-between group hover:border-indigo-200 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tx.type === 'earn' || tx.type === 'purchase' ? 'bg-green-50 text-green-600' : tx.type === 'expire' ? 'bg-rose-50 text-rose-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          {tx.type === 'earn' || tx.type === 'purchase' ? <ArrowDownLeft className="w-6 h-6" /> : tx.type === 'expire' ? <Clock className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-heading">{tx.description || 'Cüzdan İşlemi'}</p>
                          <p className="text-[10px] text-muted">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('tr-TR') : '-'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black ${(tx.amount || 0) > 0 ? 'text-green-600' : 'text-rose-600'}`}>{(tx.amount || 0) > 0 ? '+' : ''}{tx.amount || 0}{tx.balanceType === 'main' ? 'J' : 'E'}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {showFortuneSubModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFortuneSubModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-lg bg-white rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1"><h3 className="text-2xl font-serif font-bold text-heading">Sınırsız Kehanet</h3><p className="text-xs text-muted">Sana en uygun paketi seç</p></div>
                  <button onClick={() => setShowFortuneSubModal(false)} className="p-2 rounded-full bg-black/5 text-muted"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  {Object.entries(config?.fortuneSubscriptions || {}).map(([type, sub]: [string, any]) => (
                    <button key={type} onClick={() => handleBuyFortuneSubscription(type as any)} className="w-full relative overflow-hidden bg-white p-6 rounded-[2rem] border border-black/5 shadow-sm text-left group hover:border-amber-300 transition-all">
                      {type === 'monthly' && <div className="absolute top-0 right-0 bg-amber-500 text-white px-4 py-1 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest">En Avantajlı</div>}
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <h4 className="text-lg font-serif font-bold text-heading capitalize">{type === 'daily' ? 'Günlük' : type === 'weekly' ? 'Haftalık' : 'Aylık'} Mistik</h4>
                          <p className="text-[10px] text-muted uppercase tracking-widest">Günde {sub?.dailyLimit || 0} Fal Hakkı</p>
                          <p className="text-xs text-body mt-2">{sub?.description || ''}</p>
                        </div>
                        <div className="text-right"><p className="text-2xl font-serif font-bold text-amber-600">₺{sub?.priceTRY || 0}</p></div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-50 text-indigo-600"><ShieldCheck className="w-5 h-5 flex-shrink-0" /><p className="text-[10px] font-medium leading-relaxed">Aboneliğin Google Play hesabın üzerinden yönetilir. İstediğin zaman iptal edebilirsin.</p></div>
              </div>
            </motion.div>
          </div>
        )}

        {showSocialSubModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSocialSubModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-lg bg-white rounded-[3rem] overflow-hidden shadow-2xl">
              <div className="p-8 space-y-8">
                <div className="flex justify-between items-start">
                  <div className="space-y-1"><h3 className="text-2xl font-serif font-bold text-heading">Sosyal Premium</h3><p className="text-xs text-muted">Keşfette yıldızın parlasın</p></div>
                  <button onClick={() => setShowSocialSubModal(false)} className="p-2 rounded-full bg-black/5 text-muted"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  {Object.entries(config?.socialSubscriptions || {}).map(([key, sub]: [string, any]) => (
                    <button key={key} onClick={() => handlePurchaseSocialSubscription(key as any)} className="w-full relative overflow-hidden bg-white p-6 rounded-[2rem] border border-black/5 shadow-sm text-left group hover:border-indigo-300 transition-all">
                      <div className="flex justify-between items-center mb-4">
                        <div className="space-y-1"><h4 className="text-lg font-serif font-bold text-heading capitalize">{key === 'weekly' ? 'Haftalık' : 'Aylık'} Premium</h4><p className="text-xs text-body">{sub?.description || ''}</p></div>
                        <div className="text-right"><p className="text-2xl font-serif font-bold text-indigo-600">₺{sub?.priceTRY || 0}</p></div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-rose-50/50 p-3 rounded-2xl text-center"><p className="text-sm font-bold text-rose-600">{sub?.dailyLimits?.superLikes || 0}</p><p className="text-[8px] font-black text-muted uppercase tracking-widest">S. Like</p></div>
                        <div className="bg-indigo-50/50 p-3 rounded-2xl text-center"><p className="text-sm font-bold text-indigo-600">{sub?.dailyLimits?.refreshes || 0}</p><p className="text-[8px] font-black text-muted uppercase tracking-widest">Yenileme</p></div>
                        <div className="bg-amber-50/50 p-3 rounded-2xl text-center"><p className="text-sm font-bold text-amber-600">{sub?.dailyLimits?.compatibility || 0}</p><p className="text-[8px] font-black text-muted uppercase tracking-widest">Analiz</p></div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-indigo-50 text-indigo-600"><ShieldCheck className="w-5 h-5 flex-shrink-0" /><p className="text-[10px] font-medium leading-relaxed">Aboneliğin Google Play hesabın üzerinden yönetilir. İstediğin zaman iptal edebilirsin.</p></div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
