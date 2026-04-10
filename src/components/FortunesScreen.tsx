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
  Loader2
} from "lucide-react";
import { FortuneType, AppConfig, UserProfile, FortuneReading, EconomyConfig } from "../types";
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
  searching: { label: 'Yorumcu Aranıyor', color: 'text-purple-600', bg: 'bg-purple-500/10', icon: Search },
  found: { label: 'Yorumcu Bulundu', color: 'text-indigo-600', bg: 'bg-indigo-500/10', icon: User },
  interpreting: { label: 'Yorumlanıyor', color: 'text-blue-600', bg: 'bg-blue-500/10', icon: AlertCircle },
  completed: { label: 'Yorumlandı', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  waiting: { label: 'Beklemede', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
  error: { label: 'Hata', color: 'text-red-600', bg: 'bg-red-500/10', icon: AlertCircle },
  pending: { label: 'Hazırlanıyor', color: 'text-gray-600', bg: 'bg-gray-500/10', icon: Clock },
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
  onRefreshHistory
}: FortunesScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'fortunes' | 'history'>('fortunes');
  const [filter, setFilter] = useState<FortuneType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReading, setSelectedReading] = useState<FortuneReading | null>(null);
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

  const filteredHistory = history.filter(item => {
    const matchesFilter = filter === 'all' || item.type === filter;
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleShare = (reading: FortuneReading) => {
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
  };

  const renderBalanceIcon = (type: 'main' | 'ad') => {
    const icon = type === 'main' ? config?.icons?.mainBalance : config?.icons?.adBalance;
    if (icon) {
      if (icon.startsWith('http')) {
        return <img src={icon} alt={type} className="w-4 h-4 object-contain" />;
      }
      return <span className="text-sm">{icon}</span>;
    }
    return type === 'main' ? <Coins className="w-4 h-4 text-amber-600" /> : <Zap className="w-4 h-4 text-indigo-600" />;
  };

  const CATEGORIES = [
    { 
      id: 'coffee' as FortuneType, 
      title: 'Kahve Falı', 
      description: 'Fincandaki sembollerin gizemli dünyası.',
      icon: Coffee, 
      color: 'from-amber-50 to-amber-100/50', 
      iconColor: 'text-amber-600',
      configIcon: config?.icons?.coffee,
      price: economyConfig?.fortunePricing?.coffee ?? config?.prices?.coffee ?? 50,
      energyEligible: true
    },
    { 
      id: 'tarot' as FortuneType, 
      title: 'Tarot', 
      description: 'Kartların kadim bilgeliği.',
      icon: CreditCard, 
      color: 'from-purple-50 to-purple-100/50', 
      iconColor: 'text-purple-600',
      configIcon: config?.icons?.tarot,
      price: economyConfig?.fortunePricing?.tarot ?? config?.prices?.tarot ?? 40,
      energyEligible: true
    },
    { 
      id: 'water' as FortuneType, 
      title: 'Su Falı', 
      description: 'Suyun duruluğunda saklı gerçekler.',
      icon: Droplets, 
      color: 'from-cyan-50 to-cyan-100/50', 
      iconColor: 'text-cyan-600',
      configIcon: config?.icons?.water,
      price: economyConfig?.fortunePricing?.water ?? config?.prices?.water ?? 30,
      energyEligible: false
    },
    { 
      id: 'ebced' as FortuneType, 
      title: 'Ebced Aşk', 
      description: 'İsimlerin ve sayıların aşkı.',
      icon: Heart, 
      color: 'from-rose-50 to-rose-100/50', 
      iconColor: 'text-rose-600',
      configIcon: config?.icons?.ebced,
      price: economyConfig?.fortunePricing?.ebced ?? config?.prices?.ebced ?? 30,
      energyEligible: false
    },
    { 
      id: 'yildizname' as FortuneType, 
      title: 'Yıldızname', 
      description: 'Yıldızların rehberliği.',
      icon: Star, 
      color: 'from-indigo-50 to-indigo-100/50', 
      iconColor: 'text-indigo-600',
      configIcon: config?.icons?.yildizname,
      price: economyConfig?.fortunePricing?.yildizname ?? config?.prices?.yildizname ?? 30,
      energyEligible: false
    },
    { 
      id: 'havas' as FortuneType, 
      title: 'İlmi Havas', 
      description: 'Gizli ilimlerin derinlikleri.',
      icon: Zap, 
      color: 'from-emerald-50 to-emerald-100/50', 
      iconColor: 'text-emerald-600',
      configIcon: config?.icons?.havas,
      price: economyConfig?.fortunePricing?.havas ?? config?.prices?.havas ?? 30,
      energyEligible: false
    },
  ];

  const renderIcon = (cat: any) => {
    if (cat.configIcon) {
      if (cat.configIcon.startsWith('http')) {
        return <img src={cat.configIcon} alt={cat.title} className="w-12 h-12 object-contain" />;
      }
      return <span className="text-5xl">{cat.configIcon}</span>;
    }
    const Icon = cat.icon;
    return <Icon className={`w-12 h-12 ${cat.iconColor}`} />;
  };

  const isSubscribed = userProfile?.subscription?.status === 'active';
  const subLimit = config?.subscriptionLimits?.totalDaily ?? 10;
  const subUsed = userProfile?.subscription?.dailyLimitUsed ?? 0;

  return (
    <div className="relative min-h-screen pb-32 overflow-hidden flex flex-col bg-[#FDFCFE]">
      {/* Celestial Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-600/5 blur-[120px] rounded-full" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none grayscale" />

      {/* Top Tabs */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-2xl px-6 py-4 flex items-center justify-center border-b border-black/5">
        <div className="flex bg-black/5 p-1 rounded-2xl border border-black/5 w-full max-w-[320px]">
          <button
            onClick={() => setActiveSubTab('fortunes')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              activeSubTab === 'fortunes' 
                ? 'bg-white text-heading shadow-md border border-black/5' 
                : 'text-muted hover:text-heading'
            }`}
          >
            Fallarım
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-bold transition-all ${
              activeSubTab === 'history' 
                ? 'bg-white text-heading shadow-md border border-black/5' 
                : 'text-muted hover:text-heading'
            }`}
          >
            Geçmiş Yorumlarım
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          {activeSubTab === 'fortunes' ? (
            <motion.div
              key="fortunes-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pt-6"
            >
              {/* Header: Balances & Name */}
              {userProfile && (
                <section className="px-4 relative z-10">
                  <div className="p-6 rounded-[2.5rem] bg-white border border-black/5 shadow-xl">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-[1px] shadow-lg relative z-10">
                            <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center overflow-hidden">
                              {userProfile.photoURL ? (
                                <img src={userProfile.photoURL} alt={userProfile.displayName || ""} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <User className="w-8 h-8 text-amber-600/20" />
                              )}
                            </div>
                          </div>
                          {isSubscribed && (
                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white z-20 shadow-lg">
                              <Star className="w-3 h-3 text-white fill-current" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-600 mb-1">Mistik Gezgin</p>
                          <h2 className="text-2xl font-serif font-bold text-heading leading-tight truncate max-w-[140px]">
                            {userProfile.displayName}
                          </h2>
                          {isSubscribed && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Premium Üye</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 border border-amber-100">
                          {renderBalanceIcon('main')}
                          <span className="text-sm font-bold text-amber-600 tracking-tight">{userProfile.mainCoins || 0}</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-50 border border-indigo-100">
                          {renderBalanceIcon('ad')}
                          <span className="text-sm font-bold text-indigo-600 tracking-tight">{userProfile.energy || 0}</span>
                        </div>
                      </div>
                    </div>

                    {isSubscribed && (
                      <div className="mt-6 pt-4 border-t border-black/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Günlük Fal Hakkı</span>
                          <span className="text-[10px] font-bold text-amber-600">{subUsed} / {subLimit}</span>
                        </div>
                        <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(subUsed / subLimit) * 100}%` }}
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300"
                          />
                        </div>
                        <p className="text-[9px] font-medium text-muted mt-2 text-center italic">"Abonesin, öncelikli sıradasın ve mistik güçlerin daha yoğun."</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <div className="px-8 relative z-10">
                <h3 className="text-heading text-lg font-serif font-bold">Kaderini Aydınlat</h3>
                <p className="text-muted text-sm font-medium tracking-wide">Sana en yakın gelen yöntemi seç ve başla.</p>
              </div>

              <div className="grid grid-cols-1 gap-6 px-6 relative z-10">
                {CATEGORIES.map((cat, idx) => {
                  return (
                    <button
                      key={cat.id}
                      onClick={() => onSelectFortune(cat.id)}
                      className="relative flex items-center p-6 rounded-[2.5rem] overflow-hidden bg-white border border-black/5 group active:scale-[0.98] transition-all duration-300 hover:border-amber-500/20 shadow-lg"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-r ${cat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      
                      <div className="relative z-10 flex items-center gap-6 w-full">
                        <div className="p-4 rounded-3xl bg-white border border-black/5 shadow-sm group-hover:scale-110 transition-transform duration-500">
                          {renderIcon(cat)}
                        </div>
                        
                        <div className="flex-1 text-left space-y-1">
                          <h3 className="text-xl font-serif font-bold text-heading group-hover:text-amber-700 transition-colors">{cat.title}</h3>
                          <p className="text-xs text-body font-medium leading-relaxed">
                            {cat.description}
                          </p>
                          
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-100 text-[10px] font-bold text-amber-600 shadow-sm">
                              {renderBalanceIcon('main')}
                              <span className="tracking-tighter">{cat.price}</span>
                            </div>
                            {cat.energyEligible && (
                              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-[10px] font-bold text-indigo-600 shadow-sm">
                                {renderBalanceIcon('ad')}
                                <span className="tracking-tighter">{cat.price}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all duration-500">
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
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
              {/* History Header: Search & Refresh */}
              <div className="px-6 py-6 space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-serif font-bold text-heading">Kehanet Arşivi</h2>
                  <motion.button
                    whileHover={{ rotate: 180 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className={`w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center hover:bg-black/5 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <RefreshCw className={`w-5 h-5 text-amber-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </motion.button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    placeholder="Kehanetlerde ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-black/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-amber-600/50 transition-colors text-heading placeholder:text-muted shadow-sm"
                  />
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                      filter === 'all' ? 'bg-heading text-white shadow-md' : 'bg-white text-muted border border-black/5 hover:bg-black/5'
                    }`}
                  >
                    Tümü
                  </button>
                  {Object.keys(TYPE_ICONS).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilter(type as FortuneType)}
                      className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                        filter === type ? 'bg-heading text-white shadow-md' : 'bg-white text-muted border border-black/5 hover:bg-black/5'
                      }`}
                    >
                      {type === 'coffee' ? 'Kahve' : (type === 'su' || type === 'water') ? 'Su' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* History List */}
              <div className="flex-1 px-6 space-y-4 pb-32 relative z-10">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((reading) => {
                    const Icon = TYPE_ICONS[reading.type] || History;
                    const now = new Date();
                    let currentStatus = reading.status;
                    
                    if (reading.status !== 'completed' && reading.status !== 'error' && reading.expectedReadyAt) {
                      const expectedReadyAt = new Date(reading.expectedReadyAt);
                      if (now >= expectedReadyAt) currentStatus = 'completed';
                      else if (reading.interpretationStartedAt && now >= new Date(reading.interpretationStartedAt)) currentStatus = 'interpreting';
                    }

                    const status = STATUS_CONFIG[currentStatus as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.waiting;
                    const StatusIcon = status.icon;

                    return (
                      <div
                        key={reading.id}
                        className="p-5 rounded-[2rem] border border-black/5 bg-white shadow-lg transition-all duration-500"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                              reading.type === 'coffee' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-purple-50 text-purple-600 border border-purple-100'
                            }`}>
                              <Icon className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="font-serif font-bold text-heading">{reading.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-muted uppercase tracking-widest font-bold">{(reading.date || reading.createdAt || "").split('T')[0] || "Bilinmiyor"}</span>
                                <span className="w-1 h-1 rounded-full bg-black/5" />
                                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${status.bg} ${status.color} border border-black/5`}>
                                  <StatusIcon className="w-2.5 h-2.5" />
                                  <span className="text-[8px] font-black uppercase tracking-widest">{status.label}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onToggleFavorite(reading.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                reading.isFavorite ? 'text-amber-600 bg-amber-50' : 'text-muted hover:text-amber-600 hover:bg-black/5'
                              }`}
                            >
                              <Star className={`w-4 h-4 ${reading.isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            <button
                              onClick={() => onDeleteHistory(reading.id)}
                              className="p-2 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {currentStatus === 'completed' ? (
                          <div className="space-y-4">
                            <p className="text-sm text-body line-clamp-2 leading-relaxed italic">
                              "{reading.content || 'Kehanetin hazırlanıyor...'}"
                            </p>
                            <div className="flex items-center justify-between pt-4 border-t border-black/5">
                              <button
                                onClick={() => handleShare(reading)}
                                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-amber-600 transition-colors"
                              >
                                <Share2 className="w-3 h-3" />
                                Paylaş
                              </button>
                              <button
                                onClick={() => setSelectedReading(reading)}
                                className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:translate-x-1 transition-transform"
                              >
                                Detayları Gör
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-black/5 border border-dashed border-black/10 text-center">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                                {currentStatus === 'interpreting' ? 'Yorumcu kehanetini hazırlıyor...' : 'Kehanetin yorumlanmayı bekliyor.'}
                              </p>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <Loader2 className="w-3 h-3 text-amber-600 animate-spin" />
                              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">İşlem Devam Ediyor</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center mb-6">
                      <History className="w-10 h-10 text-black/10" />
                    </div>
                    <h3 className="text-lg font-serif font-bold text-muted mb-2">Henüz Bir Kehanet Yok</h3>
                    <p className="text-sm text-muted max-w-[200px]">Geçmiş kehanetlerini burada görebilirsin.</p>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setSelectedReading(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-lg bg-white rounded-t-[3rem] p-8 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-black/5 rounded-full mx-auto mb-8" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shadow-sm">
                  {(() => {
                    const Icon = TYPE_ICONS[selectedReading.type] || History;
                    return <Icon className="w-8 h-8 text-amber-600" />;
                  })()}
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-heading">{selectedReading.title}</h2>
                  <p className="text-xs text-muted uppercase tracking-widest font-bold">{(selectedReading.date || selectedReading.createdAt || "").split('T')[0] || "Bilinmiyor"}</p>
                </div>
              </div>

              <div className="prose prose-slate max-w-none">
                <p className="text-lg text-body leading-relaxed font-serif italic whitespace-pre-wrap">
                  {selectedReading.content}
                </p>
              </div>

              {selectedReading.cards && selectedReading.cards.length > 0 && (
                <div className="mt-8">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted mb-4">Seçilen Kartlar</h4>
                  <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                    {selectedReading.cards.map((card, idx) => (
                      <div key={idx} className="flex-shrink-0 w-24 aspect-[2/3] rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-2xl shadow-sm">
                        🎴
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-12 grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleShare(selectedReading)}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-black/5 border border-black/5 text-sm font-bold uppercase tracking-widest hover:bg-black/10 transition-colors text-heading"
                >
                  <Share2 className="w-4 h-4" />
                  Paylaş
                </button>
                <button
                  onClick={() => setSelectedReading(null)}
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-amber-600 text-white text-sm font-bold uppercase tracking-widest hover:bg-amber-700 transition-colors shadow-lg"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
