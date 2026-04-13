import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, OperationType, handleFirestoreError, auth } from '../lib/firebase';
import { 
  doc, setDoc, getDocs, collection, updateDoc, getDoc, 
  query, orderBy, limit, addDoc, where, deleteDoc 
} from 'firebase/firestore';
import { 
  Save, RefreshCw, ChevronLeft, Users, MessageSquare, 
  CreditCard, ShieldCheck, Search, Edit2, X, Settings, Bell, 
  Star, Trash2, Ban, CheckCircle2, AlertCircle, History,
  ImageIcon, DollarSign, Zap, Clock, Sparkles, Plus,
  User, MapPin, Heart, MessageCircle, Globe, Flag, ShieldAlert, Gavel,
  Shield, Eye, EyeOff, ShoppingBag, Crown, Filter, ArrowRight,
  MoreVertical, UserPlus, UserMinus, Lock, Unlock, Check, Minus, Info,
  Ticket
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  UserProfile, AppConfig, AdminWalletConfig, CentralizedReport,
  WalletTransaction, SocialTransaction, WithdrawalRequest,
  ModerationLog, SocialRoom, HostingPackage, SocialGiftTransaction,
  SocialCommerceConfig, normalizeUserProfile, FortuneAIConfig, FortuneType, EconomyConfig
} from '../types';
import { adminService } from '../services/adminService';
import { DEFAULT_ADMIN_WALLET_CONFIG } from '../lib/walletService';
import { DEFAULT_AI_CONFIG, DEFAULT_ECONOMY_CONFIG } from '../constants';

