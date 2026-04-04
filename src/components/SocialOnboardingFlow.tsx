import { uploadPhoto } from "../lib/uploadService";
import { toast } from "sonner";
import { doc, updateDoc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { calculateMysticProfile } from "../lib/mysticProfileHelper";
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
}

const INTERESTS = [
  "Müzik", "Sinema", "Dans", "Resim", "Fotoğrafçılık", "Edebiyat", "Şiir", "Tiyatro", "Heykel", "Mimari",
  "Moda", "Gastronomi", "Kahve", "Şarap", "Seyahat", "Doğa", "Kamp", "Yürüyüş", "Yoga", "Meditasyon",
  "Astroloji", "Tarot", "Psikoloji", "Felsefe", "Tarih", "Arkeoloji", "Bilim", "Teknoloji", "Yazılım", "Oyun",
  "E-spor", "Futbol", "Basketbol", "Tenis", "Yüzme", "Fitness", "Bisiklet", "Kaykay", "Sörf", "Hayvanlar",
  "Bahçecilik", "El Sanatları", "Kendin Yap (DIY)", "Gönüllülük", "Siyaset", "Ekonomi", "Yatırım", "Kripto", "NFT", "Metaverse"
];

const DEFAULT_AVATARS = {
  erkek: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4",
  kadın: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=ffdfbf"
};

