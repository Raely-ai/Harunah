import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ChevronRight, 
  Sparkles, 
  Edit2, 
  Shield, 
  ChevronLeft, 
  Bell, 
  ChevronDown, 
  Camera,
  AtSign,
  User,
  MessageCircle,
  UserPlus
} from "lucide-react";
import { UserProfile, AppTab } from "../types";
import PhotoGallery from "./PhotoGallery";
import NicknameEditor from "./NicknameEditor";
import BioEditor from "./BioEditor";
import InterestsEditor from "./InterestsEditor";
import { walletService } from "../lib/walletService";
import { toast } from "sonner";

interface SocialProfileScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: AppTab) => void;
}

export default function SocialProfileScreen({ currentUser, onNavigate }: SocialProfileScreenProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState(currentUser);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const updateLocalUser = (field: string, value: any) => {
    setLocalUser(prev => ({
      ...prev,
      social: { ...prev.social!, [field]: value }
    }));
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      const currentSettings = localUser.social?.settings || { 
        whoCanMessage: 'everyone', 
        whoCanAddFriend: 'everyone', 
        notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true } 
      };
      let newSettings = { ...currentSettings };
      
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        (newSettings as any)[parent] = {
          ...(newSettings as any)[parent],
          [child]: value
        };
      } else {
        (newSettings as any)[key] = value;
      }

      const result = await walletService.updateSocialSettings(newSettings);
      
      if (result.success) {
        const updatedUser = { 
          ...localUser, 
          social: { 
            ...localUser.social!, 
            settings: newSettings 
          } 
        };
        setLocalUser(updatedUser);
        toast.success("Ayarlar güncellendi.");
      }
    } catch (error: any) {
      console.error("Settings update error:", error);
      toast.error(error.message || "Ayarlar güncellenemedi.");
    }
  };

  const settings = localUser.social?.settings || { 
    whoCanMessage: 'everyone', 
    whoCanAddFriend: 'everyone', 
    notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true } 
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div className="flex flex-col h-full bg-[#FAFAFC] text-slate-700">
      {/* Premium Gradient Header */}
      <header className="relative pt-12 pb-8 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/20 rounded-full blur-3xl animate-pulse" />
        
        <div className="relative flex items-center justify-between z-10">
          <button 
            onClick={() => onNavigate('profile')}
            className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 transition-all active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-black text-white tracking-wider uppercase">Sosyal Profilim</h1>
          <div className="w-10 h-10" /> {/* Spacer */}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 -mt-6 rounded-t-[2.5rem] bg-[#FAFAFC] relative z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pt-8 px-6 space-y-6">
        
        {/* Photo Gallery - Redesigned Grid */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Camera className="w-4 h-4 text-indigo-600" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">Görsellerin</h3>
          </div>
          <PhotoGallery photos={localUser.social?.photos || []} uid={localUser.uid} />
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4 text-center">
            Sürükleyip bırakarak sıralayabilirsin
          </p>
        </section>

        {/* Info Cards Grid */}
        <div className="grid grid-cols-1 gap-4">
          {/* Nickname - Inline Trigger */}
          <button 
            onClick={() => setEditingField('nickname')}
            className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all active:scale-[0.98] hover:bg-slate-50/50 text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <AtSign className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-black text-indigo-600/40 uppercase tracking-widest">Kullanıcı Adı</span>
              <p className="font-bold text-slate-800 truncate">@{localUser.social?.nickname || localUser.displayName}</p>
            </div>
            <Edit2 className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Bio - Inline Trigger */}
          <button 
            onClick={() => setEditingField('bio')}
            className="group bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4 transition-all active:scale-[0.98] hover:bg-slate-50/50 text-left"
          >
            <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <User className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1">
              <span className="text-[10px] font-black text-violet-600/40 uppercase tracking-widest">Hakkımda</span>
              <p className="text-sm font-medium text-slate-600 line-clamp-1">{localUser.social?.bio || "Kendini tanıt..."}</p>
            </div>
            <Edit2 className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Interests Section */}
        <section className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-teal-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-800">İlgi Alanları</h3>
            </div>
            <button 
              onClick={() => setEditingField('interests')}
              className="p-2.5 rounded-xl bg-teal-50 text-teal-600 hover:bg-teal-100 transition-all border border-teal-100/50"
            >
              <Edit2 size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(localUser.social?.interests || []).map(interest => (
              <span key={interest} className="px-4 py-2 rounded-full bg-slate-50 border border-slate-100 text-slate-500 text-[11px] font-black uppercase tracking-wider">
                {interest}
              </span>
            ))}
            {(localUser.social?.interests || []).length === 0 && (
              <p className="text-slate-400 text-xs italic">Seninle ilgili detayları ekle.</p>
            )}
          </div>
        </section>

        {/* MERGED SETTINGS SECTION (Accordions) */}
        <section className="space-y-4">
          <h4 className="px-4 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Ayarlar & Gizlilik</h4>
          
          {/* Privacy Accordion */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <button 
              onClick={() => toggleSection('privacy')}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-fuchsia-50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-fuchsia-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-800">Gizlilik Ayarları</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">İstekler ve Görünürlük</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${activeSection === 'privacy' ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {activeSection === 'privacy' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-slate-50/30 px-5 pb-6 space-y-5"
                >
                  <div className="h-px w-full bg-slate-100 mb-2" />
                  
                  {/* Who can message */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                       <MessageCircle className="w-3 h-3" /> Mesaj Gönderme
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['everyone', 'friends', 'nobody'] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => handleUpdateSetting('whoCanMessage', option)}
                          className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                            settings.whoCanMessage === option
                              ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-200'
                              : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {option === 'everyone' ? 'Herkes' : option === 'friends' ? 'Arkadaşlar' : 'Hiç Kimse'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Who can add friend */}
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                       <UserPlus className="w-3 h-3" /> Arkadaşlık İstekleri
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['everyone', 'nobody'] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => handleUpdateSetting('whoCanAddFriend', option)}
                          className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                            settings.whoCanAddFriend === option
                              ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-200'
                              : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {option === 'everyone' ? 'Herkes' : 'Hiç Kimse'}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications Accordion */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <button 
              onClick={() => toggleSection('notifications')}
              className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-800">Bildirimler</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Uygulama İçi Uyarılar</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${activeSection === 'notifications' ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {activeSection === 'notifications' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden bg-slate-50/30 px-5 pb-6"
                >
                  <div className="h-px w-full bg-slate-100 mb-4" />
                  <div className="space-y-2">
                    {[
                      { id: 'messages', label: 'Mesajlar', icon: MessageCircle },
                      { id: 'friendRequests', label: 'Arkadaşlık İstekleri', icon: UserPlus },
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100/50">
                        <div className="flex items-center gap-3">
                          <item.icon className="w-4 h-4 text-amber-500" />
                          <span className="text-xs font-bold text-slate-600">{item.label}</span>
                        </div>
                        <button
                          onClick={() => handleUpdateSetting(`notifications.${item.id}`, !(settings.notifications as any)[item.id])}
                          className={`w-11 h-6 rounded-full transition-all relative ${
                            (settings.notifications as any)[item.id] ? 'bg-amber-500' : 'bg-slate-200'
                          }`}
                        >
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${
                            (settings.notifications as any)[item.id] ? 'left-6' : 'left-1'
                          }`} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      {/* FOOTER SPACER */}
      <div className="h-20" />

      {/* EDIT MODALS (Existing logic kept but styles can be polished within components) */}
      <AnimatePresence>
        {editingField === 'nickname' && <NicknameEditor uid={localUser.uid} currentNickname={localUser.social?.nickname || ''} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('nickname', val)} />}
        {editingField === 'bio' && <BioEditor uid={localUser.uid} currentBio={localUser.social?.bio || ''} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('bio', val)} />}
        {editingField === 'interests' && <InterestsEditor uid={localUser.uid} currentInterests={localUser.social?.interests || []} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('interests', val)} />}
      </AnimatePresence>
    </div>
  );
}
