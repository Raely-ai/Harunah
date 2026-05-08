import { uploadPhoto } from "../lib/uploadService";
import { toast } from "sonner";
import { auth } from "../lib/firebase";
import { calculateMysticProfile } from "../lib/mysticProfileHelper";
import { walletService } from "../lib/walletService";
import { socialService } from "../lib/socialService";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  Users, 
  MessageCircle, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Calendar, 
  User, 
  Camera, 
  CheckCircle2,
  X,
  Plus
} from "lucide-react";

interface SocialOnboardingFlowProps {
  onComplete: () => void;
  onBack: () => void;
  initialData?: any;
  isFastTrack?: boolean;
}

const INTERESTS = [
  // Sosyal
  "Kahve", "Gece gezmesi", "Sohbet", "Eğlence", "Yemek", "Seyahat", "Müzik",
  // Hobi
  "Spor", "Fitness", "Koşu", "Bisiklet", "Yüzme", "Yoga", "Meditasyon", "Doğa", "Kamp", "Yürüyüş",
  // Zeka
  "Psikoloji", "Felsefe", "Kitap", "Araştırma", "Tarih", "Bilim", "Teknoloji", "Yazılım", "Astronomi", "Arkeoloji",
  // Eğlence
  "Dizi", "Film", "Netflix", "Oyun", "Sinema", "Fotoğrafçılık", "Dans", "Moda", "Tasarım",
  // Mistik
  "Tarot", "Kahve falı", "Astroloji", "Enerji", "Burçlar", "Rüyalar",
  // Diğer
  "Sanat", "Evcil Hayvanlar", "Araba", "Motosiklet", "Tiyatro", "Resim", "Şiir", "Gönüllülük", "Borsa", "Kripto"
];

const DEFAULT_AVATARS = {
  erkek: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4",
  kadın: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=ffdfbf"
};

