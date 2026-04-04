import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, Heart, MessageCircle, ChevronLeft, ChevronRight, Sparkles, User, MapPin } from 'lucide-react';
import { UserProfile } from '../types';

interface SocialProfilePopupProps {
  user: UserProfile;
  onClose: () => void;
  onCompatibilityCheck: (user: UserProfile) => void;
  onSendMessage: (user: UserProfile) => void;
  onStartChat?: (user: UserProfile) => void;
  context?: 'discover' | 'likers' | 'match';
}

export default function SocialProfilePopup({ 
  user, 
  onClose, 
  onCompatibilityCheck, 
  onSendMessage, 
  onStartChat,
  context = 'discover' 
}: SocialProfilePopupProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const photos = user.social?.photos || [user.photoURL].filter(Boolean) as string[];

  const handleAction = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (context === 'likers' && onStartChat) {
        await onStartChat(user);
      } else {
        await onSendMessage(user);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    // Add class to hide global bottom nav
    document.body.classList.add('profile-detail-open');
    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('profile-detail-open');
    };
  }, []);

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev + 1) % photos.length);
  };
  
  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#050505]"
    >
      {/* Close Button - High visibility */}
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-3 bg-black/40 backdrop-blur-xl rounded-2xl text-white border border-white/10 z-50 hover:bg-black/60 transition-all active:scale-95 shadow-2xl"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Photo Section - Optimized Height */}
        <div className="relative h-[45vh] w-full bg-zinc-900 overflow-hidden">
          <motion.img 
            key={photoIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            src={photos[photoIndex] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
            alt={user.social?.nickname || user.nickname}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          
          {/* Photo Navigation Overlay */}
          {photos.length > 1 && (
            <>
              <div className="absolute inset-0 flex">
                <div className="flex-1 cursor-pointer" onClick={prevPhoto} />
                <div className="flex-1 cursor-pointer" onClick={nextPhoto} />
              </div>
              
              {/* Photo Indicators */}
              <div className="absolute top-4 left-6 right-16 flex gap-1.5 z-10">
                {photos.map((_, i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i === photoIndex ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]' : 'bg-white/30'}`} />
                ))}
              </div>

              {/* Navigation Arrows - Subtle */}
              <button onClick={prevPhoto} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 backdrop-blur-md rounded-full text-white/60 hover:text-white transition-all"><ChevronLeft className="w-6 h-6" /></button>
              <button onClick={nextPhoto} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/20 backdrop-blur-md rounded-full text-white/60 hover:text-white transition-all"><ChevronRight className="w-6 h-6" /></button>
            </>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Info Content */}
        <div className="px-6 pb-40 -mt-10 relative z-10">
          <div className="space-y-5">
            {/* Header Info */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-3xl font-serif font-bold text-white tracking-tight">
                    {user.social?.nickname || user.nickname}, {user.age}
                  </h2>
                  <div className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                      {user.horoscope || "Burç"}
                    </span>
                  </div>
                </div>
                <button className="p-2 text-zinc-500 hover:text-red-500 transition-colors">
                  <Flag className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-zinc-400 text-[13px] font-medium">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500/60" />
                  <span>{user.location?.city || "Yakınlarda"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500/60" />
                  <span>%{Math.floor(Math.random() * 20 + 80)} Uyumlu</span>
                </div>
              </div>
            </div>

            {/* Bio Section */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Hakkında</h3>
              <p className="text-zinc-300 text-base leading-relaxed font-medium line-clamp-3">
                {user.social?.bio || 'Mistik bir ruh, henüz hikayesini paylaşmamış.'}
              </p>
            </div>

            {/* Interests Section */}
            {user.social?.interests && user.social.interests.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">İlgi Alanları</h3>
                <div className="flex flex-wrap gap-1.5">
                  {user.social.interests.slice(0, 6).map((interest) => (
                    <span key={interest} className="px-3 py-1.5 bg-white/[0.03] border border-white/10 text-zinc-300 text-[13px] rounded-xl font-semibold hover:bg-white/[0.06] transition-all">
                      {interest}
                    </span>
                  ))}
                  {user.social.interests.length > 6 && (
                    <span className="px-3 py-1.5 bg-white/[0.03] border border-white/10 text-zinc-500 text-[13px] rounded-xl font-semibold">
                      +{user.social.interests.length - 6}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Extra Info / Stats */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Aradığı</span>
                <p className="text-xs font-bold text-zinc-300">{user.social?.lookingFor || "Ruh Eşi"}</p>
              </div>
              <div className="p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Enerji</span>
                <p className="text-xs font-bold text-zinc-300">Yüksek Frekans</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 bg-gradient-to-t from-[#050505] via-[#050505]/95 to-transparent z-40">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onCompatibilityCheck(user)}
            className="flex items-center justify-center gap-3 py-4.5 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-[2rem] font-bold text-base shadow-xl shadow-rose-900/20 border border-rose-400/20"
          >
            <Heart className="w-5 h-5 fill-white" />
            <span>Uyumunu Gör</span>
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAction}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-3 py-4.5 bg-white/10 backdrop-blur-xl text-white rounded-[2rem] font-bold text-base border border-white/10 hover:bg-white/20 transition-all ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <MessageCircle className="w-5 h-5" />
            <span>{context === 'likers' ? 'Sohbet Başlat' : 'Mesaj Gönder'}</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
