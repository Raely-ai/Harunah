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
    <div className="w-full max-w-2xl mx-auto pt-10 px-6 pb-32 flex flex-col min-h-screen">
      {/* 1. HESAP BİLGİSİ (EN ÜST) */}
      <div className="flex flex-col items-center text-center mb-10">
        <h2 className="text-3xl font-serif font-bold text-heading tracking-tight">{user.displayName}</h2>
        <p className="text-muted font-medium text-sm mt-1">{user.email}</p>
      </div>

      <div className="space-y-8">
        {/* 2. SOSYAL PROFİL (KOŞULLU) */}
        {isSocialActive && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Users className="w-4 h-4 text-indigo-600" />
              <h3 className="text-[10px] font-black text-muted uppercase tracking-widest">Sosyal Profilim</h3>
            </div>
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onNavigate('social-profile')}
              className="w-full bg-white p-6 rounded-[2rem] border border-black/5 shadow-sm text-left group overflow-hidden relative"
            >
              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                      <img 
                        src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                        alt={user.social?.nickname || user.displayName}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h4 className="font-bold text-heading">@{user.social?.nickname || user.displayName}</h4>
                      <p className="text-xs text-muted font-medium">Profilini düzenle ve keşfet</p>
                    </div>
                  </div>
                  
                  {user.social?.bio && (
                    <p className="text-xs text-body line-clamp-2 mb-4 leading-relaxed opacity-80">
                      {user.social.bio}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {(user.social?.interests || []).slice(0, 3).map(interest => (
                      <span key={interest} className="px-3 py-1 rounded-full bg-indigo-50/50 border border-indigo-100/50 text-indigo-600 text-[9px] font-bold uppercase tracking-wider">
                        {interest}
                      </span>
                    ))}
                    {(user.social?.interests || []).length > 3 && (
                      <span className="px-2 py-1 rounded-full bg-black/5 text-muted text-[9px] font-bold">
                        +{(user.social?.interests || []).length - 3}
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-muted group-hover:text-indigo-600 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>

              {/* Decorative background element */}
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            </motion.button>
          </section>
        )}

        {/* 3. ADMIN BÖLÜMÜ (KOŞULLU) */}
        {isAdmin && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <h3 className="text-[10px] font-black text-muted uppercase tracking-widest">Yönetim</h3>
            </div>
            <button 
              onClick={onAdminPanel}
              className="w-full bg-white p-4 rounded-2xl border border-black/5 flex items-center justify-between group hover:bg-black/[0.01] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="font-bold text-heading text-sm">Yönetim Paneli</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted/40 group-hover:text-amber-600 transition-colors" />
            </button>
          </section>
        )}

        {/* 4. AYARLAR BÖLÜMÜ */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Settings className="w-4 h-4 text-muted" />
            <h3 className="text-[10px] font-black text-muted uppercase tracking-widest">Uygulama</h3>
          </div>
          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
            <button 
              onClick={onSettings}
              className="w-full p-4 flex items-center justify-between group hover:bg-black/[0.01] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-muted group-hover:text-heading transition-colors">
                  <Settings className="w-5 h-5" />
                </div>
                <span className="font-bold text-heading text-sm">Ayarlar</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted/40 group-hover:text-heading transition-colors" />
            </button>
          </div>
        </section>

        {/* 5. OTURUM / HESAP */}
        <section className="pt-4">
          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden divide-y divide-black/[0.03]">
            <button
              onClick={onLogout}
              className="w-full p-4 flex items-center justify-between group hover:bg-black/[0.01] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-muted group-hover:text-heading transition-colors">
                  <LogOut className="w-5 h-5" />
                </div>
                <span className="font-bold text-heading text-sm">Oturumu Kapat</span>
              </div>
              <ChevronRight className="w-5 h-5 text-muted/40 group-hover:text-heading transition-colors" />
            </button>

            <button
              onClick={onDeleteAccount}
              className="w-full p-4 flex items-center justify-between group hover:bg-red-500/5 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span className="font-bold text-red-600 text-sm">Hesabımı Sil</span>
              </div>
              <ChevronRight className="w-5 h-5 text-red-500/40 group-hover:text-red-500 transition-colors" />
            </button>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Lasya v1.0.0</p>
          </div>
        </section>
      </div>
    </div>
  );
}

