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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
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
      setLoading(false);
    }
  };

  const handleSocialAuth = async (provider: any) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message || "Giriş yapılamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#050505] overflow-hidden relative">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="celestial-bg" />
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-900/10 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-900/5 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        
        {/* Subtle stars */}
        {[...Array(20)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-0.5 h-0.5 bg-white rounded-full animate-star"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-md relative z-10 px-2 sm:px-0"
      >
        <button
          onClick={() => onNavigate('welcome')}
          className="absolute -top-12 sm:-top-16 left-0 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-zinc-500 hover:text-amber-400 group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="bg-white/[0.03] backdrop-blur-3xl p-8 sm:p-10 rounded-[3rem] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Inner glow */}
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/[0.02] to-purple-500/[0.02] pointer-events-none" />
          
          <div className="flex flex-col items-center text-center mb-10 relative">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-24 h-24 flex items-center justify-center relative group mb-6"
            >
              <div className="absolute inset-0 bg-amber-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
              <img 
                src="/logo.svg" 
                alt="LASYA Logo" 
                className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]"
              />
            </motion.div>
            <h2 className="text-3xl sm:text-4xl font-serif font-bold text-white mb-3 tracking-tight">
              Tekrar Hoş Geldin
            </h2>
            <p className="text-zinc-500 text-sm font-medium tracking-wide">
              LASYA senin için fısıldamaya devam ediyor.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex items-center gap-3 text-red-400/80 text-sm backdrop-blur-md"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="font-medium">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-5 relative">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Mail className="w-5 h-5 text-zinc-600 group-focus-within:text-amber-400 transition-colors" />
              </div>
              <input
                type="email"
                placeholder="E-posta Adresin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-[1.5rem] py-4 pl-14 pr-6 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.06] transition-all duration-300 shadow-inner"
                required
              />
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Lock className="w-5 h-5 text-zinc-600 group-focus-within:text-amber-400 transition-colors" />
              </div>
              <input
                type="password"
                placeholder="Şifren"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-[1.5rem] py-4 pl-14 pr-6 text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/30 focus:bg-white/[0.06] transition-all duration-300 shadow-inner"
                required
              />
            </div>

            <div className="flex justify-end px-2">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-xs text-zinc-500 hover:text-amber-400 transition-colors font-bold tracking-wider uppercase"
              >
                Şifremi Unuttum?
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02, boxShadow: "0 0 20px rgba(212,175,55,0.2)" }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-5 rounded-[1.5rem] bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-xl shadow-amber-900/20 flex items-center justify-center gap-3 disabled:opacity-50 transition-all overflow-hidden relative group"
            >
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span className="relative z-10">Giriş Yap</span>
                  <ArrowRight className="w-5 h-5 relative z-10" />
                </>
              )}
            </motion.button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] text-zinc-600">
              <span className="bg-[#050505] px-4">Veya Şununla Devam Et</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.06)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSocialAuth(googleProvider)}
              className="flex items-center justify-center gap-3 py-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] text-zinc-300 font-bold text-sm transition-all"
            >
              <Chrome className="w-5 h-5 text-red-500/80" />
              <span>Google</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.06)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSocialAuth(facebookProvider)}
              className="flex items-center justify-center gap-3 py-4 rounded-[1.5rem] border border-white/10 bg-white/[0.03] text-zinc-300 font-bold text-sm transition-all"
            >
              <Facebook className="w-5 h-5 text-blue-500/80" />
              <span>Facebook</span>
            </motion.button>
          </div>

          <div className="mt-10 text-center">
            <button
              onClick={() => onNavigate('register')}
              className="text-sm text-zinc-500 hover:text-amber-400 transition-colors font-bold group"
            >
              Henüz hesabın yok mu? <span className="text-amber-500/80 group-hover:text-amber-400">Kayıt ol</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
