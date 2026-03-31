import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Loader2, Cloud } from "lucide-react";
import Markdown from "react-markdown";
import { getDreamInterpretation } from "../services/geminiService";

interface DreamInterpretationProps {
  onClose: () => void;
}

export default function DreamInterpretation({ onClose }: DreamInterpretationProps) {
  const [dream, setDream] = useState("");
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState<string | null>(null);

  const handleGetReading = async () => {
    if (!dream.trim()) return;
    setLoading(true);
    try {
      const result = await getDreamInterpretation(dream);
      setReading(result.text);
    } catch (error) {
      console.error("Error getting dream interpretation:", error);
      setReading("Rüyanın derinliklerine inemedim. Tekrar anlatır mısın?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-indigo-500/30 bg-black/60 shadow-2xl shadow-indigo-500/20 p-8">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors text-indigo-100/50 hover:text-indigo-100"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-4 rounded-full bg-indigo-500/10 mb-4">
            <Cloud className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-serif font-bold text-indigo-50 mb-2">Rüya Tabiri</h2>
          <p className="text-purple-200/60 font-medium">Gördüğün rüyayı anlat, Ahlas senin için gizemini çözsün.</p>
        </div>

        {!reading ? (
          <div className="space-y-8">
            <div className="relative">
              <textarea
                value={dream}
                onChange={(e) => setDream(e.target.value)}
                placeholder="Dün gece rüyamda..."
                className="w-full h-48 p-6 rounded-2xl border border-indigo-500/20 bg-black/40 text-indigo-50 placeholder:text-indigo-500/20 focus:outline-none focus:border-indigo-500/40 transition-colors resize-none font-serif text-lg leading-relaxed"
              />
              <div className="absolute bottom-4 right-4 text-[10px] font-bold uppercase tracking-widest text-indigo-500/40">
                {dream.length} Karakter
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetReading}
              disabled={!dream.trim() || loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold text-lg shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Rüya Çözülüyor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>Rüyamı Yorumla</span>
                </>
              )}
            </motion.button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-invert prose-indigo max-w-none bg-white/5 p-8 rounded-2xl border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6 text-indigo-400">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-widest">Ahlas'ın Yorumu</span>
            </div>
            <div className="text-purple-50/90 leading-relaxed font-serif text-lg">
              <Markdown>{reading}</Markdown>
            </div>
            <button
              onClick={() => {
                setReading(null);
                setDream("");
              }}
              className="mt-8 w-full py-3 rounded-xl border border-indigo-500/30 text-indigo-100 hover:bg-indigo-500/10 transition-colors font-bold uppercase tracking-widest text-sm"
            >
              Başka Bir Rüya Anlat
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
