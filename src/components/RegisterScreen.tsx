import { useState } from "react";
import { motion } from "motion/react";
import { 
  Mail, 
  Lock, 
  User,
  ArrowRight, 
  Sparkles, 
  Loader2,
  AlertCircle,
  ChevronLeft
} from "lucide-react";
import { 
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { auth } from "../lib/firebase";

interface RegisterScreenProps {
  onNavigate: (screen: 'login' | 'welcome') => void;
}

export default function RegisterScreen({ onNavigate }: RegisterScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
    } catch (err: any) {
      setError(err.message || "Kayıt oluşturulamadı.");
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
              Aramıza Katıl
            </h2>
            <p className="text-purple-200/40 text-xs sm:text-sm font-medium">
              Kaderinin kapılarını aralamak için kayıt ol.
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

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-200/20 group-focus-within:text-amber-400 transition-colors" />
              <input
                type="text"
                placeholder="Adın Soyadın"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-purple-200/20 focus:outline-none focus:border-amber-500/40 focus:bg-white/10 transition-all"
                required
              />
            </div>
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
                  <span>Kayıt Ol</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => onNavigate('login')}
              className="text-sm text-purple-200/40 hover:text-amber-400 transition-colors font-medium"
            >
              Zaten hesabın var mı? Giriş yap
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
