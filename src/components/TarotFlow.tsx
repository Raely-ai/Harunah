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
          animate={{ width: `${(step / 2) * 100}%` }}
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

              <div className="flex justify-center">
                <PaymentSummary 
                  type="tarot"
                  userProfile={userProfile}
                  economyConfig={economyConfig}
                  extraQuestionsCount={0}
                  priorityMode={false}
                  minimal={true}
                />
              </div>

              <button
                disabled={!formData.adSoyad || !formData.dogumTarihi || isProcessing}
                onClick={async () => {
                  if (isProcessing) return;
                  setIsProcessing(true);
                  try {
                    const reading = await onComplete({ ...formData, type: 'tarot' });
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
            </motion.div>
          )}

          {step === 2 && (
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
