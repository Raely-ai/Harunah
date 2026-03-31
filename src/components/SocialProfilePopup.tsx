import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, Heart, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { UserProfile } from '../types';

interface SocialProfilePopupProps {
  user: UserProfile;
  onClose: () => void;
  onCompatibilityCheck: (user: UserProfile) => void;
  onSendMessage: (user: UserProfile) => void;
}

export default function SocialProfilePopup({ user, onClose, onCompatibilityCheck, onSendMessage }: SocialProfilePopupProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = user.social?.photos || [user.photoURL].filter(Boolean) as string[];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const nextPhoto = () => setPhotoIndex((prev) => (prev + 1) % photos.length);
  const prevPhoto = () => setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex flex-col bg-white"
    >
      {/* Fotoğraf Alanı */}
      <div className="relative h-[60vh] bg-slate-200">
        <img 
          src={photos[photoIndex] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
          alt={user.social?.nickname || user.nickname}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white"><X /></button>
        <button onClick={prevPhoto} className="absolute left-2 top-1/2 p-2 bg-black/20 backdrop-blur-md rounded-full text-white"><ChevronLeft /></button>
        <button onClick={nextPhoto} className="absolute right-2 top-1/2 p-2 bg-black/20 backdrop-blur-md rounded-full text-white"><ChevronRight /></button>
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
          {photos.map((_, i) => (
            <div key={i} className={`h-1.5 w-1.5 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/50'}`} />
          ))}
        </div>
      </div>

      {/* İçerik */}
      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">{user.social?.nickname || user.nickname || user.displayName}, {user.age || 'Yaş belirtilmemiş'}</h2>
            <p className="text-slate-600 text-base mt-2">{user.social?.bio || 'Bio eklenmemiş.'}</p>
          </div>
          <button className="text-slate-400 hover:text-red-500"><Flag className="w-6 h-6" /></button>
        </div>

        {user.social?.interests && (
          <div className="flex flex-wrap gap-2 pt-2">
            {user.social.interests.map((interest) => (
              <span key={interest} className="px-4 py-2 bg-indigo-50 text-indigo-700 text-sm rounded-full font-medium">
                {interest}
              </span>
            ))}
          </div>
        )}

        {/* Butonlar */}
        <div className="grid grid-cols-2 gap-4 pt-8">
          <button 
            onClick={() => onCompatibilityCheck(user)}
            className="flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-base hover:bg-indigo-700 transition-colors"
          >
            <Heart className="w-5 h-5" /> Uyumunu Gör
          </button>
          <button 
            onClick={() => onSendMessage(user)}
            className="flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-900 rounded-2xl font-bold text-base hover:bg-slate-200 transition-colors"
          >
            <MessageCircle className="w-5 h-5" /> Mesaj Gönder
          </button>
        </div>
      </div>
    </motion.div>
  );
}
