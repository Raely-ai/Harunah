import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, User, Calendar } from 'lucide-react';
import { socialService } from '../lib/socialService';
import { toast } from 'sonner';

interface BasicInfoEditorProps {
  uid: string;
  currentData: {
    nickname: string;
    birthDate: string;
    gender: 'erkek' | 'kadın';
    lookingFor?: string;
  };
  onClose: () => void;
  onUpdate: (data: any) => void;
}

export default function BasicInfoEditor({ uid, currentData, onClose, onUpdate }: BasicInfoEditorProps) {
  const [nickname, setNickname] = useState(currentData.nickname);
  const [birthDate, setBirthDate] = useState(currentData.birthDate || '');
  const [gender, setGender] = useState<'erkek' | 'kadın'>(currentData.gender || 'kadın');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;

    // Age control
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    if (age < 18) {
      toast.error("Lasya'yı kullanmak için 18 yaşından büyük olmalısın.");
      return;
    }

    setIsLoading(true);
    try {
      const success = await socialService.updateBasicInfo(uid, {
        nickname: nickname.trim(),
        birthDate,
        gender,
        lookingFor: currentData.lookingFor
      });
      if (success) {
        onUpdate({ nickname, birthDate, gender });
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-xl flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Temel Bilgiler</h3>
            <button onClick={onClose} className="p-2 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nickname */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Takma Adın</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Profil ismin..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  maxLength={15}
                  required
                />
              </div>
            </div>

            {/* Birth Date */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Doğum Tarihin</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  required
                />
              </div>
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cinsiyetin</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender('erkek')}
                  className={`py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                    gender === 'erkek' 
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-100' 
                      : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  Erkek
                </button>
                <button
                  type="button"
                  onClick={() => setGender('kadın')}
                  className={`py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all border ${
                    gender === 'kadın' 
                      ? 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-lg shadow-fuchsia-100' 
                      : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  Kadın
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 text-white py-4 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-slate-200 mt-4 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] transition-all"
            >
              {isLoading ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
