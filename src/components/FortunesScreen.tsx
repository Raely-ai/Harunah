import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Coffee, 
  CreditCard, 
  Droplets, 
  Heart, 
  Star, 
  Zap,
  ChevronRight,
  User,
  Coins,
  History,
  Search,
  Filter,
  Share2,
  Trash2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Sparkles,
  ArrowRight,
  X
} from "lucide-react";
import ReadingResult from "./ReadingResult";
import { FortuneType, AppConfig, UserProfile, FortuneReading, EconomyConfig } from "../types";
import { DEFAULT_ECONOMY_CONFIG } from "../constants";
import { toast } from "sonner";

interface FortunesScreenProps {
  onSelectFortune: (type: FortuneType) => void;
  onBack?: () => void;
  config: AppConfig | null;
  economyConfig: EconomyConfig | null;
  userProfile: UserProfile | null;
  history: FortuneReading[];
  onDeleteHistory: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onMarkAsSeen?: (id: string) => void;
  onRefreshHistory?: () => Promise<void>;
}

const TYPE_ICONS: Record<string, any> = {
  coffee: Coffee,
  tarot: CreditCard,
  su: Droplets,
  water: Droplets,
  ebced: Heart,
  yildizname: Star,
  havas: Zap,
};

const STATUS_CONFIG = {
  searching: { label: 'Yorumcu Aranıyor', color: 'text-amber-600', bg: 'bg-amber-100', icon: Search },
  found: { label: 'Yorumcu Bulundu', color: 'text-indigo-600', bg: 'bg-indigo-100', icon: User },
  interpreting: { label: 'Yorumlanıyor', color: 'text-blue-600', bg: 'bg-blue-100', icon: Sparkles },
  completed: { label: 'Yorumlandı', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 },
  waiting: { label: 'Beklemede', color: 'text-amber-600', bg: 'bg-amber-100', icon: Clock },
  error: { label: 'Hata', color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
  pending: { label: 'Hazırlanıyor', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
};

export default function FortunesScreen({ 
  onSelectFortune, 
  onBack, 
  config, 
  economyConfig,
  userProfile,
  history,
  onDeleteHistory,
  onToggleFavorite,
  onMarkAsSeen,
  onRefreshHistory
}: FortunesScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'fortunes' | 'history'>('fortunes');
  const [filter, setFilter] = useState<FortuneType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReading, setSelectedReading] = useState<FortuneReading | null>(null);
  const [selectedCategoryForPayment, setSelectedCategoryForPayment] = useState<typeof CATEGORIES[0] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefreshHistory) return;
    setIsRefreshing(true);
    try {
      await onRefreshHistory();
      toast.success("Kehanetler güncellendi");
    } catch (err) {
      toast.error("Güncelleme başarısız");
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredHistory = history
    .sort((a, b) => {
      if (a.status === 'completed' && !a.isSeenByUser && (b.status !== 'completed' || b.isSeenByUser)) return -1;
      if (b.status === 'completed' && !b.isSeenByUser && (a.status !== 'completed' || a.isSeenByUser)) return 1;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    })
    .filter(item => {
      const matchesFilter = filter === 'all' || item.type === filter;
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });

  const handleShare = (reading: FortuneReading) => {
    if (reading.content) {
      if (navigator.share) {
        navigator.share({
          title: reading.title,
          text: reading.content,
          url: window.location.href,
        }).catch(() => toast.error("Paylaşım yapılamadı"));
      } else {
        navigator.clipboard.writeText(reading.content);
        toast.success("Panoya kopyalandı");
      }
    }
  };

  const CATEGORIES = [
    { 
      id: 'coffee' as FortuneType, 
      title: 'Kahve Falı', 
      group: 'Doğa Falları',
      description: 'Fincandaki sembollerin gizemli dünyası.',
      icon: Coffee, 
      color: 'bg-amber-50', 
      iconColor: 'text-amber-600',
      aura: 'aurasphere-amber',
      configIcon: config?.icons?.coffee,
      price: economyConfig?.fortunePricing?.coffee ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.coffee,
      energyEligible: true
    },
    { 
      id: 'tarot' as FortuneType, 
      title: 'Tarot', 
      group: 'Kadim Sanatlar',
      description: 'Kartların kadim bilgeliği.',
      icon: CreditCard, 
      color: 'bg-purple-50', 
      iconColor: 'text-purple-600',
      aura: 'aurasphere-purple',
      configIcon: config?.icons?.tarot,
      price: economyConfig?.fortunePricing?.tarot ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.tarot,
      energyEligible: true
    },
    { 
      id: 'water' as FortuneType, 
      title: 'Su Falı', 
      group: 'Doğa Falları',
      description: 'Suyun duruluğunda saklı gerçekler.',
      icon: Droplets, 
      color: 'bg-cyan-50', 
      iconColor: 'text-cyan-600',
      aura: 'aurasphere-cyan',
      configIcon: config?.icons?.water,
      price: economyConfig?.fortunePricing?.water ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.water,
      energyEligible: false
    },
    { 
      id: 'ebced' as FortuneType, 
      title: 'Ebced Aşk', 
      group: 'Kadim Sanatlar',
      description: 'İsimlerin ve sayıların aşkı.',
      icon: Heart, 
      color: 'bg-rose-50', 
      iconColor: 'text-rose-600',
      aura: 'aurasphere-rose',
      configIcon: config?.icons?.ebced,
      price: economyConfig?.fortunePricing?.ebced ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.ebced,
      energyEligible: false
    },
    { 
      id: 'yildizname' as FortuneType, 
      title: 'Yıldızname', 
      group: 'Kadim Sanatlar',
      description: 'Yıldızların rehberliği.',
      icon: Star, 
      color: 'bg-indigo-50', 
      iconColor: 'text-indigo-600',
      aura: 'aurasphere-indigo',
      configIcon: config?.icons?.yildizname,
      price: economyConfig?.fortunePricing?.yildizname ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.yildizname,
      energyEligible: false
    },
    { 
      id: 'havas' as FortuneType, 
      title: 'İlmi Havas', 
      group: 'Gizli İlimler',
      description: 'Gizli ilimlerin derinlikleri.',
      icon: Zap, 
      color: 'bg-emerald-50', 
      iconColor: 'text-emerald-600',
      aura: 'aurasphere-emerald',
      configIcon: config?.icons?.havas,
      price: economyConfig?.fortunePricing?.havas ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.havas,
      energyEligible: false
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
    return <Icon className={`w-8 h-8 ${cat.iconColor}`} />;
  };

  const isSubscribed = userProfile?.subscription?.status === 'active';
  const subLimit = economyConfig?.subscriptionLimits?.totalDaily ?? config?.subscriptionLimits?.totalDaily ?? DEFAULT_ECONOMY_CONFIG.subscriptionLimits.totalDaily;
  const subUsed = userProfile?.subscription?.dailyLimitUsed ?? 0;

  const getPaymentDisplay = (price: number) => {
    const hasSubscriptionRight = isSubscribed && subUsed < subLimit;
    const userEnergy = userProfile?.energy ?? 0;
    const userCoins = userProfile?.mainCoins ?? 0;

    if (hasSubscriptionRight) {
      return {
        type: 'subscription',
        label: 'Abonelik',
        info: 'Günlük haktan düşer',
        buttonText: 'Baktır',
        Icon: Sparkles,
        badgeColor: 'bg-violet-600 text-white',
      };
    }

    if (userEnergy >= price) {
      return {
        type: 'energy',
        label: 'Enerji',
        info: `${price} Enerji`,
        buttonText: 'Baktır',
        Icon: Zap,
        badgeColor: 'bg-indigo-500 text-white',
      };
    }

    if (userCoins >= price) {
      return {
        type: 'coins',
        label: 'Ana Jeton',
        info: `${price} Jeton`,
        buttonText: 'Baktır',
        Icon: Coins,
        badgeColor: 'bg-amber-500 text-white',
      };
    }

    return {
      type: 'insufficient',
      label: 'Bakiye Yetersiz',
      info: `${price} Jeton`,
      hint: 'Enerji / Jeton Kazan',
      buttonText: 'Baktır',
      Icon: Coins,
      badgeColor: 'bg-slate-200 text-slate-600',
    };
  };

  const GROUPS = ["Kadim Sanatlar", "Doğa Falları", "Gizli İlimler"];

  return (
    <div className="relative min-h-screen pb-32 flex flex-col bg-gradient-to-b from-slate-50 to-purple-50 overflow-hidden">
      {/* Visual Trickery: Static Constellation Background */}
      <div className="absolute inset-0 constellation-overlay opacity-30 pointer-events-none" />

      {/* Top Tabs */}
      <div className="sticky top-0 z-40 bg-white/60 backdrop-blur-xl px-6 py-4 flex items-center justify-center border-b border-gray-100">
        <div className="flex bg-gray-200/50 p-1 rounded-[2rem] w-full max-w-[340px] relative overflow-hidden">
          <button
            onClick={() => setActiveSubTab('fortunes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[1.5rem] text-[12px] font-bold transition-all duration-300 relative z-10 ${
              activeSubTab === 'fortunes' 
                ? 'bg-white text-heading shadow-sm ring-1 ring-black/5' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeSubTab === 'fortunes' ? 'text-amber-500' : 'opacity-0'}`} />
            Fal Baktır
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[1.5rem] text-[12px] font-bold transition-all duration-300 relative z-10 ${
              activeSubTab === 'history' 
                ? 'bg-white text-heading shadow-sm ring-1 ring-black/5' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <History className={`w-3.5 h-3.5 ${activeSubTab === 'history' ? 'text-purple-500' : 'opacity-0'}`} />
            Geçmiş
            {history.some(r => r.status === 'completed' && !r.isSeenByUser) && (
              <span className="absolute top-2.5 right-4 w-2 h-2 bg-red-500 rounded-full border border-white" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar relative" style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
        <AnimatePresence mode="wait">
          {activeSubTab === 'fortunes' ? (
            <motion.div
              key="fortunes-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 pt-6"
            >
              {/* Profile Jewel Card */}
              {userProfile && (
                <section className="px-5">
                  <div className="jewel-card p-6 rounded-[2.5rem] relative overflow-hidden">
                    {/* Interior Glows */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-[40px] rounded-full" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-amber-500/10 blur-[40px] rounded-full" />
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="absolute -inset-1 bg-gradient-to-tr from-purple-500 to-amber-500 blur-sm opacity-20 rounded-2xl" />
                          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center overflow-hidden border border-gray-100 relative z-10">
                            {userProfile.photoURL ? (
                              <img src={userProfile.photoURL} alt={userProfile.displayName || ""} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <User className="w-7 h-7 text-gray-300" />
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-bold text-slate-800 leading-tight truncate">
                            {userProfile.displayName}
                          </h2>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-black text-purple-600/70 uppercase tracking-widest px-2 py-0.5 bg-purple-100/50 rounded-lg border border-purple-200/50">
                              {isSubscribed ? "PREMIUM" : "GEZGİN"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 shadow-sm border border-gray-100/50">
                          <Coins className="w-4 h-4 text-amber-500" />
                          <span className="text-sm font-bold text-slate-800">{userProfile.mainCoins || 0}</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/60 shadow-sm border border-gray-100/50">
                          <Zap className="w-4 h-4 text-indigo-500" />
                          <span className="text-sm font-bold text-slate-800">{userProfile.energy || 0}</span>
                        </div>
                      </div>
                    </div>

                    {isSubscribed && (
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">GÜNLÜK KADER HAKKI</span>
                          <span className="text-[10px] font-black text-slate-600">{subUsed} / {subLimit}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden border border-white">
                          <div 
                            style={{ width: `${(subUsed / subLimit) * 100}%` }}
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Grouped Horizontal Carousels */}
              {GROUPS.map((groupTitle, gIdx) => (
                <section key={groupTitle} className="relative">
                  <div className="px-7 mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-slate-800 text-lg font-bold tracking-tight">{groupTitle}</h3>
                      <div className="h-0.5 w-8 bg-purple-500/30 rounded-full mt-1" />
                    </div>
                  </div>
                  
                  <div className="flex overflow-x-auto gap-4 px-7 pb-6 no-scrollbar snap-x">
                    {CATEGORIES.filter(c => c.group === groupTitle).map((cat, cIdx) => {
                      const display = getPaymentDisplay(cat.price);
                      const PaymentIcon = display.Icon;

                      return (
                        <motion.div
                          key={cat.id}
                          whileTap={{ scale: 0.96 }}
                          className={`flex-shrink-0 w-[240px] snap-center aspect-[4/5] sm:aspect-square bg-white rounded-[2.5rem] p-6 flex flex-col justify-between transition-all duration-300 relative overflow-hidden border border-gray-100 ${cat.aura}`}
                        >
                          {/* Badge */}
                          <div className={`absolute top-4 right-4 z-20 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-sm ${display.badgeColor}`}>
                            {display.label}
                          </div>

                          {/* Internal Aura Glow */}
                          <div className={`absolute top-0 right-0 w-32 h-32 blur-[40px] opacity-20 -mr-10 -mt-10 rounded-full ${cat.iconColor.replace('text', 'bg')}`} />
                          
                          <div className="relative z-10">
                            <div className={`w-14 h-14 rounded-2xl ${cat.color} flex items-center justify-center mb-4 border border-white/50 shadow-sm`}>
                              {renderIcon(cat)}
                            </div>
                            
                            <h4 className="text-xl font-bold text-slate-800 leading-tight mb-1">{cat.title}</h4>
                            <p className="text-[11px] text-slate-500 font-medium leading-normal line-clamp-2 italic">
                              {cat.description}
                            </p>
                          </div>

                          <div className="relative z-10 flex flex-col gap-3">
                            <div className="flex flex-col px-1">
                              {display.type === 'subscription' ? (
                                <span className="text-sm font-bold text-violet-600 leading-tight flex items-center gap-1">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Günlük haktan düşer
                                </span>
                              ) : (
                                <div className="flex items-center gap-3 text-sm font-bold text-slate-600 leading-tight">
                                  <div className="flex items-center gap-1">
                                    <Zap className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>{cat.price} Enerji</span>
                                  </div>
                                  <span className="text-slate-200">|</span>
                                  <div className="flex items-center gap-1">
                                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                                    <span>{cat.price} Jeton</span>
                                  </div>
                                </div>
                              )}
                              {display.type === 'insufficient' && (
                                <span className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">{display.hint}</span>
                              )}
                            </div>
                            
                            <button
                              onClick={() => setSelectedCategoryForPayment(cat)}
                              className="w-full bg-slate-900 text-white rounded-2xl py-3.5 px-4 flex items-center justify-between group overflow-hidden relative shadow-lg active:scale-95 transition-transform"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <PaymentIcon className={`w-4 h-4 ${display.type.includes('energy') ? 'text-indigo-400' : 'text-amber-500'}`} />
                                  <span className="text-[11px] font-black uppercase tracking-widest">{display.buttonText}</span>
                                </div>
                              </div>
                              
                              <ArrowRight className="w-5 h-5 text-amber-500 group-hover:translate-x-1 transition-transform" />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                    {/* Empty Padding for Peeking Effect */}
                    <div className="flex-shrink-0 w-4 h-full" />
                  </div>
                </section>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="history-list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col h-full"
            >
              {/* History Search & Filter */}
              <div className="px-6 py-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 tracking-tight capitalize">Kehanet Arşivi</h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Geçmiş falların burada saklanır</p>
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <RefreshCw className={`w-5 h-5 text-purple-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type="text"
                    placeholder="Kehanetlerde ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-purple-300 transition-colors text-slate-800"
                  />
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                      filter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'
                    }`}
                  >
                    Tümü
                  </button>
                  {Object.keys(TYPE_ICONS).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilter(type as FortuneType)}
                      className={`px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                        filter === type ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'
                      }`}
                    >
                      {type === 'coffee' ? 'Kahve' : (type === 'su' || type === 'water') ? 'Su' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* History List */}
              <div className="flex-1 px-5 space-y-4">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((reading) => {
                    const Icon = TYPE_ICONS[reading.type] || History;
                    const status = STATUS_CONFIG[reading.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.waiting;
                    const StatusIcon = status.icon;

                    return (
                      <motion.div
                        key={reading.id}
                        whileTap={{ scale: 0.98 }}
                        className={`p-5 rounded-[1.5rem] bg-white border border-gray-100 shadow-sm relative overflow-hidden ${
                          reading.status === 'completed' && !reading.isSeenByUser
                            ? 'border-purple-200 bg-purple-50/50 shadow-purple-500/5'
                            : ''
                        }`}
                      >
                        {reading.status === 'completed' && !reading.isSeenByUser && (
                          <div className="absolute top-0 right-0 px-3 py-1 bg-purple-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-bl-xl shadow-sm z-10">
                            YENİ
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner ${
                              reading.status === 'completed' && !reading.isSeenByUser
                                ? 'bg-purple-100 border-purple-200'
                                : 'bg-slate-50 border-gray-100'
                            }`}>
                              <Icon className={`w-6 h-6 ${
                                reading.status === 'completed' && !reading.isSeenByUser ? 'text-purple-600' : 'text-amber-600'
                              }`} />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-800 text-md leading-tight">{reading.title}</h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{(reading.date || reading.createdAt || "").split('T')[0]}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-200" />
                                <div className={`flex items-center gap-1 ${status.color}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  <span className="text-[9px] font-bold uppercase">{status.label}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onToggleFavorite(reading.id)}
                              className={`p-2 rounded-lg transition-all ${
                                reading.isFavorite ? 'text-amber-500 bg-amber-50' : 'text-slate-300 hover:text-amber-500'
                              }`}
                            >
                              <Star className={`w-5 h-5 ${reading.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={() => onDeleteHistory(reading.id)}
                              className="p-2 rounded-lg text-slate-300 hover:text-red-500 transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>

                        {reading.status === 'completed' && reading.content ? (
                          <div className="space-y-4">
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed italic">
                              "{reading.content}"
                            </p>
                            <div className="flex items-center justify-between">
                              <button
                                onClick={() => handleShare(reading)}
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-400 hover:text-slate-800 transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                Paylaş
                              </button>
                              <button
                                onClick={() => setSelectedReading(reading)}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase hover:bg-black transition-all active:scale-95 shadow-lg"
                              >
                                Kaderini Oku
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center p-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <div className="flex items-center gap-2">
                              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                              <p className="text-[10px] font-bold uppercase text-slate-400">
                                {reading.status === 'interpreting' ? 'Mistik Enerjiler Okunuyor...' : 'Beklemede...'}
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                      <History className="w-10 h-10 text-gray-200" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-400 mb-1 capitalize">Arşiv Boş</h3>
                    <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest max-w-[200px] leading-snug">Henüz keşfedilmeyen sırlar burada saklanacak.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reading Detail Modal */}
      <AnimatePresence>
        {selectedReading && (
          <ReadingResult 
            reading={selectedReading} 
            onClose={() => setSelectedReading(null)} 
            onMarkAsSeen={onMarkAsSeen}
          />
        )}
      </AnimatePresence>

      {/* Payment Summary Sheet */}
      <AnimatePresence>
        {selectedCategoryForPayment && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: "linear" }}
              onClick={() => setSelectedCategoryForPayment(null)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.08, ease: "linear" }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Harcama Özeti</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    {selectedCategoryForPayment.title} İşlemi
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedCategoryForPayment(null)}
                  className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {(() => {
                const price = selectedCategoryForPayment.price;
                const userEnergy = userProfile?.energy ?? 0;
                const userCoins = userProfile?.mainCoins ?? 0;
                const hasSub = isSubscribed && subUsed < subLimit;
                const isDual = !hasSub && userEnergy < price && userCoins >= price;

                const display = getPaymentDisplay(price);
                const MethodIcon = display.Icon;
                const isInsufficient = display.type === 'insufficient';

                return (
                  <div className="space-y-6">
                    {/* User Balance Section */}
                    <div className="bg-slate-50 rounded-3xl p-4 flex items-center justify-around border border-slate-100 mb-2">
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bakiyen</span>
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-indigo-500" />
                          <span className={`text-sm font-black ${userEnergy < price && !hasSub ? 'text-rose-500' : 'text-slate-700'}`}>
                            {userEnergy < price && !hasSub ? `${userEnergy} / ${price}` : userEnergy}
                          </span>
                        </div>
                      </div>
                      <div className="w-[1px] h-8 bg-slate-200" />
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jetonun</span>
                        <div className="flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-sm font-black text-slate-700">{userCoins}</span>
                        </div>
                      </div>
                    </div>

                    {isDual ? (
                      <div className="space-y-6">
                        <div className="text-center px-4">
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Bakiyen Fal İçin Yetersiz</p>
                          <h4 className="text-xl font-black text-slate-800 tracking-tight">Nasıl Devam Edelim?</h4>
                        </div>

                        <div className="space-y-3">
                          <div className="p-4 rounded-3xl bg-amber-50 border border-amber-100 flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
                                <Coins className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">Ana Jeton İle Bak</p>
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tighter">{price} Jeton Harcanacak</p>
                              </div>
                            </div>
                            <CheckCircle2 className="w-5 h-5 text-amber-500" />
                          </div>

                          <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-between opacity-70">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                <Zap className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-800">Enerji Kazan</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Reklam İzleyerek Bakabilirsin</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-2">
                          <button
                            onClick={() => {
                              onSelectFortune(selectedCategoryForPayment.id);
                              setSelectedCategoryForPayment(null);
                            }}
                            className="w-full py-4.5 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 hover:bg-black"
                          >
                            Jeton ile Devam Et
                          </button>
                          <button
                            onClick={() => {
                              // Energy gain logic usually handled by parent
                              setSelectedCategoryForPayment(null);
                              toast.info("Enerji kazanmak için ana sayfadaki görevlere göz atın!");
                            }}
                            className="w-full py-4.5 rounded-2xl bg-white border-2 border-indigo-100 text-indigo-600 font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                          >
                            Enerji Kazan
                          </button>
                          <button
                            onClick={() => setSelectedCategoryForPayment(null)}
                            className="w-full py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="flex items-center gap-5 p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                          <div className={`w-16 h-16 rounded-22 flex items-center justify-center shadow-inner rounded-2xl ${display.badgeColor}`}>
                            <MethodIcon className="w-8 h-8" />
                          </div>
                          <div>
                            <div className="text-xl font-black text-slate-800 leading-tight">
                              {display.type === 'subscription' ? 'Abonelik Hakkın' : display.info}
                            </div>
                            <p className="text-[11px] font-bold text-slate-400 mt-0.5 uppercase tracking-tighter">
                              {display.type === 'subscription' ? 'Günlük fal hakkından düşer' : `${display.label} bakiyenden düşer`}
                            </p>
                          </div>
                        </div>

                        {isInsufficient && (
                          <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100 italic">
                            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-rose-600 font-bold leading-relaxed tracking-tight">
                              Bakiyen yetersiz. {display.hint.toLowerCase()}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-col gap-3">
                          <button
                            disabled={isInsufficient}
                            onClick={() => {
                              onSelectFortune(selectedCategoryForPayment.id);
                              setSelectedCategoryForPayment(null);
                            }}
                            className={`w-full py-4.5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg transition-all active:scale-95 ${
                              isInsufficient 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                                : 'bg-slate-900 text-white hover:bg-black'
                            }`}
                          >
                            {isInsufficient ? 'Bakiye Yetersiz' : 'Onayla ve Devam Et'}
                          </button>
                          <button
                            onClick={() => setSelectedCategoryForPayment(null)}
                            className="w-full py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            Vazgeç
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
