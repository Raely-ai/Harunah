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

const THEMES: Record<string, {
  primary: string;
  secondary: string;
  accent: string;
  gradient: string;
  bg: string;
  border: string;
  glow: string;
  icon: any;
  subtitle: string;
  inputBg: string;
  pattern: string;
}> = {
  water: {
    primary: 'cyan-600',
    secondary: 'blue-500',
    accent: 'cyan-400',
    gradient: 'from-cyan-600 via-blue-500 to-cyan-600',
    bg: 'bg-cyan-50/30',
    border: 'border-cyan-100',
    glow: 'shadow-cyan-500/20',
    icon: Droplets,
    subtitle: 'Suyun derinliklerindeki akisleri keşfet...',
    inputBg: 'bg-cyan-500/[0.02]',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
  },
  ebced: {
    primary: 'rose-500',
    secondary: 'pink-500',
    accent: 'rose-400',
    gradient: 'from-rose-500 via-pink-500 to-rose-500',
    bg: 'bg-rose-50/30',
    border: 'border-rose-100',
    glow: 'shadow-rose-500/20',
    icon: Heart,
    subtitle: 'Gönül bağlarının kadim sırlarını çöz...',
    inputBg: 'bg-rose-500/[0.02]',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/pinstripe.png')]"
  },
  yildizname: {
    primary: 'amber-600',
    secondary: 'yellow-600',
    accent: 'amber-400',
    gradient: 'from-amber-600 via-yellow-600 to-amber-600',
    bg: 'bg-amber-50/30',
    border: 'border-amber-100',
    glow: 'shadow-amber-500/20',
    icon: Star,
    subtitle: 'Kaderinin gökyüzündeki izlerini oku...',
    inputBg: 'bg-amber-500/[0.02]',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"
  },
  havas: {
    primary: 'emerald-700',
    secondary: 'emerald-600',
    accent: 'emerald-500',
    gradient: 'from-emerald-800 via-emerald-600 to-emerald-800',
    bg: 'bg-emerald-50/30',
    border: 'border-emerald-100',
    glow: 'shadow-emerald-500/20',
    icon: ShieldCheck,
    subtitle: 'Kadim ilimlerin koruyucu enerjisine sığın...',
    inputBg: 'bg-emerald-500/[0.02]',
    pattern: "bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]"
  }
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

  const theme = THEMES[type] || THEMES.water;
  const ThemeIcon = theme.icon;

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
            <h1 className="text-xl font-serif font-bold text-heading">{TITLES[type]}</h1>
            <p className="text-xs text-muted">Derin ilimlerle geleceği keşfet</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${theme.bg} border ${theme.border} px-3 py-1.5 rounded-full`}>
          <CreditCard className={`w-3 h-3 text-${theme.primary}`} />
          <span className={`text-xs font-bold text-${theme.primary}`}>{userProfile.mainCoins || 0}</span>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="relative h-1 bg-black/5">
        <motion.div 
          className={`h-full bg-${theme.primary}`}
          initial={{ width: "0%" }}
          animate={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-24 relative">
        {/* Subtle Background Texture */}
        <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${theme.pattern}`} />
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10 max-w-lg mx-auto"
            >
              {/* Ceremonial Header */}
              <div className="text-center space-y-4">
                <div className="flex justify-center mb-2">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className={`w-12 h-12 rounded-full border ${theme.border} flex items-center justify-center relative`}
                  >
                    <ThemeIcon className={`w-5 h-5 text-${theme.primary}/60`} />
                    <div className={`absolute inset-0 border-t-2 border-${theme.primary}/20 rounded-full`} />
                  </motion.div>
                </div>
                <h2 className="text-4xl font-serif font-bold text-heading tracking-tight">{TITLES[type]}</h2>
                <div className="flex items-center justify-center gap-3">
                  <div className={`h-[1px] w-8 bg-gradient-to-r from-transparent to-${theme.primary}/20`} />
                  <p className="text-muted text-sm italic font-medium">{theme.subtitle}</p>
                  <div className={`h-[1px] w-8 bg-gradient-to-l from-transparent to-${theme.primary}/20`} />
                </div>
              </div>

              <div className="relative p-10 rounded-[3rem] bg-white border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.04)] space-y-10">
                {/* Section 1: Identity */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-1 h-4 bg-${theme.primary} rounded-full`} />
                    <h3 className={`text-[10px] font-black uppercase tracking-[0.3em] text-${theme.primary}/60`}>Kimlik Enerjisi</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted ml-4">Ad Soyad</label>
                      <div className="relative group/input">
                        <input 
                          type="text"
                          placeholder="Adınız ve soyadınız..."
                          value={formData.adSoyad}
                          onChange={(e) => setFormData({ ...formData, adSoyad: e.target.value })}
                          className={`w-full ${theme.inputBg} border border-black/5 rounded-[1.5rem] px-8 py-6 text-heading font-medium placeholder:text-muted/30 focus:outline-none focus:border-${theme.primary}/30 focus:bg-white focus:${theme.glow} transition-all duration-500`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted ml-4">Doğum Tarihi</label>
                        <div className="relative group/input">
                          <Calendar className={`absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/40 group-focus-within/input:text-${theme.primary} transition-colors`} />
                          <input 
                            type="date"
                            value={formData.dogumTarihi}
                            onChange={(e) => setFormData({ ...formData, dogumTarihi: e.target.value })}
                            className={`w-full ${theme.inputBg} border border-black/5 rounded-[1.5rem] pl-16 pr-8 py-6 text-heading font-medium focus:outline-none focus:border-${theme.primary}/30 focus:bg-white focus:${theme.glow} transition-all duration-500`}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted ml-4">İlişki Durumu</label>
                        <div className="relative">
                          <select 
                            value={formData.iliskiDurumu}
                            onChange={(e) => setFormData({ ...formData, iliskiDurumu: e.target.value })}
                            className={`w-full ${theme.inputBg} border border-black/5 rounded-[1.5rem] px-8 py-6 text-heading font-medium focus:outline-none focus:border-${theme.primary}/30 focus:bg-white focus:${theme.glow} transition-all duration-500 appearance-none`}
                          >
                            <option value="single">Bekar</option>
                            <option value="taken">İlişkisi Var</option>
                            <option value="complicated">Karışık</option>
                            <option value="divorced">Boşanmış</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted ml-4">Anne Adı</label>
                        <input 
                          type="text"
                          placeholder="Anne adı..."
                          value={formData.motherName}
                          onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                          className={`w-full ${theme.inputBg} border border-black/5 rounded-[1.5rem] px-8 py-6 text-heading font-medium placeholder:text-muted/30 focus:outline-none focus:border-${theme.primary}/30 focus:bg-white focus:${theme.glow} transition-all duration-500`}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted ml-4">Baba Adı</label>
                        <input 
                          type="text"
                          placeholder="Baba adı..."
                          value={formData.fatherName}
                          onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                          className={`w-full ${theme.inputBg} border border-black/5 rounded-[1.5rem] px-8 py-6 text-heading font-medium placeholder:text-muted/30 focus:outline-none focus:border-${theme.primary}/30 focus:bg-white focus:${theme.glow} transition-all duration-500`}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted ml-4">Hedef Kişi (Opsiyonel)</label>
                      <div className="relative group/input">
                        <Users className={`absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/40 group-focus-within/input:text-${theme.primary} transition-colors`} />
                        <input 
                          type="text"
                          placeholder="Kimin hakkında sormak istersin?"
                          value={formData.targetName}
                          onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                          className={`w-full ${theme.inputBg} border border-black/5 rounded-[1.5rem] pl-16 pr-8 py-6 text-heading font-medium placeholder:text-muted/30 focus:outline-none focus:border-${theme.primary}/30 focus:bg-white focus:${theme.glow} transition-all duration-500`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <motion.button
                disabled={!formData.adSoyad || !formData.dogumTarihi}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={nextStep}
                className={`w-full py-6 rounded-[2rem] bg-gradient-to-r ${theme.gradient} text-white font-bold shadow-2xl ${theme.glow} flex items-center justify-center gap-4 group transition-all disabled:opacity-30 disabled:grayscale`}
              >
                <span className="uppercase tracking-[0.3em] text-xs ml-4">Sorulara Geç</span>
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </motion.button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10 max-w-lg mx-auto"
            >
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-serif font-bold text-heading tracking-tight">Sorularını Sor</h2>
                <div className="flex items-center justify-center gap-3">
                  <div className={`h-[1px] w-8 bg-gradient-to-r from-transparent to-${theme.primary}/20`} />
                  <p className="text-muted text-sm italic font-medium">LASYA'ya sormak istediğin her şeyi detaylıca yaz.</p>
                  <div className={`h-[1px] w-8 bg-gradient-to-l from-transparent to-${theme.primary}/20`} />
                </div>
              </div>

              <div className={`flex items-center justify-between p-6 rounded-[2rem] ${theme.bg} border ${theme.border} shadow-sm`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl bg-white shadow-sm`}>
                    <Wallet className={`w-5 h-5 text-${theme.primary}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Toplam Maliyet</p>
                    <p className="text-sm font-bold text-heading">{creditCost} Kredi</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/50 p-1.5 rounded-xl border border-black/5">
                  <button 
                    onClick={() => removeQuestion()}
                    className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors text-muted"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className={`w-8 text-center font-bold text-${theme.primary}`}>{formData.questions.length}</div>
                  <button 
                    onClick={addQuestion}
                    className={`p-2 rounded-lg hover:bg-${theme.primary}/10 hover:text-${theme.primary} transition-colors text-muted`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-8">
                {formData.questions.map((q, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`relative p-8 rounded-[2.5rem] bg-white border border-black/5 shadow-xl group transition-all hover:${theme.glow}`}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl ${theme.bg} border ${theme.border} flex items-center justify-center text-[12px] font-black text-${theme.primary}`}>
                          {i + 1}
                        </div>
                        <h4 className={`text-[10px] font-black uppercase tracking-[0.3em] text-${theme.primary}/60`}>Soru Enerjisi</h4>
                      </div>
                      {formData.questions.length > 3 && (
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removeQuestion(i)}
                          className="p-2.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      )}
                    </div>
                    <textarea 
                      placeholder="Sorunu buraya yaz..."
                      value={q.text}
                      onChange={(e) => handleQuestionChange(i, e.target.value)}
                      rows={4}
                      className={`w-full ${theme.inputBg} border border-black/5 rounded-[1.5rem] px-8 py-6 text-heading font-medium placeholder:text-muted/30 focus:outline-none focus:border-${theme.primary}/30 focus:bg-white focus:${theme.glow} transition-all duration-500 resize-none`}
                    />
                  </motion.div>
                ))}

                {formData.questions.length < 50 && (
                  <motion.button
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={addQuestion}
                    className={`w-full py-8 rounded-[2.5rem] border-2 border-dashed border-${theme.primary}/20 bg-${theme.primary}/[0.02] text-${theme.primary} font-bold text-[10px] uppercase tracking-[0.3em] flex flex-col items-center justify-center gap-3 hover:border-${theme.primary}/50 hover:bg-${theme.primary}/[0.05] transition-all shadow-sm group`}
                  >
                    <div className="p-3 rounded-full bg-white shadow-sm group-hover:scale-110 transition-transform">
                      <Plus className="w-5 h-5" />
                    </div>
                    <span>Yeni Soru Ekle</span>
                  </motion.button>
                )}
              </div>

              <div className="flex justify-center">
                <PaymentSummary 
                  type={type}
                  userProfile={userProfile}
                  economyConfig={economyConfig}
                  extraQuestionsCount={Math.max(0, formData.questions.length - 3)}
                  priorityMode={false}
                  minimal={true}
                />
              </div>

              <motion.button
                disabled={formData.questions.some(q => !q.text.trim()) || isProcessing}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
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
                className={`w-full py-6 rounded-[2rem] bg-gradient-to-r ${theme.gradient} text-white font-bold shadow-2xl ${theme.glow} flex items-center justify-center gap-4 group transition-all disabled:opacity-30 disabled:grayscale`}
              >
                {isProcessing ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="uppercase tracking-[0.2em] text-xs">Enerji Okunuyor...</span>
                  </div>
                ) : (
                  <>
                    <span className="uppercase tracking-[0.3em] text-xs ml-4">Yoruma Al</span>
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                      <Sparkles className="w-4 h-4" />
                    </div>
                  </>
                )}
              </motion.button>
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
