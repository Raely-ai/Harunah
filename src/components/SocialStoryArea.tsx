import React from 'react';
import { motion } from 'motion/react';
import { Crown } from 'lucide-react';
import { UserProfile } from '../types';

interface SocialStoryAreaProps {
  featuredUsers: UserProfile[];
  onSelect: (user: UserProfile) => void;
}

export default function SocialStoryArea({ featuredUsers, onSelect }: SocialStoryAreaProps) {
  return (
    <section className="px-6 pt-8 pb-2">
      <div className="flex items-center gap-5 overflow-x-auto no-scrollbar">
        {/* Sabit Öne Çıkanlar Kartı */}
        <div className="flex-shrink-0 flex flex-col items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-purple-500/10 blur-lg rounded-full animate-pulse" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-600/80 to-indigo-700/80 flex items-center justify-center border border-white/10 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
              <Crown className="w-6 h-6 text-white/90 drop-shadow-md" />
            </div>
          </div>
        </div>

        {/* Premium Kullanıcılar */}
        {featuredUsers.map((user) => (
          <motion.button
            key={user.uid}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(user)}
            className="flex-shrink-0 flex flex-col items-center gap-2 group relative"
          >
            <div className="relative">
              {/* Aura Glow */}
              <motion.div 
                animate={{ 
                  opacity: [0.2, 0.5, 0.2],
                  scale: [1, 1.1, 1]
                }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute -inset-2 bg-purple-500/20 blur-xl rounded-full pointer-events-none" 
              />
              
              <div className="absolute -inset-1 bg-gradient-to-tr from-purple-600 via-amber-400 to-purple-600 rounded-full opacity-70 group-hover:opacity-100 transition-opacity blur-[2px]" />
              <div className="relative w-16 h-16 rounded-full border-2 border-black p-0.5 overflow-hidden bg-black">
                <img 
                  src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt={user.social?.nickname}
                  className="w-full h-full rounded-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-500"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <span className="text-[10px] font-black text-muted group-hover:text-heading truncate w-16 text-center transition-colors uppercase tracking-tighter">
              {user.social?.nickname || user.nickname || user.displayName}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
