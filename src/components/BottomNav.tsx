import { motion } from "motion/react";
import { 
  Home, 
  Wallet, 
  User,
  Sparkles,
  MessageCircle,
  Users
} from "lucide-react";
import { AppTab } from "../types";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  className?: string;
  userRole?: string;
}

export default function BottomNav({ activeTab, onTabChange, className = "", userRole }: BottomNavProps) {
  const tabs = [
    { id: 'home' as AppTab, icon: Home, label: 'Ana Sayfa' },
    { id: 'fortunes' as AppTab, icon: Sparkles, label: 'Fallar' },
    { id: 'messages' as AppTab, icon: MessageCircle, label: 'Mesajlar' },
    { id: 'profile' as AppTab, icon: User, label: 'Profil' },
    { id: 'wallet' as AppTab, icon: Wallet, label: 'Cüzdan' },
  ];

  if (userRole === 'social_operator' || userRole === 'admin') {
    tabs.push({ id: 'social-management' as AppTab, icon: Users, label: 'Sosyal' });
  }

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 pointer-events-none ${className}`}>
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-white/80 backdrop-blur-xl border border-black/5 rounded-[2rem] p-1.5 flex items-center justify-between shadow-[0_4px_16px_rgba(0,0,0,0.04)] relative">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex-1 flex flex-col items-center justify-center h-14 group transition-all duration-500 ${isActive ? 'z-10' : 'z-0'}`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-y-1 inset-x-1 bg-amber-500/10 border border-amber-500/20 rounded-[1.5rem]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative z-10">
                  <Icon 
                    className={`w-5 h-5 mb-0.5 transition-all duration-500 ${
                      isActive 
                        ? "text-amber-600/80 scale-105" 
                        : "text-gray-500 group-hover:text-gray-800"
                    }`} 
                    strokeWidth={isActive ? 2.2 : 2}
                  />
                </div>
                <span className={`text-[8px] font-bold uppercase tracking-[0.1em] relative z-10 transition-all duration-500 ${
                  isActive ? "text-amber-600/80 opacity-100 translate-y-0" : "text-gray-400 opacity-0 translate-y-1 group-hover:opacity-60"
                }`}>
                  {tab.label}
                </span>
                
                {isActive && (
                  <motion.div
                    layoutId="activeDot"
                    className="absolute bottom-1.5 w-1 h-1 bg-amber-500/60 rounded-full z-10"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
