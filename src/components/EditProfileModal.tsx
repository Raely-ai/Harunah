import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Calendar, Star, Camera, Check, Loader2, MapPin, FileText } from 'lucide-react';
import { UserProfile } from '../types';
import { storage, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';

interface EditProfileModalProps {
  user: UserProfile;
  onClose: () => void;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

export default function EditProfileModal({ user, onClose, onSave }: EditProfileModalProps) {
  const [nickname, setNickname] = useState(user.nickname || user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [interests, setInterests] = useState(user.interests?.join(', ') || '');
  const [photoURL, setPhotoURL] = useState(user.photos?.[0] || user.photoURL || '');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const zodiacSigns = [
    { id: 'Koç', name: 'Koç' },
    { id: 'Boğa', name: 'Boğa' },
    { id: 'İkizler', name: 'İkizler' },
    { id: 'Yengeç', name: 'Yengeç' },
    { id: 'Aslan', name: 'Aslan' },
    { id: 'Başak', name: 'Başak' },
    { id: 'Terazi', name: 'Terazi' },
    { id: 'Akrep', name: 'Akrep' },
    { id: 'Yay', name: 'Yay' },
    { id: 'Oğlak', name: 'Oğlak' },
    { id: 'Kova', name: 'Kova' },
    { id: 'Balık', name: 'Balık' },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      setPhotoURL(downloadURL);
      toast.success("Fotoğraf yüklendi.");
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Fotoğraf yüklenemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const updates: Partial<UserProfile> = {
        nickname: nickname,
        bio: bio,
        interests: interests.split(',').map(i => i.trim()).filter(i => i !== ''),
        photos: [photoURL]
      };
      await onSave(updates);
      onClose();
      toast.success("Profil güncellendi.");
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Profil güncellenemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-lg bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-serif font-bold text-amber-50">Profili Düzenle</h2>
            <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Avatar Edit */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                  {photoURL ? (
                    <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-purple-200/20" />
                  )}
                </div>
                <div 
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
              </div>
            </div>

            {/* Nickname */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-purple-200/40 uppercase tracking-widest px-1">Kullanıcı Adı</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20" />
                <input 
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-amber-50 focus:outline-none focus:border-amber-500/50 transition-colors"
                  placeholder="Kullanıcı Adı"
                  required
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-purple-200/40 uppercase tracking-widest px-1">Bio</label>
              <div className="relative">
                <FileText className="absolute left-4 top-6 w-5 h-5 text-purple-200/20" />
                <textarea 
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-amber-50 focus:outline-none focus:border-amber-500/50 transition-colors"
                  placeholder="Kendinden bahset"
                  rows={3}
                />
              </div>
            </div>

            {/* Interests */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-purple-200/40 uppercase tracking-widest px-1">İlgi Alanları (Virgülle ayır)</label>
              <div className="relative">
                <Star className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20" />
                <input 
                  type="text"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-amber-50 focus:outline-none focus:border-amber-500/50 transition-colors"
                  placeholder="Müzik, Spor, Seyahat"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold flex items-center justify-center gap-2 hover:bg-amber-400 transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span>Değişiklikleri Kaydet</span>
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
