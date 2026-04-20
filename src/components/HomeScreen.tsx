import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Users, Heart, RefreshCw, Sparkles } from "lucide-react";
import SocialDiscoverScreen from "./SocialDiscoverScreen";
import SocialMatchScreen from "./SocialMatchScreen";
import SocialCompatibilityHistory from "./SocialCompatibilityHistory";
import { UserProfile, FortuneType, FortuneReading, AppTab, AppConfig } from "../types";
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
  const [activeTopTab, setActiveTopTab] = useState<'match' | 'discover' | 'compatibility'>('discover');
  const [refreshTimer, setRefreshTimer] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  // 2. Tab State Safety Fallback
  useEffect(() => {
    const validTabs = ['match', 'discover', 'compatibility'];
    if (!activeTopTab || !validTabs.includes(activeTopTab)) {
      setActiveTopTab('discover');
    }
  }, [activeTopTab]);

  const handleRefreshDiscover = async () => {
    try {
      const result = await walletService.refreshDiscover();
      if (result.success) {
        setRefreshKey(prev => prev + 1);
        if (result.status === 'FREE_REFRESH_USED') {
          import("sonner").then(({ toast }) => toast.success("Günlük ücretsiz yenileme hakkın kullanıldı! ✨"));
        } else {
          import("sonner").then(({ toast }) => toast.success("Keşfet listesi yenilendi! ✨"));
        }
      } else {
        if (result.status === 'INSUFFICIENT_FUNDS') {
          import("sonner").then(({ toast }) => toast.info("Yenileme hakkın bitti. Cüzdandan alabilirsin."));
          onNavigate('wallet');
        } else {
          import("sonner").then(({ toast }) => toast.error("Yenileme sırasında bir hata oluştu."));
        }
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
      {/* Top Navigation Bar - Sticky & Full Width */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${
        activeTopTab === 'match' 
          ? 'bg-black/20 backdrop-blur-xl border-white/10' 
          : 'bg-white/80 backdrop-blur-xl border-black/5'
      } pt-[env(safe-area-inset-top,1rem)] h-[calc(env(safe-area-inset-top,1rem)+64px)]`}>
        <div className="h-full max-w-md mx-auto px-4 flex items-center">
          {/* Social Tabs */}
          <div className="relative flex w-full bg-black/5 p-1 rounded-2xl border border-black/5">
            {/* Sliding Background Indicator (iOS Style) */}
            <motion.div
              layoutId="activeTabHighlight"
              className={`absolute inset-y-1 rounded-xl shadow-md z-0 ${
                activeTopTab === 'match'
                  ? 'bg-white/20 border border-white/20'
                  : 'bg-white border border-black/5'
              }`}
              initial={false}
              animate={{
                left: activeTopTab === 'match' ? '4px' : activeTopTab === 'discover' ? 'calc(33.33% + 2px)' : 'calc(66.66% + 1px)',
                width: 'calc(33.33% - 4px)',
              }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            />

            <button
              onClick={() => setActiveTopTab('match')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                activeTopTab === 'match' 
                  ? 'text-white scale-[1.03]' 
                  : 'text-muted/60 hover:text-muted'
              }`}
            >
              <Heart className={`w-4 h-4 flex-shrink-0 transition-colors ${activeTopTab === 'match' ? 'text-rose-400 fill-rose-400' : ''}`} />
              <span>Karşılaşma</span>
            </button>

            <button
              onClick={() => setActiveTopTab('discover')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                activeTopTab === 'discover' 
                  ? 'text-heading scale-[1.03]' 
                  : 'text-muted/60 hover:text-muted'
              }`}
            >
              <Users className={`w-4 h-4 flex-shrink-0 transition-colors ${activeTopTab === 'discover' ? 'text-amber-500' : ''}`} />
              <span>Keşfet</span>
            </button>

            <button
              onClick={() => setActiveTopTab('compatibility')}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                activeTopTab === 'compatibility' 
                  ? 'text-heading scale-[1.03]' 
                  : 'text-muted/60 hover:text-muted'
              }`}
            >
              <Sparkles className={`w-4 h-4 flex-shrink-0 transition-colors ${activeTopTab === 'compatibility' ? 'text-purple-500' : ''}`} />
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
              <div className="relative h-full w-full">
                {isSocialEnabled ? (
                  <SocialMatchScreen 
                    currentUser={userProfile} 
                    onNavigate={onNavigate}
                    isActive={activeTopTab === 'match'}
                  />
                ) : (
                  <SocialDisabledView onNavigate={onNavigate} />
                )}
              </div>
            </motion.div>
          )}

          {activeTopTab === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="h-full w-full"
            >
              <div className={`relative h-full w-full ${isSocialEnabled ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                {isSocialEnabled ? (
                  <div className="h-full w-full pb-32">
                    <SocialDiscoverScreen 
                      key={`discover-${refreshKey}`}
                      currentUser={userProfile} 
                      onNavigate={onNavigate}
                      config={config}
                      onRefresh={handleRefreshDiscover}
                      refreshTimer={refreshTimer}
                      isActive={activeTopTab === 'discover'}
                    />
                  </div>
                ) : (
                  <SocialDisabledView onNavigate={onNavigate} />
                )}
              </div>
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
              <div className="relative h-full w-full">
                {isSocialEnabled ? (
                  <SocialCompatibilityHistory 
                    currentUser={userProfile} 
                    onBack={() => setActiveTopTab('match')}
                    isTab={true}
                    isActive={activeTopTab === 'compatibility'}
                    isMock={false}
                  />
                ) : (
                  <SocialDisabledView onNavigate={onNavigate} />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

