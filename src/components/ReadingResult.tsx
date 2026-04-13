import { motion } from "motion/react";
import { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
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
  useEffect(() => {
    if (reading.id && !reading.isSeenByUser) {
      const markAsSeen = async () => {
        try {
          await updateDoc(doc(db, "readings", reading.id), {
            isSeenByUser: true
          });
        } catch (error) {
          console.error("Error marking reading as seen:", error);
        }
      };
      markAsSeen();
    }
  }, [reading.id, reading.isSeenByUser]);

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
      className="fixed inset-0 z-[110] bg-[#0A0510] overflow-y-auto custom-scrollbar"
    >
      {/* Mystical Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-purple-900/20 via-transparent to-amber-900/10" />
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-12 pb-32">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-12">
          <button 
            onClick={onClose}
            className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-amber-400 transition-all shadow-xl backdrop-blur-xl active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <button className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-amber-400 transition-all shadow-xl backdrop-blur-xl active:scale-95">
              <Heart className="w-5 h-5" />
            </button>
            <button className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-amber-400 transition-all shadow-xl backdrop-blur-xl active:scale-95">
              <Share2 className="w-5 h-5" />
            </button>
            <button className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 hover:text-amber-400 transition-all shadow-xl backdrop-blur-xl active:scale-95">
              <Save className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Title & Metadata */}
        <div className="text-center space-y-6 mb-16">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex p-5 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-4 shadow-[0_0_30px_rgba(245,158,11,0.1)]"
          >
            <Sparkles className="w-10 h-10" />
          </motion.div>
          <h1 className="text-5xl font-serif font-bold text-white tracking-tight leading-tight">{reading.title}</h1>
          <div className="flex items-center justify-center gap-8 text-[11px] font-black uppercase tracking-[0.3em] text-white/30">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{reading.createdAt ? new Date(reading.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{reading.createdAt ? new Date(reading.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
            </div>
          </div>
        </div>

        {/* Content with Progressive Reveal */}
        <div className="space-y-10">
          <div className="p-12 rounded-[4rem] border border-white/10 bg-white/[0.03] backdrop-blur-3xl shadow-[0_40px_100px_rgba(0,0,0,0.4)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-16 opacity-[0.05] pointer-events-none group-hover:scale-110 transition-transform duration-1000">
              <Star className="w-64 h-64 text-amber-500" />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="relative z-10"
            >
              <div className="text-2xl font-serif text-white/90 leading-[2.2] space-y-12 tracking-wide">
                {(reading.content || "").split('\n\n').map((paragraph, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.4 }}
                    className="relative"
                  >
                    <span className="absolute -left-6 top-0 w-1.5 h-full bg-amber-500/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    {highlightText(paragraph)}
                  </motion.p>
                ))}
              </div>
            </motion.div>

            <div className="mt-20 pt-12 border-t border-white/5 flex flex-col items-center gap-6">
              <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.4em] text-amber-500/40">
                <div className="w-12 h-[1px] bg-amber-500/20" />
                <Sparkles className="w-5 h-5" />
                <span>LASYA'nın Kehaneti</span>
                <Sparkles className="w-5 h-5" />
                <div className="w-12 h-[1px] bg-amber-500/20" />
              </div>
              <p className="text-[10px] text-white/30 font-bold tracking-widest uppercase italic">Bu kehanet evrenin enerjisiyle sana özel hazırlanmıştır.</p>
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
