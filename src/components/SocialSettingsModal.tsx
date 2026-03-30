import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Bell, MessageCircle, UserPlus, Users, Gift, Settings } from 'lucide-react';
import { UserProfile } from '../types';
import { db, handleFirestoreError } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface SocialSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onUpdate: (user: UserProfile) => void;
}

const SocialSettingsModal: React.FC<SocialSettingsModalProps> = ({ isOpen, onClose, user, onUpdate }) => {
  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      const updatedSocial = { ...(user.social || { enabled: false, profileCompleted: false, nickname: '', gender: 'erkek', lookingFor: '', bio: '', photos: [], interests: [], visible: true, banned: false, settings: { whoCanMessage: 'everyone', whoCanAddFriend: 'everyone', notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true } } }) };
      
      if (key.includes('.')) {
        const [parent, child] = key.split('.');
        (updatedSocial as any).settings[parent] = {
          ...(updatedSocial as any).settings[parent],
          [child]: value
        };
      } else {
        (updatedSocial as any).settings[key] = value;
      }

      const updatedUser = { ...user, social: updatedSocial };
      await updateDoc(doc(db, 'users', user.uid), {
        social: updatedSocial,
        updatedAt: new Date().toISOString()
      });
      
      onUpdate(updatedUser);
    } catch (error) {
      handleFirestoreError(error, 'update' as any, `users/${user.uid}`);
    }
  };

  const settings = user.social?.settings || { whoCanMessage: 'everyone', whoCanAddFriend: 'everyone', notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true } };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-8 border-b border-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <Settings className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Sosyal Ayarlar</h2>
                  <p className="text-sm text-slate-500">@{user.social?.nickname || user.displayName} için gizlilik ve bildirimler</p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-8 overflow-y-auto max-h-[60vh] custom-scrollbar">
              {/* Privacy Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600/60 uppercase tracking-widest text-[10px] font-bold">
                  <Shield className="w-3 h-3" />
                  <span>Gizlilik Ayarları</span>
                </div>
                
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Mesaj Gönderme</p>
                          <p className="text-xs text-slate-500">Kimler mesaj gönderebilir?</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['everyone', 'friends', 'nobody'] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => handleUpdateSetting('whoCanMessage', option)}
                          className={`py-2.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                            settings.whoCanMessage === option
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          {option === 'everyone' ? 'Herkes' : option === 'friends' ? 'Arkadaşlar' : 'Hiç Kimse'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Arkadaşlık İstekleri</p>
                          <p className="text-xs text-slate-500">Kimler arkadaşlık isteği gönderebilir?</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(['everyone', 'nobody'] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => handleUpdateSetting('whoCanAddFriend', option)}
                          className={`py-2.5 px-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${
                            settings.whoCanAddFriend === option
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                              : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          {option === 'everyone' ? 'Herkes' : 'Hiç Kimse'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              {/* Notifications Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600/60 uppercase tracking-widest text-[10px] font-bold">
                  <Bell className="w-3 h-3" />
                  <span>Bildirim Ayarları</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'messages', label: 'Mesajlar', icon: MessageCircle },
                    { id: 'friendRequests', label: 'Arkadaşlık İstekleri', icon: UserPlus },
                    { id: 'roomInvites', label: 'Oda Davetleri', icon: Users },
                    { id: 'gifts', label: 'Hediyeler', icon: Gift },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/50 border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center">
                          <item.icon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      </div>
                      <button
                        onClick={() => handleUpdateSetting(`notifications.${item.id}`, !(settings.notifications as any)[item.id])}
                        className={`w-12 h-6 rounded-full transition-all relative ${
                          (settings.notifications as any)[item.id] ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${
                          (settings.notifications as any)[item.id] ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-8 border-t border-slate-50 bg-slate-50/30">
              <button
                onClick={onClose}
                className="w-full py-4 rounded-2xl bg-white border border-slate-100 text-slate-600 font-bold uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
              >
                Kapat
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SocialSettingsModal;
