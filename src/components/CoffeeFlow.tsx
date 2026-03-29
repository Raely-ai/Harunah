import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, User, Calendar, Heart, ArrowRight, Loader2, Sparkles, CheckCircle2, Zap, X, ChevronLeft, CreditCard, Plus } from "lucide-react";
import { UserProfile, AppConfig } from "../types";
import { toast } from "sonner";

interface CoffeeFlowProps {
  userProfile: UserProfile;
  config: AppConfig;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onComplete: (data: any) => void;
  onClose: () => void;
}

export default function CoffeeFlow({ userProfile, config, onUpdateProfile, onComplete, onClose }: CoffeeFlowProps) {
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({
    target: 'self', // 'self' or 'other'
    name: '',
    birthDate: '',
    relationshipStatus: 'self',
    images: [] as string[]
  });

  const price = config.prices.coffee;
  const isSubscribed = userProfile.subscription?.status === 'active';

  const nextStep = () => setStep(s => s + 1);

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
            <h1 className="text-xl font-serif font-bold text-amber-50">Kahve Falı</h1>
            <p className="text-xs text-purple-200/40">Fincanın gizemini çöz</p>
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
          className="h-full bg-amber-500"
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
                <h2 className="text-3xl font-serif font-bold text-amber-50">Kimin Falı?</h2>
                <p className="text-purple-200/40">Ahlas'ın fısıltılarını kimin için duymak istersin?</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {['self', 'other'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setFormData({ ...formData, target: t })}
                    className={`p-6 rounded-3xl border transition-all ${
                      formData.target === t 
                        ? "border-amber-500 bg-amber-500/10 text-amber-400" 
                        : "border-white/5 bg-white/5 text-purple-200/40"
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
                  <label className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40 ml-2">İsim</label>
                  <input 
                    type="text"
                    placeholder="İsim giriniz..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-amber-50 focus:outline-none focus:border-amber-500/50 transition-colors"
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
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-amber-50 focus:outline-none focus:border-amber-500/50 transition-colors"
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
                            ? "border-amber-500/50 bg-amber-500/10 text-amber-400" 
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
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-2xl shadow-amber-900/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
              >
                <span>Devam Et</span>
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
                <h2 className="text-3xl font-serif font-bold text-amber-50">Fincan Fotoğrafları</h2>
                <p className="text-purple-200/40">Ahlas'ın sembolleri görebilmesi için net fotoğraflar yükle.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {[
                  { id: 1, label: 'Fincan İçi (1. Açı)' },
                  { id: 2, label: 'Fincan İçi (2. Açı)' },
                  { id: 3, label: 'Tabak / Fincan Altı' }
                ].map((p) => (
                  <div key={p.id} className="relative group">
                    <input 
                      type="file" 
                      accept="image/*"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const newImages = [...formData.images];
                            newImages[p.id - 1] = ev.target?.result as string;
                            setFormData({ ...formData, images: newImages });
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <div className={`p-8 rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-4 ${
                      formData.images[p.id - 1] 
                        ? "border-emerald-500/50 bg-emerald-500/5" 
                        : "border-white/10 bg-white/5 group-hover:border-amber-500/30"
                    }`}>
                      {formData.images[p.id - 1] ? (
                        <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                          <img src={formData.images[p.id - 1]} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-4 rounded-2xl bg-amber-500/10 text-amber-400">
                            <Camera className="w-8 h-8" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-amber-50">{p.label}</p>
                            <p className="text-xs text-purple-200/40 mt-1">Yüklemek için dokun</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <button
                disabled={formData.images.filter(Boolean).length < 3}
                onClick={nextStep}
                className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-2xl shadow-amber-900/20 disabled:opacity-20 disabled:grayscale flex items-center justify-center gap-3"
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
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="w-48 h-48 rounded-full border-2 border-dashed border-amber-500/20"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div
                    animate={{ 
                      opacity: [0.3, 1, 0.3],
                      scale: [0.9, 1.1, 0.9]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Sparkles className="w-20 h-20 text-amber-400" />
                  </motion.div>
                </div>
                
                {/* Ritual Particles */}
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      y: [-20, -100],
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0]
                    }}
                    transition={{ 
                      duration: 2 + Math.random() * 2,
                      repeat: Infinity,
                      delay: i * 0.3
                    }}
                    className="absolute left-1/2 top-1/2 w-1 h-1 bg-amber-400 rounded-full"
                    style={{ 
                      marginLeft: `${(Math.random() - 0.5) * 100}px`,
                      marginTop: `${(Math.random() - 0.5) * 100}px`
                    }}
                  />
                ))}
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl font-serif font-bold text-amber-50">Ritüel Başladı</h2>
                <p className="text-purple-200/60 leading-relaxed max-w-xs mx-auto">
                  Ahlas fincanındaki sembolleri evrenin enerjisiyle birleştiriyor. Bu mistik yolculuk biraz zaman alabilir.
                </p>
              </div>

              <div className="w-full max-w-xs space-y-6">
                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest">
                    <span className="text-purple-200/40">Tahmini Süre</span>
                    <span className="text-amber-400">20 Dakika</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-amber-500"
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40">Bakiyen</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-amber-400">{userProfile.credits}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200/40">Hızlı Yorum</p>
                      <p className="text-sm font-bold text-amber-400">{isSubscribed ? 'Ücretsiz' : `${price} Kredi`}</p>
                    </div>
                  </div>

                  <button
                    disabled={isProcessing}
                    onClick={() => {
                      if (isSubscribed) {
                        // Check daily limit
                        const dailyLimit = config.subscriptionLimits.coffee;
                        const used = userProfile.subscription?.dailyReadingsUsed.coffee || 0;
                        
                        if (used >= dailyLimit) {
                          toast.error(`Günlük limitinize ulaştınız (${dailyLimit}). Yarın tekrar deneyebilirsiniz.`);
                          return;
                        }

                        setIsProcessing(true);
                        
                        // Increment daily usage
                        onUpdateProfile({ 
                          subscription: { 
                            ...userProfile.subscription!, 
                            dailyReadingsUsed: {
                              ...userProfile.subscription!.dailyReadingsUsed,
                              coffee: used + 1
                            }
                          } 
                        });

                        setTimeout(() => {
                          toast.success("Hemen yorumcu bulundu! Falın öncelik sırasına alındı.");
                          onComplete(formData);
                        }, 1500);
                        return;
                      }

                      const totalCredits = userProfile.credits;
                      if (totalCredits < price) {
                        toast.error("Yetersiz bakiye! Lütfen kredi yükleyin.");
                        return;
                      }

                      setIsProcessing(true);
                      
                      let newCredits = userProfile.credits - price;
                      
                      onUpdateProfile({ credits: newCredits });
                      
                      setTimeout(() => {
                        toast.success("Hemen yorumcu bulundu! Falın öncelik sırasına alındı.");
                        onComplete(formData);
                      }, 1500);
                    }}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-amber-500/20 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        <span>{isSubscribed ? 'Ücretsiz Yorum Al' : 'Hemen Yorumcu Bul'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => onComplete(formData)}
                className="text-xs font-bold uppercase tracking-[0.3em] text-purple-200/40 hover:text-amber-400 transition-colors"
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
