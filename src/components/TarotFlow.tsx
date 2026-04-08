import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CreditCard, User, Calendar, ArrowRight, Sparkles, CheckCircle2, ChevronLeft, ChevronRight, X, Plus, Zap, Loader2 } from "lucide-react";
import RitualScreen from "./RitualScreen";
import PaymentSummary from "./PaymentSummary";
import { UserProfile, AppConfig, EconomyConfig } from "../types";
import { toast } from "sonner";

interface TarotFlowProps {
  userProfile: UserProfile;
  config: AppConfig;
  economyConfig: EconomyConfig;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onComplete: (data: any) => Promise<any>;
  onClose: () => void;
  onSocialClick?: () => void;
}

const TAROT_CARDS = Array.from({ length: 78 }, (_, i) => `Card ${i + 1}`);

export default function TarotFlow({ userProfile, config, economyConfig, onUpdateProfile, onComplete, onClose, onSocialClick }: TarotFlowProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReading, setActiveReading] = useState<any>(null);
  const [formData, setFormData] = useState({
    adSoyad: userProfile.displayName || '',
    dogumTarihi: userProfile.birthDate || '',
    iliskiDurumu: userProfile.relationshipStatus || 'single',
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
    <div className="fixed inset-0 z-[100] bg-[#FDFCFE] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-black/5 px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 rounded-full bg-black/5 text-muted"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <div>
            <h1 className="text-xl font-serif font-bold text-heading">Tarot Açılımı</h1>
            <p className="text-xs text-muted">Geleceğin kapılarını arala</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-full">
          <CreditCard className="w-3 h-3 text-amber-600" />
          <span className="text-xs font-bold text-amber-600">{userProfile.mainCoins || 0}</span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="relative h-1 bg-black/5">
        <motion.div 
          className="h-full bg-purple-600"
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
                <h2 className="text-3xl font-serif font-bold text-heading">Tarot Yolculuğu</h2>
                <p className="text-muted">Kartların enerjisine odaklanmak için bilgilerini gir.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Ad Soyad</label>
                  <input 
                    type="text"
                    placeholder="Adınız ve soyadınız..."
                    value={formData.adSoyad}
                    onChange={(e) => setFormData({ ...formData, adSoyad: e.target.value })}
                    className="w-full bg-black/5 border border-black/10 rounded-2xl px-6 py-4 text-heading focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Doğum Tarihi</label>
                  <div className="relative">
                    <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/40" />
                    <input 
                      type="date"
                      value={formData.dogumTarihi}
                      onChange={(e) => setFormData({ ...formData, dogumTarihi: e.target.value })}
                      className="w-full bg-black/5 border border-black/10 rounded-2xl pl-14 pr-6 py-4 text-heading focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">İlişki Durumu</label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'single', label: 'Bekar' },
                      { id: 'taken', label: 'İlişkisi Var' },
                      { id: 'complicated', label: 'Karışık' },
                      { id: 'divorced', label: 'Boşanmış' }
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setFormData({ ...formData, iliskiDurumu: s.id })}
                        className={`py-3 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${
                          formData.iliskiDurumu === s.id 
                            ? "border-purple-500 bg-purple-50 text-purple-600 shadow-sm" 
                            : "border-black/5 bg-black/5 text-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                disabled={!formData.adSoyad || !formData.dogumTarihi}
                onClick={nextStep}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold shadow-xl shadow-purple-500/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
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
              className="space-y-6 flex flex-col h-full max-w-md mx-auto"
            >
              <div className="text-center space-y-1">
                <h2 className="text-2xl font-serif font-bold text-heading">Kartlarını Seç</h2>
                <p className="text-[10px] text-muted uppercase tracking-widest font-bold">Enerjini kartlara odakla</p>
              </div>

              {/* Selected Cards Slots */}
              <div className="grid grid-cols-3 gap-3 py-2">
                {[
                  { label: 'GEÇMİŞ', index: 0 },
                  { label: 'ŞİMDİ', index: 1 },
                  { label: 'GELECEK', index: 2 }
                ].map((slot) => (
                  <div key={slot.index} className="space-y-2">
                    <div className="text-center">
                      <span className={`text-[8px] font-black tracking-[0.2em] transition-colors ${formData.selectedCards[slot.index] ? 'text-purple-600' : 'text-muted/40'}`}>
                        {slot.label}
                      </span>
                    </div>
                    <div 
                      className={`aspect-[1/1.6] rounded-xl border-2 border-dashed transition-all duration-500 relative overflow-hidden flex items-center justify-center ${
                        formData.selectedCards[slot.index] 
                          ? 'border-purple-500/30 bg-white shadow-lg shadow-purple-500/10' 
                          : 'border-black/5 bg-black/[0.02]'
                      }`}
                    >
                      {formData.selectedCards[slot.index] ? (
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0, rotateY: 180 }}
                          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                          className="w-full h-full p-1"
                        >
                          <div className="w-full h-full rounded-lg bg-gradient-to-br from-purple-50 to-white border border-purple-100 flex flex-col items-center justify-center relative overflow-hidden">
                            {/* Card Back Pattern for Selected Card */}
                            <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
                              <div className="absolute inset-2 border-2 border-purple-900 rounded-md flex items-center justify-center">
                                <div className="w-full h-full border border-purple-900 rounded-sm rotate-45 scale-150" />
                                <div className="absolute w-full h-full border border-purple-900 rounded-sm -rotate-45 scale-150" />
                              </div>
                            </div>
                            
                            <Sparkles className="w-6 h-6 text-purple-400 mb-2" />
                            <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-pulse" />
                            
                            <button 
                              onClick={() => handleCardSelect(formData.selectedCards[slot.index])}
                              className="absolute -top-1 -right-1 p-1.5 bg-rose-500 text-white rounded-full shadow-lg z-20 hover:scale-110 transition-transform"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-8 h-8 rounded-full border border-dashed border-black/10 flex items-center justify-center transition-colors ${formData.selectedCards.length === slot.index ? 'border-purple-300 bg-purple-50/50' : ''}`}>
                            <Plus className={`w-4 h-4 ${formData.selectedCards.length === slot.index ? 'text-purple-400 animate-pulse' : 'text-black/10'}`} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Deck Visualization */}
              <div className="w-full h-[280px] bg-black/[0.02] rounded-2xl border border-black/5 p-4 overflow-y-auto custom-scrollbar relative">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 pb-10">
                  {TAROT_CARDS.map((card, i) => {
                    const isSelected = formData.selectedCards.includes(card);
                    return (
                      <motion.button
                        key={card}
                        whileHover={!isSelected ? { y: -4, scale: 1.05 } : {}}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => !isSelected && handleCardSelect(card)}
                        disabled={isSelected || formData.selectedCards.length >= 3}
                        className={`aspect-[1/1.6] rounded-lg border transition-all relative group ${
                          isSelected
                            ? "opacity-0 scale-50 pointer-events-none"
                            : "border-black/10 bg-white hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/20"
                        }`}
                      >
                        {/* Card Back Pattern */}
                        <div className="absolute inset-0 p-1">
                          <div className="w-full h-full rounded-[4px] bg-gradient-to-br from-purple-700 to-indigo-900 flex items-center justify-center relative overflow-hidden shadow-inner">
                            <div className="absolute inset-0 opacity-20">
                              <div className="absolute inset-1 border border-white/40 rounded-[2px] flex items-center justify-center">
                                <div className="w-full h-full border border-white/20 rounded-sm rotate-45 scale-150" />
                              </div>
                            </div>
                            <Sparkles className="w-4 h-4 text-white/40" />
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
                
                {/* Instruction Overlay */}
                {formData.selectedCards.length < 3 && (
                  <div className="sticky bottom-0 left-0 right-0 py-2 bg-gradient-to-t from-[#FDFCFE] via-[#FDFCFE]/90 to-transparent pointer-events-none flex justify-center">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] animate-pulse bg-white/90 py-1.5 px-4 rounded-full shadow-sm border border-purple-100 backdrop-blur-sm">
                      Desteden {3 - formData.selectedCards.length} kart seç
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <PaymentSummary 
                  type="tarot"
                  userProfile={userProfile}
                  economyConfig={economyConfig}
                  extraQuestionsCount={0}
                  priorityMode={false}
                  minimal={true}
                />

                <button
                  disabled={formData.selectedCards.length < 3 || isProcessing}
                  onClick={async () => {
                    if (isProcessing) return;
                    setIsProcessing(true);
                    try {
                      const reading = await onComplete({ ...formData, type: 'tarot', cards: formData.selectedCards });
                      setActiveReading(reading);
                      nextStep();
                    } catch (error: any) {
                      console.error("Submit error:", error);
                      toast.error(error.message || "Bir hata oluştu");
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                  className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-500 text-white font-bold shadow-xl shadow-purple-500/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span className="uppercase tracking-widest text-sm">Yoruma Al</span>
                      <Sparkles className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <RitualScreen type="tarot" reading={activeReading} onClose={onClose} onSocialClick={onSocialClick} />
          )}
        </AnimatePresence>
      </div>
      
      {step < 3 && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-black/5 text-muted"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
