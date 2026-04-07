import { useState } from "react";
import { motion } from "motion/react";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Chrome, 
  Facebook, 
  Sparkles, 
  Loader2,
  AlertCircle,
  ChevronLeft
} from "lucide-react";
import { 
  signInWithPopup, 
  signInWithEmailAndPassword
} from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "../lib/firebase";

interface LoginScreenProps {
  onNavigate: (screen: 'register' | 'forgot-password' | 'welcome') => void;
}

export default function LoginScreen({ onNavigate }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("login start");
    setEmailLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("login success");
    } catch (err: any) {
      console.log("login error", err);
      let errorMessage = "Giriş yapılamadı.";
      
      if (err.code === 'auth/operation-not-allowed') {
        errorMessage = "E-posta ile giriş şu anda aktif değil. Lütfen Google ile giriş yapmayı deneyin.";
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = "E-posta adresi veya şifre hatalı.";
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = "Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.";
      }
      
      setError(errorMessage);
    } finally {
      console.log("login finally");
      setEmailLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    console.log("google login start");
    setSocialLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      console.log("google login success");
    } catch (err: any) {
      console.log("google login error", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Giriş penceresi kapatıldı. Lütfen tekrar deneyin.");
      } else {
        setError(err.message || "Google ile giriş yapılamadı.");
      }
    } finally {
      console.log("google login finally");
      setSocialLoading(false);
    }
  };

  const handleFacebookAuth = async () => {
    console.log("facebook login start");
    setSocialLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, facebookProvider);
      console.log("facebook login success");
    } catch (err: any) {
      console.log("facebook login error", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Giriş penceresi kapatıldı. Lütfen tekrar deneyin.");
      } else {
        setError(err.message || "Facebook ile giriş yapılamadı.");
      }
    } finally {
      console.log("facebook login finally");
      setSocialLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F8F9FB] overflow-hidden relative">
      {/* Background elements - subtle and clean */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[70%] h-[70%] bg-amber-100/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-100/20 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <button
          onClick={() => onNavigate('welcome')}
          className="absolute -top-12 left-0 p-2.5 rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 transition-all text-slate-400 hover:text-slate-600 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>

        <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
          <div className="flex flex-col items-center text-center mb-10">
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="w-20 h-20 flex items-center justify-center mb-6"
            >
              <img 
                src="/logo.svg" 
                alt="LASYA Logo" 
                className="w-full h-full object-contain filter grayscale-[0.2]"
              />
            </motion.div>
            <h2 className="text-3xl font-serif font-bold text-slate-900 mb-2 tracking-tight">
              Tekrar Hoş Geldin
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              LASYA senin için fısıldamaya devam ediyor.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-medium">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-posta</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-slate-300 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="email"
                  placeholder="E-posta adresini gir"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50 focus:bg-white focus:ring-4 focus:ring-amber-500/5 transition-all duration-200"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Şifre</label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-[10px] text-slate-400 hover:text-amber-600 transition-colors font-bold uppercase tracking-wider"
                >
                  Unuttun mu?
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-300 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="password"
                  placeholder="Şifreni gir"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50 focus:bg-white focus:ring-4 focus:ring-amber-500/5 transition-all duration-200"
                  required
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={emailLoading || socialLoading}
              className="w-full py-4.5 mt-4 rounded-2xl bg-slate-900 text-white font-semibold shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
            >
              {emailLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <span className="bg-white px-4">Veya şununla devam et</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleGoogleAuth}
              disabled={emailLoading || socialLoading}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
            >
              {socialLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Chrome className="w-4 h-4 text-slate-600" />
                  <span>Google</span>
                </>
              )}
            </button>
            <button
              onClick={handleFacebookAuth}
              disabled={emailLoading || socialLoading}
              className="flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-slate-200 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
            >
              {socialLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Facebook className="w-4 h-4 text-slate-600" />
                  <span>Facebook</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => onNavigate('register')}
              className="text-sm text-slate-500 font-medium"
            >
              Henüz hesabın yok mu? <span className="text-amber-600 font-bold hover:underline underline-offset-4">Kayıt ol</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
