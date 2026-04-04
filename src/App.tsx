import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Coffee, CreditCard, Moon, Cloud, Sparkles, LogOut, User, Loader2, History, ChevronRight, CheckCircle2, Clock, AlertCircle, Wallet, ArrowUpRight, Heart, Zap, Settings, ShieldAlert, Ban } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { signOut } from "firebase/auth";
import { auth, db, handleFirestoreError, OperationType } from "./lib/firebase";
import { doc, onSnapshot, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, orderBy, limit, getDoc, deleteField, runTransaction } from "firebase/firestore";
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
import EditProfileModal from "./components/EditProfileModal";
import DeleteAccountModal from "./components/DeleteAccountModal";
import HoroscopeScreen from "./components/HoroscopeScreen";
import SocialIntroScreen from "./components/SocialIntroScreen";
import SocialOnboardingFlow from "./components/SocialOnboardingFlow";
import SocialDiscoverScreen from "./components/SocialDiscoverScreen";
import SocialMessagesScreen from "./components/SocialMessagesScreen";
import SocialProfileScreen from "./components/SocialProfileScreen";
import SocialWalletScreen from "./components/SocialWalletScreen";
import FortunesScreen from "./components/FortunesScreen";
import WalletScreen from "./components/WalletScreen";
import { SubscriptionScreen } from "./components/SubscriptionScreen";
import { FortuneType, AuthScreen, AppTab, FortuneReading, ReadingStatus, UserProfile, AppConfig, Horoscope } from "./types";
import { generateFortune } from "./services/geminiService";
import { socialService } from "./lib/socialService";
import { isSocialProfileReady } from "./lib/socialUtils";

