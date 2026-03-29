import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0510] overflow-hidden"
    >
      {/* Background Graphics */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            rotate: [0, 90, 180, 270, 360]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-to-tr from-purple-900/20 via-transparent to-amber-900/20 rounded-full blur-[100px]"
        />
        
        {/* Animated Particles */}
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              opacity: 0 
            }}
            animate={{ 
              y: [null, Math.random() * -100],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 2 + Math.random() * 3, 
              repeat: Infinity,
              delay: Math.random() * 2
            }}
            className="absolute w-1 h-1 bg-amber-400 rounded-full"
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="relative mb-8"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl"
          />
          <div className="relative bg-black/40 p-8 rounded-full border border-amber-500/30 backdrop-blur-xl">
            <Sparkles className="w-16 h-16 text-amber-400" />
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="text-center"
        >
          <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tighter text-amber-100 mb-4">
            Falcı Ahlas
          </h1>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ delay: 1, duration: 1.5 }}
            className="h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent mb-4"
          />
          <p className="text-sm md:text-base text-purple-200/40 font-medium tracking-[0.3em] uppercase">
            Geleceğin Fısıltısı
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
