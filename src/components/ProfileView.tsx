import React from 'react';
import { motion } from 'motion/react';
import { User, Settings, LogOut, ChevronRight, Calendar, Star, Wallet, Zap, ShieldCheck, Trash2 } from 'lucide-react';
import { UserProfile } from '../types';

interface ProfileViewProps {
  user: UserProfile;
  onEdit: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  isAdmin?: boolean;
  onAdminPanel: () => void;
}

export default function ProfileView({ user, onEdit, onSettings, onLogout, onDeleteAccount, isAdmin, onAdminPanel }: ProfileViewProps) {
  const SIGNS = [
    { id: 'aries', name: 'Koç' },
    { id: 'taurus', name: 'Boğa' },
    { id: 'gemini', name: 'İkizler' },
    { id: 'cancer', name: 'Yengeç' },
    { id: 'leo', name: 'Aslan' },
    { id: 'virgo', name: 'Başak' },
    { id: 'libra', name: 'Terazi' },
    { id: 'scorpio', name: 'Akrep' },
    { id: 'sagittarius', name: 'Yay' },
    { id: 'capricorn', name: 'Oğlak' },
    { id: 'aquarius', name: 'Kova' },
    { id: 'pisces', name: 'Balık' },
  ];

  const userSignName = SIGNS.find(s => s.id === user.horoscope)?.name;

  return (
    <div className="w-full max-w-2xl mx-auto pt-8 px-4 pb-24">
      {/* Profile Header */}
      <div className="flex flex-col items-center mb-10">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mb-6"
        >
          <div className="w-28 h-28 rounded-[2rem] bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center overflow-hidden shadow-2xl shadow-purple-500/10">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-12 h-12 text-amber-400/60" />
            )}
          </div>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onEdit}
            className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-amber-500 text-black flex items-center justify-center shadow-lg border-4 border-[#050505]"
          >
            <User className="w-5 h-5" />
          </motion.button>
        </motion.div>

        <h2 className="text-3xl font-serif font-bold text-amber-50 mb-1">{user.displayName}</h2>
        <p className="text-purple-200/40 font-medium mb-6">{user.email}</p>

        <div className="flex gap-3">
          {user.birthDate && (
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-purple-200/60">
              <Calendar className="w-4 h-4 text-amber-400/60" />
              <span>{new Date(user.birthDate).toLocaleDateString('tr-TR')}</span>
            </div>
          )}
          {userSignName && (
            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2 text-sm text-purple-200/60">
              <Star className="w-4 h-4 text-amber-400/60" />
              <span>{userSignName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Balance & Subscription Summary */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-5 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-purple-200/40 uppercase tracking-widest">Bakiyem</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-amber-50">{user.credits}</span>
            <span className="text-xs text-purple-200/40">Kredi</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold text-purple-200/40 uppercase tracking-widest">Abonelik</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-amber-50 capitalize">
              {user.subscription?.status === 'active' ? user.subscription.type : 'Standart'}
            </span>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="space-y-3 mb-10">
        {isAdmin && (
          <button 
            onClick={onAdminPanel}
            className="w-full p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5" />
              </div>
              <span className="font-bold text-amber-400">Yönetim Paneli</span>
            </div>
            <ChevronRight className="w-5 h-5 text-amber-400/40 group-hover:text-amber-400 transition-colors" />
          </button>
        )}

        <button 
          onClick={onSettings}
          className="w-full p-5 rounded-2xl border border-white/5 bg-white/5 flex items-center justify-between group hover:bg-white/10 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40 group-hover:text-amber-400 transition-colors">
              <Settings className="w-5 h-5" />
            </div>
            <span className="font-bold text-amber-50/80">Ayarlar</span>
          </div>
          <ChevronRight className="w-5 h-5 text-purple-200/20 group-hover:text-amber-400 transition-colors" />
        </button>
      </div>

      {/* Logout & Delete */}
      <div className="space-y-3">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-white/5 border border-white/10 text-purple-200/60 font-bold hover:bg-white/10 transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span>Oturumu Kapat</span>
        </button>

        <button
          onClick={onDeleteAccount}
          className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400/60 font-bold hover:bg-red-500/10 transition-all text-xs uppercase tracking-widest"
        >
          <Trash2 className="w-4 h-4" />
          <span>Hesabı Kalıcı Olarak Sil</span>
        </button>
      </div>
    </div>
  );
}
