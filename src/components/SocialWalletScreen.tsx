import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Wallet, 
  Sparkles,
  Crown,
  Check,
  ChevronLeft
} from "lucide-react";
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp, runTransaction } from "firebase/firestore";
import { db } from "../lib/firebase";
import { UserProfile, SocialCommerceConfig, SocialSubscriptionPackage } from "../types";
import { toast } from "sonner";

interface SocialWalletScreenProps {
  currentUser: UserProfile;
  onNavigate: (tab: any) => void;
}

const DEFAULT_CONFIG: SocialCommerceConfig = {
  boostPackages: [],
  superLikePackages: [],
  analysisPackages: [],
  extraSwipePackages: [],
  discoverRefreshPackages: [],
  subscriptions: [
    { 
      id: 'sub_monthly', 
      type: 'monthly', 
      name: 'Aylık Premium', 
      price: 599, 
      durationDays: 30,
      features: { superLikes: 250, analyses: 250, dailySwipeLimit: 2000, boostDuration: 604800 } 
    },
    { 
      id: 'sub_yearly', 
      type: 'yearly', 
      name: 'Yıllık Premium', 
      price: 4999, 
      durationDays: 365,
      features: { superLikes: 3000, analyses: 3000, dailySwipeLimit: 24000, boostDuration: 7257600 } 
    },
  ]
};

