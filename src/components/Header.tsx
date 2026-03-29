import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export default function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-8 px-4 text-center"
    >
      <div className="relative mb-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-amber-500/20 rounded-full blur-xl"
        />
        <div className="relative bg-black/40 p-4 rounded-full border border-amber-500/30 backdrop-blur-md">
          <Sparkles className="w-10 h-10 text-amber-400" />
        </div>
      </div>
      <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-amber-100 mb-2">
        Falcı Ahlas
      </h1>
      <p className="text-sm md:text-base text-purple-200/60 font-medium tracking-widest uppercase">
        Geleceğin Fısıltısı, Ruhun Aynası
      </p>
    </motion.header>
  );
}
