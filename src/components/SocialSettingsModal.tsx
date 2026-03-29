import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Shield, 
  MessageSquare, 
  UserPlus, 
  Bell, 
  Ban, 
  ChevronRight, 
  Check,
  Loader2,
  Trash2,
  UserX
} from 'lucide-react';
import { SocialProfile, SocialSettings } from '../types';
import { doc, updateDoc, getDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface SocialSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: SocialProfile;
  onUpdate: (updatedProfile: SocialProfile) => void;
}

export const SocialSettingsModal: React.FC<SocialSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onUpdate
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'notifications' | 'blocked'>('privacy');
  const [settings, setSettings] = useState<SocialSettings>(profile.settings || {
    whoCanMessage: 'everyone',
    whoCanAddFriend: 'everyone',
    notifications: {
      messages: true,
      friendRequests: true,
      roomInvites: true,
      gifts: true
    }
  });
  const [blockedUsers, setBlockedUsers] = useState<{uid: string, nickname: string, photoURL?: string}[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingBlocked, setIsFetchingBlocked] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'blocked' && profile.blockedUids && profile.blockedUids.length > 0) {
      fetchBlockedUsers();
    }
  }, [isOpen, activeTab]);

  const fetchBlockedUsers = async () => {
    if (!profile.blockedUids || profile.blockedUids.length === 0) return;
    
    setIsFetchingBlocked(true);
    try {
      const users = await Promise.all(
        profile.blockedUids.map(async (uid) => {
          const userDoc = await getDoc(doc(db, 'socialProfiles', uid));
          if (userDoc.exists()) {
            const data = userDoc.data() as SocialProfile;
            return { uid, nickname: data.nickname, photoURL: data.photoURL };
          }
          return { uid, nickname: 'Bilinmeyen Kullanıcı' };
        })
      );
      setBlockedUsers(users);
    } catch (error) {
      console.error('Error fetching blocked users:', error);
    } finally {
      setIsFetchingBlocked(false);
    }
  };

  const handleSave = async (newSettings: SocialSettings) => {
    setIsLoading(true);
    try {
      const profileRef = doc(db, 'socialProfiles', profile.uid);
      await updateDoc(profileRef, {
        settings: newSettings,
        updatedAt: new Date().toISOString()
      });
      
      onUpdate({
        ...profile,
        settings: newSettings
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsLoading(true);
      setTimeout(() => setIsLoading(false), 500);
    }
  };

  const handleUnblock = async (uid: string) => {
    try {
      const profileRef = doc(db, 'socialProfiles', profile.uid);
      await updateDoc(profileRef, {
        blockedUids: arrayRemove(uid)
      });
      
      const updatedBlockedUids = profile.blockedUids?.filter(id => id !== uid) || [];
      onUpdate({
        ...profile,
        blockedUids: updatedBlockedUids
      });
      
      setBlockedUsers(prev => prev.filter(u => u.uid !== uid));
    } catch (error) {
      console.error('Error unblocking user:', error);
    }
  };

  const updatePrivacy = (key: keyof Pick<SocialSettings, 'whoCanMessage' | 'whoCanAddFriend'>, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    handleSave(newSettings);
  };

  const updateNotification = (key: keyof SocialSettings['notifications']) => {
    const newSettings = {
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key]
      }
    };
    setSettings(newSettings);
    handleSave(newSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-bottom border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-serif font-bold text-white">Sosyal Ayarlar</h2>
              <p className="text-xs text-zinc-500">Gizlilik ve tercihlerini yönet.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-bottom border-white/5">
          {[
            { id: 'privacy', label: 'Gizlilik', icon: Shield },
            { id: 'notifications', label: 'Bildirimler', icon: Bell },
            { id: 'blocked', label: 'Engellenenler', icon: Ban }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-4 flex items-center justify-center gap-2 border-b-2 transition-all ${
                activeTab === tab.id 
                  ? 'border-indigo-500 text-indigo-400' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            {activeTab === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-8"
              >
                {/* Messaging Privacy */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Kimler Mesaj Atabilir?</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'everyone', label: 'Herkes', desc: 'Tüm kullanıcılar sana mesaj isteği gönderebilir.' },
                      { id: 'friends', label: 'Sadece Arkadaşlar', desc: 'Sadece arkadaş olduğun kişiler mesaj atabilir.' },
                      { id: 'nobody', label: 'Hiç Kimse', desc: 'Kimse sana yeni mesaj gönderemez.' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => updatePrivacy('whoCanMessage', option.id)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          settings.whoCanMessage === option.id
                            ? 'bg-indigo-500/10 border-indigo-500/50'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-bold ${settings.whoCanMessage === option.id ? 'text-indigo-400' : 'text-white'}`}>
                            {option.label}
                          </span>
                          {settings.whoCanMessage === option.id && <Check className="w-4 h-4 text-indigo-400" />}
                        </div>
                        <p className="text-xs text-zinc-500">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Friend Request Privacy */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Kimler Arkadaşlık İsteği Gönderebilir?</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { id: 'everyone', label: 'Herkes', desc: 'Tüm kullanıcılar sana arkadaşlık isteği gönderebilir.' },
                      { id: 'nobody', label: 'Hiç Kimse', desc: 'Arkadaşlık isteklerini tamamen kapat.' }
                    ].map((option) => (
                      <button
                        key={option.id}
                        onClick={() => updatePrivacy('whoCanAddFriend', option.id)}
                        className={`p-4 rounded-2xl border text-left transition-all ${
                          settings.whoCanAddFriend === option.id
                            ? 'bg-indigo-500/10 border-indigo-500/50'
                            : 'bg-white/5 border-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-bold ${settings.whoCanAddFriend === option.id ? 'text-indigo-400' : 'text-white'}`}>
                            {option.label}
                          </span>
                          {settings.whoCanAddFriend === option.id && <Check className="w-4 h-4 text-indigo-400" />}
                        </div>
                        <p className="text-xs text-zinc-500">{option.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {[
                  { id: 'messages', label: 'Yeni Mesajlar', desc: 'Biri sana mesaj attığında bildirim al.' },
                  { id: 'friendRequests', label: 'Arkadaşlık İstekleri', desc: 'Yeni bir istek geldiğinde bildirim al.' },
                  { id: 'roomInvites', label: 'Oda Davetleri', desc: 'Bir odaya davet edildiğinde bildirim al.' },
                  { id: 'gifts', label: 'Hediyeler', desc: 'Hediye aldığında bildirim al.' }
                ].map((item) => (
                  <div 
                    key={item.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-white">{item.label}</p>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => updateNotification(item.id as any)}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        settings.notifications[item.id as keyof SocialSettings['notifications']]
                          ? 'bg-indigo-500'
                          : 'bg-zinc-700'
                      }`}
                    >
                      <motion.div
                        animate={{ x: settings.notifications[item.id as keyof SocialSettings['notifications']] ? 24 : 4 }}
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                      />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'blocked' && (
              <motion.div
                key="blocked"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {isFetchingBlocked ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    <p className="text-sm text-zinc-500">Liste yükleniyor...</p>
                  </div>
                ) : blockedUsers.length > 0 ? (
                  <div className="space-y-2">
                    {blockedUsers.map((user) => (
                      <div 
                        key={user.uid}
                        className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden border border-white/10">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt={user.nickname} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <UserX className="w-5 h-5 text-zinc-600" />
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-white">{user.nickname}</span>
                        </div>
                        <button
                          onClick={() => handleUnblock(user.uid)}
                          className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-colors flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Engeli Kaldır
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Ban className="w-8 h-8 text-zinc-600" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Engellenen kullanıcı yok</p>
                      <p className="text-xs text-zinc-500 mt-1">Engellediğin kişiler burada görünür.</p>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/5 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                <span className="text-xs text-indigo-400">Kaydediliyor...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-400">Ayarlar güncel</span>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white/5 text-white text-sm font-bold hover:bg-white/10 transition-colors"
          >
            Kapat
          </button>
        </div>
      </motion.div>
    </div>
  );
};
