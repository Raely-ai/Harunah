import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowRight, 
  Sparkles, 
  Plus, 
  Minus, 
  Camera, 
  User, 
  Calendar, 
  Clock, 
  Users,
  X,
  CheckCircle2,
  Wallet,
  Zap,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Droplets,
  Star,
  ShieldCheck,
  Heart
} from "lucide-react";
import { toast } from "sonner";
import RitualScreen from "./RitualScreen";
import PaymentSummary from "./PaymentSummary";
import { FortuneType, UserProfile, AppConfig, EconomyConfig } from "../types";

interface AdvancedFlowProps {
  type: FortuneType;
  userProfile: UserProfile;
  config: AppConfig;
  economyConfig: EconomyConfig;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onComplete: (data: any) => Promise<any>;
  onClose: () => void;
  onSocialClick?: () => void;
}

const TITLES: Record<string, string> = {
  water: 'Su Falı',
  ebced: 'Ebced Aşk Falı',
  yildizname: 'Yıldızname',
  havas: 'İlmi Havas'
};

const DURATIONS: Record<string, string> = {
  water: '40 Dakika',
  ebced: '50 Dakika',
  yildizname: '50 Dakika',
  havas: '90 Dakika'
};

export default function AdvancedFlow({ type, userProfile, config, economyConfig, onUpdateProfile, onComplete, onClose, onSocialClick }: AdvancedFlowProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReading, setActiveReading] = useState<any>(null);
  const [formData, setFormData] = useState({
    adSoyad: userProfile.displayName || '',
    dogumTarihi: userProfile.birthDate || '',
    iliskiDurumu: userProfile.relationshipStatus || 'single',
    birthTime: '',
    motherName: '',
    fatherName: '',
    targetName: '',
    questions: [
      { text: '' },
      { text: '' },
      { text: '' }
    ]
  });

  const addQuestion = () => {
    if (formData.questions.length < 50) {
      setFormData({
        ...formData,
        questions: [...formData.questions, { text: '' }]
      });
    }
  };

  const removeQuestion = (index?: number) => {
    if (formData.questions.length > 3) {
      const newQuestions = [...formData.questions];
      if (typeof index === 'number') {
        newQuestions.splice(index, 1);
      } else {
        newQuestions.pop();
      }
      setFormData({ ...formData, questions: newQuestions });
    }
  };

  const basePrice = config.prices[type as keyof typeof config.prices] || 500;
  const extraQuestionPrice = config.prices.extraQuestion;
  const creditCost = basePrice + (formData.questions.length > 3 ? (formData.questions.length - 3) * extraQuestionPrice : 0);
  const isSubscribed = userProfile.subscription?.status === 'active';

  const nextStep = () => setStep(s => s + 1);

  const handleQuestionChange = (index: number, value: string) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], text: value };
    setFormData({ ...formData, questions: newQuestions });
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
            <h1 className="text-xl font-serif font-bold text-heading">{type === 'water' ? 'Su Falı' : type.charAt(0).toUpperCase() + type.slice(1)}</h1>
            <p className="text-xs text-muted">Derin ilimlerle geleceği keşfet</p>
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
          className="h-full bg-indigo-600"
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
              className="space-y-8 relative"
            >
              {/* Ambient Animations */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [0, -100, 0],
                      x: [0, Math.random() * 50 - 25, 0],
                      opacity: [0.05, 0.15, 0.05],
                      scale: [1, 1.2, 1]
                    }}
                    transition={{ 
                      duration: 5 + Math.random() * 5,
                      repeat: Infinity,
                      delay: i * 0.8
                    }}
                    className="absolute w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl"
                    style={{ 
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`
                    }}
                  />
                ))}
              </div>

              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif font-bold text-heading">{TITLES[type]}</h2>
                <p className="text-muted">Derin bir kehanet için temel bilgilerini gir.</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Ad Soyad</label>
                    <input 
                      type="text"
                      placeholder="Adınız ve soyadınız..."
                      value={formData.adSoyad}
                      onChange={(e) => setFormData({ ...formData, adSoyad: e.target.value })}
                      className="w-full bg-black/5 border border-black/10 rounded-2xl px-6 py-4 text-heading focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Doğum Tarihi</label>
                      <input 
                        type="date"
                        value={formData.dogumTarihi}
                        onChange={(e) => setFormData({ ...formData, dogumTarihi: e.target.value })}
                        className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-4 text-heading focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">İlişki Durumu</label>
                      <select 
                        value={formData.iliskiDurumu}
                        onChange={(e) => setFormData({ ...formData, iliskiDurumu: e.target.value })}
                        className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-4 text-heading focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm appearance-none"
                      >
                        <option value="single">Bekar</option>
                        <option value="taken">İlişkisi Var</option>
                        <option value="complicated">Karışık</option>
                        <option value="divorced">Boşanmış</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Anne Adı (Opsiyonel)</label>
                      <input 
                        type="text"
                        placeholder="Anne adı..."
                        value={formData.motherName}
                        onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                        className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-4 text-heading focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Baba Adı (Opsiyonel)</label>
                      <input 
                        type="text"
                        placeholder="Baba adı..."
                        value={formData.fatherName}
                        onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                        className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-4 text-heading focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Hedef Kişi (Opsiyonel)</label>
                    <div className="relative">
                      <Users className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/40" />
                      <input 
                        type="text"
                        placeholder="Kimin hakkında sormak istersin?"
                        value={formData.targetName}
                        onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                        className="w-full bg-black/5 border border-black/10 rounded-2xl pl-14 pr-6 py-4 text-heading focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                disabled={!formData.adSoyad || !formData.dogumTarihi}
                onClick={nextStep}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
              >
                <span>Sorulara Geç</span>
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
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-serif font-bold text-heading">Sorularını Sor</h2>
                <p className="text-muted">LASYA'ya sormak istediğin her şeyi detaylıca yaz. En az 3 soru sormanız gerekmektedir.</p>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Toplam Maliyet</p>
                    <p className="text-sm font-bold text-heading">{creditCost} Kredi</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => removeQuestion()}
                    className="p-2 rounded-lg bg-black/5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="w-8 text-center font-bold text-indigo-600">{formData.questions.length}</div>
                  <button 
                    onClick={addQuestion}
                    className="p-2 rounded-lg bg-black/5 text-muted hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {formData.questions.map((q, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 rounded-3xl border border-black/5 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted ml-2">Soru {i + 1}</label>
                      {formData.questions.length > 3 && (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeQuestion(i);
                          }}
                          className="p-1 text-red-600 hover:text-red-700 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <textarea 
                      placeholder="Sorunu buraya yaz..."
                      value={q.text}
                      onChange={(e) => handleQuestionChange(i, e.target.value)}
                      rows={3}
                      className="w-full bg-black/5 border border-black/5 rounded-2xl px-6 py-4 text-heading focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                    />
                  </motion.div>
                ))}

                {formData.questions.length < 50 && (
                  <button
                    onClick={addQuestion}
                    className="w-full py-4 rounded-2xl border border-dashed border-black/10 bg-white text-muted font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:border-indigo-500/30 hover:text-indigo-600 transition-all shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Soru Ekle</span>
                  </button>
                )}
              </div>

              <PaymentSummary 
                type={type}
                userProfile={userProfile}
                economyConfig={economyConfig}
                extraQuestionsCount={Math.max(0, formData.questions.length - 3)}
                priorityMode={false}
              />

              <button
                disabled={formData.questions.some(q => !q.text.trim()) || isProcessing}
                onClick={async () => {
                  if (isProcessing) return;
                  setIsProcessing(true);
                  try {
                    const reading = await onComplete({ ...formData, type });
                    setActiveReading(reading);
                    nextStep();
                  } catch (error: any) {
                    console.error("Submit error:", error);
                    toast.error(error.message || "Bir hata oluştu");
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-xl shadow-indigo-500/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
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

          {step === 3 && (
            <RitualScreen type={type} reading={activeReading} onClose={onClose} onSocialClick={onSocialClick} />
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
