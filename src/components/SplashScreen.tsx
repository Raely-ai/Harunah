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
        
        {/* Animated Stars - Reduced for performance */}
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000), 
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 1000),
              opacity: 0,
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              opacity: [0, 0.8, 0],
              scale: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 2 + Math.random() * 2, 
              repeat: Infinity,
              delay: Math.random() * 2
            }}
            className="absolute w-0.5 h-0.5 bg-white rounded-full"
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-8"
        >
          {/* Outer Glow - Simplified */}
          <div className="absolute inset-[-20px] bg-amber-500/5 rounded-full blur-2xl animate-pulse" />
          
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-lg" />
            <div className="relative bg-black/40 p-8 rounded-full border border-white/10 backdrop-blur-xl">
              <Sparkles className="w-16 h-16 text-amber-400" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-400 to-amber-100 mb-4">
            Falcı Ahlas
          </h1>
          
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "100px", opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="h-[1px] bg-amber-500/30 mx-auto mb-4"
          />
          
          <p className="text-xs md:text-sm text-zinc-500 font-medium tracking-[0.3em] uppercase">
            Kaderin Fısıltısı
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
