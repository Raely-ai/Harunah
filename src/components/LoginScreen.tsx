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
  signInWithEmailAndPassword,
  signInWithCredential,
  GoogleAuthProvider
} from "firebase/auth";
import { auth, googleProvider, facebookProvider } from "../lib/firebase";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';

interface LoginScreenProps {
  onNavigate: (screen: 'register' | 'forgot-password' | 'welcome') => void;
}

export default function LoginScreen({ onNavigate }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Auth on component mount or just before using
  const isCapacitor = typeof window !== 'undefined' && !!(window as any).Capacitor;

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
      if (isCapacitor) {
        console.log("Capacitor detected, initializing GoogleAuth");
        await GoogleAuth.initialize({
          clientId: "654177015558-g6l7388u1ojt3qgera25kj5d5eq126lv.apps.googleusercontent.com",
          scopes: ["profile", "email"],
          grantOfflineAccess: true
        });
        console.log("GoogleAuth.initialize done");

        console.log("Calling GoogleAuth.signIn()");
        const googleUser = await GoogleAuth.signIn();
        console.log("GoogleAuth result:", googleUser);
        
        if (googleUser && googleUser.authentication && googleUser.authentication.idToken) {
            console.log("idToken found, creating credential");
            const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
            
            console.log("signInWithCredential starting");
            const result = await signInWithCredential(auth, credential);
            console.log("signInWithCredential success:", result.user.uid, result.user.email);
            console.log("native google login success");
        } else {
            console.log("idToken NOT found in response. Response:", googleUser);
            throw new Error("No idToken found in Google response.");
        }
      } else {
         setError("Web üzerinden Google girişi şu an desteklenmiyor.");
      }
    } catch (err: any) {
      console.log("google login error:", err);
      if (err.code || err.message) {
        console.log("Detailed error info:", err.code, err.message);
      }
      setError(err.message || "Google ile giriş yapılamadı.");
    } finally {
      setSocialLoading(false);
    }
  };

  const handleFacebookAuth = async () => {
    setError("Facebook ile giriş şu an Capacitor üzerinde desteklenmiyor. Lütfen Google veya E-posta kullanın.");
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
          onClick={() => onNavigate('welcome')}
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
            Hoş Geldin
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            Kaldığın yerden devam et.
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100/50">
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

          <form onSubmit={handleEmailAuth} className="space-y-5">
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

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[13px] font-medium text-slate-500">Şifre</label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-[12px] text-slate-400 hover:text-slate-800 transition-colors font-medium"
                >
                  Unuttum
                </button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-300 group-focus-within:text-[#A855F7]/80 transition-colors" />
                </div>
                <input
                  type="password"
                  placeholder="Şifreniz"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#FAFAFA] border border-slate-200 rounded-2xl py-4 pl-12 pr-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#A855F7]/30 focus:bg-white focus:ring-4 focus:ring-[#A855F7]/5 transition-all duration-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]"
                  required
                />
              </div>
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={emailLoading || socialLoading}
              className="w-full py-4.5 mt-8 rounded-2xl bg-slate-900 text-white font-semibold text-[15px] hover:shadow-[0_8px_25px_rgba(15,23,42,0.2)] transition-all flex items-center justify-center gap-2 disabled:opacity-70 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              {emailLoading ? (
                <Loader2 className="w-5 h-5 animate-spin relative z-10" />
              ) : (
                <span className="relative z-10 flex items-center gap-2">
                  Giriş Yap <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                </span>
              )}
            </motion.button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider text-slate-400 font-medium">
              <span className="bg-white px-4">VEYA</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleGoogleAuth}
              disabled={emailLoading || socialLoading}
              className="flex items-center justify-center gap-3 py-3.5 rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {socialLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <>
                  <Chrome className="w-4 h-4 text-slate-700" />
                  <span className="text-[14px] font-semibold text-slate-700">Google</span>
                </>
              )}
            </button>
            <button
              onClick={handleFacebookAuth}
              disabled={emailLoading || socialLoading}
              className="flex items-center justify-center gap-3 py-3.5 rounded-2xl border border-slate-200 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {socialLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <>
                  <Facebook className="w-4 h-4 text-[#1877F2]" />
                  <span className="text-[14px] font-semibold text-slate-700">Facebook</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => onNavigate('register')}
            className="text-[13px] text-slate-500"
          >
            Hesabınız yok mu? <span className="text-[#0F172A] font-medium ml-1 hover:text-[#A855F7] transition-colors">Kayıt Ol</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
