import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { socialService } from '../lib/socialService';

export default function NicknameEditor({ uid, currentNickname, onClose, onUpdate }: { uid: string, currentNickname: string, onClose: () => void, onUpdate: (nickname: string) => void }) {
  const [nickname, setNickname] = useState(currentNickname);

  const handleSave = async () => {
    await socialService.updateSocialField(uid, 'nickname', nickname);
    onUpdate(nickname);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="bg-white p-6 rounded-[2rem] w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg">Nickname Düzenle</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <input 
          value={nickname} 
          onChange={(e) => setNickname(e.target.value)}
          className="w-full p-4 border border-slate-200 rounded-2xl mb-6 focus:ring-2 focus:ring-indigo-500 outline-none"
          placeholder="Nickname girin"
        />
        <button onClick={handleSave} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold">Kaydet</button>
      </motion.div>
    </motion.div>
  );
}