export default function App() {
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
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
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

  const isAdmin = user?.email === 'hpferdicakir@gmail.com' || userProfile?.role === 'admin';

  // Fetch Global Config
  useEffect(() => {
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
      where('userId', '==', user.uid),
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
      setIsProfileLoading(false);
      return;
    }

    setIsProfileLoading(true);
    const userRef = doc(db, "users", user.uid);
    const unsubscribe = onSnapshot(userRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        let profile = { uid: snapshot.id, ...data } as UserProfile;
        
        // Ensure social object exists for existing users
        if (!profile.social) {
          const defaultSocial = {
            enabled: profile.socialEnabled || false,
            profileCompleted: profile.socialProfileCompleted || false,
            nickname: profile.nickname || profile.displayName || "Gezgin",
            gender: (profile.gender as any) || 'erkek',
            lookingFor: profile.lookingFor || 'arkadaş',
            bio: profile.bio || '',
            photos: profile.photos || [],
            interests: profile.interests || [],
            visible: profile.socialVisible !== undefined ? profile.socialVisible : true,
            banned: profile.socialBan || false,
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
          };
          
          // Update Firestore immediately to fix the profile
          updateDoc(doc(db, "users", user.uid), { social: defaultSocial })
            .catch(err => handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`));
          
          profile = { ...profile, social: defaultSocial };
        }
        
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
          // We don't sign out immediately to show the banned screen
          return;
        }
        
        setUserProfile(profile);
        setIsProfileLoading(false);
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
            dailyReadingsUsed: { coffee: 0, tarot: 0, advanced: 0 }
          }
        };
        setDoc(doc(db, "users", user.uid), initialProfile)
          .then(() => setIsProfileLoading(false))
          .catch(err => handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`));
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      setIsProfileLoading(false);
    });

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
    }, 2000);
    
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
        where("status", "in", ["pending", "waiting", "interpreting"])
      );
      
      const snapshot = await getDocs(q);
      const now = new Date();

      for (const docSnap of snapshot.docs) {
        const reading = docSnap.data() as FortuneReading;
        
        // Case 0: Cleanup stuck 'pending' readings (failed transactions)
        if (reading.status === 'pending') {
          const updatedAt = new Date(reading.updatedAt || reading.date);
          const diffMins = (now.getTime() - updatedAt.getTime()) / (1000 * 60);
          
          if (diffMins > 2) {
            console.log(`Sync: Marking stuck pending reading ${reading.id} as error`);
            await updateDoc(docSnap.ref, {
              status: 'error',
              error: 'İşlem zaman aşımına uğradı (pending stuck)',
              updatedAt: new Date().toISOString()
            });
          }
          continue;
        }

        // Skip old readings without timestamp fields
        if (!reading.expectedReadyAt) continue;

        const expectedReadyAt = new Date(reading.expectedReadyAt);
        const interpretationStartedAt = reading.interpretationStartedAt ? new Date(reading.interpretationStartedAt) : null;

        // Case 1: Time is up, but status is not completed
        if (now >= expectedReadyAt) {
          console.log(`Sync: Reading ${reading.id} is overdue. Completing...`);
          
          // If content already exists, just update status
          if (reading.content && reading.content !== 'Kehanetin hazırlanıyor...') {
            await updateDoc(docSnap.ref, {
              status: 'completed',
              updatedAt: now.toISOString()
            });
            continue;
          }

          // Trigger AI generation if content is missing
          try {
            const aiResult = await generateFortune({
              name: userProfile.displayName || "Gezgin",
              birthDate: userProfile.birthDate || "1990-01-01",
              relationshipStatus: userProfile.relationshipStatus || "Belirtilmedi",
              jobStatus: userProfile.jobStatus || "Belirtilmedi",
              gender: userProfile.gender || "Belirtilmedi",
              extraInfo: userProfile.extraInfo || "Belirtilmedi",
              type: reading.type,
              cards: reading.cards,
              images: reading.images,
              questions: reading.questions || []
            });

            await updateDoc(docSnap.ref, {
              status: 'completed',
              content: aiResult.text,
              promptSource: aiResult.promptSource,
              promptId: aiResult.promptId,
              updatedAt: now.toISOString()
            });
          } catch (aiErr) {
            console.error(`Sync: AI Generation failed for ${reading.id}`, aiErr);
            const diffMins = (now.getTime() - expectedReadyAt.getTime()) / (1000 * 60);
            if (diffMins > 10) {
              await updateDoc(docSnap.ref, {
                status: 'error',
                error: aiErr instanceof Error ? aiErr.message : "Sync error",
                content: "Üzgünüz, kehanetiniz hazırlanırken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.",
                updatedAt: now.toISOString()
              });
            }
          }
        } 
        // Case 2: Interpretation should have started
        else if (interpretationStartedAt && now >= interpretationStartedAt && reading.status === 'waiting') {
          console.log(`Sync: Reading ${reading.id} should be interpreting.`);
          await updateDoc(docSnap.ref, {
            status: 'interpreting',
            updatedAt: now.toISOString()
          });
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
    if (!userProfile || !appConfig || isSubmitting) return;

    // 1. Duplicate Check (Atomic Guard)
    try {
      const q = query(
        collection(db, "readings"),
        where("userId", "==", user?.uid),
        where("status", "in", ["waiting", "interpreting"]),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        toast.error("Zaten aktif bir falın var!", {
          description: "Lütfen mevcut falının tamamlanmasını bekle."
        });
        return;
      }
    } catch (err) {
      console.error("Duplicate check error:", err);
    }

    setIsSubmitting(true);

    const type = data.type as FortuneType;
    const basePrice = appConfig.prices[type as keyof typeof appConfig.prices] || 0;
    
    let extraQuestionsPrice = 0;
    if (data.questions && data.questions.length > 3) {
      const extraCount = data.questions.length - 3;
      extraQuestionsPrice = extraCount * (appConfig.prices.extraQuestion || 10);
    }
    
    const totalPrice = basePrice + extraQuestionsPrice;
    const isAdEligible = ['coffee', 'tarot'].includes(type);

    // Calculate Timestamps for Queue Management
    const typeKey = (data.type === 'coffee' || data.type === 'tarot') ? data.type : 'advanced';
    const times = appConfig.interpretationTimes?.[typeKey as 'coffee' | 'tarot' | 'advanced'] || {
      minInterpreterTime: 5,
      maxInterpreterTime: 15,
      minReadingTime: 15,
      maxReadingTime: 30
    };

    const interpreterDelay = Math.floor(Math.random() * (times.maxInterpreterTime - times.minInterpreterTime + 1) + times.minInterpreterTime) * 60 * 1000;
    const readingDelay = Math.floor(Math.random() * (times.maxReadingTime - times.minReadingTime + 1) + times.minReadingTime) * 60 * 1000;

    const now = new Date();
    const queueStartedAt = now.toISOString();
    const interpretationStartedAt = new Date(now.getTime() + interpreterDelay).toISOString();
    const expectedReadyAt = new Date(now.getTime() + interpreterDelay + readingDelay).toISOString();

    const readingId = Math.random().toString(36).substr(2, 9);
    const readingRef = doc(db, "readings", readingId);
    const userRef = doc(db, "users", userProfile.uid);

    const newReading: FortuneReading = {
      id: readingId,
      userId: user?.uid || "",
      type: data.type,
      title: data.type === 'coffee' ? 'Kahve Falı' : data.type === 'tarot' ? 'Tarot Açılımı' : (data.type === 'su' || data.type === 'water') ? 'Su Falı' : data.type.charAt(0).toUpperCase() + data.type.slice(1),
      content: 'Kehanetin hazırlanıyor...',
      date: new Date().toISOString(),
      status: 'pending',
      questions: data.questions ? data.questions.map((q: any) => typeof q === 'string' ? q : q.text).filter(Boolean) : [],
      creditsUsed: 0,
      balanceType: 'main',
      queueStartedAt,
      interpretationStartedAt,
      expectedReadyAt,
      priority: false,
      updatedAt: now.toISOString()
    };

    if (data.cards) newReading.cards = data.cards;
    if (data.images) newReading.images = data.images;

    try {
      // 1. Create reading as pending
      await setDoc(readingRef, newReading);

      // 2. Run Transaction
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw new Error("Kullanıcı profili bulunamadı!");

        const currentUser = userDoc.data() as UserProfile;
        const isSubscribed = currentUser.subscription?.status === 'active';

        let currentCredits = currentUser.credits;
        let currentAdCredits = currentUser.adCredits || 0;
        let balanceType: 'main' | 'ad' | 'subscription' = 'main';
        let creditsUsed = totalPrice;

        const today = new Date().toISOString().split('T')[0];
        const adUsage = { ...(currentUser.dailyAdReadingsUsed || { coffee: 0, tarot: 0, lastResetDate: today }) };
        if (adUsage.lastResetDate !== today) {
          adUsage.coffee = 0;
          adUsage.tarot = 0;
          adUsage.lastResetDate = today;
        }

        const transUpdates: any = {};

        // Subscription Logic
        if (isSubscribed) {
          const subLimits = appConfig.subscriptionLimits;
          const subUsed = { ...(currentUser.subscription?.dailyReadingsUsed || { coffee: 0, tarot: 0, advanced: 0 }) };
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
            transUpdates.subscription = {
              ...currentUser.subscription!,
              dailyReadingsUsed: subUsed
            };
          }
        }

        // Ad Credits Logic
        if (balanceType === 'main' && isAdEligible) {
          const adLimit = 2;
          const used = adUsage[type as 'coffee' | 'tarot'];
          if (currentAdCredits >= totalPrice && used < adLimit) {
            balanceType = 'ad';
            currentAdCredits -= totalPrice;
            adUsage[type as 'coffee' | 'tarot']++;
            transUpdates.adCredits = currentAdCredits;
            transUpdates.dailyAdReadingsUsed = adUsage;
          }
        }

        // Main Credits Logic
        if (balanceType === 'main') {
          if (currentCredits >= totalPrice) {
            currentCredits -= totalPrice;
            transUpdates.credits = currentCredits;
          } else {
            throw new Error("Yetersiz bakiye!");
          }
        }

        transaction.update(userRef, transUpdates);
        transaction.update(readingRef, {
          status: 'waiting',
          creditsUsed,
          balanceType,
          updatedAt: new Date().toISOString()
        });
      });

      setIsSubmitting(false);

      // Initial Notification
      toast.info("Şu an yorumcu bekleniyor...", {
        description: "Ahlas'ın yorumcuları senin için hazırlanıyor.",
        icon: <Clock className="w-4 h-4 text-red-500" />,
        className: "bg-black/80 border-red-500/20 text-red-500 backdrop-blur-xl"
      });

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
        images: data.images,
        questions: newReading.questions || []
      });

      // Simulation steps (Still kept for UI responsiveness, but backed by timestamps)
      setTimeout(async () => {
        await updateDoc(readingRef, { 
          status: 'interpreting',
          updatedAt: new Date().toISOString()
        });
        
        setTimeout(async () => {
          try {
            const aiResult = await aiContentPromise;
            
            await updateDoc(readingRef, { 
              status: 'completed',
              content: aiResult.text,
              promptSource: aiResult.promptSource,
              promptId: aiResult.promptId,
              updatedAt: new Date().toISOString()
            });
            
            toast.success("Falınız yorumlandı!", {
              description: "Fallarım kısmından kehanetine ulaşabilirsin.",
              icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
              className: "bg-black/80 border-emerald-500/20 text-emerald-500 backdrop-blur-xl"
            });
          } catch (error) {
            console.error("AI Generation Error:", error);
            await updateDoc(readingRef, { 
              status: 'error',
              error: error instanceof Error ? error.message : "Bilinmeyen bir hata oluştu",
              content: "Üzgünüz, kehanetiniz hazırlanırken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.",
              updatedAt: new Date().toISOString()
            });
            
            toast.error("Kehanet oluşturulamadı.", {
              description: "Bir hata oluştu, lütfen destek ile iletişime geçin."
            });
          }
        }, readingDelay);
      }, interpreterDelay);

      return newReading;
    } catch (error) {
      console.error("Fortune error:", error);
      setIsSubmitting(false);
      
      // Cleanup pending reading if transaction failed
      try {
        await updateDoc(readingRef, {
          status: 'error',
          error: 'İşlem sırasında hata oluştu (transaction failed)',
          updatedAt: new Date().toISOString()
        });
      } catch (cleanupErr) {
        console.error("Cleanup error:", cleanupErr);
      }

      if (error instanceof Error && error.message === "Yetersiz bakiye!") {
        toast.error("Yetersiz bakiye!", {
          description: "Lütfen bakiye yükleyin veya reklam izleyerek kredi kazanın."
        });
      } else {
        toast.error("Kehanet başlatılırken bir hata oluştu.");
      }
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
  if (loading || (user && isProfileLoading)) {
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
    <div className="min-h-screen bg-[#020205] relative text-purple-50 selection:bg-amber-500/30 overflow-x-hidden">
      {/* Noise Texture Overlay */}
      <div className="fixed inset-0 noise-bg z-[1] opacity-[0.03]" />
      
      {/* Deep Mystical Gradient Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-purple-900/15 via-black to-amber-900/10 pointer-events-none z-[2]" />

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

      <div className="relative z-10 w-full pb-32">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && userProfile && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <HomeScreen 
                user={user} 
                userProfile={userProfile}
                history={history}
                onSelectFortune={handleSelectFortune}
                onNavigate={handleNavigate}
                config={appConfig}
                horoscopes={horoscopes}
              />
            </motion.div>
          )}

          {activeTab === 'fortunes' && userProfile && (
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
                userProfile={userProfile}
                history={history}
                onDeleteHistory={handleDeleteHistory}
                onToggleFavorite={handleToggleFavorite}
                onRefreshHistory={syncReadings}
              />
            </motion.div>
          )}

          {activeTab === 'messages' && userProfile && (
            <motion.div
              key="messages"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-40 bg-[#050505] pb-20"
            >
              <SocialMessagesScreen 
                currentUser={userProfile}
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
              className="fixed inset-0 z-40 bg-black"
            >
              <HistoryScreen 
                history={history}
                userProfile={userProfile}
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
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
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

          {activeTab === 'profile' && userProfile && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
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
                onNavigate={handleNavigate}
              />
            </motion.div>
          )}

          {activeTab === 'social-profile' && userProfile && (
            <motion.div
              key="social-profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-[70] bg-[#050505]"
            >
              <SocialProfileScreen 
                currentUser={userProfile}
                onNavigate={handleNavigate}
              />
            </motion.div>
          )}

          {activeTab === 'social-intro' && userProfile && (
            <motion.div
              key="social-intro"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-[70] bg-[#050505]"
            >
              <SocialIntroScreen 
                onBack={() => handleNavigate('home')}
                onContinue={async () => {
                  if (isSocialProfileReady(userProfile)) {
                    handleNavigate('home');
                  } else {
                    handleNavigate('social-onboarding');
                  }
                }}
              />
            </motion.div>
          )}

          {activeTab === 'social-onboarding' && userProfile && (
            <motion.div
              key="social-onboarding"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed inset-0 z-[70] bg-white"
            >
              <SocialOnboardingFlow 
                initialData={userProfile}
                onBack={() => handleNavigate('social-intro')}
                onComplete={() => handleNavigate('home')}
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

      {!isChatOpen && (
        <BottomNav 
          activeTab={activeTab} 
          onTabChange={handleNavigate} 
          className={['social-intro', 'social-onboarding'].includes(activeTab) ? 'hidden' : ''}
        />
      )}

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
