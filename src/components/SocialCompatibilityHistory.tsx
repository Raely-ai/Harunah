import React, { useState, useEffect } from 'react';
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
  Clock
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
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, CompatibilityHistory } from '../types';
import { toSafeDate } from '../lib/dateUtils';
import { toast } from 'sonner';
import { walletService } from '../lib/walletService';

interface SocialCompatibilityHistoryProps {
  currentUser: UserProfile;
  onBack: () => void;
  isTab?: boolean;
  isActive?: boolean;
  isMock?: boolean;
}

export default function SocialCompatibilityHistory({ currentUser, onBack, isTab, isActive, isMock }: SocialCompatibilityHistoryProps) {
  // Safe access with fallbacks
  const uid = currentUser?.uid || "";

  const [history, setHistory] = useState<CompatibilityHistory[]>([]);
  const [loading, setLoading] = useState(!isMock);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<CompatibilityHistory | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(localStorage.getItem('pendingCompatibilityId'));
  const [finishTime, setFinishTime] = useState<string | null>(localStorage.getItem('pendingCompatibilityFinishTime'));
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Countdown effect
  useEffect(() => {
    if (!finishTime || !pendingRequestId) return;

    const targetDate = new Date(finishTime).getTime();
    
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((targetDate - now) / 1000));
      setTimeLeft(diff);
      
      if (diff === 0 && !isAnalyzing) {
        setIsAnalyzing(true); // Should stay in analyzing state until status changes
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [finishTime, pendingRequestId, isAnalyzing]);

  // Real-time track the pending request
  useEffect(() => {
    if (!pendingRequestId || !uid) return;

    const unsub = onSnapshot(doc(db, "compatibilityRequests", pendingRequestId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.status === 'completed') {
          // Find the result in history
          fetchHistory(true).then(() => {
            // After refresh, if we find a history item with this requestId, open it
          });
          toast.success("Analiz tamamlandı! Yıldızlar birleşti. ✨");
          localStorage.removeItem('pendingCompatibilityId');
          localStorage.removeItem('pendingCompatibilityFinishTime');
          setPendingRequestId(null);
          setFinishTime(null);
          setIsAnalyzing(false);
        } else if (data.status === 'error') {
          toast.error("Bakımdayız, analiz yapılamadı. Jetonunuz iade edilmiştir.");
          setPendingRequestId(null);
          setIsAnalyzing(false);
          localStorage.removeItem('pendingCompatibilityId');
        } else {
          setIsAnalyzing(true);
        }
      }
    });

    return () => unsub();
  }, [pendingRequestId, uid]);

  // Check if a result has appeared for our requestId (auto-popup)
  useEffect(() => {
    if (!isActive || !uid) return;
    
    const q = query(
      collection(db, "compatibilityHistory"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const latest = { id: snap.docs[0].id, ...snap.docs[0].data() } as CompatibilityHistory;
        
        // If this matches our most recent pending ID that just cleared, show it
        const lastClearedId = localStorage.getItem('lastClearedCompatibilityId');
        if (latest.requestId === lastClearedId || (pendingRequestId === null && latest.createdAt && new Date(latest.createdAt).getTime() > Date.now() - 30000)) {
           // We might want to auto-select it if it's very recent
        }
      }
    });

    return () => unsub();
  }, [isActive, uid, pendingRequestId]);

  const fileInput1Ref = React.useRef<HTMLInputElement>(null);
  const fileInput2Ref = React.useRef<HTMLInputElement>(null);

  // Form State
  const [person1, setPerson1] = useState({ name: '', birthDate: '', status: 'Bekar', photo: '' });
  const [person2, setPerson2] = useState({ name: '', birthDate: '', status: 'Bekar', photo: '' });
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
    if (!person1.name || !person1.birthDate || !person1.photo ||
        !person2.name || !person2.birthDate || !person2.photo) {
      toast.error("Lütfen tüm alanları doldurun ve fotoğrafları ekleyin.");
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
        toast.success("Analiz süreci başladı! 5 dakika içinde hazır olacak. ✨");
        setPendingRequestId(result.requestId);
        setFinishTime(result.finishTime);
        localStorage.setItem('pendingCompatibilityId', result.requestId);
        localStorage.setItem('pendingCompatibilityFinishTime', result.finishTime);
        
        // Reset form
        setPerson1({ name: '', birthDate: '', status: 'Bekar', photo: '' });
        setPerson2({ name: '', birthDate: '', status: 'Bekar', photo: '' });
      }
    } catch (error: any) {
      console.error("Manual analysis error:", error);
      toast.error(error.message || "Analiz sırasında bir hata oluştu.");
      setIsAnalyzing(false);
    }
  };

  const handlePhotoUpload = (person: 1 | 2) => {
    if (person === 1) fileInput1Ref.current?.click();
    else fileInput2Ref.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, person: 1 | 2) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Dosya boyutu 5MB'dan küçük olmalıdır.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      if (person === 1) setPerson1(prev => ({ ...prev, photo: base64String }));
      else setPerson2(prev => ({ ...prev, photo: base64String }));
    };
    reader.readAsDataURL(file);
  };

  const fetchHistory = async (autoSelectLatest = false) => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "compatibilityHistory"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompatibilityHistory));
      setHistory(items);
      if (autoSelectLatest && items.length > 0) {
        setSelectedAnalysis(items[0]);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "compatibilityHistory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive) {
      fetchHistory();
    }
  }, [uid, isActive]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Bu analizi geçmişten silmek istediğine emin misin?")) return;

    try {
      await deleteDoc(doc(db, "compatibilityHistory", id));
      setHistory(prev => prev.filter(h => h.id !== id));
      toast.success("Analiz silindi.");
    } catch (error) {
      toast.error("Silme işlemi başarısız.");
    }
  };

  const filteredHistory = history.filter(h => 
    h.targetName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`${isTab ? 'h-full' : 'fixed inset-0 z-[60]'} bg-[#F6F4F8] flex flex-col pt-[calc(env(safe-area-inset-top,1rem)+64px)]`}>
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={fileInput1Ref} 
        className="hidden" 
        accept="image/*" 
        onChange={(e) => onFileChange(e, 1)} 
      />
      <input 
        type="file" 
        ref={fileInput2Ref} 
        className="hidden" 
        accept="image/*" 
        onChange={(e) => onFileChange(e, 2)} 
      />

      {/* Header (Only if not in tab) */}
      {!isTab && (
        <div className="px-6 pt-12 pb-4 bg-white/80 backdrop-blur-md border-b border-black/5 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 -ml-2 text-muted hover:text-heading transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-lg font-serif font-bold text-heading">Uyum Analizi</h2>
              <p className="text-[10px] font-black text-muted uppercase tracking-widest">Enerji Frekanslarını Ölç</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {/* Section 1: New Analysis Form (Premium Laboratory Scene) */}
        <div className="px-4 py-8">
          <div className="relative bg-white rounded-[3rem] p-6 border border-black/5 shadow-2xl shadow-indigo-900/5 overflow-hidden">
            {/* Soft Ambient Backgrounds */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-10">
              {/* Dual Portrait Scene (Mistik Portreler) */}
              <div className="flex items-center justify-center gap-4">
                {/* Person 1 Portrait */}
                <div className="flex flex-col items-center gap-4 w-36">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePhotoUpload(1)}
                    className="relative w-32 h-44 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 flex flex-col items-center justify-center overflow-hidden shadow-xl hover:border-rose-200 transition-colors"
                  >
                    {person1.photo ? (
                      <img src={person1.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <Camera className="w-6 h-6" />
                        <span className="text-[8px] font-black uppercase tracking-tighter">Senin Fotoğrafın</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
                  </motion.button>
                  
                  {/* Inline Form 1 */}
                  <div className="w-full space-y-4 px-2">
                    <div className="border-b border-slate-200 py-1">
                      <input 
                        type="text" 
                        value={person1.name}
                        onChange={(e) => setPerson1(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="İsmin"
                        className="w-full bg-transparent text-[11px] font-black text-slate-900 border-none focus:ring-0 p-0 placeholder:text-slate-300 text-center uppercase tracking-tight"
                      />
                    </div>
                    <div className="border-b border-slate-200 py-1">
                      <input 
                        type="date" 
                        value={person1.birthDate}
                        onChange={(e) => setPerson1(prev => ({ ...prev, birthDate: e.target.value }))}
                        className="w-full bg-transparent text-[10px] font-bold text-slate-500 border-none focus:ring-0 p-0 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Connection Heart */}
                <div className="flex flex-col items-center justify-center gap-4">
                  <motion.div 
                    animate={{ 
                      scale: [1, 1.15, 1],
                      filter: ["drop-shadow(0 0 0px #f43f5e)", "drop-shadow(0 0 10px #f43f5e)", "drop-shadow(0 0 0px #f43f5e)"] 
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center border border-slate-100 z-10"
                  >
                    <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
                  </motion.div>
                  <div className="h-20 w-px bg-gradient-to-b from-rose-200 via-indigo-200 to-amber-200 rounded-full" />
                </div>

                {/* Person 2 Portrait */}
                <div className="flex flex-col items-center gap-4 w-36">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handlePhotoUpload(2)}
                    className="relative w-32 h-44 rounded-[2.5rem] bg-slate-50 border-2 border-slate-100 flex flex-col items-center justify-center overflow-hidden shadow-xl hover:border-indigo-200 transition-colors"
                  >
                    {person2.photo ? (
                      <img src={person2.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <Camera className="w-6 h-6" />
                        <span className="text-[8px] font-black uppercase tracking-tighter">O'nun Fotoğrafı</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent" />
                  </motion.button>

                  {/* Inline Form 2 */}
                  <div className="w-full space-y-4 px-2">
                    <div className="border-b border-slate-200 py-1">
                      <input 
                        type="text" 
                        value={person2.name}
                        onChange={(e) => setPerson2(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="İsmi"
                        className="w-full bg-transparent text-[11px] font-black text-slate-900 border-none focus:ring-0 p-0 placeholder:text-slate-300 text-center uppercase tracking-tight"
                      />
                    </div>
                    <div className="border-b border-slate-200 py-1">
                      <input 
                        type="date" 
                        value={person2.birthDate}
                        onChange={(e) => setPerson2(prev => ({ ...prev, birthDate: e.target.value }))}
                        className="w-full bg-transparent text-[10px] font-bold text-slate-500 border-none focus:ring-0 p-0 text-center"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Relationship Type Tags */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3">
                  <div className="h-[1px] w-8 bg-slate-200" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">İlişki Dinamiği</span>
                  <div className="h-[1px] w-8 bg-slate-200" />
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {relationshipTypes.map(type => (
                    <motion.button
                      key={type.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setRelationshipType(type.id)}
                      className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all border ${
                        relationshipType === type.id 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-black/10' 
                          : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      {type.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Analysis Trigger (Vibrant Premium Button) */}
              <div className="pt-4">
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleManualAnalysis}
                  disabled={isAnalyzing}
                  className={`relative w-full py-5 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.25em] shadow-2xl transition-all flex items-center justify-center gap-3 overflow-hidden ${
                    isAnalyzing 
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 shadow-none cursor-not-allowed' 
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-rose-500 text-white shadow-indigo-600/30'
                  }`}
                >
                  <AnimatePresence mode="wait">
                    {isAnalyzing ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3"
                      >
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
                        <span>Analiz Ediliyor %{timeLeft > 0 ? Math.floor(((300 - timeLeft) / 300) * 100) : 100}</span>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-3"
                      >
                        <HeartHandshake className="w-5 h-5" />
                        <span>Uyumu Hesapla</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Past History (Minimal Cards) */}
        <div className="px-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <h3 className="text-xs font-black text-heading uppercase tracking-wider">Analiz Geçmişi</h3>
            </div>
            
            <div className="relative w-28">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted/40" />
              <input 
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 bg-white border border-black/5 rounded-lg text-[9px] font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/10 transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 gap-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <div className="w-6 h-6 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-[9px] font-black text-muted/30 uppercase tracking-widest">Henüz analiz yok</p>
              </div>
            ) : (
              filteredHistory.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setSelectedAnalysis(item)}
                  className="p-2.5 bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="relative flex-shrink-0">
                    <img 
                      src={item.targetPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.targetUserId}`}
                      className="w-10 h-10 rounded-xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-md bg-rose-500 flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="text-[7px] font-black text-white">{item.loveScore}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-heading truncate uppercase tracking-tight">{item.targetName}</h4>
                      <span className="text-[7px] font-bold text-muted/40 uppercase">
                        {toSafeDate(item.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted/60 font-medium truncate italic">
                      "{item.summaryShort}"
                    </p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detail Popup (WOW Effect) */}
      <AnimatePresence>
        {selectedAnalysis && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAnalysis(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative w-full max-w-sm bg-white rounded-[3rem] overflow-hidden shadow-2xl"
            >
              {/* Result Header Scene */}
              <div className="relative h-56">
                {selectedAnalysis.source === 'manual' && selectedAnalysis.person1 && selectedAnalysis.person2 ? (
                  <div className="flex h-full">
                    <div className="relative w-1/2 h-full">
                      <img 
                        src={selectedAnalysis.person1.photo}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
                    </div>
                    <div className="relative w-1/2 h-full">
                      <img 
                        src={selectedAnalysis.person2.photo}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-l from-black/20 to-transparent" />
                    </div>
                    
                    {/* Floating Connection Icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", delay: 0.5 }}
                        className="w-14 h-14 rounded-full bg-white shadow-2xl flex items-center justify-center border-4 border-rose-500/20"
                      >
                        <Heart className="w-7 h-7 text-rose-500 fill-rose-500" />
                      </motion.div>
                    </div>
                  </div>
                ) : (
                  <img 
                    src={selectedAnalysis.targetPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAnalysis.targetUserId}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                
                <button 
                  onClick={() => setSelectedAnalysis(null)}
                  className="absolute top-6 right-6 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-8 pb-10 space-y-8 overflow-y-auto max-h-[60vh] no-scrollbar">
                {/* Names & Title */}
                <div className="text-center space-y-2 mt-4">
                  <motion.h3 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-serif font-bold text-heading"
                  >
                    {selectedAnalysis.source === 'manual' && selectedAnalysis.person1 && selectedAnalysis.person2 
                      ? `${selectedAnalysis.person1.name} & ${selectedAnalysis.person2.name}`
                      : selectedAnalysis.targetName
                    }
                  </motion.h3>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-500/10 to-rose-500/10 text-purple-600 border border-purple-500/20">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Premium Frekans Analizi</span>
                  </div>
                </div>

                {/* Animated Scores Grid (WOW Factor) */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Aşk', value: selectedAnalysis.loveScore, color: '#f43f5e', icon: Heart },
                    { label: 'Dostluk', value: selectedAnalysis.friendshipScore, color: '#3b82f6', icon: Users },
                    { label: 'Enerji', value: selectedAnalysis.energyScore, color: '#f59e0b', icon: Sparkles }
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-3">
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        {/* Glow Effect */}
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.2, 1] }}
                          transition={{ duration: 3, repeat: Infinity }}
                          className="absolute inset-0 blur-xl rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <svg className="w-full h-full -rotate-90 relative z-10">
                          <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="5" className="text-black/5" />
                          <motion.circle 
                            cx="40" cy="40" r="34" fill="none" stroke={item.color} strokeWidth="5" 
                            strokeDasharray="213.6"
                            initial={{ strokeDashoffset: 213.6 }}
                            animate={{ strokeDashoffset: 213.6 - (213.6 * item.value) / 100 }}
                            transition={{ duration: 2.5, ease: "circOut", delay: 0.8 + idx * 0.3 }}
                            strokeLinecap="round"
                          />
                        </svg>
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 2 + idx * 0.3 }}
                          className="absolute inset-0 flex flex-col items-center justify-center z-20"
                        >
                          <span className="text-sm font-black text-heading">%{item.value}</span>
                        </motion.div>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-muted/60">{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* Interpretation (Mystic Vibe) */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.5 }}
                  className="relative space-y-4 bg-slate-50 p-6 rounded-[2.5rem] border border-black/5 overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-rose-500 to-amber-500 opacity-30" />
                  <div className="text-center space-y-3">
                    <div className="flex justify-center">
                      <Sparkles className="w-5 h-5 text-purple-500/40" />
                    </div>
                    <p className="text-sm font-black text-heading leading-tight italic">"{selectedAnalysis.summaryShort}"</p>
                    <div className="h-px w-12 bg-black/5 mx-auto" />
                    <p className="text-[11px] text-body leading-relaxed opacity-80 font-medium whitespace-pre-wrap">{selectedAnalysis.summaryLong}</p>
                  </div>
                </motion.div>

                <button 
                  onClick={() => setSelectedAnalysis(null)}
                  className="w-full py-5 bg-heading text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] active:scale-[0.98] transition-transform shadow-xl shadow-black/10"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
