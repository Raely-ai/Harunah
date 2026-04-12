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
  onSnapshot, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, CompatibilityHistory } from '../types';
import { toast } from 'sonner';
import { walletService } from '../lib/walletService';

interface SocialCompatibilityHistoryProps {
  currentUser: UserProfile;
  onBack: () => void;
  isTab?: boolean;
}

export default function SocialCompatibilityHistory({ currentUser, onBack, isTab }: SocialCompatibilityHistoryProps) {
  // Safe access with fallbacks
  const uid = currentUser?.uid || "";

  const [history, setHistory] = useState<CompatibilityHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<CompatibilityHistory | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
        toast.success("Uyum analizi tamamlandı! ✨");
        setSelectedAnalysis(result.analysis);
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
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePhotoUpload = (person: 1 | 2) => {
    const url = window.prompt("Fotoğraf URL'si girin (Demo amaçlı):", "https://picsum.photos/seed/" + Math.random() + "/400/400");
    if (url) {
      if (person === 1) setPerson1(prev => ({ ...prev, photo: url }));
      else setPerson2(prev => ({ ...prev, photo: url }));
    }
  };

  useEffect(() => {
    if (!uid) return;
    const q = query(
      collection(db, "compatibilityHistory"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompatibilityHistory)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "compatibilityHistory");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Bu analizi geçmişten silmek istediğine emin misin?")) return;

    try {
      await deleteDoc(doc(db, "compatibilityHistory", id));
      toast.success("Analiz silindi.");
    } catch (error) {
      toast.error("Silme işlemi başarısız.");
    }
  };

  const filteredHistory = history.filter(h => 
    h.targetName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`${isTab ? 'h-full' : 'fixed inset-0 z-[60]'} bg-[#F6F4F8] flex flex-col`}>
      {/* Header */}
      <div className={`px-6 ${isTab ? 'pt-24' : 'pt-12'} pb-4 bg-white/80 backdrop-blur-md border-b border-black/5 flex items-center justify-between sticky top-0 z-20`}>
        <div className="flex items-center gap-3">
          {!isTab && (
            <button onClick={onBack} className="p-2 -ml-2 text-muted hover:text-heading transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h2 className="text-lg font-serif font-bold text-heading">Uyum Analizi</h2>
            <p className="text-[10px] font-black text-muted uppercase tracking-widest">Enerji Frekanslarını Ölç</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-purple-600" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        {/* Section 1: New Analysis Form (Premium Scene) */}
        <div className="px-6 py-8">
          <div className="relative bg-white rounded-[3rem] p-6 border border-black/5 shadow-2xl shadow-purple-900/5 overflow-hidden">
            {/* Background Aura Effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-500/5 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-rose-500/5 blur-[100px] rounded-full pointer-events-none" />

            <div className="relative z-10 space-y-8">
              {/* Two Person Cards Scene */}
              <div className="flex items-start justify-between gap-4">
                {/* Person 1 Card */}
                <div className="flex-1 space-y-4">
                  <div className="relative group">
                    <button 
                      onClick={() => handlePhotoUpload(1)}
                      className="w-full aspect-[4/5] rounded-[2rem] bg-black/5 border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-2 hover:bg-black/10 transition-all overflow-hidden"
                    >
                      {person1.photo ? (
                        <img src={person1.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-muted" />
                          <span className="text-[8px] font-black uppercase text-muted">Senin Fotoğrafın</span>
                        </>
                      )}
                    </button>
                    <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] font-black shadow-lg border-2 border-white">1</div>
                  </div>

                  <div className="space-y-2">
                    <input 
                      type="text" 
                      value={person1.name}
                      onChange={(e) => setPerson1(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Adın"
                      className="w-full px-4 py-3 bg-black/5 border-none rounded-2xl text-xs font-bold text-center focus:ring-2 focus:ring-rose-500/20 transition-all placeholder:text-muted/50"
                    />
                    <input 
                      type="date" 
                      value={person1.birthDate}
                      onChange={(e) => setPerson1(prev => ({ ...prev, birthDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-black/5 border-none rounded-2xl text-[10px] font-bold text-center focus:ring-2 focus:ring-rose-500/20 transition-all"
                    />
                    <select 
                      value={person1.status}
                      onChange={(e) => setPerson1(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-4 py-3 bg-black/5 border-none rounded-2xl text-[10px] font-bold text-center focus:ring-2 focus:ring-rose-500/20 transition-all appearance-none"
                    >
                      <option>Bekar</option>
                      <option>İlişkisi var</option>
                      <option>Nişanlı</option>
                      <option>Evli</option>
                      <option>Karmaşık</option>
                    </select>
                  </div>
                </div>

                {/* Middle Connection */}
                <div className="flex flex-col items-center justify-center pt-12 gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full animate-pulse" />
                    <div className="relative w-12 h-12 rounded-full bg-white shadow-xl flex items-center justify-center border border-black/5">
                      <HeartHandshake className="w-6 h-6 text-rose-500" />
                    </div>
                  </div>
                  <div className="h-24 w-px bg-gradient-to-b from-rose-500/50 via-purple-500/50 to-amber-500/50 rounded-full" />
                </div>

                {/* Person 2 Card */}
                <div className="flex-1 space-y-4">
                  <div className="relative group">
                    <button 
                      onClick={() => handlePhotoUpload(2)}
                      className="w-full aspect-[4/5] rounded-[2rem] bg-black/5 border-2 border-dashed border-black/10 flex flex-col items-center justify-center gap-2 hover:bg-black/10 transition-all overflow-hidden"
                    >
                      {person2.photo ? (
                        <img src={person2.photo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <Camera className="w-6 h-6 text-muted" />
                          <span className="text-[8px] font-black uppercase text-muted">O'nun Fotoğrafı</span>
                        </>
                      )}
                    </button>
                    <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-black shadow-lg border-2 border-white">2</div>
                  </div>

                  <div className="space-y-2">
                    <input 
                      type="text" 
                      value={person2.name}
                      onChange={(e) => setPerson2(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="O'nun Adı"
                      className="w-full px-4 py-3 bg-black/5 border-none rounded-2xl text-xs font-bold text-center focus:ring-2 focus:ring-amber-500/20 transition-all placeholder:text-muted/50"
                    />
                    <input 
                      type="date" 
                      value={person2.birthDate}
                      onChange={(e) => setPerson2(prev => ({ ...prev, birthDate: e.target.value }))}
                      className="w-full px-4 py-3 bg-black/5 border-none rounded-2xl text-[10px] font-bold text-center focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                    <select 
                      value={person2.status}
                      onChange={(e) => setPerson2(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-4 py-3 bg-black/5 border-none rounded-2xl text-[10px] font-bold text-center focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none"
                    >
                      <option>Bekar</option>
                      <option>İlişkisi var</option>
                      <option>Nişanlı</option>
                      <option>Evli</option>
                      <option>Karmaşık</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Relationship Type Selector (Segmented) */}
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-px flex-1 bg-black/5" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted">İlişki Tipi</span>
                  <div className="h-px flex-1 bg-black/5" />
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {relationshipTypes.map(type => (
                    <button
                      key={type.id}
                      onClick={() => setRelationshipType(type.id)}
                      className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                        relationshipType === type.id 
                          ? 'bg-heading text-white border-heading shadow-xl shadow-black/10 scale-105' 
                          : 'bg-black/5 text-muted border-transparent hover:bg-black/10'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Analysis CTA */}
              <div className="pt-4">
                <button 
                  onClick={handleManualAnalysis}
                  disabled={isAnalyzing}
                  className={`w-full py-5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] shadow-2xl shadow-purple-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 ${isAnalyzing ? 'opacity-70' : ''}`}
                >
                  {isAnalyzing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                  <span>Analizi Başlat ({currentUser.compatibilityCount || 0})</span>
                </button>
                <p className="text-center text-[8px] font-bold text-muted mt-4 uppercase tracking-widest">
                  ✨ Karşılaştığın için uyumunu ücretsiz görüyorsun
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Past History (Secondary) */}
        <div className="px-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-serif font-bold text-heading">Analiz Geçmişi</h3>
                <p className="text-[8px] font-black text-muted uppercase tracking-widest">Önceki Frekanslar</p>
              </div>
            </div>
            
            <div className="relative w-32">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
              <input 
                type="text"
                placeholder="Ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-white border border-black/5 rounded-xl text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>
          </div>

          {/* List */}
          <div className="grid grid-cols-1 gap-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="w-8 h-8 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-[10px] font-black text-muted uppercase tracking-widest">Henüz analiz yok</p>
              </div>
            ) : (
              filteredHistory.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedAnalysis(item)}
                  className="p-3 bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-center gap-3"
                >
                  <div className="relative flex-shrink-0">
                    <img 
                      src={item.targetPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.targetUserId}`}
                      className="w-12 h-12 rounded-xl object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-rose-500 flex items-center justify-center border-2 border-white shadow-sm">
                      <span className="text-[8px] font-black text-white">%{item.loveScore}</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-heading truncate">{item.targetName}</h4>
                      <span className="text-[8px] font-bold text-muted uppercase">
                        {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted font-medium truncate italic">
                      "{item.summaryShort}"
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted/30" />
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

              <div className="px-8 pb-10 space-y-8">
                {/* Names & Title */}
                <div className="text-center space-y-2">
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
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600">
                    <Sparkles className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Frekans Analizi</span>
                  </div>
                </div>

                {/* Animated Scores Grid */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Aşk', value: selectedAnalysis.loveScore, color: 'rose', icon: Heart },
                    { label: 'Dostluk', value: selectedAnalysis.friendshipScore, color: 'blue', icon: Users },
                    { label: 'Enerji', value: selectedAnalysis.energyScore, color: 'amber', icon: Zap }
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2">
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full -rotate-90">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-black/5" />
                          <motion.circle 
                            cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" 
                            strokeDasharray="175.8"
                            initial={{ strokeDashoffset: 175.8 }}
                            animate={{ strokeDashoffset: 175.8 - (175.8 * item.value) / 100 }}
                            transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 + idx * 0.2 }}
                            className={`text-${item.color}-500`}
                          />
                        </svg>
                        <motion.span 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 1.5 }}
                          className="absolute text-xs font-black text-heading"
                        >
                          %{item.value}
                        </motion.span>
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-widest text-muted">{item.label}</span>
                    </div>
                  ))}
                </div>

                {/* Interpretation */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.8 }}
                  className="space-y-4 bg-black/5 p-6 rounded-[2rem] border border-black/5"
                >
                  <div className="text-center space-y-2">
                    <p className="text-sm font-bold text-heading leading-tight italic">"{selectedAnalysis.summaryShort}"</p>
                    <p className="text-[11px] text-body leading-relaxed opacity-70">{selectedAnalysis.summaryLong}</p>
                  </div>
                </motion.div>

                <button 
                  onClick={() => setSelectedAnalysis(null)}
                  className="w-full py-5 bg-heading text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] active:scale-[0.98] transition-transform shadow-xl"
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
