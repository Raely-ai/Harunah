import { motion } from "motion/react";
import { Compass, Heart, MessageCircle, User, Wallet } from "lucide-react";

interface SocialBottomNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

export default function SocialBottomNav({ activeTab, onNavigate }: SocialBottomNavProps) {
  const tabs = [
    { id: 'discover', icon: Compass, label: 'Keşfet' },
    { id: 'match', icon: Heart, label: 'Karşılaşma' },
    { id: 'messages', icon: MessageCircle, label: 'Mesaj' },
    { id: 'profile', icon: User, label: 'Profil' },
    { id: 'wallet', icon: Wallet, label: 'Cüzdan' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md">
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-xl border border-black/5 rounded-[2rem] px-1.5 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`relative flex flex-col items-center justify-center w-[4rem] h-14 transition-all group ${isActive ? 'z-10' : 'z-0'}`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-y-1 inset-x-0.5 bg-amber-500/10 border border-amber-500/20 rounded-[1.5rem]"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              <div className="relative z-10">
                <Icon 
                  className={`w-5 h-5 mb-0.5 transition-all duration-300 ${
                    isActive ? 'text-amber-600/80 scale-105' : 'text-gray-500 group-hover:text-gray-800'
                  }`} 
                  strokeWidth={isActive ? 2.2 : 2}
                />
              </div>
              <span className={`text-[8px] font-bold uppercase tracking-[0.1em] relative z-10 transition-all duration-300 ${
                isActive ? 'text-amber-600/80 opacity-100 translate-y-0' : 'text-gray-400 opacity-0 translate-y-1 group-hover:opacity-60'
              }`}>
                {tab.label}
              </span>

              {isActive && (
                <motion.div
                  layoutId="activeSocialDot"
                  className="absolute bottom-1.5 w-1 h-1 bg-amber-500/60 rounded-full z-10"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
