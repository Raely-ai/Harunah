import React from 'react';
import { motion } from 'motion/react';

export const CoffeeIcon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <defs>
      <linearGradient id="coffee-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    {/* Cup base */}
    <path d="M25,40 Q25,80 50,80 Q75,80 75,40" fill="none" stroke="url(#coffee-grad)" strokeWidth="3" strokeLinecap="round" />
    <path d="M20,40 L80,40 Q85,40 85,45 Q85,50 80,50 L20,50 Q15,50 15,45 Q15,40 20,40" fill="url(#coffee-grad)" opacity="0.3" />
    
    {/* Mistic Vapor */}
    <motion.path 
      d="M40,30 Q45,20 40,10" 
      stroke="#fcd34d" 
      strokeWidth="2" 
      fill="none" 
      filter="url(#glow)"
      animate={{ d: ["M40,30 Q45,20 40,10", "M42,30 Q38,18 42,8"], opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 3, repeat: Infinity }}
    />
    <motion.path 
      d="M50,25 Q55,15 50,5" 
      stroke="#fbbf24" 
      strokeWidth="2" 
      fill="none" 
      filter="url(#glow)"
      animate={{ d: ["M50,25 Q55,15 50,5", "M48,25 Q52,13 48,3"], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
    />
    <motion.circle cx="50" cy="10" r="1.5" fill="#f59e0b" filter="url(#glow)" animate={{ y: [-5, -20], opacity: [1, 0] }} transition={{ duration: 2, repeat: Infinity }} />
    <motion.circle cx="42" cy="15" r="1" fill="#fcd34d" filter="url(#glow)" animate={{ y: [-5, -15], opacity: [1, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1 }} />
  </svg>
);

export const TarotIcon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <defs>
      <linearGradient id="tarot-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#4c1d95" />
      </linearGradient>
    </defs>
    {/* Floating Cards */}
    <motion.rect 
      x="35" y="30" width="30" height="45" rx="4" 
      fill="url(#tarot-grad)" 
      stroke="rgba(255,255,255,0.3)" 
      strokeWidth="1"
      animate={{ y: [0, -5, 0], rotate: [0, 2, 0] }}
      transition={{ duration: 4, repeat: Infinity }}
    />
    <motion.rect 
      x="25" y="35" width="25" height="38" rx="3" 
      fill="url(#tarot-grad)" 
      opacity="0.6"
      animate={{ y: [0, 5, 0], rotate: [0, -4, 0] }}
      transition={{ duration: 5, repeat: Infinity, delay: 0.5 }}
    />
    {/* Glowing Eye Symbol */}
    <circle cx="50" cy="52.5" r="5" fill="none" stroke="#fff" strokeWidth="1" opacity="0.8" />
    <circle cx="50" cy="52.5" r="2" fill="#fff" filter="url(#glow)" />
    <motion.path 
      d="M40,52.5 Q50,42.5 60,52.5 Q50,62.5 40,52.5" 
      stroke="#fff" 
      strokeWidth="1" 
      fill="none" 
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 3, repeat: Infinity }}
    />
  </svg>
);

export const WaterIcon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <defs>
      <linearGradient id="water-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#22d3ee" />
        <stop offset="100%" stopColor="#0891b2" />
      </linearGradient>
    </defs>
    <motion.circle 
      cx="50" cy="50" r="35" 
      fill="url(#water-grad)" 
      opacity="0.2"
      animate={{ scale: [1, 1.05, 1], opacity: [0.1, 0.3, 0.1] }}
      transition={{ duration: 6, repeat: Infinity }}
    />
    <path d="M50,15 L50,85 M15,50 L85,50" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
    <circle cx="50" cy="50" r="25" fill="none" stroke="url(#water-grad)" strokeWidth="2" strokeDasharray="4 2" />
    <motion.path 
      d="M50,35 Q55,50 50,65 Q45,50 50,35" 
      fill="url(#water-grad)"
      animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 4, repeat: Infinity }}
    />
    {/* Inner Stars */}
    <circle cx="42" cy="45" r="0.8" fill="#fff" />
    <circle cx="58" cy="42" r="0.8" fill="#fff" />
    <circle cx="53" cy="58" r="0.8" fill="#fff" />
    <circle cx="45" cy="55" r="0.5" fill="#fff" opacity="0.5" />
  </svg>
);

export const EbcedIcon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <path d="M50,80 Q20,50 20,30 Q20,15 35,15 Q45,15 50,25 Q55,15 65,15 Q80,15 80,30 Q80,50 50,80" fill="none" stroke="#e11d48" strokeWidth="2" />
    <motion.path 
      d="M50,75 Q25,48 25,30 Q25,20 35,20 Q42,20 48,28 L50,30 L52,28 Q58,20 65,20 Q75,20 75,30 Q75,48 50,75" 
      fill="#e11d48" 
      opacity="0.2"
      animate={{ scale: [0.95, 1, 0.95], opacity: [0.1, 0.3, 0.1] }}
      transition={{ duration: 3, repeat: Infinity }}
    />
    <text x="50" y="55" fontSize="12" fill="#e11d48" fontWeight="bold" textAnchor="middle" filter="url(#glow)">अ</text>
  </svg>
);

export const YildiznameIcon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <motion.path 
      d="M50,15 L58,40 L85,40 L63,55 L72,80 L50,65 L28,80 L37,55 L15,40 L42,40 Z" 
      fill="none" 
      stroke="#818cf8" 
      strokeWidth="2"
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
    />
    <motion.circle 
      cx="50" cy="50" r="10" 
      fill="#818cf8" 
      opacity="0.3"
      animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.2, 0.5, 0.2] }}
      transition={{ duration: 4, repeat: Infinity }}
    />
    <circle cx="50" cy="50" r="3" fill="#fff" filter="url(#glow)" />
  </svg>
);

export const HavasIcon = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full">
    <path d="M50,10 L90,80 L10,80 Z" fill="none" stroke="#10b981" strokeWidth="2" />
    <motion.path 
      d="M50,25 L75,70 L25,70 Z" 
      fill="#10b981" 
      opacity="0.2"
      animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.1, 0.4, 0.1] }}
      transition={{ duration: 5, repeat: Infinity }}
    />
    <path d="M35,60 L50,40 L65,60" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" />
    <motion.circle 
      cx="50" cy="20" r="4" 
      fill="#10b981" 
      filter="url(#glow)"
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 2, repeat: Infinity }}
    />
  </svg>
);
