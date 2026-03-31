import React from 'react';
import { UserProfile } from '../types';

interface SocialGridBlockProps {
  title: string;
  users: UserProfile[];
  color: 'red' | 'blue';
  onSelect: (user: UserProfile) => void;
}

export default function SocialGridBlock({ title, users, color, onSelect }: SocialGridBlockProps) {
  const bgColor = color === 'red' ? 'bg-rose-50/50' : 'bg-sky-50/50';
  const textColor = color === 'red' ? 'text-rose-700' : 'text-sky-700';

  return (
    <section className={`mx-4 p-5 ${bgColor} rounded-3xl my-6 border border-slate-100`}>
      <h3 className={`text-sm font-bold ${textColor} mb-4 tracking-tight`}>{title}</h3>
      <div className="grid grid-cols-3 gap-3">
        {users.slice(0, 3).map((user) => (
          <button 
            key={user.uid} 
            onClick={() => onSelect(user)}
            className="aspect-square rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <img 
              src={user.social?.photos?.[0] || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              alt={user.social?.nickname}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </button>
        ))}
      </div>
    </section>
  );
}