export default function SocialWalletScreen({ currentUser, onNavigate }: SocialWalletScreenProps) {
  const [config, setConfig] = useState<SocialCommerceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, "config", "socialCommerce"));
        if (configDoc.exists()) {
          setConfig(configDoc.data() as SocialCommerceConfig);
        } else {
          await setDoc(doc(db, "config", "socialCommerce"), DEFAULT_CONFIG);
        }
      } catch (error) {
        console.error("Error fetching config:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handlePurchase = async (pkg: SocialSubscriptionPackage) => {
    if (currentUser.credits < pkg.price) {
      toast.error("Yetersiz bakiye. Lütfen kredi yükleyin.");
      return;
    }

    setPurchasing(pkg.id);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await transaction.get(userRef);
        
        if (!userSnap.exists()) throw "User does not exist!";
        
        const userData = userSnap.data() as UserProfile;
        if (userData.credits < pkg.price) throw "Insufficient credits!";

        const updates: any = {
          credits: userData.credits - pkg.price
        };

        const now = new Date();
        let duration = 0;
        if (pkg.type === 'daily') duration = 24 * 60 * 60 * 1000;
        else if (pkg.type === 'weekly') duration = 7 * 24 * 60 * 60 * 1000;
        else if (pkg.type === 'monthly') duration = 30 * 24 * 60 * 60 * 1000;
        else if (pkg.type === 'yearly') duration = 365 * 24 * 60 * 60 * 1000;

        const currentSub = userData.socialSubscriptionExpireAt ? new Date(userData.socialSubscriptionExpireAt) : now;
        const start = currentSub > now ? currentSub : now;
        
        updates.socialSubscriptionType = pkg.type;
        updates.socialSubscriptionExpireAt = new Date(start.getTime() + duration).toISOString();
        
        updates.superLikeCount = (userData.superLikeCount || 0) + pkg.features.superLikes;
        updates.analysisCount = (userData.analysisCount || 0) + pkg.features.analyses;
        
        const currentBoost = updates.boostExpiresAt ? new Date(updates.boostExpiresAt) : (userData.boostExpiresAt ? new Date(userData.boostExpiresAt) : now);
        const boostStart = currentBoost > now ? currentBoost : now;
        updates.boostExpiresAt = new Date(boostStart.getTime() + pkg.features.boostDuration * 1000).toISOString();

        transaction.update(userRef, updates);
        
        const transRef = doc(collection(db, "transactions"));
        transaction.set(transRef, {
          userId: currentUser.uid,
          type: 'purchase',
          source: 'subscription',
          amount: pkg.price,
          quantity: 1,
          createdAt: serverTimestamp()
        });
      });

      toast.success(`${pkg.name} başarıyla satın alındı!`);
    } catch (error) {
      console.error("Purchase error:", error);
      toast.error("Satın alma işlemi başarısız oldu.");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white relative overflow-hidden">
      {/* Ambient Background Glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[60%] bg-purple-900/10 blur-[120px] rounded-full opacity-40" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[80%] h-[60%] bg-amber-900/10 blur-[120px] rounded-full opacity-30" />
      </div>

      {/* Header */}
      <header className="relative z-20 bg-black/40 backdrop-blur-2xl border-b border-white/5 px-6 py-6 flex items-center gap-4">
        <button 
          onClick={() => onNavigate('social-main')}
          className="p-2 -ml-2 rounded-full hover:bg-white/5 text-white/60 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight">Mistik Cüzdan</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500/60">Ayrıcalıkları Keşfet</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 relative z-10">
        <div className="p-6 space-y-10">
          
          {/* Balance Card */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-10 rounded-[3rem] bg-white/[0.02] border border-white/10 backdrop-blur-3xl shadow-2xl overflow-hidden flex flex-col items-center text-center group"
          >
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-[80px] -mr-24 -mt-24 group-hover:bg-indigo-500/10 transition-all duration-700" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/5 rounded-full blur-[80px] -ml-24 -mb-24 group-hover:bg-amber-500/10 transition-all duration-700" />
            
            <div className="w-20 h-20 rounded-[2rem] bg-white/5 flex items-center justify-center border border-white/10 mb-6 relative z-10 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <Wallet className="w-10 h-10 text-indigo-400/80" />
            </div>
            
            <div className="relative z-10 space-y-2">
              <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Mevcut Jeton Bakiyesi</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-6xl font-serif font-bold text-white tracking-tighter">{currentUser.credits}</span>
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <Sparkles className="w-8 h-8 text-amber-400" />
                </motion.div>
              </div>
            </div>
          </motion.div>

          {/* Premium Packages */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <h2 className="text-xl font-serif font-bold text-white tracking-tight">Premium Paketler</h2>
              </div>
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Özel Teklifler</span>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {config.subscriptions.map((sub, idx) => (
                <motion.div 
                  key={sub.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative p-8 rounded-[2.5rem] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 backdrop-blur-xl text-white shadow-2xl overflow-hidden group"
                >
                  {/* Decorative Background Elements */}
                  <div className={`absolute top-0 right-0 w-64 h-64 ${sub.type === 'yearly' ? 'bg-amber-500/10' : 'bg-indigo-500/10'} rounded-full blur-[100px] -mr-32 -mt-32 group-hover:opacity-100 opacity-60 transition-opacity`} />
                  
                  <div className="relative z-10 flex flex-col gap-8">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-serif font-bold tracking-tight">{sub.name}</h3>
                          {sub.type === 'yearly' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-[8px] font-black uppercase tracking-widest text-black shadow-lg shadow-amber-500/20">En İyi Değer</span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 font-medium tracking-wide">Sınırsız beğeni ve mistik ayrıcalıklar</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-3xl font-serif font-bold text-amber-200">{sub.price}</span>
                          <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Jeton / {sub.type === 'monthly' ? 'Ay' : 'Yıl'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {[
                        "Sınırsız Beğeni Hakkı",
                        `${sub.features.superLikes} Süper Like`,
                        "Seni Beğenenleri Gör",
                        "Mistik Profil Analizi"
                      ].map((feature, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-3 text-sm text-white/70 font-medium">
                          <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 text-amber-400" />
                          </div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => handlePurchase(sub)}
                      disabled={purchasing === sub.id}
                      className={`w-full py-5 rounded-2xl ${sub.type === 'yearly' ? 'bg-amber-500 text-black' : 'bg-white text-black'} font-black text-sm shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100`}
                    >
                      {purchasing === sub.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                            <Sparkles className="w-4 h-4" />
                          </motion.div>
                          İşleniyor...
                        </div>
                      ) : 'Ayrıcalıkları Başlat'}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
