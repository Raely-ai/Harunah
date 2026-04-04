import { motion } from "motion/react";
import { 
  Home, 
  Wallet, 
  User,
  Sparkles,
  History
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
    { id: 'fortunes' as AppTab, icon: Sparkles, label: 'Fallar' },
    { id: 'history' as AppTab, icon: History, label: 'Geçmiş' },
    { id: 'wallet' as AppTab, icon: Wallet, label: 'Cüzdan' },
    { id: 'profile' as AppTab, icon: User, label: 'Profil' },
  ];

  return (
    <div className={`fixed bottom-0 left-0 right-0 z-50 px-6 pb-8 pointer-events-none ${className}`}>
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="bg-black/60 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-2 flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500/5 to-transparent pointer-events-none" />
          
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex-1 flex flex-col items-center justify-center py-3 group transition-all duration-500"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent rounded-[2rem] border-t border-amber-500/20 shadow-[inset_0_1px_10px_rgba(212,175,55,0.1)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className="relative">
                  <Icon 
                    className={`w-6 h-6 mb-1 transition-all duration-500 ${
                      isActive 
                        ? "text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(212,175,55,0.6)]" 
                        : "text-zinc-500 group-hover:text-zinc-300"
                    }`} 
                  />
                  {isActive && (
                    <div className="absolute -inset-2 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
                  )}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-[0.2em] transition-all duration-500 ${
                  isActive ? "text-amber-400 opacity-100 translate-y-0" : "text-zinc-600 opacity-0 translate-y-1 group-hover:opacity-40"
                }`}>
                  {tab.label}
                </span>
                
                {isActive && (
                  <motion.div
                    layoutId="activeDot"
                    className="absolute -bottom-1 w-1.5 h-1.5 bg-amber-400 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.8)]"
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