export default function SocialOnboardingFlow({ onComplete, onBack, initialData }: SocialOnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    lookingFor: initialData?.social?.lookingFor || initialData?.lookingFor || "",
    nickname: initialData?.social?.nickname || initialData?.nickname || "",
    birthDate: initialData?.birthDate || "",
    gender: initialData?.social?.gender || initialData?.gender || "",
    interests: initialData?.social?.interests || initialData?.interests || [] as string[],
    photos: initialData?.social?.photos || initialData?.photos || [] as string[],
    bio: initialData?.social?.bio || initialData?.bio || ""
  });

  const totalSteps = 8;

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

  const updateFirestore = async (data: any) => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, data);
    } catch (error) {
      console.error("Firestore update error:", error);
      toast.error("İlerleme kaydedilemedi.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = async () => {
    if (step === 1 && !formData.lookingFor) return toast.error("Lütfen bir niyet seçin.");
    if (step === 2 && !formData.nickname) return toast.error("Lütfen bir takma ad girin.");
    if (step === 3 && !formData.birthDate) return toast.error("Lütfen doğum tarihinizi seçin.");
    if (step === 4 && !formData.gender) return toast.error("Lütfen cinsiyetinizi seçin.");
    if (step === 5 && formData.interests.length < 5) return toast.error("En az 5 ilgi alanı seçmelisiniz.");

    // Save progress at each step
    if (step === 1) await updateFirestore({ "social.lookingFor": formData.lookingFor });
    if (step === 2) await updateFirestore({ "social.nickname": formData.nickname });
    if (step === 3) {
      const mysticProfile = calculateMysticProfile(formData.birthDate);
      await updateFirestore({ 
        birthDate: formData.birthDate,
        ...mysticProfile 
      });
    }
    if (step === 4) await updateFirestore({ "social.gender": formData.gender });
    if (step === 5) await updateFirestore({ "social.interests": formData.interests });
    if (step === 6) {
      // Handle default photo if none provided
      let finalPhotos = formData.photos;
      if (finalPhotos.length === 0) {
        finalPhotos = [formData.gender === 'erkek' ? DEFAULT_AVATARS.erkek : DEFAULT_AVATARS.kadın];
      }
      await updateFirestore({ "social.photos": finalPhotos });
    }
    if (step === 7) await updateFirestore({ "social.bio": formData.bio });

    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Final step: Complete onboarding
      await updateFirestore({
        "social.enabled": true,
        "social.profileCompleted": true,
        "social.visible": true,
        "social.banned": false
      });
      onComplete();
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
    else onBack();
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-serif font-bold text-slate-900">Burada ne arıyorsun?</h2>
              <p className="text-slate-500">Niyetin, enerjini doğru insanlara ulaştırır.</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'aşk', icon: Heart, label: 'Aşk', color: 'text-rose-500', bg: 'bg-rose-50' },
                { id: 'dostluk', icon: Users, label: 'Dostluk', color: 'text-blue-500', bg: 'bg-blue-50' },
                { id: 'sohbet', icon: MessageCircle, label: 'Sohbet', color: 'text-amber-500', bg: 'bg-amber-50' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFormData({ ...formData, lookingFor: item.id })}
                  className={`p-6 rounded-3xl border-2 transition-all flex items-center gap-6 ${
                    formData.lookingFor === item.id 
                      ? "border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/5" 
                      : "border-slate-100 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl ${item.bg} flex items-center justify-center ${item.color}`}>
                    <item.icon className="w-7 h-7" />
                  </div>
                  <span className="text-xl font-bold text-slate-900">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-serif font-bold text-slate-900">Takma adın ne olsun?</h2>
              <p className="text-slate-500">Seni herkes bu isimle görecek.</p>
            </div>
            <div className="relative">
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="Örn: MistikRuh"
                className="w-full bg-white border-2 border-slate-100 rounded-3xl p-6 text-xl text-slate-900 focus:border-indigo-500 outline-none transition-all text-center shadow-sm"
              />
              <div className="absolute top-1/2 -translate-y-1/2 right-6 opacity-20">
                <User className="w-6 h-6 text-slate-400" />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-serif font-bold text-slate-900">Doğum tarihin?</h2>
              <p className="text-slate-500">Enerji analizinin temelidir.</p>
            </div>
            <div className="relative">
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full bg-white border-2 border-slate-100 rounded-3xl p-6 text-xl text-slate-900 focus:border-indigo-500 outline-none transition-all text-center [color-scheme:light] shadow-sm"
              />
              <div className="absolute top-1/2 -translate-y-1/2 right-6 opacity-20 pointer-events-none">
                <Calendar className="w-6 h-6 text-slate-400" />
              </div>
            </div>
          </div>
        );
      case 4:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-serif font-bold text-slate-900">Cinsiyetin?</h2>
              <p className="text-slate-500">Doğru eşleşmeler için gereklidir.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'erkek', label: 'Erkek', icon: '♂️' },
                { id: 'kadın', label: 'Kadın', icon: '♀️' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setFormData({ ...formData, gender: item.id })}
                  className={`p-8 rounded-3xl border-2 transition-all flex flex-col items-center gap-4 ${
                    formData.gender === item.id 
                      ? "border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/5" 
                      : "border-slate-100 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="text-4xl">{item.icon}</span>
                  <span className="text-xl font-bold text-slate-900">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-serif font-bold text-slate-900">İlgi alanların?</h2>
              <p className="text-slate-500">En az 5 tane seçmelisin. ({formData.interests.length}/5)</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-h-[40vh] overflow-y-auto p-4 bg-white rounded-3xl border border-slate-100 shadow-sm">
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
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isSelected 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" 
                        : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-serif font-bold text-slate-900">Fotoğraf ekle</h2>
              <p className="text-slate-500">Opsiyoneldir. Eklemezsen mistik bir avatar atanır.</p>
            </div>
            <div className="flex justify-center">
              <div className="relative">
                <div 
                  className="w-48 h-48 rounded-[3rem] bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group shadow-sm cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {formData.photos.length > 0 ? (
                    <img src={formData.photos[0]} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-12 h-12 text-slate-200 group-hover:text-slate-300 transition-colors" />
                  )}
                  {isUploading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
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
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-serif font-bold text-slate-900">Kendinden bahset</h2>
              <p className="text-slate-500">Kısa bir bio enerjini yansıtır.</p>
            </div>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Nelerden hoşlanırsın? Hayata bakışın nasıl?..."
              className="w-full bg-white border-2 border-slate-100 rounded-3xl p-6 text-lg text-slate-900 focus:border-indigo-500 outline-none transition-all h-48 resize-none shadow-sm"
            />
          </div>
        );
      case 8:
        return (
          <div className="flex flex-col items-center justify-center space-y-8 py-12">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-32 h-32 rounded-[3rem] bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-500/20"
            >
              <CheckCircle2 className="w-16 h-16 text-white" />
            </motion.div>
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-serif font-bold text-slate-900">Her şey hazır!</h2>
              <p className="text-slate-500">Sosyal profilin oluşturuldu. <br />Artık enerjine uygun insanlarla tanışabilirsin.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 text-slate-900 overflow-y-auto flex flex-col relative overscroll-behavior-y-contain">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-indigo-50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-50 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between flex-shrink-0">
        <button 
          onClick={prevStep}
          className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex gap-1">
          {[...Array(totalSteps)].map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-500 ${
                i + 1 <= step ? "w-4 bg-indigo-500" : "w-2 bg-slate-200"
              }`} 
            />
          ))}
        </div>
        <div className="w-12" /> {/* Spacer */}
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col px-8 py-8 max-w-lg mx-auto w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-8 pb-12 max-w-lg mx-auto w-full flex-shrink-0">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          onClick={nextStep}
          className={`w-full py-5 rounded-[2rem] bg-slate-900 text-white font-black text-lg shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 ${
            loading ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-800"
          }`}
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {step === totalSteps ? "Başla" : "Devam Et"}
              <ChevronRight className="w-6 h-6" />
            </>
          )}
        </motion.button>
      </footer>
    </div>
  );
}
