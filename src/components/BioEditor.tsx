import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Dice3, ChevronRight } from 'lucide-react';
import { socialService } from '../lib/socialService';

const READY_BIOS = [
  "Enerjime uyan insanlarla tanışmak istiyorum.",
  "Kafası rahat, samimi insanları severim.",
  "Fal bakılır, kahve içilir, muhabbet edilir.",
  "Karmaşık değilim, netim.",
  "Pozitif enerji arıyorum.",
  "Güven ve saygı benim için önemli.",
  "Beni anlamak kolay değil ama değer.",
  "Hayatın tadını çıkaran, pozitif ruhlarla tanışmak harika olur.",
  "Samimiyet her şeydir. Dürüstlük ve güven temel önceliğim.",
  "Güzellikleri paylaşacak, derin sohbetler edebilecek birilerini arıyorum."
];

export default function BioEditor({ uid, currentBio, onClose, onUpdate }: { uid: string, currentBio: string, onClose: () => void, onUpdate: (bio: string) => void }) {
  const [bio, setBio] = useState(currentBio);
  const [showReadyBios, setShowReadyBios] = useState(false);

  const handleSave = async (bioToSave = bio) => {
    await socialService.updateSocialField(uid, 'bio', bioToSave);
    onUpdate(bioToSave);
    onClose();
  };

  const handleSelectReadyBio = (selectedBio: string) => {
    setBio(selectedBio);
    setShowReadyBios(false);
  };

  const handleRandomBio = () => {
    const random = READY_BIOS[Math.floor(Math.random() * READY_BIOS.length)];
    setBio(random);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.95 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100 relative overflow-hidden">
        
        <AnimatePresence mode="wait">
          {!showReadyBios ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="font-black text-xl text-slate-800 tracking-tight">Hakkımda</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Kısaca kendinden bahset</p>
                </div>
                <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <button 
                  onClick={() => setShowReadyBios(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  <Sparkles size={14} />
                  Hazır Bio Seç
                </button>
                <button 
                  onClick={handleRandomBio}
                  className="flex items-center justify-center w-12 h-11 bg-slate-50 text-slate-400 rounded-2xl hover:text-indigo-500 hover:bg-indigo-50 transition-colors border border-slate-100"
                  title="Rastgele Seç"
                >
                  <Dice3 size={18} />
                </button>
              </div>

              <textarea 
                value={bio} 
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-slate-700 font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 h-40 resize-none leading-relaxed"
                placeholder="Nelerden hoşlanırsın, enerjin nasıldır?..."
              />
              <div className="flex justify-end mb-8 mt-2">
                <span className={`text-[10px] font-black uppercase tracking-widest ${bio.length > 200 ? 'text-red-500' : 'text-slate-400'}`}>
                  {bio.length}/200
                </span>
              </div>
              <button 
                onClick={() => handleSave()} 
                className="w-full bg-violet-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-lg shadow-violet-200 active:scale-95 transition-all"
              >
                Kaydet
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="ready-bios"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full max-h-[70vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-black text-xl text-slate-800 tracking-tight">Hazır Bio'lar</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Birini seçerek anında profilini güncelle</p>
                </div>
                <button 
                  onClick={() => setShowReadyBios(false)} 
                  className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar min-h-[300px]">
                {READY_BIOS.map((readyBio, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectReadyBio(readyBio)}
                    className="w-full text-left p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-slate-600 font-medium leading-relaxed group-hover:text-slate-800">{readyBio}</span>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 shrink-0" />
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setShowReadyBios(false)}
                className="mt-6 w-full py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Vazgeç
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