const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'reports' | 'settings' | 'economy' | 'socialMarket' | 'subscriptions' | 'promoCodes' | 'notifications'>('users');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  
  // Data States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [reports, setReports] = useState<CentralizedReport[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [walletConfig, setWalletConfig] = useState<AdminWalletConfig | null>(null);
  const [socialCommerce, setSocialCommerce] = useState<SocialCommerceConfig | null>(null);
  const [economyConfig, setEconomyConfig] = useState<EconomyConfig | null>(null);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [selectedPromoCode, setSelectedPromoCode] = useState<any | null>(null);
  const [isEditingPromoCode, setIsEditingPromoCode] = useState(false);

  // Notification Broadcast State
  const [broadcastData, setBroadcastData] = useState({ title: '', body: '', screen: 'home' });
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  // UI States
  const [searchQuery, setSearchQuery] = useState('');
  const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'investigating' | 'resolved' | 'dismissed'>('all');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [selectedReport, setSelectedReport] = useState<CentralizedReport | null>(null);

  // Moderation Chat View States
  const [userModalTab, setUserModalTab] = useState<'info' | 'wallet' | 'subscriptions' | 'social' | 'moderation' | 'messages'>('info');
  const [userChats, setUserChats] = useState<any[]>([]);
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedUsers = usersSnap.docs.map(doc => normalizeUserProfile(doc.data(), doc.id));
      setUsers(fetchedUsers);

      // 2. Fetch Reports
      const reportsSnap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(50)));
      const fetchedReports = reportsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CentralizedReport));
      setReports(fetchedReports);

      // 3. Fetch Configs (One-time)
      const configSnap = await getDoc(doc(db, 'config', 'global'));
      if (configSnap.exists()) setConfig(configSnap.data() as AppConfig);

      const walletSnap = await getDoc(doc(db, 'adminSettings', 'wallet'));
      if (walletSnap.exists()) setWalletConfig(walletSnap.data() as AdminWalletConfig);

      const commerceSnap = await getDoc(doc(db, 'config', 'socialCommerce'));
      if (commerceSnap.exists()) setSocialCommerce(commerceSnap.data() as SocialCommerceConfig);

      const economySnap = await getDoc(doc(db, 'adminSettings', 'economy'));
      if (economySnap.exists()) {
        const data = economySnap.data();
        setEconomyConfig({
          ...DEFAULT_ECONOMY_CONFIG,
          ...data,
          fortunePricing: { ...DEFAULT_ECONOMY_CONFIG.fortunePricing, ...(data.fortunePricing || {}) },
          interpretationTimes: { ...DEFAULT_ECONOMY_CONFIG.interpretationTimes, ...(data.interpretationTimes || {}) },
          subscriptionLimits: { ...DEFAULT_ECONOMY_CONFIG.subscriptionLimits, ...(data.subscriptionLimits || {}) },
          aiSettings: { ...DEFAULT_ECONOMY_CONFIG.aiSettings, ...(data.aiSettings || {}) },
          rewards: { ...DEFAULT_ECONOMY_CONFIG.rewards, ...(data.rewards || {}) },
          socialPricing: { ...DEFAULT_ECONOMY_CONFIG.socialPricing, ...(data.socialPricing || {}) },
          boostPackages: { ...DEFAULT_ECONOMY_CONFIG.boostPackages, ...(data.boostPackages || {}) },
          fortuneSubscriptions: { ...DEFAULT_ECONOMY_CONFIG.fortuneSubscriptions, ...(data.fortuneSubscriptions || {}) }
        } as EconomyConfig);
      } else {
        setEconomyConfig(DEFAULT_ECONOMY_CONFIG);
      }

      const promoSnap = await getDocs(query(collection(db, 'promoCodes'), orderBy('createdAt', 'desc')));
      const fetchedCodes = promoSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPromoCodes(fetchedCodes);

    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, "admin_data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Keep selectedUser in sync with real-time updates
  useEffect(() => {
    if (selectedUser) {
      const updated = users.find(u => u.uid === selectedUser.uid);
      if (updated) {
        setSelectedUser(updated);
      }
    }
  }, [users]);

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.uid.includes(searchQuery)
  );

  const filteredReports = reports.filter(r => 
    reportFilter === 'all' ? true : r.status === reportFilter
  );

  const handleUpdateUser = async (uid: string, updates: any) => {
    setSaving(uid);
    try {
      await adminService.updateUser(uid, updates);
      if (selectedUser?.uid === uid) {
        setSelectedUser(prev => prev ? { ...prev, ...updates } : null);
      }
    } finally {
      setSaving(null);
    }
  };

  const handleSaveSettings = async () => {
    setSaving('settings');
    try {
      if (config) await adminService.updateGlobalConfig(config);
      if (walletConfig) await adminService.updateWalletConfig(walletConfig);
      if (socialCommerce) await setDoc(doc(db, 'config', 'socialCommerce'), socialCommerce);
      if (economyConfig) {
        const finalEconomy = {
          ...economyConfig,
          fortuneSubscriptions: {
            daily: { ...economyConfig.fortuneSubscriptions.daily, dailyLimit: 10 },
            weekly: { ...economyConfig.fortuneSubscriptions.weekly, dailyLimit: 10 },
            monthly: { ...economyConfig.fortuneSubscriptions.monthly, dailyLimit: 10 }
          }
        };
        await adminService.updateEconomyConfig(finalEconomy);
      }
      toast.success("Tüm ayarlar kaydedildi.");
    } catch (error) {
      toast.error("Ayarlar kaydedilirken hata oluştu.");
    } finally {
      setSaving(null);
    }
  };

  const handleSavePromoCode = async (promoData: any) => {
    setSaving('promoCode');
    try {
      if (promoData.id) {
        const { id, ...rest } = promoData;
        await updateDoc(doc(db, 'promoCodes', id), rest);
        toast.success("Promo kod güncellendi.");
      } else {
        await addDoc(collection(db, 'promoCodes'), {
          ...promoData,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.email || 'admin',
          currentUses: 0
        });
        toast.success("Yeni promo kod oluşturuldu.");
      }
      setIsEditingPromoCode(false);
      setSelectedPromoCode(null);
    } catch (error) {
      toast.error("Hata oluştu.");
    } finally {
      setSaving(null);
    }
  };

  const handleDeletePromoCode = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'promoCodes', id));
      toast.success("Kod silindi.");
    } catch (error) {
      toast.error("Silme hatası.");
    }
  };

  const fetchUserChats = async (userId: string) => {
    setLoadingChats(true);
    try {
      const chats = await adminService.getAdminUserChats(userId);
      setUserChats(chats);
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchChatMessages = async (chatId: string, userId: string) => {
    setLoadingMessages(true);
    try {
      const messages = await adminService.getAdminChatMessages(chatId, userId);
      setChatMessages(messages);
    } finally {
      setLoadingMessages(false);
    }
  };

  const addCoinPackage = () => {
    if (!economyConfig) return;
    const newPkg = { id: `pkg_${Date.now()}`, coins: 0, priceTRY: 0, bonus: 0 };
    setEconomyConfig({
      ...economyConfig,
      coinPackages: [...economyConfig.coinPackages, newPkg]
    });
  };

  const removeCoinPackage = (id: string) => {
    if (!economyConfig) return;
    setEconomyConfig({
      ...economyConfig,
      coinPackages: economyConfig.coinPackages.filter(p => p.id !== id)
    });
  };

  const addCustomReward = () => {
    if (!economyConfig) return;
    const newReward = { id: `reward_${Date.now()}`, name: 'Yeni Ödül', amount: 0, balanceType: 'energy' as const, description: '' };
    setEconomyConfig({
      ...economyConfig,
      rewards: {
        ...economyConfig.rewards,
        customRewards: [...economyConfig.rewards.customRewards, newReward]
      }
    });
  };

  const removeCustomReward = (id: string) => {
    if (!economyConfig) return;
    setEconomyConfig({
      ...economyConfig,
      rewards: {
        ...economyConfig.rewards,
        customRewards: economyConfig.rewards.customRewards.filter(r => r.id !== id)
      }
    });
  };

  const addSocialPricing = (type: 'superLike' | 'refresh' | 'compatibility') => {
    if (!economyConfig) return;
    const newPkg = { id: `${type}_${Date.now()}`, count: 0, priceCoins: 0 };
    setEconomyConfig({
      ...economyConfig,
      socialPricing: {
        ...economyConfig.socialPricing,
        [type]: [...economyConfig.socialPricing[type], newPkg]
      }
    });
  };

  const removeSocialPricing = (type: 'superLike' | 'refresh' | 'compatibility', id: string) => {
    if (!economyConfig) return;
    setEconomyConfig({
      ...economyConfig,
      socialPricing: {
        ...economyConfig.socialPricing,
        [type]: economyConfig.socialPricing[type].filter(p => p.id !== id)
      }
    });
  };

  const handleModerationAction = async (action: 'ban_user' | 'delete_chat' | 'flag_message', params: any) => {
    const success = await adminService.performModerationAction({
      action,
      ...params
    });
    if (success && action === 'delete_chat') {
      setSelectedChat(null);
      if (selectedUser) fetchUserChats(selectedUser.uid);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] text-white flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <header className="flex-shrink-0 bg-black/40 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white transition-all border border-white/5"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onBack}
            className="p-2.5 rounded-xl bg-white/5 text-white/60 hover:text-white transition-all border border-white/5"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Admin Panel</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Production Control</p>
          </div>
        </div>

        <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 overflow-x-auto no-scrollbar max-w-[60%]">
          {[
            { id: 'users', icon: Users, label: 'Kullanıcılar' },
            { id: 'reports', icon: ShieldAlert, label: 'Raporlar' },
            { id: 'economy', icon: DollarSign, label: 'Ekonomi' },
            { id: 'socialMarket', icon: ShoppingBag, label: 'Sosyal Market' },
            { id: 'subscriptions', icon: Crown, label: 'Abonelikler' },
            { id: 'promoCodes', icon: Ticket, label: 'Promo Kodlar' },
            { id: 'notifications', icon: Bell, label: 'Bildirimler' },
            { id: 'settings', icon: Settings, label: 'Ayarlar' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-tighter">System Status</span>
            <span className="text-[10px] font-bold text-green-500 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Operational
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {activeTab === 'users' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Search & Stats */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                <input
                  type="text"
                  placeholder="Kullanıcı ara (İsim, E-posta, UID)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-amber-500/50 transition-all"
                />
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/5 flex flex-col items-center min-w-[120px]">
                  <span className="text-[10px] font-bold text-white/20 uppercase">Toplam</span>
                  <span className="text-xl font-black text-amber-500">{users.length}</span>
                </div>
                <div className="bg-white/5 px-6 py-3 rounded-2xl border border-white/5 flex flex-col items-center min-w-[120px]">
                  <span className="text-[10px] font-bold text-white/20 uppercase">Aktif</span>
                  <span className="text-xl font-black text-green-500">{users.filter(u => !u.isBanned).length}</span>
                </div>
              </div>
            </div>

            {/* User List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredUsers.slice(0, 50).map((user) => (
                  <motion.div
                    key={user.uid}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => setSelectedUser(user)}
                    className={`group relative bg-white/5 border border-white/10 rounded-3xl p-5 hover:bg-white/[0.08] transition-all cursor-pointer overflow-hidden ${user.isBanned ? 'opacity-60 grayscale' : ''}`}
                  >
                    {/* Background Glow */}
                    <div className="absolute -right-10 -top-10 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full group-hover:bg-amber-500/10 transition-all" />
                    
                    <div className="flex items-center gap-4 relative z-10">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-white/20" />
                          )}
                        </div>
                        {user.role === 'admin' && (
                          <div className="absolute -top-2 -right-2 bg-amber-500 text-black p-1 rounded-lg shadow-lg">
                            <Shield className="w-3 h-3" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-white truncate">{user.displayName || 'İsimsiz'}</h3>
                        <p className="text-xs text-white/40 truncate">{user.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                            user.isBanned ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                          }`}>
                            {user.isBanned ? 'Banned' : 'Active'}
                          </span>
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-white/5 text-white/40 uppercase tracking-tighter">
                            {user.role || 'user'}
                          </span>
                        </div>
                      </div>

                      <ChevronLeft className="w-5 h-5 text-white/10 rotate-180 group-hover:text-amber-500 transition-all" />
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-2 relative z-10">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-white/20 uppercase">Coins</span>
                        <span className="text-xs font-bold text-amber-500">{user.mainCoins || 0}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-white/20 uppercase">Energy</span>
                        <span className="text-xs font-bold text-purple-400">{user.energy || 0}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-white/20 uppercase">Sub</span>
                        <span className="text-xs font-bold text-blue-400 truncate">
                          {user.subscription?.status === 'active' ? user.subscription.type : 'None'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Report Filters */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
                {['all', 'pending', 'investigating', 'resolved', 'dismissed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setReportFilter(status as any)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                      reportFilter === status 
                        ? 'bg-white/10 text-white' 
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
                {filteredReports.length} Rapor Bulundu
              </div>
            </div>

            {/* Reports List */}
            <div className="space-y-3">
              {filteredReports.map((report) => (
                <motion.div
                  key={report.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center hover:bg-white/[0.08] transition-all"
                >
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className={`p-3 rounded-2xl ${
                      report.status === 'pending' ? 'bg-amber-500/20 text-amber-500' :
                      report.status === 'resolved' ? 'bg-green-500/20 text-green-500' :
                      'bg-white/5 text-white/40'
                    }`}>
                      <Flag className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white capitalize">{report.source} Raporu</h4>
                      <p className="text-[10px] text-white/40 font-mono">{report.id}</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-500">{report.reason}</span>
                      <span className="text-white/20">•</span>
                      <span className="text-[10px] text-white/40">{new Date(report.createdAt).toLocaleString('tr-TR')}</span>
                    </div>
                    <p className="text-sm text-white/60 line-clamp-2">{report.description || 'Açıklama yok.'}</p>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                      onClick={() => setSelectedReport(report)}
                      className="flex-1 md:flex-none px-6 py-3 rounded-2xl bg-white/5 text-white font-bold text-xs hover:bg-white/10 transition-all border border-white/5"
                    >
                      Detaylar
                    </button>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => adminService.updateReportStatus(report.id, 'resolved', 'Hızlı aksiyon ile çözüldü.')}
                        className="p-3 rounded-2xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-black transition-all"
                        title="Çözüldü"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => adminService.updateReportStatus(report.id, 'dismissed', 'Hızlı aksiyon ile reddedildi.')}
                        className="p-3 rounded-2xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                        title="Reddet"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'economy' && economyConfig && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Ekonomi Yönetimi</h2>
              <button
                onClick={handleSaveSettings}
                disabled={saving === 'settings'}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all shadow-[0_0_30px_rgba(245,158,11,0.2)] disabled:opacity-50"
              >
                {saving === 'settings' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                <span>Ekonomi Ayarlarını Kaydet</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Fortune Pricing */}
              <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Fal Fiyatları</h3>
                    <p className="text-sm text-white/40">Jeton bazlı fiyatlandırma</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(economyConfig.fortunePricing).map(([key, price]) => (
                    <div key={key} className="space-y-2">
                      <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1 capitalize">{key}</label>
                      <input
                        type="number"
                        value={economyConfig?.fortunePricing?.[key as keyof typeof economyConfig.fortunePricing] || 0}
                        onChange={(e) => {
                          if (!economyConfig) return;
                          setEconomyConfig({
                            ...economyConfig,
                            fortunePricing: { ...economyConfig.fortunePricing, [key]: parseInt(e.target.value) || 0 }
                          });
                        }}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-amber-500 font-bold focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                  ))}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Öncelikli Sıra Ücreti</label>
                    <input
                      type="number"
                      value={economyConfig?.fortunePricing?.priorityFee || 0}
                      onChange={(e) => {
                        if (!economyConfig) return;
                        setEconomyConfig({
                          ...economyConfig,
                          fortunePricing: { ...economyConfig.fortunePricing, priorityFee: parseInt(e.target.value) || 0 }
                        });
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-amber-500 font-bold focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Günlük Abone Fal Hakkı</label>
                    <input
                      type="number"
                      value={economyConfig?.subscriptionLimits?.totalDaily || 0}
                      onChange={(e) => {
                        if (!economyConfig) return;
                        setEconomyConfig({
                          ...economyConfig,
                          subscriptionLimits: { ...(economyConfig.subscriptionLimits || {}), totalDaily: parseInt(e.target.value) || 0 }
                        });
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-blue-400 font-bold focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-white/20 uppercase tracking-widest">Enerji ile Ödeme</h4>
                    <button
                      onClick={() => setEconomyConfig({ ...economyConfig, energyPaymentEnabled: !economyConfig.energyPaymentEnabled })}
                      className={`w-12 h-6 rounded-full transition-all relative ${economyConfig.energyPaymentEnabled ? 'bg-green-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${economyConfig.energyPaymentEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-white/20 uppercase tracking-widest">Gecikmeli Gösterim (Fake Processing)</h4>
                    <div className="bg-black/20 p-4 rounded-2xl space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Yorumcu Bulma (Min - ms)</label>
                          <input
                            type="number"
                            value={economyConfig?.fakeProcessing?.readerFindingMinDelay || 0}
                            onChange={(e) => setEconomyConfig({
                              ...economyConfig,
                              fakeProcessing: { ...(economyConfig.fakeProcessing || { readerFindingMinDelay: 60000, readerFindingMaxDelay: 180000, interpretationMinDelay: 300000, interpretationMaxDelay: 1200000 }), readerFindingMinDelay: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-amber-500 text-sm focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Yorumcu Bulma (Max - ms)</label>
                          <input
                            type="number"
                            value={economyConfig?.fakeProcessing?.readerFindingMaxDelay || 0}
                            onChange={(e) => setEconomyConfig({
                              ...economyConfig,
                              fakeProcessing: { ...(economyConfig.fakeProcessing || { readerFindingMinDelay: 60000, readerFindingMaxDelay: 180000, interpretationMinDelay: 300000, interpretationMaxDelay: 1200000 }), readerFindingMaxDelay: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-amber-500 text-sm focus:outline-none focus:border-amber-500/50"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Yorumlama (Min - ms)</label>
                          <input
                            type="number"
                            value={economyConfig?.fakeProcessing?.interpretationMinDelay || 0}
                            onChange={(e) => setEconomyConfig({
                              ...economyConfig,
                              fakeProcessing: { ...(economyConfig.fakeProcessing || { readerFindingMinDelay: 60000, readerFindingMaxDelay: 180000, interpretationMinDelay: 300000, interpretationMaxDelay: 1200000 }), interpretationMinDelay: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-blue-400 text-sm focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Yorumlama (Max - ms)</label>
                          <input
                            type="number"
                            value={economyConfig?.fakeProcessing?.interpretationMaxDelay || 0}
                            onChange={(e) => setEconomyConfig({
                              ...economyConfig,
                              fakeProcessing: { ...(economyConfig.fakeProcessing || { readerFindingMinDelay: 60000, readerFindingMaxDelay: 180000, interpretationMinDelay: 300000, interpretationMaxDelay: 1200000 }), interpretationMaxDelay: parseInt(e.target.value) || 0 }
                            })}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-blue-400 text-sm focus:outline-none focus:border-blue-500/50"
                          />
                        </div>
                      </div>
                      <p className="text-[9px] text-white/20 italic">* 60000 ms = 1 dakika. AI sonucu hemen üretilir ancak bu süreler dolana kadar kullanıcıya gösterilmez.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* AI Fortune Settings */}
              <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-4 mb-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif font-bold text-white">AI Fal Ayarları</h3>
                    <p className="text-xs text-white/40">Ahlas'ın kehanet motoru ayarları</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Kullanılabilir Değişkenler</h4>
                    <p className="text-[10px] text-white/60 leading-relaxed">
                      <code className="text-indigo-400">{`{adsoyad}`}</code>, 
                      <code className="text-indigo-400">{`{dogumtarihi}`}</code>, 
                      <code className="text-indigo-400">{`{iliskidurumu}`}</code>, 
                      <code className="text-indigo-400">{`{anneadi}`}</code>, 
                      <code className="text-indigo-400">{`{babaadi}`}</code>, 
                      <code className="text-indigo-400">{`{tur}`}</code>, 
                      <code className="text-indigo-400">{`{sorular}`}</code>, 
                      <code className="text-indigo-400">{`{isim}`}</code>
                    </p>
                  </div>
                  {(Object.keys(economyConfig.aiSettings) as FortuneType[]).map((type) => (
                    <div key={type} className="p-6 bg-black/20 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-indigo-400 uppercase tracking-widest">{type} Ayarları</h4>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/20 uppercase px-1">System Prompt</label>
                          <textarea
                            value={economyConfig.aiSettings[type].systemPrompt}
                            onChange={(e) => {
                              const newSettings = { ...economyConfig.aiSettings, [type]: { ...economyConfig.aiSettings[type], systemPrompt: e.target.value } };
                              setEconomyConfig({ ...economyConfig, aiSettings: newSettings });
                            }}
                            rows={4}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white/80 focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/20 uppercase px-1">Template Prompt</label>
                          <textarea
                            value={economyConfig.aiSettings[type].templatePrompt}
                            onChange={(e) => {
                              const newSettings = { ...economyConfig.aiSettings, [type]: { ...economyConfig.aiSettings[type], templatePrompt: e.target.value } };
                              setEconomyConfig({ ...economyConfig, aiSettings: newSettings });
                            }}
                            rows={4}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white/80 focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/20 uppercase px-1">Cevap Tonu</label>
                            <input
                              type="text"
                              value={economyConfig.aiSettings[type].tone}
                              onChange={(e) => {
                                const newSettings = { ...economyConfig.aiSettings, [type]: { ...economyConfig.aiSettings[type], tone: e.target.value } };
                                setEconomyConfig({ ...economyConfig, aiSettings: newSettings });
                              }}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/20 uppercase px-1">Mistik Seviye (1-10)</label>
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={economyConfig.aiSettings[type].mysticLevel}
                              onChange={(e) => {
                                const newSettings = { ...economyConfig.aiSettings, [type]: { ...economyConfig.aiSettings[type], mysticLevel: parseInt(e.target.value) || 1 } };
                                setEconomyConfig({ ...economyConfig, aiSettings: newSettings });
                              }}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/20 uppercase px-1">Min Kelime</label>
                            <input
                              type="number"
                              value={economyConfig.aiSettings[type].minLength}
                              onChange={(e) => {
                                const newSettings = { ...economyConfig.aiSettings, [type]: { ...economyConfig.aiSettings[type], minLength: parseInt(e.target.value) || 0 } };
                                setEconomyConfig({ ...economyConfig, aiSettings: newSettings });
                              }}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/20 uppercase px-1">Max Kelime</label>
                            <input
                              type="number"
                              value={economyConfig.aiSettings[type].maxLength}
                              onChange={(e) => {
                                const newSettings = { ...economyConfig.aiSettings, [type]: { ...economyConfig.aiSettings[type], maxLength: parseInt(e.target.value) || 0 } };
                                setEconomyConfig({ ...economyConfig, aiSettings: newSettings });
                              }}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/50"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/20 uppercase px-1">Ekstra Soru Davranışı</label>
                          <input
                            type="text"
                            value={economyConfig.aiSettings[type].extraQuestionBehavior}
                            onChange={(e) => {
                              const newSettings = { ...economyConfig.aiSettings, [type]: { ...economyConfig.aiSettings[type], extraQuestionBehavior: e.target.value } };
                              setEconomyConfig({ ...economyConfig, aiSettings: newSettings });
                            }}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-2 text-xs text-white/80 focus:outline-none focus:border-indigo-500/50"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Reward Settings */}
              <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-3xl bg-purple-500/10 text-purple-500">
                    <Zap className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Ödül Sistemi</h3>
                    <p className="text-sm text-white/40">Reklam ve giriş ödülleri</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Reklam Ödülü</label>
                    <input
                      type="number"
                      value={economyConfig.rewards.adRewardEnergy}
                      onChange={(e) => setEconomyConfig({
                        ...economyConfig,
                        rewards: { ...economyConfig.rewards, adRewardEnergy: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-purple-400 font-bold focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-white/20 uppercase tracking-widest px-1">Günlük Max Reklam</label>
                    <input
                      type="number"
                      value={economyConfig.rewards.maxDailyAds}
                      onChange={(e) => setEconomyConfig({
                        ...economyConfig,
                        rewards: { ...economyConfig.rewards, maxDailyAds: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-purple-400 font-bold focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-black text-white/20 uppercase tracking-widest">Özel Ödüller</h4>
                    <button onClick={addCustomReward} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {economyConfig.rewards.customRewards.map((reward) => (
                      <div key={reward.id} className="bg-black/40 border border-white/5 rounded-2xl p-3 flex items-center gap-3">
                        <input
                          type="text"
                          value={reward.name}
                          onChange={(e) => {
                            const newRewards = economyConfig.rewards.customRewards.map(r => r.id === reward.id ? { ...r, name: e.target.value } : r);
                            setEconomyConfig({ ...economyConfig, rewards: { ...economyConfig.rewards, customRewards: newRewards } });
                          }}
                          className="flex-1 bg-transparent border-none text-xs font-bold focus:outline-none"
                          placeholder="Ödül Adı"
                        />
                        <input
                          type="number"
                          value={reward.amount}
                          onChange={(e) => {
                            const newRewards = economyConfig.rewards.customRewards.map(r => r.id === reward.id ? { ...r, amount: parseInt(e.target.value) || 0 } : r);
                            setEconomyConfig({ ...economyConfig, rewards: { ...economyConfig.rewards, customRewards: newRewards } });
                          }}
                          className="w-16 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-right text-xs font-bold"
                        />
                        <button onClick={() => removeCustomReward(reward.id)} className="text-red-500/40 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            {/* Coin Packages */}
            <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-3xl bg-blue-500/10 text-blue-500">
                    <DollarSign className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Jeton Paketleri</h3>
                    <p className="text-sm text-white/40">Satın alınabilir paketler</p>
                  </div>
                </div>
                <button onClick={addCoinPackage} className="px-4 py-2 rounded-xl bg-white/5 text-white/60 hover:text-white transition-all flex items-center gap-2 text-xs font-bold">
                  <Plus className="w-4 h-4" /> Paket Ekle
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {economyConfig.coinPackages.map((pkg) => (
                  <div key={pkg.id} className="bg-black/40 border border-white/5 rounded-3xl p-6 space-y-4 relative group">
                    <button 
                      onClick={() => removeCoinPackage(pkg.id)}
                      className="absolute top-4 right-4 p-2 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="space-y-3">
                      <div className="flex flex-col">
                        <label className="text-[8px] font-bold text-white/20 uppercase mb-1">Jeton Miktarı</label>
                        <input
                          type="number"
                          value={pkg.coins}
                          onChange={(e) => {
                            const newPkgs = economyConfig.coinPackages.map(p => p.id === pkg.id ? { ...p, coins: parseInt(e.target.value) || 0 } : p);
                            setEconomyConfig({ ...economyConfig, coinPackages: newPkgs });
                          }}
                          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-amber-500 font-bold"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[8px] font-bold text-white/20 uppercase mb-1">Fiyat (TRY)</label>
                        <input
                          type="number"
                          value={pkg.priceTRY}
                          onChange={(e) => {
                            const newPkgs = economyConfig.coinPackages.map(p => p.id === pkg.id ? { ...p, priceTRY: parseFloat(e.target.value) || 0 } : p);
                            setEconomyConfig({ ...economyConfig, coinPackages: newPkgs });
                          }}
                          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-bold"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'socialMarket' && economyConfig && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Sosyal Market Yönetimi</h2>
              <button
                onClick={handleSaveSettings}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all"
              >
                <Save className="w-5 h-5" />
                <span>Market Ayarlarını Kaydet</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {(['superLike', 'refresh', 'compatibility'] as const).map((type) => (
                <section key={type} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-2xl ${
                        type === 'superLike' ? 'bg-rose-500/10 text-rose-500' :
                        type === 'refresh' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-purple-500/10 text-purple-500'
                      }`}>
                        {type === 'superLike' ? <Heart className="w-6 h-6" /> :
                         type === 'refresh' ? <RefreshCw className="w-6 h-6" /> :
                         <Zap className="w-6 h-6" />}
                      </div>
                      <h3 className="font-bold capitalize">{type === 'superLike' ? 'Süper Like' : type === 'refresh' ? 'Yenileme' : 'Uyum'}</h3>
                    </div>
                    <button onClick={() => addSocialPricing(type)} className="p-2 rounded-lg bg-white/5 text-white/40 hover:text-white">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {economyConfig.socialPricing[type].map((pkg) => (
                      <div key={pkg.id} className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center gap-3 group">
                        <div className="flex-1 space-y-1">
                          <label className="text-[8px] font-bold text-white/20 uppercase">Adet</label>
                          <input
                            type="number"
                            value={pkg.count}
                            onChange={(e) => {
                              const newPkgs = economyConfig.socialPricing[type].map(p => p.id === pkg.id ? { ...p, count: parseInt(e.target.value) || 0 } : p);
                              setEconomyConfig({ ...economyConfig, socialPricing: { ...economyConfig.socialPricing, [type]: newPkgs } });
                            }}
                            className="w-full bg-transparent border-none text-sm font-bold focus:outline-none"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[8px] font-bold text-white/20 uppercase">Jeton</label>
                          <input
                            type="number"
                            value={pkg.priceCoins}
                            onChange={(e) => {
                              const newPkgs = economyConfig.socialPricing[type].map(p => p.id === pkg.id ? { ...p, priceCoins: parseInt(e.target.value) || 0 } : p);
                              setEconomyConfig({ ...economyConfig, socialPricing: { ...economyConfig.socialPricing, [type]: newPkgs } });
                            }}
                            className="w-full bg-transparent border-none text-sm font-bold text-amber-500 focus:outline-none"
                          />
                        </div>
                        <button onClick={() => removeSocialPricing(type, pkg.id)} className="text-red-500/40 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {/* Manual Compatibility Prompt */}
                    <div className="p-6 bg-black/20 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black text-rose-400 uppercase tracking-widest">Manuel Uyum Analizi Promptu</h4>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-white/20 uppercase px-1">ChatGPT Prompt</label>
                        <textarea
                          value={economyConfig.manualCompatibilityPrompt || ""}
                          onChange={(e) => setEconomyConfig({ ...economyConfig, manualCompatibilityPrompt: e.target.value })}
                          rows={6}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white/80 focus:outline-none focus:border-rose-500/50"
                          placeholder="Uyum analizi için prompt girin..."
                        />
                        <p className="text-[9px] text-white/20 italic">
                          Değişkenler: {`{person1_name}, {person1_birthDate}, {person1_status}, {person2_name}, {person2_birthDate}, {person2_status}, {relationshipType}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'subscriptions' && economyConfig && (
          <div className="space-y-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">Abonelik Yönetimi</h2>
              <button
                onClick={handleSaveSettings}
                className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all"
              >
                <Save className="w-5 h-5" />
                <span>Abonelikleri Kaydet</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Fortune Subscriptions */}
              <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500">
                    <Crown className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Fal Abonelikleri</h3>
                    <p className="text-sm text-white/40">Günlük, Haftalık, Aylık</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(economyConfig.fortuneSubscriptions).map(([key, sub]) => (
                    <div key={key} className="bg-black/40 border border-white/5 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-amber-500 uppercase tracking-widest">{key}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/20 uppercase font-bold">Fiyat (TRY)</span>
                          <input
                            type="number"
                            value={sub.priceTRY}
                            onChange={(e) => {
                              const newSubs = { ...economyConfig.fortuneSubscriptions };
                              (newSubs as any)[key].priceTRY = parseFloat(e.target.value) || 0;
                              setEconomyConfig({ ...economyConfig, fortuneSubscriptions: newSubs });
                            }}
                            className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-1 text-right text-sm font-bold"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-1">
                          <label className="text-[8px] font-bold text-white/20 uppercase">Günlük Hak (Sabit)</label>
                          <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-amber-500">
                            10
                          </div>
                        </div>
                        <div className="flex-[2] space-y-1">
                          <label className="text-[8px] font-bold text-white/20 uppercase">Açıklama</label>
                          <input
                            type="text"
                            value={sub.description}
                            onChange={(e) => {
                              const newSubs = { ...economyConfig.fortuneSubscriptions };
                              (newSubs as any)[key].description = e.target.value;
                              setEconomyConfig({ ...economyConfig, fortuneSubscriptions: newSubs });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Boost Packages */}
              <section className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500">
                    <Zap className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Boost Paketleri</h3>
                    <p className="text-sm text-white/40">Haftalık ve Aylık Görünürlük</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(economyConfig.boostPackages).map(([key, pkg]) => (
                    <div key={key} className="bg-black/40 border border-white/5 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-amber-500 uppercase tracking-widest">{key}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-white/20 uppercase font-bold">Fiyat (TRY)</span>
                          <input
                            type="number"
                            value={pkg.priceTRY}
                            onChange={(e) => {
                              const newPackages = { ...economyConfig.boostPackages };
                              (newPackages as any)[key].priceTRY = parseFloat(e.target.value) || 0;
                              setEconomyConfig({ ...economyConfig, boostPackages: newPackages });
                            }}
                            className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-1 text-right text-sm font-bold"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex-1 space-y-1">
                          <label className="text-[8px] font-bold text-white/20 uppercase">Süre (Gün)</label>
                          <input
                            type="number"
                            value={pkg.days}
                            onChange={(e) => {
                              const newPackages = { ...economyConfig.boostPackages };
                              (newPackages as any)[key].days = parseInt(e.target.value) || 0;
                              setEconomyConfig({ ...economyConfig, boostPackages: newPackages });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-center text-xs font-bold"
                          />
                        </div>
                        <div className="flex-[2] space-y-1">
                          <label className="text-[8px] font-bold text-white/20 uppercase">Açıklama</label>
                          <input
                            type="text"
                            value={pkg.description}
                            onChange={(e) => {
                              const newPackages = { ...economyConfig.boostPackages };
                              (newPackages as any)[key].description = e.target.value;
                              setEconomyConfig({ ...economyConfig, boostPackages: newPackages });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === 'promoCodes' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Promo Kod Yönetimi</h2>
                <p className="text-sm text-white/40">Kampanya ve ödül kodlarını yönetin</p>
              </div>
              <button
                onClick={() => {
                  setSelectedPromoCode({
                    code: '',
                    isActive: true,
                    startsAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    maxTotalUses: 100,
                    maxUsesPerUser: 1,
                    onlyNewUsers: false,
                    description: '',
                    source: 'admin',
                    sourceName: 'Admin Panel',
                    rewards: { energy: 10 }
                  });
                  setIsEditingPromoCode(true);
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>Yeni Kod Oluştur</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promoCodes.map((code) => (
                <div key={code.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4 hover:bg-white/[0.08] transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                        <Ticket className="w-5 h-5" />
                      </div>
                      <h3 className="text-lg font-bold font-mono tracking-tighter">{code.code}</h3>
                    </div>
                    <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${code.isActive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                      {code.isActive ? 'Aktif' : 'Pasif'}
                    </div>
                  </div>

                  <p className="text-xs text-white/60 line-clamp-2 min-h-[2.5rem]">{code.description || 'Açıklama yok.'}</p>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-white/20 uppercase">Kullanım</span>
                      <p className="text-xs font-bold">{code.currentUses} / {code.maxTotalUses}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-bold text-white/20 uppercase">Bitiş</span>
                      <p className="text-xs font-bold">{new Date(code.expiresAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setSelectedPromoCode(code);
                        setIsEditingPromoCode(true);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-white/5 text-white text-xs font-bold hover:bg-white/10 transition-all border border-white/5"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDeletePromoCode(code.id)}
                      className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white/5 rounded-[2.5rem] p-8 border border-white/10 shadow-2xl">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 flex items-center justify-center">
                  <Bell className="w-8 h-8 text-amber-500" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Toplu Bildirim Gönder</h3>
                  <p className="text-sm text-white/40">Tüm kullanıcılara anlık push notification gönderin.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Bildirim Başlığı</label>
                  <input 
                    type="text" 
                    value={broadcastData.title}
                    onChange={(e) => setBroadcastData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Örn: Günlük Falın Hazır! ✨"
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Bildirim Mesajı</label>
                  <textarea 
                    value={broadcastData.body}
                    onChange={(e) => setBroadcastData(prev => ({ ...prev, body: e.target.value }))}
                    placeholder="Örn: Yıldızlar bugün senin için neler söylüyor merak ediyor musun?"
                    rows={4}
                    className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all resize-none outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 ml-2">Yönlendirme Ekranı</label>
                    <select 
                      value={broadcastData.screen}
                      onChange={(e) => setBroadcastData(prev => ({ ...prev, screen: e.target.value }))}
                      className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-amber-500/20 transition-all outline-none appearance-none"
                    >
                      <option value="home">Ana Sayfa</option>
                      <option value="fortunes">Fallar</option>
                      <option value="discover">Keşfet</option>
                      <option value="messages">Mesajlar</option>
                      <option value="wallet">Cüzdan</option>
                      <option value="profile">Profil</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      if (!broadcastData.title || !broadcastData.body) {
                        toast.error("Başlık ve mesaj zorunludur.");
                        return;
                      }
                      if (!window.confirm("Bu bildirimi TÜM kullanıcılara göndermek istediğinize emin misiniz?")) return;
                      
                      setIsBroadcasting(true);
                      try {
                        await adminService.broadcastNotification(broadcastData);
                        setBroadcastData({ title: '', body: '', screen: 'home' });
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsBroadcasting(false);
                      }
                    }}
                    disabled={isBroadcasting}
                    className="w-full py-5 bg-amber-500 text-black rounded-2xl font-bold text-sm shadow-xl shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-3 transition-all"
                  >
                    {isBroadcasting ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Gönderiliyor...
                      </>
                    ) : (
                      <>
                        <Bell className="w-5 h-5" />
                        Bildirimi Yayınla
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 rounded-3xl p-6 border border-amber-500/20">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-500">Dikkat: Spam Politikası</h4>
                  <p className="text-xs text-white/60 mt-1 leading-relaxed">
                    Toplu bildirimler tüm aktif kullanıcılara anında ulaşır. Gereksiz veya çok sık bildirim göndermek kullanıcıların uygulamayı silmesine veya bildirimleri kapatmasına neden olabilir. Lütfen sadece gerçekten önemli duyurular için kullanın.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-[#121212] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex-shrink-0 p-8 border-b border-white/5 flex items-center justify-between bg-gradient-to-b from-white/5 to-transparent">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 overflow-hidden">
                    {selectedUser.photoURL ? (
                      <img src={selectedUser.photoURL} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 text-white/20 m-auto mt-5" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">{selectedUser.displayName || 'İsimsiz'}</h2>
                    <p className="text-white/40 font-mono text-sm">{selectedUser.uid}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        selectedUser.isBanned ? 'bg-red-500/20 text-red-500' : 'bg-green-500/20 text-green-500'
                      }`}>
                        {selectedUser.isBanned ? 'Yasaklı' : 'Aktif'}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest">
                        {selectedUser.role || 'user'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/5 overflow-x-auto">
                    {[
                      { id: 'info', icon: ShieldCheck, label: 'Bilgiler' },
                      { id: 'wallet', icon: CreditCard, label: 'Cüzdan' },
                      { id: 'subscriptions', icon: Crown, label: 'Abonelik' },
                      { id: 'social', icon: Heart, label: 'Sosyal' },
                      { id: 'moderation', icon: Gavel, label: 'Moderasyon' },
                      { id: 'messages', icon: MessageSquare, label: 'Mesajlar' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setUserModalTab(tab.id as any);
                          if (tab.id === 'messages') fetchUserChats(selectedUser.uid);
                        }}
                        className={`px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 whitespace-nowrap ${
                          userModalTab === tab.id 
                            ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]' 
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </nav>
                  <button
                    onClick={() => {
                      setSelectedUser(null);
                      setUserModalTab('info');
                      setSelectedChat(null);
                    }}
                    className="p-3 rounded-2xl bg-white/5 text-white/40 hover:text-white transition-all"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {userModalTab === 'info' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <User className="w-4 h-4 text-amber-500" />
                          Temel Bilgiler
                        </h3>
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/40">E-posta:</span>
                            <span className="text-white font-mono">{selectedUser.email}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-white/40">Kayıt Tarihi:</span>
                            <span className="text-white">{selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-white/40">Son Giriş:</span>
                            <span className="text-white">{selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleDateString('tr-TR') : 'Bilinmiyor'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          localStorage.setItem('admin_preview_user_id', selectedUser.uid);
                          window.location.href = '/';
                        }}
                        className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                      >
                        <Eye className="w-5 h-5 text-amber-500" />
                        <span>Kullanıcı Gözüyle Gör (Preview)</span>
                      </button>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                        <h3 className="text-sm font-bold flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-500" />
                          Sistem Durumu
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                            <span className="text-[10px] text-white/20 uppercase font-bold block mb-1">Rol</span>
                            <span className="text-sm font-black text-amber-500 uppercase">{selectedUser.role || 'user'}</span>
                          </div>
                          <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                            <span className="text-[10px] text-white/20 uppercase font-bold block mb-1">Durum</span>
                            <span className={`text-sm font-black uppercase ${selectedUser.isBanned ? 'text-red-500' : 'text-green-500'}`}>
                              {selectedUser.isBanned ? 'Yasaklı' : 'Aktif'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {userModalTab === 'wallet' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[
                        { label: 'Ana Jeton', field: 'mainCoins', color: 'text-amber-500', icon: CreditCard },
                        { label: 'Enerji', field: 'energy', color: 'text-purple-400', icon: Zap },
                        { label: 'Süper Like', field: 'superLikes', color: 'text-rose-500', icon: Heart },
                        { label: 'Yenileme', field: 'refreshCount', color: 'text-blue-400', icon: RefreshCw },
                        { label: 'Uyum Analizi', field: 'compatibilityCount', color: 'text-green-400', icon: Search },
                        { label: 'Günlük Kaydırma', field: 'dailySwipeLimit', color: 'text-indigo-400', icon: ArrowRight },
                        { label: 'Ekstra Kaydırma', field: 'extraSwipeLimit', color: 'text-pink-400', icon: Plus }
                      ].map(item => (
                        <div key={item.field} className="bg-white/5 border border-white/10 rounded-[2rem] p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-xl bg-white/5 ${item.color}`}>
                                <item.icon className="w-5 h-5" />
                              </div>
                              <span className="text-xs font-bold text-white/60 uppercase">{item.label}</span>
                            </div>
                            <span className={`text-2xl font-black ${item.color}`}>{(selectedUser as any)[item.field] || 0}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              id={`wallet-input-${item.field}`}
                              defaultValue={(selectedUser as any)[item.field] || 0}
                              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:border-amber-500/50"
                            />
                            <div className="flex gap-1">
                              <button 
                                onClick={() => {
                                  const input = document.getElementById(`wallet-input-${item.field}`) as HTMLInputElement;
                                  const val = parseInt(input.value);
                                  if (!isNaN(val)) adminService.adminSetWallet(selectedUser.uid, { [item.field]: val });
                                }}
                                className="p-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-black transition-all"
                                title="Kaydet"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => adminService.adminAdjustWallet(selectedUser.uid, item.field, 10)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => adminService.adminAdjustWallet(selectedUser.uid, item.field, -10)}
                                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {userModalTab === 'subscriptions' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Fortune Subscription */}
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500">
                          <Crown className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Fal Aboneliği</h3>
                          <p className="text-sm text-white/40">Durum: {selectedUser.subscription?.status === 'active' ? 'Aktif' : 'Pasif'}</p>
                        </div>
                      </div>

                      {selectedUser.subscription?.status === 'active' && (
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/40">Tür:</span>
                            <span className="text-amber-500 font-bold uppercase">{selectedUser.subscription.type}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-white/40">Bitiş:</span>
                            <span className="text-white font-bold">{new Date(selectedUser.subscription.expiresAt!).toLocaleDateString('tr-TR')}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-white/40">Günlük Limit:</span>
                            <span className="text-white font-bold">{selectedUser.subscription.dailyLimit}</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => adminService.updateUser(selectedUser.uid, {
                            subscription: {
                              status: 'active',
                              type: 'monthly',
                              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                              dailyLimit: 10,
                              dailyLimitUsed: 0,
                              lastResetAt: new Date().toISOString().split('T')[0],
                              dailyReadingsUsed: { coffee: 0, tarot: 0, advanced: 0 }
                            }
                          })}
                          className="py-4 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all"
                        >
                          Abonelik Ver
                        </button>
                        <button
                          onClick={() => adminService.updateUser(selectedUser.uid, { 'subscription.status': 'inactive' })}
                          className="py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
                        >
                          İptal Et
                        </button>
                      </div>
                    </div>

                    {/* Boost Status */}
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500">
                          <Zap className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Profil Boost</h3>
                          <p className="text-sm text-white/40">
                            Durum: {selectedUser.boostExpiresAt && new Date(selectedUser.boostExpiresAt) > new Date() ? 'Aktif' : 'Pasif'}
                          </p>
                        </div>
                      </div>

                      {selectedUser.boostExpiresAt && new Date(selectedUser.boostExpiresAt) > new Date() && (
                        <div className="bg-black/40 border border-white/5 rounded-2xl p-6 space-y-4">
                          <div className="flex justify-between text-sm">
                            <span className="text-white/40">Bitiş:</span>
                            <span className="text-white font-bold">{new Date(selectedUser.boostExpiresAt).toLocaleString('tr-TR')}</span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => adminService.updateUser(selectedUser.uid, {
                            boostExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                          })}
                          className="py-4 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all"
                        >
                          30 Gün Boost Ver
                        </button>
                        <button
                          onClick={() => adminService.updateUser(selectedUser.uid, { boostExpiresAt: null })}
                          className="py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
                        >
                          Boost Kaldır
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {userModalTab === 'social' && (
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                        <h3 className="text-lg font-bold">Profil Ayarları</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                            <span className="text-sm font-bold">Sosyal Modül</span>
                            <button
                              onClick={() => handleUpdateUser(selectedUser.uid, { 'social.enabled': !selectedUser.social?.enabled })}
                              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${
                                selectedUser.social?.enabled ? 'bg-green-500 text-black' : 'bg-white/5 text-white/40'
                              }`}
                            >
                              {selectedUser.social?.enabled ? 'Açık' : 'Kapalı'}
                            </button>
                          </div>
                          <div className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                            <span className="text-sm font-bold">Görünürlük</span>
                            <button
                              onClick={() => handleUpdateUser(selectedUser.uid, { 'social.visible': !selectedUser.social?.visible })}
                              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${
                                selectedUser.social?.visible ? 'bg-amber-500 text-black' : 'bg-white/5 text-white/40'
                              }`}
                            >
                              {selectedUser.social?.visible ? 'Herkes' : 'Gizli'}
                            </button>
                          </div>
                          <button
                            onClick={() => handleUpdateUser(selectedUser.uid, { social: null })}
                            className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 font-bold border border-red-500/20 hover:bg-red-500 hover:text-black transition-all"
                          >
                            Sosyal Verileri Sıfırla
                          </button>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                        <h3 className="text-lg font-bold">Profil Düzenle</h3>
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-white/20 uppercase">Nickname</label>
                            <input
                              type="text"
                              defaultValue={selectedUser.social?.nickname}
                              onBlur={(e) => handleUpdateUser(selectedUser.uid, { 'social.nickname': e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-white/20 uppercase">Bio</label>
                            <textarea
                              defaultValue={selectedUser.social?.bio}
                              onBlur={(e) => handleUpdateUser(selectedUser.uid, { 'social.bio': e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 min-h-[100px]"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-white/20 uppercase">Yaş</label>
                              <input
                                type="number"
                                defaultValue={selectedUser.social?.age}
                                onBlur={(e) => handleUpdateUser(selectedUser.uid, { 'social.age': parseInt(e.target.value) })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-white/20 uppercase">Aradığı</label>
                              <select
                                defaultValue={selectedUser.social?.lookingFor}
                                onChange={(e) => handleUpdateUser(selectedUser.uid, { 'social.lookingFor': e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                              >
                                <option value="friendship">Arkadaşlık</option>
                                <option value="relationship">İlişki</option>
                                <option value="chat">Sohbet</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {userModalTab === 'moderation' && (
                  <div className="max-w-2xl mx-auto space-y-8">
                    <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <Gavel className="w-5 h-5 text-red-500" />
                        Kritik Moderasyon İşlemleri
                      </h3>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div className="p-6 bg-red-500/5 border border-red-500/10 rounded-3xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-red-500">Kullanıcıyı Yasakla</h4>
                              <p className="text-xs text-white/40">Kullanıcının tüm sisteme erişimi kesilir.</p>
                            </div>
                            <button
                              onClick={() => selectedUser.isBanned ? adminService.unbanUser(selectedUser.uid) : adminService.banUser(selectedUser.uid, "Admin manuel ban.")}
                              className={`px-6 py-3 rounded-2xl font-bold transition-all ${
                                selectedUser.isBanned ? 'bg-green-500 text-black' : 'bg-red-500 text-white'
                              }`}
                            >
                              {selectedUser.isBanned ? 'Yasağı Kaldır' : 'Yasakla'}
                            </button>
                          </div>
                        </div>

                        <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-3xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-amber-500">Admin Yetkisi</h4>
                              <p className="text-xs text-white/40">Kullanıcıya admin paneli erişimi verilir.</p>
                            </div>
                            <button
                              onClick={() => handleUpdateUser(selectedUser.uid, { role: selectedUser.role === 'admin' ? 'user' : 'admin' })}
                              className={`px-6 py-3 rounded-2xl font-bold transition-all ${
                                selectedUser.role === 'admin' ? 'bg-white/10 text-white' : 'bg-amber-500 text-black'
                              }`}
                            >
                              {selectedUser.role === 'admin' ? 'Yetkiyi Al' : 'Admin Yap'}
                            </button>
                          </div>
                        </div>

                        <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-indigo-500">Sosyal Ban</h4>
                              <p className="text-xs text-white/40">Kullanıcının sosyal modülü kullanması engellenir.</p>
                            </div>
                            <button
                              onClick={() => adminService.toggleSocialBan(selectedUser.uid, !selectedUser.social?.banned)}
                              className={`px-6 py-3 rounded-2xl font-bold transition-all ${
                                selectedUser.social?.banned ? 'bg-green-500 text-black' : 'bg-indigo-500 text-white'
                              }`}
                            >
                              {selectedUser.social?.banned ? 'Banı Kaldır' : 'Sosyal Banla'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {userModalTab === 'messages' && (
                  <div className="flex gap-8 h-full min-h-[500px]">
                    {/* Chat List */}
                    <div className="w-1/3 border-r border-white/5 pr-6 space-y-4">
                      <h3 className="text-xs font-black text-white/20 uppercase tracking-widest">Sohbetler</h3>
                      {loadingChats ? (
                        <div className="flex items-center justify-center py-12">
                          <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                        </div>
                      ) : userChats.length === 0 ? (
                        <div className="text-center py-12 bg-white/5 rounded-3xl border border-white/5">
                          <MessageSquare className="w-8 h-8 text-white/10 mx-auto mb-3" />
                          <p className="text-xs text-white/40">Henüz sohbet yok.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                          {userChats.map(chat => {
                            const otherId = chat.participants.find((p: string) => p !== selectedUser.uid);
                            const otherSnap = chat.participantSnapshots?.[otherId];
                            
                            return (
                              <button
                                key={chat.id}
                                onClick={() => {
                                  setSelectedChat(chat);
                                  fetchChatMessages(chat.id, selectedUser.uid);
                                }}
                                className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center gap-4 ${
                                  selectedChat?.id === chat.id 
                                    ? 'bg-amber-500 border-amber-500 text-black shadow-lg' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-white'
                                }`}
                              >
                                <div className="w-10 h-10 rounded-xl bg-white/10 overflow-hidden flex-shrink-0">
                                  {otherSnap?.photoURL ? (
                                    <img src={otherSnap.photoURL} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-5 h-5 m-auto mt-2.5 opacity-20" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold truncate">{otherSnap?.nickname || 'Bilinmeyen'}</span>
                                    <span className={`text-[8px] font-bold uppercase ${selectedChat?.id === chat.id ? 'text-black/60' : 'text-white/20'}`}>
                                      {chat.lastMessageAt ? (typeof chat.lastMessageAt === 'string' ? new Date(chat.lastMessageAt).toLocaleDateString() : new Date(chat.lastMessageAt.seconds * 1000).toLocaleDateString()) : ''}
                                    </span>
                                  </div>
                                  <p className={`text-[10px] truncate ${selectedChat?.id === chat.id ? 'text-black/60' : 'text-white/40'}`}>
                                    {chat.lastMessage || 'Mesaj yok'}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Chat Detail */}
                    <div className="flex-1 flex flex-col">
                      {selectedChat ? (
                        <>
                          <div className="flex-shrink-0 flex items-center justify-between pb-4 border-b border-white/5 mb-4">
                            <div className="flex items-center gap-3">
                              <h4 className="text-sm font-bold">Sohbet Detayı</h4>
                              <span className="text-[10px] font-mono text-white/20">{selectedChat.id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleModerationAction('delete_chat', { chatId: selectedChat.id })}
                                className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                                title="Sohbeti Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar max-h-[500px]">
                            {loadingMessages ? (
                              <div className="flex items-center justify-center py-12">
                                <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                              </div>
                            ) : chatMessages.length === 0 ? (
                              <p className="text-center text-white/20 text-xs py-12">Mesaj bulunamadı.</p>
                            ) : (
                              chatMessages.map(msg => (
                                <div 
                                  key={msg.id}
                                  className={`flex flex-col ${msg.senderId === selectedUser.uid ? 'items-end' : 'items-start'}`}
                                >
                                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm relative group ${
                                    msg.senderId === selectedUser.uid 
                                      ? 'bg-amber-500 text-black rounded-tr-none' 
                                      : 'bg-white/5 text-white border border-white/10 rounded-tl-none'
                                  }`}>
                                    {msg.text}
                                    <button
                                      onClick={() => handleModerationAction('flag_message', { messageId: msg.id, reason: 'Admin incelemesi' })}
                                      className={`absolute top-2 p-1 rounded-lg bg-white/5 text-white/20 opacity-0 group-hover:opacity-100 transition-all hover:text-amber-500 ${
                                        msg.senderId === selectedUser.uid ? '-left-8' : '-right-8'
                                      }`}
                                    >
                                      <Flag className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <span className="text-[8px] font-bold text-white/20 mt-1 uppercase">
                                    {msg.createdAt ? (typeof msg.createdAt === 'string' ? new Date(msg.createdAt).toLocaleString() : new Date(msg.createdAt.seconds * 1000).toLocaleString()) : ''}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                          <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center text-white/10 mb-4">
                            <MessageSquare className="w-8 h-8" />
                          </div>
                          <h4 className="text-sm font-bold text-white/40">Bir sohbet seçin</h4>
                          <p className="text-[10px] text-white/20 max-w-[200px] mt-2">
                            Kullanıcının mesaj geçmişini incelemek için soldaki listeden bir sohbet seçin.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Promo Code Edit Modal */}
      <AnimatePresence>
        {isEditingPromoCode && selectedPromoCode && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditingPromoCode(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-2xl bg-[#121212] border border-white/10 rounded-[2.5rem] p-8 space-y-6 overflow-y-auto max-h-[90vh] custom-scrollbar"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">{selectedPromoCode.id ? 'Kodu Düzenle' : 'Yeni Kod Oluştur'}</h2>
                <button onClick={() => setIsEditingPromoCode(false)} className="p-2 text-white/20 hover:text-white"><X /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/20 uppercase">Kod</label>
                  <input
                    type="text"
                    value={selectedPromoCode.code}
                    onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, code: e.target.value.toUpperCase() })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold tracking-widest focus:outline-none focus:border-amber-500/50 uppercase"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/20 uppercase">Durum</label>
                  <select
                    value={selectedPromoCode.isActive ? 'true' : 'false'}
                    onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, isActive: e.target.value === 'true' })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Pasif</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-white/20 uppercase">Açıklama</label>
                <textarea
                  value={selectedPromoCode.description}
                  onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, description: e.target.value })}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/20 uppercase">Başlangıç</label>
                  <input
                    type="datetime-local"
                    value={selectedPromoCode.startsAt?.slice(0, 16)}
                    onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, startsAt: new Date(e.target.value).toISOString() })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/20 uppercase">Bitiş</label>
                  <input
                    type="datetime-local"
                    value={selectedPromoCode.expiresAt?.slice(0, 16)}
                    onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, expiresAt: new Date(e.target.value).toISOString() })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/20 uppercase">Max Toplam</label>
                  <input
                    type="number"
                    value={selectedPromoCode.maxTotalUses}
                    onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, maxTotalUses: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-white/20 uppercase">Max / Kullanıcı</label>
                  <input
                    type="number"
                    value={selectedPromoCode.maxUsesPerUser}
                    onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, maxUsesPerUser: parseInt(e.target.value) || 0 })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    checked={selectedPromoCode.onlyNewUsers}
                    onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, onlyNewUsers: e.target.checked })}
                    className="w-4 h-4 rounded bg-white/5 border-white/10 text-amber-500"
                  />
                  <label className="text-[10px] font-bold text-white/40 uppercase">Sadece Yeni</label>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/5">
                <h3 className="text-xs font-black text-white/20 uppercase tracking-widest">Ödüller</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/20 uppercase">Enerji</label>
                    <input
                      type="number"
                      value={selectedPromoCode.rewards.energy || 0}
                      onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, rewards: { ...selectedPromoCode.rewards, energy: parseInt(e.target.value) || 0 } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/20 uppercase">Ana Jeton</label>
                    <input
                      type="number"
                      value={selectedPromoCode.rewards.mainCoins || 0}
                      onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, rewards: { ...selectedPromoCode.rewards, mainCoins: parseInt(e.target.value) || 0 } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
                {/* Simplified social rewards for now */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/20 uppercase">Fal Aboneliği</label>
                    <select
                      value={selectedPromoCode.rewards.fortuneSubscription || ''}
                      onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, rewards: { ...selectedPromoCode.rewards, fortuneSubscription: e.target.value || undefined } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                    >
                      <option value="">Yok</option>
                      <option value="daily">Günlük</option>
                      <option value="weekly">Haftalık</option>
                      <option value="monthly">Aylık</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/20 uppercase">Boost (Gün)</label>
                    <input
                      type="number"
                      value={selectedPromoCode.rewards.boostDays || 0}
                      onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, rewards: { ...selectedPromoCode.rewards, boostDays: parseInt(e.target.value) || 0 } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/20 uppercase">S.Like</label>
                    <input
                      type="number"
                      value={selectedPromoCode.rewards.socialFeatures?.superLike || 0}
                      onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, rewards: { ...selectedPromoCode.rewards, socialFeatures: { ...selectedPromoCode.rewards.socialFeatures, superLike: parseInt(e.target.value) || 0 } } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/20 uppercase">Yenileme</label>
                    <input
                      type="number"
                      value={selectedPromoCode.rewards.socialFeatures?.refresh || 0}
                      onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, rewards: { ...selectedPromoCode.rewards, socialFeatures: { ...selectedPromoCode.rewards.socialFeatures, refresh: parseInt(e.target.value) || 0 } } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/20 uppercase">Analiz</label>
                    <input
                      type="number"
                      value={selectedPromoCode.rewards.socialFeatures?.analysis || 0}
                      onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, rewards: { ...selectedPromoCode.rewards, socialFeatures: { ...selectedPromoCode.rewards.socialFeatures, analysis: parseInt(e.target.value) || 0 } } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-white/20 uppercase">Boost (Gün)</label>
                    <input
                      type="number"
                      value={selectedPromoCode.rewards.socialFeatures?.boostDays || 0}
                      onChange={(e) => setSelectedPromoCode({ ...selectedPromoCode, rewards: { ...selectedPromoCode.rewards, socialFeatures: { ...selectedPromoCode.rewards.socialFeatures, boostDays: parseInt(e.target.value) || 0 } } })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6">
                <button
                  onClick={() => handleSavePromoCode(selectedPromoCode)}
                  disabled={saving === 'promoCode' || !selectedPromoCode.code}
                  className="flex-1 py-4 rounded-2xl bg-amber-500 text-black font-bold hover:bg-amber-400 transition-all disabled:opacity-50"
                >
                  {saving === 'promoCode' ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
                <button
                  onClick={() => setIsEditingPromoCode(false)}
                  className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
                >
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Detail Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedReport(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-2xl bg-[#121212] border border-white/10 rounded-[2.5rem] p-8 space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500">
                    <Flag className="w-8 h-8" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Rapor Detayı</h2>
                    <p className="text-sm text-white/40">{selectedReport.id}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedReport(null)} className="p-2 text-white/20 hover:text-white"><X /></button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-bold text-white/20 uppercase block mb-1">Raporlayan</span>
                  <p className="text-xs font-mono text-amber-500 truncate">{selectedReport.reporterId}</p>
                  <button 
                    onClick={() => {
                      const u = users.find(u => u.uid === selectedReport.reporterId);
                      if (u) setSelectedUser(u);
                    }}
                    className="mt-2 text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                  >
                    Profile Git <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-bold text-white/20 uppercase block mb-1">Raporlanan</span>
                  <p className="text-xs font-mono text-red-500 truncate">{selectedReport.reportedUserId}</p>
                  <button 
                    onClick={() => {
                      const u = users.find(u => u.uid === selectedReport.reportedUserId);
                      if (u) setSelectedUser(u);
                    }}
                    className="mt-2 text-[10px] text-white/40 hover:text-white flex items-center gap-1"
                  >
                    Profile Git <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/40 uppercase">Açıklama</span>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    selectedReport.status === 'pending' ? 'bg-amber-500/20 text-amber-500' : 'bg-green-500/20 text-green-500'
                  }`}>
                    {selectedReport.status}
                  </span>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 text-sm text-white/80 leading-relaxed">
                  <p className="font-bold text-amber-500 mb-2">{selectedReport.reason}</p>
                  {selectedReport.description || 'Ek açıklama belirtilmemiş.'}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={() => adminService.updateReportStatus(selectedReport.id, 'resolved', 'İncelendi ve çözüldü.')}
                  className="flex-1 py-4 rounded-2xl bg-green-500 text-black font-bold hover:bg-green-400 transition-all"
                >
                  Çözüldü Olarak İşaretle
                </button>
                <button
                  onClick={() => adminService.updateReportStatus(selectedReport.id, 'dismissed', 'Gerekli görülmedi.')}
                  className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all"
                >
                  Raporu Reddet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPanel;
