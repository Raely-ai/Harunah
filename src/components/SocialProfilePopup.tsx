import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, Heart, MessageCircle, ChevronLeft, ChevronRight, Sparkles, User, MapPin, Zap } from 'lucide-react';
import { UserProfile, CompatibilityHistory } from '../types';
import { walletService } from '../lib/walletService';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

import { reportService } from '../services/reportService';

interface SocialProfilePopupProps {
  user: UserProfile;
  currentUser: UserProfile;
  onClose: () => void;
  onCompatibilityCheck: (user: UserProfile) => void;
  onSendMessage: (user: UserProfile) => void;
  onNavigate: (tab: any) => void;
  onStartChat?: (user: UserProfile) => void;
  context?: 'discover' | 'likers' | 'match';
}

export default function SocialProfilePopup({ 
  user, 
  currentUser,
  onClose, 
  onCompatibilityCheck, 
  onSendMessage, 
  onNavigate,
  onStartChat,
  context = 'discover' 
}: SocialProfilePopupProps) {
  // Safe access with fallbacks
  const uid = user?.uid || "";
  const currentUid = currentUser?.uid || "";
  const social = user?.social || { photos: [], nickname: "", bio: "", zodiacSign: "", age: 25, lookingFor: "Ruh Eşi", interests: [] };
  const photos = social.photos.length > 0 ? social.photos : [user?.photoURL].filter(Boolean) as string[];
  const credits = currentUser?.compatibilityCount || 0;

  const [photoIndex, setPhotoIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CompatibilityHistory | null>(null);

  useEffect(() => {
    if (!currentUid || !uid) return;
    const checkExistingAnalysis = async () => {
      try {
        const q = query(
          collection(db, "compatibilityHistory"),
          where("userId", "==", currentUid),
          where("targetUserId", "==", uid),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setAnalysisResult({ id: snap.docs[0].id, ...snap.docs[0].data() } as CompatibilityHistory);
        }
      } catch (error) {
        console.error("Error checking analysis:", error);
      }
    };
    checkExistingAnalysis();
  }, [currentUser.uid, user.uid]);

  const handleCompatibilityCheck = async () => {
    if (isProcessing || !uid) return;
    
    setIsProcessing(true);
    try {
      const result = await walletService.runCompatibilityAnalysis(uid, 'ask');
      if (result.success) {
        setAnalysisResult(result.analysis);
        if (!result.cached) {
          toast.success("Uyum analizi tamamlandı! ✨");
        }
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      if (error.message?.includes("Yetersiz")) {
        toast.info("Uyum analizi hakkın bitti. Cüzdandan alabilirsin.");
        onNavigate('wallet');
      } else {
        toast.error(error.message || "Analiz sırasında bir hata oluştu.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

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

  const handleReport = async () => {
    if (!uid) return;
    const reason = window.prompt("Raporlama sebebi (Örn: Uygunsuz içerik, Taciz, Sahte profil):");
    if (!reason) return;
    
    await reportService.reportUser({
      reportedUserId: uid,
      source: 'profile',
      reason: reason,
      description: "Profil üzerinden raporlandı.",
      metadata: { context }
    });
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-[100] flex flex-col bg-[#F6F4F8]"
    >
      {/* Close Button - High visibility */}
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-3 bg-white/40 backdrop-blur-xl rounded-2xl text-heading border border-black/5 z-50 hover:bg-white/60 transition-all active:scale-95 shadow-2xl"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Photo Section - Optimized Height */}
        <div className="relative h-[45vh] w-full bg-black/5 overflow-hidden">
          <motion.img 
            key={photoIndex}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            src={photos[photoIndex] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`} 
            alt={social.nickname || user?.nickname}
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#F6F4F8] via-transparent to-transparent pointer-events-none" />
        </div>

        {/* Info Content */}
        <div className="px-6 pb-40 -mt-10 relative z-10">
          <div className="space-y-5">
            {/* Header Info */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-3xl font-serif font-bold text-heading tracking-tight">
                    {social.nickname || user?.nickname}, {social.age || user?.age || 25}
                  </h2>
                  <div className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-600">
                      {user?.horoscope || "Burç"}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleReport}
                  className="p-2 text-muted hover:text-red-500 transition-colors"
                >
                  <Flag className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-body text-[13px] font-medium">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600/60" />
                  <span>Ruhsal Uyum Analizi</span>
                </div>
              </div>
            </div>

            {/* Bio Section */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Hakkında</h3>
              <p className="text-body text-base leading-relaxed font-medium line-clamp-3">
                {social.bio || user?.bio || 'Mistik bir ruh, henüz hikayesini paylaşmamış.'}
              </p>
            </div>

            {/* Interests Section */}
            {social.interests && social.interests.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">İlgi Alanları</h3>
                <div className="flex flex-wrap gap-1.5">
                  {social.interests.slice(0, 6).map((interest) => (
                    <span key={interest} className="px-3 py-1.5 bg-black/[0.03] border border-black/5 text-body text-[13px] rounded-xl font-semibold hover:bg-black/[0.06] transition-all">
                      {interest}
                    </span>
                  ))}
                  {social.interests.length > 6 && (
                    <span className="px-3 py-1.5 bg-black/[0.03] border border-black/5 text-muted text-[13px] rounded-xl font-semibold">
                      +{social.interests.length - 6}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Extra Info / Stats */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <div className="p-3.5 bg-black/[0.02] border border-black/5 rounded-2xl space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted">Aradığı</span>
                <p className="text-xs font-bold text-body">{social.lookingFor || "Ruh Eşi"}</p>
              </div>
              <div className="p-3.5 bg-black/[0.02] border border-black/5 rounded-2xl space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted">Enerji</span>
                <p className="text-xs font-bold text-body">Yüksek Frekans</p>
              </div>
            </div>

            {/* Compatibility Result Display */}
            <AnimatePresence>
              {analysisResult && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-500/20 rounded-3xl space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <h4 className="text-sm font-bold text-heading">Ruhsal Uyum Analizi</h4>
                    </div>
                    <span className="text-xs font-black text-rose-600">% {analysisResult.loveScore}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 bg-white/40 rounded-xl">
                      <p className="text-[8px] font-black text-muted uppercase tracking-tighter">Aşk</p>
                      <p className="text-xs font-bold text-rose-600">%{analysisResult.loveScore}</p>
                    </div>
                    <div className="text-center p-2 bg-white/40 rounded-xl">
                      <p className="text-[8px] font-black text-muted uppercase tracking-tighter">Dostluk</p>
                      <p className="text-xs font-bold text-blue-600">%{analysisResult.friendshipScore}</p>
                    </div>
                    <div className="text-center p-2 bg-white/40 rounded-xl">
                      <p className="text-[8px] font-black text-muted uppercase tracking-tighter">Enerji</p>
                      <p className="text-xs font-bold text-amber-600">%{analysisResult.energyScore}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-heading leading-tight italic">"{analysisResult.summaryShort}"</p>
                    <p className="text-[11px] text-body leading-relaxed opacity-80">{analysisResult.summaryLong}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pt-10 bg-gradient-to-t from-[#F6F4F8] via-[#F6F4F8]/95 to-transparent z-40">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          <button 
            onClick={handleCompatibilityCheck}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-2xl font-bold text-sm shadow-lg shadow-rose-900/10 border border-rose-400/20 active:scale-[0.98] transition-all ${isProcessing ? 'opacity-50' : ''}`}
          >
            <Heart className="w-4 h-4 fill-white" />
            <span>{analysisResult ? 'Tekrar Analiz Et' : `Uyumunu Gör (${credits})`}</span>
          </button>
          
          <button 
            onClick={handleAction}
            disabled={isProcessing}
            className={`flex items-center justify-center gap-3 py-4 bg-white border border-black/5 text-heading rounded-2xl font-bold text-sm shadow-sm hover:bg-black/5 transition-all active:scale-[0.98] ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>{context === 'likers' ? 'Sohbet Başlat' : 'Mesaj Gönder'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
