import React from 'react';
import { motion } from 'motion/react';
import { 
  Crown, 
  CheckCircle2, 
  Zap, 
  Star, 
  ShieldCheck, 
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface SubscriptionScreenProps {
  onClose: () => void;
  onSubscribe: (planId: string) => void;
}

const PLANS = [
  {
    id: 'daily',
    name: 'Günlük',
    price: '₺19.99',
    period: 'Gün',
    description: 'Hızlı bir kehanet günü için ideal.',
    features: ['15 Fal Hakkı', 'Reklamsız Deneyim', 'Öncelikli Yorumcu']
  },
  {
    id: 'weekly',
    name: 'Haftalık',
    price: '₺89.99',
    period: 'Hafta',
    description: 'En popüler seçim. Bir hafta boyunca mistik rehberlik.',
    features: ['105 Toplam Fal Hakkı', 'Tüm Fal Türleri Açık', 'Özel Ritüeller', '7/24 Destek'],
    popular: true
  },
  {
    id: 'monthly',
    name: 'Aylık',
    price: '₺249.99',
    period: 'Ay',
    description: 'Gerçek bir Oracle deneyimi için en iyi değer.',
    features: ['Sınırsız Fal Hakkı*', 'Tüm Premium Özellikler', 'Kişisel Astrolog', 'Özel İndirimler']
  }
];

export const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({ onClose, onSubscribe }) => {
  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] flex flex-col overflow-y-auto custom-scrollbar">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-amber-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-12 pb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Crown className="w-5 h-5 text-amber-400" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest text-amber-400">Ahlas Premium</span>
        </div>
        <button 
          onClick={onClose}
          className="p-2 rounded-full bg-white/5 text-purple-200/40 hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="relative z-10 px-6 space-y-12 pb-24">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-serif font-bold text-indigo-50 leading-tight"
          >
            Geleceğini <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">
              Sınırsızca Keşfet
            </span>
          </motion.h1>
          <p className="text-purple-200/40 max-w-xs mx-auto">
            Ahlas Premium ile evrenin kapılarını sonuna kadar aç ve mistik dünyanın tüm sırlarına eriş.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Zap, title: 'Hızlı Yanıt', desc: 'Sıra beklemeden yorum' },
            { icon: Star, title: 'Özel Fallar', desc: 'Premium kategoriler' },
            { icon: ShieldCheck, title: 'Reklamsız', desc: 'Kesintisiz deneyim' },
            { icon: Sparkles, title: 'Günlük 15 Fal', desc: 'Maksimum limit' }
          ].map((b, i) => (
            <div key={i} className="p-4 rounded-3xl bg-white/5 border border-white/5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <b.icon className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-50">{b.title}</p>
                <p className="text-[10px] text-purple-200/40">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div className="space-y-6">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative p-8 rounded-[2.5rem] border transition-all cursor-pointer group ${
                plan.popular 
                  ? 'bg-gradient-to-br from-amber-900/40 to-black border-amber-500/30' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
              onClick={() => onSubscribe(plan.id)}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-amber-500 text-black text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-amber-900/40">
                  En Popüler
                </div>
              )}

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-indigo-50">{plan.name}</h3>
                  <p className="text-xs text-purple-200/40">{plan.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-serif font-bold text-indigo-50">{plan.price}</p>
                  <p className="text-[10px] text-purple-200/40 uppercase tracking-widest">/ {plan.period}</p>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <CheckCircle2 className={`w-4 h-4 ${plan.popular ? 'text-amber-400' : 'text-indigo-400'}`} />
                    <span className="text-xs text-indigo-50/80">{f}</span>
                  </div>
                ))}
              </div>

              <button className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
                plan.popular
                  ? 'bg-amber-500 text-black hover:bg-amber-400'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}>
                <span>Hemen Başla</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="text-center space-y-4 px-4">
          <p className="text-[10px] text-purple-200/20 leading-relaxed uppercase tracking-widest">
            Abonelikler otomatik olarak yenilenir. İstediğin zaman ayarlardan iptal edebilirsin.
          </p>
          <div className="flex justify-center gap-6 text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
            <button>Kullanım Koşulları</button>
            <button>Gizlilik Politikası</button>
          </div>
        </div>
      </div>
    </div>
  );
};
