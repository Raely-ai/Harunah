import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CreditCard, User, Calendar, ArrowRight, Sparkles, CheckCircle2, ChevronLeft, ChevronRight, X, Plus, Zap, Loader2 } from "lucide-react";
import RitualScreen from "./RitualScreen";
import { UserProfile, AppConfig } from "../types";
import { toast } from "sonner";

interface TarotFlowProps {
  userProfile: UserProfile;
  config: AppConfig;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onComplete: (data: any) => void;
  onClose: () => void;
}

const TAROT_CARDS = [
  "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor", "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit", "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance", "The Devil", "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World",
  "Ace of Wands", "Two of Wands", "Three of Wands", "Four of Wands", "Five of Wands", "Six of Wands", "Seven of Wands", "Eight of Wands", "Nine of Wands", "Ten of Wands", "Page of Wands", "Knight of Wands", "Queen of Wands", "King of Wands",
  "Ace of Cups", "Two of Cups", "Three of Cups", "Four of Cups", "Five of Cups", "Six of Cups", "Seven of Cups", "Eight of Cups", "Nine of Cups", "Ten of Cups", "Page of Cups", "Knight of Cups", "Queen of Cups", "King of Cups",
  "Ace of Swords", "Two of Swords", "Three of Swords", "Four of Swords", "Five of Swords", "Six of Swords", "Seven of Swords", "Eight of Swords", "Nine of Swords", "Ten of Swords", "Page of Swords", "Knight of Swords", "Queen of Swords", "King of Swords",
  "Ace of Pentacles", "Two of Pentacles", "Three of Pentacles", "Four of Pentacles", "Five of Pentacles", "Six of Pentacles", "Seven of Pentacles", "Eight of Pentacles", "Nine of Pentacles", "Ten of Pentacles", "Page of Pentacles", "Knight of Pentacles", "Queen of Pentacles", "King of Pentacles"
];

