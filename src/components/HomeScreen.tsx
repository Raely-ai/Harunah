import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Heart, RefreshCw, Sparkles } from "lucide-react";
import SocialDiscoverScreen from "./SocialDiscoverScreen";
import SocialMatchScreen from "./SocialMatchScreen";
import SocialCompatibilityHistory from "./SocialCompatibilityHistory";
import { UserProfile, FortuneType, FortuneReading, AppTab, AppConfig, Horoscope } from "../types";
import { getRemainingSwipes } from "../lib/swipeHelper";
import { isSocialProfileReady } from "../lib/socialUtils";
import { walletService } from "../lib/walletService";
import SocialDisabledView from "./SocialDisabledView";

interface HomeScreenProps {
  user: any;
  userProfile: UserProfile;
  history: FortuneReading[];
  onSelectFortune: (type: FortuneType) => void;
  onNavigate: (tab: AppTab) => void;
  config: AppConfig | null;
}

export default function HomeScreen({ 
  user, 
  userProfile, 
  history, 
  onSelectFortune, 
  onNavigate, 
  config 
}: HomeScreenProps) {
  // 1. Default Tab & State Safety
  const [activeTopTab, setActiveTopTab] = useState<'match' | 'discover' | 'compatibility'>('match');
  const [refreshTimer, setRefreshTimer] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  // 2. Navigation Reset: Ensure we start at 'match' when this component mounts
  useEffect(() => {
    setActiveTopTab('match');
  }, []);

  // 3. Tab State Safety Fallback
  useEffect(() => {
    const validTabs = ['match', 'discover', 'compatibility'];
    if (!activeTopTab || !validTabs.includes(activeTopTab)) {
      setActiveTopTab('match');
    }
  }, [activeTopTab]);

  const handleRefreshDiscover = async () => {
    try {
      const result = await walletService.refreshDiscover();
      if (result.success) {
        setRefreshKey(prev => prev + 1);
        import("sonner").then(({ toast }) => toast.success("Keşfet listesi yenilendi!"));
      } else {
        import("sonner").then(({ toast }) => toast.error("Yenileme hakkınız bitti."));
      }
    } catch (error: any) {
      console.error("Refresh error:", error);
      import("sonner").then(({ toast }) => toast.error(error.message || "Yenileme sırasında bir hata oluştu."));
    }
  };

  useEffect(() => {
    const updateTimer = () => {
      if (!userProfile.social?.lastDiscoverRefreshAt) {
        setRefreshTimer('Yenile');
        return;
      }
      const lastRefresh = new Date(userProfile.social.lastDiscoverRefreshAt).getTime();
      const nextRefresh = lastRefresh + 24 * 60 * 60 * 1000;
      const now = Date.now();
      const diff = nextRefresh - now;

      if (diff <= 0) {
        setRefreshTimer('Yenile');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setRefreshTimer(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [userProfile.social?.lastDiscoverRefreshAt]);

  useEffect(() => {
    // Auto-fix: If profile is completed but not enabled, enable it.
    // This fixes the bug where users without custom photos were disabled.
    if (userProfile.social?.profileCompleted && !userProfile.social?.enabled) {
      const fixEnabled = async () => {
        try {
          const { doc, updateDoc } = await import("firebase/firestore");
          const { db } = await import("../lib/firebase");
          await updateDoc(doc(db, "users", userProfile.uid), { 
            "social.enabled": true 
          });
        } catch (error) {
          console.error("Auto-fix enabled error:", error);
        }
      };
      fixEnabled();
    }
  }, [userProfile.social?.profileCompleted, userProfile.social?.enabled, userProfile.uid]);

  // 4. Safe Render Check
  if (!userProfile || !userProfile.social) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-black/5 border-t-amber-500 rounded-full animate-spin" />
        <p className="text-muted text-sm font-medium">Profil yükleniyor...</p>
      </div>
    );
  }

  const isSocialEnabled = isSocialProfileReady(userProfile);

  return (
    <div className="relative h-full w-full bg-[#F6F4F8] overflow-hidden">
      {/* Top Navigation Bar - Absolute to allow content to go under */}
      <div className={`absolute top-0 left-0 right-0 z-50 transition-all duration-500 ${
        activeTopTab === 'match' 
          ? 'bg-transparent border-transparent' 
          : 'bg-white/10 backdrop-blur-md border-b border-white/5'
      } pt-[calc(env(safe-area-inset-top,1rem)+0.5rem)] pb-3 px-4`}>
        <div className="max-w-md mx-auto flex items-center justify-center">
          {/* Social Tabs */}
          <div className={`relative flex p-0.5 rounded-xl border flex-1 max-w-[280px] transition-all duration-500 ${
            activeTopTab === 'match'
              ? 'bg-white/10 border-white/10 backdrop-blur-sm'
              : 'bg-black/10 border-white/5 shadow-inner'
          }`}>
            {/* Sliding Background Indicator */}
            <motion.div
              layoutId="activeTab"
              className={`absolute inset-y-1 rounded-xl shadow-lg z-0 ${
                activeTopTab === 'match'
                  ? 'bg-white/20 border border-white/30'
                  : 'bg-white border border-black/5'
              }`}
              initial={false}
              animate={{
                left: activeTopTab === 'match' ? '4px' : activeTopTab === 'discover' ? 'calc(33.33% + 2px)' : 'calc(66.66% + 1px)',
                width: 'calc(33.33% - 4px)',
              }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />

            <button
              onClick={() => setActiveTopTab('match')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTopTab === 'match' 
                  ? 'text-white' 
                  : 'text-muted hover:text-body'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${activeTopTab === 'match' ? 'text-rose-400 fill-rose-400' : ''}`} />
              <span>Karşılaşma</span>
            </button>

            <button
              onClick={() => setActiveTopTab('discover')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTopTab === 'discover' 
                  ? 'text-heading' 
                  : 'text-muted hover:text-body'
              }`}
            >
              <Users className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${activeTopTab === 'discover' ? 'text-amber-600' : ''}`} />
              <span>Keşfet</span>
            </button>

            <button
              onClick={() => setActiveTopTab('compatibility')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTopTab === 'compatibility' 
                  ? 'text-heading' 
                  : 'text-muted hover:text-body'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${activeTopTab === 'compatibility' ? 'text-purple-600' : ''}`} />
              <span>Uyum</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="h-full w-full">
        <AnimatePresence mode="wait">
          {activeTopTab === 'match' && (
            <motion.div
              key="match"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              {!isSocialEnabled ? (
                <SocialDisabledView onNavigate={onNavigate} />
              ) : (
                <SocialMatchScreen 
                  currentUser={userProfile} 
                  onNavigate={onNavigate}
                />
              )}
            </motion.div>
          )}

          {activeTopTab === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full overflow-y-auto pt-24 pb-32"
            >
              {!isSocialEnabled ? (
                <SocialDisabledView onNavigate={onNavigate} />
              ) : (
                <SocialDiscoverScreen 
                  key={`discover-${refreshKey}`}
                  currentUser={userProfile} 
                  onNavigate={onNavigate}
                  config={config}
                  onRefresh={handleRefreshDiscover}
                  refreshTimer={refreshTimer}
                />
              )}
            </motion.div>
          )}

          {activeTopTab === 'compatibility' && (
            <motion.div
              key="compatibility"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              {!isSocialEnabled ? (
                <SocialDisabledView onNavigate={onNavigate} />
              ) : (
                <SocialCompatibilityHistory 
                  currentUser={userProfile} 
                  onBack={() => setActiveTopTab('match')}
                  isTab={true}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

