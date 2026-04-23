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
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Loader2,
  User,
  Coffee,
  CreditCard,
  Droplets,
  Heart,
  Zap
} from "lucide-react";
import ReadingResult from "./ReadingResult";
import { FortuneReading, FortuneType, UserProfile } from "../types";
import { toast } from "sonner";

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
  processing_ai: { label: 'Yorumlanıyor', color: 'text-blue-600', bg: 'bg-blue-100', icon: Sparkles },
  completed: { label: 'Tamamlandı', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2 },
  waiting: { label: 'Beklemede', color: 'text-amber-600', bg: 'bg-amber-100', icon: Clock },
  error: { label: 'Hata', color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
  pending: { label: 'Hazırlanıyor', color: 'text-gray-600', bg: 'bg-gray-100', icon: Clock },
};

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
      navigator.clipboard.writeText(reading.content || "");
      toast.success("Panoya kopyalandı");
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-gradient-to-b from-slate-50 to-purple-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-4 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 -ml-2 text-heading hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-heading">Kehanet Arşivi</h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Geçmiş falların burada saklanır</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-5 h-5 text-purple-600 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
            <input
              type="text"
              placeholder="Arşivde iz sür..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-11 pr-4 text-sm text-heading placeholder:text-gray-300 focus:outline-none focus:border-purple-300 transition-all font-sans"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-sans">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                filter === 'all' 
                  ? 'bg-heading text-white shadow-sm' 
                  : 'bg-white text-gray-400 border border-gray-100'
              }`}
            >
              Tümü
            </button>
            {Object.keys(TYPE_ICONS).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type as FortuneType)}
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  filter === type 
                    ? 'bg-heading text-white shadow-sm' 
                    : 'bg-white text-gray-400 border border-gray-100'
                }`}
              >
                {type === 'coffee' ? 'Kahve' : (type === 'su' || type === 'water') ? 'Su' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* History List */}
      <main className="flex-1 overflow-y-auto px-5 py-6 no-scrollbar pb-32 relative z-10">
        <div className="space-y-4">
          {filteredHistory.length > 0 ? (
            <>
              {filteredHistory.map((reading) => {
                const Icon = TYPE_ICONS[reading.type] || History;
                const status = STATUS_CONFIG[reading.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.waiting;
                const StatusIcon = status.icon;

                return (
                  <motion.div
                    key={reading.id}
                    whileTap={{ scale: 0.98 }}
                    className={`p-5 rounded-[1.5rem] bg-white border border-gray-100 shadow-sm relative overflow-hidden ${
                      reading.status === 'completed' && !reading.isSeenByUser
                        ? 'border-purple-100 bg-purple-50/10'
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
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${
                          reading.status === 'completed' && !reading.isSeenByUser
                            ? 'bg-purple-100 border-purple-200'
                            : 'bg-gray-50 border-gray-100'
                        }`}>
                          <Icon className={`w-6 h-6 ${
                            reading.status === 'completed' && !reading.isSeenByUser ? 'text-purple-600' : 'text-amber-600'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-bold text-heading text-md leading-tight">{reading.title}</h3>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">{(reading.date || reading.createdAt || "").split('T')[0]}</span>
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
                            reading.isFavorite ? 'text-amber-500 bg-amber-50' : 'text-gray-300 hover:text-amber-500'
                          }`}
                        >
                          <Star className={`w-5 h-5 ${reading.isFavorite ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => onDelete(reading.id)}
                          className="p-2 rounded-lg text-gray-300 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {reading.status === 'completed' && reading.content ? (
                      <div className="space-y-4">
                        <p className="text-xs text-body line-clamp-2 leading-relaxed">
                          "{reading.content}"
                        </p>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => handleShare(reading)}
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400 hover:text-heading transition-colors"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Paylaş
                          </button>
                          <button
                            onClick={() => setSelectedReading(reading)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-heading text-white text-[10px] font-bold uppercase hover:bg-black transition-all active:scale-95"
                          >
                            İncele
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : reading.status === 'error' ? (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-center">
                        <p className="text-[10px] font-bold uppercase text-red-600">
                          {reading.error || 'Bir hata oluştu.'}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />
                          <p className="text-[10px] font-bold uppercase text-gray-400">
                            {['interpreting', 'processing_ai'].includes(reading.status) ? 'Yorumlanıyor...' : 'Beklemede...'}
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {hasMore && (
                <div className="pt-6 flex justify-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-white border border-gray-100 text-[11px] font-bold text-gray-400 hover:bg-gray-50 transition-all"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 text-purple-600" />
                        Dah Fazla Yükle
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                <History className="w-10 h-10 text-gray-200" />
              </div>
              <h3 className="text-lg font-bold text-gray-400 mb-1">Henüz Falın Yok</h3>
              <p className="text-[11px] text-gray-300 font-bold uppercase tracking-widest max-w-[200px] leading-snug">
                Yeni bir fal baktırarak arşivini oluşturmaya başlayabilirsin.
              </p>
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
