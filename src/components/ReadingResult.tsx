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
          <div className="p-8 rounded-[2.5rem] border border-black/5 bg-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Star className="w-32 h-32 text-amber-600" />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="relative z-10"
            >
              <div className="text-lg font-serif italic text-body leading-relaxed space-y-6">
                {reading.content.split('\n\n').map((paragraph, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.3 }}
                  >
                    {highlightText(paragraph)}
                  </motion.p>
                ))}
              </div>
            </motion.div>

            <div className="mt-12 pt-8 border-t border-black/5 flex justify-center">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600/40">
                <Sparkles className="w-3 h-3" />
                <span>LASYA'nın Kehaneti</span>
                <Sparkles className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Advice Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
            className="p-6 rounded-3xl bg-indigo-50 border border-indigo-100 shadow-sm"
          >
            <h4 className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">Günün Tavsiyesi</h4>
            <p className="text-sm text-muted leading-relaxed italic">
              "Evrenin akışına güven, bugün karşına çıkan tesadüfler aslında senin için hazırlanmış birer rehber."
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
