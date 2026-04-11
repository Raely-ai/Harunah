import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, User, Calendar, Heart, ArrowRight, Loader2, Sparkles, CheckCircle2, Zap, X, ChevronLeft, CreditCard, Plus, Coffee } from "lucide-react";
import RitualScreen from "./RitualScreen";
import PaymentSummary from "./PaymentSummary";
import { UserProfile, AppConfig, EconomyConfig } from "../types";
import { DEFAULT_ECONOMY_CONFIG } from "../constants";
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
    iliskiDurumu: userProfile.relationshipStatus || 'single',
    images: [] as string[]
  });

  const price = economyConfig?.fortunePricing?.coffee ?? config?.prices?.coffee ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.coffee;
  const isSubscribed = userProfile.subscription?.status === 'active';

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (formData.images.length >= 3) {
        toast.error("Maksimum 3 fotoğraf yükleyebilirsiniz.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, images: [...formData.images, reader.result as string] });
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    setFormData({ ...formData, images: formData.images.filter((_, i) => i !== index) });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#FDFCFE] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-white/80 backdrop-blur-xl border-b border-black/5 px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={step > 1 ? prevStep : onClose}
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
          animate={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pt-12 pb-24 relative">
        {/* Subtle Background Texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
        
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-10 max-w-lg mx-auto"
            >
              <div className="text-center space-y-3">
                <h2 className="text-3xl font-serif font-bold text-heading tracking-tight">Fincanın Sahibini Tanıyalım</h2>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-amber-200" />
                  <p className="text-muted text-sm italic font-medium">LASYA'nın fısıltılarını kimin için duymak istersin?</p>
                  <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-amber-200" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {['self', 'other'].map((t) => (
                  <motion.button
                    key={t}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setFormData({ ...formData, target: t })}
                    className={`p-8 rounded-[2.5rem] border transition-all duration-500 relative overflow-hidden group ${
                      formData.target === t 
                        ? "border-amber-500 bg-amber-50 text-amber-600 shadow-xl shadow-amber-500/10" 
                        : "border-black/5 bg-white text-muted shadow-sm hover:border-amber-200"
                    }`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <User className={`w-10 h-10 mx-auto mb-4 transition-transform duration-500 ${formData.target === t ? 'scale-110' : 'group-hover:scale-110'}`} />
                    <span className="font-bold uppercase tracking-[0.2em] text-[10px] block">
                      {t === 'self' ? 'Kendim İçin' : 'Başkası İçin'}
                    </span>
                    {formData.target === t && (
                      <motion.div 
                        layoutId="activeTarget"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-amber-500 rounded-full"
                      />
                    )}
                  </motion.button>
                ))}
              </div>

              <div className="relative p-10 rounded-[3rem] bg-white border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.04)] space-y-10">
                {/* Section 1: Identity */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-4 bg-amber-500 rounded-full" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600/60">Kimlik Enerjisi</h3>
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
                          className="w-full bg-black/[0.02] border border-black/5 rounded-[1.5rem] px-8 py-6 text-heading font-medium placeholder:text-muted/30 focus:outline-none focus:border-amber-500/30 focus:bg-white focus:shadow-[0_0_20px_rgba(245,158,11,0.05)] transition-all duration-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted ml-4">Doğum Tarihi</label>
                      <div className="relative group/input">
                        <Calendar className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/40 group-focus-within/input:text-amber-500 transition-colors" />
                        <input 
                          type="date"
                          value={formData.dogumTarihi}
                          onChange={(e) => setFormData({ ...formData, dogumTarihi: e.target.value })}
                          className="w-full bg-black/[0.02] border border-black/5 rounded-[1.5rem] pl-16 pr-8 py-6 text-heading font-medium focus:outline-none focus:border-amber-500/30 focus:bg-white focus:shadow-[0_0_20px_rgba(245,158,11,0.05)] transition-all duration-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Connection State */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1 h-4 bg-amber-600 rounded-full" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600/60">Bağ Durumu</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { id: 'single', label: 'Bekar' },
                      { id: 'taken', label: 'İlişkisi Var' },
                      { id: 'complicated', label: 'Karışık' },
                      { id: 'divorced', label: 'Boşanmış' }
                    ].map((s) => (
                      <motion.button
                        key={s.id}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setFormData({ ...formData, iliskiDurumu: s.id })}
                        className={`relative py-5 rounded-2xl border transition-all duration-500 overflow-hidden group/btn ${
                          formData.iliskiDurumu === s.id 
                            ? "border-amber-500/30 bg-amber-50 text-amber-700 shadow-xl shadow-amber-500/5" 
                            : "border-black/5 bg-black/[0.01] text-muted hover:border-amber-200 hover:bg-white"
                        }`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity`} />
                        <span className={`text-[10px] font-bold uppercase tracking-[0.2em] relative z-10 ${formData.iliskiDurumu === s.id ? 'scale-105' : ''}`}>
                          {s.label}
                        </span>
                        {formData.iliskiDurumu === s.id && (
                          <motion.div 
                            layoutId="activeStoneCoffee"
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-amber-500 rounded-full"
                          />
                        )}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button
                disabled={!formData.adSoyad || !formData.dogumTarihi}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={nextStep}
                className="w-full py-6 rounded-[2rem] bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white font-bold shadow-2xl shadow-amber-500/20 flex items-center justify-center gap-4 group transition-all disabled:opacity-30 disabled:grayscale"
              >
                <span className="uppercase tracking-[0.3em] text-xs ml-4">Devam Et</span>
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
                <h2 className="text-3xl font-serif font-bold text-heading tracking-tight">Fincanını Sun</h2>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-amber-200" />
                  <p className="text-muted text-sm italic font-medium">Fincanının ve tabağının gizemini paylaş.</p>
                  <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-amber-200" />
                </div>
              </div>

              <div className="space-y-8">
                {/* Main Upload Area */}
                <div className="grid grid-cols-3 gap-4">
                  {formData.images.map((img, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative aspect-square rounded-[2rem] overflow-hidden border border-black/5 shadow-xl group"
                    >
                      <img src={img} alt={`Fincan ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={() => removePhoto(idx)}
                          className="p-3 rounded-full bg-red-500 text-white shadow-lg transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg bg-black/20 backdrop-blur-md text-[8px] font-bold text-white uppercase tracking-widest">
                        Görsel {idx + 1}
                      </div>
                    </motion.div>
                  ))}
                  
                  {formData.images.length < 3 && (
                    <label className="col-span-full aspect-[2/1] rounded-[3rem] border-2 border-dashed border-amber-500/20 bg-amber-500/[0.02] flex flex-col items-center justify-center gap-4 text-muted hover:border-amber-500/50 hover:bg-amber-500/[0.05] hover:text-amber-600 transition-all cursor-pointer group relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="p-6 rounded-full bg-white shadow-xl group-hover:scale-110 transition-transform duration-500 relative z-10">
                        <Coffee className="w-10 h-10 text-amber-600" />
                      </div>
                      <div className="text-center relative z-10">
                        <span className="text-sm font-bold uppercase tracking-[0.3em] block mb-1">Fincanı Buraya Bırak</span>
                        <span className="text-[10px] text-muted/60 font-medium">Maksimum 3 fotoğraf</span>
                      </div>
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  )}
                </div>

                {formData.images.length > 0 && formData.images.length < 3 && (
                  <div className="flex justify-center">
                    <label className="flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-black/5 shadow-sm text-[10px] font-bold uppercase tracking-widest text-muted hover:text-amber-600 transition-colors cursor-pointer">
                      <Plus className="w-4 h-4" />
                      Başka Fotoğraf Ekle
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    </label>
                  </div>
                )}
              </div>

              <div className="p-8 rounded-[2.5rem] bg-amber-50/50 border border-amber-100/50 flex items-start gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles className="w-12 h-12 text-amber-600" />
                </div>
                <div className="p-3 rounded-2xl bg-white shadow-sm">
                  <Camera className="w-5 h-5 text-amber-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Mistik Rehberlik</p>
                  <p className="text-[11px] text-amber-800/70 leading-relaxed font-medium">
                    Fincanın enerjisini net görmek için aydınlık bir ortamda çekim yapman fısıltıları güçlendirecektir.
                  </p>
                </div>
              </div>

              <div className="flex justify-center">
                <PaymentSummary 
                  type="coffee"
                  userProfile={userProfile}
                  economyConfig={economyConfig}
                  extraQuestionsCount={0}
                  priorityMode={false}
                  minimal={true}
                />
              </div>

              <motion.button
                disabled={formData.images.length === 0 || isProcessing}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
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
                className={`w-full py-6 rounded-[2rem] font-bold flex items-center justify-center gap-4 transition-all duration-500 ${
                  formData.images.length > 0 
                    ? "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white shadow-2xl shadow-amber-500/20" 
                    : "bg-black/5 text-muted border border-black/5"
                }`}
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
            <RitualScreen type="coffee" reading={activeReading} onClose={onClose} onSocialClick={onSocialClick} />
          )}
        </AnimatePresence>
      </div>
      
      {step < 4 && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-black/5 text-muted hover:bg-black/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
