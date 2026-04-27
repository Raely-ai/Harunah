import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flag, Heart, MessageCircle, ChevronLeft, ChevronRight, Sparkles, User, MapPin, Zap, Clock } from 'lucide-react';
import { UserProfile, CompatibilityHistory } from '../types';
import { walletService } from '../lib/walletService';
import { toast } from 'sonner';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { addDoc, collection, query, where, getDocs, limit, orderBy, serverTimestamp } from 'firebase/firestore';

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
  inChat?: boolean;
}

export default function SocialProfilePopup({ 
  user, 
  currentUser,
  onClose, 
  onCompatibilityCheck, 
  onSendMessage, 
  onNavigate,
  onStartChat,
  context = 'discover',
  inChat = false
}: SocialProfilePopupProps) {
  // Safe access with fallbacks
  const uid = user?.uid || "";
  const currentUid = currentUser?.uid || "";
  const social = user?.social || { photos: [], nickname: "", bio: "", zodiacSign: "", age: 25, lookingFor: "Ruh Eşi", interests: [] };
  const photos = social.photos.length > 0 ? social.photos : [user?.photoURL].filter(Boolean) as string[];
  const credits = currentUser?.compatibilityCount || 0;

  const [photoIndex, setPhotoIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<CompatibilityHistory | null>(null);
  const [speedUpPrice, setSpeedUpPrice] = useState(10);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    walletService.getAdminConfig().then(config => {
      if (config.socialRightsPrices.speedUpPrice) {
        setSpeedUpPrice(config.socialRightsPrices.speedUpPrice);
      }
    });
  }, []);

  useEffect(() => {
    if (!pendingRequestId || !currentUid) return;
    
    // In a real app, this should fetch status from Firestore directly to determine revealAt
    // Simplified for now based on requirement
    const timer = setInterval(() => {
      // Logic to check status and timeLeft
      // This will need Firestore listener actually
    }, 1000);
    return () => clearInterval(timer);
  }, [pendingRequestId, currentUid]);

  useEffect(() => {
    if (!currentUid || !uid) return;
    const checkExistingAnalysis = async () => {
      console.log("CHECK_EXISTING_START");
      try {
        // 1. Check for the latest CompatibilityRequest
        const qReq = query(
          collection(db, "compatibilityRequests"),
          where("userId", "==", currentUid),
          where("targetUserId", "==", uid),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snapReq = await getDocs(qReq);
        console.log("REQUESTS_FOUND", snapReq.docs.map(d => ({ id:d.id, ...d.data() })));
        
        if (!snapReq.empty) {
          const req = { id: snapReq.docs[0].id, ...snapReq.docs[0].data() } as any;
          
          // IF PENDING: Ignore history, show pending UI
          if (req.status === 'pending' || req.revealed === false) {
            setIsPending(true);
            setPendingRequestId(req.id);
            console.log("SET_ANALYSIS_RESULT_CALLED_FROM", "checkExistingAnalysis_pending", null);
            setAnalysisResult(null); // Clear result if any
            return;
          }
          
         // IF REVEALED: Do NOT fetch result automatically
          // if (req.status === 'revealed' || req.revealed === true) {
          //   const qHist = query(
          //     collection(db, "compatibilityHistory"),
          //     where("requestId", "==", req.id),
          //     limit(1)
          //   );
          //   const snapHist = await getDocs(qHist);
          //   console.log("HISTORY_FOUND", snapHist.docs.map(d => ({ id:d.id, ...d.data() })));
          //   if (!snapHist.empty) {
          //     const res = { id: snapHist.docs[0].id, ...snapHist.docs[0].data() } as CompatibilityHistory;
          //     console.log("SET_ANALYSIS_RESULT_CALLED_FROM", "checkExistingAnalysis_revealed", res);
          //     setAnalysisResult(res);
          //     setIsPending(false);
          //     setPendingRequestId(null);
          //     return;
          //   }
          // }
        }
        
        // IF NO PENDING/REVEALED REQUEST: Fallback to old history if exists
        // (As requested, keeping this logic for retro-compatibility)
      } catch (error) {
        console.error("Error checking analysis:", error);
      }
    };
    checkExistingAnalysis();
  }, [currentUid, uid]);

  // Polling for pending analysis
  useEffect(() => {
    if (!pendingRequestId || !currentUid) return;

    const interval = setInterval(async () => {
      try {
        const q = query(
          collection(db, "compatibilityRequests"),
          where("id", "==", pendingRequestId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const req = snap.docs[0].data() as any;
          if (req.status === 'revealed' || req.revealed === true) {
            // Now fetch the history
            const qHist = query(
              collection(db, "compatibilityHistory"),
              where("requestId", "==", pendingRequestId),
              limit(1)
            );
            const snapHist = await getDocs(qHist);
            if (!snapHist.empty) {
              const res = { id: snapHist.docs[0].id, ...snapHist.docs[0].data() } as CompatibilityHistory;
              if (res.revealed === true) {
                console.log("SET_ANALYSIS_RESULT_CALLED_FROM", "polling", res);
                setAnalysisResult(res);
                setIsPending(false);
                setPendingRequestId(null);
                clearInterval(interval);
                toast.success("Uyum analiziniz hazır! ✨");
              }
            }
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingRequestId, currentUid]);

  const handleCompatibilityCheck = async () => {
    console.log("ANALYZE_CLICK", currentUid, uid);
    if (isProcessing || isPending || !uid) return;
    
    console.log("HANDLE_START");
    setIsProcessing(true);
    try {
      // Create a pending request
      const reqRef = await addDoc(collection(db, "compatibilityRequests"), {
        userId: currentUid,
        targetUserId: uid,
        status: "pending",
        revealed: false,
        createdAt: serverTimestamp(),
      });
      console.log("CREATED_REQUEST_ID", reqRef.id);
      setIsPending(true);
      setPendingRequestId(reqRef.id);
      console.log("AFTER_CLICK_STATE", { isPending: true, analysisResult, pendingRequestId: reqRef.id });
      toast.success("Uyum analizi başlatıldı! Yıldızlar hesaplanıyor... ✨");

    } catch (error: any) {
      console.error("Analysis request error:", error);
      toast.error("Talep başlatılamadı.");
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

  const handleSpeedUp = async () => {
    if (!pendingRequestId || isProcessing) return;
    
    if (currentUser.mainCoins < speedUpPrice) {
      toast.info(`Hızlandırıcı için ${speedUpPrice} J gerekli. Cüzdana gidiliyor...`);
      onNavigate('wallet');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await walletService.speedUpCompatibilityAnalysis(pendingRequestId);
      if (result.success) {
        toast.success("Kozmik Hızlandırıcı aktif! Analiz saniyeler içinde hazır. ⚡️");
      } else {
        toast.error(result.message || "Hızlandırma başarısız.");
      }
    } catch (err) {
      toast.error("Bir hata oluştu.");
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
      className="fixed inset-0 z-[100] flex flex-col bg-white/10 backdrop-blur-sm"
    >
      {/* Close Button - Premium and stable */}
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-2 bg-white/80 backdrop-blur-md rounded-full text-slate-800 border border-slate-100/50 z-50 hover:bg-white transition-all active:scale-95 shadow-sm"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Photo Section */}
        <div className="relative h-[55vh] w-full bg-slate-100 overflow-hidden">
          <motion.img 
            key={photoIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={photos[photoIndex] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`} 
            alt={social.nickname || user?.nickname}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          
          {/* Gradient Overlay for integration */}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent pointer-events-none" />
          
          {/* Photo Navigation Indicators */}
          {photos.length > 1 && (
            <div className="absolute top-4 left-6 right-6 flex gap-1.5 z-10">
              {photos.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full ${i === photoIndex ? 'bg-white shadow-sm' : 'bg-white/50'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Info Content - Clean and Premium */}
        <div className="px-6 pb-40 -mt-10 relative z-10 bg-white rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pt-8">
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-serif font-bold text-slate-900 tracking-tight">
                {social.nickname || user?.nickname}, {social.age || user?.age || 25}
              </h2>
              <button 
                onClick={handleReport}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 rounded-full"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
            
            {/* Bio Section */}
            <div className="space-y-2">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Hakkında</h3>
              <p className="text-slate-700 text-base leading-relaxed font-medium">
                {social.bio || user?.bio || 'Mistik bir ruh, henüz hikayesini paylaşmamış.'}
              </p>
            </div>

            {/* Interests Section */}
            {social.interests && social.interests.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">İlgi Alanları</h3>
                <div className="flex flex-wrap gap-2">
                  {social.interests.slice(0, 6).map((interest) => (
                    <span key={interest} className="px-4 py-1.5 bg-slate-50 border border-slate-100 text-slate-600 text-xs rounded-full font-medium">
                      {interest}
                    </span>
                  ))}
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
              {isPending && !analysisResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-5 bg-purple-500/5 border border-purple-500/10 rounded-3xl space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-purple-600 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-heading">Analiz Hazırlanıyor...</h4>
                      <p className="text-[10px] text-muted font-medium">Yıldızlar hizalanıyor, yaklaşık 5 dakika sürer.</p>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="h-full w-1/2 bg-gradient-to-r from-transparent via-purple-500 to-transparent"
                    />
                  </div>
                  <p className="text-[10px] text-center text-muted/60 font-medium italic">
                    "Hazır olduğunda sana bildirim göndereceğiz."
                  </p>
                </motion.div>
              )}

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
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 z-40">
        <div className="max-w-md mx-auto flex flex-col gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isProcessing || isPending}
            animate={isProcessing || isPending ? { scale: 0.98, opacity: 0.6 } : { scale: 1, opacity: 1 }}
            onClick={handleCompatibilityCheck}
            className="flex items-center justify-center gap-3 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all"
          >
            <Heart className="w-4 h-4" />
            <span>
              {analysisResult 
                ? 'Tekrar Analiz Et' 
                : isPending 
                  ? 'Analiz Hazırlanıyor...' 
                  : `Uyumunu Gör (${credits})`
              }
            </span>
          </motion.button>
          
          {isPending && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isProcessing}
              onClick={handleSpeedUp}
              className="flex items-center justify-center gap-3 py-4 bg-amber-50 text-amber-700 rounded-2xl font-bold text-sm border border-amber-200 hover:bg-amber-100 active:scale-[0.98] transition-all"
            >
              <Zap className="w-4 h-4" />
              <span>Beklemek istemiyor musun? ({speedUpPrice} J)</span>
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
