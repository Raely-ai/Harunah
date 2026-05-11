import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "motion/react";
import BirthDateInput from "./BirthDateInput";
import { CreditCard, User, ArrowRight, Sparkles, CheckCircle2, ChevronLeft, ChevronRight, X, Plus, Zap, Loader2, Star } from "lucide-react";
import RitualScreen from "./RitualScreen";
import PaymentSummary from "./PaymentSummary";
import { UserProfile, AppConfig, EconomyConfig } from "../types";
import { DEFAULT_ECONOMY_CONFIG } from "../constants";
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

const TAROT_CARDS = Array.from({ length: 78 }, (_, i) => ({
  id: `card-${i + 1}`,
  rotation: Math.random() * 4 - 2, // Random rotation between -2 and 2
  delay: Math.random() * 0.5
}));

function ParticleField() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ 
            opacity: 0, 
            scale: Math.random() * 0.5 + 0.5,
            x: Math.random() * 100 + "%",
            y: Math.random() * 100 + "%"
          }}
          animate={{ 
            opacity: [0, 0.3, 0],
            y: ["-10%", "110%"],
            x: ["-5%", "5%"]
          }}
          transition={{ 
            duration: Math.random() * 10 + 10,
            repeat: Infinity,
            delay: Math.random() * 10,
            ease: "linear"
          }}
          className="absolute w-1 h-1 bg-purple-400/30 rounded-full blur-[1px]"
        />
      ))}
    </div>
  );
}

