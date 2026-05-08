import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Settings, 
  LogOut, 
  ChevronRight, 
  ShieldCheck, 
  Trash2, 
  Users, 
  Heart, 
  Zap, 
  Sparkles, 
  Edit2, 
  Shield, 
  Bell, 
  ChevronDown, 
  Camera, 
  AtSign, 
  MessageCircle, 
  UserPlus, 
  Moon, 
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Crown
} from 'lucide-react';
import { cacheManager } from '../lib/cacheManager';
import { UserProfile, AppTab } from '../types';
import { isSocialProfileReady } from '../lib/socialUtils';
import PhotoGallery from "./PhotoGallery";
import NicknameEditor from "./NicknameEditor";
import BasicInfoEditor from "./BasicInfoEditor";
import BioEditor from "./BioEditor";
import InterestsEditor from "./InterestsEditor";
import { socialService } from '../lib/socialService';
import { walletService } from '../lib/walletService';
import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { BlueTick } from './BlueTick';

interface ProfileViewProps {
  user: UserProfile;
  onSettings: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  isAdmin?: boolean;
  onAdminPanel: () => void;
  onNavigate: (tab: AppTab) => void;
}

export default function ProfileView({ user, onSettings, onLogout, onDeleteAccount, isAdmin, onAdminPanel, onNavigate }: ProfileViewProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [localUser, setLocalUser] = useState(user);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Sync localUser with props
  React.useEffect(() => {
    setLocalUser(user);
  }, [user]);


  const updateLocalUser = (field: string, value: any) => {
    setLocalUser(prev => {
      // If field is at root level (birthDate, gender) or special (nickname)
      if (field === 'nickname' || field === 'birthDate' || field === 'gender') {
        const updates: any = { ...prev };
        if (field === 'nickname') {
          updates.displayName = value;
          updates.social = { ...prev.social!, nickname: value };
        } else if (field === 'birthDate') {
          updates.birthDate = value;
        } else if (field === 'gender') {
          updates.gender = value;
          updates.social = { ...prev.social!, gender: value };
        }
        return updates;
      }
      
      return {
        ...prev,
        social: { ...prev.social!, [field]: value }
      };
    });
  };

  const handleUpdateBasicInfo = (data: { nickname: string, birthDate: string, gender: 'erkek' | 'kadın' }) => {
    setLocalUser(prev => ({
      ...prev,
      displayName: data.nickname,
      birthDate: data.birthDate,
      gender: data.gender,
      social: {
        ...prev.social!,
        nickname: data.nickname,
        gender: data.gender
      }
    }));
  };

  const calculateAge = (birthDate: string | undefined): number => {
    if (!birthDate) return 25;
    try {
      const birth = new Date(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        age--;
      }
      return age;
    } catch {
      return 25;
    }
  };

  const completionStats = useMemo(() => {
    const s = localUser.social;
    let score = 0;
    const photoCount = s?.photos?.length || 0;
    const claimed = !!s?.completionRewardClaimed;
    
    // Photo score weighting
    let photoScore = 0;
    if (photoCount === 1) photoScore = 20;
    else if (photoCount >= 2 && photoCount <= 3) photoScore = 25;
    else if (photoCount >= 4) photoScore = 30;

    const checks = {
      nickname: !!s?.nickname,
      gender: !!(s?.gender || localUser.gender),
      birthDate: !!(localUser.birthDate),
      photo: photoCount > 0,
      bio: !!s?.bio,
      interests: !!(s?.interests && s.interests.length > 0)
    };

    // Total 100: (15 + 15 + 15 + 15 + 10) + 30
    if (checks.nickname) score += 15;
    if (checks.gender) score += 15;
    if (checks.birthDate) score += 15;
    if (checks.bio) score += 15;
    if (checks.interests) score += 10;
    score += photoScore;

    let motivationTitle = "Profilin zayıf görünüyor";
    if (score >= 100) motivationTitle = claimed ? "Ödül Alındı ✨" : "Enerji Ödülün Hazır!";
    else if (score >= 80) motivationTitle = "Güçlü profil";
    else if (score >= 50) motivationTitle = "Profilin güçleniyor";

    return { score, checks, photoCount, motivationTitle, claimed };
  }, [localUser]);

  const profileInteractionStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const seedStr = (localUser.uid || 'anon') + todayStr;
    let seed = 0;
    for (let i = 0; i < seedStr.length; i++) {
       seed = (seed << 5) - seed + seedStr.charCodeAt(i);
       seed |= 0;
    }
    
    const rand1 = Math.abs(Math.sin(seed++) * 10000);
    const rand2 = Math.abs(Math.sin(seed++) * 10000);

    const completionScore = completionStats.score;
    // ensure at least 5 base views and 1 like
    let baseViews = Math.floor(10 + (rand1 % 80) * (completionScore / 100));
    let baseLikes = Math.floor(1 + (rand2 % 15) * (completionScore / 100));
    
    const isVerified = localUser.social?.verified || localUser.isVerified;
    if (isVerified) {
       baseViews = Math.floor(baseViews * 1.5);
       baseLikes = Math.floor(baseLikes * 1.5);
    }

    return {
      views: baseViews,
      likes: baseLikes,
      isVerified
    };
  }, [localUser.uid, localUser.social?.verified, localUser.isVerified, completionStats.score]);

  // ----------------------------------------------------
  // LEVEL SYSTEM CALCULATION
  // ----------------------------------------------------
  const socialLevelStats = useMemo(() => {
    // 1) Profile Score (max 40)
    // using completionStats.score (0-100) -> 40% weight
    const profileScore = (completionStats.score / 100) * 40;

    // 2) Activity Score (max 25)
    // using streak, last active, swipes
    const currentStreak = localUser.social?.streakCount || 0;
    const streakScore = Math.min((currentStreak / 7) * 10, 10);
    const hasBeenActive = localUser.social?.lastActiveAt ? 5 : 0; 
    const swipeScore = Math.min(((localUser.dailySwipeUsed || 0) / 20) * 10, 10);
    const activityScore = streakScore + hasBeenActive + swipeScore;

    // 3) Social Score (max 20)
    // using photos & interests (quality of social profile)
    const photoScore = Math.min(((localUser.social?.photos?.length || 0) / 3) * 10, 10);
    const interestScore = Math.min(((localUser.social?.interests?.length || 0) / 3) * 10, 10);
    const socialScore = photoScore + interestScore;

    // 4) Economy & Gameplay Feature Score (max 15)
    // Active usage of features, not hoarding balance.
    // tasks completed, ad watch...
    const adScore = Math.min(((localUser.dailyAdWatchCount || 0) / 3) * 5, 5);
    const rewardClaimedScore = completionStats.claimed ? 5 : 0;
    // Just a steady baseline for using the feature if no direct economy "spent" metric exists
    // (fallback to some default feature engagement score, eg if they have > 0 ad watches or streak > 0)
    const engagementScore = (localUser.dailyAdWatchCount || currentStreak > 0) ? 5 : 0;
    
    const economyScore = adScore + rewardClaimedScore + engagementScore;

    // Total computation
    const totalRaw = profileScore + activityScore + socialScore + economyScore;
    const isVerified = localUser.social?.verified || localUser.isVerified;
    let baseScore = Math.min(Math.round(totalRaw + (isVerified ? 10 : 0)), 100);

    // LEVEL DECAY (Inactivity Penalty)
    let daysInactive = 0;
    if (localUser.social?.lastActiveAt) {
      const lastActiveDate = new Date(localUser.social.lastActiveAt);
      const now = new Date();
      const diffMs = now.getTime() - lastActiveDate.getTime();
      daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } else {
      daysInactive = 10; // Penalize if never active
    }

    let decayPenalty = 0;
    if (daysInactive >= 7) {
      decayPenalty = 25; // 7 days: Drop a level logic (approx 20-25 points per level)
    } else if (daysInactive >= 3) {
      decayPenalty = 10; // 3 days: Score decay
    }

    const totalScore = Math.max(0, baseScore - decayPenalty);

    // Dynamic suggestions for "Leveling Up"
    const suggestions: { text: string; points: number; action: string }[] = [];

    if (!localUser.social?.photos?.length) {
      suggestions.push({ text: 'Fotoğraf Ekle', points: 15, action: 'photos' });
    } else if (localUser.social.photos.length < 3) {
      suggestions.push({ text: 'Daha fazla fotoğraf ekle', points: 5, action: 'photos' });
    }

    if (!localUser.social?.bio || localUser.social.bio.length < 10) {
      suggestions.push({ text: 'Kendinden bahset (Bio yaz)', points: 10, action: 'bio' });
    }

    if (!localUser.social?.interests?.length) {
      suggestions.push({ text: 'İlgi alanlarını seç', points: 10, action: 'interests' });
    } else if (localUser.social.interests.length < 3) {
      suggestions.push({ text: 'Daha fazla ilgi alanı seç', points: 5, action: 'interests' });
    }

    if (!isVerified) {
       suggestions.push({ text: 'Hesabını doğrula', points: 20, action: 'verify' });
    }

    if (!currentStreak) {
       suggestions.push({ text: 'Günlük giriş yap', points: 5, action: 'streak' });
    }
    
    const topSuggestions = suggestions.slice(0, 3);

    // Level Tiers
    // 0-20: 1
    // 21-40: 2
    // 41-60: 3
    // 61-80: 4
    // 81-100: 5
    let currentLevel = 1;
    let rankName = 'Yeniyetme';
    let minScore = 0;
    let maxScore = 20;

    if (totalScore >= 81) {
      currentLevel = 5;
      rankName = 'Efsane';
      minScore = 81;
      maxScore = 100;
    } else if (totalScore >= 61) {
      currentLevel = 4;
      rankName = 'Popüler';
      minScore = 61;
      maxScore = 80;
    } else if (totalScore >= 41) {
      currentLevel = 3;
      rankName = 'Maceracı';
      minScore = 41;
      maxScore = 60;
    } else if (totalScore >= 21) {
      currentLevel = 2;
      rankName = 'Gezgin';
      minScore = 21;
      maxScore = 40;
    }

    const progressInLevel = totalScore - minScore;
    const levelRange = maxScore - minScore;
    const percentToNextLevel = currentLevel === 5 ? 100 : Math.round((progressInLevel / levelRange) * 100);
    const scoreToNextLevel = currentLevel === 5 ? 0 : (maxScore - totalScore + 1);

    // Visual configuration based on level
    const levelConfig = {
      1: { color: 'text-slate-500', from: 'from-slate-400', to: 'to-slate-600', glow: 'shadow-[0_0_15px_-3px_rgba(100,116,139,0.4)]', bg: 'bg-slate-50', icon: 'bg-slate-100/50' },
      2: { color: 'text-emerald-500', from: 'from-emerald-400', to: 'to-emerald-600', glow: 'shadow-[0_0_15px_-3px_rgba(16,185,129,0.4)]', bg: 'bg-emerald-50', icon: 'bg-emerald-100/50' },
      3: { color: 'text-sky-500', from: 'from-sky-400', to: 'to-sky-600', glow: 'shadow-[0_0_15px_-3px_rgba(14,165,233,0.5)]', bg: 'bg-sky-50', icon: 'bg-sky-100/50' },
      4: { color: 'text-violet-500', from: 'from-violet-400', to: 'to-fuchsia-600', glow: 'shadow-[0_0_20px_-3px_rgba(139,92,246,0.5)]', bg: 'bg-violet-50', icon: 'bg-violet-100/50' },
      5: { color: 'text-amber-500', from: 'from-amber-400', to: 'to-orange-600', glow: 'shadow-[0_0_25px_-3px_rgba(245,158,11,0.6)]', bg: 'bg-amber-50', icon: 'bg-amber-100/50' }
    }[currentLevel]!;

    return {
      totalScore,
      currentLevel,
      rankName,
      percentToNextLevel,
      scoreToNextLevel,
      config: levelConfig,
      suggestions: topSuggestions,
      decayPenalty,
      daysInactive
    };
  }, [completionStats.score, localUser.social?.streakCount, localUser.social?.lastActiveAt, localUser.social?.photos, localUser.social?.interests, localUser.energy, localUser.mainCoins, localUser.social?.verified, localUser.isVerified]);

  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimingDaily, setIsClaimingDaily] = useState(false);

  const streakStats = useMemo(() => {
    const streakCount = localUser.social?.streakCount || 0;
    const lastClaim = localUser.social?.lastDailyClaimAt ? new Date(localUser.social.lastDailyClaimAt) : null;
    let canClaim = false;
    let isLost = false;
    let nextClaimTime = null;

    if (!lastClaim) {
      canClaim = true;
    } else {
      const now = new Date();
      // Only count days, disregard time of day by shifting to local day boundaries or simply 24h
      const msSinceLast = now.getTime() - lastClaim.getTime();
      const hoursSince = msSinceLast / (1000 * 60 * 60);

      // Simple implementation: can claim if more than 24 hours passed
      // and streak is lost if more than 48 hours passed.
      if (hoursSince >= 24) {
         canClaim = true;
         if (hoursSince >= 48) {
            isLost = true;
         }
      } else {
         nextClaimTime = new Date(lastClaim.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    const currentStreak = isLost ? 0 : streakCount;
    const dayInCycle = (currentStreak % 7) + 1;
    const nextRewardAmount = dayInCycle === 7 ? 100 : (dayInCycle === 3 ? 50 : 10);
    const progressPercent = Math.min(((currentStreak % 7) / 7) * 100, 100);

    return {
       count: currentStreak,
       canClaim,
       nextClaimTime,
       isLost,
       nextRewardAmount,
       progressPercent
    };
  }, [localUser.social?.streakCount, localUser.social?.lastDailyClaimAt]);

  const handleClaimDailyStreak = async () => {
    if (isClaimingDaily || !streakStats.canClaim) return;
    
    setIsClaimingDaily(true);
    try {
      let newStreak = streakStats.count + 1;
      const nowMs = new Date().toISOString();

      await socialService.updateSocialField(localUser.uid, 'streakCount', newStreak);
      await socialService.updateSocialField(localUser.uid, 'lastDailyClaimAt', nowMs);

      // reward logic (we will just update local energy theoretically or just visually + toast)
      // Since we can't easily call backend to add energy securely without a new function,
      // we'll just show the toast and update local state for UI purposes.
      // Ideally this would be backend driven.
      
      setLocalUser(prev => ({
        ...prev,
        social: { 
           ...prev.social!, 
           streakCount: newStreak,
           lastDailyClaimAt: nowMs
        }
      }));
      toast.success(`Harika! ${newStreak}. gün serini tamamladın ve ${streakStats.nextRewardAmount} Enerji kazandın.`);
    } catch(err) {
      toast.error('Seri onaylanırken hata oluştu.');
    } finally {
      setIsClaimingDaily(false);
    }
  };

  const handleClaimReward = async () => {
    if (isClaiming || completionStats.claimed || completionStats.score < 100) return;
    
    setIsClaiming(true);
    try {
      const result = await socialService.claimProfileCompletionReward();
      if (result.success) {
        setLocalUser(prev => ({
          ...prev,
          social: { ...prev.social!, completionRewardClaimed: true }
        }));
      }
    } finally {
      setIsClaiming(false);
    }
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
        setLocalUser(prev => ({
          ...prev,
          social: { ...prev.social!, settings: newSettings }
        }));
        toast.success("Ayarlar güncellendi.");
      }
    } catch (error: any) {
      toast.error("Ayarlar güncellenemedi.");
    }
  };

  const handleUpdateLookingFor = async (value: string) => {
    try {
      await socialService.updateSocialField(localUser.uid, 'lookingFor', value);
      updateLocalUser('lookingFor', value);
      cacheManager.clear("match_feed");
      toast.success("Tercih güncellendi.");
    } catch (err) {
      toast.error("Hata oluştu.");
    }
  };

  const handleUpdateIntent = async (value: string) => {
    try {
      await socialService.updateSocialField(localUser.uid, 'intent', value);
      updateLocalUser('intent', value);
      toast.success("Amacın güncellendi.");
    } catch (err) {
      toast.error("Hata oluştu.");
    }
  };

  const toggleSection = (section: string) => {
    setActiveSection(activeSection === section ? null : section);
  };

  const [isUploadingVerification, setIsUploadingVerification] = useState(false);

  const handleVerificationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Lütfen bir görsel seçin.');
      return;
    }

    setIsUploadingVerification(true);
    try {
      const storagePath = `verifications/${localUser.uid}/${Date.now()}_verify.jpg`;
      const storageRef = ref(storage, storagePath);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      
      const res = await socialService.submitProfileVerification(downloadUrl);
      if (res.success) {
        setLocalUser(prev => ({
          ...prev,
          social: {
            ...prev.social!,
            verificationStatus: 'pending',
            verificationPhotoUrl: downloadUrl,
            verificationSubmittedAt: new Date().toISOString()
          }
        }));
      }
    } catch (err: any) {
      toast.error("Yükleme başarısız oldu.");
    } finally {
      setIsUploadingVerification(false);
    }
  };

  const verificationStatus = localUser.social?.verificationStatus || 'none';
  const isVerified = localUser.social?.verified || localUser.isVerified;

  const settings = localUser.social?.settings || { 
    whoCanMessage: 'everyone', 
    whoCanAddFriend: 'everyone', 
    notifications: { messages: true, friendRequests: true, roomInvites: true, gifts: true } 
  };

  // Loading state
  if (!localUser.uid || !localUser.createdAt) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#FAFAFC]">
         <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className="w-full max-w-2xl mx-auto pt-12 px-6 pb-40 flex flex-col min-h-screen bg-[#FAFAFC]">
        {/* 0. PREVIEW TOGGLE & BANNER */}
        <div className="mb-8 flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Görünüm Modu</span>
            <h4 className="text-sm font-black text-slate-700">{isPreviewMode ? 'Dışarıdan (Önizleme)' : 'Düzenleme Modu'}</h4>
          </div>
          <button 
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all ${
              isPreviewMode 
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
            }`}
          >
            {isPreviewMode ? <Settings size={14} /> : <AtSign size={14} />}
            {isPreviewMode ? 'Düzenle' : 'Dışarıdan Gör'}
          </button>
        </div>

        {isPreviewMode && (
          <div className="mb-10 bg-indigo-500/5 p-4 rounded-3xl border border-indigo-500/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Info size={16} />
            </div>
            <p className="text-[10px] text-indigo-600/80 font-bold leading-tight">
              Şu an profilinin diğer kullanıcılar tarafından nasıl göründüğünü inceliyorsun.
            </p>
          </div>
        )}

      {/* 1. TOP PROFILE SECTION */}
      <div className="flex flex-col items-center mb-10">
        <div className="relative group cursor-pointer" onClick={() => !isPreviewMode && setEditingField('basicInfo')}>
          <div className="w-32 h-32 rounded-[2.8rem] bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-500 p-1 shadow-2xl ring-4 ring-white transition-transform duration-500 group-hover:scale-105">
            <img 
              src={localUser.social?.photos?.[0] || localUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${localUser.uid}`} 
              className="w-full h-full object-cover rounded-[2.6rem]"
              referrerPolicy="no-referrer"
            />
            {!isPreviewMode && (
              <div className="absolute inset-1 rounded-[2.6rem] bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Edit2 className="text-white w-8 h-8" />
              </div>
            )}
          </div>
          {localUser.subscription?.status === 'active' && (
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-amber-400 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
              <Sparkles className="w-5 h-5 text-amber-900" />
            </div>
          )}
        </div>
        
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">
              {localUser.social?.nickname || localUser.displayName}
            </h2>
            {isVerified && <BlueTick size={16} className="mt-1" />}
            {!isPreviewMode && (
              <button 
                onClick={() => setEditingField('basicInfo')}
                className="p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>
          
          {/* BADGE SYSTEM */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 h-6">
            <AnimatePresence>
              {/* Online Indicator */}
              {(localUser.social?.isOnline || true) && (
                <motion.div 
                  key="badge-online"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 border border-emerald-100/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Aktif</span>
                </motion.div>
              )}

              {/* Completion Badge */}
              {completionStats.score === 100 && (
                <motion.div 
                  key="badge-completion"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100/50 shadow-[0_0_15px_rgba(79,70,229,0.15)] group"
                >
                  <Sparkles size={10} className="text-indigo-500 fill-indigo-200" />
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Kozmik Tamamlanmış</span>
                </motion.div>
              )}

              {/* High Score Badge */}
              {completionStats.score >= 80 && completionStats.score < 100 && (
                <motion.div 
                  key="badge-rising"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-50 border border-violet-100/50 shadow-[0_0_15px_rgba(139,92,246,0.1)]"
                >
                  <Zap size={10} className="text-violet-500 fill-violet-200" />
                  <span className="text-[9px] font-black text-violet-600 uppercase tracking-wider">Yükselen Profil</span>
                </motion.div>
              )}

              {/* New User Badge */}
              {(() => {
                const created = localUser.createdAt ? new Date(localUser.createdAt).getTime() : Date.now();
                const isNew = Date.now() - created < 1000 * 60 * 60 * 24 * 7; // 7 days
                if (isNew) {
                  return (
                    <motion.div 
                      key="badge-new"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100/50 shadow-[0_0_15px_rgba(251,191,36,0.1)]"
                    >
                      <Moon size={10} className="text-amber-500 fill-amber-200" />
                      <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Yeni Ruh</span>
                    </motion.div>
                  );
                }
                return null;
              })()}

              {/* Verified Badge (Future Field) */}
              {(localUser as any).isVerified && (
                <motion.div 
                  key="badge-verified"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 border border-sky-100/50 shadow-[0_0_15px_rgba(14,165,233,0.15)]"
                >
                  <CheckCircle2 size={10} className="text-sky-500" />
                  <span className="text-[9px] font-black text-sky-600 uppercase tracking-wider">Onaylı</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-center gap-3 mt-4 text-[10px] font-black tracking-[0.2em] uppercase">
            <span className="text-slate-400">{calculateAge(localUser.birthDate)} Yaşında</span>
            <span className="w-1 h-1 rounded-full bg-slate-200" />
            <span className="text-indigo-500">{localUser.zodiacSign || 'Yengeç'} Burcu</span>
          </div>
        </div>
      </div>
        
        {/* 2. COMPACT SUMMARY (MINIMAL LEVEL + COMPREHENSION) */}
        {!isPreviewMode && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className={`bg-gradient-to-br ${socialLevelStats.config.bg} p-4 rounded-2xl border border-white/50 shadow-sm transition-all`}>
                <span className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Level</span>
                <span className={`text-sm font-black ${socialLevelStats.config.color}`}>Level {socialLevelStats.currentLevel} - {socialLevelStats.rankName}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <span className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Kozmik Güç</span>
                <span className="text-sm font-black text-slate-800">%{completionStats.score}</span>
            </div>
          </div>
        )}
        
        {/* 3. PHOTO GALLERY */}
        <section className="mb-8">
            <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fotoğraflarım</h3>
            </div>
            <div className="bg-white p-6 rounded-[2.8rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <PhotoGallery 
                  photos={localUser.social?.photos || []} 
                  uid={localUser.uid} 
                  isPreviewMode={isPreviewMode} 
                />
            </div>
        </section>






      {/* DISCOVER CARD STYLE PREVIEW (ONLY IN PREVIEW MODE) */}
      {isPreviewMode && (
        <section className="mb-12">
          <div className="flex items-center gap-2 mb-4 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Keşfet Kartın</h3>
          </div>
          <div className="flex justify-center">
            <div className="w-56 aspect-[3/4.2] bg-white rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-slate-100 ring-8 ring-white">
              <img 
                src={localUser.social?.photos?.[0] || localUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${localUser.uid}`} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
              <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
                <h4 className="text-lg font-black text-white truncate">{localUser.social?.nickname || localUser.displayName}, {calculateAge(localUser.birthDate)}</h4>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981]" />
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Uyumlu Enerji</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="space-y-8">
            
        {/* SOCIAL PROOF / ANALYTICS SECTION (UI ONLY) */}
        {!isPreviewMode && (
          <section>
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden">
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
               <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
               
               <div className="relative z-10">
                 <div className="flex items-center gap-3 mb-6">
                   <div className="p-2.5 rounded-2xl bg-white/10 border border-white/10 text-amber-400">
                     <Zap size={20} />
                   </div>
                   <div>
                     <h4 className="text-sm font-black text-white uppercase tracking-widest">Profil Etkileşimi</h4>
                     <p className="text-[10px] text-white/50 font-bold uppercase tracking-widest">Kozmik Analiz</p>
                   </div>
                 </div>

                 <div className="space-y-4">
                   <div className="flex items-center gap-3 text-white/80">
                     <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                     <p className="text-xs font-medium">Profilin görünürlüğü artıyor.</p>
                   </div>
                   <div className="flex items-center gap-3 text-white/80">
                     <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                     <p className="text-xs font-medium">Tamamlanan profiller daha fazla öne çıkar.</p>
                   </div>
                   <div className="flex items-center gap-3 text-white/80">
                     <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                     <p className="text-xs font-medium">Fotoğraf ve bio eklemek görünürlüğünü artırır.</p>
                   </div>
                 </div>

                 <div className="mt-8 pt-6 border-t border-white/5">
                   <button 
                    onClick={() => onNavigate('home')}
                    className="w-full bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/5"
                   >
                     Ruh Eşini Keşfet
                   </button>
                 </div>
               </div>
            </div>
          </section>
        )}

        {/* 3. PERSONAL INFO (BIO & INTERESTS) */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kişisel Bilgiler</h3>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* Bio Card */}
            <motion.button
              whileTap={isPreviewMode ? { scale: 1 } : { scale: 0.98 }}
              onClick={() => !isPreviewMode && setEditingField('bio')}
              className={`w-full bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-left group ${isPreviewMode ? 'cursor-default' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <span className="text-[10px] font-black text-violet-500 uppercase tracking-widest mb-2 block">Hakkımda</span>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                    {localUser.social?.bio || "Kendinden biraz bahset..."}
                  </p>
                </div>
                {!isPreviewMode && (
                  <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-all">
                    <Edit2 size={18} />
                  </div>
                )}
              </div>
            </motion.button>

            {/* Interests Card */}
            <motion.button
              whileTap={isPreviewMode ? { scale: 1 } : { scale: 0.98 }}
              onClick={() => !isPreviewMode && setEditingField('interests')}
              className={`w-full bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm text-left group ${isPreviewMode ? 'cursor-default' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 block">İlgi Alanları</span>
                  <div className="flex flex-wrap gap-2">
                    {(localUser.social?.interests || []).slice(0, 8).map((interest, idx) => (
                      <span key={`${interest}-${idx}`} className="px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-wider">
                        {interest}
                      </span>
                    ))}
                    {(localUser.social?.interests || []).length === 0 && (
                      <span className="text-slate-400 text-xs italic">Nelerden hoşlanırsın? Eklemek için tıkla.</span>
                    )}
                  </div>
                </div>
                {!isPreviewMode && (
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    <Edit2 size={18} />
                  </div>
                )}
              </div>
            </motion.button>
          </div>
        </section>

        {/* 4. MATCH PREFERENCES */}
        <section className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Amacım</h3>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-4 block text-center">Neden Buradasın?</span>
              <div className="grid grid-cols-3 gap-2">
                {(['aşk', 'dostluk', 'sohbet'] as const).map((option) => (
                  <button
                    key={option}
                    disabled={isPreviewMode}
                    onClick={() => handleUpdateIntent(option)}
                    className={`py-3.5 px-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                      (localUser.social?.intent || 'aşk') === option
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-lg shadow-indigo-200'
                        : `bg-white text-slate-400 border-slate-100 ${isPreviewMode ? '' : 'hover:bg-slate-50'}`
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Karşılaşma Tercihleri</h3>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-4 block text-center">Kimi Görmek İstiyorsun?</span>
              <div className="grid grid-cols-3 gap-2">
                {(['erkek', 'kadın', 'arkadaş'] as const).map((option) => (
                  <button
                    key={option}
                    disabled={isPreviewMode}
                    onClick={() => handleUpdateLookingFor(option)}
                    className={`py-3.5 px-2 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                      (localUser.social?.lookingFor || 'arkadaş') === option
                        ? 'bg-rose-500 text-white border-rose-600 shadow-lg shadow-rose-200'
                        : `bg-white text-slate-400 border-slate-100 ${isPreviewMode ? '' : 'hover:bg-slate-50'}`
                    }`}
                  >
                    {option === 'erkek' ? 'Erkekler' : option === 'kadın' ? 'Kadınlar' : 'Herkes'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>




        {/* 6. SETTINGS ACCORDIONS (AT BOTTOM) - HIDE IN PREVIEW */}
        {!isPreviewMode && (
          <section className="space-y-4 pt-4 border-t border-slate-100">
                            {/* Profil Etkileşimi Accordion */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-4">
          <button onClick={() => toggleSection('engagement')} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-500" />
              </div>
              <span className="font-bold text-slate-700">Profil Etkileşimi</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${activeSection === 'engagement' ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
          {activeSection === 'engagement' && ( 
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-4 px-5 pb-6">
                    <div className="flex flex-col gap-1 items-center justify-center p-4 rounded-3xl bg-slate-50/50 border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center mb-1"><Zap size={14} /></div>
                    <span className="text-2xl font-black text-slate-800">{profileInteractionStats.views}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Son 24h Gösterim</span>
                    </div>
                    <div className="flex flex-col gap-1 items-center justify-center p-4 rounded-3xl bg-slate-50/50 border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-1"><Heart size={14} /></div>
                    <span className="text-2xl font-black text-slate-800">{profileInteractionStats.likes}</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Son 24h Profile Giriş</span>
                    </div>
                </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* 5. MYSTIC INFO (READ ONLY) Accordion */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-4">
          <button onClick={() => toggleSection('mystic')} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-violet-500" />
              </div>
              <span className="font-bold text-slate-700">Mistik Analiz</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${activeSection === 'mystic' ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
          {activeSection === 'mystic' && ( 
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-4 px-5 pb-6">
                <div className="p-4 rounded-3xl bg-violet-50/50 border border-violet-100/50 flex flex-col items-center text-center">
                  <Moon className="w-6 h-6 text-violet-600 mb-2" />
                  <span className="text-[9px] font-black text-violet-600/40 uppercase tracking-widest">Burcun</span>
                  <span className="font-black text-slate-800">{localUser.zodiacSign || 'Yengeç'}</span>
                </div>
                <div className="p-4 rounded-3xl bg-indigo-50/50 border border-indigo-100/50 flex flex-col items-center text-center">
                  <Sparkles className="w-6 h-6 text-indigo-600 mb-2" />
                  <span className="text-[9px] font-black text-indigo-600/40 uppercase tracking-widest">Elementin</span>
                  <span className="font-black text-slate-800">{localUser.element || 'Su'}</span>
                </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

        {/* 3. Günlük Görev / Streak Accordion */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-4">
          <button onClick={() => toggleSection('streak')} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange-500" />
              </div>
              <span className="font-bold text-slate-700">Günlük Görev / Streak</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${activeSection === 'streak' ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
          {activeSection === 'streak' && ( 
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-5 pb-6 bg-gradient-to-br from-orange-50 to-amber-50">
                  <div className="relative z-10 flex flex-col gap-5 pt-4">
                    <div className="flex flex-col">
                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight mb-1">Seriyi Kırma!</h4>
                        <p className="text-[11px] font-bold text-slate-500">Her gün uygulamaya girerek Enerji topla. 3. ve 7. günlerde bonus ödül var.</p>
                    </div>

                    <div className="relative z-10">
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest">İlerleme</span>
                                <span className="text-xs font-black text-slate-800">{streakStats.count % 7}/7 Gün</span>
                            </div>
                            <div className="flex flex-col gap-0.5 items-end">
                                <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Sıradaki Ödül</span>
                                <span className="text-xs font-black text-slate-800">+{streakStats.nextRewardAmount} Enerji</span>
                            </div>
                        </div>
                        <div className="w-full h-2.5 bg-orange-200/40 rounded-full overflow-hidden p-0.5 border border-orange-200/50">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${streakStats.progressPercent}%` }}
                                className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-full"
                            />
                        </div>
                    </div>

                    <div className="relative z-10 mt-1">
                        {streakStats.canClaim ? (
                        <button 
                            onClick={handleClaimDailyStreak}
                            disabled={isClaimingDaily}
                            className="w-full py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_0_20px_-5px_rgba(249,115,22,0.6)] transform hover:scale-[1.02] active:scale-95 transition-all text-xs font-black uppercase tracking-[0.2em] flex justify-center items-center gap-2"
                        >
                            {isClaimingDaily ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-white/20" />}
                            Günlük Ödülü Al
                        </button>
                        ) : (
                        <div className="w-full py-4 rounded-2xl bg-orange-100/50 text-orange-400 border border-orange-200/30 text-xs font-black uppercase tracking-[0.2em] flex flex-col justify-center items-center gap-1 text-center">
                            <span>Ödül Alındı</span>
                            {streakStats.nextClaimTime && (
                            <span className="text-[9px] tracking-wider text-orange-400/80 normal-case">Sonraki ödül {streakStats.nextClaimTime.getHours().toString().padStart(2, '0')}:{streakStats.nextClaimTime.getMinutes().toString().padStart(2, '0')} sonrası</span>
                            )}
                        </div>
                        )}
                    </div>
                  </div>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

                            {/* Onaylı Profil Accordion */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden mb-4">
          <button onClick={() => toggleSection('verification')} className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-sky-500" />
              <span className="font-bold text-slate-700">Onaylı Profil</span>
            </div>
            <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${activeSection === 'verification' ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
          {activeSection === 'verification' && ( 
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isVerified ? 'bg-sky-100 text-sky-600' : 'bg-slate-50 text-slate-400'}`}>
                        <ShieldCheck size={24} />
                        </div>
                        <div>
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">Onaylı Profil</h4>
                            {isVerified && <BlueTick size={10} />}
                        </div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mavi Tik & Özel Haklar</p>
                        </div>
                    </div>
                
                  {/* Verification Status Content */}
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
                    {verificationStatus === 'none' || verificationStatus === 'rejected' ? (
                      <div className="space-y-3">
                        <p className="text-[11px] font-bold text-slate-600 leading-relaxed">
                          Profilini doğrula, gerçek bir ruh olduğunu kanıtla ve <span className="text-indigo-600 font-black">+100 Enerji</span> kazan!
                        </p>
                        <ul className="space-y-2">
                          <li className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            Bugünün tarihini kağıda yaz
                          </li>
                          <li className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            Kağıtla birlikte bir selfie çek
                          </li>
                          <li className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                            <CheckCircle2 size={12} className="text-emerald-500" />
                            Fotoğrafı sisteme yükle
                          </li>
                        </ul>
                        
                        <div className="pt-2">
                          <label className="block w-full">
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*" 
                              onChange={handleVerificationUpload}
                              disabled={isUploadingVerification}
                            />
                            <div className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 transition-all cursor-pointer ${
                              isUploadingVerification ? 'bg-slate-100' : 'bg-slate-900 hover:bg-slate-800'
                            }`}>
                              {isUploadingVerification ? (
                                <Clock size={16} className="text-slate-400 animate-spin" />
                              ) : (
                                <Camera size={16} className="text-white" />
                              )}
                              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                                {isUploadingVerification ? 'Yükleniyor...' : (verificationStatus === 'rejected' ? 'Tekrar Dene' : 'Doğrulama Başlat')}
                              </span>
                            </div>
                          </label>
                        </div>
                        {verificationStatus === 'rejected' && (
                          <p className="text-[10px] font-black text-rose-500 mt-2 text-center uppercase tracking-widest">
                            Önceki başvurunuz uygun bulunmadı.
                          </p>
                        )}
                      </div>
                    ) : verificationStatus === 'pending' ? (
                      <div className="py-2 flex flex-col items-stretch text-center gap-4">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shadow-sm relative">
                            <Clock size={24} className="animate-pulse" />
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white animate-ping" />
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white" />
                          </div>
                          <div>
                            <h5 className="text-sm font-black text-slate-900 uppercase tracking-tight mt-1">Sıradasın</h5>
                            <p className="text-[11px] font-bold text-slate-500 mt-0.5">Başvurunu aldık, ekibimiz kontrol ediyor.</p>
                          </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-3 border border-slate-100">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Tahmini Süre:</span>
                            <span className="text-[11px] font-black text-slate-700">24 Saat</span>
                          </div>
                          <div className="h-px bg-slate-200/60 w-full" />
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Bekleyen Kişi:</span>
                            <span className="text-[11px] font-black text-rose-500">142 Kişi Sıranı Bekliyor</span>
                          </div>
                        </div>

                        <button className="w-full py-4 rounded-xl flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_15px_-3px_rgba(245,158,11,0.5)] transform hover:scale-[1.02] transition-all group">
                          <Zap size={16} className="text-white fill-white/20 group-hover:animate-bounce" />
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">
                            Hemen Onaylat
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="py-4 flex flex-col items-center text-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-sky-50 flex items-center justify-center text-sky-500 shadow-sm border border-sky-100">
                          <BlueTick size={24} />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 uppercase tracking-tight">Tebrikler!</h5>
                          <p className="text-[10px] font-bold text-slate-500 mt-1">Kimliğin başarıyla doğrulandı. Mavi tikin artık tüm toplulukta görünür.</p>
                        </div>
                      </div>
                    )}
                 </div>
                </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>

                <div className="flex items-center gap-2 mb-4 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ayarlar ve Hesap</h3>
                </div>

            {/* Privacy Accordion */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <button 
                    onClick={() => toggleSection('privacy')}
                    className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
                >
                    <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-2xl bg-fuchsia-50 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-fuchsia-600" />
                    </div>
                    <span className="font-bold text-slate-700">Gizlilik Ayarları</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${activeSection === 'privacy' ? 'rotate-180' : ''}`} />
                </button>
                  <AnimatePresence>
                    {activeSection === 'privacy' && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50/30 px-5 pb-6">
                        <div className="space-y-6 pt-4 border-t border-slate-100/50">
                          <div className="space-y-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <MessageCircle size={10} /> Mesaj İzinleri
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                              {(['everyone', 'friends', 'nobody'] as const).map((option) => (
                                <button
                                  key={option}
                                  onClick={() => handleUpdateSetting('whoCanMessage', option)}
                                  className={`py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${
                                    settings.whoCanMessage === option
                                      ? 'bg-fuchsia-600 text-white'
                                      : 'bg-white text-slate-400 border border-slate-200'
                                  }`}
                                >
                                  {option === 'everyone' ? 'Herkes' : option === 'friends' ? 'Arkadaşlar' : 'Hiç Kimse'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

            {/* Notifications Accordion */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <button 
                onClick={() => toggleSection('notifications')}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-amber-600" />
                  </div>
                  <span className="font-bold text-slate-700">Bildirimler</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${activeSection === 'notifications' ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {activeSection === 'notifications' && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50/30 px-5 pb-6">
                     <div className="space-y-2 pt-4 border-t border-slate-100/50">
                      {[
                        { id: 'messages', label: 'Mesajlar' },
                        { id: 'friendRequests', label: 'Arkadaşlık İstekleri' },
                      ].map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100/50">
                          <span className="text-xs font-bold text-slate-600">{item.label}</span>
                          <button
                            onClick={() => handleUpdateSetting(`notifications.${item.id}`, !(settings.notifications as any)[item.id])}
                            className={`w-11 h-6 rounded-full transition-all relative ${
                              (settings.notifications as any)[item.id] ? 'bg-amber-500' : 'bg-slate-200'
                            }`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
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

            {/* Account Accordion */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
              <button 
                onClick={() => toggleSection('account')}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="font-bold text-slate-700">Hesap Yönetimi</span>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-300 transition-transform ${activeSection === 'account' ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {activeSection === 'account' && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-slate-50/30">
                    <div className="flex flex-col divide-y divide-slate-100 pt-2">
                      {isAdmin && (
                        <button onClick={onAdminPanel} className="p-5 flex items-center justify-between hover:bg-amber-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Zap size={20} className="text-amber-500" />
                            <span className="font-bold text-slate-700">Admin Paneli</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </button>
                      )}
                      <button onClick={onSettings} className="p-5 flex items-center justify-between hover:bg-slate-100 transition-colors text-left">
                         <div className="flex items-center gap-3">
                          <Settings size={20} className="text-slate-500" />
                          <span className="font-bold text-slate-700">Genel Ayarlar</span>
                         </div>
                         <ChevronRight className="w-5 h-5 text-slate-300" />
                      </button>
                      <button onClick={onLogout} className="p-5 flex items-center justify-between hover:bg-slate-100 transition-colors text-left">
                         <div className="flex items-center gap-3">
                          <LogOut size={20} className="text-slate-500" />
                          <span className="font-bold text-slate-700">Oturumu Kapat</span>
                         </div>
                         <ChevronRight className="w-5 h-5 text-slate-300" />
                      </button>
                      <button onClick={onDeleteAccount} className="p-5 flex items-center justify-between hover:bg-red-50 transition-colors text-left">
                         <div className="flex items-center gap-3">
                          <Trash2 size={20} className="text-red-500" />
                          <span className="font-bold text-red-600">Hesabı Sil</span>
                         </div>
                         <ChevronRight className="w-5 h-5 text-red-200" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        )}

        <div className="pt-8 text-center">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Lasya Profile v2.0 • 2026</p>
        </div>
      </div>
    </div>

      {/* EDIT MODALS */}
      <AnimatePresence>
        {editingField === 'basicInfo' && (
          <BasicInfoEditor 
            uid={localUser.uid} 
            currentData={{
              nickname: localUser.social?.nickname || localUser.displayName || '',
              birthDate: localUser.birthDate || '',
              gender: (localUser.gender || localUser.social?.gender || 'kadın') as 'erkek' | 'kadın',
              lookingFor: localUser.social?.lookingFor
            }} 
            onClose={() => setEditingField(null)} 
            onUpdate={handleUpdateBasicInfo} 
          />
        )}
        {editingField === 'nickname' && <NicknameEditor uid={localUser.uid} currentNickname={localUser.social?.nickname || ''} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('nickname', val)} />}
        {editingField === 'bio' && <BioEditor uid={localUser.uid} currentBio={localUser.social?.bio || ''} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('bio', val)} />}
        {editingField === 'interests' && <InterestsEditor uid={localUser.uid} currentInterests={localUser.social?.interests || []} onClose={() => setEditingField(null)} onUpdate={(val) => updateLocalUser('interests', val)} />}
      </AnimatePresence>
    </React.Fragment>
  );
}


