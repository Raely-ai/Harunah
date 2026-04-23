import React from 'react';
import { motion } from 'motion/react';
import { User, Settings, LogOut, ChevronRight, ShieldCheck, Trash2, Users, Heart, Zap, Sparkles } from 'lucide-react';
import { UserProfile, AppTab } from '../types';
import { isSocialProfileReady } from '../lib/socialUtils';

interface ProfileViewProps {
  user: UserProfile;
  onSettings: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  isAdmin?: boolean;
  onAdminPanel: () => void;
  onNavigate: (tab: AppTab) => void;
}

export default function ProfileView({ user, onSettings, onLogout, onDeleteAccount, isAdmin, onAdminPanel, onNavigate }: ProfileViewProps) {
  const isSocialActive = isSocialProfileReady(user);

  return (
    <div className="w-full max-w-2xl mx-auto pt-16 px-6 pb-32 flex flex-col min-h-screen bg-[#FAFAFC]">
      {/* 1. HESAP BİLGİSİ (EN ÜST) */}
      <div className="flex flex-col items-center text-center mb-12">
        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-violet-600 p-1 shadow-xl mb-6 ring-4 ring-white">
          <img 
            src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'profile'}`} 
            alt={user?.displayName || 'User'}
            className="w-full h-full object-cover rounded-[1.8rem]"
          />
        </div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">{user.displayName}</h2>
        <p className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] mt-2">{user.email}</p>
      </div>

      <div className="space-y-8">
        {/* 2. SOSYAL PROFİL (KOŞULLU) */}
        {isSocialActive && (
          <section>
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sosyal Dünyan</h3>
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onNavigate('social-profile')}
              className="w-full bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-[0_10px_30px_rgba(0,0,0,0.03)] text-left group overflow-hidden relative"
            >
              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-slate-50 shadow-lg">
                      <img 
                        src={user?.social?.photos?.[0] || user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid || 'profile'}`} 
                        alt={user?.social?.nickname || user?.displayName || 'User'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-800 tracking-tight">@{user.social?.nickname || user.displayName}</h4>
                      <div className="flex items-center gap-2 text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-0.5">
                        <Sparkles size={10} className="fill-indigo-500" />
                        PROFİLİNİ GÜNCELLE
                      </div>
                    </div>
                  </div>
                  
                  {user.social?.bio && (
                    <p className="text-sm text-slate-500 font-medium line-clamp-2 mb-5 leading-relaxed bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                      {user.social.bio}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {(user.social?.interests || []).slice(0, 3).map(interest => (
                      <span key={interest} className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                        {interest}
                      </span>
                    ))}
                    {(user.social?.interests || []).length > 3 && (
                      <span className="px-3 py-1.5 rounded-full bg-slate-50 text-slate-400 text-[10px] font-black">
                        +{(user.social?.interests || []).length - 3}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </div>

              {/* Decorative background gradient */}
              <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-gradient-to-br from-indigo-500/10 to-violet-500/5 rounded-full blur-3xl pointer-events-none group-hover:scale-125 transition-transform" />
            </motion.button>
          </section>
        )}

        {/* 3. ADMIN BÖLÜMÜ (KOŞULLU) */}
        {isAdmin && (
          <section>
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Sistem Yönetimi</h3>
            </div>
            <button 
              onClick={onAdminPanel}
              className="w-full bg-white p-5 rounded-3xl border border-slate-100 flex items-center justify-between group hover:bg-slate-50 transition-all shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Zap className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-800">Yönetim Paneli</span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-600 transition-colors" />
            </button>
          </section>
        )}

        {/* 4. AYARLAR BÖLÜMÜ */}
        <section>
          <div className="flex items-center gap-2 mb-4 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hesap Menüsü</h3>
          </div>
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col divide-y divide-slate-50">
            {/* Settings */}
            <button 
              onClick={onSettings}
              className="w-full p-5 flex items-center justify-between group hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 group-hover:bg-slate-800 group-hover:text-white transition-all">
                  <Settings className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-700">Genel Ayarlar</span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-800 transition-colors" />
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="w-full p-5 flex items-center justify-between group hover:bg-slate-50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-500 group-hover:bg-slate-800 group-hover:text-white transition-all">
                  <LogOut className="w-6 h-6" />
                </div>
                <span className="font-bold text-slate-700">Oturumu Kapat</span>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-800 transition-colors" />
            </button>

            {/* Delete Account */}
            <button
              onClick={onDeleteAccount}
              className="w-full p-5 flex items-center justify-between group hover:bg-red-50/50 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-600 group-hover:text-white transition-all">
                  <Trash2 className="w-6 h-6" />
                </div>
                <span className="font-bold text-red-600">Hesabı Sil</span>
              </div>
              <ChevronRight className="w-5 h-5 text-red-200 group-hover:text-red-600 transition-colors" />
            </button>
          </div>
        </section>

        <div className="pt-8 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Lasya Premium v1.0.0</p>
        </div>
      </div>
    </div>
  );
}

