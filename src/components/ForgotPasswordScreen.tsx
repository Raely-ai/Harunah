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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FAFAFA] relative overflow-hidden">
      {/* Soft Brand Auroras */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-400/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-amber-400/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[400px] relative z-10"
      >
        <button
          type="button"
          onClick={() => onNavigate('login')}
          className="absolute -top-16 left-0 p-3 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-800 z-20 flex items-center gap-1"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium pr-2">Geri</span>
        </button>

        <div className="flex flex-col items-center text-center mb-10 mt-4">
          <div className="relative w-20 h-20 flex items-center justify-center mb-6 drop-shadow-sm mx-auto">
            <div className="absolute -inset-6 bg-gradient-to-tr from-purple-500/15 to-amber-500/15 blur-[20px] rounded-full" />
            <img 
              src="/assets/logo.png" 
              alt="LASYA Logo" 
              className="w-full h-full object-contain relative z-10"
            />
          </div>
          <h2 className="text-2xl font-serif text-slate-900 mb-2 font-bold tracking-tight">
            Şifremi Unuttum
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            Sıfırlama bağlantısı için e-postanızı girin
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50">
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-8"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="p-5 rounded-2xl bg-green-50/50 border border-green-100">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-lg text-slate-800">Bağlantı Gönderildi</p>
                  <p className="text-slate-500 text-[13px] font-light">Lütfen e-posta kutunuzu kontrol edin.</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('login')}
                className="w-full py-4.5 mt-8 rounded-2xl bg-slate-900 text-white font-semibold text-[15px] hover:shadow-[0_8px_25px_rgba(15,23,42,0.2)] transition-all flex items-center justify-center relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <span className="relative z-10 flex items-center gap-2">
                  Giriş Ekranına Dön
                </span>
              </button>
            </motion.div>
          ) : (
            <>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-8 p-4 rounded-xl bg-red-50/50 border border-red-100 flex items-start gap-3 text-red-600 text-sm"
                >
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p className="font-light leading-relaxed">{error}</p>
                </motion.div>
              )}

              <form onSubmit={handleReset} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-slate-500 ml-1">E-posta</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="w-5 h-5 text-slate-300 group-focus-within:text-[#A855F7]/80 transition-colors" />
                    </div>
                    <input
                      type="email"
                      placeholder="E-posta adresiniz"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#FAFAFA] border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#A855F7]/30 focus:bg-white focus:ring-4 focus:ring-[#A855F7]/5 transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                      required
                    />
                  </div>
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={loading}
                  className="w-full py-4.5 mt-8 rounded-2xl bg-slate-900 text-white font-semibold text-[15px] hover:shadow-[0_8px_25px_rgba(15,23,42,0.2)] transition-all flex items-center justify-center gap-2 disabled:opacity-70 relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                  ) : (
                    <span className="relative z-10 flex items-center gap-2">
                      Bağlantı Gönder <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                    </span>
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