export default function SocialOnboardingFlow({ onComplete, onBack, initialData, isFastTrack = false }: SocialOnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    intent: initialData?.social?.intent || "",
    lookingFor: initialData?.social?.lookingFor || initialData?.lookingFor || "",
    nickname: initialData?.social?.nickname || initialData?.nickname || initialData?.displayName || "",
    birthDate: initialData?.birthDate || "",
    gender: initialData?.social?.gender || initialData?.gender || "",
    interests: initialData?.social?.interests || initialData?.interests || [] as string[],
    photos: initialData?.social?.photos || initialData?.photos || [] as string[],
    bio: initialData?.social?.bio || initialData?.bio || ""
  });

  const totalSteps = isFastTrack ? 4 : 8;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setIsUploading(true);
    try {
      const downloadURL = await uploadPhoto(file, auth.currentUser.uid);
      setFormData({ ...formData, photos: [downloadURL] });
      toast.success("Fotoğraf yüklendi.");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Fotoğraf yüklenemedi.");
    } finally {
      setIsUploading(false);
    }
  };

  const nextStep = async () => {
    console.log("nextStep: start", { step });
    if (step === 1 && !formData.intent) return toast.error("Lütfen bir niyet seçin.");
    if (step === 2 && (!formData.nickname || formData.nickname.trim().length < 2)) return toast.error("Lütfen geçerli bir takma ad girin (en az 2 karakter).");
    if (step === 3) {
      if (!formData.birthDate) return toast.error("Lütfen doğum tarihinizi seçin.");
      const birth = new Date(formData.birthDate);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
        age--;
      }
      if (age < 18) return toast.error("Sosyal özellikleri kullanmak için 18 yaşından büyük olmalısınız.");
    }
    if (step === 4 && !formData.gender) return toast.error("Lütfen cinsiyetinizi seçin.");
    if (step === 5 && formData.interests.length < 5) return toast.error("En az 5 ilgi alanı seçmelisiniz.");
    if (step === 7 && formData.bio.trim().length < 10) return toast.error("Lütfen kendinizden biraz daha bahsedin (en az 10 karakter).");

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Final step: Complete onboarding via backend
      console.log("Final onboarding step: start");
      setLoading(true);
      try {
        if (!auth.currentUser) throw new Error("No user found");
        
        const mysticProfile = calculateMysticProfile(formData.birthDate);
        
        // Handle default photo if none provided
        let finalPhotos = formData.photos;
        if (finalPhotos.length === 0) {
          finalPhotos = [formData.gender === 'erkek' ? DEFAULT_AVATARS.erkek : DEFAULT_AVATARS.kadın];
        }

        const payload = {
          ...formData,
          ...mysticProfile,
          photos: finalPhotos
        };

        console.log("AUDIT: completeSocialOnboarding payload sent:", JSON.stringify(payload, null, 2));

        const result = await socialService.completeSocialOnboarding(payload);

        if (result.success) {
          console.log("Final onboarding step: success");
          onComplete();
        } else {
          throw new Error(result.message || "Profil oluşturulurken bir hata oluştu.");
        }
      } catch (error: any) {
        console.error("Final onboarding step: error", error);
        toast.error(error.message || "Profil oluşturulurken bir hata oluştu.");
      } finally {
        setLoading(false);
      }
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else onBack();
  };

  const isStepValid = () => {
    const currentStep = isFastTrack ? (
      step === 1 ? 2 :
      step === 2 ? 3 :
      step === 3 ? 4 :
      step === 4 ? 8 : step
    ) : step;

    switch (currentStep) {
      case 1: return !!formData.intent;
      case 2: return formData.nickname.trim().length >= 2;
      case 3: {
        if (!formData.birthDate) return false;
        const birth = new Date(formData.birthDate);
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
        return age >= 18;
      }
      case 4: return !!formData.gender;
      case 5: return formData.interests.length >= 5;
      case 6: return true; // Optional
      case 7: return formData.bio.trim().length >= 10;
      case 8: return true;
      default: return false;
    }
  };

  const renderStep = () => {
    // Fast Track Mapping
    // 1: Nickname (Original Step 2)
    // 2: BirthDate (Original Step 3)
    // 3: Gender (Original Step 4)
    // 4: Completion (Original Step 8)
    
    const currentStep = isFastTrack ? (
      step === 1 ? 2 :
      step === 2 ? 3 :
      step === 3 ? 4 :
      step === 4 ? 8 : step
    ) : step;

    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-bold text-heading">Burada ne arıyorsun?</h2>
              <p className="text-body text-sm">Niyetin, enerjini doğru insanlara ulaştırır.</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'aşk', icon: Heart, label: 'Aşk', color: 'text-rose-600', bg: 'bg-rose-500/10' },
                { id: 'dostluk', icon: Users, label: 'Dostluk', color: 'text-blue-600', bg: 'bg-blue-500/10' },
                { id: 'sohbet', icon: MessageCircle, label: 'Sohbet', color: 'text-amber-600', bg: 'bg-amber-500/10' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFormData({ ...formData, intent: item.id })}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                    formData.intent === item.id 
                      ? "border-indigo-600 bg-indigo-500/5 shadow-lg shadow-indigo-600/5" 
                      : "border-black/5 bg-white hover:bg-black/5"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center ${item.color}`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <span className="text-lg font-bold text-heading">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-bold text-heading">Takma adın ne olsun?</h2>
              <p className="text-body text-sm">Seni herkes bu isimle görecek.</p>
            </div>
            <div className="relative">
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="Örn: MistikRuh"
                className="w-full bg-white border-2 border-black/5 rounded-2xl p-5 text-lg text-heading focus:border-indigo-600 outline-none transition-all text-center shadow-sm placeholder:text-muted"
              />
              <div className="absolute top-1/2 -translate-y-1/2 right-5 opacity-20">
                <User className="w-5 h-5 text-muted" />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-bold text-heading">Doğum tarihin?</h2>
              <p className="text-body text-sm">Enerji analizinin temelidir. (18+ yaş zorunludur)</p>
            </div>
            <div className="relative">
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full bg-white border-2 border-black/5 rounded-2xl p-5 text-lg text-heading focus:border-indigo-600 outline-none transition-all text-center [color-scheme:light] shadow-sm"
              />
              <div className="absolute top-1/2 -translate-y-1/2 right-5 opacity-20 pointer-events-none">
                <Calendar className="w-5 h-5 text-muted" />
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-bold text-heading">Cinsiyetin?</h2>
              <p className="text-body text-sm">Doğru eşleşmeler için gereklidir.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'erkek', label: 'Erkek', icon: '♂️' },
                { id: 'kadın', label: 'Kadın', icon: '♀️' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFormData({ ...formData, gender: item.id })}
                  className={`p-6 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${
                    formData.gender === item.id 
                      ? "border-indigo-600 bg-indigo-500/5 shadow-lg shadow-indigo-600/5" 
                      : "border-black/5 bg-white hover:bg-black/5"
                  }`}
                >
                  <span className="text-3xl">{item.icon}</span>
                  <span className="text-lg font-bold text-heading">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4 flex flex-col h-full max-h-[60vh]">
            <div className="text-center space-y-1">
              <h2 className="text-2xl font-serif font-bold text-heading">İlgi alanların?</h2>
              <p className="text-body text-xs">En az 5 tane seçmelisin. ({formData.interests.length} seçildi)</p>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-2">
              <div className="flex flex-wrap justify-center gap-2">
                {INTERESTS.map((interest) => {
                  const isSelected = formData.interests.includes(interest);
                  return (
                    <button
                      key={interest}
                      onClick={() => {
                        if (isSelected) {
                          setFormData({ ...formData, interests: formData.interests.filter(i => i !== interest) });
                        } else {
                          setFormData({ ...formData, interests: [...formData.interests, interest] });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isSelected 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                          : "bg-black/5 text-muted hover:bg-black/10"
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-bold text-heading">Fotoğraf ekle</h2>
              <p className="text-body text-sm">Opsiyoneldir. Eklemezsen mistik bir avatar atanır.</p>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div 
                  className="w-40 h-40 rounded-[2.5rem] bg-white border-2 border-dashed border-black/10 flex items-center justify-center overflow-hidden group shadow-sm cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {formData.photos.length > 0 ? (
                    <img src={formData.photos[0]} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-10 h-10 text-black/10 group-hover:text-black/20 transition-colors" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-serif font-bold text-heading">Kendinden bahset</h2>
              <p className="text-body text-sm">Kısa bir bio enerjini yansıtır. (En az 10 karakter)</p>
            </div>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Nelerden hoşlanırsın? Hayata bakışın nasıl?..."
              className="w-full bg-white border-2 border-black/5 rounded-2xl p-5 text-base text-heading focus:border-indigo-600 outline-none transition-all h-32 resize-none shadow-sm placeholder:text-muted"
            />
          </div>
        );
      case 8:
        return (
          <div className="flex flex-col items-center justify-center space-y-6 py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-24 h-24 rounded-[2rem] bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-600/20"
            >
              <CheckCircle2 className="w-12 h-12 text-white" />
            </motion.div>
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-serif font-bold text-heading">Her şey hazır!</h2>
              <p className="text-body text-sm">Sosyal profilin oluşturuldu. <br />Artık enerjine uygun insanlarla tanışabilirsin.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#F6F4F8] text-heading flex flex-col overflow-hidden select-none touch-none">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-4 flex items-center justify-between flex-shrink-0">
        <button 
          onClick={prevStep}
          className="w-10 h-10 rounded-xl bg-white border border-black/5 flex items-center justify-center text-muted hover:text-heading transition-colors shadow-sm"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex gap-1">
          {[...Array(totalSteps)].map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-500 ${
                i + 1 <= step ? "w-4 bg-indigo-600" : "w-1.5 bg-black/10"
              }`} 
            />
          ))}
        </div>
        <div className="w-10" /> {/* Spacer */}
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col px-6 py-4 max-w-lg mx-auto w-full overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <div className="flex-1 flex flex-col justify-center">
              {renderStep()}
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 pb-10 max-w-lg mx-auto w-full flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading || !isStepValid()}
          onClick={nextStep}
          className={`w-full py-4 rounded-2xl bg-heading text-white font-black text-base shadow-xl shadow-black/10 flex items-center justify-center gap-2 transition-all ${
            (loading || !isStepValid()) ? "opacity-30 cursor-not-allowed grayscale" : "hover:bg-black active:scale-95"
          }`}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {step === totalSteps ? "Başla" : "Devam Et"}
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </motion.button>
      </footer>
    </div>
  );
}
