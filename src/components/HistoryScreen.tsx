import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  History, 
  Search, 
  Filter, 
  Star, 
  Share2, 
  Trash2, 
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Coffee,
  CreditCard,
  Droplets,
  Heart,
  Zap,
  Moon,
  ArrowLeft,
  MoreVertical,
  Wallet,
  RefreshCw,
  ChevronLeft,
  Sparkles,
  Loader2,
  User
} from "lucide-react";
import ReadingResult from "./ReadingResult";
import { FortuneReading, FortuneType, UserProfile } from "../types";
import { toast } from "sonner";

interface HistoryScreenProps {
  history: FortuneReading[];
  userProfile: UserProfile;
  onBack: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRefresh?: () => Promise<void>;
  hasMore?: boolean;
  onLoadMore?: () => Promise<void>;
}

const TYPE_ICONS: Record<string, any> = {
  coffee: Coffee,
  tarot: CreditCard,
  su: Droplets,
  ebced: Heart,
  yildizname: Star,
  havas: Zap,
};

const STATUS_CONFIG = {
  searching: { label: 'Yorumcu Aranıyor', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Search },
  found: { label: 'Yorumcu Bulundu', color: 'text-indigo-600', bg: 'bg-indigo-500/10', icon: User },
  interpreting: { label: 'Yorumlanıyor', color: 'text-blue-600', bg: 'bg-blue-500/10', icon: Sparkles },
  processing_ai: { label: 'Yorumlanıyor', color: 'text-blue-600', bg: 'bg-blue-500/10', icon: Sparkles },
  completed: { label: 'Tamamlandı', color: 'text-emerald-600', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  waiting: { label: 'Beklemede', color: 'text-amber-600', bg: 'bg-amber-500/10', icon: Clock },
  error: { label: 'Hata', color: 'text-red-600', bg: 'bg-red-500/10', icon: AlertCircle },
  pending: { label: 'Hazırlanıyor', color: 'text-gray-600', bg: 'bg-gray-500/10', icon: Clock },
};

export default function HistoryScreen({ 
  history, 
  userProfile, 
  onBack, 
  onDelete, 
  onToggleFavorite, 
  onRefresh,
  hasMore,
  onLoadMore
}: HistoryScreenProps) {
  const [filter, setFilter] = useState<FortuneType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReading, setSelectedReading] = useState<FortuneReading | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const handleLoadMore = async () => {
    if (!onLoadMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
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

  return (
    <div className="fixed inset-0 z-40 bg-[#0A0510] flex flex-col overflow-hidden">
      {/* Celestial Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-amber-900/10 blur-[120px] rounded-full pointer-events-none" />
      
      {/* Header */}
      <header className="flex-shrink-0 bg-black/20 backdrop-blur-2xl border-b border-white/5 px-6 py-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="p-3 rounded-2xl bg-white/5 border border-white/10"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </motion.button>
            <div>
              <h1 className="text-xl font-serif font-bold text-white">Kehanet Arşivi</h1>
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-black">Geçmişin İzleri</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className={`w-5 h-5 text-amber-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Kehanetlerde ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-500/30 transition-colors"
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
      </header>

      {/* History List */}
      <main className="flex-1 overflow-y-auto px-4 py-6 no-scrollbar pb-32 relative z-10">
        <div className="space-y-6">
          {filteredHistory.length > 0 ? (
            <>
              {filteredHistory.map((reading) => {
                const Icon = TYPE_ICONS[reading.type] || History;
                
                const status = STATUS_CONFIG[reading.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.waiting;
                const StatusIcon = status.icon;

                return (
                  <motion.div
                    key={reading.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative"
                  >
                    <div className={`p-6 rounded-[2.5rem] border transition-all duration-500 overflow-hidden relative ${
                      reading.status === 'completed' && !reading.isSeenByUser
                        ? 'bg-white/10 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.1)]'
                        : 'bg-white/5 border-white/10 shadow-2xl'
                    }`}>
                      {reading.status === 'completed' && !reading.isSeenByUser && (
                        <div className="absolute top-0 right-0 px-4 py-1.5 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-bl-2xl shadow-lg z-20 animate-pulse">
                          YENİ
                        </div>
                      )}

                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center gap-5">
                          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center relative overflow-hidden border transition-all duration-500 ${
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
                              <span className="text-[10px] text-white/30 uppercase tracking-widest font-black">
                                {reading.createdAt ? new Date(reading.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                              </span>
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
                            onClick={() => onDelete(reading.id)}
                            className="p-3 rounded-2xl text-white/20 hover:text-red-500 hover:bg-red-500/10 transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </motion.button>
                        </div>
                      </div>

                      {reading.status === 'completed' && reading.content ? (
                        <div className="space-y-6">
                          <div className="p-5 rounded-3xl bg-black/40 border border-white/5 relative overflow-hidden group-hover:bg-black/50 transition-colors">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                              <Icon className="w-16 h-16" />
                            </div>
                            <p className="text-sm text-white/70 line-clamp-3 leading-relaxed font-medium italic relative z-10">
                              "{reading.content || 'Kehanetin hazırlanıyor...'}"
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
                      ) : reading.status === 'error' ? (
                        <div className="space-y-4">
                          <div className="p-6 rounded-3xl bg-red-500/10 border border-dashed border-red-500/20 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
                              {reading.error || 'Bir hata oluştu, lütfen tekrar deneyin.'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-6 rounded-3xl bg-white/5 border border-dashed border-white/10 text-center relative overflow-hidden">
                            <motion.div 
                              animate={{ opacity: [0.1, 0.3, 0.1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                            />
                            <div className="flex flex-col items-center gap-3 relative z-10">
                              <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-white/30">
                                {['interpreting', 'processing_ai'].includes(reading.status) ? 'Yorumcu kehanetini hazırlıyor...' : reading.status === 'searching' ? 'Yorumcu aranıyor...' : reading.status === 'found' ? 'Yorumcu bulundu, hazırlanıyor...' : 'Kehanetin yorumlanmayı bekliyor.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}

              {hasMore && (
                <div className="pt-8 flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-3 px-10 py-4 rounded-2xl bg-white/5 border border-white/10 text-[11px] font-black uppercase tracking-widest text-white/40 hover:bg-white/10 transition-all disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 text-amber-500" />
                        Daha Fazla Yükle
                      </>
                    )}
                  </motion.button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-8 shadow-inner">
                <History className="w-10 h-10 text-white/10" />
              </div>
              <h3 className="text-xl font-serif font-bold text-white/40 mb-3">Henüz Bir Kehanet Yok</h3>
              <p className="text-xs text-white/20 max-w-[200px] font-medium leading-relaxed">Geçmiş kehanetlerini burada görebilirsin.</p>
            </div>
          )}
        </div>
      </main>

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
