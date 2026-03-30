import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, CreditCard, Moon, Cloud, Sparkles, LogOut, User, Loader2, History, ChevronRight, CheckCircle2, Clock, AlertCircle, Wallet, ArrowUpRight, Heart, Zap, Settings, ShieldAlert, Ban } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { signOut } from "firebase/auth";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy, limit, getDoc, deleteField } from "firebase/firestore";
import { Toaster, toast } from "sonner";

import Header from "./components/Header";
import FortuneCard from "./components/FortuneCard";
import SplashScreen from "./components/SplashScreen";
import WelcomeScreen from "./components/WelcomeScreen";
import LoginScreen from "./components/LoginScreen";
import RegisterScreen from "./components/RegisterScreen";
import ForgotPasswordScreen from "./components/ForgotPasswordScreen";
import OracleHub from "./components/OracleHub";
import BottomNav from "./components/BottomNav";
import FortuneFlow from "./components/FortuneFlow";
import ReadingResult from "./components/ReadingResult";
import HistoryScreen from "./components/HistoryScreen";
import AdminPanel from "./components/AdminPanel";
import ProfileView from "./components/ProfileView";
import SettingsView from "./components/SettingsView";
import EditProfileModal from "./components/EditProfileModal";
import DeleteAccountModal from "./components/DeleteAccountModal";
import HoroscopeScreen from "./components/HoroscopeScreen";
import SocialMainScreen from "./components/SocialMainScreen";
import SocialIntroScreen from "./components/SocialIntroScreen";
import SocialOnboardingFlow from "./components/SocialOnboardingFlow";
import SocialDiscoverScreen from "./components/SocialDiscoverScreen";
import SocialMessagesScreen from "./components/SocialMessagesScreen";
import SocialProfileScreen from "./components/SocialProfileScreen";
import SocialWalletScreen from "./components/SocialWalletScreen";
import { WalletScreen } from "./components/WalletScreen";
import { SubscriptionScreen } from "./components/SubscriptionScreen";
import { FortuneType, AuthScreen, AppTab, FortuneReading, ReadingStatus, UserProfile, AppConfig, Horoscope } from "./types";
import { generateFortune } from "./services/geminiService";

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [showSplash, setShowSplash] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [activeFortune, setActiveFortune] = useState<FortuneType | null>(null);
  const [activeReading, setActiveReading] = useState<FortuneReading | null>(null);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [horoscopes, setHoroscopes] = useState<Record<string, Horoscope>>({});
  
  const isAdmin = user?.email === 'hpferdicakir@gmail.com' || userProfile?.role === 'admin';

  // Fetch Global Config
  useEffect(() => {
    async function testConnection() {
      try {
        await getDoc(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
          toast.error("Bağlantı Hatası", {
            description: "Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin veya reklam engelleyicinizi kapatın."
          });
        } else if (error instanceof Error && error.message.includes('Could not reach Cloud Firestore backend')) {
          console.error("Could not reach Cloud Firestore backend.");
          toast.error("Bağlantı Hatası", {
            description: "Sunucuya bağlanılamıyor. Lütfen internet bağlantınızı kontrol edin veya reklam engelleyicinizi kapatın."
          });
        }
      }
    }
    testConnection();

    const configRef = doc(db, "config", "global");
    const unsubscribe = onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        setAppConfig(snapshot.data() as AppConfig);
      } else {
        // Provide a default config if not found in Firestore yet
        const defaultConfig: AppConfig = {
          prices: { coffee: 50, tarot: 40, water: 30, ebced: 30, yildizname: 30, havas: 30, extraQuestion: 10 },
          icons: { coffee: '☕', tarot: '🃏', water: '💧', ebced: '🔢', yildizname: '✨', havas: '📜', mainBalance: '🪙', adBalance: '⚡' },
          dailyMessagePrompt: "Günün mesajını oluştur. Yanıtı şu JSON formatında ver: { \"text\": \"mesaj içeriği\", \"category\": \"love|career|general\" }",
          adRewardAmount: 5,
          maxDailyAds: 5,
          subscriptionLimits: { coffee: 5, tarot: 5, advanced: 5 },
          packagePrices: { "100_credits": 49.99, "500_credits": 199.99, "daily_sub": 19.99, "weekly_sub": 59.99, "monthly_sub": 149.99 }
        };
        setAppConfig(defaultConfig);
      }
    }, (err) => {
      console.error("Config fetch error:", err);
      // Fallback on error too
      setAppConfig({
        prices: { coffee: 50, tarot: 40, water: 30, ebced: 30, yildizname: 30, havas: 30, extraQuestion: 10 },
        icons: { coffee: '☕', tarot: '🃏', water: '💧', ebced: '🔢', yildizname: '✨', havas: '📜', mainBalance: '🪙', adBalance: '⚡' },
        dailyMessagePrompt: "Günün mesajını oluştur. Yanıtı şu JSON formatında ver: { \"text\": \"mesaj içeriği\", \"category\": \"love|career|general\" }",
        adRewardAmount: 5,
        maxDailyAds: 5,
        subscriptionLimits: { coffee: 5, tarot: 5, advanced: 5 },
        packagePrices: { "100_credits": 49.99, "500_credits": 199.99, "daily_sub": 19.99, "weekly_sub": 59.99, "monthly_sub": 149.99 }
      });
    });
    return () => unsubscribe();
  }, []);

  // Listen for global notifications
  useEffect(() => {
    if (!user || !userProfile) return;
    
    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notification = change.doc.data();
          // Only show if it's recent (e.g., within last 5 minutes)
          const now = new Date().getTime();
          const createdAt = notification.createdAt?.toMillis?.() || 0;
          if (now - createdAt < 300000) {
            toast(notification.title, {
              description: notification.message,
              duration: 10000,
            });
          }
        }
      });
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
      return;
    }

    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const profile = { uid: snapshot.id, ...data } as UserProfile;
        
        if (profile.isBanned) {
          setUserProfile(profile);
          // We don't sign out immediately to show the banned screen
          return;
        }
        
        setUserProfile(profile);
      } else {
        // Create initial profile if it doesn't exist
        const initialProfile: UserProfile = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || user.email?.split('@')[0] || "Gezgin",
          photoURL: user.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=AhlasDefault", // Use Google photo if available, else default
          credits: 0,
          adCredits: 50,
          dailyAdCount: 0,
          lastAdDate: new Date().toISOString(),
          horoscope: 'Koç', // Default horoscope
          dailyAdReadingsUsed: {
            coffee: 0,
            tarot: 0,
            lastResetDate: new Date().toISOString().split('T')[0]
          },
          createdAt: new Date().toISOString(),
          isBanned: false,
          role: 'user',
          socialEnabled: false,
          socialProfileCompleted: false,
          subscription: {
            status: 'none',
            type: 'none',
            dailyReadingsUsed: { coffee: 0, tarot: 0, advanced: 0 }
          }
        };
        setDoc(doc(db, "users", user.uid), initialProfile).catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    return () => {
      unsubscribe();
    };
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

    const price = appConfig.prices[type as keyof typeof appConfig.prices] || 0;
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
      
      if (userProfile.adCredits >= price && used < adLimit) {
        setActiveFortune(type);
        return;
      }
    }

    // Check Main Credits
    if (userProfile.credits < price) {
      toast.error("Bakiyen yetersiz!", {
        description: isAdEligible 
          ? "Reklam izleyerek kredi kazanabilir veya bakiye yükleyebilirsin."
          : "Lütfen bakiye yükleyin."
      });
      return;
    }

    setActiveFortune(type);
  };

  const handleFortuneComplete = async (data: any) => {
    if (!userProfile || !appConfig) return;

    const type = data.type as FortuneType;
    const price = appConfig.prices[type as keyof typeof appConfig.prices] || 0;
    const isAdEligible = ['coffee', 'tarot'].includes(type);
    const isSubscribed = userProfile.subscription?.status === 'active';

    let newCredits = userProfile.credits;
    let newAdCredits = userProfile.adCredits || 0;
    let balanceType: 'main' | 'ad' | 'subscription' = 'main';
    let creditsUsed = price;

    const today = new Date().toISOString().split('T')[0];
    const adUsage = { ...(userProfile.dailyAdReadingsUsed || { coffee: 0, tarot: 0, lastResetDate: today }) };
    if (adUsage.lastResetDate !== today) {
      adUsage.coffee = 0;
      adUsage.tarot = 0;
      adUsage.lastResetDate = today;
    }

    const updates: any = {};

    // Logic Priority: 1. Subscription, 2. Ad Credits (if eligible & under limit), 3. Main Credits
    if (isSubscribed) {
      const subLimits = appConfig.subscriptionLimits;
      const subUsed = { ...(userProfile.subscription?.dailyReadingsUsed || { coffee: 0, tarot: 0, advanced: 0 }) };
      const limit = ['coffee', 'tarot'].includes(type) ? subLimits[type as 'coffee' | 'tarot'] : subLimits.advanced;
      const used = ['coffee', 'tarot'].includes(type) ? subUsed[type as 'coffee' | 'tarot'] : subUsed.advanced;

      if (used < limit) {
        balanceType = 'subscription';
        creditsUsed = 0;
        if (['coffee', 'tarot'].includes(type)) {
          subUsed[type as 'coffee' | 'tarot']++;
        } else {
          subUsed.advanced++;
        }
        updates.subscription = {
          ...userProfile.subscription!,
          dailyReadingsUsed: subUsed
        };
      }
    }

    if (balanceType === 'main' && isAdEligible) {
      const adLimit = 2;
      const used = adUsage[type as 'coffee' | 'tarot'];
      
      if (newAdCredits >= price && used < adLimit) {
        balanceType = 'ad';
        newAdCredits -= price;
        adUsage[type as 'coffee' | 'tarot']++;
        updates.adCredits = newAdCredits;
        updates.dailyAdReadingsUsed = adUsage;
      }
    }

    if (balanceType === 'main') {
      if (newCredits >= price) {
        newCredits -= price;
        updates.credits = newCredits;
      } else {
        toast.error("Yetersiz bakiye!", {
          description: "Lütfen bakiye yükleyin veya reklam izleyerek kredi kazanın."
        });
        return;
      }
    }

    const readingId = Math.random().toString(36).substr(2, 9);
    const newReading: FortuneReading = {
      id: readingId,
      userId: user?.uid || "",
      type: data.type,
      title: data.type === 'coffee' ? 'Kahve Falı' : data.type === 'tarot' ? 'Tarot Açılımı' : (data.type === 'su' || data.type === 'water') ? 'Su Falı' : data.type.charAt(0).toUpperCase() + data.type.slice(1),
      content: 'Kehanetin hazırlanıyor...',
      date: new Date().toISOString(),
      status: 'waiting',
      questions: data.questions ? data.questions.map((q: any) => typeof q === 'string' ? q : q.text).filter(Boolean) : [],
      creditsUsed,
      balanceType
    };

    if (data.cards) newReading.cards = data.cards;
    if (data.images) newReading.images = data.images;
    
    try {
      // Save reading to Firestore
      await setDoc(doc(db, "readings", readingId), newReading);

      // Update user profile in Firestore
      await updateDoc(doc(db, "users", userProfile.uid), updates);

      setActiveFortune(null);
      setActiveTab('history');

      // Initial Notification
      toast.info("Şu an yorumcu bekleniyor...", {
        description: "Ahlas'ın yorumcuları senin için hazırlanıyor.",
        icon: <Clock className="w-4 h-4 text-red-500" />,
        className: "bg-black/80 border-red-500/20 text-red-500 backdrop-blur-xl"
      });

      // Get timing config
      const typeKey = (data.type === 'coffee' || data.type === 'tarot') ? data.type : 'advanced';
      const times = appConfig.interpretationTimes?.[typeKey as 'coffee' | 'tarot' | 'advanced'] || {
        minInterpreterTime: 5,
        maxInterpreterTime: 15,
        minReadingTime: 15,
        maxReadingTime: 30
      };

      const interpreterDelay = Math.floor(Math.random() * (times.maxInterpreterTime - times.minInterpreterTime + 1) + times.minInterpreterTime) * 1000;
      const readingDelay = Math.floor(Math.random() * (times.maxReadingTime - times.minReadingTime + 1) + times.minReadingTime) * 1000;

      // Start AI Generation in background
      const aiContentPromise = generateFortune({
        name: userProfile?.displayName || "Gezgin",
        birthDate: userProfile?.birthDate || "1990-01-01",
        relationshipStatus: userProfile?.relationshipStatus || "Belirtilmedi",
        jobStatus: userProfile?.jobStatus || "Belirtilmedi",
        gender: userProfile?.gender || "Belirtilmedi",
        extraInfo: userProfile?.extraInfo || "Belirtilmedi",
        type: data.type,
        cards: data.cards,
        questions: newReading.questions || []
      });

      // Simulation steps
      setTimeout(async () => {
        await updateDoc(doc(db, "readings", readingId), { status: 'interpreting' });
        
        setTimeout(async () => {
          const aiContent = await aiContentPromise;
          await updateDoc(doc(db, "readings", readingId), { 
            status: 'completed',
            content: aiContent
          });
          
          toast.success("Falınız yorumlandı!", {
            description: "Fallarım kısmından kehanetine ulaşabilirsin.",
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
            className: "bg-black/80 border-emerald-500/20 text-emerald-500 backdrop-blur-xl"
          });
        }, readingDelay);
      }, interpreterDelay);

    } catch (error) {
      console.error("Fortune error:", error);
      toast.error("Kehanet başlatılırken bir hata oluştu.");
    }
  };

  const handlePriorityInterpretation = (id: string) => {
    const cost = 100;
    let newCredits = userProfile.credits;

    if (newCredits >= cost) {
      newCredits -= cost;
    } else {
      toast.error("Kredin yetersiz!");
      return;
    }

    if (userProfile) {
      updateDoc(doc(db, "users", userProfile.uid), {
        credits: newCredits
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

  // Show loading while checking auth or fetching profile for logged in user
  if (loading || (user && !userProfile)) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-amber-500/10 border-t-amber-500 rounded-full"
          />
          <div className="space-y-2 text-center">
            <h2 className="text-xl font-serif font-bold text-amber-50">Ahlas Yükleniyor</h2>
            <p className="text-purple-200/40 text-sm italic">Yıldızlar senin için hizalanıyor...</p>
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

  if (userProfile?.isBanned) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-24 h-24 rounded-[2.5rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4">
          <Ban className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-serif font-bold text-amber-50">Erişim Engellendi</h1>
        <p className="text-purple-200/60 max-w-md leading-relaxed">
          Hesabınız topluluk kurallarını ihlal ettiği gerekçesiyle askıya alınmıştır. 
          Bir hata olduğunu düşünüyorsanız destek ekibiyle iletişime geçebilirsiniz.
        </p>
        <button 
          onClick={() => signOut(auth)}
          className="px-8 py-4 rounded-2xl bg-white/5 border border-white/10 text-purple-200/60 font-bold hover:bg-white/10 transition-all"
        >
          Oturumu Kapat
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-purple-50 selection:bg-amber-500/30 overflow-x-hidden">
      <Toaster position="top-center" expand={false} richColors />
      
      {/* Mystical Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900/5 rounded-full blur-[120px]" />
        
        {/* Ambient Floating Elements (Hearts, Snowflakes) */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={`heart-${i}`}
              initial={{ 
                opacity: 0,
                y: "110vh",
                x: `${Math.random() * 100}vw`,
                scale: Math.random() * 0.5 + 0.5
              }}
              animate={{ 
                opacity: [0, 0.2, 0],
                y: "-10vh",
                x: `${(Math.random() * 100) + (Math.sin(i) * 10)}vw`
              }}
              transition={{ 
                duration: 20 + Math.random() * 10,
                repeat: Infinity,
                delay: i * 3,
                ease: "linear"
              }}
              className="absolute"
            >
              <Heart className="w-4 h-4 text-red-500/10 fill-red-500/5" />
            </motion.div>
          ))}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={`snow-${i}`}
              initial={{ 
                opacity: 0,
                y: "-10vh",
                x: `${Math.random() * 100}vw`,
                scale: Math.random() * 0.3 + 0.2
              }}
              animate={{ 
                opacity: [0, 0.3, 0],
                y: "110vh",
                x: `${(Math.random() * 100) + (Math.cos(i) * 5)}vw`
              }}
              transition={{ 
                duration: 15 + Math.random() * 15,
                repeat: Infinity,
                delay: i * 2,
                ease: "linear"
              }}
              className="absolute"
            >
              <div className="w-2 h-2 bg-white/10 rounded-full blur-[1px]" />
            </motion.div>
          ))}
        </div>

        {/* Stars/Particles */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(40)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: Math.random() }}
              animate={{ opacity: [0.1, 0.5, 0.1] }}
              transition={{ duration: 4 + Math.random() * 6, repeat: Infinity }}
              className="absolute w-0.5 h-0.5 bg-white rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pt-8"
            >
              <OracleHub 
                user={user} 
                userProfile={userProfile}
                history={history}
                onSelectFortune={handleSelectFortune}
                onNavigate={handleNavigate}
                config={appConfig}
                horoscope={userProfile?.horoscope ? horoscopes[userProfile.horoscope] : null}
              />
            </motion.div>
          )}
          
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black"
            >
              <HistoryScreen 
                history={history}
                userProfile={userProfile}
                onBack={() => handleNavigate('home')}
                onDelete={handleDeleteHistory}
                onToggleFavorite={handleToggleFavorite}
              />
            </motion.div>
          )}

          {activeTab === 'horoscopes' && (
            <motion.div
              key="horoscopes"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black"
            >
              <HoroscopeScreen 
                onBack={() => handleNavigate('home')}
                userSign={userProfile?.horoscope}
              />
            </motion.div>
          )}

          {activeTab === 'wallet' && (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pt-8"
            >
              <WalletScreen 
                user={userProfile}
                config={appConfig}
                onBuyCredits={() => toast.info("Kredi satın alma yakında aktif!")}
                onSubscribe={() => setIsSubscriptionOpen(true)}
                onWatchAd={() => {
                  if (userProfile.dailyAdCount < (appConfig?.maxDailyAds || 10)) {
                    toast.promise(
                      new Promise(resolve => setTimeout(resolve, 3000)),
                      {
                        loading: 'Reklam izleniyor...',
                        success: () => {
                          const reward = appConfig?.adRewardAmount || 1;
                          const newAdCredits = (userProfile.adCredits || 0) + reward;
                          const newAdCount = userProfile.dailyAdCount + 1;
                          
                          // Update Firestore
                          updateDoc(doc(db, "users", user.uid), {
                            adCredits: newAdCredits,
                            dailyAdCount: newAdCount
                          });

                          return `Tebrikler! ${reward} Enerji Kredisi kazandın.`;
                        },
                        error: 'Reklam yüklenemedi.'
                      }
                    );
                  } else {
                    toast.error("Günlük reklam izleme limitine ulaştın!");
                  }
                }}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="pt-8"
            >
              <ProfileView 
                user={userProfile}
                isAdmin={isAdmin}
                onEdit={() => setIsEditProfileOpen(true)}
                onSettings={() => setIsSettingsOpen(true)}
                onLogout={() => signOut(auth)}
                onDeleteAccount={() => setIsDeleteAccountOpen(true)}
                onAdminPanel={() => setIsAdminPanelOpen(true)}
              />
            </motion.div>
          )}

          {activeTab === 'social-intro' && (
            <motion.div
              key="social-intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-white"
            >
              <SocialIntroScreen 
                onBack={() => handleNavigate('home')}
                onContinue={async () => {
                  if (userProfile?.socialProfileCompleted) {
                    handleNavigate('social-main');
                  } else {
                    handleNavigate('social-onboarding');
                  }
                }}
              />
            </motion.div>
          )}

          {activeTab === 'social-onboarding' && (
            <motion.div
              key="social-onboarding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-white"
            >
              <SocialOnboardingFlow 
                initialData={userProfile}
                onBack={() => handleNavigate('social-intro')}
                onComplete={() => handleNavigate('social-main')}
              />
            </motion.div>
          )}

          {activeTab === 'social-main' && userProfile && (
            <motion.div
              key="social-main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70] bg-white"
            >
              <SocialMainScreen 
                currentUser={userProfile}
                onBack={() => handleNavigate('home')}
                onEdit={() => setIsEditProfileOpen(true)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-20 text-center pb-20">
          <p className="text-xs text-purple-200/20 font-medium uppercase tracking-widest">
            © 2026 Falcı Ahlas • Tüm Hakları Saklıdır
          </p>
        </footer>
      </div>

      <BottomNav 
        activeTab={activeTab} 
        onTabChange={handleNavigate} 
        className={['social-intro', 'social-onboarding', 'social-main', 'social-match', 'social-messages', 'social-profile', 'social-wallet'].includes(activeTab) ? 'hidden' : ''}
      />

      <AnimatePresence>
        {activeFortune && (
          <FortuneFlow 
            type={activeFortune} 
            userProfile={userProfile}
            config={appConfig!}
            onUpdateProfile={(updates) => setUserProfile(prev => ({ ...prev, ...updates }))}
            onClose={() => setActiveFortune(null)}
            onComplete={handleFortuneComplete}
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
            onSubscribe={(planId) => {
              toast.success(`${planId} planı başarıyla seçildi!`);
              setUserProfile(prev => ({
                ...prev,
                subscription: {
                  status: 'active',
                  type: planId as any,
                  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  dailyReadingsUsed: { coffee: 0, tarot: 0, advanced: 0 }
                }
              }));
              setIsSubscriptionOpen(false);
            }}
          />
        )}
        {isAdminPanelOpen && (
          <div className="fixed inset-0 z-[150] bg-black">
            <AdminPanel 
              onBack={() => setIsAdminPanelOpen(false)}
            />
          </div>
        )}
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[150] bg-black">
            <SettingsView 
              onBack={() => setIsSettingsOpen(false)}
              onDeleteAccount={() => setIsDeleteAccountOpen(true)}
            />
          </div>
        )}
        {isEditProfileOpen && userProfile && (
          <EditProfileModal 
            user={userProfile}
            onClose={() => setIsEditProfileOpen(false)}
            onSave={async (updates) => {
              try {
                await updateDoc(doc(db, "users", userProfile.uid), updates);
                toast.success("Profil güncellendi!");
              } catch (err) {
                handleFirestoreError(err, OperationType.UPDATE, `users/${userProfile.uid}`);
              }
            }}
          />
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
