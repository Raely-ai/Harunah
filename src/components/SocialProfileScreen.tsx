import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Sparkles, Edit2, Shield, ChevronLeft } from "lucide-react";
import { UserProfile, AppTab } from "../types";
import PhotoGallery from "./PhotoGallery";
import NicknameEditor from "./NicknameEditor";
import BioEditor from "./BioEditor";
import InterestsEditor from "./InterestsEditor";
import SocialSettingsModal from "./SocialSettingsModal";

interface SocialProfileScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: AppTab) => void;
}

export default function SocialProfileScreen({ currentUser, onNavigate }: SocialProfileScreenProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState(currentUser);

  const age = localUser.birthDate 
    ? new Date().getFullYear() - new Date(localUser.birthDate).getFullYear() 
    : 0;

  const isPremium = localUser.subscription?.status === 'active';

  const updateLocalUser = (field: string, value: any) => {
    setLocalUser(prev => ({
      ...prev,
      social: { ...prev.social, [field]: value }
    }));
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-zinc-100">
      <header className="bg-black/40 backdrop-blur-3xl border-b border-white/5 px-6 py-5 flex items-center gap-4 z-10">
        <button 
          onClick={() => onNavigate('profile')}
          className="p-2 -ml-2 rounded-full hover:bg-white/5 text-zinc-400 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-serif font-bold text-white tracking-tight">Sosyal Profilim</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 p-6 space-y-6">
        {/* Photos Card */}
        <div className="bg-white/[0.03] p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-lg text-white">Fotoğraflar</h3>
            </div>
            <button onClick={() => setEditingField('photos')} className="p-2 rounded-xl bg-white/5 text-amber-500 hover:bg-white/10 transition-all border border-white/5">
              <Edit2 size={16} />
            </button>
          </div>
          <PhotoGallery photos={localUser.social?.photos || []} uid={localUser.uid} />
        </div>

        {/* Nickname Card */}
        <div className="bg-white/[0.03] p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-2xl flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-lg text-white">Nickname</h3>
            </div>
            <p className="text-zinc-400 font-medium">@{localUser.social?.nickname || localUser.displayName}</p>
          </div>
          <button onClick={() => setEditingField('nickname')} className="p-3 rounded-xl bg-white/5 text-amber-500 hover:bg-white/10 transition-all border border-white/5">
            <Edit2 size={20} />
          </button>
        </div>

        {/* Bio Card */}
        <div className="bg-white/[0.03] p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-2xl flex justify-between items-center">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-lg text-white">Bio</h3>
            </div>
            <p className="text-zinc-400 text-sm leading-relaxed">{localUser.social?.bio || "Kendinden bahset..."}</p>
          </div>
          <button onClick={() => setEditingField('bio')} className="p-3 rounded-xl bg-white/5 text-amber-500 hover:bg-white/10 transition-all border border-white/5">
            <Edit2 size={20} />
          </button>
        </div>

        {/* Interests Card */}
        <div className="bg-white/[0.03] p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-lg text-white">İlgi Alanları</h3>
            </div>
            <button onClick={() => setEditingField('interests')} className="p-2 rounded-xl bg-white/5 text-amber-500 hover:bg-white/10 transition-all border border-white/5">
              <Edit2 size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(localUser.social?.interests || []).map(interest => (
              <span key={interest} className="px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-zinc-300 text-xs font-bold uppercase tracking-widest">
                {interest}
              </span>
            ))}
            {(localUser.social?.interests || []).length === 0 && (
              <p className="text-zinc-500 text-sm italic">Henüz ilgi alanı eklenmemiş.</p>
            )}
          </div>
        </div>

        {/* Privacy Card */}
        <div className="bg-white/[0.03] p-6 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-2xl flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 text-zinc-500">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Gizlilik Ayarları</h3>
              <p className="text-zinc-500 text-sm">Görünürlük ve bildirimler</p>
            </div>
          </div>
          <button onClick={() => setEditingField('privacy')} className="p-3 rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 transition-all border border-white/5">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {editingField === 'nickname' && <NicknameEditor uid={localUser.uid} currentNickname={localUser.social?.nickname || ''} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('nickname', val)} />}
        {editingField === 'bio' && <BioEditor uid={localUser.uid} currentBio={localUser.social?.bio || ''} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('bio', val)} />}
        {editingField === 'interests' && <InterestsEditor uid={localUser.uid} currentInterests={localUser.social?.interests || []} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('interests', val)} />}
        {editingField === 'privacy' && <SocialSettingsModal isOpen={true} onClose={() => setEditingField(null)} user={localUser} onUpdate={(user) => setLocalUser(user)} />}
      </AnimatePresence>
    </div>
  );
}
