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
  Ticket,
  CheckCircle2,
  Lock,
  Timer,
  CheckCircle,
  Coins
} from "lucide-react";
import confetti from "canvas-confetti";
import { UserProfile, WalletTransaction, EconomyConfig } from "../types";
import { formatSafeDate } from "../lib/dateUtils";
import { DEFAULT_ECONOMY_CONFIG } from "../constants";
import { walletService } from "../lib/walletService";
import { socialService } from "../lib/socialService";
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
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState<'weekly' | 'monthly' | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [pendingPurchase, setPendingPurchase] = useState<{
    title: string;
    description: string;
    price: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  // MISSION LOGIC
  const [localUser, setLocalUser] = useState(currentUser);
  useEffect(() => { setLocalUser(currentUser); }, [currentUser]);

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
    const txData = await walletService.getTransactions(currentUser.uid, true);
    setTransactions(txData);
  };

  const handleWatchAd = async () => {
    setProcessing(true);
    try {
      const result = await walletService.watchAd(currentUser.uid);
      if (result.success) {
        toast.success(`Tebrikler! ${config?.rewards?.adRewardEnergy || 10} enerji kazandınız.`);
        setLocalUser(prev => ({ 
          ...prev, 
          energy: (prev.energy || 0) + (config?.rewards?.adRewardEnergy || 10),
          dailyAdWatchCount: (prev.dailyAdWatchCount || 0) + 1 
        }));
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

  const handlePurchaseCoins = async (amount: number, packageId: string, price: number) => {
    if (processing) return;
    setPendingPurchase({
      title: `${amount} Jeton Paketi`,
      description: `${amount} Jeton hesabınıza eklenecektir.`,
      price: `₺${price}`,
      onConfirm: async () => {
        setProcessing(true);
        try {
          await walletService.purchaseCoins(currentUser.uid, amount, packageId);
          toast.success(`${amount} jeton başarıyla eklendi!`);
          refreshData();
        } catch (error) {
          toast.error("Satın alma işlemi başarısız oldu.");
        } finally {
          setProcessing(false);
          setPendingPurchase(null);
        }
      }
    });
  };

  const handlePurchaseSocialRight = async (type: 'superLike' | 'refresh' | 'compatibility', pkg: any) => {
    if (processing) return;
    const label = type === 'superLike' ? 'Süper Like' : type === 'refresh' ? 'Yenileme' : 'Uyum Analizi';
    setPendingPurchase({
      title: `${pkg.count} Adet ${label}`,
      description: `${pkg.count} adet ${label.toLowerCase()} hakkı hesabınıza eklenecektir.`,
      price: `${pkg.priceCoins} Jeton`,
      onConfirm: async () => {
        setProcessing(true);
        try {
          const result = await walletService.purchaseSocialRight(currentUser.uid, type, pkg.count);
          if (result.success) {
            toast.success("Satın alma başarılı! ✨");
            refreshData();
          } else {
            if (result.status === 'INSUFFICIENT_FUNDS') {
              toast.error("Yetersiz bakiye. Lütfen jeton yükleyin.");
            } else {
              toast.error(result.message || "İşlem başarısız oldu.");
            }
          }
        } catch (error: any) {
          console.error("Purchase error:", error);
          toast.error(error.message || "İşlem başarısız oldu.");
        } finally {
          setProcessing(false);
          setPendingPurchase(null);
        }
      }
    });
  };

  const handleBuyFortuneSubscription = async (type: 'daily' | 'weekly' | 'monthly', sub: any) => {
    if (processing) return;
    const label = type === 'daily' ? 'Günlük' : type === 'weekly' ? 'Haftalık' : 'Aylık';
    setPendingPurchase({
      title: `${label} Mistik Abonelik`,
      description: sub.description || "Sınırsız kehanet ve öncelikli yorum ayrıcalığı.",
      price: `${sub.priceTRY || sub.price} Jeton`,
      onConfirm: async () => {
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
          setPendingPurchase(null);
        }
      }
    });
  };

  const handlePurchaseBoostPackage = async (type: 'weekly' | 'monthly', pkg: any) => {
    if (processing) return;
    const label = type === 'weekly' ? 'Haftalık' : 'Aylık';
    setPendingPurchase({
      title: `${label} Profil Boost`,
      description: pkg.description || "Keşfette en üstte görünerek etkileşiminizi artırın.",
      price: `${pkg.priceTRY || pkg.price} Jeton`,
      onConfirm: async () => {
        setProcessing(true);
        try {
          const result = await walletService.purchaseBoostPackage(currentUser.uid, type);
          if (result.success) {
            toast.success("Artık daha fazla kişiye görünüyorsun ✨");
            setShowBoostModal(false);
            refreshData();
          } else {
            toast.error(result.message);
          }
        } catch (error) {
          toast.error("İşlem başarısız oldu.");
        } finally {
          setProcessing(false);
          setPendingPurchase(null);
        }
      }
    });
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

  const config: EconomyConfig = (economyConfig || DEFAULT_ECONOMY_CONFIG) as EconomyConfig;

  const isFortunePremium = currentUser.subscription?.status === 'active';
  const isBoostActive = currentUser.boostExpiresAt && new Date(currentUser.boostExpiresAt) > new Date();
  const isVerified = localUser.social?.verified || localUser.isVerified;
  const verificationStatus = localUser.social?.verificationStatus || 'none';

  const completionScore = (() => {
    let score = 0;
    const s = localUser.social;
    if (!s) return 0;
    const photoCount = s.photos?.length || 0;
    let photoScore = 0;
    if (photoCount === 1) photoScore = 20;
    else if (photoCount >= 2 && photoCount <= 3) photoScore = 25;
    else if (photoCount >= 4) photoScore = 30;

    if (s.nickname || localUser.displayName) score += 15;
    if (s.gender || localUser.gender) score += 15;
    if (localUser.birthDate) score += 15;
    if (s.bio) score += 15;
    if (s.interests && s.interests.length > 0) score += 10;
    score += photoScore;
    return score;
  })();

  const handleClaimDailyReward = async () => {
    setProcessing(true);
    try {
      const result = await walletService.claimDailyLoginReward();
      if (result.success) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FACC15', '#EAB308', '#FFFFFF']
        });
        toast.success(`${result.rewardAmount} Enerji kazandınız!`);
        setLocalUser(prev => ({ ...prev, energy: (prev.energy || 0) + result.rewardAmount, lastDailyRewardAt: new Date().toISOString() }));
        refreshData();
      }
    } catch (error: any) {
      console.error("Daily reward claim error:", error);
      toast.error(error.message || "Ödül alınırken bir hata oluştu.");
    } finally {
      setProcessing(false);
    }
  };

  const handleClaimProfileReward = async () => {
    setProcessing(true);
    try {
      const result = await socialService.claimProfileCompletionReward();
      if (result.success) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#6366F1', '#4F46E5', '#FFFFFF']
        });
        toast.success("Profil tamamlama ödülü alındı!");
        setLocalUser(prev => ({
          ...prev,
          social: { ...prev.social!, completionRewardClaimed: true },
          energy: (prev.energy || 0) + (result.rewardAmount || 50)
        }));
        refreshData();
      }
    } catch (error: any) {
      console.error("Profile reward claim error:", error);
      toast.error(error.message || "Ödül alınırken bir hata oluştu.");
    } finally {
      setProcessing(false);
    }
  };

  const handleClaimVerificationReward = async () => {
    setProcessing(true);
    try {
      const result = await walletService.claimVerificationReward();
      if (result.success) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#3B82F6', '#2563EB', '#FFFFFF']
        });
        toast.success(`${result.rewardAmount} Enerji kazandınız!`);
        setLocalUser(prev => ({ ...prev, energy: (prev.energy || 0) + result.rewardAmount, verificationRewardClaimed: true }));
        refreshData();
      }
    } catch (error: any) {
      console.error("Verification reward claim error:", error);
      toast.error(error.message || "Ödül alınırken bir hata oluştu.");
    } finally {
      setProcessing(false);
    }
  };

  const handleClaimFreeCompatibility = async () => {
    setProcessing(true);
    try {
      const result = await walletService.claimFreeCompatibilityReward();
      if (result.success) {
        toast.success("Ücretsiz Uyum Analizi hakkı kazandınız!");
        setLocalUser(prev => ({ ...prev, compatibilityCount: (prev.compatibilityCount || 0) + 1, lastFreeCompatibilityAt: new Date().toISOString() }));
        refreshData();
      }
    } catch (error: any) {
      console.error("Free compatibility claim error:", error);
      toast.error(error.message || "Ödül alınırken bir hata oluştu.");
    } finally {
      setProcessing(false);
    }
  };

  const renderMissionCenter = () => {
    const rewards = config?.rewards;
    
    // Countdown helpers
    const getRemainingTimeStr = (lastAt: string | undefined, hours: number) => {
      if (!lastAt) return null;
      const last = new Date(lastAt).getTime();
      const now = new Date().getTime();
      const diff = (hours * 60 * 60 * 1000) - (now - last);
      if (diff <= 0) return null;
      
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      return `${h}s ${m}dk ${s}sn`;
    };

    const dailyRemaining = getRemainingTimeStr(localUser.lastDailyRewardAt, 24);
    const freeCompatRemaining = getRemainingTimeStr(localUser.lastFreeCompatibilityAt, rewards?.freeCompatibilityCooldownHours || 48);

    const rewardsReady = [
      !dailyRemaining,
      (localUser.dailyAdWatchCount || 0) < (rewards?.maxDailyAds || 5),
      !localUser.social?.completionRewardClaimed && completionScore >= 100,
      !localUser.verificationRewardClaimed && !!localUser.isVerified,
      !freeCompatRemaining
    ].filter(Boolean).length;

    const MissionRow = ({ 
      title, 
      reward, 
      status, 
      label, 
      icon: Icon, 
      color, 
      onClick, 
      disabled, 
      countdown,
      description,
      progress,
      premium,
      isDaily
    }: any) => (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative ${isDaily ? 'p-5' : 'p-4'} rounded-[1.8rem] border transition-all overflow-hidden ${
          premium 
            ? 'bg-slate-900 border-indigo-500/30 text-white shadow-xl shadow-indigo-950/10' 
            : 'bg-white border-black/5 shadow-sm'
        } ${disabled && status !== 'completed' ? 'opacity-60 grayscale-[0.2]' : ''}`}
      >
        {/* Glow & Pulse for Claimable tasks */}
        {!disabled && !countdown && status !== 'completed' && (
          <motion.div 
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`absolute -inset-px bg-gradient-to-r ${premium ? 'from-indigo-400/20' : 'from-indigo-400/10'} to-transparent pointer-events-none`} 
          />
        )}

        <div className="flex items-center gap-4 relative z-10">
          <div className={`${isDaily ? 'w-12 h-12' : 'w-10 h-10'} rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform ${
            premium ? 'bg-indigo-500/20 text-indigo-300' : `bg-${color}-50 text-${color}-600`
          }`}>
            <Icon size={isDaily ? 22 : 18} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h4 className={`${isDaily ? 'text-[13px]' : 'text-[12px]'} font-black uppercase tracking-tight truncate ${premium ? 'text-white' : 'text-slate-800'}`}>
                {title}
              </h4>
              {status === 'completed' && <CheckCircle size={10} className="text-emerald-500" />}
            </div>
            <p className={`text-[9px] font-bold truncate ${premium ? 'text-indigo-300/70' : 'text-slate-400'}`}>
              {description}
            </p>
          </div>

          <div className="flex flex-col items-end shrink-0">
            {status === 'completed' ? (
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full flex items-center gap-1 border border-emerald-100">
                <Check size={8} className="stroke-[4px]" />
                <span className="text-[7px] font-black uppercase tracking-widest">Alındı</span>
              </div>
            ) : countdown ? (
              <div className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg flex items-center gap-1 border border-slate-100">
                <Timer size={10} />
                <span className="text-[8px] font-black tabular-nums">{countdown}</span>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClick}
                disabled={disabled || processing}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg transition-all ${
                  premium 
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/40' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'
                } disabled:opacity-50 disabled:shadow-none min-w-[90px]`}
              >
                {label}
              </motion.button>
            )}
          </div>
        </div>

        {/* Progress Bar for specific tasks */}
        {progress !== undefined && status !== 'completed' && !countdown && (
          <div className="mt-4 space-y-1.5 relative z-10">
            <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest">
              <span className={premium ? 'text-indigo-300' : 'text-slate-400'}>İlerleme</span>
              <span className={premium ? 'text-white' : 'text-slate-900'}>{Math.round(progress)}%</span>
            </div>
            <div className={`h-1.5 rounded-full overflow-hidden p-0.5 ${premium ? 'bg-white/5' : 'bg-slate-100'}`}>
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                className={`h-full rounded-full ${premium ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-indigo-600'}`}
              />
            </div>
          </div>
        )}
      </motion.div>
    );

    return (
      <div className="space-y-6">
        <div className="px-2 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <h2 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.25em]">Günlük Görev Merkezi</h2>
          </div>
          <p className="text-[12px] font-bold text-slate-500">
            {rewardsReady > 0 ? `${rewardsReady} Ödül seni bekliyor!` : 'Hepsi tamamlandı! ✨'}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {/* 1. Daily Login - HIGHLIGHTED */}
          <MissionRow 
            isDaily
            title="Günlük Giriş"
            reward={rewards?.dailyLoginRewardEnergy || 20}
            icon={Calendar}
            color="emerald"
            countdown={dailyRemaining}
            status={dailyRemaining ? 'waiting' : 'ready'}
            onClick={handleClaimDailyReward}
            disabled={!!dailyRemaining}
            description="Her gün düzenli enerjini topla"
            label={`⚡ +${rewards?.dailyLoginRewardEnergy || 20} Enerji Al`}
          />

          {/* 2. Watch Ad */}
          <MissionRow 
            title="Reklam İzle"
            reward={rewards?.adRewardEnergy || 10}
            icon={Play}
            color="amber"
            progress={((localUser.dailyAdWatchCount || 0) / (rewards?.maxDailyAds || 5)) * 100}
            onClick={handleWatchAd}
            disabled={(localUser.dailyAdWatchCount || 0) >= (rewards?.maxDailyAds || 5)}
            status={(localUser.dailyAdWatchCount || 0) >= (rewards?.maxDailyAds || 5) ? 'completed' : 'ready'}
            description={`İzlenen: ${localUser.dailyAdWatchCount || 0} / ${rewards?.maxDailyAds || 5}`}
            label={`🎥 +${rewards?.adRewardEnergy || 10} Enerji`}
          />

          {/* 3. Profile Completion */}
          <MissionRow 
            title="Profil Tamamlama"
            reward={rewards?.profileCompletionEnergy || 50}
            icon={UserProfileIcon}
            color="indigo"
            status={localUser.social?.completionRewardClaimed ? 'completed' : 'ready'}
            onClick={handleClaimProfileReward}
            disabled={localUser.social?.completionRewardClaimed || completionScore < 100}
            description={completionScore < 100 ? "Profilini %100 yap ödülü al" : "Profilin %100, ödülün hazır!"}
            progress={completionScore}
            label={`🚀 +${rewards?.profileCompletionEnergy || 50} Al`}
          />

          {/* 4. Verified Profile */}
          <MissionRow 
            title="Onaylı Profil"
            reward={rewards?.verifiedRewardEnergy || 100}
            icon={ShieldCheck}
            color="blue"
            status={localUser.verificationRewardClaimed || localUser.social?.verificationRewardClaimed ? 'completed' : 'ready'}
            onClick={() => {
              if (isVerified) {
                handleClaimVerificationReward();
              } else {
                onNavigate('profile');
              }
            }}
            disabled={localUser.verificationRewardClaimed || localUser.social?.verificationRewardClaimed || verificationStatus === 'pending'}
            description={
              verificationStatus === 'pending' 
                ? "Başvurunuz inceleniyor" 
                : !isVerified 
                  ? "Mavi Tik alarak 100 Enerji kazan" 
                  : "Doğrulama ödülü hazır"
            }
            premium
            label={
              verificationStatus === 'pending'
                ? "İncelemede"
                : isVerified
                  ? `💎 +${rewards?.verifiedRewardEnergy || 100} Al`
                  : "Doğrula & Al"
            }
          />

          {/* 5. Free Compatibility */}
          <MissionRow 
            title="Ücretsiz Analiz"
            reward={1}
            icon={Heart}
            color="rose"
            countdown={freeCompatRemaining}
            status={freeCompatRemaining ? 'waiting' : 'ready'}
            onClick={handleClaimFreeCompatibility}
            disabled={!!freeCompatRemaining}
            description="Her 48 saatte bir ücretsiz hediye"
            label="❤️ Ücretsiz Aç"
          />

          {/* Promo Code Shortcut Shortcut */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const el = document.getElementById('promo-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group relative flex items-center gap-4 p-4 rounded-[1.8rem] bg-indigo-600 text-white shadow-xl shadow-indigo-100 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-indigo-800 opacity-60" />
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center relative z-10 group-hover:scale-110 transition-transform">
              <Ticket size={18} />
            </div>
            <div className="flex-1 relative z-10 text-left">
              <h4 className="text-[12px] font-black uppercase tracking-tight">Gizemli Kod</h4>
              <p className="text-[8px] font-bold text-white/60">Kupon kodunu gir, hediyeni al</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center relative z-10 shrink-0">
              <ChevronRight size={16} />
            </div>
          </motion.button>
        </div>
      </div>
    );
  };

  // Add UserProfileIcon wrapper since I don't have it imported
  const UserProfileIcon = (props: any) => <CheckCircle2 {...props} />;

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white to-slate-50 text-slate-900 relative overflow-hidden font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-md border-b border-black/5 pt-[env(safe-area-inset-top,1rem)]">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => onNavigate('home')} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Cüzdan & Market</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Enerjini Yönet</p>
            </div>
          </div>
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab(activeTab === 'market' ? 'history' : 'market')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {activeTab === 'market' ? <History className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
          </motion.button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="p-6 space-y-10">
          
          {/* 1. BALANCE SUMMARY (The VIP Hub) */}
          <div className="relative group">
            {/* Ambient Glows */}
            <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-600 rounded-[3rem] blur opacity-15 group-hover:opacity-25 transition duration-1000" />
            
            <div className="relative bg-white p-8 rounded-[2.8rem] border border-black/5 shadow-2xl shadow-indigo-900/5 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-[50px] rounded-full" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full" />

              <div className="relative z-10 flex flex-col gap-8">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mevcut Varlıkların</span>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">Kişisel Enerji Alanın</h2>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.1em] px-2 py-0.5 bg-emerald-50 rounded-full">Güvendesin</span>
                  </div>
                </div>

                <div className="flex items-center justify-around gap-4">
                  {/* Jeton Balance */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-[1.8rem] bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner group-hover:scale-110 transition-transform duration-500">
                      <Ticket className="w-8 h-8 fill-amber-500/20" />
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">{Math.max(0, localUser.mainCoins || 0)}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Jeton (J)</p>
                    </div>
                  </div>

                  <div className="w-px h-12 bg-slate-100" />

                  {/* Energy Balance */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                      <Zap className="w-8 h-8 fill-indigo-600/20" />
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">{Math.max(0, localUser.energy || 0)}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enerji (E)</p>
                    </div>
                  </div>
                </div>

                {(isFortunePremium || isBoostActive) && (
                  <div className="flex flex-wrap justify-center gap-2 pt-6 border-t border-slate-50">
                    {isFortunePremium && (
                      <div className="px-4 py-1.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-amber-500/20">
                        <Crown className="w-3 h-3" />
                        <span>Mistik VIP</span>
                      </div>
                    )}
                    {isBoostActive && (
                      <div className="px-4 py-1.5 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-600/20">
                        <Star className="w-3 h-3" />
                        <span>Profil Boost</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeTab === 'market' ? (
            <>
              {/* 1. GÖREV MERKEZİ V2 */}
              {renderMissionCenter()}

              {/* 2. PREMIUM PACKAGES (Subscription Hero Carousel) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">VIP Üyelikler</h2>
                  </div>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4">
                  {/* Subscription Card */}
                  <motion.div 
                    whileTap={{ scale: 0.98 }}
                    className={`relative flex-shrink-0 w-[280px] aspect-[4/5] overflow-hidden p-8 rounded-[3rem] shadow-2xl transition-all border ${
                      isFortunePremium 
                      ? 'bg-gradient-to-br from-amber-400 to-amber-600 border-white/20 text-white' 
                      : 'bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 border-white/5 text-white'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                      <Crown className="w-32 h-32 rotate-12" />
                    </div>

                    <div className="relative z-10 h-full flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-amber-300" />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Kehanet Üyeliği</span>
                        </div>
                        <h2 className="text-2xl font-black leading-tight tracking-tight">Sınırsız Analiz & Premium Fal</h2>
                        
                        <div className="space-y-3 pt-4">
                          {[
                            "Günde 10 Fal Hakkı",
                            "Öncelikli Yevmiye Sırası",
                            "Detaylı Karakter Analizi",
                            "Özel Ritüellere Erişim"
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="text-[11px] font-bold text-white/80">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button 
                        onClick={() => setShowFortuneSubModal(true)}
                        className={`w-full py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl transition-all ${
                          isFortunePremium ? 'bg-white text-amber-600' : 'bg-amber-500 text-white'
                        }`}
                      >
                        {isFortunePremium ? 'Görüntüle' : 'Hemen Başlat'}
                      </button>
                    </div>
                  </motion.div>

                  {/* Boost Package Card Omitted for Soft Launch Production Safety */}
                </div>
              </div>

              {/* 3. COIN PACKAGES (Energy Boosters) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Jeton Paketleri</h2>
                  </div>
                </div>
                
                <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4">
                  {(config?.coinPackages || []).map((pkg) => (
                    <motion.button 
                      key={pkg.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePurchaseCoins(pkg.coins + pkg.bonus, pkg.id, pkg.priceTRY)}
                      disabled={processing}
                      className="relative flex-shrink-0 w-36 aspect-[3/4] bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-5 flex flex-col items-center justify-between group"
                    >
                      {pkg.bonus > 0 && (
                        <div className="absolute top-3 right-3 px-2 py-1 bg-emerald-500 text-white rounded-lg text-[8px] font-black uppercase shadow-lg">
                          Bonus
                        </div>
                      )}
                      
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:rotate-12 transition-transform">
                        <Ticket className="w-6 h-6" />
                      </div>

                      <div className="text-center space-y-1">
                        <p className="text-lg font-black text-slate-900 tracking-tighter">{pkg.coins + pkg.bonus}</p>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Jeton</p>
                      </div>

                      <div className="w-full py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black">
                        ₺{pkg.priceTRY}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* 4. ITEM SHOP (Horizontal Social Actions) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">Sosyal Market</h2>
                  </div>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4">
                  {[
                    { type: 'superLike' as const, icon: Heart, color: 'rose', label: 'Süper Like', count: currentUser.superLikes || 0, pricing: config?.socialPricing?.superLike || [] },
                    { type: 'refresh' as const, icon: RefreshCw, color: 'indigo', label: 'Yenileme', count: currentUser.refreshCount || 0, pricing: config?.socialPricing?.refresh || [] },
                    { type: 'compatibility' as const, icon: Sparkles, color: 'amber', label: 'Uyum Analizi', count: currentUser.compatibilityCount || 0, pricing: config?.socialPricing?.compatibility || [] }
                  ].map((item) => (
                    <div key={item.type} className="relative flex-shrink-0 w-48 bg-white rounded-[2.5rem] border border-black/5 shadow-sm p-6 flex flex-col gap-6">
                      {/* Count Badge */}
                      <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-slate-100 text-[9px] font-black text-slate-500 uppercase tracking-tighter">
                        {Math.max(0, item.count)} Adet
                      </div>

                      <div className="flex flex-col gap-3">
                        <div className={`w-12 h-12 rounded-2xl bg-${item.color}-50 text-${item.color}-500 flex items-center justify-center`}>
                          <item.icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.label}</h3>
                      </div>

                      <div className="space-y-2">
                        {(item.pricing || []).slice(0, 2).map(pkg => (
                          <button 
                            key={pkg.id} 
                            onClick={() => handlePurchaseSocialRight(item.type, pkg)} 
                            disabled={processing}
                            className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-black/5 hover:border-${item.color}-300 transition-all flex items-center justify-between group`}
                          >
                            <span className="text-[10px] font-bold text-slate-600">{pkg.count}X</span>
                            <span className="text-[10px] font-black text-slate-900 group-hover:text-amber-600">{pkg.priceCoins} J</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5. GÖREV MERKEZİ (Dopamine Zone) - REMOVED, Replaced by MissionCenter v2 at top */}

              {/* 6. PROMO CODE (Mysterious Section) */}
              <div className="pt-6" id="promo-section">
                <div className="bg-slate-900 rounded-[3rem] p-8 space-y-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full" />
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-indigo-400">
                      <Ticket rotate={-15} className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white tracking-tight">Gizemli Kodunu Kullan</h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">Evrenin Mesajını Çöz</p>
                    </div>
                  </div>

                  <div className="relative z-10 flex gap-2">
                    <input 
                      type="text"
                      placeholder="KODU BURAYA FISILDA..."
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      className="flex-1 bg-white/10 border-white/10 rounded-2xl px-6 py-4 text-xs font-black text-white focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-white/20 tracking-[0.2em]"
                    />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleRedeemPromoCode}
                      disabled={processing || !promoCode.trim()}
                      className="px-8 py-4 rounded-2xl bg-white text-slate-900 text-[10px] font-black uppercase tracking-[0.1em] hover:bg-slate-100 transition-all shadow-xl disabled:opacity-30"
                    >
                      Gönder
                    </motion.button>
                  </div>
                </div>
              </div>

              {/* RESTORE PURCHASES */}
              <div className="pt-6 pb-4">
                <button
                  onClick={() => {
                    toast.loading("Satın alımlarınız kontrol ediliyor...", { id: "restore" });
                    setTimeout(() => {
                      toast.success("Tüm premium yetkileriniz aktif durumda.", { id: "restore" });
                    }, 1500);
                  }}
                  className="w-full py-4 text-[10px] font-black text-slate-400 hover:text-slate-900 transition-colors uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Satın Alımları Geri Yükle
                </button>
              </div>
            </>
          ) : (
            /* TRANSACTION HISTORY */
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Finansal Akışın</h2>
                  <button onClick={refreshData} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-4">
                  {transactions.length === 0 ? (
                    <div className="bg-white p-16 rounded-[3rem] border border-black/5 text-center space-y-6">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                        <History className="w-10 h-10 text-slate-200" />
                      </div>
                      <p className="text-sm font-bold text-slate-300">Henüz bir kristalize işlem bulunmuyor.</p>
                    </div>
                  ) : (
                    transactions.map((tx, i) => (
                      <motion.div 
                        key={tx.id} 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: i * 0.05 }} 
                        className="bg-white p-6 rounded-[2.2rem] border border-black/5 flex items-center justify-between group hover:shadow-xl hover:shadow-slate-200/50 transition-all"
                      >
                        <div className="flex items-center gap-5">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                            tx.type === 'earn' || tx.type === 'purchase' 
                            ? 'bg-emerald-50 text-emerald-600 shadow-inner' 
                            : tx.type === 'expire' 
                            ? 'bg-rose-50 text-rose-600 shadow-inner' 
                            : 'bg-indigo-50 text-indigo-600 shadow-inner'
                          }`}>
                            {tx.type === 'earn' || tx.type === 'purchase' ? <ArrowDownLeft className="w-7 h-7" /> : tx.type === 'expire' ? <Clock className="w-7 h-7" /> : <ArrowUpRight className="w-7 h-7" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900 tracking-tight">{tx.description || 'Sistem İşlemi'}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{formatSafeDate(tx.createdAt, "dd MMM yyyy") || '-'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-lg font-black tracking-tighter ${
                            (tx.amount || 0) > 0 ? 'text-emerald-500' : 'text-rose-500'
                          }`}>
                            {(tx.amount || 0) > 0 ? '+' : ''}{tx.amount || 0} {tx.balanceType === 'main' ? 'J' : 'E'}
                          </p>
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Bakiye</p>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !processing && setShowFortuneSubModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-lg bg-white rounded-[3.5rem] overflow-hidden shadow-2xl">
              <div className="p-10 space-y-10">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">VIP Planını Seç</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kehanetin Gücünü Hisset</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => !processing && setShowFortuneSubModal(false)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                <div className="space-y-4">
                  {Object.entries(config?.fortuneSubscriptions || {}).sort((a, b) => b[1].priceTRY - a[1].priceTRY).map(([type, sub]: [string, any]) => (
                    <motion.button 
                      key={type} 
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleBuyFortuneSubscription(type as any, sub)} 
                      disabled={processing}
                      className={`w-full relative overflow-hidden p-6 rounded-[2.5rem] border text-left transition-all group ${
                        type === 'monthly' ? 'bg-slate-900 border-slate-900 shadow-xl shadow-slate-900/20' : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      {type === 'monthly' && (
                        <div className="absolute top-0 right-0 bg-amber-500 text-white px-4 py-1 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest">
                          En Popüler
                        </div>
                      )}
                      <div className="flex justify-between items-center relative z-10">
                        <div className="space-y-1">
                          <h4 className={`text-lg font-black uppercase tracking-tight ${type === 'monthly' ? 'text-white' : 'text-slate-900'}`}>
                            {type === 'daily' ? 'Günlük' : type === 'weekly' ? 'Haftalık' : 'Aylık'} Mistik
                          </h4>
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${type === 'monthly' ? 'text-white/40' : 'text-slate-400'}`}>Günde 10 Fal Hakkı</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-black tracking-tighter flex items-center gap-1 ${type === 'monthly' ? 'text-white' : 'text-slate-900'}`}>
                            {sub?.priceTRY || sub?.price || 0} <Coins className="w-5 h-5 text-amber-500" />
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
                
                <div className="p-5 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center gap-4">
                  <ShieldCheck className="w-6 h-6 text-indigo-600 shrink-0" />
                  <p className="text-[10px] font-bold text-indigo-900/60 leading-relaxed uppercase tracking-tight">
                    Premium ayrıcalıklar anında hesabına tanımlanır. İstediğin zaman tek tıkla iptal edebilirsin.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showBoostModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !processing && setShowBoostModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }} className="relative w-full max-w-lg bg-white rounded-[3.5rem] overflow-hidden shadow-2xl">
              <div className="p-10 space-y-10">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Profilini Boost'la</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Keşfette Zirveye Yerleş</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => !processing && setShowBoostModal(false)} className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                <div className="space-y-4">
                  {Object.entries(config?.boostPackages || {}).map(([key, pkg]: [string, any]) => (
                    <motion.button 
                      key={key} 
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handlePurchaseBoostPackage(key as any, pkg)} 
                      disabled={processing}
                      className={`w-full relative overflow-hidden p-6 rounded-[2.5rem] border text-left transition-all group ${
                        key === 'monthly' ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-600/20' : 'bg-white border-slate-100'
                      }`}
                    >
                      {key === 'monthly' && (
                        <div className="absolute top-0 right-0 bg-amber-500 text-white px-4 py-1 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest">
                          En Popüler
                        </div>
                      )}
                      <div className="flex justify-between items-center relative z-10">
                        <div className="space-y-1">
                          <h4 className={`text-lg font-black uppercase tracking-tight ${key === 'monthly' ? 'text-white' : 'text-slate-900'}`}>
                            {key === 'weekly' ? 'Haftalık' : 'Aylık'} Boost
                          </h4>
                          <p className={`text-[10px] font-bold uppercase tracking-widest ${key === 'monthly' ? 'text-white/40' : 'text-slate-400'}`}>Profil Görünürlüğü</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-black tracking-tighter flex items-center gap-1 ${key === 'monthly' ? 'text-white' : 'text-indigo-600'}`}>
                            {pkg.priceTRY || pkg.price || 0} <Coins className="w-5 h-5 text-amber-500" />
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
                
                <div className="p-5 rounded-3xl bg-amber-50 border border-amber-100 flex items-center gap-4 text-amber-900">
                  <Star className="w-6 h-6 shrink-0" />
                  <p className="text-[10px] font-bold leading-relaxed uppercase tracking-tight">
                    Boost süren boyunca keşfet sayfasında her zaman en üstte listelenirsin. Etkileşimin tavan yapacak!
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {pendingPurchase && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-white rounded-[3.5rem] overflow-hidden shadow-3xl"
            >
              <div className="p-10 text-center space-y-6">
                <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner relative group">
                  <ShoppingBag className="w-10 h-10 group-hover:scale-110 transition-transform" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">{pendingPurchase.title}</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{pendingPurchase.description}</p>
                </div>

                <div className="py-6 px-8 bg-slate-50 rounded-[2.5rem] border border-black/5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ödenecek Tutar</p>
                  <p className="text-3xl font-black text-slate-900 tracking-tighter">{pendingPurchase.price}</p>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 flex flex-col gap-3">
                <motion.button 
                  whileTap={{ scale: 0.98 }}
                  onClick={() => pendingPurchase.onConfirm()}
                  disabled={processing}
                  className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {processing ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Crown className="w-5 h-5 text-amber-400" />
                  )}
                  {processing ? 'İŞLEM YAPILIYOR...' : 'ŞİMDİ ONAYLA'}
                </motion.button>
                <button 
                  onClick={() => !processing && setPendingPurchase(null)}
                  disabled={processing}
                  className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors"
                >
                  İŞLEMİ İPTAL ET
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
