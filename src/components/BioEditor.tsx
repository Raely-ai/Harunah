import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { socialService } from '../lib/socialService';

export default function BioEditor({ uid, currentBio, onClose, onUpdate }: { uid: string, currentBio: string, onClose: () => void, onUpdate: (bio: string) => void }) {
  const [bio, setBio] = useState(currentBio);

  const handleSave = async () => {
    await socialService.updateSocialField(uid, 'bio', bio);
    onUpdate(bio);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.95 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-black text-xl text-slate-800 tracking-tight">Hakkımda</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Kısaca kendinden bahset</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
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
          onClick={handleSave} 
          className="w-full bg-violet-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-lg shadow-violet-200 active:scale-95 transition-all"
        >
          Kaydet
        </button>
      </motion.div>
    </motion.div>
  );
}
