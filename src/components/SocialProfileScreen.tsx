import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, Sparkles, Edit2, Shield, ChevronLeft } from "lucide-react";
import { UserProfile, AppTab } from "../types";
import PhotoGallery from "./PhotoGallery";
import NicknameEditor from "./NicknameEditor";
import BioEditor from "./BioEditor";
import InterestsEditor from "./InterestsEditor";
import SocialSettingsModal from "./SocialSettingsModal";
import SocialCompatibilityHistory from "./SocialCompatibilityHistory";

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
    <div className="flex flex-col h-full bg-[#F6F4F8] text-body">
      <header className="header-gradient backdrop-blur-3xl border-b border-black/5 px-6 py-5 flex items-center gap-4 z-10">
        <button 
          onClick={() => onNavigate('profile')}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 text-muted transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-serif font-bold text-heading tracking-tight">Sosyal Profilim</h1>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 p-6 space-y-6">
        {/* Photos Card */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-lg text-heading">Fotoğraflar</h3>
            </div>
            <button onClick={() => setEditingField('photos')} className="p-2 rounded-xl bg-black/5 text-amber-600 hover:bg-black/10 transition-all border border-black/5">
              <Edit2 size={16} />
            </button>
          </div>
          <PhotoGallery photos={localUser.social?.photos || []} uid={localUser.uid} />
        </div>

        {/* Nickname Card */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-lg text-heading">Nickname</h3>
            </div>
            <p className="text-body font-medium">@{localUser.social?.nickname || localUser.displayName}</p>
          </div>
          <button onClick={() => setEditingField('nickname')} className="p-3 rounded-xl bg-black/5 text-amber-600 hover:bg-black/10 transition-all border border-black/5">
            <Edit2 size={20} />
          </button>
        </div>

        {/* Bio Card */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm flex justify-between items-center">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-lg text-heading">Bio</h3>
            </div>
            <p className="text-body text-sm leading-relaxed">{localUser.social?.bio || "Kendinden bahset..."}</p>
          </div>
          <button onClick={() => setEditingField('bio')} className="p-3 rounded-xl bg-black/5 text-amber-600 hover:bg-black/10 transition-all border border-black/5">
            <Edit2 size={20} />
          </button>
        </div>

        {/* Interests Card */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <h3 className="font-bold text-lg text-heading">İlgi Alanları</h3>
            </div>
            <button onClick={() => setEditingField('interests')} className="p-2 rounded-xl bg-black/5 text-amber-600 hover:bg-black/10 transition-all border border-black/5">
              <Edit2 size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(localUser.social?.interests || []).map(interest => (
              <span key={interest} className="px-5 py-2.5 rounded-2xl bg-black/5 border border-black/5 text-body text-xs font-bold uppercase tracking-widest">
                {interest}
              </span>
            ))}
            {(localUser.social?.interests || []).length === 0 && (
              <p className="text-muted text-sm italic">Henüz ilgi alanı eklenmemiş.</p>
            )}
          </div>
        </div>

        {/* Privacy Card */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center border border-black/5 text-muted">
              <Shield className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-heading">Gizlilik Ayarları</h3>
              <p className="text-muted text-sm">Görünürlük ve bildirimler</p>
            </div>
          </div>
          <button onClick={() => setEditingField('privacy')} className="p-3 rounded-xl bg-black/5 text-muted hover:bg-black/10 transition-all border border-black/5">
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Compatibility History Card */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-black/5 shadow-sm flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-600">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-heading">Uyum Geçmişi</h3>
              <p className="text-muted text-sm">Geçmiş analizlerin</p>
            </div>
          </div>
          <button onClick={() => setEditingField('compatibility_history')} className="p-3 rounded-xl bg-black/5 text-muted hover:bg-black/10 transition-all border border-black/5">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {editingField === 'nickname' && <NicknameEditor uid={localUser.uid} currentNickname={localUser.social?.nickname || ''} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('nickname', val)} />}
        {editingField === 'bio' && <BioEditor uid={localUser.uid} currentBio={localUser.social?.bio || ''} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('bio', val)} />}
        {editingField === 'interests' && <InterestsEditor uid={localUser.uid} currentInterests={localUser.social?.interests || []} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('interests', val)} />}
        {editingField === 'privacy' && <SocialSettingsModal isOpen={true} onClose={() => setEditingField(null)} user={localUser} onUpdate={(user) => setLocalUser(user)} />}
        {editingField === 'compatibility_history' && (
          <SocialCompatibilityHistory 
            currentUser={currentUser} 
            onBack={() => setEditingField(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
