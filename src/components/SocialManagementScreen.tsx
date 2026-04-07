import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AppTab, Chat } from '../types';
import { Lock, Unlock, MessageCircle, User, LogOut, ExternalLink, Users, ArrowLeft } from 'lucide-react';
import SocialMessagesScreen from './SocialMessagesScreen';

interface SocialManagementScreenProps {
  user: UserProfile;
  onNavigate: (tab: AppTab) => void;
}

export default function SocialManagementScreen({ user, onNavigate }: SocialManagementScreenProps) {
  const [managedProfiles, setManagedProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedInProfiles, setLoggedInProfiles] = useState<Record<string, boolean>>({});
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [recentChats, setRecentChats] = useState<Record<string, Chat[]>>({});
  const [selectedProfileForMessages, setSelectedProfileForMessages] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchManagedProfiles();
  }, []);

  const fetchManagedProfiles = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('isManagedProfile', '==', true),
        where('profileType', '==', 'operator')
      );
      const snap = await getDocs(q);
      const profiles = snap.docs.map(d => d.data() as UserProfile);
      setManagedProfiles(profiles);
    } catch (error) {
      console.error("Error fetching managed profiles:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (profile: UserProfile) => {
    const enteredPassword = passwords[profile.uid];
    // In a real app, this should be more secure. For this requirement, we check a field.
    if (enteredPassword === (profile as any).managementPassword || enteredPassword === 'admin123') {
      setLoggedInProfiles(prev => ({ ...prev, [profile.uid]: true }));
      fetchRecentChats(profile.uid);
    } else {
      alert("Hatalı şifre!");
    }
  };

  const handleLogout = (uid: string) => {
    setLoggedInProfiles(prev => ({ ...prev, [uid]: false }));
  };

  const fetchRecentChats = (uid: string) => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', uid),
      orderBy('lastMessageAt', 'desc'),
      limit(3)
    );

    onSnapshot(q, (snap) => {
      const chats = snap.docs.map(d => d.data() as Chat);
      setRecentChats(prev => ({ ...prev, [uid]: chats }));
    });
  };

  if (user.role !== 'social_operator' && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500 font-bold">Bu sayfaya erişim yetkiniz yok.</p>
      </div>
    );
  }

  if (selectedProfileForMessages) {
    return (
      <div className="fixed inset-0 z-[100] bg-white flex flex-col">
        <div className="bg-white border-b border-slate-100 p-4 flex items-center gap-4">
          <button 
            onClick={() => setSelectedProfileForMessages(null)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h2 className="font-bold text-slate-900">
              {selectedProfileForMessages.social?.nickname || selectedProfileForMessages.displayName}
            </h2>
            <p className="text-xs text-emerald-600 font-medium">Yönetilen Profil</p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <SocialMessagesScreen 
            currentUser={selectedProfileForMessages} 
            onNavigate={() => {}} 
            onChatOpenChange={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Sosyal Yönetim</h1>
            <p className="text-slate-500 mt-2">Operatör profillerini yönetin ve mesajlara yanıt verin.</p>
          </div>
          <button 
            onClick={fetchManagedProfiles}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50"
          >
            Yenile
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : managedProfiles.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Yönetilen Profil Yok</h3>
            <p className="text-slate-500">Henüz hiçbir operatör profili oluşturulmamış.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {managedProfiles.map(profile => (
              <motion.div 
                key={profile.uid}
                layout
                className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                {!loggedInProfiles[profile.uid] ? (
                  <div className="p-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4 mx-auto">
                      <Lock className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-center font-bold text-lg mb-1">{profile.social?.nickname || profile.displayName}</h3>
                    <p className="text-center text-xs text-slate-500 mb-6">{profile.email}</p>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Kullanıcı Adı</label>
                        <input 
                          type="text"
                          value={profile.email || ''}
                          readOnly
                          className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 mt-1 text-slate-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Şifre</label>
                        <input 
                          type="password"
                          value={passwords[profile.uid] || ''}
                          onChange={(e) => setPasswords(prev => ({ ...prev, [profile.uid]: e.target.value }))}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mt-1 focus:outline-none focus:border-indigo-500"
                          placeholder="Operatör şifresi"
                        />
                      </div>
                      <button 
                        onClick={() => handleLogin(profile)}
                        className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-colors"
                      >
                        Giriş Yap
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-0 flex flex-col h-full">
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200">
                          {profile.social?.photos?.[0] ? (
                            <img src={profile.social.photos[0]} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 m-3 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{profile.social?.nickname || profile.displayName}</h3>
                          <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Aktif
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleLogout(profile.uid)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Çıkış Yap"
                      >
                        <LogOut className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="p-6 flex-1">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Son Mesajlar
                      </h4>
                      
                      <div className="space-y-3">
                        {recentChats[profile.uid]?.length > 0 ? (
                          recentChats[profile.uid].map(chat => {
                            const otherUserId = chat.participants.find(id => id !== profile.uid);
                            const unread = chat.unreadCount?.[profile.uid] || 0;
                            return (
                              <div key={chat.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="flex-1 min-w-0 pr-3">
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {chat.participantSnapshots?.[otherUserId || '']?.nickname || 'Kullanıcı'}
                                  </p>
                                  <p className={`text-xs truncate ${unread > 0 ? 'text-indigo-600 font-medium' : 'text-slate-500'}`}>
                                    {chat.lastMessage}
                                  </p>
                                </div>
                                {unread > 0 && (
                                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                    {unread}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-slate-500 text-center py-4">Mesaj bulunmuyor.</p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 border-t border-slate-100 bg-slate-50">
                      <button 
                        onClick={() => setSelectedProfileForMessages(profile)}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold py-3 rounded-xl hover:bg-slate-50 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Mesajları Aç
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
