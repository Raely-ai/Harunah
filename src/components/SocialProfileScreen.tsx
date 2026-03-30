import React from "react";
import { motion } from "motion/react";
import { 
  ChevronRight, 
  Sparkles,
  Image as ImageIcon,
  Heart,
  FileText,
  Shield
} from "lucide-react";
import { UserProfile } from "../types";

interface SocialProfileScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
  onEdit: () => void;
}

export default function SocialProfileScreen({ currentUser, onNavigate, onEdit }: SocialProfileScreenProps) {
  const age = currentUser.birthDate 
    ? new Date().getFullYear() - new Date(currentUser.birthDate).getFullYear() 
    : 0;

  const isPremium = currentUser.subscription?.status === 'active';

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex flex-col gap-1 z-10">
        <h1 className="text-2xl font-serif font-bold text-slate-900">Profilim</h1>
        <p className="text-xs font-medium text-slate-500">Kendini ifade et.</p>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="p-6 space-y-8">
          
          {/* Profile Header (Photo, Name, Age) */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 border-4 border-white shadow-xl shadow-slate-200/50">
                <img 
                  src={currentUser.photos?.[0] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`} 
                  alt="Profile"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              {isPremium && (
                <div className="absolute bottom-0 right-0 bg-gradient-to-br from-amber-300 to-orange-500 text-white p-2 rounded-full border-2 border-white shadow-sm">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {currentUser.nickname || currentUser.displayName}, {age}
              </h2>
              <p className="text-sm text-slate-500 mt-1">{currentUser.bio || "Henüz bir bio eklenmemiş."}</p>
            </div>
          </div>

          {/* Premium Banner */}
          <button 
            onClick={() => !isPremium && onNavigate('wallet')}
            className={`w-full p-4 rounded-3xl flex items-center justify-between transition-transform active:scale-[0.98] ${
              isPremium 
                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20' 
                : 'bg-white border border-slate-200 text-slate-900 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isPremium ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-sm">
                  {isPremium ? 'Premium Aktif' : 'Premium\'a Geç'}
                </h3>
                <p className={`text-xs ${isPremium ? 'text-indigo-100' : 'text-slate-500'}`}>
                  {isPremium ? 'Tüm ayrıcalıklardan faydalanıyorsun.' : 'Sınırsız beğeni ve daha fazlası.'}
                </p>
              </div>
            </div>
            {!isPremium && <ChevronRight className="w-5 h-5 text-slate-400" />}
          </button>

          {/* Settings List */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100">
              <SettingItem 
                icon={<ImageIcon className="w-5 h-5 text-indigo-500" />} 
                title="Fotoğrafları Düzenle" 
                subtitle={`${currentUser.photos?.length || 0}/5 Fotoğraf`}
                onClick={onEdit}
              />
              <SettingItem 
                icon={<Heart className="w-5 h-5 text-rose-500" />} 
                title="İlgi Alanları" 
                subtitle={currentUser.interests?.length ? `${currentUser.interests.length} ilgi alanı seçili` : 'Ekle'}
                onClick={onEdit}
              />
              <SettingItem 
                icon={<FileText className="w-5 h-5 text-emerald-500" />} 
                title="Bio Düzenle" 
                subtitle="Kendinden bahset"
                onClick={onEdit}
              />
              <SettingItem 
                icon={<Shield className="w-5 h-5 text-slate-500" />} 
                title="Gizlilik Ayarları" 
                subtitle="Görünürlük ve bildirimler"
                onClick={() => {}}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function SettingItem({ icon, title, subtitle, onClick }: { icon: React.ReactNode, title: string, subtitle: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-left">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
          {icon}
        </div>
        <div>
          <h4 className="font-bold text-sm text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-slate-300" />
    </button>
  );
}
