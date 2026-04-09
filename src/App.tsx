import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, CreditCard, Moon, Cloud, Sparkles, LogOut, User, Loader2, History, ChevronRight, CheckCircle2, Clock, AlertCircle, Wallet, ArrowUpRight, Heart, Zap, Settings, ShieldAlert, Ban, Eye } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { signOut } from "firebase/auth";
import { auth, db, functions, handleFirestoreError, OperationType } from "./lib/firebase";
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy, limit, getDoc, deleteField, runTransaction, increment } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { Toaster, toast } from "sonner";

import Header from "./components/Header";
import FortuneCard from "./components/FortuneCard";
import SplashScreen from "./components/SplashScreen";
import WelcomeScreen from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import RegisterScreen from "./components/RegisterScreen";
import ForgotPasswordScreen from "./components/ForgotPasswordScreen";
import HomeScreen from "./components/HomeScreen";
import BottomNav from "./components/BottomNav";
import FortuneFlow from "./components/FortuneFlow";
import ReadingResult from "./components/ReadingResult";
import HistoryScreen from "./components/HistoryScreen";
import AdminPanel from "./components/AdminPanel";
import ProfileView from "./components/ProfileView";
import SettingsView from "./components/SettingsView";
import DeleteAccountModal from "./components/DeleteAccountModal";
import HoroscopeScreen from "./components/HoroscopeScreen";
import SocialIntroScreen from "./components/SocialIntroScreen";
import SocialOnboardingFlow from "./components/SocialOnboardingFlow";
import SocialManagementScreen from "./components/SocialManagementScreen";
import SocialDiscoverScreen from "./components/SocialDiscoverScreen";
import SocialMessagesScreen from "./components/SocialMessagesScreen";
import SocialProfileScreen from "./components/SocialProfileScreen";
import SocialWalletScreen from "./components/SocialWalletScreen";
import FortunesScreen from "./components/FortunesScreen";
import { SubscriptionScreen } from "./components/SubscriptionScreen";
import { FortuneType, AuthScreen, AppTab, FortuneReading, ReadingStatus, UserProfile, AppConfig, Horoscope, EconomyConfig, normalizeUserProfile } from "./types";
import { DEFAULT_ECONOMY_CONFIG } from "./constants";
import { socialService } from "./lib/socialService";
import { walletService } from "./lib/walletService";
import { isSocialProfileReady } from "./lib/socialUtils";

