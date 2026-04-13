import { motion } from "motion/react";
import { 
  Home, 
  Wallet, 
  User,
  Coffee,
  MessageCircle,
  Users
} from "lucide-react";
import { AppTab } from "../types";
import { useBadges } from "../lib/BadgeContext";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  className?: string;
  userRole?: string;
}

export default function BottomNav({ activeTab, onTabChange, className = "", userRole }: BottomNavProps) {
  const { unreadMessagesCount, unseenReadingsCount } = useBadges();

  const tabs = [
    { id: 'home' as AppTab, icon: Users, label: 'Sosyal' },
    { id: 'fortunes' as AppTab, icon: Coffee, label: 'Fallar', badge: unseenReadingsCount },
    { id: 'messages' as AppTab, icon: MessageCircle, label: 'Mesajlar', badge: unreadMessagesCount },
    { id: 'profile' as AppTab, icon: User, label: 'Profil' },
    { id: 'wallet' as AppTab, icon: Wallet, label: 'Cüzdan' },
  ];

  if (userRole === 'social_operator' || userRole === 'admin') {
    tabs.push({ id: 'social-management' as AppTab, icon: Users, label: 'Sosyal' });
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-black/[0.05] shadow-[0_-1px_10px_rgba(0,0,0,0.02)] ${className}`}>
      <div className="max-w-md mx-auto px-2 pb-[env(safe-area-inset-bottom,1.5rem)] pt-2">
        <div className="flex items-center justify-around relative">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const badgeCount = tab.badge || 0;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex-1 flex flex-col items-center justify-center h-12 group transition-all duration-300`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activePill"
                    className="absolute inset-x-1 inset-y-1 bg-amber-500/5 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative z-10 flex flex-col items-center">
                  <div className="relative">
                    <Icon 
                      className={`w-5 h-5 mb-0.5 transition-all duration-300 ${
                        isActive 
                          ? "text-amber-600 scale-110" 
                          : "text-gray-400 group-hover:text-gray-600"
                      }`} 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {badgeCount > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-1 bg-red-500 rounded-full flex items-center justify-center border border-white shadow-sm"
                      >
                        <span className="text-[8px] font-bold text-white leading-none">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      </motion.div>
                    )}
                  </div>
                  <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${
                    isActive ? "text-amber-700 opacity-100" : "text-gray-400 opacity-80"
                  }`}>
                    {tab.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
