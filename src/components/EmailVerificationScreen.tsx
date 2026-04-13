import { useState } from "react";
import { motion } from "motion/react";
import { 
  Mail, 
  RefreshCw, 
  CheckCircle2, 
  LogOut,
  Loader2,
  AlertCircle
} from "lucide-react";
import { 
  sendEmailVerification, 
  signOut,
  reload
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { toast } from "sonner";

export default function EmailVerificationScreen() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const user = auth.currentUser;

  const handleResend = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await sendEmailVerification(user);
      toast.success("Doğrulama e-postası tekrar gönderildi.");
    } catch (err: any) {
      if (err.code === 'auth/too-many-requests') {
        toast.error("Çok fazla istek gönderildi. Lütfen biraz bekleyin.");
      } else {
        toast.error("E-posta gönderilirken bir hata oluştu.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheck = async () => {
    if (!user) return;
    setChecking(true);
    try {
      await reload(user);
      if (user.emailVerified) {
        toast.success("E-posta adresiniz doğrulandı!");
        // App.tsx will pick up the change via onAuthStateChanged or we can trigger a re-render
        window.location.reload(); 
      } else {
        toast.info("E-posta adresi henüz doğrulanmamış.");
      }
    } catch (err) {
      toast.error("Kontrol edilirken bir hata oluştu.");
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      toast.error("Çıkış yapılamadı.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F8F9FB] overflow-hidden relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-amber-100/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-100/20 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 text-center">
          <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
            <Mail className="w-10 h-10 text-amber-600" />
          </div>

          <h2 className="text-3xl font-serif font-bold text-slate-900 mb-4 tracking-tight">
            Email Adresini Doğrula
          </h2>
          
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-10">
            Hesabını güvenli şekilde kullanmak için email doğrulaması gerekiyor. <br />
            <span className="text-slate-900 font-bold">{user?.email}</span> adresine bir bağlantı gönderdik.
          </p>

          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleCheck}
              disabled={checking || loading}
              className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
            >
              {checking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Yeniden Kontrol Et</span>
                </>
              )}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleResend}
              disabled={checking || loading}
              className="w-full py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>Tekrar Mail Gönder</span>
                </>
              )}
            </motion.button>

            <button
              onClick={handleLogout}
              className="w-full py-4 text-slate-400 hover:text-red-500 font-bold text-sm uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Çıkış Yap
            </button>
          </div>

          <div className="mt-10 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900/70 font-medium leading-relaxed">
              E-posta kutunu (ve gereksiz klasörünü) kontrol etmeyi unutma. Bağlantıya tıkladıktan sonra "Yeniden Kontrol Et" butonuna basabilirsin.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