import { ErrorBoundary } from "./components/ErrorBoundary";

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
  const [horoscopes, setHoroscopes] = useState<Record<string, Horoscope>>({});
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Presence Management
  useEffect(() => {
    if (!user?.uid) return;

    // Set online
    socialService.updateUserStatus(user.uid, true);

    // Set offline on tab close or navigation away
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        socialService.updateUserStatus(user.uid, false);
      } else {
        socialService.updateUserStatus(user.uid, true);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => socialService.updateUserStatus(user.uid, false));

    return () => {
      socialService.updateUserStatus(user.uid, false);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.uid]);

  useEffect(() => {
    // Auto-fix: If profile has core data but flag is missing, fix it.
    if (userProfile && !userProfile.social?.profileCompleted) {
      const hasNickname = !!(userProfile.social?.nickname || userProfile.nickname);
      const hasPhotos = (userProfile.social?.photos?.length || 0) > 0 || (userProfile.photos?.length || 0) > 0;
      const hasGender = !!(userProfile.social?.gender || userProfile.gender);

      if (hasNickname && hasPhotos && hasGender) {
        const fixProfileFlag = async () => {
          try {
            const { doc, updateDoc } = await import("firebase/firestore");
            await updateDoc(doc(db, "users", userProfile.uid), { 
              "social.profileCompleted": true,
              "social.enabled": true,
              "social.visible": true
            });
            console.log("Auto-fixed social profile flags for user:", userProfile.uid);
          } catch (error) {
            console.error("Auto-fix profile flag error:", error);
          }
        };
        fixProfileFlag();
      }
    }
  }, [userProfile]);

  const isAdmin = user?.email === 'hpferdicakir@gmail.com' || userProfile?.role === 'admin';

  // Admin Preview Mode
  useEffect(() => {
    const previewId = localStorage.getItem('admin_preview_user_id');
    if (previewId && isAdmin) {
      const unsubscribe = onSnapshot(doc(db, "users", previewId), (snapshot) => {
        if (snapshot.exists()) {
          setPreviewUser(normalizeUserProfile(snapshot.data(), snapshot.id));
        }
      });
      return () => unsubscribe();
    } else {
      setPreviewUser(null);
    }
  }, [isAdmin, user?.uid]);

  // Fetch Global Config
  useEffect(() => {
    const configRef = doc(db, "config", "global");
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setAppConfig(snapshot.data() as AppConfig);
      } else {
        // Provide a default config if not found in Firestore yet
        const defaultConfig: AppConfig = {
          prices: { coffee: 50, tarot: 40, water: 30, ebced: 30, yildizname: 30, havas: 30, horoscope: 30, dream: 30, extraQuestion: 10, priorityFee: 20 },
          icons: { coffee: '☕', tarot: '🃏', water: '💧', ebced: '🔢', yildizname: '✨', havas: '📜', mainBalance: '🪙', adBalance: '⚡' },
          dailyMessagePrompt: "Günün mesajını oluştur. Yanıtı şu JSON formatında ver: { \"text\": \"mesaj içeriği\", \"category\": \"love|career|general\" }",
          adRewardEnergy: 5,
          maxDailyAds: 5,
          subscriptionLimits: { coffee: 5, tarot: 5, advanced: 5, totalDaily: 10 },
          packagePrices: { "100_coins": 49.99, "500_coins": 199.99, "daily_sub": 19.99, "weekly_sub": 59.99, "monthly_sub": 149.99 }
        };
        setAppConfig(defaultConfig);
      }
    }, (err) => {
      console.error("Config fetch error:", err);
      // Fallback on error too
      setAppConfig({
        prices: { coffee: 50, tarot: 40, water: 30, ebced: 30, yildizname: 30, havas: 30, horoscope: 30, dream: 30, extraQuestion: 10, priorityFee: 20 },
        icons: { coffee: '☕', tarot: '🃏', water: '💧', ebced: '🔢', yildizname: '✨', havas: '📜', mainBalance: '🪙', adBalance: '⚡' },
        dailyMessagePrompt: "Günün mesajını oluştur. Yanıtı şu JSON formatında ver: { \"text\": \"mesaj içeriği\", \"category\": \"love|career|general\" }",
        adRewardEnergy: 5,
        maxDailyAds: 5,
        subscriptionLimits: { coffee: 5, tarot: 5, advanced: 5, totalDaily: 10 },
        packagePrices: { "100_coins": 49.99, "500_coins": 199.99, "daily_sub": 19.99, "weekly_sub": 59.99, "monthly_sub": 149.99 }
      });
    });
    return () => unsubscribe();
  }, []);

  // Fetch Economy Config
  useEffect(() => {
    if (!user) return;
    const economyRef = doc(db, "adminSettings", "economy");
    const unsubscribe = onSnapshot(economyRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setEconomyConfig({
          ...DEFAULT_ECONOMY_CONFIG,
          ...data,
          fortunePricing: { ...DEFAULT_ECONOMY_CONFIG.fortunePricing, ...(data.fortunePricing || {}) },
          interpretationTimes: { ...DEFAULT_ECONOMY_CONFIG.interpretationTimes, ...(data.interpretationTimes || {}) },
          subscriptionLimits: { ...DEFAULT_ECONOMY_CONFIG.subscriptionLimits, ...(data.subscriptionLimits || {}) },
          aiSettings: { ...DEFAULT_ECONOMY_CONFIG.aiSettings, ...(data.aiSettings || {}) },
          rewards: { ...DEFAULT_ECONOMY_CONFIG.rewards, ...(data.rewards || {}) },
          socialPricing: { ...DEFAULT_ECONOMY_CONFIG.socialPricing, ...(data.socialPricing || {}) },
          socialSubscriptions: { ...DEFAULT_ECONOMY_CONFIG.socialSubscriptions, ...(data.socialSubscriptions || {}) },
          fortuneSubscriptions: { ...DEFAULT_ECONOMY_CONFIG.fortuneSubscriptions, ...(data.fortuneSubscriptions || {}) }
        } as EconomyConfig);
      } else {
        setEconomyConfig(DEFAULT_ECONOMY_CONFIG);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, "adminSettings/economy");
      setEconomyConfig(DEFAULT_ECONOMY_CONFIG);
    });
    return () => unsubscribe();
  }, []);

  // Listen for global notifications
  useEffect(() => {
    if (!user || !userProfile) return;
    
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Notifications are written to the database and visible in the Notifications screen.
      // Toast notifications are disabled to prevent spam.
    }, (error) => {
      console.error('Notification listener error:', error);
    });

    return () => unsubscribe();
  }, [user]);

  // AI Prompts State
  const [prompts, setPrompts] = useState<{type: FortuneType, content: string}[]>([
    { type: 'coffee', content: "Merhaba {isim}, senin kahve falına bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen bu bilgilere göre detaylı bir yorum yap." },
    { type: 'tarot', content: "Merhaba {isim}, senin için {kartlar} kartlarını çektim. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen bu kartlara ve bilgilere göre detaylı bir yorum yap." },
    { type: 'water', content: "Merhaba {isim}, suyun derinliklerine bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen suyun sana fısıldadıklarını detaylıca anlat." },
    { type: 'ebced', content: "Merhaba {isim}, ebced ilmiyle aşk hayatına bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen ebced hesaplamalarına göre aşk hayatını detaylıca yorumla." },
    { type: 'yildizname', content: "Merhaba {isim}, yıldız haritana bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen yıldızların konumuna göre geleceğini detaylıca yorumla." },
    { type: 'havas', content: "Merhaba {isim}, ilmi havas ile gizli enerjilere bakıyorum. {cinsiyet} olarak hayatındaki {iliskidurumu} durumunu ve {isdurumu} hayatını inceliyorum. Doğum tarihin {dogumtarihi}. Ekstra bilgi: {ekbilgi}. Lütfen bu derin ilme göre hayatını detaylıca yorumla." },
  ]);
  
    // Real Profile Sync
    useEffect(() => {
      if (!user) {
        setUserProfile(null);
        setIsProfileLoading(false);
        return;
      }

      setIsProfileLoading(true);
      const userRef = doc(db, "users", user.uid);

      // CRITICAL FIX: Ensure document exists before listening, and only create if missing.
      // This prevents race conditions and accidental overwrites on page refresh.
      const initializeUser = async () => {
        try {
          const snap = await getDoc(userRef);
          if (!snap.exists()) {
            console.log("Creating initial profile for new user:", user.uid);
            const initialProfile: UserProfile = {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email?.split('@')[0] || "Gezgin",
              photoURL: user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=LASYADefault",
              horoscope: 'Koç',
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
            try {
              await setDoc(userRef, initialProfile);
            } catch (setErr) {
              console.error("Error creating initial profile:", setErr);
              handleFirestoreError(setErr, OperationType.CREATE, `users/${user.uid}`);
            }
          }
        } catch (err) {
          console.error("User initialization error:", err);
          if (err instanceof Error && err.message.includes('authInfo')) {
            // Already handled and formatted
            throw err;
          }
          handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        }
      };

      initializeUser();

      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          let profile = normalizeUserProfile(data, snapshot.id);
          
          // Auto-fix: If they have all required fields but profileCompleted is false, fix it
          if (!profile.social?.profileCompleted && isSocialProfileReady(profile)) {
            console.log("Auto-fixing profileCompleted for user:", user.uid);
            updateDoc(doc(db, "users", user.uid), { 
              "social.profileCompleted": true,
              "social.enabled": true 
            }).catch(err => console.error("Auto-fix error:", err));
            
            if (profile.social) {
              profile.social.profileCompleted = true;
              profile.social.enabled = true;
            }
          }
          
          if (profile.isBanned) {
            setUserProfile(profile);
            setIsProfileLoading(false);
            return;
          }
          
          setUserProfile(profile);
          setIsProfileLoading(false);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
        setIsProfileLoading(false);
      });

      return () => unsubscribe();
    }, [user]);

  // Fetch Horoscopes
  useEffect(() => {
    const q = query(collection(db, "horoscopes"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, Horoscope> = {};
      snapshot.forEach(doc => {
        data[doc.id] = doc.data() as Horoscope;
      });
      setHoroscopes(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "horoscopes"));

    return () => unsubscribe();
  }, []);

  // Real History Sync
  const [history, setHistory] = useState<FortuneReading[]>([]);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    const q = query(collection(db, "readings"), where("userId", "==", user.uid), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedHistory: FortuneReading[] = [];
      snapshot.forEach((doc) => {
        fetchedHistory.push({ id: doc.id, ...doc.data() } as FortuneReading);
      });
      setHistory(fetchedHistory);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "readings"));

    return () => unsubscribe();
  }, [user]);

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
    }, 3500);
    
    // Play splash sound after a short delay
    const soundTimer = setTimeout(() => {
      playSound('splash');
    }, 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(soundTimer);
    };
  }, []);

  const handleNavigate = (tab: AppTab) => {
    playSound('click');
    setActiveTab(tab);
    window.scrollTo(0, 0);
  };

  const handleSelectFortune = (type: FortuneType) => {
    if (!userProfile || !appConfig) return;

    const prices = economyConfig?.fortunePricing || appConfig.prices;
    const price = (prices as any)[type] || 0;
    const isSubscribed = userProfile.subscription?.status === 'active';
    const isAdEligible = ['coffee', 'tarot'].includes(type);

    if (isSubscribed) {
      const subLimits = appConfig.subscriptionLimits;
      const subUsed = userProfile.subscription?.dailyReadingsUsed || { coffee: 0, tarot: 0, advanced: 0 };
      const limit = ['coffee', 'tarot'].includes(type) ? subLimits[type as 'coffee' | 'tarot'] : subLimits.advanced;
      const used = ['coffee', 'tarot'].includes(type) ? subUsed[type as 'coffee' | 'tarot'] : subUsed.advanced;

      if (used >= limit) {
        toast.error(`Günlük abonelik limitinize ulaştınız (${limit}).`, {
          description: "Diğer bakiyelerinizi kullanabilir veya yarın tekrar deneyebilirsiniz."
        });
        // Don't return, let them use credits if they want? 
        // Actually, usually subscription means "free up to limit". 
        // If limit reached, they should use credits.
      } else {
        setActiveFortune(type);
        return;
      }
    }

    // Reset daily ad readings if needed
    const today = new Date().toISOString().split('T')[0];
    const adUsage = userProfile.dailyAdReadingsUsed || { coffee: 0, tarot: 0, lastResetDate: today };
    if (adUsage.lastResetDate !== today) {
      adUsage.coffee = 0;
      adUsage.tarot = 0;
      adUsage.lastResetDate = today;
    }

    // Check Ad Credits first for Coffee/Tarot
    if (isAdEligible) {
      const adLimit = 2; // User specified 2 coffee, 2 tarot limit for ad credits
      const used = adUsage[type as 'coffee' | 'tarot'];
      
      if ((userProfile.energy || 0) >= price && used < adLimit) {
        setActiveFortune(type);
        return;
      }
    }

    // Check Main Credits
    if ((userProfile.mainCoins || 0) < price) {
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
    if (!user || !userProfile || isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      const q = query(
        collection(db, "readings"),
        where("userId", "==", user.uid),
        where("status", "in", ["searching", "found", "interpreting", "waiting"])
      );
      
      const snapshot = await getDocs(q);
      const now = new Date();

      for (const docSnap of snapshot.docs) {
        const reading = docSnap.data() as FortuneReading;
        
        // New Status Flow Logic
        const expectedReaderFoundAt = reading.expectedReaderFoundAt ? new Date(reading.expectedReaderFoundAt) : null;
        const interpretationStartedAt = reading.interpretationStartedAt ? new Date(reading.interpretationStartedAt) : null;
        const expectedCompletedAt = reading.expectedCompletedAt ? new Date(reading.expectedCompletedAt) : null;

        // 1. Searching -> Found
        if (reading.status === 'searching' && expectedReaderFoundAt && now >= expectedReaderFoundAt) {
          await updateDoc(docSnap.ref, {
            status: 'found',
            updatedAt: now.toISOString()
          });
          continue;
        }

        // 2. Found -> Interpreting
        if (reading.status === 'found' && interpretationStartedAt && now >= interpretationStartedAt) {
          await updateDoc(docSnap.ref, {
            status: 'interpreting',
            updatedAt: now.toISOString()
          });
          continue;
        }

        // 3. Interpreting -> Completed (Trigger AI)
        if (reading.status === 'interpreting' && expectedCompletedAt && now >= expectedCompletedAt) {
          // Call Cloud Function to process AI
          try {
            const processFortuneAIFn = httpsCallable(functions, 'processFortuneAI');
            await processFortuneAIFn({ readingId: reading.id });
          } catch (aiErr) {
            console.error(`Sync: AI Generation failed for ${reading.id}`, aiErr);
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
    if (!user || !userProfile) return;
    
    syncReadings();
    const interval = setInterval(syncReadings, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [user, userProfile]);

  const handleFortuneComplete = async (data: any) => {
    if (!user || !userProfile || !appConfig || isSubmitting) return;

    setIsSubmitting(true);
    const loadingToast = toast.loading("Falınız hazırlanıyor...", {
      description: "Mistik güçler harekete geçiyor..."
    });

    try {
      const createFortuneReadingFn = httpsCallable(functions, 'createFortuneReading');
      
      // Collect all images (CoffeeFlow uses data.images, AdvancedFlow uses userPhoto/targetPhoto/question photos)
      const images = [...(data.images || [])];
      if (data.userPhoto) images.push(data.userPhoto);
      if (data.targetPhoto) images.push(data.targetPhoto);
      if (data.questions) {
        data.questions.forEach((q: any) => {
          if (q.photo) images.push(q.photo);
        });
      }

      const result = await createFortuneReadingFn({
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
        images,
        cards: data.cards,
        questions: data.questions?.map((q: any) => typeof q === 'string' ? q : q.text),
        priorityMode: data.priorityMode
      });

      const { readingId } = result.data as any;

      toast.dismiss(loadingToast);
      toast.success("Falınız sıraya alındı!", {
        description: "Yorumcu aranıyor... Durumu fallarım sekmesinden takip edebilirsiniz."
      });

      setActiveFortune(null);
      playSound('success');
      
      // Navigate to history to show the new reading status
      setActiveTab('fortunes');
      
      return { id: readingId, status: 'searching', type: data.type };
    } catch (error: any) {
      console.error("Fortune creation error:", error);
      toast.dismiss(loadingToast);
      
      let displayMessage = error.message || "Lütfen daha sonra tekrar deneyin.";
      let stepInfo = "";

      // Try to parse structured error
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.message) {
          displayMessage = parsed.message;
          if (parsed.step) stepInfo = ` [Step: ${parsed.step}]`;
        }
      } catch (e) {
        // Not a JSON error, use raw message
      }

      toast.error("İşlem başarısız", {
        description: `${displayMessage}${stepInfo}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePriorityInterpretation = (id: string) => {
    const cost = 100;
    let newMainCoins = userProfile.mainCoins || 0;

    if (newMainCoins >= cost) {
      newMainCoins -= cost;
    } else {
      toast.error("Jetonun yetersiz!");
      return;
    }

    if (userProfile) {
      updateDoc(doc(db, "users", userProfile.uid), {
        mainCoins: newMainCoins
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`));
    }
    
    // Speed up interpretation
    setHistory(prev => prev.map(r => r.id === id ? { ...r, status: 'interpreting' } : r));
    
    toast.success("Öncelikli yorumlama başlatıldı!", {
      description: "Yorumcun senin için hızlandı.",
      icon: <Zap className="w-4 h-4 text-amber-500" />
    });

    // Complete faster
    setTimeout(() => {
      setHistory(prev => prev.map(r => r.id === id ? { 
        ...r, 
        status: 'completed',
        content: 'Bu öncelikli bir kehanettir. Yıldızlar senin için çok parlak bir gelecek fısıldıyor.'
      } : r));
    }, 5000);
  };

  const handleSavePrompt = (type: FortuneType, content: string) => {
    setPrompts(prev => prev.map(p => p.type === type ? { ...p, content } : p));
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    toast.success("Kehanet silindi");
  };

  const handleToggleFavorite = (id: string) => {
    setHistory(prev => prev.map(item => 
      item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
    ));
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

  const activeProfile = previewUser || userProfile;

  // Show loading while checking auth or fetching profile for logged in user
  if (loading || (user && isProfileLoading && !activeProfile)) {
    return (
      <div className="min-h-screen bg-[#FDFCFE] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-black/5 border-t-amber-500 rounded-full"
          />
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-serif font-bold text-heading">LASYA Yükleniyor</h2>
            <p className="text-muted text-sm italic">Yıldızlar senin için hizalanıyor...</p>
          </div>
        </div>
      </div>
    );
  }

  if (showSplash) {
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

  if (activeProfile?.isBanned) {
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
          onClick={() => signOut(auth)}
          className="px-8 py-4 rounded-2xl bg-white border border-black/5 text-body font-bold hover:bg-black/5 transition-all shadow-sm"
        >
          Oturumu Kapat
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F6F4F8] relative text-body selection:bg-amber-500/30 overflow-x-hidden">
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
        <AnimatePresence mode="wait">
          {activeTab === 'home' && activeProfile && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="h-full w-full"
            >
              <HomeScreen 
                user={user} 
                userProfile={activeProfile}
                history={history}
                onSelectFortune={handleSelectFortune}
                onNavigate={handleNavigate}
                config={appConfig}
                horoscopes={horoscopes}
              />
            </motion.div>
          )}

          {activeTab === 'fortunes' && activeProfile && (
            <motion.div
              key="fortunes"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <FortunesScreen 
                onSelectFortune={handleSelectFortune}
                onBack={() => handleNavigate('home')}
                config={appConfig}
                economyConfig={economyConfig}
                userProfile={activeProfile}
                history={history}
                onDeleteHistory={handleDeleteHistory}
                onToggleFavorite={handleToggleFavorite}
                onRefreshHistory={syncReadings}
              />
            </motion.div>
          )}

          {activeTab === 'messages' && activeProfile && (
            <motion.div
              key="messages"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-40 bg-[#F6F4F8] pb-20"
            >
              <SocialMessagesScreen 
                currentUser={activeProfile}
                onNavigate={handleNavigate}
                onChatOpenChange={setIsChatOpen}
              />
            </motion.div>
          )}
          
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-40 bg-[#F6F4F8]"
            >
              <HistoryScreen 
                history={history}
                userProfile={activeProfile}
                onBack={() => handleNavigate('home')}
                onDelete={handleDeleteHistory}
                onToggleFavorite={handleToggleFavorite}
                onRefresh={syncReadings}
              />
            </motion.div>
          )}

          {activeTab === 'horoscopes' && (
            <motion.div
              key="horoscopes"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-[60] bg-[#F6F4F8]"
            >
              <HoroscopeScreen 
                onBack={() => handleNavigate('home')}
                userSign={activeProfile?.horoscope}
              />
            </motion.div>
          )}

          {activeTab === 'wallet' && activeProfile && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-40 bg-[#F6F4F8]"
            >
              <SocialWalletScreen 
                currentUser={activeProfile}
                onNavigate={handleNavigate}
                economyConfig={economyConfig}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && activeProfile && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="pt-8"
            >
              <ProfileView 
                user={activeProfile}
                isAdmin={isAdmin}
                onSettings={() => setIsSettingsOpen(true)}
                onLogout={() => signOut(auth)}
                onDeleteAccount={() => setIsDeleteAccountOpen(true)}
                onAdminPanel={() => setIsAdminPanelOpen(true)}
                onNavigate={handleNavigate}
              />
            </motion.div>
          )}

          {activeTab === 'social-profile' && activeProfile && (
            <motion.div
              key="social-profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-[70] bg-[#F6F4F8]"
            >
              <SocialProfileScreen 
                currentUser={activeProfile}
                onNavigate={handleNavigate}
              />
            </motion.div>
          )}

          {activeTab === 'social-intro' && activeProfile && (
            <motion.div
              key="social-intro"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 h-[100dvh] z-[70] bg-[#F6F4F8]"
            >
              <SocialIntroScreen 
                onBack={() => handleNavigate('home')}
                onContinue={async () => {
                  if (isSocialProfileReady(activeProfile)) {
                    handleNavigate('home');
                  } else {
                    handleNavigate('social-onboarding');
                  }
                }}
              />
            </motion.div>
          )}

          {activeTab === 'social-onboarding' && activeProfile && (
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
                onBack={() => handleNavigate('social-intro')}
                onComplete={() => handleNavigate('home')}
              />
            </motion.div>
          )}

          {activeTab === 'social-management' && activeProfile && (
            <motion.div
              key="social-management"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="min-h-screen pb-20"
            >
              <SocialManagementScreen 
                user={activeProfile} 
                onNavigate={handleNavigate} 
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
          className={['social-intro', 'social-onboarding'].includes(activeTab) ? 'hidden' : ''}
          userRole={activeProfile?.role}
        />
      )}

      <AnimatePresence>
        {activeFortune && (
          <FortuneFlow 
            type={activeFortune} 
            userProfile={activeProfile}
            config={appConfig!}
            economyConfig={economyConfig!}
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
          />
        )}
        {isSubscriptionOpen && (
          <SubscriptionScreen 
            onClose={() => setIsSubscriptionOpen(false)}
            economyConfig={economyConfig}
            userProfile={activeProfile}
            onSubscribe={async (planId) => {
              try {
                const result = await walletService.buyFortuneSubscription(activeProfile!.uid, planId as any);
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
        {isDeleteAccountOpen && userProfile && (
          <DeleteAccountModal 
            onClose={() => setIsDeleteAccountOpen(false)}
            onConfirm={async () => {
              try {
                toast.success("Hesabınız siliniyor...");
                
                // Delete all readings first
                const readingsRef = collection(db, "readings");
                const q = query(readingsRef, where("userId", "==", userProfile.uid));
                const querySnapshot = await getDocs(q);
                const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
                await Promise.all(deletePromises);

                // Delete profile
                await deleteDoc(doc(db, "users", userProfile.uid));
                
                // Note: Auth deletion usually requires re-auth, so we just sign out for now
                // and the user doc is gone.
                setTimeout(() => {
                  signOut(auth);
                  setIsDeleteAccountOpen(false);
                  setIsSettingsOpen(false);
                }, 2000);
              } catch (err) {
                handleFirestoreError(err, OperationType.DELETE, `users/${userProfile.uid}`);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
