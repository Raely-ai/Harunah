import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowLeft, Moon, Sparkles, Star, ChevronRight, Heart, Briefcase, Activity, Loader2 } from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { Horoscope } from "../types";

interface HoroscopeScreenProps {
  onBack: () => void;
  userSign?: string;
}

const SIGNS = [
  { id: 'Koç', name: 'Koç', symbol: '♈', date: '21 Mart - 19 Nisan' },
  { id: 'Boğa', name: 'Boğa', symbol: '♉', date: '20 Nisan - 20 Mayıs' },
  { id: 'İkizler', name: 'İkizler', symbol: '♊', date: '21 Mayıs - 20 Haziran' },
  { id: 'Yengeç', name: 'Yengeç', symbol: '♋', date: '21 Haziran - 22 Temmuz' },
  { id: 'Aslan', name: 'Aslan', symbol: '♌', date: '23 Temmuz - 22 Ağustos' },
  { id: 'Başak', name: 'Başak', symbol: '♍', date: '23 Ağustos - 22 Eylül' },
  { id: 'Terazi', name: 'Terazi', symbol: '♎', date: '23 Eylül - 22 Ekim' },
  { id: 'Akrep', name: 'Akrep', symbol: '♏', date: '23 Ekim - 21 Kasım' },
  { id: 'Yay', name: 'Yay', symbol: '♐', date: '22 Kasım - 21 Aralık' },
  { id: 'Oğlak', name: 'Oğlak', symbol: '♑', date: '22 Aralık - 19 Ocak' },
  { id: 'Kova', name: 'Kova', symbol: '♒', date: '20 Ocak - 18 Şubat' },
  { id: 'Balık', name: 'Balık', symbol: '♓', date: '19 Şubat - 20 Mart' },
];

export default function HoroscopeScreen({ onBack, userSign }: HoroscopeScreenProps) {
  const [horoscopes, setHoroscopes] = useState<Record<string, Horoscope>>({});
  const [selectedSign, setSelectedSign] = useState<string | null>(userSign || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHoroscopes = async () => {
      try {
        const q = query(collection(db, "horoscopes"));
        const snapshot = await getDocs(q);
        const data: Record<string, Horoscope> = {};
        snapshot.forEach(doc => {
          data[doc.id] = doc.data() as Horoscope;
        });
        setHoroscopes(data);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, "horoscopes");
      } finally {
        setLoading(false);
      }
    };
    fetchHoroscopes();
  }, []);

  const currentSignData = SIGNS.find(s => s.id === selectedSign);
  const currentHoroscope = selectedSign ? horoscopes[selectedSign] : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selectedSign]);

  return (
    <div className="h-full bg-[#050505] text-amber-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-black/60 backdrop-blur-xl border-b border-white/5 px-4 py-6 flex items-center gap-4">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-amber-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-serif font-bold text-amber-50">Günün Gökyüzü</h1>
          <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40">Yıldızların Fısıltısı</p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar pb-32">
        <div className="max-w-4xl mx-auto px-4 pt-8">
          <AnimatePresence mode="wait">
            {!selectedSign ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-2 gap-4"
              >
                {SIGNS.map((sign) => (
                  <motion.button
                    key={sign.id}
                    whileHover={{ scale: 1.02, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedSign(sign.id)}
                    className="p-6 rounded-[2rem] border border-white/5 bg-white/5 flex flex-col items-center text-center group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">{sign.symbol}</span>
                    <h3 className="text-sm font-bold text-amber-50 mb-1">{sign.name}</h3>
                    <p className="text-[8px] text-purple-200/40 uppercase tracking-widest">{sign.date}</p>
                  </motion.button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="detail"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-8"
              >
                <div className="relative p-10 rounded-[3rem] border border-blue-500/20 bg-gradient-to-br from-blue-900/10 to-transparent backdrop-blur-2xl overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-5">
                    <Moon className="w-48 h-48 text-blue-400" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-6xl mb-6">
                      {currentSignData?.symbol}
                    </div>
                    <h2 className="text-3xl font-serif font-bold text-blue-50 mb-2">{currentSignData?.name} Burcu</h2>
                    <p className="text-xs font-bold uppercase tracking-[0.3em] text-blue-400/60 mb-8">{currentSignData?.date}</p>
                    
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent mb-8" />
                    
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-blue-400 animate-spin opacity-20" />
                      </div>
                    ) : currentHoroscope ? (
                      <div className="space-y-8 text-left w-full">
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <h4 className="text-xs font-black uppercase tracking-widest text-amber-400/60">Genel Yorum</h4>
                          </div>
                          <p className="text-lg text-purple-100/80 leading-relaxed font-serif italic">
                            "{currentHoroscope.content}"
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-purple-200/30 mb-2">Aşk</p>
                            <div className="text-amber-400 text-sm">★★★★☆</div>
                          </div>
                          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-purple-200/30 mb-2">Para</p>
                            <div className="text-amber-400 text-sm">★★★☆☆</div>
                          </div>
                          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center">
                            <p className="text-[8px] font-bold uppercase tracking-widest text-purple-200/30 mb-2">Sağlık</p>
                            <div className="text-amber-400 text-sm">★★★★★</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                        <p className="text-purple-200/40 italic">Bugün için henüz bir yorum girilmemiş.</p>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedSign(null)}
                  className="w-full py-6 rounded-2xl bg-white/5 border border-white/10 text-amber-400 font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  Tüm Burçları Gör
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
