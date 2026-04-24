import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Heart, 
  Sparkles, 
  Handshake, 
  Star, 
  Zap,
  Info
} from 'lucide-react';
import { UserProfile } from '../types';
import { calculateCompatibility } from '../lib/compatibilityEngine';
import OptimizedImage from './OptimizedImage';

interface MatchingProfilePopupProps {
  user: UserProfile;
  currentUser: UserProfile;
  onClose: () => void;
  onAction?: (type: 'like' | 'pass' | 'super_like') => void;
}

export default function MatchingProfilePopup({ 
  user, 
  currentUser, 
  onClose,
  onAction
}: MatchingProfilePopupProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const photos = useMemo(() => {
    return user.social?.photos?.length ? user.social.photos : [user.photoURL || ''];
  }, [user]);

  const compatibility = useMemo(() => {
    return calculateCompatibility(currentUser, user);
  }, [currentUser, user]);

  const auraInfo = useMemo(() => {
    const auras = [
      { name: 'Mistik Mavi', color: 'text-blue-400', glow: 'shadow-blue-500/20' },
      { name: 'Ruhani Mor', color: 'text-purple-400', glow: 'shadow-purple-500/20' },
      { name: 'Sıcak Turuncu', color: 'text-orange-400', glow: 'shadow-orange-500/20' },
      { name: 'Şifacı Yeşil', color: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
      { name: 'Tutku Kırmızısı', color: 'text-rose-400', glow: 'shadow-rose-500/20' },
      { name: 'Altın Işık', color: 'text-amber-400', glow: 'shadow-amber-500/20' }
    ];
    // Deterministic selection based on UID
    const index = user.uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % auras.length;
    return auras[index];
  }, [user.uid]);

  const mysticComment = useMemo(() => {
    const score = (compatibility.love + compatibility.friendship + compatibility.understanding) / 3;
    if (score >= 80) return "Yıldızlar sizin için parlıyor, ruhsal frekansınız mükemmel bir uyum içinde.";
    if (score >= 50) return "Ufak kozmik pürüzler olsa da enerjileriniz uyumlanabilir, şans vermeye değer.";
    return "Kozmik frekanslarınız şu an farklı yönlere akıyor, zorlayıcı bir enerji alanı olabilir.";
  }, [compatibility]);

  const handleNextPhoto = () => {
    setActivePhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const handlePrevPhoto = () => {
    setActivePhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl overflow-y-auto"
    >
      {/* HEADER ACTIONS */}
      <div className="sticky top-0 z-50 p-4 flex justify-end">
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white border border-white/20 shadow-2xl active:scale-90 transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 pb-24">
        {/* PHOTO GALLERY */}
        <div className="relative aspect-[3/4] w-full rounded-[2.5rem] overflow-hidden shadow-2xl bg-neutral-900 group">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePhotoIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="absolute inset-0"
            >
              <OptimizedImage 
                src={photos[activePhotoIndex]} 
                alt={user.nickname}
                className="w-full h-full object-cover"
              />
            </motion.div>
          </AnimatePresence>

          {/* PHOTO INDICATORS */}
          {photos.length > 1 && (
            <div className="absolute top-6 inset-x-8 z-10 flex gap-1.5 justify-center">
              {photos.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1 flex-1 rounded-full bg-white transition-all duration-300 ${idx === activePhotoIndex ? 'opacity-100 shadow-[0_0_10px_white]' : 'opacity-30'}`} 
                />
              ))}
            </div>
          )}

          {/* TAP NAVIGATION */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 cursor-pointer" onClick={handlePrevPhoto} />
            <div className="flex-1 cursor-pointer" onClick={handleNextPhoto} />
          </div>
          
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
        </div>

        {/* IDENTITY LAYER */}
        <div className="mt-8 space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-serif font-black text-white tracking-tight leading-none">
              {user.social?.nickname || user.nickname}, {user.social?.age || user.age || 25}
            </h1>
            
            {/* MISTIK TAGS */}
            <div className="flex flex-wrap gap-3">
              <div className={`px-4 py-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 backdrop-blur-md rounded-2xl border border-amber-500/30 flex items-center gap-2 shadow-lg ${auraInfo.glow}`}>
                <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-xs font-black text-amber-100 uppercase tracking-widest">
                  {user.zodiacSign || 'Koç'}
                </span>
              </div>
              <div className={`px-4 py-2 bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-md rounded-2xl border border-blue-500/30 flex items-center gap-2 shadow-lg ${auraInfo.glow}`}>
                <Sparkles className={`w-4 h-4 ${auraInfo.color}`} />
                <span className={`text-xs font-black uppercase tracking-widest ${auraInfo.color}`}>
                  {auraInfo.name}
                </span>
              </div>
            </div>
          </div>

          {/* INTERESTS */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-2">
              <Info className="w-3 h-3" />
              İlgi Alanları
            </h3>
            <div className="flex flex-wrap gap-2">
              {(user.social?.interests || user.interests || ['Astroloji', 'Müzik', 'Sanat']).map((interest) => (
                <div 
                  key={interest} 
                  className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full"
                >
                  <span className="text-xs font-bold text-white/80">{interest}</span>
                </div>
              ))}
            </div>
          </div>

          {/* COMPATIBILITY ANALYSIS */}
          <div className="space-y-6 pt-4">
            <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">
              Kozmik Uyum Analizi
            </h3>
            
            <div className="space-y-5">
              {/* LOVE PROGRESS */}
              <div className="space-y-2">
                <div className="flex justify-between items-end px-1">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">TENSEL UYUM</span>
                  </div>
                  <span className="text-2xl font-black text-white tracking-tighter">%{compatibility.love}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${compatibility.love}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-rose-600 to-pink-500 shadow-[0_0_15px_rgba(225,29,72,0.5)]"
                  />
                </div>
              </div>

              {/* FRIENDSHIP PROGRESS */}
              <div className="space-y-2">
                <div className="flex justify-between items-end px-1">
                  <div className="flex items-center gap-2">
                    <Handshake className="w-4 h-4 text-blue-400" />
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">RUHSAL FREKANS</span>
                  </div>
                  <span className="text-2xl font-black text-white tracking-tighter">%{compatibility.friendship}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${compatibility.friendship}%` }}
                    transition={{ duration: 1, delay: 0.1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                  />
                </div>
              </div>

              {/* UNDERSTANDING PROGRESS */}
              <div className="space-y-2">
                <div className="flex justify-between items-end px-1">
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">GENEL ANLAŞMA</span>
                  </div>
                  <span className="text-2xl font-black text-white tracking-tighter">%{compatibility.understanding}</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${compatibility.understanding}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-amber-600 to-orange-500 shadow-[0_0_15px_rgba(217,119,6,0.5)]"
                  />
                </div>
              </div>
            </div>

            {/* DYNAMIC ASTRO COMMENT */}
            <div className="mt-8 p-6 bg-white/5 border border-white/10 rounded-[2rem] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
              <div className="relative space-y-1">
                <Sparkles className="w-5 h-5 text-amber-400 mb-2 opacity-50" />
                <p className="text-lg font-serif italic text-white/90 leading-relaxed">
                  "{mysticComment}"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </motion.div>
  );
}
