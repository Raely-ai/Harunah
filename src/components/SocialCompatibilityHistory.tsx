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
  limit 
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
  isMock?: boolean;
}

export default function SocialCompatibilityHistory({ currentUser, onBack, isTab, isMock }: SocialCompatibilityHistoryProps) {
  // Safe access with fallbacks
  const uid = currentUser?.uid || "";

  const [history, setHistory] = useState<CompatibilityHistory[]>([]);
  const [loading, setLoading] = useState(!isMock);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<CompatibilityHistory | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [readyAt, setReadyAt] = useState<string | null>(null);

  // Mock data for background
  useEffect(() => {
    if (isMock) {
      setHistory([{
        id: 'mock-1',
        userId: 'mock',
        targetUserId: 'mock-target',
        targetName: 'Ruh Eşi Adayı',
        targetPhoto: 'https://picsum.photos/seed/love/400/600',
        relationshipType: 'ask',
        loveScore: 88,
        friendshipScore: 74,
        energyScore: 92,
        summaryShort: 'Yıldızlarınız harika bir uyum içinde!',
        summaryLong: 'Bu iki enerji arasındaki çekim oldukça güçlü. Hem duygusal hem de zihinsel olarak birbirinizi tamamlıyorsunuz.',
        createdAt: new Date().toISOString(),
        source: 'discover',
        cacheKey: 'mock-cache'
      }]);
    }
  }, [isMock]);

  // File Input Refs
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
        toast.success("Uyum analizi başlatıldı! Yıldızlar hesaplanıyor... ✨");
        setPendingRequestId(result.requestId);
        setReadyAt(result.readyAt);
        
        // Reset form
        setPerson1({ name: '', birthDate: '', status: 'Bekar', photo: '' });
        setPerson2({ name: '', birthDate: '', status: 'Bekar', photo: '' });
      }
    } catch (error: any) {
      console.error("Manual analysis error:", error);
      if (error.message?.includes("Yetersiz")) {
        toast.info("Uyum analizi hakkın bitti. Cüzdandan alabilirsin.");
      } else {
        toast.error(error.message || "Analiz sırasında bir hata oluştu.");
      }
      setIsAnalyzing(false);
    }
  };

  // Polling for pending analysis
  useEffect(() => {
    if (!pendingRequestId || !uid) return;

    let pollCount = 0;
    const maxPolls = 60; // 5 minutes (poll every 5s)
    
    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(interval);
        setPendingRequestId(null);
        setIsAnalyzing(false);
        toast.error("Analiz zaman aşımına uğradı. Lütfen bildirimlerinizi kontrol edin.");
        return;
      }

      try {
        // Check if a new history item appeared for this specific request
        const q = query(
          collection(db, "compatibilityHistory"),
          where("userId", "==", uid),
          where("requestId", "==", pendingRequestId),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const latest = snap.docs[0].data() as CompatibilityHistory;
          // Found it!
          setHistory(prev => [latest, ...prev.filter(h => h.id !== latest.id)]);
          setSelectedAnalysis(latest);
          setPendingRequestId(null);
          setIsAnalyzing(false);
          clearInterval(interval);
          toast.success("Uyum analiziniz hazır! ✨");
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [pendingRequestId, uid, relationshipType]);

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

  const fetchHistory = async (force = false) => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "compatibilityHistory"),
        where("userId", "==", uid),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompatibilityHistory)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, "compatibilityHistory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [uid]);

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
        {/* Section 1: New Analysis Form (Premium Side-by-Side Scene) */}
        <div className="px-4 py-6">
          <div className="relative bg-white rounded-[2.5rem] p-5 border border-black/5 shadow-2xl shadow-purple-900/5 overflow-hidden">
            {/* Background Aura Effect */}
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-rose-500/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-6">
              {/* Two Person Cards Scene */}
              <div className="flex items-stretch justify-between gap-2">
                {/* Person 1 Card */}
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="flex-1 bg-slate-50/50 rounded-3xl p-3 border border-black/5 space-y-3"
                >
                  <div className="relative group">
                    <button 
                      onClick={() => handlePhotoUpload(1)}
                      className="w-full aspect-square rounded-2xl bg-white border-2 border-dashed border-black/5 flex flex-col items-center justify-center gap-1 hover:bg-black/5 transition-all overflow-hidden shadow-sm"
                    >
                      {person1.photo ? (
                        <img src={person1.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-muted/40" />
                          <span className="text-[7px] font-black uppercase text-muted/60">Senin Fotoğrafın</span>
                        </>
                      )}
                    </button>
                    <div className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-[9px] font-black shadow-lg border-2 border-white">1</div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-muted/60 uppercase ml-1">Adın</label>
                      <input 
                        type="text" 
                        value={person1.name}
                        onChange={(e) => setPerson1(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Adın"
                        className="w-full px-3 py-2 bg-white border border-black/5 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-muted/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-muted/60 uppercase ml-1">Doğum Tarihi</label>
                      <input 
                        type="date" 
                        value={person1.birthDate}
                        onChange={(e) => setPerson1(prev => ({ ...prev, birthDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-black/5 rounded-xl text-[9px] font-bold focus:ring-2 focus:ring-rose-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-muted/60 uppercase ml-1">Durum</label>
                      <select 
                        value={person1.status}
                        onChange={(e) => setPerson1(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-black/5 rounded-xl text-[9px] font-bold focus:ring-2 focus:ring-rose-500/20 transition-all appearance-none"
                      >
                        <option>Bekar</option>
                        <option>İlişkisi var</option>
                        <option>Nişanlı</option>
                        <option>Evli</option>
                        <option>Karmaşık</option>
                      </select>
                    </div>
                  </div>
                </motion.div>

                {/* Middle Connection */}
                <div className="flex flex-col items-center justify-center gap-3 py-4">
                  <div className="relative">
                    <motion.div 
                      animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-rose-500 blur-lg rounded-full" 
                    />
                    <div className="relative w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center border border-black/5 z-10">
                      <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
                    </div>
                  </div>
                  <div className="flex-1 w-px bg-gradient-to-b from-rose-500/40 via-purple-500/40 to-amber-500/40 rounded-full" />
                </div>

                {/* Person 2 Card */}
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="flex-1 bg-slate-50/50 rounded-3xl p-3 border border-black/5 space-y-3"
                >
                  <div className="relative group">
                    <button 
                      onClick={() => handlePhotoUpload(2)}
                      className="w-full aspect-square rounded-2xl bg-white border-2 border-dashed border-black/5 flex flex-col items-center justify-center gap-1 hover:bg-black/5 transition-all overflow-hidden shadow-sm"
                    >
                      {person2.photo ? (
                        <img src={person2.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5 text-muted/40" />
                          <span className="text-[7px] font-black uppercase text-muted/60">O'nun Fotoğrafı</span>
                        </>
                      )}
                    </button>
                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-[9px] font-black shadow-lg border-2 border-white">2</div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-muted/60 uppercase ml-1">O'nun Adı</label>
                      <input 
                        type="text" 
                        value={person2.name}
                        onChange={(e) => setPerson2(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="O'nun Adı"
                        className="w-full px-3 py-2 bg-white border border-black/5 rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-muted/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-muted/60 uppercase ml-1">Doğum Tarihi</label>
                      <input 
                        type="date" 
                        value={person2.birthDate}
                        onChange={(e) => setPerson2(prev => ({ ...prev, birthDate: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-black/5 rounded-xl text-[9px] font-bold focus:ring-2 focus:ring-amber-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-muted/60 uppercase ml-1">Durum</label>
                      <select 
                        value={person2.status}
                        onChange={(e) => setPerson2(prev => ({ ...prev, status: e.target.value }))}
                        className="w-full px-3 py-2 bg-white border border-black/5 rounded-xl text-[9px] font-bold focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none"
                      >
                        <option>Bekar</option>
                        <option>İlişkisi var</option>
                        <option>Nişanlı</option>
                        <option>Evli</option>
                        <option>Karmaşık</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Relationship Type Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-px flex-1 bg-black/5" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-muted/60">İlişki Tipi</span>
                  <div className="h-px flex-1 bg-black/5" />
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {relationshipTypes.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setRelationshipType(type.id)}
                      className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider transition-all border ${
                        relationshipType === type.id 
                          ? 'bg-heading text-white border-heading shadow-lg shadow-black/10 scale-105' 
                          : 'bg-white text-muted/60 border-black/5 hover:bg-black/5'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Analysis CTA */}
              <div className="pt-2">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleManualAnalysis}
                  disabled={isAnalyzing}
                  className={`relative w-full py-4 bg-gradient-to-r from-purple-600 via-purple-500 to-rose-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-purple-900/20 transition-all flex items-center justify-center gap-3 overflow-hidden group ${isAnalyzing ? 'opacity-70' : ''}`}
                >
                  <motion.div 
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                  />
                  {isAnalyzing ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <div className="flex flex-col items-start">
                        <span className="text-[10px] font-bold text-white leading-none">Analiz Hazırlanıyor...</span>
                        <span className="text-[7px] font-medium text-white/70">Yıldızlar hizalanıyor (Yaklaşık 5dk)</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span className="relative z-10">Uyumu Hesapla ({currentUser.compatibilityCount || 0})</span>
                    </>
                  )}
                </motion.button>
                <p className="text-center text-[7px] font-bold text-muted/40 mt-3 uppercase tracking-widest">
                  ✨ Analiziniz hazır olduğunda bildirim alacaksınız
                </p>
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
