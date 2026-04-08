import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { FortuneType, UserProfile, AppConfig, EconomyConfig } from "../types";
import CoffeeFlow from "./CoffeeFlow";
import TarotFlow from "./TarotFlow";
import AdvancedFlow from "./AdvancedFlow";

interface FortuneFlowProps {
  type: FortuneType;
  userProfile: UserProfile;
  config: AppConfig;
  economyConfig: EconomyConfig;
  onUpdateProfile: (updates: Partial<UserProfile>) => void;
  onClose: () => void;
  onComplete: (data: any) => Promise<any>;
  onSocialClick?: () => void;
}

export default function FortuneFlow({ type, userProfile, config, economyConfig, onUpdateProfile, onClose, onComplete, onSocialClick }: FortuneFlowProps) {
  const isAdvanced = ['water', 'ebced', 'yildizname', 'havas'].includes(type);

  return (
    <AnimatePresence mode="wait">
      {type === 'coffee' && (
        <CoffeeFlow 
          key="coffee" 
          userProfile={userProfile}
          config={config}
          economyConfig={economyConfig}
          onUpdateProfile={onUpdateProfile}
          onClose={onClose} 
          onComplete={(data) => onComplete({ ...data, type: 'coffee' })} 
          onSocialClick={onSocialClick}
        />
      )}
      {type === 'tarot' && (
        <TarotFlow 
          key="tarot" 
          userProfile={userProfile}
          config={config}
          economyConfig={economyConfig}
          onUpdateProfile={onUpdateProfile}
          onClose={onClose} 
          onComplete={(data) => onComplete({ ...data, type: 'tarot' })} 
          onSocialClick={onSocialClick}
        />
      )}
      {isAdvanced && (
        <AdvancedFlow 
          key="advanced" 
          type={type}
          userProfile={userProfile}
          config={config}
          economyConfig={economyConfig}
          onUpdateProfile={onUpdateProfile}
          onClose={onClose} 
          onComplete={(data) => onComplete({ ...data, type })} 
          onSocialClick={onSocialClick}
        />
      )}
    </AnimatePresence>
  );
}
