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
    <div className="flex flex-col h-full bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center gap-4 z-10">
        <button 
          onClick={() => onNavigate('social-main')}
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-900">Cüzdan</h1>
          <p className="text-xs font-medium text-slate-500">Ayrıcalıkları keşfet.</p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32">
        <div className="p-6 space-y-8">
          
          {/* Balance Card */}
          <div className="relative p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-sm overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50" />
            
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 mb-4 relative z-10">
              <Wallet className="w-8 h-8 text-indigo-600" />
            </div>
            
            <div className="relative z-10">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Mevcut Jeton Bakiyesi</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-5xl font-serif font-bold text-slate-900">{currentUser.credits}</span>
                <Sparkles className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </div>

          {/* Premium Packages */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-2">
              <Crown className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-serif font-bold text-slate-900">Premium Paketler</h2>
            </div>

            {config.subscriptions.map((sub) => (
              <motion.div 
                key={sub.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative p-6 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/20 overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
                
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold">{sub.name}</h3>
                      <p className="text-xs text-indigo-100 mt-1">Sınırsız beğeni ve daha fazlası</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-2xl font-serif font-bold">{sub.price}</span>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                      </div>
                      <p className="text-[10px] text-indigo-200 uppercase tracking-wider">Jeton / {sub.type === 'monthly' ? 'Ay' : 'Yıl'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-indigo-50">
                      <Check className="w-4 h-4 text-amber-300" />
                      <span>Sınırsız Beğeni</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-indigo-50">
                      <Check className="w-4 h-4 text-amber-300" />
                      <span>{sub.features.superLikes} Süper Like</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-indigo-50">
                      <Check className="w-4 h-4 text-amber-300" />
                      <span>Seni Beğenenleri Gör</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handlePurchase(sub)}
                    disabled={purchasing === sub.id}
                    className="w-full py-4 rounded-2xl bg-white text-indigo-600 font-bold text-sm shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-70"
                  >
                    {purchasing === sub.id ? 'İşleniyor...' : 'Satın Al'}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
