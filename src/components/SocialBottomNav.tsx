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
      <div className="flex justify-between items-center bg-white/80 backdrop-blur-2xl border border-white/50 rounded-full px-2 py-2 shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className="relative flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all group"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
              <Icon 
                className={`w-5 h-5 relative z-10 transition-colors duration-300 ${
                  isActive ? 'text-white fill-white/20' : 'text-slate-400 group-hover:text-slate-600'
                }`} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[9px] font-bold relative z-10 mt-1 transition-colors duration-300 ${
                isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
