import { useState } from "react";
import { motion } from "motion/react";
import { 
  Mail, 
  ArrowRight, 
  Sparkles, 
  Loader2,
  AlertCircle,
  ChevronLeft,
  CheckCircle2
} from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../lib/firebase";

interface ForgotPasswordScreenProps {
  onNavigate: (screen: 'login') => void;
}

export default function ForgotPasswordScreen({ onNavigate }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Sıfırlama e-postası gönderilemedi.");
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
          onClick={() => onNavigate('login')}
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
              Şifremi Unuttum
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              E-posta adresini gir, sana bir sıfırlama bağlantısı gönderelim.
            </p>
          </div>

          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="p-6 rounded-full bg-amber-50 border border-amber-100">
                  <CheckCircle2 className="w-12 h-12 text-amber-600" />
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-xl text-slate-900">Bağlantı Gönderildi</p>
                  <p className="text-slate-500 text-sm">Lütfen e-posta kutunu kontrol et.</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('login')}
                className="w-full py-4.5 rounded-2xl bg-slate-900 text-white font-semibold shadow-lg shadow-slate-200 transition-all"
              >
                Giriş Ekranına Dön
              </button>
            </motion.div>
          ) : (
            <>
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

              <form onSubmit={handleReset} className="space-y-6">
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

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={loading}
                  className="w-full py-4.5 rounded-2xl bg-slate-900 text-white font-semibold shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>Bağlantı Gönder</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
