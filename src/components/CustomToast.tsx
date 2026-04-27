import React from 'react';
import { cn } from '../lib/utils';

interface CustomToastProps {
  name: string;
  message: string;
  avatar: string;
  onNavigate: () => void;
  onDismiss: () => void;
}

export const CustomToast: React.FC<CustomToastProps> = ({ name, message, avatar, onNavigate, onDismiss }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate();
    onDismiss();
  };

  const initials = name
    ? name
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??';

  return (
    <div 
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 w-[92vw] max-w-[380px] p-3 pl-3.5 pr-4 rounded-2xl cursor-pointer shadow-2xl transition-all duration-300",
        "bg-white/95 backdrop-blur-2xl border border-white/60 relative overflow-hidden",
        "hover:bg-white active:scale-[0.97]"
      )}
    >
      {/* Accent Indicator */}
      <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 opacity-80" />
      
      {/* Avatar Section: Exactly 44x44px (w-11 h-11) */}
      <div className="relative w-11 h-11 rounded-full shrink-0 ring-4 ring-indigo-500/5 overflow-hidden bg-slate-100 flex items-center justify-center">
        {avatar ? (
          <img 
            src={avatar} 
            alt={name} 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).onerror = null;
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
            }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="text-sm font-black text-indigo-600/60 uppercase">{initials}</span>
        )}
        <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <p className="font-extrabold text-slate-900 text-[13px] truncate leading-none">{name}</p>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight shrink-0">şimdi</span>
        </div>
        <p className="text-slate-600 text-[12px] truncate leading-snug font-medium pr-1">{message}</p>
      </div>

      {/* Compact Action Icon */}
      <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-50 to-pink-50 text-indigo-500 shrink-0 border border-indigo-100/50">
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};

