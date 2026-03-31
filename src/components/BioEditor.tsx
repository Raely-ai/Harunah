import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { updateSocialField } from '../services/socialService';

export default function BioEditor({ uid, currentBio, onClose, onUpdate }: { uid: string, currentBio: string, onClose: () => void, onUpdate: (bio: string) => void }) {
  const [bio, setBio] = useState(currentBio);

  const handleSave = async () => {
    await updateSocialField(uid, 'bio', bio);
    onUpdate(bio);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="bg-white p-6 rounded-[2rem] w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg">Bio Düzenle</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <textarea 
          value={bio} 
          onChange={(e) => setBio(e.target.value)}
          className="w-full p-4 border border-slate-200 rounded-2xl mb-6 focus:ring-2 focus:ring-indigo-500 outline-none h-32"
          placeholder="Kendinden bahset..."
        />
        <button onClick={handleSave} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold">Kaydet</button>
      </motion.div>
    </motion.div>
  );
}