export default function TarotFlow({ userProfile, config, onUpdateProfile, onComplete, onClose }: TarotFlowProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReading, setActiveReading] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    birthDate: '',
    relationshipStatus: 'single',
    selectedCards: [] as string[]
  });

  const price = config.prices.tarot;
  const isSubscribed = userProfile.subscription?.status === 'active';

  const nextStep = () => setStep(s => s + 1);

  const handleCardSelect = (card: string) => {
    if (formData.selectedCards.includes(card)) {
      setFormData({ ...formData, selectedCards: formData.selectedCards.filter(c => c !== card) });
    } else if (formData.selectedCards.length < 3) {
      setFormData({ ...formData, selectedCards: [...formData.selectedCards, card] });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#050505] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 text-purple-200/60"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <div>
            <h1 className="text-xl font-serif font-bold text-amber-50">Tarot Açılımı</h1>
            <p className="text-xs text-purple-200/40">Geleceğin kapılarını arala</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
          <CreditCard className="w-3 h-3 text-amber-400" />
          <span className="text-xs font-bold text-amber-400">{userProfile.credits}</span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="relative h-1 bg-white/5">
        <motion.div 
          className="h-full bg-purple-500"
          initial={{ width: "0%" }}
          animate={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-24">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif font-bold text-purple-50">Tarot Yolculuğu</h2>
                <p className="text-purple-200/40">Kartların enerjisine odaklanmak için bilgilerini gir.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">İsim</label>
                  <input 
                    type="text"
                    placeholder="İsim giriniz..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-purple-50 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Doğum Tarihi</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20" />
                    <input 
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-purple-50 focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">İlişki Durumu</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['single', 'taken', 'complicated', 'divorced'].map((s) => (
                      <button
                        key={s}
                        onClick={() => setFormData({ ...formData, relationshipStatus: s })}
                        className={`py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                          formData.relationshipStatus === s 
                            ? "border-purple-500/50 bg-purple-500/10 text-purple-400" 
                            : "border-white/5 bg-white/5 text-purple-200/40"
                        }`}
                      >
                        {s === 'single' ? 'Bekar' : s === 'taken' ? 'İlişkisi Var' : s === 'complicated' ? 'Karışık' : 'Boşanmış'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                disabled={!formData.name || !formData.birthDate}
                onClick={nextStep}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold shadow-2xl shadow-purple-900/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
              >
                <span>Kart Seçimine Geç</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex flex-col h-full"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif font-bold text-purple-50">Kartlarını Seç</h2>
                <p className="text-purple-200/40">Geçmiş, Şimdi ve Gelecek için 3 kart seç.</p>
              </div>

              {/* Selected Cards Display */}
              <div className="flex justify-center gap-4 py-4">
                {[0, 1, 2].map((i) => (
                  <div 
                    key={i}
                    className="w-24 h-36 rounded-xl border border-white/10 bg-white/5 flex flex-col items-center justify-center relative overflow-hidden group"
                  >
                    <div className="absolute top-2 left-0 right-0 text-center">
                      <span className="text-[8px] font-bold uppercase tracking-widest text-purple-200/40">
                        {i === 0 ? 'GEÇMİŞ' : i === 1 ? 'ŞİMDİ' : 'GELECEK'}
                      </span>
                    </div>
                    
                    {formData.selectedCards[i] ? (
                      <motion.div
                        initial={{ rotateY: 180, opacity: 0 }}
                        animate={{ rotateY: 0, opacity: 1 }}
                        className="w-full h-full flex flex-col items-center justify-center p-2 text-center pt-6"
                      >
                        <div className="absolute inset-0 bg-purple-500/20" />
                        <div className="relative z-10 flex flex-col items-center">
                          {/* Card Back Pattern for Selected Card */}
                          <div className="absolute inset-0 opacity-40 pointer-events-none">
                            <div className="absolute inset-1 border border-purple-500/30 rounded-sm flex items-center justify-center">
                              <div className="w-full h-full border border-purple-500/20 rounded-sm rotate-45 scale-150" />
                              <Sparkles className="absolute w-4 h-4 text-purple-400/40" />
                            </div>
                          </div>
                          <CreditCard className="w-8 h-8 text-purple-400 mb-2 relative z-10" />
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                        </div>
                        <button 
                          onClick={() => handleCardSelect(formData.selectedCards[i])}
                          className="absolute top-2 right-2 p-1 bg-red-500/80 rounded-full z-20 hover:bg-red-500 transition-colors"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </motion.div>
                    ) : (
                      <div className="mt-4 flex flex-col items-center gap-2 opacity-20">
                        <div className="w-8 h-12 rounded-md border border-dashed border-purple-200/40 flex items-center justify-center">
                          <Plus className="w-4 h-4 text-purple-200/40" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Card Grid */}
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-4 gap-3 pb-8">
                  {TAROT_CARDS.map((card, i) => {
                    const isSelected = formData.selectedCards.includes(card);
                    return (
                      <motion.button
                        key={card}
                        whileHover={!isSelected ? { y: -4, scale: 1.05 } : {}}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleCardSelect(card)}
                        className={`aspect-[2/3] rounded-lg border transition-all flex flex-col items-center justify-center p-2 relative overflow-hidden ${
                          isSelected
                            ? "border-purple-500 bg-purple-500/20 opacity-40 grayscale"
                            : "border-white/10 bg-gradient-to-br from-purple-900/20 to-black hover:border-purple-500/50"
                        }`}
                      >
                        {/* Card Back Pattern */}
                        {!isSelected && (
                          <div className="absolute inset-0 opacity-30 pointer-events-none">
                            <div className="absolute inset-1 border border-purple-500/20 rounded-sm flex items-center justify-center">
                              <div className="w-full h-full border border-purple-500/10 rounded-sm rotate-45 scale-150" />
                              <Sparkles className="absolute w-4 h-4 text-purple-400/40" />
                            </div>
                          </div>
                        )}
                        
                        <div className={`relative z-10 flex flex-col items-center ${isSelected ? 'invisible' : 'hidden'}`}>
                          <div className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center mb-1">
                            <div className="w-1 h-1 bg-purple-400 rounded-full" />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <button
                disabled={formData.selectedCards.length < 3 || isProcessing}
                onClick={async () => {
                  setIsProcessing(true);
                  try {
                    const reading = await onComplete({ ...formData, type: 'tarot', cards: formData.selectedCards });
                    setActiveReading(reading);
                    nextStep();
                  } catch (error) {
                    console.error("Submit error:", error);
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold shadow-2xl shadow-purple-900/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Kehaneti Başlat</span>
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <RitualScreen type="tarot" reading={activeReading} onClose={onClose} />
          )}
        </AnimatePresence>
      </div>
      
      {step < 3 && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/5 text-purple-200/40"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
