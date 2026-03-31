import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { runSeed } from '../scripts/seedUsers';
import { db, OperationType, handleFirestoreError, auth } from '../lib/firebase';
import { doc, setDoc, getDocs, collection, updateDoc, getDoc, query, orderBy, limit, addDoc, onSnapshot, where, deleteDoc } from 'firebase/firestore';
import { 
  Save, RefreshCw, ChevronLeft, Terminal, Users, MessageSquare, 
  CreditCard, ShieldCheck, Search, Edit2, X, Settings, Bell, 
  Star, Trash2, Ban, CheckCircle2, AlertCircle, History,
  ImageIcon, DollarSign, Zap, Clock, Sparkles, Plus,
  User, MapPin, Heart, MessageCircle, Globe, Flag, ShieldAlert, Gavel,
  Shield, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  UserProfile, AppConfig, Horoscope, FortuneType, FortuneReading,
  SocialTransaction, WithdrawalRequest, SocialReport,
  ModerationLog, SocialRoom, HostingPackage, SocialGiftTransaction,
  SocialCommerceConfig
} from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import SocialSettingsModal from './SocialSettingsModal';

interface Prompt {
  type: string;
  content: string;
}

const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'prompts' | 'users' | 'config' | 'notifications' | 'horoscopes' | 'social' | 'reports'>('prompts');
  const [socialSubTab, setSocialSubTab] = useState<'users' | 'rooms' | 'withdrawals' | 'gifts' | 'reports' | 'hosts' | 'packages' | 'transactions' | 'logs'>('users');
  const [socialCommerce, setSocialCommerce] = useState<SocialCommerceConfig | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [editingReport, setEditingReport] = useState<any | null>(null);
  const [viewingReportedUser, setViewingReportedUser] = useState<UserProfile | null>(null);
  
  // Social States
  const [socialUsers, setSocialUsers] = useState<any[]>([]);
  const [socialRooms, setSocialRooms] = useState<SocialRoom[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [socialGiftTransactions, setSocialGiftTransactions] = useState<SocialGiftTransaction[]>([]);
  const [socialReports, setSocialReports] = useState<SocialReport[]>([]);
  const [hostingPackages, setHostingPackages] = useState<HostingPackage[]>([]);
  const [socialTransactions, setSocialTransactions] = useState<SocialTransaction[]>([]);
  const [moderationLogs, setModerationLogs] = useState<ModerationLog[]>([]);
  
  // Modal States
  const [editingSocialProfile, setEditingSocialProfile] = useState<any | null>(null);
  const [editingSocialSettings, setEditingSocialSettings] = useState<any | null>(null);
  const [editingPackage, setEditingPackage] = useState<HostingPackage | null>(null);
  const [viewingHostingHistory, setViewingHostingHistory] = useState<any | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [horoscopes, setHoroscopes] = useState<Horoscope[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [socialSearchQuery, setSocialSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userReadings, setUserReadings] = useState<FortuneReading[]>([]);
  const [showReadings, setShowReadings] = useState(false);
  const [readingsUnsubscribe, setReadingsUnsubscribe] = useState<(() => void) | null>(null);
  const [notification, setNotification] = useState({ title: '', message: '' });

  const handleGenerateAllHoroscopes = async () => {
    setSaving('all_horoscopes');
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: "Tüm burçlar (Koç, Boğa, İkizler, Yengeç, Aslan, Başak, Terazi, Akrep, Yay, Oğlak, Kova, Balık) için bugünün (tarih: " + new Date().toLocaleDateString('tr-TR') + ") günlük burç yorumlarını Türkçe olarak hazırla. Her burç için kısa, öz ve etkileyici cümleler kullan (maksimum 100 kelime). Yanıtı JSON formatında ver: { 'Koç': '...', 'Boğa': '...', ... }" }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              'Koç': { type: Type.STRING },
              'Boğa': { type: Type.STRING },
              'İkizler': { type: Type.STRING },
              'Yengeç': { type: Type.STRING },
              'Aslan': { type: Type.STRING },
              'Başak': { type: Type.STRING },
              'Terazi': { type: Type.STRING },
              'Akrep': { type: Type.STRING },
              'Yay': { type: Type.STRING },
              'Oğlak': { type: Type.STRING },
              'Kova': { type: Type.STRING },
              'Balık': { type: Type.STRING },
            }
          }
        }
      });
      const data = JSON.parse(response.text);

      const batch = [];
      for (const [sign, content] of Object.entries(data)) {
        batch.push(setDoc(doc(db, 'horoscopes', sign), {
          sign,
          content,
          date: new Date().toISOString()
        }));
      }
      await Promise.all(batch);
      toast.success("Tüm burç yorumları AI ile güncellendi!");
    } catch (error) {
      console.error(error);
      toast.error("Burçlar oluşturulurken bir hata oluştu.");
    } finally {
      setSaving(null);
    }
  };

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];

    const setupListeners = () => {
      setLoading(true);
      if (activeTab === 'prompts') {
        const unsub = onSnapshot(collection(db, 'prompts'), (snapshot) => {
          const fetchedPrompts: Prompt[] = [];
          snapshot.forEach((doc) => {
            fetchedPrompts.push({ type: doc.id, content: doc.data().content });
          });
          const types: FortuneType[] = ['coffee', 'tarot', 'water', 'ebced', 'yildizname', 'havas', 'dream', 'horoscope'];
          const finalPrompts = types.map(type => {
            const existing = fetchedPrompts.find(p => p.type === type);
            return existing || { type, content: '' };
          });
          setPrompts(finalPrompts);
          setLoading(false);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'prompts'));
        unsubscribes.push(unsub);
      } else if (activeTab === 'users') {
        const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
          const fetchedUsers: UserProfile[] = [];
          snapshot.forEach((doc) => {
            fetchedUsers.push({ uid: doc.id, ...doc.data() } as UserProfile);
          });
          setUsers(fetchedUsers);
          setLoading(false);
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
        unsubscribes.push(unsub);
      } else if (activeTab === 'config') {
        const unsub = onSnapshot(doc(db, 'config', 'global'), (docSnap) => {
          if (docSnap.exists()) {
            setConfig(docSnap.data() as AppConfig);
          } else {
            const defaultConfig: AppConfig = {
              prices: { coffee: 50, tarot: 40, water: 30, ebced: 30, yildizname: 30, havas: 30, extraQuestion: 10 },
              icons: { coffee: '☕', tarot: '🃏', water: '💧', ebced: '🔢', yildizname: '✨', havas: '📜', mainBalance: '💰', adBalance: '📺' },
              dailyMessagePrompt: "Günün mesajını oluştur. Yanıtı şu JSON formatında ver: { \"text\": \"mesaj içeriği\", \"category\": \"love|career|general\" }",
              adRewardAmount: 5,
              maxDailyAds: 5,
              subscriptionLimits: { coffee: 5, tarot: 5, advanced: 5 },
              packagePrices: { "100_credits": 49.99, "500_credits": 199.99, "daily_sub": 19.99, "weekly_sub": 59.99, "monthly_sub": 149.99 },
              hostPackagePrices: { daily: 300, weekly: 1200, monthly: 3000 }
            };
            setConfig(defaultConfig);
          }
          setLoading(false);
        }, (error) => handleFirestoreError(error, OperationType.GET, 'config/global'));
        unsubscribes.push(unsub);
      } else if (activeTab === 'horoscopes') {
        const unsub = onSnapshot(collection(db, 'horoscopes'), (snapshot) => {
          const fetchedHoroscopes: Horoscope[] = [];
          snapshot.forEach((doc) => {
            fetchedHoroscopes.push({ id: doc.id, ...doc.data() } as Horoscope);
          });
          setHoroscopes(fetchedHoroscopes);
          setLoading(false);

          const today = new Date().toISOString().split('T')[0];
          const isUpToDate = fetchedHoroscopes.some(h => h.date?.includes(today));
          if (fetchedHoroscopes.length > 0 && !isUpToDate) {
            handleGenerateAllHoroscopes();
          }
        }, (error) => handleFirestoreError(error, OperationType.LIST, 'horoscopes'));
        unsubscribes.push(unsub);
      } else if (activeTab === 'social') {
        // Social Listeners
        unsubscribes.push(onSnapshot(collection(db, 'users'), (snapshot) => {
          setSocialUsers(snapshot.docs
            .filter(doc => doc.data().social)
            .map(doc => ({ uid: doc.id, ...doc.data().social } as any)));
          setLoading(false);
        }));
        unsubscribes.push(onSnapshot(collection(db, 'socialRooms'), (snapshot) => {
          setSocialRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialRoom)));
        }));
        unsubscribes.push(onSnapshot(collection(db, 'withdrawalRequests'), (snapshot) => {
          setWithdrawalRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawalRequest)));
        }));
        unsubscribes.push(onSnapshot(collection(db, 'socialGiftTransactions'), (snapshot) => {
          setSocialGiftTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialGiftTransaction)));
        }));
        unsubscribes.push(onSnapshot(collection(db, 'socialReports'), (snapshot) => {
          setSocialReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialReport)));
        }));
        unsubscribes.push(onSnapshot(collection(db, 'hostingPackages'), (snapshot) => {
          setHostingPackages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HostingPackage)));
        }));
        unsubscribes.push(onSnapshot(collection(db, 'socialTransactions'), (snapshot) => {
          setSocialTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialTransaction)));
        }));
        unsubscribes.push(onSnapshot(collection(db, 'moderationLogs'), (snapshot) => {
          setModerationLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ModerationLog)));
        }));
      }

      if (activeTab === 'reports') {
        unsubscribes.push(onSnapshot(query(collection(db, 'reports'), orderBy('createdAt', 'desc')), (snapshot) => {
          setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }));
      }

      if (activeTab === 'config') {
        unsubscribes.push(onSnapshot(doc(db, 'config', 'socialCommerce'), (doc) => {
          if (doc.exists()) setSocialCommerce(doc.data() as SocialCommerceConfig);
        }));
      }
    };

    setupListeners();
    return () => unsubscribes.forEach(unsub => unsub());
  }, [activeTab]);

  const handleSavePrompt = async (type: string, content: string) => {
    setSaving(type);
    try {
      await setDoc(doc(db, 'prompts', type), {
        content,
        updatedAt: new Date().toISOString()
      });
      toast.success(`${type} promptu güncellendi.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `prompts/${type}`);
    } finally {
      setSaving(null);
    }
  };

  const handleSaveSocialCommerce = async () => {
    if (!socialCommerce) return;
    setSaving('socialCommerce');
    try {
      await setDoc(doc(db, 'config', 'socialCommerce'), socialCommerce);
      toast.success("Sosyal ticaret ayarları kaydedildi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/socialCommerce');
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateUser = async (uid: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'users', uid), updates);
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...updates } : u));
      toast.success("Kullanıcı güncellendi.");
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving('config');
    try {
      await setDoc(doc(db, 'config', 'global'), config);
      toast.success("Global ayarlar kaydedildi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'config/global');
    } finally {
      setSaving(null);
    }
  };

  const handleSendNotification = async () => {
    if (!notification.title || !notification.message) {
      toast.error("Başlık ve mesaj gereklidir.");
      return;
    }
    setSaving('notification');
    try {
      await addDoc(collection(db, 'notifications'), {
        ...notification,
        sentAt: new Date().toISOString()
      });
      toast.success("Bildirim gönderildi (Kuyruğa eklendi).");
      setNotification({ title: '', message: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'notifications');
    } finally {
      setSaving(null);
    }
  };

  const handleSaveHoroscope = async (horoscope: Horoscope) => {
    setSaving(horoscope.sign);
    try {
      const id = horoscope.sign; // Always use sign as ID for daily updates
      await setDoc(doc(db, 'horoscopes', id), {
        ...horoscope,
        date: new Date().toISOString().split('T')[0]
      });
      toast.success(`${horoscope.sign} yorumu güncellendi.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `horoscopes/${horoscope.sign}`);
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateSocialProfile = async (uid: string, updates: any) => {
    try {
      const socialUpdates = Object.keys(updates).reduce((acc, key) => {
        acc[`social.${key}`] = updates[key];
        return acc;
      }, {} as any);
      await updateDoc(doc(db, 'users', uid), {
        ...socialUpdates,
        'social.updatedAt': new Date().toISOString()
      });
      toast.success("Sosyal profil güncellendi.");
      setEditingSocialProfile(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteSocialProfile = async (uid: string) => {
    if (!window.confirm("Bu sosyal profili devre dışı bırakmak istediğinize emin misiniz?")) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        'social.enabled': false
      });
      toast.success("Sosyal profil devre dışı bırakıldı.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleCloseRoom = async (roomId: string) => {
    try {
      await updateDoc(doc(db, 'socialRooms', roomId), {
        status: 'closed',
        closedAt: new Date().toISOString()
      });
      toast.success("Oda kapatıldı.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `socialRooms/${roomId}`);
    }
  };

  const handleUpdateWithdrawalStatus = async (requestId: string, status: 'approved' | 'rejected' | 'completed', reason?: string) => {
    try {
      await updateDoc(doc(db, 'withdrawalRequests', requestId), {
        status,
        processedAt: new Date().toISOString(),
        rejectionReason: reason || ''
      });
      toast.success(`Para çekme talebi ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `withdrawalRequests/${requestId}`);
    }
  };

  const handleModerationAction = async (reportId: string, targetUid: string, action: 'warn' | 'mute' | 'ban', reason: string) => {
    try {
      const adminId = auth.currentUser?.uid;
      if (!adminId) return;

      // Log the action
      await addDoc(collection(db, 'moderationLogs'), {
        adminId,
        adminEmail: auth.currentUser?.email || '',
        targetUid,
        action,
        reason,
        reportId,
        timestamp: new Date().toISOString()
      });

      // Update report status
      await updateDoc(doc(db, 'socialReports', reportId), {
        status: 'resolved',
        actionTaken: action,
        adminNotes: reason
      });

      // Apply action to profile
      if (action === 'ban') {
        await updateDoc(doc(db, 'users', targetUid), { 'social.banned': true });
      }

      toast.success("Moderasyon işlemi uygulandı.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'moderationLogs');
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: 'investigating' | 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'socialReports', reportId), { status });
      toast.success("Rapor durumu güncellendi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `socialReports/${reportId}`);
    }
  };

  const handleSavePackage = async (pkg: HostingPackage) => {
    setSaving('package');
    try {
      if (pkg.id) {
        await updateDoc(doc(db, 'hostingPackages', pkg.id), pkg as any);
      } else {
        const newDoc = doc(collection(db, 'hostingPackages'));
        await setDoc(newDoc, { ...pkg, id: newDoc.id });
      }
      toast.success("Paket kaydedildi.");
      setEditingPackage(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'hostingPackages');
    } finally {
      setSaving(null);
    }
  };

  const handleDeletePackage = async (id: string) => {
    if (!window.confirm("Bu paketi silmek istediğinize emin misiniz?")) return;
    try {
      await deleteDoc(doc(db, 'hostingPackages', id));
      toast.success("Paket silindi.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `hostingPackages/${id}`);
    }
  };

  const fetchUserReadings = (uid: string) => {
    if (readingsUnsubscribe) readingsUnsubscribe();
    
    const q = query(collection(db, 'readings'), where('userId', '==', uid), orderBy('date', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      const readings: FortuneReading[] = [];
      snapshot.forEach((doc) => {
        readings.push({ id: doc.id, ...doc.data() } as FortuneReading);
      });
      setUserReadings(readings);
      setShowReadings(true);
    }, (error) => {
      console.error("Readings fetch error:", error);
      // Fallback to manual filtering if index is missing
      const fallbackQuery = query(collection(db, 'readings'), orderBy('date', 'desc'), limit(100));
      onSnapshot(fallbackQuery, (snapshot) => {
        const readings: FortuneReading[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.userId === uid) {
            readings.push({ id: doc.id, ...data } as FortuneReading);
          }
        });
        setUserReadings(readings);
        setShowReadings(true);
      });
    });
    
    setReadingsUnsubscribe(() => unsub);
  };

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSocialUsers = socialUsers.filter(u => 
    u.nickname?.toLowerCase().includes(socialSearchQuery.toLowerCase()) || 
    u.region?.toLowerCase().includes(socialSearchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="p-2 rounded-full bg-white/5 text-purple-200/60"
          >
            <ChevronLeft className="w-6 h-6" />
          </motion.button>
          <div>
            <h1 className="text-xl font-serif font-bold text-amber-50">Yönetim Paneli</h1>
            <p className="text-xs text-purple-200/40">Sistem Kontrol Merkezi</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5 overflow-x-auto max-w-[60vw] no-scrollbar">
          {[
            { id: 'prompts', icon: MessageSquare, label: 'Promptlar' },
            { id: 'users', icon: Users, label: 'Kullanıcılar' },
            { id: 'config', icon: Settings, label: 'Ayarlar' },
            { id: 'reports', icon: ShieldAlert, label: 'Raporlar' },
            { id: 'notifications', icon: Bell, label: 'Bildirim' },
            { id: 'horoscopes', icon: Star, label: 'Burçlar' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-amber-500 text-black' : 'text-purple-200/40 hover:text-purple-200'}`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <motion.button
          whileHover={{ rotate: 180 }}
          onClick={() => toast.info('Veriler gerçek zamanlı güncelleniyor.')}
          className="p-2 rounded-full bg-white/5 text-purple-200/60"
        >
          <RefreshCw className="w-5 h-5" />
        </motion.button>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-32">
        {activeTab === 'prompts' && (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-amber-400 uppercase tracking-widest">Kullanılabilir Değişkenler</h3>
              </div>
              <p className="text-xs text-amber-200/60 leading-relaxed">
                Prompt içerisinde şu etiketleri kullanabilirsiniz: <br />
                <code className="text-amber-400 font-mono">{'{isim}'}</code>, 
                <code className="text-amber-400 font-mono"> {'{dogumtarihi}'}</code>, 
                <code className="text-amber-400 font-mono"> {'{iliskidurumu}'}</code>, 
                <code className="text-amber-400 font-mono"> {'{isdurumu}'}</code>, 
                <code className="text-amber-400 font-mono"> {'{cinsiyet}'}</code>, 
                <code className="text-amber-400 font-mono"> {'{ekbilgi}'}</code>, 
                <code className="text-amber-400 font-mono"> {'{kartlar}'}</code> (Sadece Tarot),
                <code className="text-amber-400 font-mono"> {'{soruları}'}</code>
              </p>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                <p className="text-purple-200/40 animate-pulse">Promptlar yükleniyor...</p>
              </div>
            ) : (
              prompts.map((prompt) => (
                <motion.div
                  key={prompt.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-serif font-bold text-amber-50 capitalize">{prompt.type} Falı</h3>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSavePrompt(prompt.type, prompt.content)}
                      disabled={saving === prompt.type}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        saving === prompt.type 
                          ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                          : 'bg-amber-500 text-black hover:bg-amber-400'
                      }`}
                    >
                      {saving === prompt.type ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {saving === prompt.type ? 'Kaydediliyor...' : 'Kaydet'}
                    </motion.button>
                  </div>
                  
                  <textarea
                    value={prompt.content}
                    onChange={(e) => setPrompts(prev => prev.map(p => p.type === prompt.type ? { ...p, content: e.target.value } : p))}
                    placeholder={`${prompt.type} için prompt şablonu girin...`}
                    className="w-full h-48 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-purple-100 placeholder:text-purple-200/20 focus:outline-none focus:border-amber-500/50 transition-colors resize-none custom-scrollbar"
                  />
                </motion.div>
              ))
            )}
          </>
        )}

        {activeTab === 'users' && (
          <>
            <div className="flex items-center justify-between mb-6">
               <div className="relative flex-1 mr-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20" />
                <input 
                  type="text"
                  placeholder="Kullanıcı ara (Ad veya E-posta)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-amber-50 focus:outline-none focus:border-amber-500/50 transition-colors"
                />
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={async () => {
                    try {
                      await runSeed();
                      toast.success("Demo kullanıcılar oluşturuldu!");
                    } catch (error) {
                      toast.error("Demo kullanıcılar oluşturulurken bir hata oluştu.");
                      console.error(error);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-4 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Demo Kullanıcıları Oluştur</span>
                </button>
                <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/10 text-center">
                  <span className="block text-[10px] font-bold text-purple-200/40 uppercase tracking-widest">Toplam Üye</span>
                  <span className="text-xl font-bold text-amber-50">{users.length}</span>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                <p className="text-purple-200/40 animate-pulse">Kullanıcılar yükleniyor...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((u) => (
                  <motion.div
                    key={u.uid}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between group ${u.isBanned ? 'opacity-50 grayscale' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center border border-white/5">
                        {u.photoURL ? (
                          <img src={u.photoURL} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-purple-200/20" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-amber-50">{u.displayName || 'İsimsiz'}</h4>
                          {u.isBanned && <Ban className="w-3 h-3 text-red-500" />}
                        </div>
                        <p className="text-xs text-purple-200/40">{u.email}</p>
                        <p className="text-[10px] text-purple-200/20 mt-1">Kayıt: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : 'Tarih Yok'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="text-right hidden sm:block mr-4">
                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                            <CreditCard className="w-3 h-3" />
                            <span>{u.credits} Ana</span>
                          </div>
                          <div className="flex items-center gap-1 text-purple-400 text-[10px] font-bold">
                            <Zap className="w-3 h-3" />
                            <span>{u.adCredits || 0} Reklam</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-purple-200/40 text-[10px] font-medium uppercase tracking-tighter mt-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>{u.subscription?.status === 'active' ? u.subscription.type : 'Standart'}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => fetchUserReadings(u.uid)}
                        className="p-3 rounded-xl bg-white/5 text-purple-200/40 hover:bg-purple-500 hover:text-white transition-all"
                        title="Geçmiş Fallar"
                      >
                        <History className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setEditingUser({
                          ...u,
                          role: u.role || 'user',
                          isBanned: u.isBanned || false,
                          credits: u.credits || 0
                        })}
                        className="p-3 rounded-xl bg-white/5 text-purple-200/40 hover:bg-amber-500 hover:text-black transition-all"
                        title="Düzenle"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'config' && config && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-serif font-bold text-amber-50">Global Ayarlar</h2>
              <button 
                onClick={handleSaveConfig}
                disabled={saving === 'config'}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all disabled:opacity-50"
              >
                {saving === 'config' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span>Ayarları Kaydet</span>
              </button>
            </div>

            {/* Prices */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-6 h-6 text-amber-400" />
                <h3 className="text-lg font-bold text-amber-50">Fal Ücretleri & Ödüller</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {Object.entries(config.prices).map(([key, val]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1 capitalize">{key}</label>
                    <input 
                      type="number"
                      value={val}
                      onChange={(e) => setConfig({ ...config, prices: { ...config.prices, [key]: parseInt(e.target.value) || 0 } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1 capitalize">Reklam Ödülü</label>
                  <input 
                    type="number"
                    value={config.adRewardAmount}
                    onChange={(e) => setConfig({ ...config, adRewardAmount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1 capitalize">Günlük Max Reklam</label>
                  <input 
                    type="number"
                    value={config.maxDailyAds}
                    onChange={(e) => setConfig({ ...config, maxDailyAds: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-8 mb-2">
                <Zap className="w-6 h-6 text-amber-400" />
                <h3 className="text-lg font-bold text-amber-50">Host Paket Ücretleri (Coin)</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {Object.entries(config.hostPackagePrices || { daily: 300, weekly: 1200, monthly: 3000 }).map(([key, val]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1 capitalize">
                      {key === 'daily' ? 'Günlük' : key === 'weekly' ? 'Haftalık' : 'Aylık'}
                    </label>
                    <input 
                      type="number"
                      value={val}
                      onChange={(e) => setConfig({ 
                        ...config, 
                        hostPackagePrices: { 
                          ...(config.hostPackagePrices || { daily: 300, weekly: 1200, monthly: 3000 }), 
                          [key]: parseInt(e.target.value) || 0 
                        } 
                      })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Interpretation Times */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-6 h-6 text-amber-400" />
                <h3 className="text-lg font-bold text-amber-50">Yorumlama Süreleri (Dakika)</h3>
              </div>
              <div className="space-y-8">
                {['coffee', 'tarot', 'advanced'].map((type) => (
                  <div key={type} className="space-y-4">
                    <h4 className="text-sm font-bold text-amber-400 uppercase tracking-widest border-b border-white/5 pb-2">{type === 'coffee' ? 'Kahve' : type === 'tarot' ? 'Tarot' : 'Özel (Su, Yıldızname vb.)'}</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Min Yorumcu Bulma</label>
                        <input 
                          type="number"
                          value={Math.floor((config.interpretationTimes?.[type as 'coffee' | 'tarot' | 'advanced']?.minInterpreterTime || 300) / 60)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const times = config.interpretationTimes || {
                              coffee: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 },
                              tarot: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 },
                              advanced: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 }
                            };
                            setConfig({
                              ...config,
                              interpretationTimes: {
                                ...times,
                                [type]: { ...times[type as 'coffee' | 'tarot' | 'advanced'], minInterpreterTime: val * 60 }
                              }
                            });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Max Yorumcu Bulma</label>
                        <input 
                          type="number"
                          value={Math.floor((config.interpretationTimes?.[type as 'coffee' | 'tarot' | 'advanced']?.maxInterpreterTime || 900) / 60)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const times = config.interpretationTimes || {
                              coffee: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 },
                              tarot: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 },
                              advanced: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 }
                            };
                            setConfig({
                              ...config,
                              interpretationTimes: {
                                ...times,
                                [type]: { ...times[type as 'coffee' | 'tarot' | 'advanced'], maxInterpreterTime: val * 60 }
                              }
                            });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Min Yorumlama</label>
                        <input 
                          type="number"
                          value={Math.floor((config.interpretationTimes?.[type as 'coffee' | 'tarot' | 'advanced']?.minReadingTime || 900) / 60)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const times = config.interpretationTimes || {
                              coffee: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 },
                              tarot: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 },
                              advanced: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 }
                            };
                            setConfig({
                              ...config,
                              interpretationTimes: {
                                ...times,
                                [type]: { ...times[type as 'coffee' | 'tarot' | 'advanced'], minReadingTime: val * 60 }
                              }
                            });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Max Yorumlama</label>
                        <input 
                          type="number"
                          value={Math.floor((config.interpretationTimes?.[type as 'coffee' | 'tarot' | 'advanced']?.maxReadingTime || 1800) / 60)}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            const times = config.interpretationTimes || {
                              coffee: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 },
                              tarot: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 },
                              advanced: { minInterpreterTime: 300, maxInterpreterTime: 900, minReadingTime: 900, maxReadingTime: 1800 }
                            };
                            setConfig({
                              ...config,
                              interpretationTimes: {
                                ...times,
                                [type]: { ...times[type as 'coffee' | 'tarot' | 'advanced'], maxReadingTime: val * 60 }
                              }
                            });
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Icons */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <ImageIcon className="w-6 h-6 text-amber-400" />
                <h3 className="text-lg font-bold text-amber-50">Logolar & İkonlar (Emoji veya URL)</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {Object.entries(config.icons).map(([key, val]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1 capitalize">{key}</label>
                    <input 
                      type="text"
                      value={val}
                      onChange={(e) => setConfig({ ...config, icons: { ...config.icons, [key]: e.target.value } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Message Prompt */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <MessageSquare className="w-6 h-6 text-amber-400" />
                <h3 className="text-lg font-bold text-amber-50">Günün Mesajı Promptu</h3>
              </div>
              <textarea 
                value={config.dailyMessagePrompt}
                onChange={(e) => setConfig({ ...config, dailyMessagePrompt: e.target.value })}
                className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-purple-100 focus:outline-none focus:border-amber-500/50 resize-none"
              />
            </div>

            {/* Package Prices */}
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="w-6 h-6 text-amber-400" />
                <h3 className="text-lg font-bold text-amber-50">Paket Ücretleri (₺)</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                {Object.entries(config.packagePrices).map(([key, val]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1 capitalize">{key.replace('_', ' ')}</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={val}
                      onChange={(e) => setConfig({ ...config, packagePrices: { ...config.packagePrices, [key]: parseFloat(e.target.value) || 0 } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Social Commerce Settings */}
            {socialCommerce && (
              <div className="bg-white/5 border border-white/10 rounded-[2rem] p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <DollarSign className="w-6 h-6 text-pink-500" />
                    <h3 className="text-lg font-bold text-amber-50">Sosyal Özellik Fiyatları</h3>
                  </div>
                  <button 
                    onClick={handleSaveSocialCommerce}
                    disabled={saving === 'socialCommerce'}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs uppercase tracking-widest hover:bg-amber-400 transition-all disabled:opacity-50"
                  >
                    {saving === 'socialCommerce' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Kaydet
                  </button>
                </div>

                <div className="space-y-8">
                  {/* Packages */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Boost Packages */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-purple-200/40 uppercase tracking-widest flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Boost Paketleri
                      </h4>
                      <div className="space-y-3">
                        {socialCommerce.boostPackages.map((pkg, idx) => (
                          <div key={`boost-${idx}`} className="grid grid-cols-3 gap-2">
                            <input 
                              type="text"
                              value={pkg.name}
                              onChange={(e) => {
                                const newPkgs = [...socialCommerce.boostPackages];
                                newPkgs[idx].name = e.target.value;
                                setSocialCommerce({ ...socialCommerce, boostPackages: newPkgs });
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            />
                            <input 
                              type="number"
                              value={pkg.price}
                              onChange={(e) => {
                                const newPkgs = [...socialCommerce.boostPackages];
                                newPkgs[idx].price = parseInt(e.target.value) || 0;
                                setSocialCommerce({ ...socialCommerce, boostPackages: newPkgs });
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                              placeholder="Fiyat"
                            />
                            <input 
                              type="number"
                              value={pkg.durationHours}
                              onChange={(e) => {
                                const newPkgs = [...socialCommerce.boostPackages];
                                newPkgs[idx].durationHours = parseInt(e.target.value) || 0;
                                setSocialCommerce({ ...socialCommerce, boostPackages: newPkgs });
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                              placeholder="Saat"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Super Like Packages */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-purple-200/40 uppercase tracking-widest flex items-center gap-2">
                        <Heart className="w-3 h-3" /> Super Like Paketleri
                      </h4>
                      <div className="space-y-3">
                        {socialCommerce.superLikePackages.map((pkg, idx) => (
                          <div key={`sl-${idx}`} className="grid grid-cols-3 gap-2">
                            <input 
                              type="text"
                              value={pkg.name}
                              onChange={(e) => {
                                const newPkgs = [...socialCommerce.superLikePackages];
                                newPkgs[idx].name = e.target.value;
                                setSocialCommerce({ ...socialCommerce, superLikePackages: newPkgs });
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            />
                            <input 
                              type="number"
                              value={pkg.price}
                              onChange={(e) => {
                                const newPkgs = [...socialCommerce.superLikePackages];
                                newPkgs[idx].price = parseInt(e.target.value) || 0;
                                setSocialCommerce({ ...socialCommerce, superLikePackages: newPkgs });
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            />
                            <input 
                              type="number"
                              value={pkg.count}
                              onChange={(e) => {
                                const newPkgs = [...socialCommerce.superLikePackages];
                                newPkgs[idx].count = parseInt(e.target.value) || 0;
                                setSocialCommerce({ ...socialCommerce, superLikePackages: newPkgs });
                              }}
                              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Subscriptions */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-purple-200/40 uppercase tracking-widest flex items-center gap-2">
                      <Star className="w-3 h-3" /> Abonelik Planları
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {socialCommerce.subscriptions.map((sub, idx) => (
                        <div key={`sub-${idx}`} className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
                          <input 
                            type="text"
                            value={sub.name}
                            onChange={(e) => {
                              const newSubs = [...socialCommerce.subscriptions];
                              newSubs[idx].name = e.target.value;
                              setSocialCommerce({ ...socialCommerce, subscriptions: newSubs });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-amber-50 font-bold"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[8px] text-purple-200/40 uppercase">Fiyat</label>
                              <input 
                                type="number"
                                value={sub.price}
                                onChange={(e) => {
                                  const newSubs = [...socialCommerce.subscriptions];
                                  newSubs[idx].price = parseInt(e.target.value) || 0;
                                  setSocialCommerce({ ...socialCommerce, subscriptions: newSubs });
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[8px] text-purple-200/40 uppercase">Gün</label>
                              <input 
                                type="number"
                                value={sub.durationDays}
                                onChange={(e) => {
                                  const newSubs = [...socialCommerce.subscriptions];
                                  newSubs[idx].durationDays = parseInt(e.target.value) || 0;
                                  setSocialCommerce({ ...socialCommerce, subscriptions: newSubs });
                                }}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-serif font-bold text-amber-50">Kullanıcı Raporları</h2>
                <p className="text-xs text-purple-200/40">Sosyal modül şikayet yönetimi</p>
              </div>
              <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/10 text-center">
                <span className="block text-[10px] font-bold text-purple-200/40 uppercase tracking-widest">Açık Rapor</span>
                <span className="text-xl font-bold text-red-500">{reports.filter(r => r.status === 'open').length}</span>
              </div>
            </div>

            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="text-center py-20 text-purple-200/20 italic">Henüz rapor bulunmuyor.</div>
              ) : (
                reports.map((report) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          report.status === 'open' ? 'bg-red-500/10 text-red-500' :
                          report.status === 'reviewing' ? 'bg-amber-500/10 text-amber-500' :
                          'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest">Sebep:</span>
                            <span className="text-sm font-bold text-amber-50">{report.reason}</span>
                          </div>
                          <p className="text-xs text-purple-200/60 mt-1">{report.details}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="text-[10px] text-purple-200/40">
                              <span className="font-bold uppercase tracking-widest">Raporlayan:</span> {report.reporterUserId}
                            </div>
                            <div className="text-[10px] text-purple-200/40">
                              <span className="font-bold uppercase tracking-widest">Hedef:</span> {report.targetUserId}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                          report.status === 'open' ? 'bg-red-500/20 text-red-500' :
                          report.status === 'reviewing' ? 'bg-amber-500/20 text-amber-500' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {report.status === 'open' ? 'Açık' : report.status === 'reviewing' ? 'İnceleniyor' : 'Kapatıldı'}
                        </span>
                        <p className="text-[10px] text-purple-200/20">{new Date(report.createdAt).toLocaleString('tr-TR')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                      <button 
                        onClick={async () => {
                          try {
                            const userDoc = await getDoc(doc(db, 'users', report.targetUserId));
                            if (userDoc.exists()) {
                              setViewingReportedUser({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
                            } else {
                              toast.error("Kullanıcı bulunamadı.");
                            }
                          } catch (e) {
                            toast.error("Kullanıcı verisi çekilemedi.");
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-white/5 text-purple-200/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                      >
                        Profili İncele
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'reports', report.id), { status: 'reviewing' });
                            toast.success("Rapor inceleniyor olarak işaretlendi.");
                          } catch (e) {
                            toast.error("Hata oluştu.");
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500/20 transition-all"
                      >
                        İncelemeye Al
                      </button>
                      <button 
                        onClick={async () => {
                          try {
                            await updateDoc(doc(db, 'reports', report.id), { status: 'closed' });
                            toast.success("Rapor kapatıldı.");
                          } catch (e) {
                            toast.error("Hata oluştu.");
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-500/20 transition-all"
                      >
                        Kapat
                      </button>
                      <button 
                        onClick={async () => {
                          if (window.confirm("Kullanıcıyı sosyal modülden yasaklamak istediğinize emin misiniz?")) {
                            try {
                              await updateDoc(doc(db, 'users', report.targetUserId), { socialBan: true });
                              await updateDoc(doc(db, 'reports', report.id), { status: 'closed', actionTaken: 'banned' });
                              toast.success("Kullanıcı yasaklandı ve rapor kapatıldı.");
                            } catch (e) {
                              toast.error("Hata oluştu.");
                            }
                          }
                        }}
                        className="px-4 py-2 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-all"
                      >
                        Yasakla & Kapat
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="max-w-xl mx-auto space-y-8 pt-10">
            <div className="text-center space-y-2">
              <div className="w-20 h-20 rounded-[2rem] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto mb-6">
                <Bell className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-serif font-bold text-amber-50">Anlık Bildirim Gönder</h2>
              <p className="text-purple-200/40">Tüm kullanıcılara anında mesaj gönderin.</p>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-purple-200/40 uppercase tracking-widest px-1">Bildirim Başlığı</label>
                <input 
                  type="text"
                  value={notification.title}
                  onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                  placeholder="Örn: Günlük Kehanetin Hazır!"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-amber-50 focus:outline-none focus:border-amber-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-purple-200/40 uppercase tracking-widest px-1">Mesaj İçeriği</label>
                <textarea 
                  value={notification.message}
                  onChange={(e) => setNotification({ ...notification, message: e.target.value })}
                  placeholder="Kullanıcılara iletmek istediğiniz mesaj..."
                  className="w-full h-40 bg-black/40 border border-white/10 rounded-2xl p-6 text-amber-50 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>
              <button 
                onClick={handleSendNotification}
                disabled={saving === 'notification'}
                className="w-full py-5 rounded-2xl bg-amber-500 text-black font-bold flex items-center justify-center gap-3 hover:bg-amber-400 transition-all disabled:opacity-50"
              >
                {saving === 'notification' ? <RefreshCw className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
                <span>Bildirimi Şimdi Gönder</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'horoscopes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-serif font-bold text-amber-50">Günlük Burç Yorumları</h2>
                <p className="text-xs text-purple-200/40">Tarih: {new Date().toLocaleDateString('tr-TR')}</p>
              </div>
              <button 
                onClick={handleGenerateAllHoroscopes}
                disabled={saving === 'all_horoscopes'}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50"
              >
                {saving === 'all_horoscopes' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI ile Tümünü Güncelle
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                'Koç', 'Boğa', 'İkizler', 'Yengeç', 'Aslan', 'Başak', 
                'Terazi', 'Akrep', 'Yay', 'Oğlak', 'Kova', 'Balık'
              ].map(sign => {
                const existing = horoscopes.find(h => h.sign === sign);
                return (
                  <div key={sign} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-amber-50">{sign}</h3>
                      <button 
                        onClick={() => handleSaveHoroscope({ sign, content: existing?.content || '', date: new Date().toISOString() })}
                        disabled={saving === sign}
                        className="p-2 rounded-xl bg-amber-500 text-black hover:bg-amber-400 transition-all disabled:opacity-50"
                      >
                        {saving === sign ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      </button>
                    </div>
                    <textarea 
                      value={existing?.content || ''}
                      onChange={(e) => setHoroscopes(prev => {
                        const other = prev.filter(h => h.sign !== sign);
                        return [...other, { sign, content: e.target.value, date: new Date().toISOString() }];
                      })}
                      onBlur={() => handleSaveHoroscope({ sign, content: existing?.content || '', date: new Date().toISOString() })}
                      placeholder={`${sign} burcu için günlük yorum...`}
                      className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-4 text-sm text-purple-100 focus:outline-none focus:border-amber-500/50 resize-none"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'social' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex-1 mr-4">
                <h2 className="text-2xl font-serif font-bold text-amber-50">Ahlas Social Yönetimi</h2>
                <p className="text-xs text-purple-200/40">Üyeler ve canlı sohbet odaları</p>
              </div>
              <div className="flex gap-4">
                <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/10 text-center">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Üye</span>
                  <span className="text-xl font-bold text-white">{socialUsers.length}</span>
                </div>
                <div className="bg-white/5 px-6 py-4 rounded-2xl border border-white/10 text-center">
                  <span className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Oda</span>
                  <span className="text-xl font-bold text-white">{socialRooms.length}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => setSocialSubTab('users')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'users' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                Üyeler
              </button>
              <button 
                onClick={() => setSocialSubTab('rooms')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'rooms' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                Odalar
              </button>
              <button 
                onClick={() => setSocialSubTab('withdrawals')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'withdrawals' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                Çekim Talepleri
              </button>
              <button 
                onClick={() => setSocialSubTab('gifts')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'gifts' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                Hediye Kayıtları
              </button>
              <button 
                onClick={() => setSocialSubTab('reports')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'reports' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                Şikayetler
              </button>
              <button 
                onClick={() => setSocialSubTab('hosts')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'hosts' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                Hostlar
              </button>
              <button 
                onClick={() => setSocialSubTab('packages')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'packages' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                Paketler
              </button>
              <button 
                onClick={() => setSocialSubTab('transactions')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'transactions' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                İşlemler
              </button>
              <button 
                onClick={() => setSocialSubTab('logs')}
                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all ${socialSubTab === 'logs' ? 'bg-amber-500 text-black' : 'bg-white/5 text-purple-200/40 hover:text-purple-200'}`}
              >
                Loglar
              </button>
            </div>

            {socialSubTab === 'users' ? (
              <>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20" />
                  <input 
                    type="text"
                    placeholder="Sosyal üye ara (Takma ad veya Bölge)..."
                    value={socialSearchQuery}
                    onChange={(e) => setSocialSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-amber-50 focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <RefreshCw className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                    <p className="text-purple-200/40 animate-pulse">Sosyal üyeler yükleniyor...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredSocialUsers.map((s) => (
                      <motion.div
                        key={s.uid}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 group relative"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-white/5 overflow-hidden flex items-center justify-center border border-white/5">
                            {s.photoURL ? (
                              <img src={s.photoURL} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-8 h-8 text-purple-200/20" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-amber-50 truncate">{s.nickname}</h4>
                            <p className="text-xs text-purple-200/40">{s.age} Yaş • {s.gender}</p>
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                                <span>Profil Doluluğu</span>
                                <span>{s.completeness || 0}%</span>
                              </div>
                              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500" style={{ width: `${s.completeness || 0}%` }} />
                              </div>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {s.region}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setViewingHostingHistory(s)}
                              className="p-2 rounded-lg bg-white/5 text-amber-500 hover:bg-amber-500 hover:text-black transition-all"
                              title="Hosting Geçmişi"
                            >
                              <Zap className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setEditingSocialSettings(s)}
                              className="p-2 rounded-lg bg-white/5 text-indigo-500 hover:bg-indigo-500 hover:text-white transition-all"
                              title="Sosyal Ayarlar"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setEditingSocialProfile(s)}
                              className="p-2 rounded-lg bg-white/5 text-purple-200/40 hover:bg-amber-500 hover:text-black transition-all"
                              title="Profili Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteSocialProfile(s.uid)}
                              className="p-2 rounded-lg bg-white/5 text-purple-200/40 hover:bg-red-500 hover:text-white transition-all"
                              title="Profili Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Hosting Status in Card */}
                        <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Zap className={`w-3 h-3 ${s.hosting?.activePackage ? 'text-amber-500' : 'text-zinc-600'}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Host:</span>
                            <span className={`text-[10px] font-bold ${s.hosting?.activePackage ? 'text-amber-500' : 'text-zinc-500'}`}>
                              {s.hosting?.activePackage ? s.hosting.activePackage.type : 'Yok'}
                            </span>
                          </div>
                          {s.hosting?.activePackage && (
                            <span className="text-[8px] text-zinc-600 font-mono">
                              Bitiş: {s.hosting?.activePackage?.expiresAt ? new Date(s.hosting.activePackage.expiresAt).toLocaleDateString('tr-TR') : 'Süresiz'}
                            </span>
                          )}
                        </div>
                        
                        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${s.socialPurpose === 'dating' ? 'bg-rose-500/10 text-rose-400' : s.socialPurpose === 'chat' ? 'bg-blue-500/10 text-blue-400' : s.socialPurpose === 'networking' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {s.socialPurpose === 'dating' ? <Heart className="w-4 h-4" /> : s.socialPurpose === 'chat' ? <MessageCircle className="w-4 h-4" /> : s.socialPurpose === 'networking' ? <Globe className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-purple-200/60">
                              {s.socialPurpose === 'dating' ? 'Flört' : s.socialPurpose === 'chat' ? 'Sohbet' : s.socialPurpose === 'networking' ? 'Network' : 'Dostluk'}
                            </span>
                          </div>
                          <span className="text-[8px] text-zinc-600 uppercase tracking-tighter">
                            {s.createdAt ? new Date(s.createdAt).toLocaleDateString('tr-TR') : 'Tarih Yok'}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </>
            ) : socialSubTab === 'rooms' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {socialRooms.map((room) => (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 group relative ${room.status === 'closed' ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-bold text-amber-50">{room.name}</h4>
                          <p className="text-xs text-purple-200/40 line-clamp-1">{room.description}</p>
                        </div>
                        <div className={`px-2 py-1 rounded-lg text-[8px] font-bold uppercase tracking-widest ${room.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                          {room.status === 'active' ? 'Aktif' : 'Kapalı'}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Katılımcı</p>
                          <p className="text-sm font-bold text-white">{room.memberCount} / {room.maxMembers}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Tür</p>
                          <p className="text-sm font-bold text-white capitalize">{room.type}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                            <User className="w-4 h-4 text-purple-200/40" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Host ID</span>
                            <span className="text-[10px] font-mono text-purple-200/60 truncate w-24">{room.hostUid}</span>
                          </div>
                        </div>
                        {room.status === 'active' && (
                          <button 
                            onClick={() => handleCloseRoom(room.id!)}
                            className="p-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                            title="Odayı Kapat"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : socialSubTab === 'withdrawals' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {withdrawalRequests.length === 0 ? (
                    <div className="text-center py-20 text-purple-200/20 italic">Henüz çekim talebi bulunmuyor.</div>
                  ) : (
                    withdrawalRequests.map((req) => (
                      <motion.div
                        key={req.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                            <DollarSign className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-amber-50">{req.amount?.toLocaleString('tr-TR') || 0} Kredi</h4>
                              <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest ${
                                req.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                                req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                                'bg-red-500/10 text-red-500'
                              }`}>
                                {req.status === 'pending' ? 'Beklemede' : req.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                              </span>
                            </div>
                            <div className="mt-1 space-y-0.5">
                              <p className="text-xs text-purple-200/60 font-medium">{req.userName || 'İsimsiz Kullanıcı'}</p>
                              <p className="text-[10px] text-purple-200/40">{req.userEmail || 'E-posta Yok'}</p>
                            </div>
                            <div className="mt-2 p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Banka Bilgileri</p>
                              <p className="text-xs text-purple-200/80 font-mono">{req.iban}</p>
                              <p className="text-[10px] text-zinc-500">{req.accountHolder} • {req.bankName}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                          <div className="text-left md:text-right">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Kullanıcı ID</p>
                            <p className="text-[10px] font-mono text-purple-200/60">{req.uid}</p>
                            <p className="text-[8px] text-zinc-600 mt-1">{req.createdAt ? new Date(req.createdAt).toLocaleString('tr-TR') : 'Tarih Yok'}</p>
                          </div>
                          {req.status === 'pending' && (
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleUpdateWithdrawalStatus(req.id, 'approved')}
                                className="p-3 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 transition-all"
                                title="Onayla"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleUpdateWithdrawalStatus(req.id, 'rejected')}
                                className="p-3 rounded-xl bg-red-500 text-white hover:bg-red-400 transition-all"
                                title="Reddet"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            ) : socialSubTab === 'gifts' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                  <Search className="w-5 h-5 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Gönderen veya Alıcı ID ile ara..." 
                    className="bg-transparent border-none focus:outline-none text-sm text-white flex-1"
                    value={socialSearchQuery}
                    onChange={(e) => setSocialSearchQuery(e.target.value)}
                  />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Gönderen</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Alıcı</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Hediye</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Miktar</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tarih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {socialGiftTransactions
                        .filter(gift => 
                          gift.senderUid?.toLowerCase().includes(socialSearchQuery.toLowerCase()) || 
                          gift.receiverUid?.toLowerCase().includes(socialSearchQuery.toLowerCase()) ||
                          gift.giftName?.toLowerCase().includes(socialSearchQuery.toLowerCase())
                        )
                        .map((gift) => (
                        <tr key={gift.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-[10px] font-mono text-purple-200/60">{gift.senderUid}</td>
                          <td className="px-6 py-4 text-[10px] font-mono text-purple-200/60">{gift.receiverUid}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🎁</span>
                              <span className="text-xs text-white font-bold">{gift.giftName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-amber-500">{gift.amount?.toLocaleString('tr-TR') || 0}</td>
                          <td className="px-6 py-4 text-[10px] text-zinc-600">{gift.timestamp ? new Date(gift.timestamp).toLocaleString('tr-TR') : 'Tarih Yok'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : socialSubTab === 'reports' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {socialReports.length === 0 ? (
                    <div className="text-center py-20 text-purple-200/20 italic">Henüz şikayet bulunmuyor.</div>
                  ) : (
                    socialReports.map((report) => (
                      <motion.div
                        key={report.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 ${report.status !== 'pending' ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                              report.reason === 'sexual_content' || report.reason === 'harassment' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                            }`}>
                              <Flag className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-amber-50 capitalize">{report.reason.replace('_', ' ')}</h4>
                                <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest ${
                                  report.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                                  report.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-500' :
                                  'bg-white/10 text-white/40'
                                }`}>
                                  {report.status === 'pending' ? 'Beklemede' : report.status === 'resolved' ? 'Çözüldü' : 'Reddedildi'}
                                </span>
                              </div>
                              <p className="text-xs text-purple-200/60 mt-1">{report.description || 'Açıklama yok'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-zinc-500 uppercase tracking-widest">Tarih</p>
                            <p className="text-xs text-purple-200/60">{report.timestamp ? new Date(report.timestamp).toLocaleString('tr-TR') : 'Tarih Yok'}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/5 pt-4">
                          <div className="space-y-2">
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Taraflar</p>
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-400">Şikayet Eden:</span>
                                <span className="text-[10px] font-mono text-purple-200/60 truncate w-32">{report.fromUid}</span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] text-zinc-400">Şikayet Edilen:</span>
                                <span className="text-[10px] font-mono text-purple-200/60 truncate w-32">{report.toUid}</span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Bağlam</p>
                            <p className="text-[10px] text-purple-200/60">{report.context || 'Bilinmiyor'}</p>
                          </div>
                        </div>

                        {report.status === 'pending' && (
                          <div className="flex items-center gap-2 pt-2">
                            <button 
                              onClick={() => handleModerationAction(report.id, report.toUid, 'warn', 'Uyarı verildi')}
                              className="flex-1 py-2 rounded-xl bg-white/5 text-amber-500 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
                            >
                              Uyar
                            </button>
                            <button 
                              onClick={() => handleModerationAction(report.id, report.toUid, 'mute', '24 saat susturuldu')}
                              className="flex-1 py-2 rounded-xl bg-white/5 text-orange-500 text-[10px] font-bold uppercase tracking-widest hover:bg-orange-500 hover:text-black transition-all"
                            >
                              Sustur (24s)
                            </button>
                            <button 
                              onClick={() => handleModerationAction(report.id, report.toUid, 'ban', 'Kalıcı olarak yasaklandı')}
                              className="flex-1 py-2 rounded-xl bg-white/5 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                            >
                              Yasakla
                            </button>
                            <button 
                              onClick={() => handleUpdateReportStatus(report.id, 'dismissed')}
                              className="px-4 py-2 rounded-xl bg-white/5 text-white/40 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                            >
                              Reddet
                            </button>
                            <button 
                              onClick={() => {
                                const profile = socialUsers.find(u => u.uid === report.toUid);
                                if (profile) setEditingSocialProfile(profile);
                                else toast.error("Profil bulunamadı.");
                              }}
                              className="px-4 py-2 rounded-xl bg-white/5 text-indigo-500 text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all"
                            >
                              Profili Gör
                            </button>
                          </div>
                        )}

                        {report.actionTaken && (
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                            <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">Alınan Aksiyon</p>
                            <p className="text-xs text-emerald-200/60">{report.actionTaken} - {report.adminNotes}</p>
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            ) : socialSubTab === 'hosts' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {socialUsers.filter(u => u.hosting?.activePackage).map((s) => (
                    <motion.div
                      key={s.uid}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden">
                          {s.photoURL ? <img src={s.photoURL} alt="" className="w-full h-full object-cover" /> : <User className="w-6 h-6 m-3 text-purple-200/20" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-amber-50 truncate">{s.nickname}</h4>
                          <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{s.hosting?.activePackage?.type}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[8px] text-zinc-500 uppercase font-bold">Bitiş</p>
                          <p className="text-[10px] text-white">{s.hosting?.activePackage?.expiresAt ? new Date(s.hosting.activePackage.expiresAt).toLocaleDateString('tr-TR') : 'Süresiz'}</p>
                        </div>
                        <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[8px] text-zinc-500 uppercase font-bold">Donate</p>
                          <p className="text-[10px] text-white">{s.hosting?.donateEnabled ? 'Açık' : 'Kapalı'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setViewingHostingHistory(s)}
                        className="w-full py-2 rounded-xl bg-white/5 text-amber-500 text-[10px] font-bold uppercase tracking-widest hover:bg-amber-500 hover:text-black transition-all"
                      >
                        Geçmişi Gör
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : socialSubTab === 'packages' ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button 
                    onClick={() => setEditingPackage({ id: '', name: '', description: '', price: 0, duration: 'monthly', features: [], isActive: true })}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-black text-xs font-bold flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Yeni Paket
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hostingPackages.map((pkg) => (
                    <motion.div
                      key={pkg.id}
                      className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-amber-50">{pkg.name}</h4>
                          <p className="text-xl font-bold text-amber-500">{pkg.price} ₺</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingPackage(pkg)} className="p-2 rounded-lg bg-white/5 text-purple-200/40 hover:text-amber-500"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeletePackage(pkg.id)} className="p-2 rounded-lg bg-white/5 text-purple-200/40 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {pkg.features?.map((f: string) => (
                          <div key={`${pkg.id}-${f}`} className="flex items-center gap-2 text-[10px] text-purple-200/60">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {f}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : socialSubTab === 'transactions' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                  <Search className="w-5 h-5 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Kullanıcı ID veya açıklama ile ara..." 
                    className="bg-transparent border-none focus:outline-none text-sm text-white flex-1"
                    value={socialSearchQuery}
                    onChange={(e) => setSocialSearchQuery(e.target.value)}
                  />
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Kullanıcı</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tür</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Miktar</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Açıklama</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tarih</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {socialTransactions
                        .filter(tx => 
                          tx.uid?.toLowerCase().includes(socialSearchQuery.toLowerCase()) || 
                          tx.description?.toLowerCase().includes(socialSearchQuery.toLowerCase())
                        )
                        .map((tx) => (
                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 text-[10px] font-mono text-purple-200/60">{tx.uid}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest ${
                              ['gift_received', 'room_earning', 'top_up'].includes(tx.type) ? 'bg-emerald-500/10 text-emerald-500' :
                              ['gift_sent', 'withdrawal', 'host_package_purchase'].includes(tx.type) ? 'bg-red-500/10 text-red-500' :
                              'bg-amber-500/10 text-amber-500'
                            }`}>
                              {['gift_received', 'room_earning', 'top_up'].includes(tx.type) ? 'Kazanç' : 'Harcama'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-white">{tx.amount?.toLocaleString('tr-TR') || 0}</td>
                          <td className="px-6 py-4 text-xs text-purple-200/60">{tx.description}</td>
                          <td className="px-6 py-4 text-[10px] text-zinc-600">{tx.timestamp ? new Date(tx.timestamp).toLocaleString('tr-TR') : 'Tarih Yok'}</td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => {
                                const profile = socialUsers.find(u => u.uid === tx.uid);
                                if (profile) setEditingSocialProfile(profile);
                                else toast.error("Profil bulunamadı.");
                              }}
                              className="p-2 rounded-lg bg-white/5 text-purple-200/40 hover:text-amber-500 transition-all"
                            >
                              <User className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : socialSubTab === 'logs' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-3xl border border-white/10">
                  <Search className="w-5 h-5 text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Kullanıcı ID veya sebep ile ara..." 
                    className="bg-transparent border-none focus:outline-none text-sm text-white flex-1"
                    value={socialSearchQuery}
                    onChange={(e) => setSocialSearchQuery(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {moderationLogs.length === 0 ? (
                    <div className="text-center py-20 text-purple-200/20 italic">Henüz moderasyon kaydı bulunmuyor.</div>
                  ) : (
                    moderationLogs
                      .filter(log => 
                        log.targetUid?.toLowerCase().includes(socialSearchQuery.toLowerCase()) || 
                        log.reason?.toLowerCase().includes(socialSearchQuery.toLowerCase())
                      )
                      .map((log) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between gap-6"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            log.action === 'ban' ? 'bg-red-500/10 text-red-500' : 
                            log.action === 'mute' ? 'bg-orange-500/10 text-orange-500' : 
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                            <Gavel className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-amber-50 uppercase tracking-widest text-xs">{log.action}</h4>
                              <span className="text-[10px] text-purple-200/40">{log.timestamp ? new Date(log.timestamp).toLocaleString('tr-TR') : 'Tarih Yok'}</span>
                            </div>
                            <p className="text-xs text-purple-200/60 mt-1">{log.reason}</p>
                            <p className="text-[10px] text-zinc-500 mt-1">Admin: {log.adminEmail}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">Hedef Kullanıcı</p>
                            <p className="text-[10px] font-mono text-purple-200/60 truncate w-32">{log.targetUid}</p>
                          </div>
                          <button 
                            onClick={() => {
                              const profile = socialUsers.find(u => u.uid === log.targetUid);
                              if (profile) setEditingSocialProfile(profile);
                              else toast.error("Profil bulunamadı.");
                            }}
                            className="p-3 rounded-xl bg-white/5 text-purple-200/40 hover:text-amber-500 transition-all"
                          >
                            <User className="w-5 h-5" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>

      {/* Edit Social Profile Modal */}
      <AnimatePresence>
        {editingSocialProfile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-serif font-bold text-amber-50">Sosyal Profili Düzenle</h2>
                  <button onClick={() => setEditingSocialProfile(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center">
                      {editingSocialProfile.photoURL ? (
                        <img src={editingSocialProfile.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-purple-200/20" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-50">{editingSocialProfile.nickname}</h4>
                      <p className="text-xs text-purple-200/40">{editingSocialProfile.age} Yaş • {editingSocialProfile.gender}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Takma Ad</label>
                    <input 
                      type="text"
                      value={editingSocialProfile.nickname}
                      onChange={(e) => setEditingSocialProfile({ ...editingSocialProfile, nickname: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Yaş</label>
                      <input 
                        type="number"
                        value={editingSocialProfile.age}
                        onChange={(e) => setEditingSocialProfile({ ...editingSocialProfile, age: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Çekilebilir Bakiye</label>
                      <input 
                        type="number"
                        value={editingSocialProfile.withdrawableBalance || 0}
                        onChange={(e) => setEditingSocialProfile({ ...editingSocialProfile, withdrawableBalance: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Cinsiyet</label>
                    <select 
                      value={editingSocialProfile.gender}
                      onChange={(e) => setEditingSocialProfile({ ...editingSocialProfile, gender: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50 appearance-none"
                    >
                      <option value="Kadın">Kadın</option>
                      <option value="Erkek">Erkek</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Hosting Bitiş (Ücretsiz Deneme)</label>
                    <input 
                      type="datetime-local"
                      value={editingSocialProfile.hosting?.freeTrialUntil ? new Date(editingSocialProfile.hosting.freeTrialUntil).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setEditingSocialProfile({ 
                        ...editingSocialProfile, 
                        hosting: { 
                          ...editingSocialProfile.hosting!, 
                          freeTrialUntil: new Date(e.target.value).toISOString() 
                        } 
                      })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Bölge</label>
                    <input 
                      type="text"
                      value={editingSocialProfile.region}
                      onChange={(e) => setEditingSocialProfile({ ...editingSocialProfile, region: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Senin Vibe'ın</label>
                    <select 
                      value={editingSocialProfile.vibe}
                      onChange={(e) => setEditingSocialProfile({ ...editingSocialProfile, vibe: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50 appearance-none"
                    >
                      <option value="chill">Sakin & Chill</option>
                      <option value="energetic">Enerjik & Sosyal</option>
                      <option value="intellectual">Entelektüel</option>
                      <option value="mystical">Mistik & Derin</option>
                      <option value="fun">Eğlenceli</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Sosyal Amaç</label>
                    <select 
                      value={editingSocialProfile.socialPurpose}
                      onChange={(e) => setEditingSocialProfile({ ...editingSocialProfile, socialPurpose: e.target.value as any })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50 appearance-none"
                    >
                      <option value="friendship">Yeni Dostluklar</option>
                      <option value="chat">Sadece Sohbet</option>
                      <option value="networking">Network & Tanışma</option>
                      <option value="dating">Flört & İlişki</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-indigo-500" />
                      <div className="flex flex-col">
                        <span className="font-bold text-indigo-500">Sosyal Ayarlar</span>
                        <span className="text-[8px] text-indigo-500/60 uppercase tracking-widest">Gizlilik ve bildirim tercihleri</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setEditingSocialSettings(editingSocialProfile);
                        setEditingSocialProfile(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-400 transition-all"
                    >
                      Yönet
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center gap-3">
                      <Ban className="w-5 h-5 text-red-500" />
                      <div className="flex flex-col">
                        <span className="font-bold text-red-500">Kullanıcıyı Yasakla</span>
                        <span className="text-[8px] text-red-500/60 uppercase tracking-widest">Tüm sisteme girişi engeller</span>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        const user = users.find(u => u.uid === editingSocialProfile.uid);
                        if (user) {
                          handleUpdateUser(user.uid, { isBanned: !user.isBanned });
                        } else {
                          // If user not in current list, fetch and update
                          try {
                            const userDoc = await getDoc(doc(db, 'users', editingSocialProfile.uid));
                            if (userDoc.exists()) {
                              await updateDoc(doc(db, 'users', editingSocialProfile.uid), { isBanned: !userDoc.data().isBanned });
                              toast.success("Kullanıcı yasak durumu güncellendi.");
                            }
                          } catch (e) {
                            toast.error("Kullanıcı bulunamadı.");
                          }
                        }
                      }}
                      className={`w-12 h-6 rounded-full transition-all relative ${users.find(u => u.uid === editingSocialProfile.uid)?.isBanned ? 'bg-red-500' : 'bg-white/10'}`}
                    >
                      <motion.div 
                        animate={{ x: users.find(u => u.uid === editingSocialProfile.uid)?.isBanned ? 26 : 2 }}
                        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white"
                      />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const { uid, ...updates } = editingSocialProfile;
                      handleUpdateSocialProfile(uid, updates);
                    }}
                    className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold flex items-center justify-center gap-2 hover:bg-amber-400 transition-all"
                  >
                    <Save className="w-5 h-5" />
                    <span>Profili Kaydet</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Hosting Package Modal */}
      <AnimatePresence>
        {editingPackage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-serif font-bold text-amber-50">Paket Düzenle</h2>
                  <button onClick={() => setEditingPackage(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Paket Adı</label>
                    <input 
                      type="text"
                      value={editingPackage.name}
                      onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                      placeholder="Örn: Premium Host"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Fiyat (₺)</label>
                      <input 
                        type="number"
                        value={editingPackage.price}
                        onChange={(e) => setEditingPackage({ ...editingPackage, price: parseInt(e.target.value) || 0 })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Süre</label>
                      <select 
                        value={editingPackage.duration}
                        onChange={(e) => setEditingPackage({ ...editingPackage, duration: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="daily">Günlük</option>
                        <option value="weekly">Haftalık</option>
                        <option value="monthly">Aylık</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Özellikler (Satır satır)</label>
                    <textarea 
                      value={editingPackage.features?.join('\n')}
                      onChange={(e) => setEditingPackage({ ...editingPackage, features: e.target.value.split('\n').filter(f => f.trim()) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50 h-32 resize-none"
                      placeholder="Örn: Sınırsız Oda&#10;Öncelikli Listeleme"
                    />
                  </div>

                  <button
                    onClick={() => handleSavePackage(editingPackage)}
                    className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold flex items-center justify-center gap-2 hover:bg-amber-400 transition-all"
                  >
                    <Save className="w-5 h-5" />
                    <span>Paketi Kaydet</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Viewing Hosting History Modal */}
      <AnimatePresence>
        {viewingHostingHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-serif font-bold text-amber-50">Hosting Geçmişi</h2>
                    <p className="text-xs text-purple-200/40">{viewingHostingHistory.nickname} için kayıtlar</p>
                  </div>
                  <button onClick={() => setViewingHostingHistory(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                  {/* Current Status */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Aktif Durum</p>
                    {viewingHostingHistory.hosting?.activePackage ? (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white capitalize">{viewingHostingHistory.hosting.activePackage.type} Paket</span>
                        <span className="text-xs text-amber-200/60">Bitiş: {viewingHostingHistory.hosting?.activePackage?.expiresAt ? new Date(viewingHostingHistory.hosting.activePackage.expiresAt).toLocaleDateString('tr-TR') : 'Süresiz'}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-white/40 italic">Aktif paket bulunmuyor.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {viewingHostingHistory.hosting?.packageHistory?.length === 0 ? (
                      <div className="text-center py-10 text-purple-200/20 italic">Henüz paket geçmişi bulunmuyor.</div>
                    ) : (
                      viewingHostingHistory.hosting?.packageHistory?.map((h: any, i: number) => (
                        <div key={h.purchasedAt || `pkg-hist-${i}`} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-amber-50 uppercase tracking-widest text-xs">{h.type}</p>
                            <p className="text-[10px] text-purple-200/40">Başlangıç: {h.purchasedAt ? new Date(h.purchasedAt).toLocaleDateString('tr-TR') : 'Tarih Yok'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-amber-500">{h.price} ₺</p>
                            <p className="text-[10px] text-zinc-500">Bitiş: {h.expiresAt ? new Date(h.expiresAt).toLocaleDateString('tr-TR') : 'Süresiz'}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4">Oda Geçmişi</h3>
                    <div className="grid grid-cols-1 gap-4">
                      {socialRooms.filter(r => r.hostUid === viewingHostingHistory.uid).length === 0 ? (
                        <div className="text-center py-10 text-purple-200/20 italic">Henüz oda geçmişi bulunmuyor.</div>
                      ) : (
                        socialRooms.filter(r => r.hostUid === viewingHostingHistory.uid).map((r) => (
                          <div key={r.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                            <div>
                              <p className="font-bold text-amber-50 text-xs">{r.name}</p>
                              <p className="text-[10px] text-purple-200/40">{r.type}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-[8px] font-bold uppercase tracking-widest ${r.status === 'active' ? 'text-emerald-500' : 'text-zinc-500'}`}>
                                {r.status === 'active' ? 'Aktif' : 'Kapalı'}
                              </p>
                              <p className="text-[10px] text-zinc-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('tr-TR') : 'Tarih Yok'}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Social Settings Modal */}
      {editingSocialSettings && (
        <SocialSettingsModal
          isOpen={!!editingSocialSettings}
          onClose={() => setEditingSocialSettings(null)}
          user={editingSocialSettings}
          onUpdate={(updatedUser) => {
            setSocialUsers(prev => prev.map(u => u.uid === updatedUser.uid ? updatedUser : u));
            setEditingSocialSettings(updatedUser);
            toast.success("Sosyal ayarlar güncellendi.");
          }}
        />
      )}

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-serif font-bold text-amber-50">Kullanıcıyı Düzenle</h2>
                  <button onClick={() => setEditingUser(null)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="w-12 h-12 rounded-xl bg-white/5 overflow-hidden flex items-center justify-center">
                      {editingUser.photoURL ? (
                        <img src={editingUser.photoURL} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-6 h-6 text-purple-200/20" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-50">{editingUser.displayName}</h4>
                      <p className="text-xs text-purple-200/40">{editingUser.email}</p>
                    </div>
                  </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Ana Kredi</label>
                        <input 
                          type="number"
                          value={editingUser.credits}
                          onChange={(e) => setEditingUser({ ...editingUser, credits: parseInt(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Enerji Kredisi</label>
                        <input 
                          type="number"
                          value={editingUser.adCredits || 0}
                          onChange={(e) => setEditingUser({ ...editingUser, adCredits: parseInt(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
                      <h5 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Günlük Reklamlı Fal Limitleri</h5>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Kahve (Kullanılan)</label>
                          <input 
                            type="number"
                            value={editingUser.dailyAdReadingsUsed?.coffee || 0}
                            onChange={(e) => setEditingUser({ 
                              ...editingUser, 
                              dailyAdReadingsUsed: { 
                                coffee: parseInt(e.target.value) || 0,
                                tarot: editingUser.dailyAdReadingsUsed?.tarot || 0,
                                lastResetDate: editingUser.dailyAdReadingsUsed?.lastResetDate || new Date().toISOString()
                              } 
                            })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-amber-50 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Tarot (Kullanılan)</label>
                          <input 
                            type="number"
                            value={editingUser.dailyAdReadingsUsed?.tarot || 0}
                            onChange={(e) => setEditingUser({ 
                              ...editingUser, 
                              dailyAdReadingsUsed: { 
                                coffee: editingUser.dailyAdReadingsUsed?.coffee || 0,
                                tarot: parseInt(e.target.value) || 0,
                                lastResetDate: editingUser.dailyAdReadingsUsed?.lastResetDate || new Date().toISOString()
                              } 
                            })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-amber-50 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => setEditingUser({
                          ...editingUser,
                          dailyAdReadingsUsed: { coffee: 0, tarot: 0, lastResetDate: new Date().toISOString() }
                        })}
                        className="w-full py-2 rounded-xl bg-white/5 text-[10px] font-bold text-purple-200/60 hover:bg-white/10 transition-all uppercase tracking-widest"
                      >
                        Limitleri Sıfırla
                      </button>
                    </div>



                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Abonelik Tipi</label>
                    <select 
                      value={editingUser.subscription?.type || 'none'}
                      onChange={(e) => setEditingUser({ 
                        ...editingUser, 
                        subscription: { 
                          ...editingUser.subscription, 
                          type: e.target.value as any,
                          status: e.target.value === 'none' ? 'none' : 'active',
                          expiresAt: e.target.value === 'none' ? undefined : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                        } 
                      })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50 appearance-none"
                    >
                      <option value="none">Yok</option>
                      <option value="daily">Günlük</option>
                      <option value="weekly">Haftalık</option>
                      <option value="monthly">Aylık</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Yetki Rolü</label>
                    <select 
                      value={editingUser.role || 'user'}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50 appearance-none"
                    >
                      <option value="user">Kullanıcı</option>
                      <option value="admin">Yönetici</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                    <div className="flex items-center gap-3">
                      <Ban className="w-5 h-5 text-red-500" />
                      <span className="font-bold text-red-500">Kullanıcıyı Yasakla</span>
                    </div>
                    <button 
                      onClick={() => setEditingUser({ ...editingUser, isBanned: !editingUser.isBanned })}
                      className={`w-12 h-6 rounded-full transition-all relative ${editingUser.isBanned ? 'bg-red-500' : 'bg-white/10'}`}
                    >
                      <motion.div 
                        animate={{ x: editingUser.isBanned ? 26 : 2 }}
                        className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white"
                      />
                    </button>
                  </div>

                  {/* Social Profile Info Section */}
                  <div className="pt-6 border-t border-white/10 space-y-6">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-pink-500" />
                      <h3 className="text-lg font-serif font-bold text-amber-50">Sosyal Profil Bilgileri</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                        <span className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest">Sosyal Durum</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${editingUser.social?.enabled ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-sm text-amber-50">{editingUser.social?.enabled ? 'Aktif' : 'Pasif'}</span>
                        </div>
                      </div>
                      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                        <span className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest">Görünürlük</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${editingUser.social?.visible ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="text-sm text-amber-50">{editingUser.social?.visible ? 'Görünür' : 'Gizli'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Nickname</label>
                          <input 
                            type="text"
                            value={editingUser.nickname || ''}
                            onChange={(e) => setEditingUser({ ...editingUser, nickname: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Yaş</label>
                          <input 
                            type="number"
                            value={editingUser.age || 0}
                            onChange={(e) => setEditingUser({ ...editingUser, age: parseInt(e.target.value) || 0 })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-purple-200/40 uppercase tracking-widest px-1">Bio</label>
                        <textarea 
                          value={editingUser.bio || ''}
                          onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                          className="w-full h-24 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-500/50 resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setEditingUser({ ...editingUser, social: { ...editingUser.social, enabled: !editingUser.social?.enabled } })}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            editingUser.social?.enabled 
                              ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20' 
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'
                          }`}
                        >
                          {editingUser.social?.enabled ? <Ban className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          {editingUser.social?.enabled ? 'Sosyal Profili Kapat' : 'Sosyal Profili Aç'}
                        </button>
                        <button 
                          onClick={() => setEditingUser({ ...editingUser, social: { ...editingUser.social, visible: !editingUser.social?.visible } })}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            editingUser.social?.visible 
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:bg-amber-500/20' 
                              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20'
                          }`}
                        >
                          {editingUser.social?.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {editingUser.social?.visible ? 'Profil Gizle' : 'Profil Göster'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setEditingUser({ ...editingUser, socialBan: !editingUser.socialBan })}
                          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                            editingUser.socialBan 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20' 
                              : 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                          }`}
                        >
                          <Ban className="w-4 h-4" />
                          {editingUser.socialBan ? 'Sosyal Ban Kaldır' : 'Sosyal Banla'}
                        </button>
                        <button 
                          onClick={() => {
                            if (window.confirm("Sosyal verileri tamamen silmek istediğinize emin misiniz?")) {
                              setEditingUser({
                                ...editingUser,
                                social: { ...editingUser.social, enabled: false, profileCompleted: false, visible: false },
                                nickname: '',
                                bio: '',
                                photos: [],
                                interests: [],
                                age: 0,
                                lookingFor: 'friendship'
                              });
                            }
                          }}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          Sosyal Verileri Sil
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const updates: any = {
                        credits: editingUser.credits || 0,
                        adCredits: editingUser.adCredits || 0,
                        dailyAdReadingsUsed: editingUser.dailyAdReadingsUsed || { coffee: 0, tarot: 0, lastResetDate: new Date().toISOString() },
                        role: editingUser.role || 'user',
                        isBanned: editingUser.isBanned || false,
                        social: { ...editingUser.social, enabled: editingUser.social?.enabled || false },
                        socialProfileCompleted: editingUser.socialProfileCompleted || false,
                        socialVisible: editingUser.social?.visible || false,
                        nickname: editingUser.nickname || '',
                        bio: editingUser.bio || '',
                        photos: editingUser.photos || [],
                        interests: editingUser.interests || [],
                        age: editingUser.age || 0,
                        lookingFor: editingUser.lookingFor || 'friendship',
                        socialBan: editingUser.socialBan || false
                      };
                      
                      if (editingUser.subscription) {
                        // Remove undefined values from subscription object
                        const sub = { ...editingUser.subscription };
                        Object.keys(sub).forEach(key => {
                          if ((sub as any)[key] === undefined) {
                            delete (sub as any)[key];
                          }
                        });
                        updates.subscription = sub;
                      }

                      handleUpdateUser(editingUser.uid, updates);
                    }}
                    className="w-full py-4 rounded-2xl bg-amber-500 text-black font-bold flex items-center justify-center gap-2 hover:bg-amber-400 transition-all"
                  >
                    <Save className="w-5 h-5" />
                    <span>Değişiklikleri Kaydet</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User Readings Modal */}
      <AnimatePresence>
        {showReadings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
            onClick={() => { setShowReadings(false); if (readingsUnsubscribe) readingsUnsubscribe(); }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-[#0a0a0a] rounded-[2.5rem] border border-white/10 overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-2xl font-serif font-bold text-amber-50">Kullanıcı Geçmişi</h2>
                <button onClick={() => { setShowReadings(false); if (readingsUnsubscribe) readingsUnsubscribe(); }} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-purple-200/40">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                {userReadings.length === 0 ? (
                  <div className="text-center py-10 text-purple-200/20 italic">Henüz fal geçmişi bulunmuyor.</div>
                ) : (
                  userReadings.map(reading => (
                    <div key={reading.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">{reading.type} Falı</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase ${
                            reading.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            reading.status === 'interpreting' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {reading.status === 'completed' ? 'Tamamlandı' : reading.status === 'interpreting' ? 'Yorumlanıyor' : 'Bekliyor'}
                          </span>
                        </div>
                        <span className="text-[10px] text-purple-200/40">{reading.date ? new Date(reading.date).toLocaleString('tr-TR') : 'Tarih Yok'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-purple-200/40">
                        {reading.balanceType && (
                          <div className="flex items-center gap-1">
                            <CreditCard className="w-3 h-3" />
                            <span>{reading.balanceType === 'main' ? 'Ana Jeton' : reading.balanceType === 'ad' ? 'Enerji Kredisi' : 'Abonelik'}</span>
                          </div>
                        )}
                        {reading.creditsUsed !== undefined && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            <span>{reading.creditsUsed} Kredi</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-purple-100 line-clamp-3">{reading.content || 'Yorum henüz hazır değil.'}</p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
