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
      let errorMessage = "Kayıt oluşturulamadı.";
      
      if (err.code === 'auth/operation-not-allowed') {
        errorMessage = "E-posta ile kayıt şu anda aktif değil. Lütfen Google ile giriş yapmayı deneyin.";
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = "Bu e-posta adresi zaten kullanımda.";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Geçersiz bir e-posta adresi girdiniz.";
      } else if (err.code === 'auth/weak-password') {
        errorMessage = "Şifreniz çok zayıf. En az 6 karakter kullanın.";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
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
              Aramıza Katıl
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              Kaderinin kapılarını aralamak için kayıt ol.
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

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Ad Soyad</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-slate-300 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Adın Soyadın"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-500/50 focus:bg-white focus:ring-4 focus:ring-amber-500/5 transition-all duration-200"
                  required
                />
              </div>
            </div>

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
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Şifre</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-300 group-focus-within:text-amber-500 transition-colors" />
                </div>
                <input
                  type="password"
                  placeholder="En az 6 karakter"
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
              disabled={loading}
              className="w-full py-4.5 mt-4 rounded-2xl bg-slate-900 text-white font-semibold shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>Kayıt Ol</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-10 text-center">
            <button
              onClick={() => onNavigate('login')}
              className="text-sm text-slate-500 font-medium"
            >
              Zaten hesabın var mı? <span className="text-amber-600 font-bold hover:underline underline-offset-4">Giriş yap</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
