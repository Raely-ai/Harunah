import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505] overflow-hidden"
    >
      {/* Background Graphics */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="celestial-bg" />
        
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(109,40,217,0.15)_0%,transparent_70%)] rounded-full blur-[120px]"
        />
        
        {/* Animated Stars */}
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000), 
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000),
              opacity: 0,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              opacity: [0, 1, 0],
              scale: [0.5, 1.2, 0.5]
            }}
            transition={{ 
              duration: 3 + Math.random() * 4, 
              repeat: Infinity,
              delay: Math.random() * 5
            }}
            className="absolute w-0.5 h-0.5 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]"
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0, filter: "blur(20px)" }}
          animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="relative mb-12"
        >
          {/* Outer Glow */}
          <motion.div
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-[-40px] bg-amber-500/10 rounded-full blur-3xl"
          />
          
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-purple-600/20 rounded-full blur-xl animate-pulse" />
            <div className="relative bg-black/60 p-10 rounded-full border border-white/10 backdrop-blur-3xl shadow-[0_0_50px_rgba(212,175,55,0.1)]">
              <Sparkles className="w-20 h-20 text-amber-400 drop-shadow-[0_0_15px_rgba(212,175,55,0.8)]" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 1.2, ease: "easeOut" }}
          className="text-center"
        >
          <h1 className="text-6xl md:text-8xl font-serif font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-400 to-amber-100 mb-6 drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            Falcı Ahlas
          </h1>
          
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "140px", opacity: 1 }}
            transition={{ delay: 1.5, duration: 1.5 }}
            className="h-[1px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent mx-auto mb-6 shadow-[0_0_10px_rgba(212,175,55,0.5)]"
          />
          
          <p className="text-sm md:text-base text-zinc-500 font-medium tracking-[0.4em] uppercase">
            Kaderin Fısıltısı
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
