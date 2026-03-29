import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Loader2, CreditCard } from "lucide-react";
import Markdown from "react-markdown";
import { getTarotReading } from "../services/geminiService";

interface TarotReadingProps {
  onClose: () => void;
}

const TAROT_CARDS = [
  "Büyücü", "Azize", "İmparatoriçe", "İmparator", "Aziz", "Aşıklar", "Araba", "Güç", "Ermiş", "Kader Çarkı",
  "Adalet", "Asılan Adam", "Ölüm", "Denge", "Şeytan", "Yıkılan Kule", "Yıldız", "Ay", "Güneş", "Mahkeme", "Dünya", "Joker"
];

export default function TarotReading({ onClose }: TarotReadingProps) {
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState<string | null>(null);

  const handleCardClick = (card: string) => {
    if (selectedCards.includes(card)) {
      setSelectedCards(selectedCards.filter((c) => c !== card));
    } else if (selectedCards.length < 3) {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleGetReading = async () => {
    if (selectedCards.length !== 3) return;
    setLoading(true);
    try {
      const result = await getTarotReading(selectedCards);
      setReading(result);
    } catch (error) {
      console.error("Error getting tarot reading:", error);
      setReading("Kartların fısıltısını duyamadım. Tekrar seçer misin?");
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
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-purple-500/30 bg-black/60 shadow-2xl shadow-purple-500/20 p-8">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors text-purple-100/50 hover:text-purple-100"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-4 rounded-full bg-purple-500/10 mb-4">
            <CreditCard className="w-10 h-10 text-purple-400" />
          </div>
          <h2 className="text-3xl font-serif font-bold text-purple-50 mb-2">Tarot Falı</h2>
          <p className="text-purple-200/60 font-medium">Kaderini belirleyecek 3 kart seç, Ahlas senin için yorumlasın.</p>
        </div>

        {!reading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {TAROT_CARDS.map((card, index) => (
                <motion.button
                  key={index}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCardClick(card)}
                  className={`aspect-[2/3] rounded-lg border transition-all duration-300 flex items-center justify-center p-2 text-center text-[10px] font-bold uppercase tracking-tighter leading-tight ${
                    selectedCards.includes(card)
                      ? "bg-purple-500 border-purple-400 text-white shadow-lg shadow-purple-500/40"
                      : "bg-black/40 border-purple-500/20 text-purple-200/40 hover:border-purple-500/40"
                  }`}
                >
                  {selectedCards.includes(card) ? card : "?"}
                </motion.button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-4">
              <div className="text-sm font-bold uppercase tracking-widest text-purple-200/60">
                Seçilen Kartlar: {selectedCards.length} / 3
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleGetReading}
                disabled={selectedCards.length !== 3 || loading}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold text-lg shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Kartlar Yorumlanıyor...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" />
                    <span>Kaderimi Oku</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-invert prose-purple max-w-none bg-white/5 p-8 rounded-2xl border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6 text-purple-400">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-widest">Ahlas'ın Yorumu</span>
            </div>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {selectedCards.map((card, i) => (
                <div key={i} className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-200 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                  {card}
                </div>
              ))}
            </div>
            <div className="text-purple-50/90 leading-relaxed font-serif text-lg">
              <Markdown>{reading}</Markdown>
            </div>
            <button
              onClick={() => {
                setReading(null);
                setSelectedCards([]);
              }}
              className="mt-8 w-full py-3 rounded-xl border border-purple-500/30 text-purple-100 hover:bg-purple-500/10 transition-colors font-bold uppercase tracking-widest text-sm"
            >
              Yeni Kart Seç
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
