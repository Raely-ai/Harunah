import React from 'react';
import { Zap, CreditCard, Crown, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { UserProfile, EconomyConfig, FortuneType } from '../types';

interface PaymentSummaryProps {
  type: FortuneType;
  userProfile: UserProfile;
  economyConfig: EconomyConfig;
  extraQuestionsCount: number;
  priorityMode: boolean;
  minimal?: boolean;
  dark?: boolean;
}

export default function PaymentSummary({ 
  type, 
  userProfile, 
  economyConfig, 
  extraQuestionsCount,
  priorityMode,
  minimal = false,
  dark = false
}: PaymentSummaryProps) {
  if (!economyConfig) {
    if (minimal) {
      return (
        <div className="flex items-center justify-center gap-2 py-1 opacity-50">
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
          <span className="text-[9px] font-medium">Hesaplanıyor...</span>
        </div>
      );
    }
    return (
      <div className="mt-4 p-3 rounded-xl bg-black/5 flex items-center justify-center gap-2">
        <Loader2 className="w-3 h-3 text-muted animate-spin" />
        <span className="text-[10px] font-medium text-muted">Ödeme bilgileri yükleniyor...</span>
      </div>
    );
  }

  const basePrice = economyConfig.fortunePricing?.[type] || 0;
  const extraPrice = (extraQuestionsCount > 0) ? extraQuestionsCount * (economyConfig.fortunePricing?.extraQuestion || 0) : 0;
  const priorityFee = priorityMode ? (economyConfig.fortunePricing?.priorityFee || 0) : 0;
  const totalCost = basePrice + extraPrice + priorityFee;

  const today = new Date().toISOString().split('T')[0];
  const sub = userProfile.subscription;
  const isSubActive = sub && sub.status === 'active' && new Date(sub.expiresAt) > new Date();
  const dailyUsed = sub?.dailyLimitUsed || 0;
  const lastReset = sub?.lastResetAt || "";
  
  let balanceType: 'subscription' | 'energy' | 'main' = 'main';
  let canAfford = false;

  if (isSubActive) {
    if (lastReset !== today || dailyUsed < (economyConfig.subscriptionLimits?.totalDaily || 10)) {
      balanceType = 'subscription';
      canAfford = true;
    }
  }

  if (balanceType === 'main' && economyConfig.energyPaymentEnabled) {
    if ((userProfile.energy || 0) >= totalCost) {
      balanceType = 'energy';
      canAfford = true;
    }
  }

  if (balanceType === 'main') {
    canAfford = (userProfile.mainCoins || 0) >= totalCost;
  }

  if (minimal) {
    return (
      <div className={`flex items-center justify-center gap-4 py-1 px-2 ${dark ? 'text-white/80' : ''}`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-muted'}`}>Ücret:</span>
          <span className="text-[11px] font-black text-amber-600">
            {balanceType === 'subscription' ? 'ÜCRETSİZ' : `${totalCost} Jeton`}
          </span>
        </div>
        <div className={`w-px h-2.5 ${dark ? 'bg-white/10' : 'bg-black/5'}`} />
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-muted'}`}>Bakiye:</span>
          <span className={`text-[11px] font-black ${canAfford ? 'text-emerald-400' : 'text-rose-400'}`}>
            {balanceType === 'subscription' ? 'Abonelik' : 
             balanceType === 'energy' ? `${userProfile.energy || 0} E` : 
             `${userProfile.mainCoins || 0} J`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`mt-4 p-4 rounded-2xl border shadow-sm space-y-3 ${dark ? 'bg-white/5 border-white/5' : 'bg-white border-black/5'}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-white/40' : 'text-muted'}`}>Ödeme Özeti</span>
        {balanceType === 'subscription' && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[9px] font-black uppercase border border-indigo-500/20">
            <Crown className="w-2.5 h-2.5" />
            Abonelik Avantajı
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className={dark ? 'text-white/60' : 'text-muted'}>Taban Ücret</span>
          <span className={`font-medium ${dark ? 'text-white' : 'text-heading'}`}>{basePrice} Jeton</span>
        </div>
        {extraPrice > 0 && (
          <div className="flex justify-between text-xs">
            <span className={dark ? 'text-white/60' : 'text-muted'}>Ek Sorular ({extraQuestionsCount})</span>
            <span className={`font-medium ${dark ? 'text-white' : 'text-heading'}`}>+{extraPrice} Jeton</span>
          </div>
        )}
        {priorityFee > 0 && (
          <div className="flex justify-between text-xs">
            <span className={dark ? 'text-white/60' : 'text-muted'}>Öncelikli Sıra</span>
            <span className={`font-medium ${dark ? 'text-white' : 'text-heading'}`}>+{priorityFee} Jeton</span>
          </div>
        )}
        <div className={`pt-2 border-t flex justify-between items-center ${dark ? 'border-white/5' : 'border-black/5'}`}>
          <span className={`text-xs font-bold ${dark ? 'text-white' : 'text-heading'}`}>Toplam</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-black text-amber-600">
              {balanceType === 'subscription' ? 'ÜCRETSİZ' : totalCost}
            </span>
            {balanceType !== 'subscription' && (
              <div className={`p-1 rounded-lg ${balanceType === 'energy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {balanceType === 'energy' ? <Zap className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`p-2.5 rounded-xl flex items-start gap-2.5 ${canAfford ? (dark ? 'bg-white/5' : 'bg-black/5') : (dark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100')}`}>
        {balanceType === 'subscription' ? (
          <>
            <div className={`p-1.5 rounded-lg ${dark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
              <Crown className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className={`text-[10px] font-bold ${dark ? 'text-indigo-200' : 'text-indigo-900'}`}>Günlük Hakkınız Kullanılacak</p>
              <p className={`text-[9px] ${dark ? 'text-indigo-400/60' : 'text-indigo-600/60'}`}>Kalan Hak: {(economyConfig.subscriptionLimits?.totalDaily || 10) - (lastReset === today ? dailyUsed : 0)}/10</p>
            </div>
          </>
        ) : balanceType === 'energy' ? (
          <>
            <div className={`p-1.5 rounded-lg ${dark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
              <Zap className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className={`text-[10px] font-bold ${dark ? 'text-emerald-200' : 'text-emerald-900'}`}>Enerji Bakiyesi Kullanılacak</p>
              <p className={`text-[9px] ${dark ? 'text-emerald-400/60' : 'text-emerald-600/60'}`}>Mevcut Enerji: {userProfile.energy || 0}</p>
            </div>
          </>
        ) : (
          <>
            <div className={`p-1.5 rounded-lg ${canAfford ? (dark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600') : (dark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')}`}>
              {canAfford ? <CreditCard className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            </div>
            <div>
              <p className={`text-[10px] font-bold ${canAfford ? (dark ? 'text-amber-200' : 'text-amber-900') : (dark ? 'text-red-200' : 'text-red-900')}`}>
                {canAfford ? 'Ana Jeton Bakiyesi Kullanılacak' : 'Yetersiz Bakiye'}
              </p>
              <p className={`text-[9px] ${canAfford ? (dark ? 'text-amber-400/60' : 'text-amber-600/60') : (dark ? 'text-red-400/60' : 'text-red-600/60')}`}>
                Mevcut Jeton: {userProfile.mainCoins || 0}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
