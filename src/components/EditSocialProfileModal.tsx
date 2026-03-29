import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Camera, MapPin, Calendar, Clock, Globe, Heart, Quote, Zap, Moon, Sparkles, Users, MessageCircle, Save } from "lucide-react";
import { SocialProfile } from "../types";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { toast } from "sonner";

interface EditSocialProfileModalProps {
  profile: SocialProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: SocialProfile) => void;
}

export default function EditSocialProfileModal({ profile, onClose, onUpdate }: EditSocialProfileModalProps) {
  const [formData, setFormData] = useState<SocialProfile>({ ...profile });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    setIsSubmitting(true);
    try {
      const docRef = doc(db, "socialProfiles", auth.currentUser.uid);
      
      // Recalculate age
      const birthDate = new Date(formData.birthDate);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      const updatedData = {
        ...formData,
        age,
        completeness: calculateCompleteness(formData),
        updatedAt: new Date().toISOString()
      };

      await updateDoc(docRef, updatedData);
      onUpdate(updatedData);
      toast.success("Profilin güncellendi!");
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `socialProfiles/${auth.currentUser.uid}`);
      toast.error("Güncelleme başarısız oldu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-white rounded-t-[3rem] sm:rounded-[3rem] overflow-hidden flex flex-col max-h-[90vh] social-theme"
      >
        {/* Header */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-zinc-900">Profili Düzenle</h2>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-8 pb-12 space-y-10">
          {/* Photo */}
          <div className="flex flex-col items-center space-y-4 pt-4">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative w-32 h-32 rounded-[2.5rem] bg-zinc-50 overflow-hidden cursor-pointer group shadow-xl shadow-zinc-200/20"
            >
              {formData.photoURL ? (
                <img src={formData.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-zinc-200" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Fotoğrafı Değiştir</span>
          </div>

          {/* Basic Info */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Takma Ad</label>
              <input 
                type="text"
                value={formData.nickname}
                onChange={e => setFormData(p => ({ ...p, nickname: e.target.value }))}
                className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-base font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Cinsiyet</label>
                <select 
                  value={formData.gender}
                  onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))}
                  className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-base font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none appearance-none"
                >
                  <option value="Kadın">Kadın</option>
                  <option value="Erkek">Erkek</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Bölge</label>
                <input 
                  type="text"
                  value={formData.region}
                  onChange={e => setFormData(p => ({ ...p, region: e.target.value }))}
                  className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-base font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Birth Info */}
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Doğum Tarihi</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                <input 
                  type="date"
                  value={formData.birthDate}
                  onChange={e => setFormData(p => ({ ...p, birthDate: e.target.value }))}
                  className="w-full bg-zinc-50 border-none rounded-2xl p-4 pl-11 text-base font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Doğum Saati</label>
                <div className="relative">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
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
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
                  <input 
                    type="text"
                    value={formData.birthPlace}
                    onChange={e => setFormData(p => ({ ...p, birthPlace: e.target.value }))}
                    className="w-full bg-zinc-50 border-none rounded-2xl p-4 pl-11 text-base font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Vibe & Purpose */}
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Senin Vibe'ın</label>
              <div className="flex flex-wrap gap-2">
                {vibes.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, vibe: v.id }))}
                    className={`px-4 py-2.5 rounded-xl border-2 transition-all duration-300 flex items-center gap-2 font-bold text-[10px] uppercase tracking-wider ${
                      formData.vibe === v.id 
                        ? 'bg-zinc-900 border-zinc-900 text-white shadow-lg' 
                        : 'bg-white border-zinc-50 text-zinc-400 hover:border-zinc-100'
                    }`}
                  >
                    <v.icon className="w-3.5 h-3.5" />
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
                    type="button"
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
                    <p className="font-bold text-[10px] uppercase tracking-wider">{p.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-3">
            <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 ml-1">Biyografi</label>
            <textarea 
              value={formData.bio}
              onChange={e => setFormData(p => ({ ...p, bio: e.target.value }))}
              rows={4}
              className="w-full bg-zinc-50 border-none rounded-2xl p-4 text-base font-medium focus:ring-2 ring-zinc-900/5 transition-all outline-none resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-5 rounded-2xl bg-zinc-900 text-white font-bold tracking-widest uppercase text-xs shadow-2xl shadow-zinc-900/20 hover:bg-zinc-800 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                Değişiklikleri Kaydet
              </>
            )}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}
