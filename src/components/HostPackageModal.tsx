import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Zap, Calendar, Clock, Check, CreditCard, Sparkles, Coins } from "lucide-react";
import { SocialProfile, AppConfig, UserProfile } from "../types";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, updateDoc, arrayUnion, getDoc, onSnapshot, increment, collection, addDoc } from "firebase/firestore";
import { toast } from "sonner";

interface HostPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: SocialProfile;
  onSuccess: () => void;
}

export default function HostPackageModal({ isOpen, onClose, profile, onSuccess }: HostPackageModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, "config", "global"), (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data() as AppConfig);
      }
    });

    let unsubUser = () => {};
    if (auth.currentUser) {
      unsubUser = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
        }
      });
    }

    return () => {
      unsubConfig();
      unsubUser();
    };
  }, []);

  const getPackagePrice = (id: string) => {
    if (!config?.hostPackagePrices) return 0;
    return config.hostPackagePrices[id as keyof typeof config.hostPackagePrices] || 0;
  };

  const PACKAGES = [
    {
      id: 'daily',
      name: 'Günlük Host',
      duration: 1,
      price: getPackagePrice('daily'),
      description: '24 saat boyunca sınırsız oda açma yetkisi.',
      icon: Clock,
      color: 'bg-blue-500'
    },
    {
      id: 'weekly',
      name: 'Haftalık Host',
      duration: 7,
      price: getPackagePrice('weekly'),
      description: '7 gün boyunca sınırsız oda açma ve donate toplama yetkisi.',
      icon: Calendar,
      color: 'bg-purple-500',
      popular: true
    },
    {
      id: 'monthly',
      name: 'Aylık Host',
      duration: 30,
      price: getPackagePrice('monthly'),
      description: '30 gün boyunca VIP host ayrıcalıkları ve sınırsız oda.',
      icon: Zap,
      color: 'bg-amber-500'
    }
  ];

  const handlePurchase = async (pkgId: string) => {
    if (!auth.currentUser || !userProfile) return;
    
    const pkg = PACKAGES.find(p => p.id === pkgId);
    if (!pkg) return;

    if (userProfile.credits < pkg.price) {
      toast.error("Yetersiz coin bakiyesi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + pkg.duration * 24 * 60 * 60 * 1000).toISOString();
      
      const packageData = {
        type: pkgId,
        purchasedAt: now.toISOString(),
        expiresAt: expiresAt
      };

      // 1. Deduct coins from UserProfile
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        credits: increment(-pkg.price)
      });

      // 2. Update SocialProfile hosting status
      const socialRef = doc(db, "socialProfiles", auth.currentUser.uid);
      await updateDoc(socialRef, {
        "hosting.activePackage": packageData,
        "hosting.packageHistory": arrayUnion(packageData)
      });

      // 3. Create transaction record
      await addDoc(collection(db, "socialTransactions"), {
        uid: auth.currentUser.uid,
        type: 'host_package_purchase',
        amount: pkg.price,
        balanceType: 'main',
        description: `${pkg.name} satın alındı`,
        timestamp: now.toISOString(),
        metadata: {
          packageType: pkgId,
          expiresAt: expiresAt
        }
      });

      toast.success(`${pkg.name} başarıyla tanımlandı!`);
      onSuccess();
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `socialProfiles/${auth.currentUser.uid}`);
      toast.error("Paket satın alma işlemi başarısız oldu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-lg bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-8 pb-4 flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-zinc-900">Host Paketi Al</h2>
                <p className="text-sm text-zinc-500">Oda açmak ve topluluğunu kurmak için bir paket seç.</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6">
              {/* Balance Info */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Bakiyen</p>
                    <p className="text-xs font-bold text-zinc-900">{userProfile?.credits || 0} Coin</p>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Mevcut Durum</p>
                  <p className="text-sm font-bold text-zinc-900">
                    {profile.hosting?.activePackage 
                      ? `${new Date(profile.hosting.activePackage.expiresAt).toLocaleDateString('tr-TR')} tarihine kadar aktif`
                      : new Date(profile.hosting?.freeTrialUntil || '').getTime() > Date.now()
                        ? `Ücretsiz deneme ${new Date(profile.hosting?.freeTrialUntil || '').toLocaleDateString('tr-TR')} tarihine kadar`
                        : 'Aktif paketiniz bulunmuyor'}
                  </p>
                </div>
              </div>

              {/* Packages */}
              <div className="space-y-3">
                {PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg.id)}
                    className={`w-full text-left p-5 rounded-3xl border-2 transition-all relative group ${
                      selectedPackage === pkg.id 
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-xl' 
                        : 'border-zinc-50 bg-white text-zinc-900 hover:border-zinc-100'
                    }`}
                  >
                    {pkg.popular && (
                      <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-amber-500 text-[8px] font-bold text-black uppercase tracking-widest shadow-lg">
                        En Popüler
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${pkg.color} ${selectedPackage === pkg.id ? 'bg-white/20' : 'bg-opacity-10'}`}>
                        <pkg.icon className={`w-6 h-6 ${selectedPackage === pkg.id ? 'text-white' : pkg.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold">{pkg.name}</h4>
                          <div className="flex items-center gap-1">
                            <span className={`text-sm font-bold ${selectedPackage === pkg.id ? 'text-white' : 'text-zinc-900'}`}>{pkg.price}</span>
                            <Coins className={`w-3 h-3 ${selectedPackage === pkg.id ? 'text-white/60' : 'text-amber-500'}`} />
                          </div>
                        </div>
                        <p className={`text-xs leading-relaxed ${selectedPackage === pkg.id ? 'text-white/60' : 'text-zinc-500'}`}>
                          {pkg.description}
                        </p>
                      </div>
                      {selectedPackage === pkg.id && (
                        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                          <Check className="w-4 h-4 text-zinc-900" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Benefits */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Paket Ayrıcalıkları</h5>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Sınırsız Oda Açma',
                    'Donate Toplama',
                    'Öncelikli Listeleme',
                    'Özel Host Rozeti'
                  ].map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2 text-xs text-zinc-600">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-emerald-500" />
                      </div>
                      {benefit}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-8 pt-4 border-t border-zinc-50">
              <button
                disabled={!selectedPackage || isSubmitting}
                onClick={() => handlePurchase(selectedPackage!)}
                className={`w-full py-5 rounded-2xl font-bold tracking-widest uppercase text-xs transition-all flex items-center justify-center gap-3 ${
                  selectedPackage && !isSubmitting
                    ? 'bg-zinc-900 text-white shadow-2xl shadow-zinc-900/20 hover:bg-zinc-800'
                    : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
                }`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Coin ile Satın Al</span>
                  </>
                )}
              </button>
              <p className="text-[8px] text-zinc-400 text-center mt-4 uppercase tracking-widest">
                Ödeme işlemi coin bakiyeniz üzerinden gerçekleştirilir.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
