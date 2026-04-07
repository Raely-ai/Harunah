import React from 'react';
import { motion } from 'motion/react';
import { Crown, Plus, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';

interface SocialStoryAreaProps {
  featuredUsers: UserProfile[];
  onSelect: (user: UserProfile) => void;
  onNavigate: (tab: any) => void;
}

export default function SocialStoryArea({ featuredUsers, onSelect, onNavigate }: SocialStoryAreaProps) {
  return (
    <section className="px-6 pt-1 pb-4">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2">
        {/* ✨ Öne Çık (Premium CTA) */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onNavigate('wallet')}
          className="flex-shrink-0 flex flex-col items-center gap-2 group"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center border-2 border-white/20 shadow-lg shadow-amber-500/20">
              <Plus className="w-8 h-8 text-black" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-black text-white p-1 rounded-full border border-white/20 shadow-lg">
              <Sparkles className="w-3 h-3 text-amber-400" />
            </div>
          </div>
          <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">
            Öne Çık
          </span>
        </motion.button>

        {/* Premium Kullanıcılar (Stories) */}
        {featuredUsers.map((user) => (
          <motion.button
            key={user.uid}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(user)}
            className="flex-shrink-0 flex flex-col items-center gap-2 group relative"
          >
            <div className="relative">
              {/* Active Glow */}
              <div className="absolute -inset-1 bg-gradient-to-tr from-purple-600 via-amber-400 to-purple-600 rounded-full opacity-70 group-hover:opacity-100 transition-opacity blur-[1px]" />
              
              <div className="relative w-16 h-16 rounded-full border-2 border-[#F6F4F8] p-0.5 overflow-hidden bg-white shadow-sm">
                <img 
                  src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt={user.social?.nickname}
                  className="w-full h-full rounded-full object-cover transition-all duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>
              
              {/* Online Indicator */}
              {user.social?.isOnline && (
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-[#F6F4F8] rounded-full shadow-sm" />
              )}
            </div>
            <span className="text-[10px] font-bold text-muted group-hover:text-heading truncate w-16 text-center transition-colors uppercase tracking-tighter">
              {user.social?.nickname || user.nickname || user.displayName}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
