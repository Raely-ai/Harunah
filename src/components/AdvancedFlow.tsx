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
import { FortuneType, UserProfile, AppConfig } from "../types";

interface AdvancedFlowProps {
  type: FortuneType;
  userProfile: UserProfile;
  config: AppConfig;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onComplete: (data: any) => void;
  onClose: () => void;
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

export default function AdvancedFlow({ type, userProfile, config, onUpdateProfile, onComplete, onClose }: AdvancedFlowProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    birthDate: '',
    birthTime: '',
    motherName: '',
    fatherName: '',
    targetName: '',
    userPhoto: null as string | null,
    targetPhoto: null as string | null,
    questions: [
      { text: '', photo: null as string | null }
    ]
  });

  const addQuestion = () => {
    if (formData.questions.length < 50) {
      setFormData({
        ...formData,
        questions: [...formData.questions, { text: '', photo: null as string | null }]
      });
    }
  };

  const removeQuestion = (index?: number) => {
    if (formData.questions.length > 1) {
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

  const handleQuestionPhoto = (index: number, photo: string | null) => {
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], photo };
    setFormData({ ...formData, questions: newQuestions });
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
            <h1 className="text-xl font-serif font-bold text-amber-50">{type === 'water' ? 'Su Falı' : type.charAt(0).toUpperCase() + type.slice(1)}</h1>
            <p className="text-xs text-purple-200/40">Derin ilimlerle geleceği keşfet</p>
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
          className="h-full bg-indigo-500"
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
                      opacity: [0.1, 0.3, 0.1],
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
                <h2 className="text-3xl font-serif font-bold text-indigo-50">{TITLES[type]}</h2>
                <p className="text-purple-200/40">Derin bir kehanet için temel bilgilerini gir.</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">İsim</label>
                    <input 
                      type="text"
                      placeholder="İsim giriniz..."
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-indigo-50 focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Doğum Tarihi</label>
                      <input 
                        type="date"
                        value={formData.birthDate}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-indigo-50 focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Doğum Saati (Opsiyonel)</label>
                      <input 
                        type="time"
                        value={formData.birthTime}
                        onChange={(e) => setFormData({ ...formData, birthTime: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-indigo-50 focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Anne Adı (Opsiyonel)</label>
                      <input 
                        type="text"
                        placeholder="Anne adı..."
                        value={formData.motherName}
                        onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-indigo-50 focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Baba Adı (Opsiyonel)</label>
                      <input 
                        type="text"
                        placeholder="Baba adı..."
                        value={formData.fatherName}
                        onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-indigo-50 focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Hedef Kişi (Opsiyonel)</label>
                    <div className="relative">
                      <Users className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20" />
                      <input 
                        type="text"
                        placeholder="Kimin hakkında sormak istersin?"
                        value={formData.targetName}
                        onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-indigo-50 focus:outline-none focus:border-indigo-500/50 transition-colors backdrop-blur-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                disabled={!formData.name || !formData.birthDate}
                onClick={nextStep}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-2xl shadow-indigo-900/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
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
                <h2 className="text-3xl font-serif font-bold text-indigo-50">Sorularını Sor</h2>
                <p className="text-purple-200/40">Ahlas'a sormak istediğin her şeyi detaylıca yaz.</p>
              </div>

              {/* Identity Photos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Sizin Fotoğrafınız</label>
                  <div className="relative aspect-square rounded-2xl border border-white/10 bg-white/5 overflow-hidden group">
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setFormData({ ...formData, userPhoto: ev.target?.result as string });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {formData.userPhoto ? (
                      <img src={formData.userPhoto} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Camera className="w-6 h-6 text-purple-200/20" />
                        <span className="text-[8px] font-bold text-purple-200/40 uppercase">İsteğe Bağlı</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Hedef Kişi</label>
                  <div className="relative aspect-square rounded-2xl border border-white/10 bg-white/5 overflow-hidden group">
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => setFormData({ ...formData, targetPhoto: ev.target?.result as string });
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    {formData.targetPhoto ? (
                      <img src={formData.targetPhoto} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                        <Camera className="w-6 h-6 text-purple-200/20" />
                        <span className="text-[8px] font-bold text-purple-200/40 uppercase">İsteğe Bağlı</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <div className="flex items-center gap-3">
                  <Wallet className="w-5 h-5 text-indigo-400" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40">Toplam Maliyet</p>
                    <p className="text-sm font-bold text-indigo-50">{creditCost} Kredi</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => removeQuestion()}
                    className="p-2 rounded-lg bg-white/5 text-purple-200/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="w-8 text-center font-bold text-indigo-400">{formData.questions.length}</div>
                  <button 
                    onClick={addQuestion}
                    className="p-2 rounded-lg bg-white/5 text-purple-200/40 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest text-center px-4">
                  Sorularla ilgili fotoğraf yükleyebilirsiniz, özellikle başkası hakkında soracaksanız fotoğraf eklemeniz kehaneti güçlendirir.
                </p>
                
                {formData.questions.map((q, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 p-4 rounded-3xl border border-white/5 bg-white/5"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">Soru {i + 1}</label>
                      {formData.questions.length > 1 && (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeQuestion(i);
                          }}
                          className="p-1 text-red-400 hover:text-red-300 transition-colors"
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
                      className="w-full bg-black/20 border border-white/5 rounded-2xl px-6 py-4 text-indigo-50 focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
                    />
                    
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input 
                          type="file" 
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (ev) => handleQuestionPhoto(i, ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        <button className={`w-full py-3 rounded-xl border border-dashed flex items-center justify-center gap-2 transition-all ${
                          q.photo ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-purple-200/40'
                        }`}>
                          {q.photo ? <CheckCircle2 className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                          <span className="text-[10px] font-bold uppercase tracking-widest">
                            {q.photo ? 'Fotoğraf Eklendi' : 'Fotoğraf Ekle'}
                          </span>
                        </button>
                      </div>
                      {q.photo && (
                        <button 
                          onClick={() => handleQuestionPhoto(i, null)}
                          className="p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}

                {formData.questions.length < 50 && (
                  <button
                    onClick={addQuestion}
                    className="w-full py-4 rounded-2xl border border-dashed border-white/10 bg-white/5 text-purple-200/40 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:border-indigo-500/30 hover:text-indigo-400 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Soru Ekle</span>
                  </button>
                )}
              </div>

              <button
                disabled={formData.questions.some(q => !q.text.trim())}
                onClick={nextStep}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-2xl shadow-indigo-900/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
              >
                <span>Kehaneti Başlat</span>
                <Sparkles className="w-5 h-5" />
              </button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center space-y-12"
            >
              <div className="relative">
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1],
                    rotate: 360,
                  }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                  className="w-48 h-48 rounded-full border-2 border-dashed border-indigo-500/20"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      opacity: [0.3, 1, 0.3],
                      scale: [0.9, 1.1, 0.9]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Sparkles className="w-20 h-20 text-indigo-400" />
                  </motion.div>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl font-serif font-bold text-indigo-50">Evrenin Kapıları Açılıyor</h2>
                <p className="text-purple-200/60 leading-relaxed max-w-xs mx-auto">
                  Ahlas sorularını evrenin derinliklerine gönderdi. Cevaplar yıldızların arasından süzülüp gelecek.
                </p>
              </div>

              <div className="w-full max-w-xs space-y-4">
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-purple-200/40">Tahmini Süre</span>
                    <span className="text-indigo-400">{DURATIONS[type]}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40">Bakiyen</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-amber-400">{userProfile.credits}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40">Hızlı Yorum</p>
                      <p className="text-sm font-bold text-indigo-400">100 Kredi</p>
                    </div>
                  </div>

                  <button
                    disabled={isProcessing}
                    onClick={() => {
                      const totalCredits = userProfile.credits;
                      const priorityCost = 100; // Priority fee
                      
                      // Check if free via subscription
                      const dailyLimit = config.subscriptionLimits.advanced;
                      const usedToday = userProfile.subscription?.dailyReadingsUsed?.advanced || 0;
                      const isFree = isSubscribed && usedToday < dailyLimit;

                      const totalCost = isFree ? priorityCost : (creditCost + priorityCost);

                      if (totalCredits < totalCost) {
                        toast.error("Yetersiz bakiye! Lütfen kredi yükleyin.");
                        return;
                      }

                      setIsProcessing(true);
                      
                      let newCredits = userProfile.credits - totalCost;
                      
                      const updates: Partial<UserProfile> = { credits: newCredits };
                      if (isFree) {
                        updates.subscription = {
                          ...userProfile.subscription!,
                          dailyReadingsUsed: {
                            ...userProfile.subscription!.dailyReadingsUsed,
                            advanced: usedToday + 1
                          }
                        };
                      }

                      onUpdateProfile(updates);
                      
                      setTimeout(() => {
                        toast.success("Hemen yorumcu bulundu! Falın öncelik sırasına alındı.");
                        onComplete(formData);
                      }, 1500);
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>Hemen Yorumcu Bul</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  // Check if free via subscription
                  const dailyLimit = config.subscriptionLimits.advanced;
                  const usedToday = userProfile.subscription?.dailyReadingsUsed?.advanced || 0;
                  const isFree = isSubscribed && usedToday < dailyLimit;

                  if (!isFree) {
                    const totalCredits = userProfile.credits;
                    if (totalCredits < creditCost) {
                      toast.error("Yetersiz bakiye! Lütfen kredi yükleyin.");
                      return;
                    }

                    let newCredits = userProfile.credits - creditCost;
                    onUpdateProfile({ credits: newCredits });
                  } else {
                    onUpdateProfile({
                      subscription: {
                        ...userProfile.subscription!,
                        dailyReadingsUsed: {
                          ...userProfile.subscription!.dailyReadingsUsed,
                          advanced: usedToday + 1
                        }
                      }
                    });
                  }
                  onComplete(formData);
                }}
                className="text-xs font-bold uppercase tracking-[0.3em] text-purple-200/40 hover:text-indigo-400 transition-colors"
              >
                Normal Sırada Bekle
              </button>
            </motion.div>
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
