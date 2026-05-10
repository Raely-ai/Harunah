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
  CheckCircle2,
  Flag,
  ShieldAlert
} from "lucide-react";
import { UserProfile, CompatibilityHistory, isExternalPhotoUrl } from "../types";
import { walletService } from "../lib/walletService";
import { socialService } from "../lib/socialService";
import { reportService } from "../services/reportService";
import { toast } from "sonner";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, limit, onSnapshot, orderBy, serverTimestamp, addDoc, doc } from "firebase/firestore";
import { BlueTick } from "./BlueTick";

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
  const [showReportModal, setShowReportModal] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<CompatibilityHistory | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const activeUser = users[currentIndex];

  // DATA EXTRACTION & DEBUG LOG
  const gender = (activeUser?.gender || activeUser?.social?.gender || "unknown").toLowerCase();
  const isFemale = gender === 'female' || gender === 'kadin' || gender === 'kadın';
  const isMale = gender === 'male' || gender === 'erkek';
  const nickname = activeUser?.social?.nickname || activeUser?.displayName || "İsimsiz";
  
  const calculateAge = (bDay: string | null | undefined): number | null => {
    if (!bDay) return null;
    try {
      const birthDate = new Date(bDay);
      const ageDifMs = Date.now() - birthDate.getTime();
      const ageDate = new Date(ageDifMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970);
    } catch (e) { return null; }
  };
    const u = activeUser as any;
    const ageValue = u.social?.age || u.age || calculateAge(u.birthDate);
    const zodiacValue = u.social?.zodiacSign || u.zodiacSign || null;
    const levelValue = u.social?.level || u.level || null;
    const isVerifiedValue = u.social?.verified || u.isVerified || u.social?.verificationStatus === "approved";
    const bioValue = u.social?.bio || u.bio || null;
    const interestsValue = u.social?.interests || u.interests || [];
    const lookingForValue = u.social?.lookingFor || u.lookingFor || null;

  console.log("DISCOVER_POPUP_RENDER_FIELDS", {
    uid: activeUser?.uid,
    name: nickname,
    age: ageValue,
    birthDate: u.birthDate,
    zodiac: zodiacValue,
    level: levelValue,
    verified: isVerifiedValue,
    bio: bioValue,
    interests: interestsValue
  });

  const photos = activeUser?.social?.photos || [];
  const currentUid = currentUser.uid;
  const targetUid = activeUser?.uid;

  const [compatPrice, setCompatPrice] = useState(25);
  
  const boostTime = activeUser?.boostExpiresAt ? new Date(activeUser.boostExpiresAt).getTime() : 0;
  const isBoosted = boostTime > Date.now();

  useEffect(() => {
    walletService.getAdminConfig().then(config => {
      setCompatPrice(config.socialRightsPrices.compatibility);
    });
  }, []);

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
  }, [currentIndex, targetUid, currentUid]);

  const checkExistingAnalysis = async (uid: string) => {
    try {
      // 1. Check for the latest CompatibilityHistory
    const q = query(
        collection(db, "compatibilityHistory"),
        where("userId", "==", currentUid),
        where("targetUserId", "==", uid)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        // Sort in memory to avoid complex composite index requirement
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as CompatibilityHistory));
        docs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        const data = docs[0];
        
        // Deciding if it's locked or revealed
        const unlockTime = (data as any).unlockAt ? new Date((data as any).unlockAt).getTime() : 0;
        const isTimeLocked = !!unlockTime && unlockTime > Date.now();
        const isActuallyRevealed = data.revealed === true || 
                                   data.status === 'revealed' || 
                                   data.status === 'completed' ||
                                   (!data.unlockAt && !isTimeLocked);

        if (isTimeLocked && !isActuallyRevealed) {
          setIsPending(true);
          setPendingRequestId(data.id);
          setAnalysisResult(null);
        } else {
          setAnalysisResult(data);
          setIsPending(false);
          setPendingRequestId(null);
        }
      }
    } catch (err) {
      console.error("Check analysis error:", err);
    }
  };

  // Listen to the specific pending record if exists
  useEffect(() => {
    if (!pendingRequestId || !currentUid) return;

    const unsub = onSnapshot(doc(db, "compatibilityHistory", pendingRequestId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as CompatibilityHistory;
        
        const unlockTime = (data as any).unlockAt ? new Date((data as any).unlockAt).getTime() : 0;
        const isTimeLocked = !!unlockTime && unlockTime > Date.now();
        
        if (!isTimeLocked || data.revealed === true) {
          setAnalysisResult(data);
          setIsPending(false);
          setPendingRequestId(null);
          toast.success("Uyum analiziniz hazır! ✨");
        }
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
    
    // Secure logic: Check rights or coins
    const hasRights = (currentUser.compatibilityCount || 0) > 0;
    
    if (!hasRights && (currentUser.mainCoins || 0) < compatPrice) {
      toast.info(`Yetersiz Jeton. Uyum analizi için ${compatPrice} J gerekli.`, {
        description: "Cüzdan sayfasına yönlendiriliyorsunuz..."
      });
      onNavigate('wallet');
      return;
    }

    setIsAnalyzing(true);
    try {
      // SECURE CALL: Triggers cloud function for analysis and handles payment
      const result = await walletService.runCompatibilityAnalysis(targetUid, "compatibility");
      
      if (result.success) {
        if (result.cached && result.analysis) {
          setAnalysisResult(result.analysis);
          toast.success("Yıldızlar senin için zaten bakmış! Mevcut analiz getirildi. ✨");
        } else {
          setIsPending(true);
          setPendingRequestId(result.requestId || null);
          toast.success("Uyum analizin hazırlanıyor! Yıldızlar hesaplanıyor... ✨");
        }
      } else {
        toast.error("Analiz başlatılamadı. Lütfen bakiye kontrolü yapın.");
      }

    } catch (error: any) {
      console.error("Analysis request error:", error);
      toast.error(error.message || "Talep başlatılamadı.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // BUTTON B: Priority Message (50 Credit)
  const handlePriorityMessage = async () => {
    if (isMessaging || !targetUid) return;
    
    // Check balance (approximate)
    if (currentUser.mainCoins < 50) {
      toast.info("Yetersiz Kredi (50 J gerekli).");
      onNavigate('wallet');
      return;
    }

    setIsMessaging(true);
    
    try {
      const result = await socialService.sendPriorityMessageRequest(targetUid);
      
      if (result === 'SUCCESS') {
        toast.success("Mesajın en üste taşındı 💌");
        if (activeUser?.social?.isOnline) {
          setTimeout(() => {
            toast.success("Şu an aktif, hemen görme ihtimali yüksek");
          }, 600);
        }
        onClose();
      } else if (result === 'ALREADY_REQUESTED') {
        toast.info("Bu kullanıcıya zaten bir istek gönderilmiş.");
      } else if (result === 'INSUFFICIENT_FUNDS') {
        toast.info("Bakiye yetersiz.");
        onNavigate('wallet');
      } else {
        toast.error("İstek gönderilemedi.");
      }
    } catch (err) {
      console.error("Priority message error:", err);
      toast.error("İstek gönderilirken hata oluştu.");
    } finally {
      setIsMessaging(false);
    }
  };

  const handleReport = async (reason: string) => {
    if (!activeUser) return;
    try {
      await reportService.reportUser({
        reportedUserId: activeUser.uid,
        source: 'discover',
        reason: reason,
        description: "Keşfet profili üzerinden raporlandı.",
        metadata: { activeUserId: activeUser.uid }
      });
      setShowReportModal(false);
    } catch (error) {
      console.error("Report error:", error);
    }
  };

  // BUTTON C: Free Like (OPTIMISTIC)
  const handleFreeLike = async () => {
    if (isLiking || hasLikedOptimistic || !targetUid) return;
    
    const remaining = currentUser.social?.discoverLikesRemaining ?? 15;
    
    if (remaining <= 0) {
      toast.info("Bugünkü beğeni hakkın bitti! 🌙", {
        description: "Yarın tekrar deneyebilirsin."
      });
      return;
    }

    // OPTIMISTIC UPDATE: Mark as liked immediately
    setHasLikedOptimistic(true);
    setIsLiking(true);

    try {
      // 1. Consume from Firestore
      const consumed = await socialService.consumeDiscoverLike(currentUid, remaining);
      
      if (!consumed) {
        setHasLikedOptimistic(false);
        setIsLiking(false);
        return;
      }

      // 2. Async call to social backend
      socialService.sendLike(currentUser, targetUid, 'like', 'discover')
        .then(result => {
          if (result === 'SUCCESS') {
            toast.success(`${activeUser.social?.nickname} beğenildi! 👍`);
          } else if (result === 'DISCOVER_LIMIT_REACHED') {
            setHasLikedOptimistic(false);
            toast.error("Keşfet beğeni limitin doldu!");
          } else {
            setHasLikedOptimistic(false); // Revert if failed
            if (result === 'DAILY_LIMIT_REACHED') toast.error("Günlük beğeni limitin doldu.");
            else toast.error("Bir hata oluştu.");
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
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
      />

      {/* POPUP CARD */}
      <motion.div 
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-lg h-[85vh] bg-white rounded-[2.5rem] shadow-xl overflow-hidden flex flex-col"
      >
        {/* CLOSE, REPORT & NAV BUTTONS */}
        <div className="absolute top-6 inset-x-6 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="w-10 h-10 bg-white/40 backdrop-blur-sm rounded-2xl flex items-center justify-center text-slate-800 shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowReportModal(true)}
              className="w-10 h-10 bg-white/40 backdrop-blur-sm rounded-2xl flex items-center justify-center text-rose-500 shadow-sm"
            >
              <Flag className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              disabled={currentIndex === 0}
              onClick={handlePrev}
              className="w-10 h-10 bg-white/40 backdrop-blur-sm rounded-2xl flex items-center justify-center text-slate-800 shadow-sm disabled:opacity-30"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              disabled={currentIndex === users.length - 1}
              onClick={handleNext}
              className="w-10 h-10 bg-white/40 backdrop-blur-sm rounded-2xl flex items-center justify-center text-slate-800 shadow-sm disabled:opacity-30"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE AREA */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {/* PHOTO SECTION */}
          <div className="relative aspect-[4/5] bg-slate-100">
            <img 
              key={`${targetUid}-${photoIndex}`}
              src={photos[photoIndex] || (!isExternalPhotoUrl(activeUser.photoURL) ? activeUser.photoURL : "") || `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetUid}`} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />

            {/* PHOTO NAV DOTS */}
            <div className="absolute bottom-6 inset-x-6 flex gap-1.5 pointer-events-none">
              {photos.map((_, i) => (
                <div key={i} className={`h-1 flex-1 rounded-full bg-white transition-opacity ${i === photoIndex ? 'opacity-100' : 'opacity-30'}`} />
              ))}
            </div>

            {/* ONLINE INDICATOR */}
            {activeUser.social?.isOnline && (
              <div className="absolute top-20 right-6 flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">AKTİF</span>
              </div>
            )}
          </div>

          {/* CONTENT SECTION (PROFILE PANEL) */}
          <div className="p-8 pb-32 space-y-6 bg-white rounded-t-[3rem] -mt-10 relative z-10 border-t border-slate-50 shadow-sm">
            {/* NAME & AGE PANEL */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-4xl font-black tracking-tighter text-slate-900">
                  {nickname}{ageValue ? `, ` : ''}
                  {ageValue && <span className="text-amber-500">{ageValue}</span>}
                </h2>
                {isVerifiedValue && <BlueTick size={24} />}
                {isBoosted && (
                  <div className="flex items-center gap-1 bg-amber-500 px-2 py-0.5 rounded-lg shadow-sm">
                    <Zap className="w-3 h-3 text-white fill-white" />
                    <span className="text-white text-[10px] font-black uppercase tracking-wider">Öne Çıkan</span>
                  </div>
                )}
                {levelValue && (
                  <div className="bg-indigo-600 px-3 py-1 rounded-xl shadow-sm">
                    <span className="text-white text-[10px] font-black uppercase">Lv.{levelValue}</span>
                  </div>
                )}
                <div className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase ${isFemale ? 'bg-rose-100 text-rose-500' : isMale ? 'bg-indigo-100 text-indigo-500' : 'bg-slate-100 text-slate-500'}`}>
                  {isFemale ? 'Kadın' : isMale ? 'Erkek' : 'Ruh'}
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                {lookingForValue && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-indigo-500" /> {lookingForValue}
                  </p>
                )}
                {zodiacValue && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Star className="w-3.5 h-3.5 text-amber-400" /> {zodiacValue}
                  </p>
                )}
                {activeUser?.social?.isOnline && (
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Aktif
                  </p>
                )}
              </div>
            </div>

            {/* BIO */}
            {bioValue && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-3 bg-amber-400 rounded-full" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ruhun Hikayesi</h3>
                </div>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  "{bioValue}"
                </p>
              </div>
            )}

            {/* INTERESTS */}
            {interestsValue.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-3">İlgi Alanları</h3>
                <div className="flex flex-wrap gap-2">
                  {interestsValue.slice(0, 5).map((tag: string) => (
                    <span key={tag} className="px-4 py-2 bg-white border border-slate-100 shadow-sm rounded-2xl text-[11px] font-bold text-slate-600">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* COSMIC STATS - AURA */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Aura</span>
                </div>
                <p className="text-sm font-black text-slate-800">Uyumlu Mavi</p>
              </div>
            </div>

            {/* COMPATIBILITY RESULT */}
            {analysisResult && (
              <div className="p-6 bg-gradient-to-br from-amber-50 to-rose-50 border border-amber-100 rounded-[2rem] space-y-4">
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
              </div>
            )}

            {isPending && (
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col items-center gap-3">
                <Clock className="w-6 h-6 text-indigo-500 animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Analiz Kozmik Güçler Tarafından Hazırlandı.<br/>5 Dakika İçinde Açılacak!</p>
                <button 
                  onClick={() => onNavigate('history')}
                  className="mt-2 text-[9px] font-black text-indigo-600 underline uppercase tracking-tighter"
                >
                  Hızlandır veya Tarihçeye Git
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ACTION BAR */}
        <div className="absolute bottom-0 inset-x-0 p-6 bg-white/60 backdrop-blur-sm border-t border-slate-50 z-[60]">
          <div className="grid grid-cols-3 gap-3">
            {/* BUTTON A: Analiz */}
            <button 
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
                {isAnalyzing ? 'Taranıyor...' : 
                 (currentUser.compatibilityCount || 0) > 0 ? 'UYUM GÖR (1 Hak)' : `UYUM ANALİZİ (${compatPrice} J)`}
              </span>
            </button>

            {/* BUTTON B: Priority Message */}
            <button 
              onClick={handlePriorityMessage}
              disabled={isMessaging}
              className="flex flex-col items-center justify-center p-3 bg-slate-900 border border-slate-800 rounded-3xl gap-1 text-white shadow-md shadow-slate-900/5 disabled:opacity-80 transition-transform active:scale-[0.98] relative overflow-hidden group"
            >
              {isMessaging && (
                 <motion.div 
                    initial={{ left: '-100%' }}
                    animate={{ left: '200%' }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 bottom-0 w-1/3 bg-white/10 skew-x-12 z-10"
                 />
              )}
              {isMessaging ? (
                <Loader2 className="w-5 h-5 animate-spin text-amber-400 relative z-20" />
              ) : (
                <Zap className="w-5 h-5 text-amber-400 fill-amber-400 relative z-20 group-hover:scale-110 transition-transform" />
              )}
              <div className="flex flex-col items-center relative z-20 text-center">
                <span className="text-[8px] font-black tracking-tighter uppercase">
                  {isMessaging ? 'Gidiyor...' : 'ÖNCELİKLİ MESAJ İSTEĞİ (50 J)'}
                </span>
                <span className="text-[6px] text-amber-400/80 uppercase tracking-widest mt-0.5">
                  Mesajın karşı tarafın en üstünde görünür
                </span>
              </div>
            </button>

            {/* BUTTON C: Free Like */}
            <button 
              onClick={handleFreeLike}
              disabled={isLiking || hasLikedOptimistic}
              className={`flex flex-col items-center justify-center p-3 rounded-3xl gap-1 transition-all border active:scale-[0.98] ${
                hasLikedOptimistic 
                  ? 'bg-emerald-500 text-white border-emerald-500' 
                  : (currentUser.social?.discoverLikesRemaining ?? 15) <= 0
                    ? 'bg-slate-50 text-slate-300 border-slate-100'
                    : 'bg-slate-50 text-emerald-500 border-slate-100'
              }`}
            >
              {hasLikedOptimistic ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : isLiking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Star className={`w-5 h-5 ${(currentUser.social?.discoverLikesRemaining ?? 15) <= 0 ? 'fill-slate-300' : 'fill-current'}`} />
              )}
              <span className="text-[8px] font-black tracking-tighter uppercase">
                {hasLikedOptimistic 
                  ? 'BEĞENİLDİ' 
                  : isLiking 
                    ? '...' 
                    : (currentUser.social?.discoverLikesRemaining ?? 15) <= 0
                      ? 'Beğeni Hakkın Bitti'
                      : `Ücretsiz Beğen (${currentUser.social?.discoverLikesRemaining ?? 15})`}
              </span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* REPORT MODAL */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[200000] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full max-w-xs bg-white rounded-[2.5rem] overflow-hidden shadow-xl"
            >
              <div className="p-8 text-center border-b border-black/5">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Güven Bölgesi</h3>
                <p className="text-xs text-slate-500 mt-2 font-medium">Bu profilde seni rahatsız eden nedir?</p>
              </div>
              <div className="p-3">
                {['Spam / Sahte', 'Uygunsuz İçerik', 'Rahatsız Edici', 'Diğer'].map((reason) => (
                  <button 
                    key={reason} 
                    onClick={() => handleReport(reason)} 
                    className="w-full px-6 py-4 text-left text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors rounded-2xl flex items-center justify-between group"
                  >
                    {reason}
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-all" />
                  </button>
                ))}
              </div>
              <button 
                onClick={() => setShowReportModal(false)} 
                className="w-full py-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-slate-900 transition-colors bg-slate-50"
              >
                VAZGEÇ
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
