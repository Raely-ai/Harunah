import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, CreditCard, Moon, Cloud, Sparkles, LogOut, User, Loader2, History, ChevronRight, CheckCircle2, Clock, AlertCircle, Wallet, ArrowUpRight, Heart, Zap, Settings, ShieldAlert, Ban, Eye } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { signOut } from "firebase/auth";
import { auth, db, functions, handleFirestoreError, OperationType } from "./lib/firebase";
import { cacheManager } from "./lib/cacheManager";
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy, limit, getDoc, deleteField, runTransaction, increment, startAfter, serverTimestamp } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Toaster, toast } from "sonner";

import SplashScreen from "./components/SplashScreen";
import WelcomeScreen from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import RegisterScreen from "./components/RegisterScreen";
import ForgotPasswordScreen from "./components/ForgotPasswordScreen";
import EmailVerificationScreen from "./components/EmailVerificationScreen";
import HomeScreen from "./components/HomeScreen";
import BottomNav from "./components/BottomNav";
import FortuneFlow from "./components/FortuneFlow";
import ReadingResult from "./components/ReadingResult";
import HistoryScreen from "./components/HistoryScreen";
import AdminPanel from "./components/AdminPanel";
import ProfileView from "./components/ProfileView";
import SettingsView from "./components/SettingsView";
import DeleteAccountModal from "./components/DeleteAccountModal";
import SocialIntroScreen from "./components/SocialIntroScreen";
import SocialOnboardingFlow from "./components/SocialOnboardingFlow";
import SocialManagementScreen from "./components/SocialManagementScreen";
import SocialDiscoverScreen from "./components/SocialDiscoverScreen";
import SocialMessagesScreen from "./components/SocialMessagesScreen";
import SocialProfileScreen from "./components/SocialProfileScreen";
import SocialWalletScreen from "./components/SocialWalletScreen";
import FortunesScreen from "./components/FortunesScreen";
import { SubscriptionScreen } from "./components/SubscriptionScreen";
import { FortuneType, AuthScreen, AppTab, FortuneReading, ReadingStatus, UserProfile, AppConfig, EconomyConfig, normalizeUserProfile, isExternalPhotoUrl } from "./types";
import { DEFAULT_ECONOMY_CONFIG } from "./constants";
import { socialService } from "./lib/socialService";
import { walletService, callFunction } from "./lib/walletService";
import { isSocialProfileReady } from "./lib/socialUtils";
import { notificationService } from "./services/notificationService";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { BadgeProvider } from "./lib/BadgeContext";
import { NotificationToastListener } from "./components/NotificationToastListener";

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [user, loading, error] = useAuthState(auth);
  const [showSplash, setShowSplash] = useState(true);

  // Social login results are handled directly in components or via Auth state change
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [activeFortune, setActiveFortune] = useState<FortuneType | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [activeReading, setActiveReading] = useState<FortuneReading | null>(null);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [economyConfig, setEconomyConfig] = useState<EconomyConfig | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [previewUser, setPreviewUser] = useState<UserProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Auto-reset quota exceeded after 1 minute to allow probing
  useEffect(() => {
    if (!quotaExceeded) return;
    
    toast.error("Bağlantı Kısıtlı", {
      description: "Yıldızlar şu an çok meşgul, bazı özellikler geçici olarak kısıtlanmış olabilir. Lütfen daha sonra tekrar deneyin.",
      duration: 5000
    });

    const timer = setTimeout(() => {
      setQuotaExceeded(false);
    }, 60000); // 1 minute
    return () => clearTimeout(timer);
  }, [quotaExceeded]);
  
  // Notification Service Setup (Global)
  useEffect(() => {
    const handleNotificationAction = (data: any) => {
      console.log("NOTIFICATION_ACTION_TRIGGERED", data);
      if (data?.screen === 'chat' || data?.screen === 'messages' || (data?.type === 'message')) {
        handleNavigate('messages');
        const chatId = data?.chatId;
        if (chatId) {
          // Small delay to ensure navigation completes first
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('open-chat', { detail: { chatId } }));
          }, 300);
        }
      } else if (data?.screen === 'history' || data?.screen === 'fortunes' || data?.type === 'reading') {
        handleNavigate('history');
      } else if (data?.type === 'like' || data?.type === 'super_like') {
        handleNavigate('messages');
      }
    };

    const initPush = async () => {
      try {
        notificationService.setupListeners(user?.uid, handleNotificationAction);
        // Always request permission (or check status) to ensure channel and registration
        await notificationService.requestPermission(user?.uid);
        
        if (user) {
          notificationService.syncPendingToken(user.uid);
        }
      } catch (err) {
        console.error("Non-blocking push init failed:", err);
      }
    };
    initPush();
  }, [user?.uid]);

  const isAdmin = user?.email === 'hpferdicakir@gmail.com' || userProfile?.role === 'admin';

  const activeProfile = previewUser || userProfile || ({
    uid: user?.uid || "guest",
    email: user?.email || "",
    displayName: user?.displayName || "Gezgin",
    photoURL: !isExternalPhotoUrl(user?.photoURL) ? user?.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest" : "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest",
    mainCoins: 0,
    energy: 0,
    role: 'user',
    social: { enabled: false, profileCompleted: false }
  } as any);

  const activeConfig = appConfig || {
    prices: { coffee: 0, tarot: 0, water: 0, ebced: 0, yildizname: 0, havas: 0, dream: 0, extraQuestion: 0, priorityFee: 0 },
    icons: { coffee: '☕', tarot: '🃏', water: '💧', ebced: '❤️', yildizname: '⭐', havas: '✨' }
  } as any;

  const activeEconomy = economyConfig || DEFAULT_ECONOMY_CONFIG;

  // Admin Preview Mode (Optimized to getDoc)
  useEffect(() => {
    const previewId = localStorage.getItem('admin_preview_user_id');
    if (previewId && isAdmin && !quotaExceeded) {
      const fetchPreview = async () => {
        try {
          const snapshot = await getDoc(doc(db, "users", previewId));
          if (snapshot.exists()) {
            setPreviewUser(normalizeUserProfile(snapshot.data(), snapshot.id));
          }
        } catch (err: any) {
          const msg = err.message?.toLowerCase() || "";
          if (msg.includes("quota") || msg.includes("unavailable") || msg.includes("failed to fetch")) setQuotaExceeded(true);
        }
      };
      fetchPreview();
    } else {
      setPreviewUser(null);
    }
  }, [isAdmin, user?.uid, quotaExceeded]);

  // Unified Real-time Config & Economy Sync
  useEffect(() => {
    // 1. App Config - Real-time Listener
    const configRef = doc(db, "config", "global");
    const unsubscribeConfig = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const freshConfig = snapshot.data() as AppConfig;
        setAppConfig(freshConfig);
        cacheManager.set("appConfig", freshConfig, 3600, true);
      }
    }, (err: any) => {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("quota") || msg.includes("unavailable") || msg.includes("failed to fetch")) setQuotaExceeded(true);
      console.error("Config sync error:", err);
    });

    // 2. Economy Config - Real-time Listener (Only if user is logged in)
    let unsubscribeEconomy = () => {};
    if (user) {
      const economyRef = doc(db, "adminSettings", "economy");
      unsubscribeEconomy = onSnapshot(economyRef, (snapshot) => {
        if (snapshot.exists()) {
          const freshEconomy = snapshot.data() as EconomyConfig;
          setEconomyConfig(freshEconomy);
          cacheManager.set("economyConfig", freshEconomy, 1800, true);
        }
      }, (err: any) => {
        const msg = err.message?.toLowerCase() || "";
        if (msg.includes("quota") || msg.includes("unavailable") || msg.includes("failed to fetch")) setQuotaExceeded(true);
        console.error("Economy sync error:", err);
      });
    }

    return () => {
      unsubscribeConfig();
      unsubscribeEconomy();
    };
  }, [user, quotaExceeded]);

  // Listen for global notifications
  // REMOVED: Global notification listener is too expensive. 
  // Notifications are fetched on-demand in the Notifications screen.

  // AI Prompts State
  const [prompts, setPrompts] = useState<{type: FortuneType, content: string}[]>([
    { type: 'coffee', content: "Merhaba {isim}, senin kahve falına bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen bu bilgilere göre detaylı bir yorum yap." },
    { type: 'tarot', content: "Merhaba {isim}, senin için {kartlar} kartlarını çektim. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen bu kartlara ve bilgilere göre detaylı bir yorum yap." },
    { type: 'water', content: "Merhaba {isim}, suyun derinliklerine bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen suyun sana fısıldadıklarını detaylıca anlat." },
    { type: 'ebced', content: "Merhaba {isim}, ebced ilmiyle aşk hayatına bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen ebced hesaplamalarına göre aşk hayatını detaylıca yorumla." },
    { type: 'yildizname', content: "Merhaba {isim}, yıldız haritana bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen yıldızların konumuna göre geleceğini detaylıca yorumla." },
    { type: 'havas', content: "Merhaba {isim}, ilmi havas ile gizli enerjilere bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen bu derin ilme göre hayatını detaylıca yorumla." },
  ]);
  
    // Real Profile Sync (Unified, Local-First, and Quota-Aware)
    useEffect(() => {
      if (!user) {
        setUserProfile(null);
        setIsProfileLoading(false);
        return;
      }

      const CACHE_KEY = `userProfile_${user.uid}`;
      const cachedProfile = cacheManager.get<UserProfile>(CACHE_KEY);
      if (cachedProfile) {
        setUserProfile(cachedProfile);
        const hasBaseProfile = !!cachedProfile.birthDate && !!(cachedProfile.gender || cachedProfile.social?.gender);
        if (!hasBaseProfile) setActiveTab('social-onboarding');
        setIsProfileLoading(false);
      } else {
        setIsProfileLoading(true);
      }

      const userRef = doc(db, "users", user.uid);

      // Use a single onSnapshot for real-time profile updates
      const unsubscribe = onSnapshot(userRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const profile = normalizeUserProfile(data, snapshot.id);
          const hasBaseProfile = !!profile.birthDate && !!(profile.gender || profile.social?.gender);
          if (!hasBaseProfile) {
            setActiveTab(current => current === 'social-onboarding' ? current : 'social-onboarding');
          }
          setUserProfile(profile);
          cacheManager.set(CACHE_KEY, profile, 600, true); // Cache persistently for 10 mins
          setIsProfileLoading(false);
        } else if (!quotaExceeded) {
          // Document doesn't exist, create it (Only if not in quota error)
          try {
            const initialProfile: UserProfile = {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email?.split('@')[0] || "Gezgin",
              photoURL: !isExternalPhotoUrl(user.photoURL) ? user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=LASYADefault" : "https://api.dicebear.com/7.x/avataaars/svg?seed=LASYADefault",
              dailyAdReadingsUsed: {
                coffee: 0,
                tarot: 0,
                lastResetDate: new Date().toISOString().split('T')[0]
              },
              createdAt: new Date().toISOString(),
              isBanned: false,
              role: 'user',
              mainCoins: 0,
              energy: 0,
              superLikes: 0,
              refreshCount: 0,
              compatibilityCount: 0,
              dailyAdWatchCount: 0,
              lastAdReset: new Date().toISOString(),
              notificationSettings: {
                messages: true,
                likes: true,
                superLikes: true,
                fortunes: true,
                compatibility: true,
                rewards: true,
                broadcasts: true,
                reminders: true,
                system: true
              },
              social: {
                enabled: false,
                profileCompleted: false,
                nickname: user.displayName || "Gezgin",
                gender: 'erkek' as const,
                lookingFor: 'arkadaş',
                bio: '',
                photos: [] as string[],
                interests: [] as string[],
                visible: true,
                banned: false,
                settings: {
                  whoCanMessage: 'everyone' as const,
                  whoCanAddFriend: 'everyone' as const,
                  notifications: {
                    messages: true,
                    friendRequests: true,
                    roomInvites: true,
                    gifts: true
                  }
                }
              },
              subscription: {
                status: 'none',
                type: 'none',
                dailyLimitUsed: 0,
                dailyReadingsUsed: { coffee: 0, tarot: 0, advanced: 0 }
              }
            };
            await setDoc(userRef, initialProfile, { merge: true });
          } catch (setErr: any) {
            const msg = setErr.message?.toLowerCase() || "";
            if (msg.includes("quota") || msg.includes("unavailable") || msg.includes("failed to fetch")) setQuotaExceeded(true);
            setIsProfileLoading(false);
          }
        }
      }, (err: any) => {
        const msg = err.message?.toLowerCase() || "";
        if (msg.includes("quota") || msg.includes("unavailable") || msg.includes("failed to fetch")) {
          setQuotaExceeded(true);
          // If quota hit, we still have the cached profile in state
        } else {
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
        setIsProfileLoading(false);
      });

      return () => unsubscribe();
    }, [user?.uid, quotaExceeded]);

  // Global Discover Likes Reset Logic
  useEffect(() => {
    if (!userProfile?.uid || userProfile.uid === 'guest') return;

    const checkReset = async () => {
      const lastResetStr = userProfile.social?.discoverLikesLastReset;
      
      let shouldReset = false;
      if (!lastResetStr) {
        shouldReset = true;
      } else {
        const lastReset = new Date(lastResetStr);
        const now = new Date();
        const diffHrs = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
        if (diffHrs >= 24) shouldReset = true;
      }

      if (shouldReset) {
        try {
          // One-time Onboarding Boost check
          const createdAt = userProfile?.createdAt ? new Date(userProfile.createdAt) : new Date();
          const now = new Date();
          const isFirstDay = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60) <= 24;
          
          if (isFirstDay && !userProfile.social?.onboardingDiscoverBonusClaimed) {
            const claimBonus = httpsCallable(functions, 'claimOnboardingDiscoverBonus');
            await claimBonus();
            toast.success("İlk gün hediyen aktif: +50 Keşfet beğenisi ✨");
          } else {
            const resetLikes = httpsCallable(functions, 'resetDailyDiscoverLikes');
            await resetLikes();
          }
        } catch (err) {
          console.error("Discover likes reset error:", err);
        }
      }
    };

    checkReset();
  }, [userProfile?.uid, userProfile?.social?.discoverLikesLastReset]);

  // Onboarding: 10 minute active reward
  useEffect(() => {
    if (!userProfile?.uid || userProfile.uid === 'guest') return;
    
    // Have they received it? 
    if (userProfile.social?.receivedOnboarding10mReward) return;

    // Is the user newly registered? (e.g. less than 1 day)
    const createdAt = userProfile.createdAt ? new Date(userProfile.createdAt) : new Date();
    const now = new Date();
    if ((now.getTime() - createdAt.getTime()) > 24 * 60 * 60 * 1000) return; // Only for first day
    
    const timeoutId = setTimeout(async () => {
      try {
        const claimReward = httpsCallable(functions, 'claim10MinuteReward');
        await claimReward();
        toast.success("✨ 10 dakikadır bizimlesin! Hediye 1 Uyum Analizi kazandın.");
      } catch (err) {
        console.error("10m reward error", err);
      }
    }, 10 * 60 * 1000); // 10 mins

    return () => clearTimeout(timeoutId);
  }, [userProfile?.uid, userProfile?.social?.receivedOnboarding10mReward, userProfile?.createdAt]);

  // Automatic Robust Onboarding Completion (Fast-Track)
  useEffect(() => {
    if (!userProfile?.uid || userProfile.uid === 'guest') return;
    
    // Stricter Criteria: Require Bio and Interests for Auto-Complete
    const hasEnoughInterests = (userProfile.social?.interests || []).length >= 5;
    const hasEnoughBio = (userProfile.social?.bio || '').length >= 10;
    const hasNickname = (userProfile.social?.nickname || '').length >= 2;
    const hasBirthDate = !!userProfile.birthDate;
    const hasGender = !!userProfile.social?.gender;
    
    const isActuallyComplete = hasNickname && hasGender && hasBirthDate && hasEnoughInterests && hasEnoughBio;

    if (isActuallyComplete && (!userProfile.social?.profileCompleted || !userProfile.social?.enabled)) {
      // SYNC TO BACKEND
      const syncProfile = async () => {
        try {
          await updateDoc(doc(db, "users", userProfile.uid), {
            "social.enabled": true,
            "social.profileCompleted": true,
            "social.visible": true,
            "social.updatedAt": serverTimestamp()
          });
          console.log("[FastTrack] Profile autocompleted with robust criteria");
        } catch (err) {
          console.error("[FastTrack] Auto-sync failed:", err);
        }
      };
      
      syncProfile();
    }
  }, [
    userProfile?.social?.nickname, 
    userProfile?.social?.gender, 
    userProfile?.birthDate, 
    userProfile?.social?.interests?.length, 
    userProfile?.social?.bio?.length, 
    userProfile?.social?.profileCompleted
  ]);

  // Real History Sync (Lazy load with pagination)
  const [history, setHistory] = useState<FortuneReading[]>([]);
  const [lastHistoryDoc, setLastHistoryDoc] = useState<any>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  const fetchHistory = async (force = false) => {
    if (!user) return;
    
    // Check cache if not forced
    if (!force) {
      const cached = cacheManager.get<FortuneReading[]>(`userHistory_${user.uid}`);
      if (cached) {
        setHistory(cached);
        return;
      }
    }

    setIsHistoryLoading(true);
    try {
      const q = query(
        collection(db, "readings"), 
        where("userId", "==", user.uid), 
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const fetchedHistory: FortuneReading[] = [];
      snapshot.forEach((doc) => {
        fetchedHistory.push({ id: doc.id, ...doc.data() } as FortuneReading);
      });
      
      fetchedHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setHistory(fetchedHistory.slice(0, 20));
      if (fetchedHistory.length > 20) {
        const lastDocId = fetchedHistory[19].id;
        const lastDocSnap = snapshot.docs.find(d => d.id === lastDocId);
        if (lastDocSnap) setLastHistoryDoc(lastDocSnap);
      }
      setHasMoreHistory(fetchedHistory.length > 20);
      
      // Cache for 1 hour persistently
      cacheManager.set(`userHistory_${user.uid}`, fetchedHistory.slice(0, 20), 3600, true);
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("quota") || msg.includes("unavailable") || msg.includes("failed to fetch")) setQuotaExceeded(true);
      handleFirestoreError(err, OperationType.LIST, "readings");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (!user || quotaExceeded) return;
    // Fetch only when tab changes to history/fortunes
    if (activeTab === 'fortunes' || activeTab === 'history') {
      fetchHistory();
    }
  }, [user, activeTab, quotaExceeded]);

  const loadMoreHistory = async () => {
    if (!user || !lastHistoryDoc || !hasMoreHistory) return;
    
    try {
      const q = query(
        collection(db, "readings"),
        where("userId", "==", user.uid),
        limit(100)
      );
      
      const snapshot = await getDocs(q);
      const moreHistory: FortuneReading[] = [];
      snapshot.forEach((doc) => {
        moreHistory.push({ id: doc.id, ...doc.data() } as FortuneReading);
      });
      
      moreHistory.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Simple pagination in memory for fallback
      const currentIndex = lastHistoryDoc ? moreHistory.findIndex(h => h.id === lastHistoryDoc.id) : -1;
      const nextBatch = moreHistory.slice(currentIndex + 1, currentIndex + 1 + 20);
      
      setHistory(prev => {
        const combined = [...prev];
        for (const item of nextBatch) {
          if (!combined.some(c => c.id === item.id)) combined.push(item);
        }
        return combined;
      });
      
      if (nextBatch.length > 0) {
        const lastItem = nextBatch[nextBatch.length - 1];
        setLastHistoryDoc(snapshot.docs.find(d => d.id === lastItem.id) || null);
      }
      setHasMoreHistory(nextBatch.length === 20 && currentIndex + 21 < moreHistory.length);
    } catch (err: any) {
      const msg = err.message?.toLowerCase() || "";
      if (msg.includes("quota") || msg.includes("unavailable") || msg.includes("failed to fetch")) setQuotaExceeded(true);
      console.error("Load more history error:", err);
    }
  };

  // Sound Effects
  const playSound = (type: 'click' | 'success' | 'splash' | 'notification') => {
    const sounds = {
      click: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      success: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      splash: 'https://assets.mixkit.co/active_storage/sfx/2432/2432-preview.mp3',
      notification: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3'
    };
    const audio = new Audio(sounds[type]);
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore autoplay blocks
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);
    
    // Play splash sound after a short delay
    const soundTimer = setTimeout(() => {
      playSound('splash');
    }, 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(soundTimer);
    };
  }, []);

  const handleLogout = async () => {
    if (user?.uid) {
      await notificationService.removeToken(user.uid);
    }
    signOut(auth);
  };

  const handleNavigate = (tab: AppTab) => {
    playSound('click');
    setActiveTab(tab);
    window.scrollTo(0, 0);
  };

  const handleSelectFortune = (type: FortuneType) => {
    // No early return for null profile/config - we use defaults
    const prices = activeEconomy?.fortunePricing || DEFAULT_ECONOMY_CONFIG.fortunePricing;
    const price = (prices as any)[type] || 0;
    const isSubscribed = activeProfile.subscription?.status === 'active';
    const isAdEligible = ['coffee', 'tarot'].includes(type);

    if (isSubscribed) {
      const subLimits = activeEconomy?.subscriptionLimits || DEFAULT_ECONOMY_CONFIG.subscriptionLimits;
      const subUsed = activeProfile.subscription?.dailyReadingsUsed || { coffee: 0, tarot: 0, advanced: 0 };
      const limit = subLimits.totalDaily;
      const used = (subUsed.coffee || 0) + (subUsed.tarot || 0) + (subUsed.advanced || 0);

      if (used < limit) {
        setActiveFortune(type);
        return;
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const adUsage = activeProfile.dailyAdReadingsUsed || { coffee: 0, tarot: 0, lastResetDate: today };
    
    // Check Ad Credits first for Coffee/Tarot
    if (isAdEligible) {
      const adLimit = 2;
      const used = adUsage[type as 'coffee' | 'tarot'];
      if ((activeProfile.energy || 0) >= price && used < adLimit) {
        setActiveFortune(type);
        return;
      }
    }

    // Check Main Credits
    if ((activeProfile.mainCoins || 0) < price) {
      toast.error("Bakiyen yetersiz!", {
        description: isAdEligible 
          ? "Reklam izleyerek kredi kazanabilir veya bakiye yükleyebilirsin."
          : "Lütfen bakiye yükleyin."
      });
      return;
    }

    setActiveFortune(type);
  };

  // ---------------------------------------------------------------------------
  // 3. Fortune Synchronization Hook (Timestamp Based)
  // ---------------------------------------------------------------------------
  const isSyncingRef = useRef(false);

  const syncReadings = async () => {
    if (!user || !userProfile || isSyncingRef.current || history.length === 0 || quotaExceeded) return;
    isSyncingRef.current = true;

    try {
      const now = new Date();
      const pendingReadings = history.filter(r => 
        ["searching", "found", "interpreting", "waiting"].includes(r.status)
      );

      for (const reading of pendingReadings) {
        // New Status Flow Logic
        const expectedReaderFoundAt = reading.expectedReaderFoundAt ? new Date(reading.expectedReaderFoundAt) : null;
        const interpretationStartedAt = reading.interpretationStartedAt ? new Date(reading.interpretationStartedAt) : null;
        const expectedCompletedAt = reading.expectedCompletedAt ? new Date(reading.expectedCompletedAt) : null;

        // 1. Searching -> Found
        if (reading.status === 'searching' && expectedReaderFoundAt && now >= expectedReaderFoundAt) {
          try {
            await updateDoc(doc(db, "readings", reading.id), {
              status: 'found',
              updatedAt: now.toISOString()
            });
          } catch (err) {
            console.error("Sync: Failed to update status to found", err);
          }
          continue;
        }

        // 2. Found -> Interpreting
        if (reading.status === 'found' && interpretationStartedAt && now >= interpretationStartedAt) {
          try {
            await updateDoc(doc(db, "readings", reading.id), {
              status: 'interpreting',
              updatedAt: now.toISOString()
            });
          } catch (err) {
            console.error("Sync: Failed to update status to interpreting", err);
          }
          continue;
        }

        // 3. Interpreting -> Completed
        if (reading.status === 'interpreting' && expectedCompletedAt && now >= expectedCompletedAt) {
          try {
            // Only complete if AI has finished
            if (reading.isAIGenerated) {
              await updateDoc(doc(db, "readings", reading.id), {
                status: 'completed',
                updatedAt: now.toISOString()
              });
            }
          } catch (err: any) {
            if (err.message?.toLowerCase().includes("quota")) setQuotaExceeded(true);
            console.error("Sync: Failed to update status to completed", err);
          }
        }
      }
    } catch (err) {
      console.error("Fortune sync error:", err);
    } finally {
      isSyncingRef.current = false;
    }
  };

  useEffect(() => {
    if (!user || !userProfile || quotaExceeded) return;
    
    syncReadings();
    const interval = setInterval(syncReadings, 60000); // Every 60 seconds (optimized from 30)
    return () => clearInterval(interval);
  }, [user, userProfile, history, quotaExceeded]);

  const handleFortuneComplete = async (data: any) => {
    if (!user || isSubmitting || quotaExceeded) {
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Falınız hazırlanıyor...", {
      description: "Mistik güçler harekete geçiyor..."
    });

    try {
      const result = await callFunction('createFortuneReading', {
        type: data.type,
        formData: {
          adSoyad: data.adSoyad,
          dogumTarihi: data.dogumTarihi,
          iliskiDurumu: data.iliskiDurumu,
          motherName: data.motherName,
          fatherName: data.fatherName,
          targetName: data.targetName,
          jobStatus: data.jobStatus,
          extraInfo: data.extraInfo,
          birthTime: data.birthTime
        },
        questions: data.questions?.map((q: any) => typeof q === 'string' ? q : q.text),
        priorityMode: data.priorityMode
      });

      const { readingId } = result || {};

      if (!readingId) {
        throw new Error("Mistik bağlantı şu an kurulamadı. Lütfen bakiye kontrolü yapın.");
      }

      // Background AI Trigger (Non-blocking)
      callFunction('processFortuneAI', { readingId }).catch(e => {
        console.warn("AI background trigger failed:", e);
      });

      toast.dismiss(loadingToast);
      toast.success("Falınız sıraya alındı!", {
        description: "Yorumcu aranıyor... Durumu fallarım sekmesinden takip edebilirsiniz."
      });

      setActiveFortune(null);
      playSound('success');
      
      cacheManager.clear(`userHistory_${user.uid}`);
      fetchHistory(true);
      setActiveTab('history'); // Navigate to history immediately
      
      return { id: readingId };
    } catch (error: any) {
      console.error("Fortune creation error:", error);
      toast.dismiss(loadingToast);
      
      const isQuota = error.message?.toLowerCase().includes("quota");
      if (isQuota) setQuotaExceeded(true);

      toast.error("İşlem başarısız", {
        description: isQuota ? "Yıldızlar şu an çok yoğun, lütfen birazdan tekrar deneyin." : (error.message || "Lütfen daha sonra tekrar deneyin.")
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePriorityInterpretation = async (id: string) => {
    if (quotaExceeded) return;
    const loadingToast = toast.loading("Öncelikli yorum talebiniz işleniyor...");
    
    try {
      await callFunction('upgradeFortunePriority', { readingId: id });

      toast.dismiss(loadingToast);
      toast.success("Öncelikli yorum aktif edildi!", {
        description: "Falınız en kısa sürede yorumlanacak."
      });
      playSound('success');
    } catch (error: any) {
      console.error("Priority upgrade error:", error);
      toast.dismiss(loadingToast);
      toast.error("Hata", {
        description: error.message || "Lütfen daha sonra tekrar deneyin."
      });
    }
  };

  const handleSavePrompt = (type: FortuneType, content: string) => {
    setPrompts(prev => prev.map(p => p.type === type ? { ...p, content } : p));
  };

  const handleDeleteHistory = async (id: string) => {
    if (!user) return;
    try {
      // 1. Firestore'dan kalıcı olarak sil
      await deleteDoc(doc(db, "readings", id));
      
      // 2. Local state ve Cache güncelle
      setHistory(prev => {
        const updated = prev.filter(item => item.id !== id);
        // Cache'i de güncelle ki geri gelmesin
        cacheManager.set(`userHistory_${user.uid}`, updated, 3600, true);
        return updated;
      });
      
      toast.success("Kehanet silindi");
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `readings/${id}`);
      toast.error("Silme işlemi başarısız");
    }
  };

  const handleMarkAsSeen = (id: string) => {
    setHistory(prev => prev.map(item => 
      item.id === id ? { ...item, isSeenByUser: true } : item
    ));
    if (activeReading?.id === id) {
      setActiveReading(prev => prev ? { ...prev, isSeenByUser: true } : null);
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const reading = history.find(h => h.id === id);
    if (!reading) return;
    
    try {
      const newFavorite = !reading.isFavorite;
      setHistory(prev => prev.map(item => 
        item.id === id ? { ...item, isFavorite: newFavorite } : item
      ));
      await updateDoc(doc(db, "readings", id), { isFavorite: newFavorite });
    } catch (error) {
      console.error("Toggle favorite error:", error);
    }
  };

  const getStatusColor = (status: ReadingStatus) => {
    switch (status) {
      case 'waiting': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'interpreting': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'completed': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    }
  };

  const getStatusText = (status: ReadingStatus) => {
    switch (status) {
      case 'waiting': return 'Yorumcu Bekleniyor...';
      case 'interpreting': return 'Yorumlamaya Alındı...';
      case 'completed': return 'Yorumlandı';
    }
  };

  // Removed duplicate activeProfile and loading return

  if (showSplash || loading || (user && isProfileLoading)) {
    return <SplashScreen />;
  }

  if (!user) {
    return (
      <AnimatePresence mode="wait">
        {authScreen === 'welcome' && (
          <WelcomeScreen key="welcome" onNavigate={(screen) => setAuthScreen(screen)} />
        )}
        {authScreen === 'login' && (
          <LoginScreen key="login" onNavigate={(screen) => setAuthScreen(screen)} />
        )}
        {authScreen === 'register' && (
          <RegisterScreen key="register" onNavigate={(screen) => setAuthScreen(screen)} />
        )}
        {authScreen === 'forgot-password' && (
          <ForgotPasswordScreen key="forgot-password" onNavigate={() => setAuthScreen('login')} />
        )}
      </AnimatePresence>
    );
  }

  // Email Verification Check
  const isEmailUser = user.providerData.some(p => p.providerId === 'password');
  if (isEmailUser && !user.emailVerified) {
    return <EmailVerificationScreen />;
  }

  if (activeProfile.isBanned === true) {
    return (
      <div className="min-h-screen bg-[#FDFCFE] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-24 h-24 rounded-[2.5rem] bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-4 shadow-sm">
          <Ban className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-heading">Erişim Engellendi</h1>
        <p className="text-muted max-w-md leading-relaxed">
          Hesabınız topluluk kurallarını ihlal ettiği gerekçesiyle askıya alınmıştır. 
          Bir hata olduğunu düşünüyorsanız destek ekibiyle iletişime geçebilirsiniz.
        </p>
        <button 
          onClick={handleLogout}
          className="px-8 py-4 rounded-2xl bg-white border border-black/5 text-body font-bold hover:bg-black/5 transition-all shadow-sm"
        >
          Oturumu Kapat
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F6F4F8] relative text-body selection:bg-amber-500/30 overflow-x-hidden">
      <BadgeProvider userProfile={userProfile} quotaExceeded={quotaExceeded}>
        <NotificationToastListener userProfile={activeProfile} activeChatId={activeChatId} activeTab={activeTab} onNavigate={handleNavigate} />
        {/* Admin Preview Banner */}
        {previewUser && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-black py-2 px-4 flex items-center justify-between font-bold text-xs shadow-lg">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            <span>ÖNİZLEME MODU: {previewUser.displayName} ({previewUser.uid}) olarak görüntülüyorsunuz.</span>
          </div>
          <button 
            onClick={() => {
              localStorage.removeItem('admin_preview_user_id');
              setPreviewUser(null);
            }}
            className="bg-black/10 hover:bg-black/20 px-3 py-1 rounded-lg transition-all"
          >
            Önizlemeyi Kapat
          </button>
        </div>
      )}
      {/* Noise Texture Overlay */}
      <div className="fixed inset-0 noise-bg z-[1] opacity-[0.03]" />
      
      {/* Deep Mystical Gradient Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-purple-900/5 via-[#F8F9FB] to-[#F8F9FB] pointer-events-none z-[2]" />

      <Toaster position="top-center" expand={false} richColors />
      
      {/* Mystical Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-[3]">
        <div className="absolute top-[-20%] left-[-20%] w-[70%] h-[70%] bg-purple-900/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[70%] h-[70%] bg-amber-900/10 rounded-full blur-[150px]" />
        
        {/* Ambient Floating Elements (Refined) */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`heart-${i}`}
              initial={{ 
                opacity: 0,
                y: "110vh",
                x: `${Math.random() * 100}vw`,
                scale: Math.random() * 0.4 + 0.3
              }}
              animate={{ 
                opacity: [0, 0.15, 0],
                y: "-10vh",
                x: `${(Math.random() * 100) + (Math.sin(i) * 15)}vw`
              }}
              transition={{ 
                duration: 30 + Math.random() * 20,
                repeat: Infinity,
                delay: i * 4,
                ease: "linear"
              }}
              className="absolute"
            >
              <Heart className="w-6 h-6 text-purple-500/10 fill-purple-500/5" />
            </motion.div>
          ))}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              initial={{ 
                opacity: 0,
                y: "-10vh",
                x: `${Math.random() * 100}vw`,
                scale: Math.random() * 0.5 + 0.5
              }}
              animate={{ 
                opacity: [0, 0.3, 0],
                y: "110vh",
                x: `${(Math.random() * 100) + (Math.cos(i) * 10)}vw`
              }}
              transition={{ 
                duration: 25 + Math.random() * 25,
                repeat: Infinity,
                delay: i * 3,
                ease: "linear"
              }}
              className="absolute"
            >
              <Sparkles className="w-4 h-4 text-amber-400/15" />
            </motion.div>
          ))}
        </div>

        {/* Stars/Particles (Refined) */}
        <div className="fixed inset-0 opacity-50 pointer-events-none z-[4]">
          {[...Array(100)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: Math.random() }}
              animate={{ opacity: [0.1, 0.8, 0.1], scale: [1, 1.2, 1] }}
              transition={{ duration: 5 + Math.random() * 10, repeat: Infinity }}
              className="absolute w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className={`relative z-10 w-full ${activeTab === 'home' ? 'h-screen overflow-hidden' : 'pb-32'}`}>
        {/* Hidden Tabs for Persistence */}
        <div style={{ display: activeTab === 'home' ? 'block' : 'none' }} className="h-full w-full">
          <HomeScreen 
            user={user} 
            userProfile={activeProfile}
            history={history}
            onSelectFortune={handleSelectFortune}
            onNavigate={handleNavigate}
            config={activeConfig}
          />
        </div>

        <div style={{ display: activeTab === 'fortunes' ? 'block' : 'none' }}>
          <FortunesScreen 
            onSelectFortune={handleSelectFortune}
            onBack={() => handleNavigate('home')}
            config={activeConfig}
            economyConfig={activeEconomy}
            userProfile={activeProfile}
            history={history}
            onDeleteHistory={handleDeleteHistory}
            onToggleFavorite={handleToggleFavorite}
            onMarkAsSeen={handleMarkAsSeen}
            onRefreshHistory={() => fetchHistory(true)}
          />
        </div>

        <div style={{ display: activeTab === 'messages' ? 'block' : 'none' }} className="fixed inset-0 z-40 bg-[#F6F4F8]">
          <SocialMessagesScreen 
            currentUser={activeProfile}
            onNavigate={handleNavigate}
            onChatOpenChange={setIsChatOpen}
            setActiveChatId={setActiveChatId}
          />
        </div>
        
        <div style={{ display: activeTab === 'history' ? 'block' : 'none' }} className="fixed inset-0 z-40 bg-[#F6F4F8]">
          <HistoryScreen 
            history={history}
            userProfile={activeProfile}
            onBack={() => handleNavigate('home')}
            onDelete={handleDeleteHistory}
            onToggleFavorite={handleToggleFavorite}
            onRefresh={() => fetchHistory(true)}
          />
        </div>

        <div style={{ display: activeTab === 'wallet' ? 'block' : 'none' }} className="fixed inset-0 z-40 bg-[#F6F4F8]">
          <SocialWalletScreen 
            currentUser={activeProfile}
            onNavigate={handleNavigate}
            economyConfig={activeEconomy}
          />
        </div>

        <div style={{ display: activeTab === 'profile' ? 'block' : 'none' }} className="pt-8">
          <ProfileView 
            user={activeProfile}
            isAdmin={isAdmin}
            onSettings={() => setIsSettingsOpen(true)}
            onLogout={handleLogout}
            onDeleteAccount={() => setIsDeleteAccountOpen(true)}
            onAdminPanel={() => setIsAdminPanelOpen(true)}
            onNavigate={handleNavigate}
          />
        </div>

        <div style={{ display: activeTab === 'social-profile' ? 'block' : 'none' }} className="fixed inset-0 z-[70] bg-[#F6F4F8]">
          <SocialProfileScreen 
            currentUser={activeProfile}
            onNavigate={handleNavigate}
          />
        </div>

        <div style={{ display: activeTab === 'social-management' ? 'block' : 'none' }} className="min-h-screen">
          <SocialManagementScreen 
            user={activeProfile} 
            onNavigate={handleNavigate} 
          />
        </div>

        {/* Non-persistent tabs (Onboarding etc) */}
        <AnimatePresence mode="wait">
          {activeTab === 'social-onboarding' && (
            <motion.div
              key="social-onboarding"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-[70] bg-white"
            >
              <SocialOnboardingFlow 
                initialData={activeProfile}
                onBack={() => handleNavigate('home')}
                onComplete={() => handleNavigate('home')}
                isFastTrack={!activeProfile.gender || !activeProfile.birthDate}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {activeTab !== 'home' && (
          <footer className="mt-20 text-center pb-20">
            <p className="text-xs text-purple-200/20 font-medium uppercase tracking-widest">
              © 2026 LASYA • Tüm Hakları Saklıdır
            </p>
          </footer>
        )}
      </div>

      {!isChatOpen && (
        <BottomNav 
          activeTab={activeTab} 
          onTabChange={handleNavigate} 
          className={['social-onboarding'].includes(activeTab) ? 'hidden' : ''}
          userRole={activeProfile?.role}
        />
      )}

      <AnimatePresence>
        {activeFortune && (
          <FortuneFlow 
            type={activeFortune} 
            userProfile={activeProfile}
            config={activeConfig}
            economyConfig={activeEconomy}
            onUpdateProfile={(updates) => setUserProfile(prev => ({ ...prev, ...updates }))}
            onClose={() => setActiveFortune(null)}
            onComplete={handleFortuneComplete}
            onSocialClick={() => {
              setActiveFortune(null);
              setActiveTab('social-profile');
            }}
          />
        )}
        {activeReading && (
          <ReadingResult 
            reading={activeReading} 
            onClose={() => setActiveReading(null)} 
            onMarkAsSeen={handleMarkAsSeen}
          />
        )}
        {isSubscriptionOpen && (
          <SubscriptionScreen 
            onClose={() => setIsSubscriptionOpen(false)}
            economyConfig={activeEconomy}
            userProfile={activeProfile}
            onSubscribe={async (planId) => {
              try {
                const result = await walletService.buyFortuneSubscription(activeProfile.uid, planId as any);
                if (result.success) {
                  toast.success(`${planId} planı başarıyla başlatıldı!`);
                  setIsSubscriptionOpen(false);
                } else {
                  toast.error(result.message || "Abonelik başlatılamadı.");
                }
              } catch (error) {
                console.error("Subscription error:", error);
                toast.error("İşlem sırasında bir hata oluştu.");
              }
            }}
          />
        )}
        {isAdminPanelOpen && (
          <div className="fixed inset-0 z-[150] bg-white">
            <AdminPanel 
              onBack={() => setIsAdminPanelOpen(false)}
            />
          </div>
        )}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[150] bg-white">
            <SettingsView 
              onBack={() => setIsSettingsOpen(false)}
              onDeleteAccount={() => setIsDeleteAccountOpen(true)}
            />
          </div>
        )}
        {isDeleteAccountOpen && (
          <DeleteAccountModal 
            onClose={() => setIsDeleteAccountOpen(false)}
            onConfirm={async () => {
              try {
                const targetId = activeProfile.uid;
                if (!targetId || targetId === 'guest') {
                  toast.error("Geçerli bir oturum bulunamadı.");
                  return;
                }
                toast.success("Hesabınız siliniyor...");
                
                // Delete all readings first
                const readingsRef = collection(db, "readings");
                const q = query(readingsRef, where("userId", "==", targetId));
                const querySnapshot = await getDocs(q);
                const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);

                // Delete profile
                await deleteDoc(doc(db, "users", targetId));
                
                // Note: Auth deletion usually requires re-auth, so we just sign out for now
                // and the user doc is gone.
                setTimeout(() => {
                  signOut(auth);
                  setIsDeleteAccountOpen(false);
                  setIsSettingsOpen(false);
                }, 2000);
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, `users/${activeProfile.uid}`);
              }
            }}
          />
        )}
      </AnimatePresence>
      </BadgeProvider>
    </div>
  );
}
