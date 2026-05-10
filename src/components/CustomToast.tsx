import React from 'react';
import { cn } from '../lib/utils';
import { Sparkles, Heart, Flame, Mail, Activity, MessageSquare } from 'lucide-react';

interface CustomToastProps {
  name: string;
  message: string;
  avatar: string;
  type?: string;
  onNavigate: () => void;
  onDismiss: () => void;
}

export const CustomToast: React.FC<CustomToastProps> = ({ name, message, avatar, type = 'message', onNavigate, onDismiss }) => {
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

  const isSystem = ['compatibility_ready', 'reward', 'system', 'profile_completed'].includes(type);
  const showOnlineDot = !isSystem && !!avatar;

  let accentClass = "bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500";
  let ringClass = "ring-indigo-500/5";
  let contentClass = "bg-white/95 border-white/60 text-slate-600 font-medium";

  if (type === 'like') {
    accentClass = "bg-gradient-to-b from-pink-400 to-red-500";
    ringClass = "ring-pink-500/20";
  } else if (type === 'super_like') {
    accentClass = "bg-gradient-to-b from-rose-400 via-pink-500 to-amber-500 shadow-pink-500/20";
    ringClass = "ring-pink-500/30";
    contentClass = "bg-[#fdfaff]/95 border-pink-100 text-slate-700 font-bold";
  } else if (type === 'priority_message_request') {
    accentClass = "bg-gradient-to-b from-amber-400 via-yellow-500 to-orange-500 shadow-amber-500/20";
    ringClass = "ring-amber-500/30";
    contentClass = "bg-[#fffeee]/95 border-amber-100/50 text-amber-900 font-semibold";
  } else if (type === 'compatibility_ready') {
    accentClass = "bg-gradient-to-b from-violet-500 via-fuchsia-500 to-indigo-500 shadow-violet-500/20";
    ringClass = "ring-violet-500/30";
    contentClass = "bg-[#faf5ff]/95 border-violet-100/50 text-indigo-900 font-bold";
  }

  const renderAvatarContent = () => {
    if (!isSystem && avatar) {
      return (
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
      );
    }

    if (type === 'compatibility_ready' || type === 'system') return <Activity className="w-5 h-5 text-violet-500" />;
    if (type === 'reward' || type === 'profile_completed') return <Sparkles className="w-5 h-5 text-amber-500" />;
    if (type === 'priority_message_request') return <Mail className="w-5 h-5 text-amber-500" />;
    if (type === 'like') return <Heart className="w-5 h-5 text-pink-500" />;
    if (type === 'super_like') return <Flame className="w-5 h-5 text-rose-500" />;
    if (type === 'message_request' || type === 'message') return <MessageSquare className="w-5 h-5 text-indigo-500" />;

    return <span className="text-sm font-black text-indigo-600/60 uppercase">{initials}</span>;
  };

  return (
    <div 
      onClick={handleClick}
      className={cn(
        "flex items-center gap-3 w-[92vw] max-w-[380px] p-3 pl-3.5 pr-4 rounded-2xl cursor-pointer shadow-lg transition-all duration-300",
        "backdrop-blur-md border relative overflow-hidden active:scale-[0.97]",
        contentClass
      )}
    >
      {/* Accent Indicator */}
      <div className={cn("absolute top-0 left-0 w-1.5 h-full opacity-80", accentClass)} />
      
      {/* Avatar Section: Exactly 44x44px (w-11 h-11) */}
      <div className={cn("relative w-11 h-11 rounded-full shrink-0 ring-2 overflow-hidden bg-slate-100 flex items-center justify-center", ringClass)}>
        {renderAvatarContent()}
        {showOnlineDot && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white shadow-sm" />
        )}
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex items-center justify-between gap-2 overflow-hidden">
          <p className="font-extrabold text-slate-900 text-[13px] truncate leading-none">{name}</p>
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight shrink-0">şimdi</span>
        </div>
        <p className={cn("text-[12px] truncate leading-snug pr-1", type === 'super_like' || type === 'compatibility_ready' || type === 'priority_message_request' ? '' : 'text-slate-600')}>{message}</p>
      </div>

      {/* Compact Action Icon */}
      <div className="flex items-center justify-center w-7 h-7 rounded-xl bg-slate-50 text-slate-400 shrink-0 border border-slate-100">
        <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
};


