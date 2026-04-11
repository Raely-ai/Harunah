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
import { FortuneReading, FortuneType, UserProfile } from "../types";
import { toast } from "sonner";

interface HistoryScreenProps {
  history: FortuneReading[];
  userProfile: UserProfile;
  onBack: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onRefresh?: () => Promise<void>;
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

export default function HistoryScreen({ history, userProfile, onBack, onDelete, onToggleFavorite, onRefresh }: HistoryScreenProps) {
  const [filter, setFilter] = useState<FortuneType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReading, setSelectedReading] = useState<FortuneReading | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    <div className="fixed inset-0 z-40 bg-[#F6F4F8] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 header-gradient backdrop-blur-xl border-b border-black/5 px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="p-2 rounded-xl bg-black/5 border border-black/5"
            >
              <ArrowLeft className="w-5 h-5 text-heading" />
            </motion.button>
            <div>
              <h1 className="text-xl font-serif font-bold text-heading">Kehanet Arşivi</h1>
              <p className="text-[10px] text-muted uppercase tracking-widest font-bold">Geçmişin İzleri</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`w-10 h-10 rounded-xl bg-black/5 border border-black/5 flex items-center justify-center hover:bg-black/10 transition-colors ${isRefreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className={`w-5 h-5 text-amber-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Kehanetlerde ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/5 border border-black/5 rounded-2xl py-3 pl-12 pr-4 text-sm text-heading placeholder:text-muted focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                filter === 'all' ? 'bg-heading text-white' : 'bg-black/5 text-muted hover:bg-black/10'
              }`}
            >
              Tümü
            </button>
            {Object.keys(TYPE_ICONS).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type as FortuneType)}
                className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                  filter === type ? 'bg-heading text-white' : 'bg-black/5 text-muted hover:bg-black/10'
                }`}
              >
                {type === 'coffee' ? 'Kahve' : (type === 'su' || type === 'water') ? 'Su' : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* History List */}
      <main className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar pb-32">
        <div className="space-y-4">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((reading) => {
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
                  <div className={`p-6 rounded-[2.5rem] border border-black/5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-500 hover:shadow-xl ${
                    reading.isFavorite ? 'border-amber-500/30 ring-1 ring-amber-500/10' : ''
                  }`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden shadow-inner ${
                          reading.type === 'coffee' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-purple-50 text-purple-600 border border-purple-100'
                        }`}>
                          <div className="absolute inset-0 bg-gradient-to-br from-white to-transparent opacity-40" />
                          <Icon className="w-7 h-7 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div>
                          <h3 className="font-serif font-bold text-heading text-lg group-hover:text-amber-700 transition-colors">{reading.title}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-muted uppercase tracking-widest font-bold">
                              {reading.createdAt ? new Date(reading.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-black/10" />
                            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${status.bg} ${status.color} border border-black/5 shadow-sm`}>
                              <StatusIcon className="w-3 h-3" />
                              <span className="text-[9px] font-black uppercase tracking-widest">{status.label}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onToggleFavorite(reading.id)}
                          className={`p-2.5 rounded-xl transition-all ${
                            reading.isFavorite ? 'text-amber-600 bg-amber-50 shadow-sm border border-amber-100' : 'text-muted hover:text-amber-600 hover:bg-black/5'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${reading.isFavorite ? 'fill-current' : ''}`} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => onDelete(reading.id)}
                          className="p-2.5 rounded-xl text-muted hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </div>

                    {reading.status === 'completed' && reading.content ? (
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/5 relative overflow-hidden">
                          <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                            <Icon className="w-16 h-16" />
                          </div>
                          <p className="text-sm text-body line-clamp-2 leading-relaxed italic relative z-10">
                            "{reading.content || 'Kehanetin hazırlanıyor...'}"
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-black/5">
                          <button
                            onClick={() => handleShare(reading)}
                            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-amber-600 transition-colors"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            Paylaş
                          </button>
                          <button
                            onClick={() => setSelectedReading(reading)}
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 hover:translate-x-1 transition-transform"
                          >
                            Detayları Gör
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : reading.status === 'error' ? (
                      <div className="space-y-4">
                        <div className="p-5 rounded-2xl bg-red-50 border border-dashed border-red-200 text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">
                            {reading.error || 'Bir hata oluştu, lütfen tekrar deneyin.'}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-5 rounded-2xl bg-black/[0.02] border border-dashed border-black/10 text-center relative overflow-hidden">
                          <motion.div 
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted relative z-10">
                            {['interpreting', 'processing_ai'].includes(reading.status) ? 'Yorumcu kehanetini hazırlıyor...' : reading.status === 'searching' ? 'Yorumcu aranıyor...' : reading.status === 'found' ? 'Yorumcu bulundu, hazırlanıyor...' : 'Kehanetin yorumlanmayı bekliyor.'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted/60">İşlem Devam Ediyor</span>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-black/5 flex items-center justify-center mb-6">
                <History className="w-10 h-10 text-muted" />
              </div>
              <h3 className="text-lg font-serif font-bold text-heading mb-2">Henüz Bir Kehanet Yok</h3>
              <p className="text-sm text-muted max-w-[200px]">Geçmiş kehanetlerini burada görebilirsin.</p>
            </div>
          )}
        </div>
      </main>

      {/* Reading Detail Modal */}
      <AnimatePresence>
        {selectedReading && selectedReading.status === 'completed' && selectedReading.content && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={() => setSelectedReading(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="w-full max-w-lg bg-white rounded-t-[3rem] p-8 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-black/10 rounded-full mx-auto mb-8" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  {(() => {
                    const Icon = TYPE_ICONS[selectedReading.type] || History;
                    return <Icon className="w-8 h-8 text-amber-600" />;
                  })()}
                </div>
                <div>
                  <h2 className="text-2xl font-serif font-bold text-heading">{selectedReading.title}</h2>
                  <p className="text-xs text-muted uppercase tracking-widest font-bold">{selectedReading.date}</p>
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
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {selectedReading.cards.map((card, idx) => (
                      <div key={idx} className="flex-shrink-0 w-24 aspect-[2/3] rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl">
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
                  className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-amber-600 text-white text-sm font-bold uppercase tracking-widest hover:bg-amber-700 transition-colors"
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
