import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export default function Header() {
  return (
    <header className="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div className="relative mb-4">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-amber-500/20 rounded-full blur-xl" />
          <img 
            src="/logo.svg" 
            alt="LASYA Logo" 
            className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_10px_rgba(212,175,55,0.3)]"
          />
        </div>
      </div>
      <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight text-amber-100 mb-2">
        LASYA
      </h1>
      <p className="text-sm md:text-base text-purple-200/60 font-medium tracking-widest uppercase">
        Geleceğin Fısıltısı, Ruhun Aynası
      </p>
    </header>
  );
}
