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
  Ghost,
  Flame,
  Orbit,
  Radio,
  MessageCircle,
  PenTool,
  Stars,
  Activity,
  Infinity as InfinityIcon
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
  const [customFocus, setCustomFocus] = useState('');
  const [pendingTextIndex, setPendingTextIndex] = useState(0);

  const pendingTexts = [
    "Frekans haritası oluşturuluyor...",
    "Travma örüntüleri okunuyor...",
    "İletişim dinamiği çözülüyor...",
    "Duygusal bağ analiz ediliyor...",
    "Karmik örüntüler hizalanıyor..."
  ];

  useEffect(() => {
    if (!isAnalyzing) {
      setPendingTextIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setPendingTextIndex(prev => (prev + 1) % pendingTexts.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const relationshipTypes = [
    { id: 'ask', label: 'Aşk & Flört', description: 'Çekim, merak ve duygusal bağın yönünü okur.', icon: Heart, labIcon: Sparkles },
    { id: 'evlilik', label: 'Evlilik Potansiyeli', description: 'Uzun vadeli uyum, denge ve gelecek ihtimalini yorumlar.', icon: Users, labIcon: HeartHandshake },
    { id: 'eski_sevgili', label: 'Eski Sevgili', description: 'Bitmemiş bağ, geri dönüş ve duygusal izleri inceler.', icon: Clock, labIcon: Clock },
    { id: 'takintili_bag', label: 'Takıntılı Bağ', description: 'Kim daha çok bağlanıyor, kim kaçıyor; gerilim alanını çözer.', icon: Zap, labIcon: InfinityIcon },
    { id: 'iletisim', label: 'İletişim Problemi', description: 'Suskunluk, yanlış anlaşılma ve kopuş sinyallerini okur.', icon: HeartHandshake, labIcon: Radio },
    { id: 'karmik_travma', label: 'Karmik / Travma Döngüsü', description: 'Tekrarlayan ilişki döngülerini ve tetiklenen duyguları inceler.', icon: Ghost, labIcon: Activity },
    { id: 'arkadaslik', label: 'Arkadaşlık', description: 'Güven, samimiyet ve uzun süreli bağ potansiyelini ölçer.', icon: User, labIcon: Orbit },
    { id: 'custom', label: 'Kendim Yazacağım', description: 'Analizin odağını sen belirle.', icon: PlusCircle, labIcon: Stars }
  ];

  const currentTypeData = useMemo(() => {
    return relationshipTypes.find(t => t.id === relationshipType) || relationshipTypes[0];
  }, [relationshipType]);

  const handleManualAnalysis = async () => {
    if (!person2.name || !person2.birthDate || !person2.photo) {
      toast.error("Lütfen karşı tarafın bilgilerini eksiksiz doldurun.");
      return;
    }

    if (relationshipType === 'custom' && customFocus.trim().length < 8) {
      toast.error("Analizin odak noktasını biraz daha detaylı yaz.");
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
      const payload: any = {
        person1,
        person2,
        relationshipType
      };
      if (relationshipType === 'custom') {
        payload.customFocus = customFocus.trim();
      }
      const result = await walletService.runManualCompatibilityAnalysis(payload);

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
    <div className={`${isTab ? 'h-full' : 'fixed inset-0 z-[60]'} bg-[#F8F7FB] flex flex-col pt-[calc(env(safe-area-inset-top,1rem)+64px)]`}>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onFileChange} />

      {/* Header */}
      {!isTab && (
        <div className="px-6 py-4 bg-white/60 backdrop-blur-md border-b border-slate-100 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-rose-500 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-lg font-black text-[#111827] tracking-tight">Uyumluluk Analizi</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frekans Arşivi</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center border border-rose-100/50 shadow-sm">
            <Sparkles className="w-5 h-5 text-rose-500 fill-rose-500/20" />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {/* HERO INFO AREA */}
        <div className="px-6 py-8 text-center space-y-3">
          <h1 className="text-xl sm:text-2xl font-black text-[#111827] tracking-tight">
            Bağ Dinamiği Analizi
          </h1>
          <p className="text-[11px] sm:text-xs text-[#6B7280] font-medium max-w-[280px] sm:max-w-md mx-auto leading-relaxed">
            İki kişi arasındaki çekim, uyum ve frekans <br className="hidden sm:block" /> dinamiğini yıldızların ışığında analiz et.
          </p>
        </div>

        {/* PREMIUM GAME-STYLE CARDS AREA */}
        <div className="px-4 py-2 sm:px-8">
          <div className="bg-white rounded-[3.5rem] p-8 sm:p-12 border border-slate-100 shadow-[0_40px_80px_-20px_rgba(244,63,94,0.1)] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/[0.04] blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/[0.04] blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-12">
              {/* Character Match Section */}
              <div className="flex items-start justify-center gap-4 sm:gap-16">
                {/* Person 1 Card (User) */}
                <div className="flex flex-col items-center gap-5 flex-1 max-w-[120px] sm:max-w-[180px]">
                  <div className="relative w-full aspect-[3/4] rounded-[2.5rem] sm:rounded-[3.5rem] bg-slate-50 border-4 border-white overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-slate-100 group transition-all duration-500">
                    <img src={person1.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                    <div className="absolute inset-x-0 bottom-0 py-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-[9px] font-black uppercase text-center tracking-[0.3em]">BEN</div>
                  </div>
                  <div className="w-full space-y-1.5 text-center px-1">
                    <div className="text-[14px] sm:text-[16px] font-black text-[#111827] truncate tracking-tight">{person1.name}</div>
                    <div className="bg-rose-50/50 rounded-full px-3 py-1 inline-block border border-rose-100/40">
                      <div className="text-[10px] sm:text-[12px] font-black text-rose-500 uppercase tracking-widest leading-none">{person1.birthDate || "Tarih Yok"}</div>
                    </div>
                  </div>
                </div>

                {/* CENTER CONNECT ICON */}
                <div className="flex flex-col items-center shrink-0 pt-16">
                  <div className="relative">
                    <motion.div 
                      key={relationshipType}
                      initial={{ scale: 0.8, opacity: 0, rotate: -15 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      className="w-12 h-12 sm:w-16 sm:h-16 rounded-3xl bg-white shadow-[0_15px_30px_-5px_rgba(0,0,0,0.1)] flex items-center justify-center border border-slate-50 relative z-10 rotate-3"
                    >
                      {React.createElement(currentTypeData.icon || Heart, { 
                        className: "w-6 h-6 sm:w-8 sm:h-8 text-rose-500 fill-rose-500/10" 
                      })}
                      <motion.div 
                        animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0, 0.15] }}
                        transition={{ duration: 4, repeat: Infinity }}
                        className="absolute inset-0 rounded-3xl border-2 border-rose-200"
                      />
                    </motion.div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-rose-200 to-transparent mt-2 opacity-50" />
                  </div>
                </div>

                {/* Person 2 Card (Target) */}
                <div className="flex flex-col items-center gap-5 flex-1 max-w-[120px] sm:max-w-[180px]">
                  <motion.button 
                    whileTap={{ scale: 0.96 }}
                    onClick={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="relative w-full aspect-[3/4] rounded-[2.5rem] sm:rounded-[3.5rem] bg-slate-50 border-4 border-white flex items-center justify-center overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] ring-1 ring-slate-100 group transition-all duration-500"
                  >
                    {isUploadingPhoto ? (
                      <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                    ) : person2.photo ? (
                      <img src={person2.photo} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-3 opacity-60 group-hover:opacity-100 transition-all group-hover:scale-110">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/50 border border-slate-200 flex items-center justify-center">
                          <Camera className="w-6 h-6 sm:w-8 sm:h-8 text-rose-400" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#111827]">FOTO EKLE</span>
                      </div>
                    )}
                    {!person2.photo && (
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/5" />
                    )}
                  </motion.button>

                  <div className="w-full space-y-2.5">
                    {/* Name Input Integrated Into Card Design */}
                    <div className="relative group/input">
                      <div className="absolute inset-0 bg-slate-50/50 rounded-2xl -z-10 group-focus-within/input:bg-rose-50/80 transition-colors border-2 border-transparent group-focus-within/input:border-rose-100 shadow-sm" />
                      <input 
                        type="text" 
                        value={person2.name}
                        onChange={(e) => setPerson2(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="İSİM GİRİN"
                        className="w-full bg-transparent text-[13px] sm:text-[15px] font-black text-[#111827] border-none focus:ring-0 px-3 py-2 placeholder:text-slate-300 text-center uppercase tracking-tight transition-all"
                      />
                    </div>
                    
                    {/* Date Input Integrated Into Card Design */}
                    <div className="relative group/input">
                      <div className="absolute inset-0 bg-slate-50/50 rounded-2xl -z-10 group-focus-within/input:bg-rose-50/80 transition-colors border-2 border-transparent group-focus-within/input:border-rose-100 shadow-sm" />
                      <BirthDateInput 
                        value={person2.birthDate}
                        onChange={(val) => setPerson2(prev => ({ ...prev, birthDate: val }))}
                        hideIcon={true}
                        placeholder="GG.AA.YYYY"
                        className="!bg-transparent !border-none px-3 py-2 text-[11px] sm:text-[13px] font-black tracking-widest uppercase !rounded-2xl !shadow-none text-center !text-[#111827] placeholder:!text-slate-300 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ANALYSIS TYPES - PREMIUM GRID */}
              <div className="space-y-6 pt-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-slate-100" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">UYUM ODAĞI</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-slate-100" />
                </div>
                
                <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-lg mx-auto">
                  {relationshipTypes.map(type => {
                    const isSelected = relationshipType === type.id;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setRelationshipType(type.id)}
                        className={`group relative px-4 py-4 rounded-[1.5rem] border transition-all duration-500 overflow-hidden text-center ${
                          isSelected 
                            ? 'bg-[#111827] text-white border-[#111827] shadow-xl shadow-black/10 scale-[1.02]' 
                            : 'bg-slate-50/50 border-slate-100/50 text-slate-500 hover:bg-white hover:border-rose-100'
                        }`}
                      >
                        {isSelected && (
                          <motion.div 
                            layoutId="pill-bg"
                            className="absolute inset-0 bg-gradient-to-br from-slate-800 to-black -z-10" 
                          />
                        )}
                        <div className="relative z-10 flex flex-col items-center gap-1">
                          <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-colors ${
                            isSelected ? 'text-white' : 'text-[#4B5563]'
                          }`}>
                            {type.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {relationshipType === 'custom' && (
                <div className="space-y-3 pt-2">
                  <div className="relative group">
                    <textarea 
                      value={customFocus}
                      onChange={(e) => setCustomFocus(e.target.value)}
                      maxLength={300}
                      placeholder="Analizin en çok hangi tarafını çözmek istiyorsun? Örn: Bu ilişki neden bitmiyor? Gelecek var mı?"
                      className="w-full bg-[#FAFAFB] border border-slate-100 rounded-[1.5rem] p-4 text-[12px] text-[#111827] placeholder:text-slate-300 focus:outline-none focus:ring-4 focus:ring-rose-500/5 focus:border-rose-500/20 focus:bg-white resize-none h-24 transition-all font-medium leading-relaxed"
                    />
                    <div className="absolute bottom-3 right-4 text-[8px] font-black text-slate-300 uppercase tracking-widest">{customFocus.length}/300</div>
                  </div>
                </div>
              )}

              <div className="space-y-4 pt-2">
                <motion.button 
                  whileTap={{ scale: 0.98 }}
                  onClick={handleManualAnalysis}
                  disabled={isAnalyzing}
                  className={`w-full py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
                    isAnalyzing 
                      ? 'bg-slate-100 text-slate-400 shadow-none' 
                      : 'bg-gradient-to-r from-[#7C3AED] via-[#EC4899] to-[#F43F5E] text-white shadow-xl shadow-rose-500/25 hover:opacity-90 active:scale-[0.99] group'
                  }`}
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  )}
                  {isAnalyzing ? pendingTexts[pendingTextIndex] : (
                    `ANALİZİ BAŞLAT (${(currentUser.compatibilityCount || 0) > 0 ? '1 HAK' : '25 J'})`
                  )}
                </motion.button>
              </div>
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
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
              <input 
                type="text" 
                placeholder="İSİM ARA..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 pr-5 py-2.5 bg-white border border-slate-100 rounded-2xl text-[11px] font-black focus:outline-none focus:ring-4 focus:ring-indigo-500/5 w-36 transition-all focus:w-48 placeholder:text-slate-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
            ) : mergedList.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white/40 backdrop-blur-sm rounded-[2.5rem] border border-slate-100/50">
                <div className="w-16 h-16 mx-auto bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100 shadow-sm">
                  <Ghost className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-sm font-black text-slate-900 mb-2">Henüz Arşivin Yok</h4>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-[200px] mx-auto leading-relaxed">
                  İsim ve doğum tarihi girerek ilk ilişki uyum haritanı oluştur.
                </p>
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
  const [pendingTextIndex, setPendingTextIndex] = useState(0);

  const pendingTexts = [
    "Enerjiler hizalanıyor...",
    "Frekans haritası oluşturuluyor...",
    "Travma örüntüleri okunuyor...",
    "Bağ analizi yapılıyor...",
    "Karmik döngü hizanlanıyor..."
  ];

  useEffect(() => {
    const unlockTime = item.unlockAt ? new Date(item.unlockAt).getTime() : 0;
    const isLocked = !!unlockTime && unlockTime > Date.now();
    if (!isLocked) return;

    const interval = setInterval(() => {
      setPendingTextIndex(prev => (prev + 1) % pendingTexts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [item.unlockAt]);

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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={!showLock ? onClick : undefined}
      className={`relative p-5 rounded-[2rem] border transition-all duration-300 overflow-hidden ${
        showLock
          ? 'bg-slate-50 border-slate-100 cursor-default' 
          : 'bg-white border-slate-50 shadow-sm hover:shadow-xl hover:border-rose-100/50 cursor-pointer group active:scale-[0.99]'
      }`}
    >
      <div className="flex items-center gap-4 relative z-10">
        <div className="flex -space-x-4">
          <div className="w-12 h-12 rounded-2xl border-2 border-white shadow-sm overflow-hidden relative z-10 ring-1 ring-slate-100">
            <img src={item.person1?.photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'} className="w-full h-full object-cover" />
          </div>
          <div className="w-12 h-12 rounded-2xl border-2 border-white shadow-sm overflow-hidden relative z-20 ring-1 ring-slate-100">
            <img src={item.targetPhoto || item.person2?.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.targetUserId || person2Name}`} className="w-full h-full object-cover" />
            {showLock && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <h4 className="text-[12px] font-black text-[#111827] truncate uppercase tracking-tighter">
                {item.person1?.name || 'Sen'} & {person2Name}
              </h4>
              {isLasyaProfile && (
                <div className="flex items-center justify-center p-0.5 rounded-full bg-gradient-to-r from-purple-500 to-amber-500">
                  <Sparkles className="w-2 h-2 text-white" />
                </div>
              )}
            </div>
            {isActuallyRevealed && (
              <div className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black border border-rose-100/50 italic">%{item.loveScore}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              {toSafeDate(item.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
            </span>
            <div className="w-1 h-1 rounded-full bg-slate-200" />
            <span className="text-[10px] font-semibold text-[#6B7280] italic truncate max-w-[120px]">
              {showLock ? pendingTexts[pendingTextIndex] : item.summaryShort}
            </span>
          </div>
        </div>

        {showLock && (
          <div className="flex flex-col items-end gap-1.5 min-w-[70px]">
            <div className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black flex items-center gap-1.5 border border-indigo-100">
              <Clock className="w-3 h-3" />
              {timeLeft}
            </div>
            <motion.button 
              whileTap={{ scale: 0.92 }}
              onClick={(e) => { e.stopPropagation(); onSpeedUp(item.id); }}
              disabled={isSpeedingUp || timeLeft === "Hazır!"}
              className="px-2 py-1 bg-gradient-to-r from-rose-500 to-purple-600 text-white rounded-lg text-[8px] font-black flex items-center gap-1 shadow-lg shadow-rose-500/20 uppercase tracking-widest disabled:opacity-50"
            >
              <FastForward className="w-2.5 h-2.5" />
              HIZLANDIR
            </motion.button>
          </div>
        )}
      </div>

      {isActuallyRevealed && (
        <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-rose-500/[0.03] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 text-[#111827]">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#081028]/40 backdrop-blur-md" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative w-full max-w-[400px] bg-white rounded-[4rem] overflow-hidden shadow-[0_48px_96px_-24px_rgba(8,16,40,0.3)] flex flex-col max-h-[85vh]"
      >
        <div className="relative h-72 flex shrink-0 border-b border-slate-50">
          <div className="w-1/2 h-full relative overflow-hidden">
            <img src={analysis.person1?.photo || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user'} className="w-full h-full object-cover grayscale-[0.1]" />
            <div className="absolute inset-x-0 bottom-0 py-3 bg-gradient-to-t from-black/80 to-transparent text-white text-[9px] font-black text-center tracking-[0.3em] truncate px-3">{analysis.person1?.name || "SEN"}</div>
          </div>
          <div className="w-1/2 h-full relative overflow-hidden">
            <img src={person2Photo} className="w-full h-full object-cover grayscale-[0.1]" />
            <div className="absolute inset-x-0 bottom-0 py-3 bg-gradient-to-t from-black/80 to-transparent text-white text-[9px] font-black text-center tracking-[0.3em] uppercase truncate px-3">{person2Name}</div>
          </div>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.4, delay: 0.3 }}
              className="w-20 h-20 rounded-full bg-white shadow-[0_15px_30px_-5px_rgba(0,0,0,0.15)] flex items-center justify-center border-4 border-white relative z-10"
            >
              <Heart className="w-10 h-10 text-rose-500 fill-rose-500" />
              <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2.5, repeat: Infinity }} className="absolute inset-0 rounded-full border-2 border-rose-500" />
            </motion.div>
          </div>
          
          <button onClick={onClose} className="absolute top-6 right-6 w-11 h-11 bg-black/20 hover:bg-black/40 backdrop-blur-xl border border-white/30 rounded-full flex items-center justify-center text-white transition-all"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-8 md:p-10 space-y-8 overflow-y-auto no-scrollbar pb-16">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-black text-[#111827] tracking-tighter uppercase">İkili Frekans Raporu</h3>
          </div>

          {analysis.customFocus && (
            <div className="bg-[#FAFAFB] border border-slate-100 rounded-[2rem] p-5 overflow-hidden relative shadow-inner">
              <span className="text-[9px] font-black tracking-[0.25em] uppercase text-slate-400 block mb-3">Analiz Odağı</span>
              <p className="text-[13px] font-medium text-[#111827] relative z-10 leading-relaxed italic border-l-2 border-[#D4B06A] pl-4">
                "{analysis.customFocus}"
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'AŞK', val: analysis.loveScore || 0, color: '#F43F5E', icon: Heart },
              { label: 'DOSTLUK', val: analysis.friendshipScore || 0, color: '#6366F1', icon: Users },
              { label: 'ENERJİ', val: analysis.energyScore || 0, color: '#F59E0B', icon: Sparkles }
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth="6" />
                    <motion.circle 
                      cx="50" cy="50" r="42" fill="none" stroke={s.color} strokeWidth="7" 
                      strokeDasharray="263.8" initial={{ strokeDashoffset: 263.8 }} animate={{ strokeDashoffset: 263.8 - (263.8 * s.val) / 100 }}
                      transition={{ duration: 2.5, delay: 0.6 + i * 0.2, ease: "easeOut" }} strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-[11px] font-black text-[#111827]">%{s.val}</span>
                </div>
                <span className="text-[8px] font-black text-[#6B7280] uppercase tracking-[0.2em]">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="h-px bg-slate-100/60" />

          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <h4 className="text-[10px] font-black text-[#6B7280] uppercase tracking-[0.25em]">Yıldızların Yorumu</h4>
            </div>
            <div className="p-6 bg-[#FAFAFB] rounded-[2.5rem] border border-slate-50 relative shadow-inner">
              <p className="text-sm font-black text-[#111827] leading-tight italic mb-4 opacity-90 text-center px-2">
                "{analysis.summaryShort || "Enerjiler hesaplandı."}"
              </p>
              <p className="text-[12px] font-medium text-[#6B7280] leading-relaxed whitespace-pre-wrap">
                {analysis.summaryLong || analysis.aiComment || "Yeni yorumlar hala göklerin derinliklerinde hazırlanıyor..."}
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {analysis.source === "discover" && analysis.targetUserId && analysis.targetUserId !== currentUser.uid && (
              <div className="mb-4">
                {activeChats.includes(analysis.targetUserId) ? (
                  <button 
                    onClick={() => {
                      toast.info("Sohbetler sekmesinden mesajlaşabilirsiniz.");
                      onClose();
                    }}
                    className="w-full py-4.5 text-white rounded-[1.5rem] font-black text-[13px] uppercase tracking-[0.2em] bg-gradient-to-br from-indigo-600 to-indigo-800 shadow-[0_15px_30px_-10px_rgba(79,70,229,0.4)] mb-2"
                  >
                    Sohbete Git
                  </button>
                ) : sentRequests.includes(analysis.targetUserId) ? (
                  <button 
                    disabled
                    className="w-full py-4.5 text-slate-400 rounded-[1.5rem] font-black text-[13px] uppercase tracking-[0.2em] bg-slate-50 border border-slate-100 mb-2"
                  >
                    İstek Gönderildi
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      toast.success("Öncelikli mesaj isteği yakında aktif olacak!");
                    }}
                    className="w-full py-5 text-white rounded-[1.5rem] font-black text-[12px] uppercase tracking-[0.15em] bg-gradient-to-br from-[#D4B06A] to-[#B4904A] shadow-[0_15px_30px_-10px_rgba(212,176,106,0.4)] flex flex-col items-center justify-center gap-1.5 mb-2"
                  >
                    <span className="flex items-center gap-2"><Zap className="w-4 h-4 fill-white/20" /> Öncelikli Mesaj İsteği</span>
                    <span className="text-[8px] font-bold text-white/70 normal-case tracking-normal opacity-90 px-8">Mesajın karşı tarafın isteklerinde en üst sırada görülür.</span>
                  </button>
                )}
              </div>
            )}
            <button 
              onClick={onClose} 
              className="w-full py-5 sm:py-6 bg-[#081028] text-white rounded-[1.75rem] font-black text-[12px] sm:text-[13px] uppercase tracking-[0.4em] shadow-[0_20px_40px_-12px_rgba(8,16,40,0.3)] hover:bg-black transition-all active:scale-[0.98]"
            >
              Anladım
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
