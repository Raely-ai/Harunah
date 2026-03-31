import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { X, User, Camera, Check, Loader2, FileText, Star } from 'lucide-react';
import { UserProfile } from '../types';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { uploadPhoto } from '../lib/uploadService';

interface EditProfileModalProps {
  user: UserProfile;
  onClose: () => void;
  onSave: (updates: Partial<UserProfile>) => Promise<void>;
}

export default function EditProfileModal({ user, onClose, onSave }: EditProfileModalProps) {
  const [nickname, setNickname] = useState(user.social?.nickname || user.nickname || '');
  const [bio, setBio] = useState(user.social?.bio || user.bio || '');
  const [interests, setInterests] = useState(user.social?.interests?.join(', ') || '');
  const [photoURL, setPhotoURL] = useState(user.social?.photos?.[0] || user.photoURL || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const downloadURL = await uploadPhoto(file, user.uid);
      setPhotoURL(downloadURL);
      toast.success("Fotoğraf yüklendi.");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Fotoğraf yüklenemedi.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isUploading) return;

    console.log("Saving profile, user:", user);
    setIsSaving(true);
    try {
      const updatedInterests = interests.split(',').map(i => i.trim()).filter(i => i !== '');
      const profileCompleted = !!(user.social?.gender && nickname && updatedInterests.length > 0);
      
      const finalPhotos = photoURL ? [photoURL] : (user.social?.photos || []);
      console.log("Final photos:", finalPhotos);

      const updates: Partial<UserProfile> = {
        social: {
          ...user.social,
          nickname,
          bio,
          interests: updatedInterests,
          photos: finalPhotos,
          profileCompleted,
          updatedAt: new Date().toISOString(),
          // Preserve existing fields
          gender: user.social?.gender || 'erkek',
          lookingFor: user.social?.lookingFor || 'aşk',
          enabled: user.social?.enabled ?? true,
          visible: user.social?.visible ?? true,
          banned: user.social?.banned ?? false,
          settings: user.social?.settings ?? {
            whoCanMessage: 'everyone',
            whoCanAddFriend: 'everyone',
            notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true }
          }
        }
      };
      console.log("Updates:", updates);
      
      await onSave(updates);
      onClose();
      toast.success("Profil güncellendi.");
    } catch (error) {
      console.error("Save error:", error);
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
      className="fixed inset-0 z-[200] bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.95 }} 
        animate={{ scale: 1 }} 
        className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Profili Düzenle</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="flex justify-center mb-4">
              <div 
                className="relative w-24 h-24 rounded-full bg-slate-100 overflow-hidden cursor-pointer group border-2 border-slate-200" 
                onClick={() => fileInputRef.current?.click()}
              >
                <img 
                  src={photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  className="w-full h-full object-cover"
                  alt="Profil"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading ? <Loader2 className="animate-spin text-white" /> : <Camera className="text-white" />}
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Kullanıcı Adı</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  value={nickname} 
                  onChange={(e) => setNickname(e.target.value)} 
                  className="w-full p-3 pl-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="Kullanıcı Adı" 
                  required 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Bio</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <textarea 
                  value={bio} 
                  onChange={(e) => setBio(e.target.value)} 
                  className="w-full p-3 pl-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="Kendinden bahset..." 
                  rows={3} 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">İlgi Alanları (Virgülle ayır)</label>
              <div className="relative">
                <Star className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  value={interests} 
                  onChange={(e) => setInterests(e.target.value)} 
                  className="w-full p-3 pl-10 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="Müzik, Spor, Seyahat..." 
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isSaving || isUploading} 
              className="w-full py-3 mt-4 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <><Check className="w-5 h-5" /> Kaydet</>}
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
