import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Heart, RefreshCw } from "lucide-react";
import SocialDiscoverScreen from "./SocialDiscoverScreen";
import SocialMatchScreen from "./SocialMatchScreen";
import { UserProfile, FortuneType, FortuneReading, AppTab, AppConfig, Horoscope } from "../types";
import { getRemainingSwipes } from "../lib/swipeHelper";
import { isSocialProfileReady } from "../lib/socialUtils";
import SocialDisabledView from "./SocialDisabledView";

interface HomeScreenProps {
  user: any;
  userProfile: UserProfile;
  history: FortuneReading[];
  onSelectFortune: (type: FortuneType) => void;
  onNavigate: (tab: AppTab) => void;
  config: AppConfig | null;
  horoscopes: Record<string, Horoscope>;
}

export default function HomeScreen({ 
  user, 
  userProfile, 
  history, 
  onSelectFortune, 
  onNavigate, 
  config, 
  horoscopes 
}: HomeScreenProps) {
  const [activeTopTab, setActiveTopTab] = useState<'discover' | 'match'>('discover');
  const [refreshTimer, setRefreshTimer] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshDiscover = async () => {
    const lastRefresh = userProfile.social?.lastDiscoverRefreshAt ? new Date(userProfile.social.lastDiscoverRefreshAt).getTime() : 0;
    if (Date.now() - lastRefresh < 24 * 60 * 60 * 1000) {
      import("sonner").then(({ toast }) => toast.error("Anlık yenileme için yenileme paketi almalısınız."));
      return;
    }
    
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const { db } = await import("../lib/firebase");
      await updateDoc(doc(db, "users", userProfile.uid), { 
        "social.lastDiscoverRefreshAt": new Date().toISOString() 
      });
      setRefreshKey(prev => prev + 1);
      import("sonner").then(({ toast }) => toast.success("Keşfet listesi yenilendi!"));
    } catch (error) {
      console.error("Refresh error:", error);
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

  const isSocialEnabled = isSocialProfileReady(userProfile);

  return (
    <div className="flex flex-col min-h-screen bg-transparent">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-30 bg-[#050505]/80 backdrop-blur-2xl border-b border-white/5 pt-[env(safe-area-inset-top,2.5rem)] pb-5 px-4 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          {/* Left side spacer to help centering */}
          <div className="w-10 hidden xs:block" />

          {/* Social Tabs - Centered and Balanced */}
          <div className="relative flex bg-white/5 p-1 rounded-2xl border border-white/10 flex-1 max-w-[240px] shadow-inner">
            {/* Sliding Background Indicator */}
            <motion.div
              layoutId="activeTab"
              className="absolute inset-y-1 bg-white/10 rounded-xl border border-white/10 shadow-lg z-0"
              initial={false}
              animate={{
                left: activeTopTab === 'discover' ? '4px' : '50%',
                width: 'calc(50% - 4px)',
              }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            />

            <button
              onClick={() => setActiveTopTab('discover')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTopTab === 'discover' 
                  ? 'text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Users className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${activeTopTab === 'discover' ? 'text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Keşfet</span>
              <span className="sm:hidden">Keşfet</span>
            </button>
            <button
              onClick={() => setActiveTopTab('match')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTopTab === 'match' 
                  ? 'text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${activeTopTab === 'match' ? 'text-rose-400' : ''}`} />
              <span className="hidden sm:inline">Karşılaşma</span>
              <span className="sm:hidden">Karşılaşma</span>
            </button>
          </div>

          {/* Right Controls - Compact and aligned */}
          <div className="flex items-center justify-end min-w-[70px]">
            {activeTopTab === 'discover' && (
              <button 
                onClick={handleRefreshDiscover}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all active:scale-95 shadow-lg shadow-amber-500/5"
              >
                <RefreshCw className="w-3 h-3 flex-shrink-0" />
                <span className="text-[10px] font-black tracking-tighter tabular-nums">{refreshTimer}</span>
              </button>
            )}
            {activeTopTab === 'match' && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-zinc-400 shadow-lg">
                <Heart className="w-3 h-3 text-rose-500 flex-shrink-0 fill-rose-500/20" />
                <span className="text-[10px] font-black tracking-tighter tabular-nums">
                  {getRemainingSwipes(userProfile)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          {activeTopTab === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              {!isSocialEnabled ? (
                <SocialDisabledView onNavigate={onNavigate} />
              ) : (
                <SocialDiscoverScreen 
                  key={`discover-${refreshKey}`}
                  currentUser={userProfile} 
                  onNavigate={onNavigate}
                  config={config}
                  horoscope={userProfile.horoscope ? horoscopes[userProfile.horoscope] : null}
                />
              )}
            </motion.div>
          )}

          {activeTopTab === 'match' && (
            <motion.div
              key="match"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
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
        </AnimatePresence>
      </div>
    </div>
  );
}

