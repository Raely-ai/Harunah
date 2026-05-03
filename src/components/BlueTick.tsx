import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';

export const BlueTick = ({ size = 14, className = "" }: { size?: number, className?: string }) => (
  <motion.div 
    initial={{ scale: 0.5, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    className={`inline-flex items-center justify-center bg-sky-500 rounded-full p-0.5 shadow-[0_0_8px_rgba(14,165,233,0.4)] ${className}`}
  >
    <CheckCircle2 size={size} className="text-white fill-white" />
  </motion.div>
);