function TarotCardBack({ isSelected }: { isSelected?: boolean }) {
  return (
    <div className={`w-full h-full rounded-xl border-2 relative overflow-hidden transition-all duration-500 ${
      isSelected ? 'border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'border-purple-900/30 shadow-lg'
    }`}>
      {/* Texture/Grain */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
      
      {/* Card Design */}
      <div className="absolute inset-0 bg-[#1a0b2e] flex flex-col items-center justify-center p-2">
        <div className="w-full h-full border border-purple-500/20 rounded-lg flex items-center justify-center relative">
          {/* Ornate corners */}
          <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-purple-500/40" />
          <div className="absolute top-1 right-1 w-2 h-2 border-t border-r border-purple-500/40" />
          <div className="absolute bottom-1 left-1 w-2 h-2 border-b border-l border-purple-500/40" />
          <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-purple-500/40" />
          
          <div className="w-12 h-12 rounded-full border border-purple-500/30 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border border-purple-500/50 flex items-center justify-center bg-purple-900/20">
              <Star className="w-4 h-4 text-purple-400/60 fill-current" />
            </div>
          </div>
          
          {/* Subtle glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
        </div>
      </div>
    </div>
  );
}

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

  const price = economyConfig?.fortunePricing?.tarot ?? DEFAULT_ECONOMY_CONFIG.fortunePricing.tarot;
  const isSubscribed = userProfile.subscription?.status === 'active';

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const handleCardSelect = (cardId: string) => {
    if (formData.selectedCards.includes(cardId)) {
      setFormData({ ...formData, selectedCards: formData.selectedCards.filter(c => c !== cardId) });
    } else if (formData.selectedCards.length < 3) {
      setFormData({ ...formData, selectedCards: [...formData.selectedCards, cardId] });
    }
  };

  const progressText = useMemo(() => {
    const count = formData.selectedCards.length;
    if (count === 0) return "3 kart seçmelisin";
    if (count < 3) return "Enerji şekilleniyor...";
    return "Seçim tamamlandı, enerjin hazır.";
  }, [formData.selectedCards.length]);

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col transition-colors duration-700 ${step === 2 ? 'bg-[#0a0514]' : 'bg-[#FDFCFE]'}`}>
      {/* Particle Background for Step 2 */}
      {step === 2 && <ParticleField />}
      
      {/* Header */}
      <header className={`flex-shrink-0 backdrop-blur-xl border-b px-4 py-6 flex items-center justify-between transition-all duration-700 relative z-20 ${
        step === 2 ? 'bg-black/20 border-white/5' : 'bg-white/80 border-black/5'
      }`}>
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
            <h1 className={`text-xl font-serif font-bold transition-colors duration-700 ${step === 2 ? 'text-white' : 'text-heading'}`}>
              {step === 2 ? 'Ritüel Başladı' : 'Tarot Açılımı'}
            </h1>
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

      <div className={`flex-1 flex flex-col min-h-0 ${step === 2 ? 'overflow-hidden' : 'overflow-y-auto px-6 pt-12 pb-24'}`}>
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
                    className="w-12 h-12 rounded-full border border-purple-100 flex items-center justify-center relative"
                  >
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <div className="absolute inset-0 border-t-2 border-purple-500/20 rounded-full" />
                  </motion.div>
                </div>
                <h2 className="text-4xl font-serif font-bold text-heading tracking-tight">Tarot Yolculuğu</h2>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-purple-200" />
                  <p className="text-muted text-sm italic font-medium">Enerjini kartlarla buluşturmaya hazırlan...</p>
                  <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-purple-200" />
                </div>
              </div>

              {/* Ritual Preparation Panel */}
              <div className="relative group">
                {/* Decorative Background Elements */}
                <div className="absolute -top-6 -left-6 w-24 h-24 bg-purple-500/5 blur-3xl rounded-full" />
                <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-500/5 blur-3xl rounded-full" />
                
                <div className="relative p-10 rounded-[3rem] bg-white border border-black/5 shadow-[0_20px_50px_rgba(0,0,0,0.04)] space-y-10 overflow-hidden">
                  {/* Subtle Texture */}
                  <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />
                  
                  {/* Section 1: Identity */}
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-1 h-4 bg-purple-500 rounded-full" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600/60">Kimlik Enerjisi</h3>
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
                            className="w-full bg-black/[0.02] border border-black/5 rounded-[1.5rem] px-8 py-6 text-heading font-medium placeholder:text-muted/30 focus:outline-none focus:border-purple-500/30 focus:bg-white focus:shadow-[0_0_20px_rgba(168,85,247,0.05)] transition-all duration-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted ml-4">Doğum Tarihi</label>
                        <BirthDateInput 
                          value={formData.dogumTarihi}
                          onChange={(val) => setFormData({ ...formData, dogumTarihi: val })}
                          className="!py-6 !pl-16 bg-black/[0.02] border-black/5 rounded-[1.5rem]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Connection State */}
                  <div className="space-y-6 relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-1 h-4 bg-indigo-500 rounded-full" />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600/60">Bağ Durumu</h3>
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
                              ? "border-purple-500/30 bg-purple-50 text-purple-700 shadow-xl shadow-purple-500/5" 
                              : "border-black/5 bg-black/[0.01] text-muted hover:border-purple-200 hover:bg-white"
                          }`}
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity`} />
                          <span className={`text-[10px] font-bold uppercase tracking-[0.2em] relative z-10 ${formData.iliskiDurumu === s.id ? 'scale-105' : ''}`}>
                            {s.label}
                          </span>
                          {formData.iliskiDurumu === s.id && (
                            <motion.div 
                              layoutId="activeStone"
                              className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-purple-500 rounded-full"
                            />
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Transition CTA */}
              <div className="pt-4">
                <motion.button
                  disabled={!formData.adSoyad || !formData.dogumTarihi}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={nextStep}
                  className="w-full py-6 rounded-[2rem] bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 text-white font-bold shadow-2xl shadow-purple-500/20 flex items-center justify-center gap-4 group transition-all disabled:opacity-30 disabled:grayscale"
                >
                  <span className="uppercase tracking-[0.3em] text-xs ml-4">Ritüele Başla</span>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.button>
                <p className="text-center text-[9px] text-muted/40 uppercase tracking-[0.2em] mt-6 font-medium">
                  Bilgilerin evrenin enerjisiyle korunmaktadır
                </p>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0 relative"
            >
              {/* Soft Glowing Aura - Moved to be more central to the table */}
              <div className="absolute top-[60%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[80%] bg-purple-600/5 blur-[150px] rounded-full pointer-events-none" />

              {/* SECTION 1: Header & Selected Cards */}
              <div className="flex-shrink-0 pt-8 pb-4 px-6 relative z-10">
                <div className="text-center space-y-2 mb-6">
                  <motion.h2 
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-2xl font-serif font-bold text-white"
                  >
                    Kartlarını Seç
                  </motion.h2>
                  <motion.p 
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-purple-200/40 text-xs italic"
                  >
                    Enerjine en yakın kartlar seni çağırıyor...
                  </motion.p>
                  <div className="flex justify-center mt-2">
                    <motion.div 
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      className="h-[1px] w-16 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" 
                    />
                  </div>
                </div>

                <div className="flex justify-center gap-3 min-h-[100px]">
                  <AnimatePresence mode="popLayout">
                    {formData.selectedCards.map((cardId, index) => (
                      <motion.div
                        key={cardId}
                        layoutId={cardId}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        className="w-16 h-24 relative"
                      >
                        <TarotCardBack isSelected />
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center shadow-lg border-2 border-[#0a0514]">
                          <span className="text-[9px] font-bold text-white">{index + 1}</span>
                        </div>
                      </motion.div>
                    ))}
                    {Array.from({ length: 3 - formData.selectedCards.length }).map((_, i) => (
                      <div 
                        key={`empty-${i}`}
                        className="w-16 h-24 rounded-xl border border-dashed border-purple-500/20 bg-purple-500/5 flex items-center justify-center"
                      >
                        <Sparkles className="w-4 h-4 text-purple-500/10" />
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
                
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-purple-400/60 mt-4 text-center">
                  {progressText}
                </p>
              </div>

              {/* SECTION 2: The Tarot Table (Deck) */}
              <div className="flex-1 relative min-h-0 px-4">
                {/* Removed the restrictive inner box, now it's an open table area */}
                <div className="h-full overflow-y-auto custom-scrollbar-hidden pb-12">
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 p-4">
                    {TAROT_CARDS.map((card) => {
                      const isSelected = formData.selectedCards.includes(card.id);
                      if (isSelected) return <div key={card.id} className="aspect-[2/3]" />;
                      
                      return (
                        <motion.button
                          key={card.id}
                          layoutId={card.id}
                          whileHover={{ scale: 1.1, y: -8, zIndex: 50 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleCardSelect(card.id)}
                          style={{ rotate: card.rotation }}
                          className="aspect-[2/3] relative group"
                        >
                          <TarotCardBack />
                          {/* Hover Glow - Now can bleed out because parent is not overflow-hidden */}
                          <div className="absolute inset-0 bg-purple-500/0 group-hover:bg-purple-500/10 transition-colors rounded-xl shadow-[0_0_15px_rgba(168,85,247,0)] group-hover:shadow-[0_0_20px_rgba(168,85,247,0.2)]" />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
                {/* Subtle bottom fade for the table */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0514] to-transparent pointer-events-none z-10" />
              </div>

              {/* SECTION 3: Action Area */}
              <div className="flex-shrink-0 p-6 bg-gradient-to-t from-[#0a0514] via-[#0a0514] to-transparent relative z-20">
                <div className="max-w-xs mx-auto space-y-4">
                  <div className="flex justify-center">
                    <PaymentSummary 
                      type="tarot"
                      userProfile={userProfile}
                      economyConfig={economyConfig}
                      extraQuestionsCount={0}
                      priorityMode={false}
                      minimal={true}
                      dark={true}
                    />
                  </div>

                  <motion.button
                    disabled={formData.selectedCards.length < 3 || isProcessing}
                    animate={formData.selectedCards.length === 3 ? {
                      boxShadow: ["0 0 0px rgba(168,85,247,0)", "0 0 25px rgba(168,85,247,0.4)", "0 0 0px rgba(168,85,247,0)"]
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
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
                    className={`w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all duration-500 ${
                      formData.selectedCards.length === 3 
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-500/20" 
                        : "bg-white/5 text-white/20 border border-white/5"
                    }`}
                  >
                    {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span className="uppercase tracking-[0.2em] text-xs">Ritüeli Tamamla</span>
                        <Sparkles className={`w-4 h-4 transition-transform duration-500 ${formData.selectedCards.length === 3 ? 'scale-110' : 'opacity-20'}`} />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <RitualScreen type="tarot" reading={activeReading} onClose={onClose} onSocialClick={onSocialClick} />
          )}
        </AnimatePresence>
      </div>
      
      {step < 4 && (
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
