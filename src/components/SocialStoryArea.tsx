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
    <section className="px-4 pt-6 pb-2">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
        {/* Sabit Öne Çıkanlar Kartı */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
          <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
            <Crown className="w-6 h-6 text-indigo-500" />
          </div>
          <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Öne Çıkan</span>
        </div>

        {/* Premium Kullanıcılar */}
        {featuredUsers.map((user) => (
          <motion.button
            key={user.uid}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(user)}
            className="flex-shrink-0 flex flex-col items-center gap-1.5"
          >
            <div className="w-14 h-14 rounded-full border-2 border-indigo-500 p-0.5 overflow-hidden">
              <img 
                src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                alt={user.social?.nickname}
                className="w-full h-full rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-[10px] font-medium text-slate-600 truncate w-14 text-center">
              {user.social?.nickname || user.nickname || user.displayName}
            </span>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
