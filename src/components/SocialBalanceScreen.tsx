import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  CreditCard, 
  Zap, 
  ChevronRight,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Gift,
  Crown
} from "lucide-react";
import { collection, query, where, orderBy, getDocs, limit, addDoc, doc, updateDoc, increment } from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import { SocialProfile, UserProfile, SocialTransaction, WithdrawalRequest } from "../types";
import { toast } from "sonner";
import { MIN_WITHDRAWAL_AMOUNT } from "../constants/social";

interface SocialBalanceScreenProps {
  userProfile: UserProfile;
  socialProfile: SocialProfile;
  onOpenHostPackages: () => void;
}

export default function SocialBalanceScreen({ userProfile, socialProfile, onOpenHostPackages }: SocialBalanceScreenProps) {
  const [transactions, setTransactions] = useState<SocialTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyType, setHistoryType] = useState<'transactions' | 'earnings'>('transactions');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!auth.currentUser) return;
    setIsLoading(true);
    try {
      // Fetch latest transactions
      const txQuery = query(
        collection(db, "socialTransactions"),
        where("uid", "==", auth.currentUser.uid),
        orderBy("timestamp", "desc"),
        limit(10)
      );
      const txSnap = await getDocs(txQuery);
      const txData = txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialTransaction));
      setTransactions(Array.from(new Map(txData.map(tx => [tx.id, tx])).values()));

      // Fetch latest withdrawals
      const withdrawQuery = query(
        collection(db, "withdrawalRequests"),
        where("uid", "==", auth.currentUser.uid),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const withdrawSnap = await getDocs(withdrawQuery);
      const withdrawData = withdrawSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithdrawalRequest));
      setWithdrawals(Array.from(new Map(withdrawData.map(w => [w.id, w])).values()));
    } catch (error) {
      console.error("Error fetching balance data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopUp = () => {
    toast.info("Bakiye yükleme işlemi yakında aktif olacaktır.");
  };

  return (
    <div className="space-y-8 pt-4 pb-12">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 gap-4">
        {/* Main Balance Card */}
        <div className="p-8 rounded-[3rem] bg-zinc-900 text-white space-y-8 relative overflow-hidden shadow-2xl shadow-zinc-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -mr-24 -mt-24" />
          <div className="flex items-center justify-between relative">
            <div className="space-y-1">
              <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em]">Ana Bakiye</p>
              <h2 className="text-4xl font-bold tracking-tight">
                {userProfile.credits?.toLocaleString('tr-TR') || 0} <span className="text-lg font-medium text-zinc-500">Kredi</span>
              </h2>
              <p className="text-[10px] text-zinc-500 font-medium">Hediye gönderimi ve paket alımları için kullanılır.</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
              <Wallet className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 relative">
            <button 
              onClick={handleTopUp}
              className="py-4 rounded-2xl bg-white text-zinc-900 font-bold text-xs uppercase tracking-widest hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Yükle
            </button>
            <button 
              onClick={onOpenHostPackages}
              className="py-4 rounded-2xl bg-zinc-800 text-white font-bold text-xs uppercase tracking-widest hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Paket Al
            </button>
          </div>
        </div>

        {/* Withdrawable Balance Card */}
        <div className="p-8 rounded-[3rem] bg-emerald-600 text-white space-y-8 relative overflow-hidden shadow-2xl shadow-emerald-900/20">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24" />
          <div className="flex items-center justify-between relative">
            <div className="space-y-1">
              <p className="text-emerald-100/60 text-[10px] font-bold uppercase tracking-[0.2em]">Çekilebilir Bakiye</p>
              <h2 className="text-4xl font-bold tracking-tight">
                {socialProfile.withdrawableBalance?.toLocaleString('tr-TR') || 0} <span className="text-lg font-medium text-emerald-200/60">Kredi</span>
              </h2>
              <p className="text-[10px] text-emerald-100/60 font-medium">Sosyal kazançlarınızdan biriken bakiye.</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md">
              <TrendingUp className="w-7 h-7 text-white" />
            </div>
          </div>
          <button 
            disabled={socialProfile.withdrawableBalance < (MIN_WITHDRAWAL_AMOUNT || 1000)}
            onClick={() => setShowWithdrawModal(true)}
            className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest transition-colors relative flex items-center justify-center gap-2 ${
              socialProfile.withdrawableBalance < (MIN_WITHDRAWAL_AMOUNT || 1000) 
                ? 'bg-white/10 text-white/40 cursor-not-allowed' 
                : 'bg-white/20 backdrop-blur-md text-white hover:bg-white/30'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            {socialProfile.withdrawableBalance < (MIN_WITHDRAWAL_AMOUNT || 1000) 
              ? `En Az ${(MIN_WITHDRAWAL_AMOUNT || 1000).toLocaleString('tr-TR')} Kredi Gerekli`
              : 'Çekim Talebi Oluştur'
            }
          </button>
        </div>

        {/* Hosting Status Card */}
        <div className="p-6 rounded-[2.5rem] bg-amber-50 border border-amber-100 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Host Durumu</p>
                <p className="text-sm font-bold text-zinc-900">
                  {socialProfile.hosting?.activePackage 
                    ? `${socialProfile.hosting.activePackage.type === 'daily' ? 'Günlük' : socialProfile.hosting.activePackage.type === 'weekly' ? 'Haftalık' : 'Aylık'} Paket Aktif`
                    : new Date(socialProfile.hosting?.freeTrialUntil || '').getTime() > Date.now()
                    ? 'Ücretsiz Deneme Aktif'
                    : 'Paket Bulunmuyor'}
                </p>
              </div>
            </div>
            {(socialProfile.hosting?.activePackage || (socialProfile.hosting?.freeTrialUntil && new Date(socialProfile.hosting.freeTrialUntil).getTime() > Date.now())) && (
              <CountdownTimer 
                expiryDate={socialProfile.hosting?.activePackage?.expiresAt || socialProfile.hosting?.freeTrialUntil || ''} 
              />
            )}
          </div>
          {!socialProfile.hosting?.activePackage && (
            <p className="text-[10px] text-amber-700/60 font-medium leading-relaxed px-1">
              Oda açmak ve topluluğunu kurmak için bir host paketi satın almalısın.
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={() => {
            setHistoryType('transactions');
            setShowHistoryModal(true);
          }}
          className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 flex flex-col items-center gap-3 hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <History className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">İşlem Geçmişi</span>
        </button>
        <button 
          onClick={() => {
            setHistoryType('earnings');
            setShowHistoryModal(true);
          }}
          className="p-6 rounded-3xl bg-zinc-50 border border-zinc-100 flex flex-col items-center gap-3 hover:bg-white hover:shadow-xl hover:shadow-zinc-200/50 transition-all group"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <TrendingUp className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Kazanç Geçmişi</span>
        </button>
      </div>

      {/* Recent Activity */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-bold text-zinc-900">Son İşlemler</h3>
          <button 
            onClick={() => {
              setHistoryType('transactions');
              setShowHistoryModal(true);
            }}
            className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:text-zinc-900"
          >
            Tümünü Gör
          </button>
        </div>
        <div className="space-y-3">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={`tx-skeleton-${i}`} className="h-20 rounded-2xl bg-zinc-50 animate-pulse" />
            ))
          ) : transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    tx.type === 'top_up' || tx.type === 'gift_received' || tx.type === 'room_earning'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-zinc-200 text-zinc-600'
                  }`}>
                    {tx.type === 'gift_sent' && <Gift className="w-5 h-5" />}
                    {tx.type === 'gift_received' && <Gift className="w-5 h-5" />}
                    {tx.type === 'host_package_purchase' && <Crown className="w-5 h-5" />}
                    {tx.type === 'withdrawal' && <ArrowUpRight className="w-5 h-5" />}
                    {tx.type === 'room_earning' && <TrendingUp className="w-5 h-5" />}
                    {tx.type === 'top_up' && <Plus className="w-5 h-5" />}
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-zinc-900">{tx.description}</p>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                      {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Tarih Yok'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`font-bold text-sm ${
                    tx.type === 'top_up' || tx.type === 'gift_received' || tx.type === 'room_earning'
                      ? 'text-emerald-500'
                      : 'text-zinc-900'
                  }`}>
                    {tx.type === 'top_up' || tx.type === 'gift_received' || tx.type === 'room_earning' ? '+' : '-'}{tx.amount}
                  </span>
                  <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{tx.balanceType === 'main' ? 'Ana' : 'Çekilebilir'}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center mx-auto">
                <History className="w-8 h-8 text-zinc-200" />
              </div>
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Henüz işlem bulunmuyor</p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showWithdrawModal && (
          <WithdrawModal 
            balance={socialProfile.withdrawableBalance} 
            userProfile={userProfile}
            onClose={() => setShowWithdrawModal(false)}
            onSuccess={() => {
              setShowWithdrawModal(false);
              fetchData();
            }}
          />
        )}
        {showHistoryModal && (
          <HistoryModal 
            type={historyType} 
            onClose={() => setShowHistoryModal(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CountdownTimer({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(expiryDate).getTime() - Date.now();
      if (difference <= 0) return null;

      return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      };
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (!remaining) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryDate]);

  if (!timeLeft) return <span className="text-xs font-bold text-rose-500">Süre Doldu</span>;

  return (
    <div className="flex items-center gap-1 font-mono text-xs font-bold text-zinc-900">
      <span>{timeLeft.hours.toString().padStart(2, '0')}s</span>
      <span className="text-zinc-300">:</span>
      <span>{timeLeft.minutes.toString().padStart(2, '0')}d</span>
      <span className="text-zinc-300">:</span>
      <span>{timeLeft.seconds.toString().padStart(2, '0')}s</span>
    </div>
  );
}

function WithdrawModal({ balance, userProfile, onClose, onSuccess }: { balance: number, userProfile: UserProfile, onClose: () => void, onSuccess: () => void }) {
  const [amount, setAmount] = useState("");
  const [iban, setIban] = useState("");
  const [accountHolder, setAccountHolder] = useState(userProfile.displayName || "");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const withdrawAmount = parseInt(amount);
    if (isNaN(withdrawAmount) || withdrawAmount < (MIN_WITHDRAWAL_AMOUNT || 1000)) {
      toast.error(`Minimum çekim tutarı ${(MIN_WITHDRAWAL_AMOUNT || 1000).toLocaleString('tr-TR')} kredidir.`);
      return;
    }

    if (withdrawAmount > balance) {
      toast.error("Yetersiz çekilebilir bakiye.");
      return;
    }

    if (!iban || !accountHolder || !bankName) {
      toast.error("Lütfen tüm alanları doldurun.");
      return;
    }

    setIsSubmitting(true);
    try {
      const requestId = doc(collection(db, "withdrawalRequests")).id;
      const timestamp = new Date().toISOString();

      // Create withdrawal request
      await addDoc(collection(db, "withdrawalRequests"), {
        id: requestId,
        uid: auth.currentUser.uid,
        userEmail: userProfile.email,
        userName: userProfile.displayName,
        amount: withdrawAmount,
        status: 'pending',
        iban,
        accountHolder,
        bankName,
        createdAt: timestamp
      });

      // Update social profile balance
      await updateDoc(doc(db, "socialProfiles", auth.currentUser.uid), {
        withdrawableBalance: increment(-withdrawAmount)
      });

      // Create transaction record
      await addDoc(collection(db, "socialTransactions"), {
        id: doc(collection(db, "socialTransactions")).id,
        uid: auth.currentUser.uid,
        type: 'withdrawal',
        amount: withdrawAmount,
        balanceType: 'withdrawable',
        description: "Çekim Talebi",
        timestamp,
        metadata: { withdrawalId: requestId }
      } as SocialTransaction);

      toast.success("Çekim talebiniz başarıyla oluşturuldu.");
      onSuccess();
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast.error("Çekim talebi oluşturulurken bir hata oluştu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full max-w-lg bg-white rounded-t-[3rem] sm:rounded-[3rem] p-8 space-y-8 overflow-y-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-zinc-900">Çekim Talebi</h2>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Kazançlarınızı nakite dönüştürün</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-2xl bg-zinc-50 flex items-center justify-center text-zinc-400">
            <ChevronRight className="w-5 h-5 rotate-90" />
          </button>
        </div>

        <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Mevcut Bakiye</p>
            <p className="text-2xl font-bold text-emerald-700">{balance?.toLocaleString('tr-TR') || 0} Kredi</p>
          </div>
          <TrendingUp className="w-8 h-8 text-emerald-500" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Çekilecek Tutar (Kredi)</label>
              <input 
                type="number" 
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Min. 1000"
                className="w-full p-5 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-zinc-900 focus:ring-0 transition-all font-bold"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">IBAN</label>
              <input 
                type="text" 
                value={iban}
                onChange={e => setIban(e.target.value)}
                placeholder="TR00 0000 0000..."
                className="w-full p-5 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-zinc-900 focus:ring-0 transition-all font-bold"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Hesap Sahibi</label>
                <input 
                  type="text" 
                  value={accountHolder}
                  onChange={e => setAccountHolder(e.target.value)}
                  placeholder="Ad Soyad"
                  className="w-full p-5 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-zinc-900 focus:ring-0 transition-all font-bold"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest px-1">Banka Adı</label>
                <input 
                  type="text" 
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder="Banka"
                  className="w-full p-5 rounded-2xl bg-zinc-50 border border-zinc-100 focus:border-zinc-900 focus:ring-0 transition-all font-bold"
                  required
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-[10px] font-medium text-amber-700 leading-relaxed">
              Çekim talepleri incelendikten sonra 1-3 iş günü içerisinde belirttiğiniz hesaba aktarılır. Minimum çekim tutarı 1,000 kredidir.
            </p>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-6 rounded-[2rem] bg-zinc-900 text-white font-bold text-sm uppercase tracking-widest shadow-2xl shadow-zinc-900/20 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'İşleniyor...' : 'Talebi Gönder'}
          </button>
        </form>
      </motion.div>
    </motion.div>
  );
}

function HistoryModal({ type, onClose }: { type: 'transactions' | 'earnings', onClose: () => void }) {
  const [items, setItems] = useState<SocialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!auth.currentUser) return;
      try {
        let q = query(
          collection(db, "socialTransactions"),
          where("uid", "==", auth.currentUser.uid),
          orderBy("timestamp", "desc")
        );

        if (type === 'earnings') {
          q = query(
            collection(db, "socialTransactions"),
            where("uid", "==", auth.currentUser.uid),
            where("type", "in", ["gift_received", "room_earning"]),
            orderBy("timestamp", "desc")
          );
        }

        const snap = await getDocs(q);
        const txData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SocialTransaction));
        setItems(Array.from(new Map(txData.map(tx => [tx.id, tx])).values()));
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [type]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-white flex flex-col"
    >
      <header className="px-6 pt-12 pb-4 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-10">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-900"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h2 className="font-bold text-zinc-900">{type === 'transactions' ? 'İşlem Geçmişi' : 'Kazanç Geçmişi'}</h2>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-12 space-y-4 mt-4">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={`item-skeleton-${i}`} className="h-20 rounded-2xl bg-zinc-50 animate-pulse" />
          ))
        ) : items.length > 0 ? (
          items.map((item) => (
            <div key={item.id} className="p-5 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  item.type === 'top_up' || item.type === 'gift_received' || item.type === 'room_earning'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-zinc-200 text-zinc-600'
                }`}>
                  {item.type === 'gift_sent' && <Gift className="w-5 h-5" />}
                  {item.type === 'gift_received' && <Gift className="w-5 h-5" />}
                  {item.type === 'host_package_purchase' && <Crown className="w-5 h-5" />}
                  {item.type === 'withdrawal' && <ArrowUpRight className="w-5 h-5" />}
                  {item.type === 'room_earning' && <TrendingUp className="w-5 h-5" />}
                  {item.type === 'top_up' && <Plus className="w-5 h-5" />}
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-sm text-zinc-900">{item.description}</p>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                    {item.timestamp ? new Date(item.timestamp).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'Tarih Yok'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`font-bold text-sm ${
                  item.type === 'top_up' || item.type === 'gift_received' || item.type === 'room_earning'
                    ? 'text-emerald-500'
                    : 'text-zinc-900'
                }`}>
                  {item.type === 'top_up' || item.type === 'gift_received' || item.type === 'room_earning' ? '+' : '-'}{item.amount}
                </span>
                <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">{item.balanceType === 'main' ? 'Ana' : 'Çekilebilir'}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-24 space-y-4">
            <div className="w-20 h-20 rounded-full bg-zinc-50 flex items-center justify-center mx-auto">
              <History className="w-10 h-10 text-zinc-200" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-zinc-900">Henüz bir kayıt yok</p>
              <p className="text-xs text-zinc-400">Yaptığınız işlemler burada listelenecektir.</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
