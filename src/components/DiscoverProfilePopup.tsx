import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Heart, 
  Zap, 
  MessageCircle, 
  Star, 
  Target, 
  Wind,
  Clock,
  Loader2,
  CheckCircle2
} from "lucide-react";
import { UserProfile, CompatibilityHistory } from "../types";
import { walletService } from "../lib/walletService";
import { socialService } from "../lib/socialService";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, limit, onSnapshot, orderBy, serverTimestamp, addDoc } from "firebase/firestore";

interface DiscoverProfilePopupProps {
  users: UserProfile[];
  initialIndex: number;
  currentUser: UserProfile;
  onClose: () => void;
  onNavigate: (tab: any) => void;
}

export default function DiscoverProfilePopup({ 
  users, 
  initialIndex, 
  currentUser, 
  onClose,
  onNavigate
}: DiscoverProfilePopupProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [photoIndex, setPhotoIndex] = useState(0);
  
  // INDEPENDENT LOADING STATES
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [hasLikedOptimistic, setHasLikedOptimistic] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<CompatibilityHistory | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const activeUser = users[currentIndex];
  const photos = activeUser?.social?.photos || [];
  const currentUid = currentUser.uid;
  const targetUid = activeUser?.uid;

  // Sync state when index changes
  useEffect(() => {
    setPhotoIndex(0);
    setAnalysisResult(null);
    setIsPending(false);
    setPendingRequestId(null);
    setIsAnalyzing(false);
    setIsMessaging(false);
    setIsLiking(false);
    setHasLikedOptimistic(false);
    if (targetUid) {
      checkExistingAnalysis(targetUid);
    }
  }, [currentIndex, targetUid]);

  const checkExistingAnalysis = async (uid: string) => {
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
      
      if (!snapReq.empty) {
        const req = { id: snapReq.docs[0].id, ...snapReq.docs[0].data() } as any;
        
        // IF PENDING: Ignore history, show pending UI
        if (req.status === 'pending' || req.revealed === false) {
          setIsPending(true);
          setPendingRequestId(req.id);
          setAnalysisResult(null); // Clear result if any
          return;
        }
        
        // IF REVEALED: Do NOT fetch result automatically
        // (Wait for polling or explicit user action)
      }
      
      // IF NO PENDING/REVEALED REQUEST: Fallback to old history if exists
      // (As requested, keeping this logic for retro-compatibility)
      // I am keeping the logic below so it doesn't break, but I won't automatically show it
      // as part of the popup opening in a way that interferes with the request check.
      // Wait, actually, the previous implementation did this:
      /*
      const q = query(
        collection(db, "compatibilityHistory"),
        where("userId", "==", currentUid),
        where("targetUserId", "==", uid),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setAnalysisResult({ id: snap.docs[0].id, ...snap.docs[0].data() } as CompatibilityHistory);
        return;
      }
      */
      // I will only run this if NO active pending request was found, to support retro-compatibility,
      // as requested.
      if (snapReq.empty) {
        const qHist = query(
          collection(db, "compatibilityHistory"),
          where("userId", "==", currentUid),
          where("targetUserId", "==", uid),
          limit(1)
        );
        const snapHist = await getDocs(qHist);
        if (!snapHist.empty) {
          setAnalysisResult({ id: snapHist.docs[0].id, ...snapHist.docs[0].data() } as CompatibilityHistory);
        }
      }
    } catch (err) {
      console.error("Check analysis error:", err);
    }
  };

  // Polling logic replaced by onSnapshot for reliability
  useEffect(() => {
    if (!pendingRequestId || !currentUid) return;

    const q = query(
      collection(db, "compatibilityHistory"),
      where("userId", "==", currentUid),
      where("requestId", "==", pendingRequestId),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as CompatibilityHistory;
        setAnalysisResult(data);
        setIsPending(false);
        setPendingRequestId(null);
        toast.success("Uyum analiziniz hazır! ✨");
      }
    });

    return () => unsub();
  }, [pendingRequestId, currentUid]);

  const handleNext = () => {
    if (currentIndex < users.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  // ACTION BUTTONS
  
  // BUTTON A: Compatibility (Analiz)
  const handleCompatibility = async () => {
    if (isAnalyzing || isPending || !targetUid) return;
    
    setIsAnalyzing(true);
    try {
      // Create a pending request
      const reqRef = await addDoc(collection(db, "compatibilityRequests"), {
        userId: currentUid,
        targetUserId: targetUid,
        status: "pending",
        revealed: false,
        createdAt: serverTimestamp(),
      });
      setIsPending(true);
      setPendingRequestId(reqRef.id);
      toast.success("Uyum analizi başlatıldı! Yıldızlar hesaplanıyor... ✨");

    } catch (error: any) {
      console.error("Analysis request error:", error);
      toast.error("Talep başlatılamadı.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // BUTTON B: Priority Message (100 Credit)
  const handlePriorityMessage = async () => {
    if (isMessaging || !targetUid) return;
    if (currentUser.mainCoins < 100) {
      toast.info("Yetersiz Kredi (100 J gerekli).");
      onNavigate('wallet');
      return;
    }

    setIsMessaging(true);
    const timeout = setTimeout(() => {
      toast.info("İşlem biraz uzun sürüyor...");
    }, 5000);

    try {
      // 1. Deduct 100 credits
      const spend = await walletService.spendBalance(
        currentUid, 
        'main', 
        100, 
        'priority_message', 
        `${activeUser.social?.nickname} kullanıcısına öncelikli mesaj.`
      );

      clearTimeout(timeout);

      if (spend.success) {
        // 2. Open chat
        const chatId = await socialService.createChat(currentUid, targetUid);
        if (chatId) {
          onNavigate('messages');
          toast.success("Öncelikli mesaj kanalı açıldı! ⚡️");
          onClose();
        }
      } else {
        toast.error(spend.message || "İşlem başarısız.");
      }
    } catch (err) {
      clearTimeout(timeout);
      console.error("Priority message error:", err);
      toast.error("Mesaj gönderilemedi.");
    } finally {
      setIsMessaging(false);
    }
  };

  // BUTTON C: Free Like (OPTIMISTIC)
  const handleFreeLike = async () => {
    if (isLiking || hasLikedOptimistic || !targetUid) return;
    
    // OPTIMISTIC UPDATE: Mark as liked immediately
    setHasLikedOptimistic(true);
    setIsLiking(true);

    try {
      // Async call without blocking the user
      socialService.sendLike(currentUser, targetUid, 'like')
        .then(result => {
          if (result === 'SUCCESS') {
            toast.success(`${activeUser.social?.nickname} beğenildi! 👍`);
          } else {
            setHasLikedOptimistic(false); // Revert if failed
          }
        })
        .catch(err => {
          console.error("Free like error:", err);
          setHasLikedOptimistic(false);
        })
        .finally(() => {
          setIsLiking(false);
        });
    } catch (err) {
      console.error("Outer free like error:", err);
      setIsLiking(false);
      setHasLikedOptimistic(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
      {/* BACKGROUND BACKDROP */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
      />

      {/* POPUP CARD */}
      <motion.div 
        layoutId={`discover-card-${targetUid}`}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg h-[85vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* CLOSE & NAV BUTTONS */}
        <div className="absolute top-6 inset-x-6 flex items-center justify-between z-50">
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-white/60 backdrop-blur-xl rounded-2xl flex items-center justify-center text-slate-800 shadow-xl"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              disabled={currentIndex === 0}
              onClick={handlePrev}
              className="w-10 h-10 bg-white/60 backdrop-blur-xl rounded-2xl flex items-center justify-center text-slate-800 shadow-xl disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              disabled={currentIndex === users.length - 1}
              onClick={handleNext}
              className="w-10 h-10 bg-white/60 backdrop-blur-xl rounded-2xl flex items-center justify-center text-slate-800 shadow-xl disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE AREA */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* PHOTO SECTION */}
          <div className="relative aspect-[4/5] bg-slate-100">
            <AnimatePresence mode="wait">
              <motion.img 
                key={`${targetUid}-${photoIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                src={photos[photoIndex]} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </AnimatePresence>

            {/* PHOTO NAV DOTS */}
            <div className="absolute bottom-6 inset-x-6 flex gap-1.5 pointer-events-none">
              {photos.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full bg-white transition-opacity ${i === photoIndex ? 'opacity-100' : 'opacity-30'}`} />
              ))}
            </div>

            {/* ONLINE INDICATOR */}
            {activeUser.social?.isOnline && (
              <div className="absolute top-20 right-6 flex items-center gap-2 bg-white/40 backdrop-blur-xl px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_#10B981]" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">AKTİF</span>
              </div>
            )}
          </div>

          {/* CONTENT SECTION */}
          <div className="p-8 pb-32 space-y-8">
            {/* NAME & AGE */}
            <div>
              <h2 className="text-4xl font-black tracking-tighter text-slate-900">
                {activeUser.social?.nickname}, <span className="text-amber-500">{activeUser.social?.age || 25}</span>
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <Target className="w-3 h-3" /> {activeUser.social?.lookingFor || "Uzaklara Bakıyor"}
              </p>
            </div>

            {/* BIO */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-3 bg-amber-400 rounded-full" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ruhun Hikayesi</h3>
              </div>
              <p className="text-sm font-medium leading-relaxed text-slate-600">
                {activeUser.social?.bio || "Bu ruh henüz hikayesinin detaylarını paylaşmadı..."}
              </p>
            </div>

            {/* COSMIC STATS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Burç</span>
                </div>
                <p className="text-sm font-black text-slate-800">{activeUser.zodiacSign || "Bilinmiyor"}</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aura</span>
                </div>
                <p className="text-sm font-black text-slate-800">Uyumlu Mavi</p>
              </div>
            </div>

            {/* INTERESTS */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-3">İlgi Alanları</h3>
              <div className="flex flex-wrap gap-2">
                {activeUser.social?.interests.map(tag => (
                  <span key={tag} className="px-4 py-2 bg-white border border-slate-100 shadow-sm rounded-2xl text-[11px] font-bold text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* COMPATIBILITY RESULT */}
            <AnimatePresence>
              {analysisResult && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-6 bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-100 rounded-[2rem] space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" />
                      <h4 className="text-sm font-black uppercase tracking-tighter">KOZMİK UYUM RAPORU</h4>
                    </div>
                    <span className="text-lg font-black text-rose-500">%{analysisResult.loveScore}</span>
                  </div>
                  
                  <p className="text-xs font-bold leading-relaxed text-slate-700 italic">
                    "{analysisResult.summaryLong}"
                  </p>
                </motion.div>
              )}

              {isPending && (
                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col items-center gap-3">
                  <Clock className="w-6 h-6 text-indigo-500 animate-spin" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Analiz Hazırlanıyor...</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ACTION BAR */}
        <div className="absolute bottom-0 inset-x-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 z-[60]">
          <div className="grid grid-cols-3 gap-3">
            {/* BUTTON A: Analiz */}
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleCompatibility}
              disabled={isAnalyzing}
              className="flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-100 rounded-3xl gap-1 text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Heart className="w-5 h-5 fill-current" />
              )}
              <span className="text-[8px] font-black tracking-tighter uppercase whitespace-nowrap">
                {isAnalyzing ? 'Taranıyor...' : `UYUM GÖR (${currentUser.compatibilityCount})`}
              </span>
            </motion.button>

            {/* BUTTON B: Priority Message */}
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handlePriorityMessage}
              disabled={isMessaging}
              className="flex flex-col items-center justify-center p-3 bg-slate-900 border border-slate-800 rounded-3xl gap-1 text-white shadow-xl shadow-slate-900/20 disabled:opacity-80"
            >
              {isMessaging ? (
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
              ) : (
                <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
              )}
              <span className="text-[8px] font-black tracking-tighter uppercase">
                {isMessaging ? 'Gidiyor...' : 'MESAJ GÖNDER (100 J)'}
              </span>
            </motion.button>

            {/* BUTTON C: Free Like */}
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={handleFreeLike}
              disabled={isLiking || hasLikedOptimistic}
              className={`flex flex-col items-center justify-center p-3 rounded-3xl gap-1 transition-all border ${
                hasLikedOptimistic 
                  ? 'bg-emerald-500 text-white border-emerald-500' 
                  : 'bg-slate-50 text-emerald-500 border-slate-100 hover:bg-emerald-50'
              }`}
            >
              {hasLikedOptimistic ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isLiking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Star className="w-5 h-5 fill-current" />
              )}
              <span className="text-[8px] font-black tracking-tighter uppercase">
                {hasLikedOptimistic ? 'BEĞENİLDİ' : isLiking ? '...' : 'ÜCRETSİZ BEĞEN'}
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
