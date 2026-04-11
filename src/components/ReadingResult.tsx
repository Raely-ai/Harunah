import { motion } from "motion/react";
import { 
  Save, 
  Share2, 
  Heart, 
  ChevronLeft, 
  Sparkles,
  Calendar,
  Clock,
  Star
} from "lucide-react";
import { FortuneReading } from "../types";

interface ReadingResultProps {
  reading: FortuneReading;
  onClose: () => void;
}

export default function ReadingResult({ reading, onClose }: ReadingResultProps) {
  // Only show result if status is completed and content exists
  if (reading.status !== 'completed' || !reading.content) {
    return null;
  }

  // Function to highlight important words in gold
  const highlightText = (text: string) => {
    const keywords = ['aşk', 'para', 'kariyer', 'şans', 'kısmet', 'yolculuk', 'haber', 'mutluluk', 'başarı', 'beklenti'];
    const parts = text.split(new RegExp(`(${keywords.join('|')})`, 'gi'));
    
    return parts.map((part, i) => {
      if (keywords.some(k => k.toLowerCase() === part.toLowerCase())) {
        return <span key={i} className="text-amber-400 font-bold">{part}</span>;
      }
      return part;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-[#FDFCFE] overflow-y-auto custom-scrollbar"
    >
      {/* Mystical Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-amber-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-12 pb-32">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={onClose}
            className="p-3 rounded-2xl bg-white border border-black/5 text-muted hover:text-amber-600 transition-colors shadow-sm"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <button className="p-3 rounded-2xl bg-white border border-black/5 text-muted hover:text-amber-600 transition-colors shadow-sm">
              <Heart className="w-5 h-5" />
            </button>
            <button className="p-3 rounded-2xl bg-white border border-black/5 text-muted hover:text-amber-600 transition-colors shadow-sm">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-3 rounded-2xl bg-white border border-black/5 text-muted hover:text-amber-600 transition-colors shadow-sm">
              <Save className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="text-center space-y-4 mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex p-4 rounded-3xl bg-amber-50 border border-amber-100 text-amber-600 mb-4 shadow-sm"
          >
            <Sparkles className="w-8 h-8" />
          </motion.div>
          <h1 className="text-4xl font-serif font-bold text-heading tracking-tight">{reading.title}</h1>
          <div className="flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              <span>{reading.createdAt ? new Date(reading.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>{reading.createdAt ? new Date(reading.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
            </div>
          </div>
        </div>

        {/* Content with Progressive Reveal */}
        <div className="space-y-8">
          <div className="p-10 rounded-[3rem] border border-black/5 bg-white shadow-[0_20px_50px_rgba(0,0,0,0.08)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
              <Star className="w-48 h-48 text-amber-600" />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="relative z-10"
            >
              <div className="text-xl font-serif italic text-body leading-relaxed space-y-8">
                {(reading.content || "").split('\n\n').map((paragraph, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.4 }}
                    className="relative"
                  >
                    <span className="absolute -left-4 top-0 w-1 h-full bg-amber-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    {highlightText(paragraph)}
                  </motion.p>
                ))}
              </div>
            </motion.div>

            <div className="mt-16 pt-10 border-t border-black/5 flex flex-col items-center gap-4">
              <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-amber-600/40">
                <div className="w-8 h-[1px] bg-amber-600/20" />
                <Sparkles className="w-4 h-4" />
                <span>LASYA'nın Kehaneti</span>
                <Sparkles className="w-4 h-4" />
                <div className="w-8 h-[1px] bg-amber-600/20" />
              </div>
              <p className="text-[9px] text-muted/40 font-medium italic">Bu kehanet evrenin enerjisiyle sana özel hazırlanmıştır.</p>
            </div>
          </div>

          {/* Advice Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5 }}
            className="p-10 rounded-[2.5rem] bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:rotate-12 transition-transform duration-700">
              <Heart className="w-24 h-24" />
            </div>
            <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200 mb-4">Günün Tavsiyesi</h4>
            <p className="text-lg leading-relaxed italic font-serif relative z-10">
              "Evrenin akışına güven, bugün karşına çıkan tesadüfler aslında senin için hazırlanmış birer rehber."
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
