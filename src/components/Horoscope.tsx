import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X, Loader2, Moon } from "lucide-react";
import Markdown from "react-markdown";
import { getDailyHoroscope } from "../services/geminiService";

interface HoroscopeProps {
  onClose: () => void;
}

const ZODIAC_SIGNS = [
  { name: "Koç", symbol: "♈", date: "21 Mart - 19 Nisan" },
  { name: "Boğa", symbol: "♉", date: "20 Nisan - 20 Mayıs" },
  { name: "İkizler", symbol: "♊", date: "21 Mayıs - 20 Haziran" },
  { name: "Yengeç", symbol: "♋", date: "21 Haziran - 22 Temmuz" },
  { name: "Aslan", symbol: "♌", date: "23 Temmuz - 22 Ağustos" },
  { name: "Başak", symbol: "♍", date: "23 Ağustos - 22 Eylül" },
  { name: "Terazi", symbol: "♎", date: "23 Eylül - 22 Ekim" },
  { name: "Akrep", symbol: "♏", date: "23 Ekim - 21 Kasım" },
  { name: "Yay", symbol: "♐", date: "22 Kasım - 21 Aralık" },
  { name: "Oğlak", symbol: "♑", date: "22 Aralık - 19 Ocak" },
  { name: "Kova", symbol: "♒", date: "20 Ocak - 18 Şubat" },
  { name: "Balık", symbol: "♓", date: "19 Şubat - 20 Mart" }
];

export default function Horoscope({ onClose }: HoroscopeProps) {
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState<string | null>(null);

  const handleGetReading = async (sign: string) => {
    setSelectedSign(sign);
    setLoading(true);
    try {
      const result = await getDailyHoroscope(sign);
      setReading(result.text);
    } catch (error) {
      console.error("Error getting horoscope reading:", error);
      setReading("Yıldızlar bugün sessiz. Birazdan tekrar bak.");
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
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-blue-500/30 bg-black/60 shadow-2xl shadow-blue-500/20 p-8">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors text-blue-100/50 hover:text-blue-100"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-4 rounded-full bg-blue-500/10 mb-4">
            <Moon className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-3xl font-serif font-bold text-blue-50 mb-2">Günlük Burç</h2>
          <p className="text-purple-200/60 font-medium">Burcunu seç, yıldızların senin için ne dediğini öğren.</p>
        </div>

        {!reading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {ZODIAC_SIGNS.map((sign) => (
              <button
                key={sign.name}
                onClick={() => handleGetReading(sign.name)}
                disabled={loading}
                className="relative p-6 rounded-2xl border border-blue-500/10 bg-black/40 hover:border-blue-500/40 transition-all duration-300 flex flex-col items-center gap-2 group overflow-hidden active:scale-[0.98]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="text-4xl mb-2 text-blue-400 group-hover:scale-110 transition-transform">{sign.symbol}</span>
                <span className="text-lg font-serif font-bold text-blue-50">{sign.name}</span>
                <span className="text-[10px] text-blue-200/40 font-medium uppercase tracking-widest">{sign.date}</span>
                {loading && selectedSign === sign.name && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-invert prose-blue max-w-none bg-white/5 p-8 rounded-2xl border border-white/10"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3 text-blue-400">
                <Sparkles className="w-5 h-5" />
                <span className="text-sm font-bold uppercase tracking-widest">LASYA'nın Yorumu</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-200 text-sm font-bold">
                {ZODIAC_SIGNS.find(s => s.name === selectedSign)?.symbol} {selectedSign}
              </div>
            </div>
            <div className="text-purple-50/90 leading-relaxed font-serif text-lg">
              <Markdown>{reading}</Markdown>
            </div>
            <button
              onClick={() => {
                setReading(null);
                setSelectedSign(null);
              }}
              className="mt-8 w-full py-3 rounded-xl border border-blue-500/30 text-blue-100 hover:bg-blue-500/10 transition-colors font-bold uppercase tracking-widest text-sm"
            >
              Başka Bir Burca Bak
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
