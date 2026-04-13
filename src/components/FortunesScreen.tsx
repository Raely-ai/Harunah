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
  Sparkles
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
  searching: { label: 'Yorumcu Aranıyor', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Search },
  found: { label: 'Yorumcu Bulundu', color: 'text-indigo-400', bg: 'bg-indigo-500/10', icon: User },
  interpreting: { label: 'Yorumlanıyor', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: AlertCircle },
  completed: { label: 'Yorumlandı', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  waiting: { label: 'Beklemede', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  error: { label: 'Hata', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
  pending: { label: 'Hazırlanıyor', color: 'text-gray-400', bg: 'bg-gray-500/10', icon: Clock },
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

  const filteredHistory = history
    .sort((a, b) => {
      // Show unseen completed readings first
      if (a.status === 'completed' && !a.isSeenByUser && (b.status !== 'completed' || b.isSeenByUser)) return -1;
      if (b.status === 'completed' && !b.isSeenByUser && (a.status !== 'completed' || a.isSeenByUser)) return 1;
      // Then sort by date
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

  const renderBalanceIcon = (type: 'main' | 'ad') => {
    const icon = type === 'main' ? config?.icons?.mainBalance : config?.icons?.adBalance;
    if (icon) {
      if (icon.startsWith('http')) {
        return <img src={icon} alt={type} className="w-4 h-4 object-contain" />;
      }
      return <span className="text-sm">{icon}</span>;
    }
    return type === 'main' ? <Coins className="w-4 h-4 text-amber-500" /> : <Zap className="w-4 h-4 text-indigo-400" />;
  };

  const CATEGORIES = [
    { 
      id: 'coffee' as FortuneType, 
      title: 'Kahve Falı', 
      description: 'Fincandaki sembollerin gizemli dünyası.',
      icon: Coffee, 
      color: 'from-amber-500/10 to-amber-600/5', 
      iconColor: 'text-amber-500',
      glowColor: 'bg-amber-500/20',
      configIcon: config?.icons?.coffee,
      price: economyConfig?.fortunePricing?.coffee ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.coffee,
      energyEligible: true
    },
    { 
      id: 'tarot' as FortuneType, 
      title: 'Tarot', 
      description: 'Kartların kadim bilgeliği.',
      icon: CreditCard, 
      color: 'from-purple-500/10 to-purple-600/5', 
      iconColor: 'text-purple-400',
      glowColor: 'bg-purple-500/20',
      configIcon: config?.icons?.tarot,
      price: economyConfig?.fortunePricing?.tarot ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.tarot,
      energyEligible: true
    },
    { 
      id: 'water' as FortuneType, 
      title: 'Su Falı', 
      description: 'Suyun duruluğunda saklı gerçekler.',
      icon: Droplets, 
      color: 'from-cyan-500/10 to-cyan-600/5', 
      iconColor: 'text-cyan-400',
      glowColor: 'bg-cyan-500/20',
      configIcon: config?.icons?.water,
      price: economyConfig?.fortunePricing?.water ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.water,
      energyEligible: false
    },
    { 
      id: 'ebced' as FortuneType, 
      title: 'Ebced Aşk', 
      description: 'İsimlerin ve sayıların aşkı.',
      icon: Heart, 
      color: 'from-rose-500/10 to-rose-600/5', 
      iconColor: 'text-rose-400',
      glowColor: 'bg-rose-500/20',
      configIcon: config?.icons?.ebced,
      price: economyConfig?.fortunePricing?.ebced ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.ebced,
      energyEligible: false
    },
    { 
      id: 'yildizname' as FortuneType, 
      title: 'Yıldızname', 
      description: 'Yıldızların rehberliği.',
      icon: Star, 
      color: 'from-indigo-500/10 to-indigo-600/5', 
      iconColor: 'text-indigo-400',
      glowColor: 'bg-indigo-500/20',
      configIcon: config?.icons?.yildizname,
      price: economyConfig?.fortunePricing?.yildizname ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.yildizname,
      energyEligible: false
    },
    { 
      id: 'havas' as FortuneType, 
      title: 'İlmi Havas', 
      description: 'Gizli ilimlerin derinlikleri.',
      icon: Zap, 
      color: 'from-emerald-500/10 to-emerald-600/5', 
      iconColor: 'text-emerald-400',
      glowColor: 'bg-emerald-500/20',
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

  return (
    <div className="relative min-h-screen pb-32 overflow-hidden flex flex-col bg-[#0A0510]">
      {/* Celestial Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-amber-900/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] pointer-events-none mix-blend-overlay" />
      
      {/* Top Tabs */}
      <div className="sticky top-0 z-30 bg-[#0A0510]/80 backdrop-blur-2xl px-6 py-4 flex items-center justify-center border-b border-white/5">
        <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 w-full max-w-[340px] shadow-2xl">
          <button
            onClick={() => setActiveSubTab('fortunes')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${
              activeSubTab === 'fortunes' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-[1.02]' 
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${activeSubTab === 'fortunes' ? 'opacity-100' : 'opacity-0'}`} />
            Fal Baktır
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black uppercase tracking-[0.15em] transition-all duration-300 relative ${
              activeSubTab === 'history' 
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] scale-[1.02]' 
                : 'text-white/30 hover:text-white/60'
            }`}
          >
            <History className={`w-3.5 h-3.5 ${activeSubTab === 'history' ? 'opacity-100' : 'opacity-0'}`} />
            Geçmiş
            {history.some(r => r.status === 'completed' && !r.isSeenByUser) && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0A0510] animate-pulse" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}>
        <AnimatePresence mode="wait">
          {activeSubTab === 'fortunes' ? (
            <motion.div
              key="fortunes-list"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pt-6"
            >
              {/* Header: Balances & Name (Compact & Premium) */}
              {userProfile && (
                <section className="px-4 relative z-10">
                  <div className="p-5 rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl relative overflow-hidden group">
                    {/* Inner Glow */}
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full" />
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <motion.div 
                            animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.4, 0.2] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute inset-0 bg-amber-500/30 blur-xl rounded-full"
                          />
                          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-[1px] shadow-2xl relative z-10 border border-white/20">
                            <div className="w-full h-full rounded-2xl bg-[#1A1525] flex items-center justify-center overflow-hidden">
                              {userProfile.photoURL ? (
                                <img src={userProfile.photoURL} alt={userProfile.displayName || ""} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <User className="w-6 h-6 text-white/20" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-serif font-bold text-white leading-tight truncate max-w-[120px]">
                            {userProfile.displayName}
                          </h2>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] font-black text-amber-500/80 uppercase tracking-widest">
                              {isSubscribed ? "Premium Üye" : "Mistik Gezgin"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                          {renderBalanceIcon('main')}
                          <span className="text-xs font-black text-amber-500 tracking-tight">{userProfile.mainCoins || 0}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                          {renderBalanceIcon('ad')}
                          <span className="text-xs font-black text-indigo-400 tracking-tight">{userProfile.energy || 0}</span>
                        </div>
                      </div>
                    </div>

                    {isSubscribed && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Günlük Hak</span>
                          <span className="text-[9px] font-black text-amber-500">{subUsed} / {subLimit}</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(subUsed / subLimit) * 100}%` }}
                            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <div className="px-8 relative z-10 space-y-1">
                <h3 className="text-white text-xl font-serif font-bold tracking-tight">Kaderini Aydınlat</h3>
                <p className="text-white/40 text-xs font-medium tracking-wide">Sana en yakın gelen yöntemi seç ve başla.</p>
              </div>

              <div className="grid grid-cols-1 gap-4 px-4 relative z-10">
                {CATEGORIES.map((cat, idx) => {
                  return (
                    <motion.button
                      key={cat.id}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onSelectFortune(cat.id)}
                      className="group relative flex items-center p-5 rounded-[2rem] overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.2)]"
                    >
                      {/* Hover Glow Effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className={`absolute -right-20 -top-20 w-40 h-40 blur-[80px] rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-700 ${cat.glowColor}`} />
                      
                      <div className="relative z-10 flex items-center gap-5 w-full">
                        {/* Icon Container */}
                        <div className="relative">
                          <div className="absolute inset-0 bg-white/10 blur-xl rounded-full group-hover:bg-white/20 transition-colors" />
                          <div className="relative w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
                            {renderIcon(cat)}
                          </div>
                        </div>
                        
                        <div className="flex-1 text-left">
                          <h3 className="text-lg font-serif font-bold text-white group-hover:text-amber-400 transition-colors leading-tight">{cat.title}</h3>
                          <p className="text-[11px] text-white/50 font-medium leading-tight mt-1 line-clamp-1">
                            {cat.description}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-1.5">
                            <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-amber-500 flex items-center gap-1">
                              {renderBalanceIcon('main')}
                              <span>{cat.price}</span>
                            </div>
                            {cat.energyEligible && (
                              <div className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black text-indigo-400 flex items-center gap-1">
                                {renderBalanceIcon('ad')}
                                <span>{cat.price}</span>
                              </div>
                            )}
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:text-amber-400 transition-all duration-500">
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </motion.button>
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
                  <h2 className="text-xl font-serif font-bold text-white">Kehanet Arşivi</h2>
                  <motion.button
                    whileHover={{ rotate: 180 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                  >
                    <RefreshCw className={`w-5 h-5 text-amber-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </motion.button>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Kehanetlerde ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:outline-none focus:border-amber-500/30 transition-colors text-white placeholder:text-white/20 shadow-2xl"
                  />
                </div>
                
                <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                      filter === 'all' ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    Tümü
                  </button>
                  {Object.keys(TYPE_ICONS).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilter(type as FortuneType)}
                      className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${
                        filter === type ? 'bg-white text-black shadow-lg' : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {type === 'coffee' ? 'Kahve' : (type === 'su' || type === 'water') ? 'Su' : type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* History List */}
              <div className="flex-1 px-4 space-y-4 relative z-10">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((reading) => {
                    const Icon = TYPE_ICONS[reading.type] || History;
                    const status = STATUS_CONFIG[reading.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.waiting;
                    const StatusIcon = status.icon;

                    return (
                      <motion.div
                        key={reading.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 rounded-[2.5rem] border transition-all duration-500 group relative overflow-hidden ${
                          reading.status === 'completed' && !reading.isSeenByUser
                            ? 'bg-white/10 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.1)]'
                            : 'bg-white/5 border-white/10 shadow-2xl'
                        }`}
                      >
                        {reading.status === 'completed' && !reading.isSeenByUser && (
                          <div className="absolute top-0 right-0 px-4 py-1.5 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-bl-2xl shadow-lg z-20 animate-pulse">
                            YENİ
                          </div>
                        )}

                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-center gap-5">
                            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center relative overflow-hidden transition-all duration-500 ${
                              reading.status === 'completed' && !reading.isSeenByUser
                                ? 'bg-amber-500/20 border-amber-500/40'
                                : 'bg-white/5 border-white/10'
                            }`}>
                              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-40" />
                              <Icon className={`w-8 h-8 relative z-10 group-hover:scale-110 transition-transform duration-500 ${
                                reading.status === 'completed' && !reading.isSeenByUser ? 'text-amber-400' : 'text-amber-500'
                              }`} />
                            </div>
                            <div>
                              <h3 className="font-serif font-bold text-white text-xl group-hover:text-amber-400 transition-colors leading-tight">{reading.title}</h3>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-black">{(reading.date || reading.createdAt || "").split('T')[0] || "Bilinmiyor"}</span>
                                <span className="w-1 h-1 rounded-full bg-white/10" />
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5 ${status.color}`}>
                                  <StatusIcon className="w-3 h-3" />
                                  <span className="text-[9px] font-black uppercase tracking-widest">{status.label}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => onToggleFavorite(reading.id)}
                              className={`p-3 rounded-2xl transition-all ${
                                reading.isFavorite ? 'text-amber-500 bg-white/10 border border-white/10' : 'text-white/20 hover:text-amber-500 hover:bg-white/5'
                              }`}
                            >
                              <Star className={`w-5 h-5 ${reading.isFavorite ? 'fill-current' : ''}`} />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => onDeleteHistory(reading.id)}
                              className="p-3 rounded-2xl text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                            >
                              <Trash2 className="w-5 h-5" />
                            </motion.button>
                          </div>
                        </div>

                        {reading.status === 'completed' && reading.content ? (
                          <div className="space-y-6">
                            <div className="p-5 rounded-3xl bg-black/40 border border-white/5 relative overflow-hidden group-hover:bg-black/50 transition-colors">
                              <p className="text-sm text-white/70 line-clamp-3 leading-relaxed font-medium italic relative z-10">
                                "{reading.content}"
                              </p>
                              <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-black/20 to-transparent" />
                            </div>
                            <div className="flex items-center justify-between pt-4">
                              <button
                                onClick={() => handleShare(reading)}
                                className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                                Paylaş
                              </button>
                              <button
                                onClick={() => setSelectedReading(reading)}
                                className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-amber-500 text-black text-[10px] font-black uppercase tracking-[0.2em] hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                              >
                                Detayları Gör
                                <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 rounded-3xl bg-white/5 border border-dashed border-white/10 text-center">
                            <div className="flex flex-col items-center gap-3">
                              <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                {reading.status === 'interpreting' ? 'Yorumlanıyor...' : 'Beklemede...'}
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                      <History className="w-10 h-10 text-white/10" />
                    </div>
                    <h3 className="text-lg font-serif font-bold text-white/40 mb-2">Henüz Bir Kehanet Yok</h3>
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}
