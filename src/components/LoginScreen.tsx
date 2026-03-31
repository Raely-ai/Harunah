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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#050505]">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-amber-900/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10 px-2 sm:px-0"
      >
        <button
          onClick={() => onNavigate('welcome')}
          className="absolute -top-12 sm:-top-16 left-0 p-2 rounded-full hover:bg-white/10 transition-colors text-purple-200/40 hover:text-amber-100"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="bg-black/40 backdrop-blur-2xl p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-white/10 shadow-2xl">
          <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-500/20 border border-amber-500/20 mb-4 sm:mb-6">
              <Sparkles className="w-8 h-8 sm:w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-amber-50 mb-2">
              Tekrar Hoş Geldin
            </h2>
            <p className="text-purple-200/40 text-xs sm:text-sm font-medium">
              Ahlas senin için fısıldamaya devam ediyor.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-400 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20 group-focus-within:text-amber-400 transition-colors" />
              <input
                type="email"
                placeholder="E-posta Adresin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-purple-200/20 focus:outline-none focus:border-amber-500/40 focus:bg-white/10 transition-all"
                required
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20 group-focus-within:text-amber-400 transition-colors" />
              <input
                type="password"
                placeholder="Şifren"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-purple-200/20 focus:outline-none focus:border-amber-500/40 focus:bg-white/10 transition-all"
                required
              />
            </div>

            <div className="flex justify-end px-2">
              <button
                type="button"
                onClick={() => onNavigate('forgot-password')}
                className="text-xs text-purple-200/40 hover:text-amber-400 transition-colors font-medium"
              >
                Şifremi Unuttum?
              </button>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold shadow-lg shadow-amber-900/20 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest text-purple-200/20">
              <span className="bg-[#0a0510] px-4">Veya Şununla Devam Et</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSocialAuth(googleProvider)}
              className="flex items-center justify-center gap-3 py-4 rounded-2xl border border-white/10 bg-white/5 text-white font-medium transition-colors"
            >
              <Chrome className="w-5 h-5 text-red-400" />
              <span>Google</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSocialAuth(facebookProvider)}
              className="flex items-center justify-center gap-3 py-4 rounded-2xl border border-white/10 bg-white/5 text-white font-medium transition-colors"
            >
              <Facebook className="w-5 h-5 text-blue-500" />
              <span>Facebook</span>
            </motion.button>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => onNavigate('register')}
              className="text-sm text-purple-200/40 hover:text-amber-400 transition-colors font-medium"
            >
              Henüz hesabın yok mu? Kayıt ol
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
