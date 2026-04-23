import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, AtSign } from 'lucide-react';
import { socialService } from '../lib/socialService';

export default function NicknameEditor({ uid, currentNickname, onClose, onUpdate }: { uid: string, currentNickname: string, onClose: () => void, onUpdate: (nickname: string) => void }) {
  const [nickname, setNickname] = useState(currentNickname);

  const handleSave = async () => {
    await socialService.updateSocialField(uid, 'nickname', nickname);
    onUpdate(nickname);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.95 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-sm shadow-2xl border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h3 className="font-black text-xl text-slate-800 tracking-tight">Kullanıcı Adı</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Seni nasıl çağıralım?</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="relative mb-8">
          <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-400" />
          <input 
            value={nickname} 
            onChange={(e) => setNickname(e.target.value)}
            className="w-full pl-12 pr-4 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] text-slate-900 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
            placeholder="Gezgin..."
          />
        </div>
        <button 
          onClick={handleSave} 
          className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-lg shadow-indigo-200 active:scale-95 transition-all"
        >
          Güncelle
        </button>
      </motion.div>
    </motion.div>
  );
}
