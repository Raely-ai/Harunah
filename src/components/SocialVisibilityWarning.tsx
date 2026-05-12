import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';
import { getSocialProfileMissingFields } from '../lib/socialUtils';

interface SocialVisibilityWarningProps {
  user: UserProfile;
  onNavigate: (tab: any) => void;
}

export default function SocialVisibilityWarning({ user, onNavigate }: SocialVisibilityWarningProps) {
  const missingFields = getSocialProfileMissingFields(user);
  
  if (missingFields.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mx-4 mt-4 mb-2 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl p-4 shadow-sm relative overflow-hidden pointer-events-auto w-full max-w-sm"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
        
        <div className="flex items-start gap-4">
          <div className="mt-1 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-amber-900 leading-tight">
              Profilin henüz keşfe açık değil
            </h3>
            <p className="text-xs text-amber-700/80 mt-1 leading-relaxed pr-2">
              Başkalarının seni görebilmesi için <span className="font-semibold">{missingFields.join(', ')}</span> bilgilerini tamamla. 
              Sen keşfetmeye devam edebilirsin; profilini tamamladığında sen de önerilerde görünmeye başlarsın.
            </p>
            
            <button
              onClick={() => onNavigate('profile')}
              className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 transition-colors"
            >
              Profilimi Tamamla
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
