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
      className="fixed inset-0 z-[110] bg-[#050505] overflow-y-auto custom-scrollbar"
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
            className="p-3 rounded-2xl bg-white/5 border border-white/10 text-purple-200/40 hover:text-amber-400 transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-purple-200/40 hover:text-amber-400 transition-colors">
              <Heart className="w-5 h-5" />
            </button>
            <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-purple-200/40 hover:text-amber-400 transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-3 rounded-2xl bg-white/5 border border-white/10 text-purple-200/40 hover:text-amber-400 transition-colors">
              <Save className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="text-center space-y-4 mb-12">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex p-4 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4"
          >
            <Sparkles className="w-8 h-8" />
          </motion.div>
          <h1 className="text-4xl font-serif font-bold text-amber-50 tracking-tight">{reading.title}</h1>
          <div className="flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-[0.2em] text-purple-200/40">
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3" />
              <span>{reading.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>14:30</span>
            </div>
          </div>
        </div>

        {/* Content with Progressive Reveal */}
        <div className="space-y-8">
          <div className="p-8 rounded-[2.5rem] border border-white/5 bg-white/5 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Star className="w-32 h-32 text-amber-400" />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="relative z-10"
            >
              <div className="text-lg font-serif italic text-amber-100/80 leading-relaxed space-y-6">
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

            <div className="mt-12 pt-8 border-t border-white/5 flex justify-center">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-400/40">
                <Sparkles className="w-3 h-3" />
                <span>Ahlas'ın Kehaneti</span>
                <Sparkles className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Advice Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
            className="p-6 rounded-3xl bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20"
          >
            <h4 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">Günün Tavsiyesi</h4>
            <p className="text-sm text-purple-200/60 leading-relaxed italic">
              "Evrenin akışına güven, bugün karşına çıkan tesadüfler aslında senin için hazırlanmış birer rehber."
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
