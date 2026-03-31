import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { updateSocialField } from '../services/socialService';

const AVAILABLE_INTERESTS = [
  "Seyahat", "Müzik", "Kitap", "Spor", "Sanat", "Yemek", "Doğa", "Teknoloji", "Sinema", "Fotoğrafçılık",
  "Oyun", "Dans", "Yoga", "Meditasyon", "Moda", "Tasarım", "Yazılım", "Girişimcilik", "Psikoloji", "Tarih",
  "Bilim", "Astronomi", "Felsefe", "Yabancı Dil", "Yemek Yapma", "Kahve", "Çay", "Bahçecilik", "Evcil Hayvanlar", "Araba",
  "Motosiklet", "Bisiklet", "Yüzme", "Koşu", "Fitness", "Dövüş Sanatları", "Tiyatro", "Resim", "Heykel", "Müzik Aleti",
  "Şiir", "Yazarlık", "Dijital Pazarlama", "Borsa", "Kripto", "Gönüllülük", "Siyaset", "Ekoloji", "Mimari", "Dekorasyon"
];

export default function InterestsEditor({ uid, currentInterests, onClose, onUpdate }: { uid: string, currentInterests: string[], onClose: () => void, onUpdate: (interests: string[]) => void }) {
  const [interests, setInterests] = useState(currentInterests || []);

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else if (interests.length < 5) {
      setInterests([...interests, interest]);
    }
  };

  const handleSave = async () => {
    await updateSocialField(uid, 'interests', interests);
    onUpdate(interests);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
      <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="bg-white p-6 rounded-[2rem] w-full max-w-sm shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-lg">İlgi Alanları (Max 5)</h3>
          <button onClick={onClose}><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="flex flex-wrap gap-2 mb-6 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
          {AVAILABLE_INTERESTS.map(interest => (
            <button
              key={interest}
              onClick={() => toggleInterest(interest)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                interests.includes(interest) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {interest}
            </button>
          ))}
        </div>
        <button onClick={handleSave} className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold">Kaydet</button>
      </motion.div>
    </motion.div>
  );
}
