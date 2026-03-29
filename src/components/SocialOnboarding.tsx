import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, ArrowRight, ArrowLeft, MapPin, MessageCircle, Sparkles, Users, X, Calendar, Clock, Globe, Heart, Target, Quote, Moon, Zap } from "lucide-react";
import { SocialProfile } from "../types";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, setDoc, updateDoc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

interface SocialOnboardingProps {
  onComplete: (profile: Partial<SocialProfile>) => void;
  onCancel: () => void;
  initialStep?: number;
}

export default function SocialOnboarding({ onComplete, onCancel, initialStep = 1 }: SocialOnboardingProps) {
  const [step, setStep] = useState(initialStep);
  const [formData, setFormData] = useState<Partial<SocialProfile>>({
    nickname: '',
    gender: '',
    birthDate: '',
    birthTime: '',
    birthPlace: '',
    vibe: '',
    socialPurpose: '',
    bio: '',
    region: 'Türkiye',
    photoURL: '',
    onboardingStep: initialStep,
    withdrawableBalance: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = 5; // Steps 2 to 6 (Basic, Birth, Vibe, Bio, Photo)

  const calculateCompleteness = (data: Partial<SocialProfile>) => {
    let score = 0;
    if (data.nickname) score += 10;
    if (data.gender) score += 10;
    if (data.birthDate) score += 10;
    if (data.birthTime) score += 5;
    if (data.birthPlace) score += 5;
    if (data.vibe) score += 15;
    if (data.socialPurpose) score += 15;
    if (data.bio && data.bio.length >= 10) score += 15;
    if (data.photoURL) score += 15;
    return score;
  };

  useEffect(() => {
    const loadDraft = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, "socialProfiles", auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as SocialProfile;
          setFormData(prev => ({ ...prev, ...data }));
          if (data.onboardingStep > 1) {
            setStep(data.onboardingStep - 1); // onboardingStep 2 is step 1 in this component
          }
        }
      } catch (error) {
        console.error("Error loading onboarding draft:", error);
      }
    };
    loadDraft();
  }, []);

  const saveStep = async (nextStepNum: number) => {
    if (!auth.currentUser) return;
    setIsSubmitting(true);
    try {
      const docRef = doc(db, "socialProfiles", auth.currentUser.uid);
      
      // Calculate age if birthDate is present
      let age = formData.age;
      if (formData.birthDate) {
        const birthDate = new Date(formData.birthDate);
        const today = new Date();
        age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
      }

      const now = new Date();
      const freeTrialUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const updateData = {
        ...formData,
        uid: auth.currentUser.uid,
        age: age || 0,
        onboardingStep: nextStepNum + 1, // Store absolute step (2-7)
        completeness: calculateCompleteness(formData),
        updatedAt: now.toISOString(),
        createdAt: formData.createdAt || now.toISOString(),
        lastActiveAt: now.toISOString(),
        isCompleted: false,
        withdrawableBalance: formData.withdrawableBalance || 0,
        hosting: formData.hosting || {
          freeTrialUntil: freeTrialUntil,
          packageHistory: []
        }
      };

      await setDoc(docRef, updateData, { merge: true });
      setStep(nextStepNum);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `socialProfiles/${auth.currentUser.uid}`);
      toast.error("İlerleme kaydedilemedi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (step < totalSteps) {
      saveStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, photoURL: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1: return (formData.nickname?.length ?? 0) >= 3 && (formData.gender?.length ?? 0) > 0;
      case 2: return !!formData.birthDate;
      case 3: return !!formData.vibe && !!formData.socialPurpose;
      case 4: return (formData.bio?.length ?? 0) >= 10;
      case 5: return true; // Photo is optional
      default: return false;
    }
  };

  const handleSubmit = async () => {
    if (!auth.currentUser) return;
    setIsSubmitting(true);
    try {
      const docRef = doc(db, "socialProfiles", auth.currentUser.uid);
      
      // Final age calculation
      const birthDate = new Date(formData.birthDate!);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      const now = new Date();
      const freeTrialUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const finalData = {
        ...formData,
        age,
        isCompleted: true,
        onboardingStep: 7,
        completeness: calculateCompleteness(formData),
        createdAt: formData.createdAt || now.toISOString(),
        updatedAt: now.toISOString(),
        lastActiveAt: now.toISOString(),
        withdrawableBalance: formData.withdrawableBalance || 0,
        hosting: formData.hosting || {
          freeTrialUntil: freeTrialUntil,
          packageHistory: []
        }
      };

      await setDoc(docRef, finalData, { merge: true });
      onComplete(finalData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `socialProfiles/${auth.currentUser.uid}`);
      toast.error("Profil oluşturulamadı.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const vibes = [
    { id: 'chill', label: 'Sakin & Chill', icon: Moon },
    { id: 'energetic', label: 'Enerjik & Sosyal', icon: Zap },
    { id: 'intellectual', label: 'Entelektüel', icon: Quote },
    { id: 'mystical', label: 'Mistik & Derin', icon: Sparkles },
    { id: 'fun', label: 'Eğlenceli', icon: Heart }
  ];

  const purposes = [
    { id: 'friendship', label: 'Yeni Dostluklar', icon: Users },
    { id: 'chat', label: 'Sadece Sohbet', icon: MessageCircle },
    { id: 'networking', label: 'Network & Tanışma', icon: Globe },
    { id: 'dating', label: 'Flört & İlişki', icon: Heart }
  ];

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col social-theme overflow-hidden">
      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-zinc-50 flex">
        {[...Array(totalSteps)].map((_, i) => (
          <div 
            key={i} 
            className={`h-full transition-all duration-700 ease-out ${
              i + 1 <= step ? 'flex-1 bg-zinc-900' : 'w-0'
            }`} 
          />
        ))}
      </div>

      {/* Header */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between relative z-10">
        <button 
          onClick={step === 1 ? onCancel : prevStep} 
          className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-colors"
        >
          {step === 1 ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
          Adım {step + 1} / 6
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-md mx-auto min-h-full flex flex-col"
          >
            {step === 1 && (
              <div className="space-y-12 pt-8">
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-tight">Seni biraz<br />tanıyalım</h1>
                  <p className="text-zinc-500 text-lg">Ahlas Social'da seni nasıl çağıralım?</p>
                </div>

                <div className="space-y-10">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Takma Ad</label>
                    <input 
                      type="text"
                      placeholder="Örn: GezginRuh"
                      value={formData.nickname}
                      onChange={e => setFormData(p => ({ ...p, nickname: e.target.value }))}
                      className="w-full bg-zinc-50 border-none rounded-2xl p-5 text-xl font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none placeholder:text-zinc-200"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Cinsiyet</label>
                    <div className="grid grid-cols-3 gap-3">
                      {['Kadın', 'Erkek', 'Diğer'].map(g => (
                        <button
                          key={g}
                          onClick={() => setFormData(p => ({ ...p, gender: g }))}
                          className={`py-4 rounded-2xl border-2 transition-all duration-500 font-bold text-sm ${
                            formData.gender === g 
                              ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-900/20' 
                              : 'bg-white border-zinc-50 text-zinc-400 hover:border-zinc-100'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-12 pt-8">
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-tight">Yıldızların<br />konumu</h1>
                  <p className="text-zinc-500 text-lg">Doğum bilgilerin sana en uygun kişileri bulmamıza yardımcı olur.</p>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Doğum Tarihi (Zorunlu)</label>
                    <div className="relative">
                      <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-300" strokeWidth={1.5} />
                      <input 
                        type="date"
                        value={formData.birthDate}
                        onChange={e => setFormData(p => ({ ...p, birthDate: e.target.value }))}
                        className="w-full bg-zinc-50 border-none rounded-2xl p-5 pl-14 text-xl font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Doğum Saati</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" strokeWidth={1.5} />
                        <input 
                          type="time"
                          value={formData.birthTime}
                          onChange={e => setFormData(p => ({ ...p, birthTime: e.target.value }))}
                          className="w-full bg-zinc-50 border-none rounded-2xl p-4 pl-11 text-base font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Doğum Yeri</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" strokeWidth={1.5} />
                        <input 
                          type="text"
                          placeholder="Şehir"
                          value={formData.birthPlace}
                          onChange={e => setFormData(p => ({ ...p, birthPlace: e.target.value }))}
                          className="w-full bg-zinc-50 border-none rounded-2xl p-4 pl-11 text-base font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none placeholder:text-zinc-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-10 pt-8">
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-tight">Vibe &<br />Amaç</h1>
                  <p className="text-zinc-500 text-lg">Sana en uygun sosyal çevreyi bulmamıza yardımcı ol.</p>
                </div>

                <div className="space-y-8">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Senin Vibe'ın</label>
                    <div className="flex flex-wrap gap-2">
                      {vibes.map(v => (
                        <button
                          key={v.id}
                          onClick={() => setFormData(p => ({ ...p, vibe: v.id }))}
                          className={`px-4 py-3 rounded-xl border-2 transition-all duration-300 flex items-center gap-2 font-bold text-xs ${
                            formData.vibe === v.id 
                              ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' 
                              : 'bg-white border-zinc-50 text-zinc-400 hover:border-zinc-100'
                          }`}
                        >
                          <v.icon className="w-4 h-4" />
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Sosyal Amacın</label>
                    <div className="grid grid-cols-2 gap-3">
                      {purposes.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setFormData(prev => ({ ...prev, socialPurpose: p.id }))}
                          className={`p-4 rounded-2xl border-2 transition-all duration-500 text-left space-y-2 ${
                            formData.socialPurpose === p.id 
                              ? 'bg-zinc-900 border-zinc-900 text-white shadow-xl shadow-zinc-900/20' 
                              : 'bg-white border-zinc-50 text-zinc-600 hover:border-zinc-100'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${formData.socialPurpose === p.id ? 'bg-white/10' : 'bg-zinc-50'}`}>
                            <p.icon className={`w-4 h-4 ${formData.socialPurpose === p.id ? 'text-white' : 'text-zinc-400'}`} />
                          </div>
                          <p className="font-bold text-xs">{p.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-12 pt-8">
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-tight">Kendinden<br />bahset</h1>
                  <p className="text-zinc-500 text-lg">Kısa bir biyografi ile diğer üyelerin seni tanımasını sağla.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Biyografi (Min. 10 karakter)</label>
                  <textarea 
                    placeholder="Nelerden hoşlanırsın? Buraya neler yazmak istersin?"
                    value={formData.bio}
                    onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
                    rows={6}
                    className="w-full bg-zinc-50 border-none rounded-[2rem] p-6 text-lg font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none placeholder:text-zinc-200 resize-none"
                  />
                  <div className="flex justify-end px-2">
                    <span className={`text-[10px] font-bold ${formData.bio?.length! < 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formData.bio?.length || 0} / 200
                    </span>
                  </div>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-12 pt-8">
                <div className="space-y-4 text-center">
                  <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-tight">Son<br />dokunuş</h1>
                  <p className="text-zinc-500 text-lg">Bir fotoğraf ekleyerek güvenilirliğini artır.</p>
                </div>

                <div className="flex flex-col items-center justify-center space-y-10">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-56 h-56 rounded-[4rem] bg-zinc-50 border-2 border-dashed border-zinc-100 flex items-center justify-center overflow-hidden cursor-pointer hover:border-zinc-200 transition-all group shadow-inner"
                  >
                    {formData.photoURL ? (
                      <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                          <Camera className="w-8 h-8 text-zinc-900" strokeWidth={1.5} />
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold">Fotoğraf Ekle</span>
                      </div>
                    )}
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handlePhotoUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                  
                  <div className="bg-zinc-50 px-6 py-4 rounded-2xl">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 font-bold text-center leading-relaxed">
                      Bu adım opsiyoneldir,<br />daha sonra da ekleyebilirsin.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Action */}
      <div className="p-8 bg-white/80 backdrop-blur-xl border-t border-zinc-50 fixed bottom-0 left-0 w-full">
        <button
          disabled={!isStepValid() || isSubmitting}
          onClick={nextStep}
          className={`w-full py-5 rounded-2xl font-bold tracking-widest uppercase text-xs transition-all duration-500 flex items-center justify-center gap-3 ${
            isStepValid() 
              ? 'bg-zinc-900 text-white shadow-2xl shadow-zinc-900/20 hover:bg-zinc-800 active:scale-[0.98]' 
              : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {step === totalSteps ? 'Tamamla' : 'Devam Et'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
