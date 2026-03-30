import { motion } from "motion/react";
import { 
  Home, 
  History, 
  Wallet, 
  User,
  Sparkles,
  Users
} from "lucide-react";
import { AppTab } from "../types";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  className?: string;
}

export default function BottomNav({ activeTab, onTabChange, className = "" }: BottomNavProps) {
  const tabs = [
    { id: 'home' as AppTab, icon: Home, label: 'Oracle' },
    { id: 'history' as AppTab, icon: History, label: 'Geçmiş' },
    { id: 'wallet' as AppTab, icon: Wallet, label: 'Cüzdan' },
    { id: 'profile' as AppTab, icon: User, label: 'Profil' },
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 pointer-events-none ${className}`}>
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-2 flex items-center justify-between shadow-2xl shadow-purple-900/20">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex-1 flex flex-col items-center justify-center py-3 group"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-purple-500/10 rounded-2xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon 
                  className={`w-6 h-6 mb-1 transition-all duration-300 ${
                    isActive ? "text-amber-400 scale-110" : "text-purple-200/40 group-hover:text-purple-200/60"
                  }`} 
                />
                <span className={`text-[10px] font-bold uppercase tracking-widest transition-all duration-300 ${
                  isActive ? "text-amber-400 opacity-100" : "text-purple-200/20 opacity-0 group-hover:opacity-40"
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeDot"
                    className="absolute -bottom-1 w-1 h-1 bg-amber-400 rounded-full"
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
