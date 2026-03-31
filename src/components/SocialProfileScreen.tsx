import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Sparkles, Edit2, Shield } from "lucide-react";
import { UserProfile } from "../types";
import PhotoGallery from "./PhotoGallery";
import NicknameEditor from "./NicknameEditor";
import BioEditor from "./BioEditor";
import InterestsEditor from "./InterestsEditor";
import SocialSettingsModal from "./SocialSettingsModal";

interface SocialProfileScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
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
    <div className="flex flex-col h-full bg-slate-50 text-slate-900">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex flex-col gap-1 z-10">
        <h1 className="text-2xl font-serif font-bold text-slate-900">Profilim</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 p-6 space-y-6">
        {/* Photos Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Fotoğraflar</h3>
            <button onClick={() => setEditingField('photos')} className="text-indigo-600"><Edit2 size={16} /></button>
          </div>
          <PhotoGallery photos={localUser.social?.photos || []} uid={localUser.uid} />
        </div>

        {/* Nickname Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">Nickname</h3>
            <p className="text-slate-500">@{localUser.social?.nickname || localUser.displayName}</p>
          </div>
          <button onClick={() => setEditingField('nickname')} className="text-indigo-600"><Edit2 size={20} /></button>
        </div>

        {/* Bio Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center">
          <div className="flex-1 mr-4">
            <h3 className="font-bold text-lg mb-1">Bio</h3>
            <p className="text-slate-500 text-sm">{localUser.social?.bio || "Kendinden bahset..."}</p>
          </div>
          <button onClick={() => setEditingField('bio')} className="text-indigo-600"><Edit2 size={20} /></button>
        </div>

        {/* Interests Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">İlgi Alanları</h3>
            <button onClick={() => setEditingField('interests')} className="text-indigo-600"><Edit2 size={16} /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(localUser.social?.interests || []).map(interest => (
              <span key={interest} className="px-4 py-2 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">{interest}</span>
            ))}
          </div>
        </div>

        {/* Privacy Card */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100">
              <Shield className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Gizlilik Ayarları</h3>
              <p className="text-slate-500 text-sm">Görünürlük ve bildirimler</p>
            </div>
          </div>
          <button onClick={() => setEditingField('privacy')} className="text-indigo-600"><ChevronRight size={24} /></button>
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
