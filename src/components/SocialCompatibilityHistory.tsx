import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronLeft, 
  Sparkles, 
  Heart, 
  Users, 
  Zap, 
  Trash2,
  Calendar,
  ChevronRight,
  Search,
  User,
  HeartHandshake,
  Camera,
  PlusCircle,
  Clock,
  Loader2,
  FastForward,
  TrendingUp,
  Ghost
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc,
  limit,
  onSnapshot,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { uploadPhoto } from '../lib/uploadService';
import { UserProfile, CompatibilityHistory } from '../types';
import { toSafeDate, isoToDisplayDate, validateBirthDate } from '../lib/dateUtils';
import { toast } from 'sonner';
import BirthDateInput from './BirthDateInput';
import { walletService } from '../lib/walletService';

interface SocialCompatibilityHistoryProps {
  currentUser: UserProfile;
  onBack: () => void;
  isTab?: boolean;
  isActive?: boolean;
  isMock?: boolean;
}

export default function SocialCompatibilityHistory({ currentUser, onBack, isTab, isActive, isMock }: SocialCompatibilityHistoryProps) {
  const uid = currentUser?.uid || "";

  const [history, setHistory] = useState<CompatibilityHistory[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(!isMock);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<CompatibilityHistory | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSpeedingUp, setIsSpeedingUp] = useState<string | null>(null);
  const [speedUpPrice, setSpeedUpPrice] = useState(10);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [activeChats, setActiveChats] = useState<string[]>([]);

  // Discover if we have active chats or sent requests with these targets
  useEffect(() => {
    if (!uid) return;
    const fetchRelations = async () => {
      try {
        const reqSnap = await getDocs(query(collection(db, "interactionRequests"), where("fromUserId", "==", uid)));
        setSentRequests(reqSnap.docs.map(d => d.data().toUserId));

        const chatSnap = await getDocs(query(collection(db, "chats"), where("participants", "array-contains", uid)));
        const chatUsers: string[] = [];
        chatSnap.docs.forEach(d => {
           const data = d.data();
           if (data.participants) {
             const otherId = data.participants.find((p: string) => p !== uid);
             if (otherId) chatUsers.push(otherId);
           }
        });
        setActiveChats(chatUsers);
      } catch (e) {
        console.error("fetchRelations error:", e);
      }
    };
    fetchRelations();
  }, [uid]);

  // Load price from admin config
  useEffect(() => {
    walletService.getAdminConfig().then(config => {
      if (config.socialRightsPrices.speedUpPrice) {
        setSpeedUpPrice(config.socialRightsPrices.speedUpPrice);
      }
    });
  }, []);

  // 1. Real-time Listeners for Completed Analyses
  useEffect(() => {
    if (!uid || !isActive) return;

    const q = query(
      collection(db, "compatibilityHistory"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(200) // Fallback via in-memory sorting
    );

    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompatibilityHistory));
      items.sort((a, b) => toSafeDate(b.createdAt).getTime() - toSafeDate(a.createdAt).getTime());
      setHistory(items);
      setLoading(false);
    }, (err) => {
      console.error("History listener error:", err);
      // Fallback
      setLoading(false);
    });

    return () => unsub();
  }, [uid, isActive]);

  // Listen for smart open event
  useEffect(() => {
    const handleOpenDetails = (e: CustomEvent) => {
      const analysisId = e.detail?.id;
      if (analysisId) {
        const item = history.find(h => h.id === analysisId);
        if (item) {
          setSelectedAnalysis(item);
        }
      }
    };

    window.addEventListener('open-compatibility-details', handleOpenDetails as EventListener);
    return () => {
      window.removeEventListener('open-compatibility-details', handleOpenDetails as EventListener);
    };
  }, [history]);

  // 2. Real-time Listeners for Pending Requests - DEPRECATED in favor of unified history
  useEffect(() => {
    // Keep empty or remove to clean up
    setPendingRequests([]);
  }, [uid, isActive]);

  // Unified Form State
  const [person1] = useState({ 
    name: currentUser?.social?.nickname || 'Ben', 
    birthDate: currentUser?.birthDate || '', 
    photo: currentUser?.social?.photos?.[0] || 'https://api.dicebear.com/7.x/avataaars/svg?seed=me' 
  });
  const [person2, setPerson2] = useState({ name: '', birthDate: '', photo: '' });
  const [relationshipType, setRelationshipType] = useState('ask');

  const relationshipTypes = [
    { id: 'ask', label: 'Aşk' },
    { id: 'arkadas', label: 'Arkadaş' },
    { id: 'flirt', label: 'Flört' },
    { id: 'platonik', label: 'Platonik' },
    { id: 'gorucu_usulu', label: 'Görücü Usulü' },
    { id: 'eski_sevgili', label: 'Eski Sevgili' },
    { id: 'karsiliksiz_sevgi', label: 'Karşılıksız Sevgi' },
    { id: 'evlilik_adayi', label: 'Evlilik Adayı' }
  ];

  const handleManualAnalysis = async () => {
    if (!person2.name || !person2.birthDate || !person2.photo) {
      toast.error("Lütfen karşı tarafın bilgilerini eksiksiz doldurun.");
      return;
    }

    const displayDate = isoToDisplayDate(person2.birthDate);
    const validation = validateBirthDate(displayDate);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    const compatPrice = 25; // Standard price from walletService config
    const hasRights = (currentUser.compatibilityCount || 0) > 0;
    const hasCoins = (currentUser.mainCoins || 0) >= compatPrice;

    if (!hasRights && !hasCoins) {
      toast.info(`Yetersiz Analiz Hakkı. Uyum analizi için ${compatPrice} J veya 1 Hak gerekli.`, {
        description: "Mağazaya göz atabilirsiniz."
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await walletService.runManualCompatibilityAnalysis({
        person1,
        person2,
        relationshipType
      });

      if (result.success) {
        toast.success("Kozmik analiz süreci başladı! ✨");
        setPerson2({ name: '', birthDate: '', photo: '' });
      } else {
        const code = result.code || result.status;
        const msg = result.message || "";
        
        if (code === 'INSUFFICIENT_FUNDS' || code === 'insufficient-funds' || code === 'failed-precondition' && msg.includes('bakiye')) {
          toast.error("Bakiyeniz yetersiz. Lütfen J-Coin veya Analiz Hakkı yükleyin.");
        } else if (code === 'QUOTA_EXCEEDED' || code === 'resource-exhausted') {
          toast.error("AI servis kotası dolu. Lütfen daha sonra tekrar deneyin.");
        } else if (code === 'internal' || code === 'functions/internal') {
          toast.error("Sunucu hatası oluştu. Lütfen tekrar deneyin.");
        } else if (code === 'permission-denied') {
          toast.error("Bu işlem için yetkiniz yok.");
        } else {
          toast.error(msg || "Analiz başlatılamadı. Lütfen tekrar deneyin.");
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Analiz sırasında bir hata oluştu.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSpeedUp = async (requestId: string) => {
    if (isSpeedingUp) return;
    
    if (currentUser.mainCoins < speedUpPrice) {
      toast.info(`Hızlandırıcı için ${speedUpPrice} J gerekli. Cüzdana gidiliyor...`);
      return;
    }

    setIsSpeedingUp(requestId);
    try {
      const result = await walletService.speedUpCompatibilityAnalysis(requestId);
      if (result.success) {
        toast.success("Kozmik Hızlandırıcı aktif! Analiz saniyeler içinde hazır. ⚡️");
      } else {
        toast.error(result.message || "Hızlandırma başarısız.");
      }
    } catch (err) {
      toast.error("Bir hata oluştu.");
    } finally {
      setIsSpeedingUp(null);
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const handlePhotoUpload = () => fileInputRef.current?.click();

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Dosya boyutu 5MB'dan küçük olmalıdır.");
      return;
    }
    
    setIsUploadingPhoto(true);
    try {
      const url = await uploadPhoto(file, uid);
      setPerson2(prev => ({ ...prev, photo: url }));
    } catch (error) {
      toast.error("Fotoğraf yüklenemedi. Lütfen tekrar deneyin.");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const mergedList = useMemo(() => {
    const filtered = history.filter(item => {
      const name = item.targetName || item.person2?.name || "";
      return name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    return filtered.sort((a, b) => toSafeDate(b.createdAt).getTime() - toSafeDate(a.createdAt).getTime());
  }, [history, searchTerm]);

  return (
    <div className={`${isTab ? 'h-full' : 'fixed inset-0 z-[60]'} bg-[#F8F9FD] flex flex-col pt-[calc(env(safe-area-inset-top,1rem)+64px)]`}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange} />

      {/* Header */}
      {!isTab && (
        <div className="px-6 pt-12 pb-4 bg-white/60 backdrop-blur-sm border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-900 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Kozmik Uyum</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Frekans Arşivi & Laboratuvar</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
            <Zap className="w-5 h-5 text-indigo-600 fill-indigo-600" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {/* LABORATORY FORM */}
        <div className="px-2 py-6 sm:px-4 sm:py-8">
          <div className="bg-white rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-8 border border-slate-100 shadow-lg shadow-indigo-900/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-rose-500/5 blur-[80px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-10 sm:space-y-12">
              <div className="flex items-center justify-between sm:justify-center gap-2 sm:gap-8">
                {/* Person 1 (Self) */}
                <div className="flex flex-col items-center gap-3 sm:gap-4 flex-1">
                  <div className="relative w-24 sm:w-32 aspect-[3/4] rounded-[2rem] sm:rounded-[2.5rem] bg-slate-50 border border-slate-100 overflow-hidden shadow-md w-full max-w-[128px]">
                    <img src={person1.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-x-0 bottom-0 py-2 bg-black/20 backdrop-blur-sm text-white text-[8px] sm:text-[9px] font-black uppercase text-center tracking-widest">SEN</div>
                  </div>
                  <div className="w-full max-w-[128px] text-center space-y-1 px-1">
                    <div className="text-[10px] sm:text-[11px] font-black text-slate-900 uppercase truncate w-full">{person1.name}</div>
                    <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 truncate">{person1.birthDate || "Belirtilmedi"}</div>
                  </div>
                </div>

                {/* HEART BRIDGE */}
                <div className="flex flex-col items-center gap-2 sm:gap-4 shrink-0 px-1">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white shadow-md flex items-center justify-center border border-slate-50 relative z-10"
                  >
                    <Heart className="w-5 h-5 sm:w-7 sm:h-7 text-rose-500 fill-rose-500" />
                  </motion.div>
                  <div className="h-16 sm:h-24 w-px bg-gradient-to-b from-indigo-200 via-rose-200 to-amber-200" />
                </div>

                {/* Person 2 (Target) */}
                <div className="flex flex-col items-center gap-3 sm:gap-4 flex-1">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="relative w-24 sm:w-32 aspect-[3/4] rounded-[2rem] sm:rounded-[2.5rem] bg-slate-50 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-xl hover:border-rose-300 transition-colors w-full max-w-[128px]"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-indigo-500 animate-spin" />
                    ) : person2.photo ? (
                      <img src={person2.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 sm:gap-2 opacity-30">
                        <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-slate-500" />
                        <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter text-center px-2">O'NUN FOTO</span>
                      </div>
                    )}
                  </motion.button>
                  <div className="w-full max-w-[128px] space-y-1 sm:space-y-2 px-1">
                    <div className="border-b border-slate-200 py-[2px] sm:py-1">
                      <input 
                        type="text" 
                        value={person2.name}
                        onChange={(e) => setPerson2(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="İSMİ?"
                        className="w-full bg-transparent text-[10px] sm:text-[11px] font-black text-slate-900 border-none focus:ring-0 p-0 placeholder:text-slate-300 text-center uppercase tracking-tight"
                      />
                    </div>
                    <div className="border-b border-slate-200 py-[2px] sm:py-1 relative">
                      <BirthDateInput 
                        value={person2.birthDate}
                        onChange={(val) => setPerson2(prev => ({ ...prev, birthDate: val }))}
                        className="!bg-transparent border-none focus:ring-0 p-0 text-center tracking-widest uppercase !h-auto !py-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center gap-2">
                {relationshipTypes.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setRelationshipType(type.id)}
                    className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                      relationshipType === type.id 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xl' 
                        : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>

              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={handleManualAnalysis}
                disabled={isAnalyzing}
                className={`w-full py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all ${
                  isAnalyzing 
                    ? 'bg-slate-100 text-slate-300 shadow-none' 
                    : 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                }`}
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {isAnalyzing ? 'KODLAR OKUNUYOR...' : `ANALİZ ET (${currentUser.compatibilityCount})`}
              </motion.button>
            </div>
          </div>
        </div>

        {/* HISTORY LIST */}
        <div className="px-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> Frekans Arşivi
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300" />
              <input 
                type="text" 
                placeholder="İSİM ARA..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white border border-slate-100 rounded-2xl text-[10px] font-black focus:outline-none focus:ring-4 focus:ring-indigo-500/5 w-32 transition-all focus:w-44"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : mergedList.length === 0 ? (
              <div className="text-center py-20 opacity-20">
                <Ghost className="w-12 h-12 mx-auto mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Henüz bir veri yok</p>
              </div>
            ) : (
              mergedList.map((item: any) => (
                <HistoryCard 
                  key={item.id} 
                  item={item} 
                  speedUpPrice={speedUpPrice}
                  onSpeedUp={handleSpeedUp}
                  isSpeedingUp={isSpeedingUp === item.id}
                  onClick={() => !item.isPending && setSelectedAnalysis(item)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedAnalysis && (
          <AnalysisPopup 
            analysis={selectedAnalysis} 
            onClose={() => setSelectedAnalysis(null)} 
            currentUser={currentUser}
            sentRequests={sentRequests}
            activeChats={activeChats}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function HistoryCard({ item, onClick, speedUpPrice, onSpeedUp, isSpeedingUp }: any) {
  const [timeLeft, setTimeLeft] = useState("");
  const [now, setNow] = useState(Date.now());

  // Decide if revealed - Hardened check for retro-compatibility
  const unlockTime = item.unlockAt ? new Date(item.unlockAt).getTime() : 0;
  const isTimeLocked = !!unlockTime && unlockTime > now;

  const isActuallyRevealed = item.revealed === true || 
                             item.status === 'revealed' || 
                             item.status === 'completed' ||
                             (!item.unlockAt && !item.targetUserId) ||
                             (!!unlockTime && !isTimeLocked);

  useEffect(() => {
    if (!isTimeLocked) return;
    
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimeLocked]);

  useEffect(() => {
    if (!isTimeLocked) {
      if (unlockTime > 0) setTimeLeft("Hazır!");
      return;
    }
    
    const diff = unlockTime - now;
    if (diff <= 0) {
      setTimeLeft("Hazır!");
    } else {
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    }
  }, [isTimeLocked, unlockTime, now]);

  const person2Name = item.targetName || item.person2?.name || "Bilinmiyor";
  
  const isLasyaProfile = item.source === 'discover' && !!item.targetUserId;

  const showLock = isTimeLocked && !isActuallyRevealed;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={!showLock ? onClick : undefined}
      className={`relative p-4 rounded-[2rem] border transition-all overflow-hidden ${
        showLock
          ? 'bg-slate-50 border-slate-100 cursor-default' 
          : 'bg-white border-white shadow-sm hover:shadow-md hover:border-slate-100 cursor-pointer group'
      }`}
    >
      <div className="flex items-center gap-4 relative z-10">
        <div className="flex -space-x-3">
          <div className="w-12 h-12 rounded-2xl border-2 border-white shadow-md overflow-hidden relative z-10">
            <img src={item.person1?.photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'} className="w-full h-full object-cover" />
          </div>
          <div className="w-12 h-12 rounded-2xl border-2 border-white shadow-md overflow-hidden relative z-20">
            <img src={item.targetPhoto || item.person2?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.targetUserId || person2Name}`} className="w-full h-full object-cover" />
            {showLock && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h4 className="text-[11px] font-black text-slate-900 truncate uppercase tracking-tighter">
                {item.person1?.name || 'Sen'} & {person2Name}
              </h4>
              {isLasyaProfile && (
                <div className="flex items-center justify-center p-0.5 rounded-full bg-gradient-to-r from-purple-500 to-amber-500" title="Lasya Profili">
                  <Sparkles className="w-2.5 h-2.5 text-white" />
                </div>
              )}
            </div>
            {isActuallyRevealed && (
              <div className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-lg text-[9px] font-black">%{item.loveScore}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              {toSafeDate(item.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
            </span>
            <div className="w-1 h-1 rounded-full bg-slate-200" />
            <span className="text-[8px] font-bold text-slate-400 italic truncate max-w-[120px]">
              {showLock ? 'Kozmik Enerjiler Hizalanıyor...' : item.summaryShort}
            </span>
          </div>
        </div>

        {showLock && (
          <div className="flex flex-col items-end gap-1.5 min-w-[70px]">
            <div className="px-2 py-1 bg-indigo-500 text-white rounded-lg text-[9px] font-black flex items-center gap-1.5 shadow-lg shadow-indigo-500/20">
              <Clock className="w-3 h-3" />
              {timeLeft}
            </div>
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onSpeedUp(item.id); }}
              disabled={isSpeedingUp || timeLeft === "Hazır!"}
              className="px-2 py-1 bg-amber-400 hover:bg-amber-500 text-white rounded-lg text-[8px] font-black flex items-center gap-1 shadow-lg shadow-amber-400/20 uppercase tracking-tighter disabled:opacity-50"
            >
              <FastForward className="w-2.5 h-2.5" />
              {isSpeedingUp ? '...' : `HIZLANDIR (${speedUpPrice} J)`}
            </motion.button>
          </div>
        )}
      </div>

      {isActuallyRevealed && (
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
      )}
    </motion.div>
  );
}

function AnalysisPopup({ 
  analysis, 
  onClose,
  currentUser,
  sentRequests,
  activeChats
}: { 
  analysis: CompatibilityHistory, 
  onClose: () => void,
  currentUser: UserProfile,
  sentRequests: string[],
  activeChats: string[]
}) {
  const person2Name = analysis.targetName || analysis.person2?.name || "Bilinmiyor";
  const person2Photo = analysis.targetPhoto || analysis.person2?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${analysis.targetUserId || person2Name}`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-slate-900">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.98, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 12 }}
        className="relative w-full max-w-sm bg-white rounded-[3.5rem] overflow-hidden shadow-xl flex flex-col max-h-[90vh]"
      >
        <div className="relative h-64 flex shrink-0">
          <div className="w-1/2 h-full relative">
            <img src={analysis.person1?.photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 py-2 bg-black/40 backdrop-blur-md text-white text-[8px] font-black text-center tracking-widest truncate px-2">{analysis.person1?.name || "SEN"}</div>
          </div>
          <div className="w-1/2 h-full relative">
            <img src={person2Photo} className="w-full h-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 py-2 bg-black/40 backdrop-blur-md text-white text-[8px] font-black text-center tracking-widest uppercase truncate px-2">{person2Name}</div>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0, delay: 0.2 }}
              className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center border-2 border-rose-50 relative z-10"
            >
              <Heart className="w-8 h-8 text-rose-500 fill-rose-500" />
              <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-0 rounded-full border-2 border-rose-500" />
            </motion.div>
          </div>
          
          <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 bg-white/20 backdrop-blur-xl border border-white/40 rounded-full flex items-center justify-center text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto no-scrollbar pb-12">
          <div className="text-center space-y-2">
            <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter shrink-0">İkili Frekans Raporu</h3>
          </div>

          <div className="grid grid-cols-3 gap-2 md:gap-6 shrink-0 shrink">
            {[
              { label: 'AŞK', val: analysis.loveScore || 0, color: '#F43F5E', icon: Heart },
              { label: 'DOSTLUK', val: analysis.friendshipScore || 0, color: '#6366F1', icon: Users },
              { label: 'ENERJİ', val: analysis.energyScore || 0, color: '#F59E0B', icon: Sparkles }
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2 md:gap-3">
                <div className="relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                    <motion.circle 
                      cx="50" cy="50" r="40" fill="none" stroke={s.color} strokeWidth="8" 
                      strokeDasharray="251.2" initial={{ strokeDashoffset: 251.2 }} animate={{ strokeDashoffset: 251.2 - (251.2 * s.val) / 100 }}
                      transition={{ duration: 2, delay: 0.5 + i * 0.2 }} strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[9px] md:text-[10px] font-black text-slate-900">%{s.val}</span>
                </div>
                <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="h-px bg-slate-100 shrink-0" />

          <div className="space-y-4 shrink-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Yıldızların Yorumu</h4>
            </div>
            <div className="p-4 md:p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative">
              <p className="text-sm font-black text-slate-900 leading-tight italic mb-3 opacity-90 text-center">
                "{analysis.summaryShort || "Enerjiler hesaplandı."}"
              </p>
              <p className="text-[10px] md:text-[11px] font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                {analysis.summaryLong || analysis.aiComment || "Yeni yorumlar hala göklerin derinliklerinde hazırlanıyor..."}
              </p>
            </div>
          </div>

          <div className="space-y-3 shrink-0">
            {analysis.source === "discover" && analysis.targetUserId && analysis.targetUserId !== currentUser.uid && (
              <div className="mb-4">
                {activeChats.includes(analysis.targetUserId) ? (
                  <button 
                    onClick={() => {
                      toast.info("Sohbetler sekmesinden mesajlaşabilirsiniz.");
                      onClose();
                    }}
                    className="w-full py-4 text-white rounded-2xl font-black text-[12px] uppercase tracking-wider bg-gradient-to-r from-purple-500 to-indigo-500 shadow-xl shadow-purple-500/20 mb-2"
                  >
                    Sohbete Git
                  </button>
                ) : sentRequests.includes(analysis.targetUserId) ? (
                  <button 
                    disabled
                    className="w-full py-4 text-slate-400 rounded-2xl font-black text-[12px] uppercase tracking-wider bg-slate-100 border border-slate-200 mb-2"
                  >
                    İstek Gönderildi
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      toast.success("Öncelikli mesaj isteği yakında aktif olacak!");
                    }}
                    className="w-full py-4 text-white rounded-2xl font-black text-[12px] uppercase tracking-wider bg-gradient-to-r from-amber-400 to-amber-600 shadow-xl shadow-amber-500/20 flex flex-col items-center justify-center gap-1 mb-2"
                  >
                    <span className="flex items-center gap-1"><Zap className="w-4 h-4" /> Öncelikli Mesaj İsteği Gönder</span>
                    <span className="text-[8px] font-bold text-amber-100 normal-case tracking-normal opacity-90">Mesajın karşı tarafın isteklerinde öne çıkar.</span>
                  </button>
                )}
              </div>
            )}
            <button onClick={onClose} className="w-full py-4 md:py-5 bg-slate-900 text-white rounded-2xl font-black text-[11px] md:text-[12px] uppercase tracking-[0.3em] shadow-xl">Anladım</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
