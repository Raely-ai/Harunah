import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { socialService } from '../lib/socialService';

const AVAILABLE_INTERESTS = [
  // Sosyal
  "Kahve", "Gece gezmesi", "Sohbet", "Eğlence", "Yemek", "Seyahat", "Müzik",
  // Hobi
  "Spor", "Fitness", "Koşu", "Bisiklet", "Yüzme", "Yoga", "Meditasyon", "Doğa", "Kamp", "Yürüyüş",
  // Zeka
  "Psikoloji", "Felsefe", "Kitap", "Araştırma", "Tarih", "Bilim", "Teknoloji", "Yazılım", "Astronomi", "Arkeoloji",
  // Eğlence
  "Dizi", "Film", "Netflix", "Oyun", "Sinema", "Fotoğrafçılık", "Dans", "Moda", "Tasarım",
  // Mistik
  "Tarot", "Kahve falı", "Astroloji", "Enerji", "Burçlar", "Rüyalar",
  // Diğer
  "Sanat", "Evcil Hayvanlar", "Araba", "Motosiklet", "Tiyatro", "Resim", "Şiir", "Gönüllülük", "Borsa", "Kripto"
];

export default function InterestsEditor({ uid, currentInterests, onClose, onUpdate }: { uid: string, currentInterests: string[], onClose: () => void, onUpdate: (interests: string[]) => void }) {
  const [interests, setInterests] = useState(currentInterests || []);

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else {
      setInterests([...interests, interest]);
    }
  };

  const handleSave = async () => {
    await socialService.updateSocialField(uid, 'interests', interests);
    onUpdate(interests);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.95 }} className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-8 shrink-0">
          <div>
            <h3 className="font-black text-xl text-slate-800 tracking-tight">İlgi Alanları</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Seni yansıtan ilgi alanlarını seç ({interests.length})</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2.5 mb-8 overflow-y-auto no-scrollbar pr-1 touch-pan-y">
          {AVAILABLE_INTERESTS.map(interest => {
            const isSelected = interests.includes(interest);
            return (
              <button
                key={interest}
                onClick={() => toggleInterest(interest)}
                className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all duration-300 active:scale-95 ${
                  isSelected 
                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-100 border-transparent' 
                    : 'bg-slate-50 text-slate-500 border border-slate-100 hover:bg-slate-100'
                }`}
              >
                {interest}
              </button>
            );
          })}
        </div>

        <div className="shrink-0">
          <button 
            onClick={handleSave} 
            className="w-full bg-teal-600 text-white py-5 rounded-[1.5rem] font-black uppercase tracking-[0.2em] shadow-lg shadow-teal-200 active:scale-95 transition-all"
          >
            Seçimi Kaydet
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
