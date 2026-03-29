import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";

interface FortuneCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
  color: string;
}

export default function FortuneCard({ title, description, icon: Icon, onClick, color }: FortuneCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative w-full text-left group overflow-hidden"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${color} opacity-10 group-hover:opacity-20 transition-opacity duration-500`} />
      <div className="relative p-6 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md flex items-center gap-6">
        <div className={`p-4 rounded-xl bg-gradient-to-br ${color} text-white shadow-lg shadow-black/40`}>
          <Icon className="w-8 h-8" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-serif font-bold text-amber-50 mb-1">{title}</h3>
          <p className="text-sm text-purple-200/60 leading-relaxed font-medium">{description}</p>
        </div>
      </div>
    </motion.button>
  );
}
