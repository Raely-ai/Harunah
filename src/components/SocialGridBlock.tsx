import React from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';
import { calculateCompatibility } from '../lib/compatibilityEngine';
import { Heart, Users, Zap } from 'lucide-react';

interface SocialGridBlockProps {
  title: string;
  users: UserProfile[];
  color: 'red' | 'blue';
  onSelect: (user: UserProfile) => void;
  currentUser: UserProfile;
}

export default function SocialGridBlock({ title, users, color, onSelect, currentUser }: SocialGridBlockProps) {
  const isRed = color === 'red';
  const glowColor = isRed ? 'rgba(244,63,94,0.3)' : 'rgba(14,165,233,0.3)';
  const Icon = isRed ? Heart : Users;

  return (
    <section className="mx-6 my-10 relative group">
      {/* Animated Border Effect */}
      <div className={`absolute -inset-[1px] bg-gradient-to-r ${isRed ? 'from-rose-500/50 via-purple-500/50 to-rose-500/50' : 'from-sky-500/50 via-indigo-500/50 to-sky-500/50'} rounded-[2rem] opacity-30 group-hover:opacity-100 blur-[1px] transition-opacity duration-1000`} />
      
      <div className="relative bg-black/[0.03] backdrop-blur-2xl rounded-[2rem] p-6 border border-black/5 overflow-hidden">
        {/* Background Glow */}
        <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] rounded-full pointer-events-none ${isRed ? 'bg-rose-500/10' : 'bg-sky-500/10'}`} />
        
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isRed ? 'bg-rose-500/20 text-rose-500' : 'bg-sky-500/20 text-sky-500'} border border-black/5 shadow-sm`}>
              <Icon className="w-5 h-5" />
            </div>
            <h3 className="text-[10px] font-black text-heading uppercase tracking-widest">{title}</h3>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {users.slice(0, 3).map((user) => {
            const comp = calculateCompatibility(currentUser, user);
            const score = isRed ? comp.love : comp.friendship;
            
            return (
              <motion.button 
                key={user.uid} 
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelect(user)}
                className="relative aspect-square rounded-2xl overflow-hidden shadow-2xl group/card border border-white/5"
              >
                <img 
                  src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt={user.social?.nickname}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-110"
                  referrerPolicy="no-referrer"
                />
                
                {/* Score Badge */}
                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-lg bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-0.5">
                  <Zap className={`w-2 h-2 ${isRed ? 'text-rose-400 fill-rose-400' : 'text-sky-400 fill-sky-400'}`} />
                  <span className="text-[8px] font-black text-white">%{score}</span>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity" />
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
