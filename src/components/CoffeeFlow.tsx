import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, User, Calendar, Heart, ArrowRight, Loader2, Sparkles, CheckCircle2, Zap, X, ChevronLeft, CreditCard, Plus } from "lucide-react";
import RitualScreen from "./RitualScreen";
import PaymentSummary from "./PaymentSummary";
import { UserProfile, AppConfig, EconomyConfig } from "../types";
import { toast } from "sonner";

interface CoffeeFlowProps {
  userProfile: UserProfile;
  config: AppConfig;
  economyConfig: EconomyConfig;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onComplete: (data: any) => Promise<any>;
  onClose: () => void;
  onSocialClick?: () => void;
}

export default function CoffeeFlow({ userProfile, config, economyConfig, onUpdateProfile, onComplete, onClose, onSocialClick }: CoffeeFlowProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReading, setActiveReading] = useState<any>(null);
  const [formData, setFormData] = useState({
    target: 'self', // 'self' or 'other'
    adSoyad: userProfile.displayName || '',
    dogumTarihi: userProfile.birthDate || '',
    iliskiDurumu: userProfile.relationshipStatus || 'single'
  });

  const price = config.prices.coffee;
  const isSubscribed = userProfile.subscription?.status === 'active';

  const nextStep = () => setStep(s => s + 1);

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
            <h1 className="text-xl font-serif font-bold text-heading">Kahve Falı</h1>
            <p className="text-xs text-muted">Fincanın gizemini çöz</p>
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
          className="h-full bg-amber-600"
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
                <h2 className="text-3xl font-serif font-bold text-heading">Kimin Falı?</h2>
                <p className="text-muted">LASYA'nın fısıltılarını kimin için duymak istersin?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {['self', 'other'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFormData({ ...formData, target: t })}
                    className={`p-6 rounded-3xl border transition-all ${
                      formData.target === t 
                        ? "border-amber-500 bg-amber-50 text-amber-600 shadow-sm" 
                        : "border-black/5 bg-black/5 text-muted"
                    }`}
                  >
                    <User className="w-8 h-8 mx-auto mb-3" />
                    <span className="font-bold uppercase tracking-widest text-xs">
                      {t === 'self' ? 'Kendim İçin' : 'Başkası İçin'}
                    </span>
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Ad Soyad</label>
                  <input 
                    type="text"
                    placeholder="Adınız ve soyadınız..."
                    value={formData.adSoyad}
                    onChange={(e) => setFormData({ ...formData, adSoyad: e.target.value })}
                    className="w-full bg-black/5 border border-black/10 rounded-2xl px-6 py-4 text-heading focus:outline-none focus:border-amber-500/50 transition-colors"
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
                      className="w-full bg-black/5 border border-black/10 rounded-2xl pl-14 pr-6 py-4 text-heading focus:outline-none focus:border-amber-500/50 transition-colors"
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
                            ? "border-amber-500/50 bg-amber-50 text-amber-600 shadow-sm" 
                            : "border-black/5 bg-black/5 text-muted"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <PaymentSummary 
                type="coffee"
                userProfile={userProfile}
                economyConfig={economyConfig}
                extraQuestionsCount={0}
                priorityMode={false}
              />

              <button
                disabled={!formData.adSoyad || !formData.dogumTarihi || isProcessing}
                onClick={async () => {
                  if (isProcessing) return;
                  setIsProcessing(true);
                  try {
                    const reading = await onComplete({ ...formData, type: 'coffee' });
                    setActiveReading(reading);
                    nextStep();
                  } catch (error: any) {
                    console.error("Submit error:", error);
                    toast.error(error.message || "Bir hata oluştu");
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-xl shadow-amber-500/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>Yoruma Al</span>
                    <Sparkles className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <RitualScreen type="coffee" reading={activeReading} onClose={onClose} onSocialClick={onSocialClick} />
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
