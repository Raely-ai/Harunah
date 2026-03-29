import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { FortuneType, UserProfile, AppConfig } from "../types";
import CoffeeFlow from "./CoffeeFlow";
import TarotFlow from "./TarotFlow";
import AdvancedFlow from "./AdvancedFlow";

interface FortuneFlowProps {
  type: FortuneType;
  userProfile: UserProfile;
  config: AppConfig;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onClose: () => void;
  onComplete: (data: any) => void;
}

export default function FortuneFlow({ type, userProfile, config, onUpdateProfile, onClose, onComplete }: FortuneFlowProps) {
  const isAdvanced = ['water', 'ebced', 'yildizname', 'havas'].includes(type);

  return (
    <AnimatePresence mode="wait">
      {type === 'coffee' && (
        <CoffeeFlow 
          key="coffee" 
          userProfile={userProfile}
          config={config}
          onUpdateProfile={onUpdateProfile}
          onClose={onClose} 
          onComplete={(data) => onComplete({ ...data, type: 'coffee' })} 
        />
      )}
      {type === 'tarot' && (
        <TarotFlow 
          key="tarot" 
          userProfile={userProfile}
          config={config}
          onUpdateProfile={onUpdateProfile}
          onClose={onClose} 
          onComplete={(data) => onComplete({ ...data, type: 'tarot' })} 
        />
      )}
      {isAdvanced && (
        <AdvancedFlow 
          key="advanced" 
          type={type}
          userProfile={userProfile}
          config={config}
          onUpdateProfile={onUpdateProfile}
          onClose={onClose} 
          onComplete={(data) => onComplete({ ...data, type })} 
        />
      )}
    </AnimatePresence>
  );
}
