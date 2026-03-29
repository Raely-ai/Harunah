import { motion } from "motion/react";
import { Users, MessageCircle, Sparkles, ArrowRight, X } from "lucide-react";

interface SocialWelcomeScreenProps {
  onContinue: (choice: 'social' | 'chat' | 'discovery') => void;
  onBack: () => void;
}

export default function SocialWelcomeScreen({ onContinue, onBack }: SocialWelcomeScreenProps) {
  const choices = [
    { 
      id: 'social', 
      label: 'Yeni insanlar tanımak', 
      icon: Users, 
      desc: 'Sosyal çevreni genişlet ve yeni bağlar kur.',
    },
    { 
      id: 'chat', 
      label: 'Sohbet etmek', 
      icon: MessageCircle, 
      desc: 'Derin sohbetlere katıl ve fikirlerini paylaş.',
    },
    { 
      id: 'discovery', 
      label: 'Sosyal vakit geçirmek', 
      icon: Sparkles, 
      desc: 'Eğlenceli odalarda kaliteli zaman geçir.',
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col social-theme">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-zinc-50 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[80%] h-[80%] bg-zinc-50 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="relative px-6 pt-12 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-zinc-900">Ahlas Social</span>
        </div>
        <button 
          onClick={onBack}
          className="p-2 rounded-full bg-zinc-50 text-zinc-400 hover:text-zinc-900 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-12 pb-8 overflow-y-auto relative">
        <div className="space-y-4 mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold tracking-tight text-zinc-900 leading-[1.1]"
          >
            Yeni bir sosyal<br />deneyime hazır mısın?
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-500 text-lg leading-relaxed max-w-[300px]"
          >
            Gerçek insanlarla güvenli bir ortamda tanışın ve sohbet edin.
          </motion.p>
        </div>

        <div className="space-y-4">
          {choices.map((choice, index) => (
            <motion.button
              key={choice.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              onClick={() => onContinue(choice.id as any)}
              className="w-full p-6 rounded-[2rem] bg-zinc-50 border border-zinc-100 flex items-center gap-5 group hover:bg-white hover:border-zinc-200 hover:shadow-xl hover:shadow-zinc-200/20 transition-all duration-500"
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-zinc-100 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-500">
                <choice.icon className="w-6 h-6 text-zinc-900" strokeWidth={1.5} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-zinc-900 text-base mb-1">{choice.label}</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">{choice.desc}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white border border-zinc-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-4 h-4 text-zinc-900" />
              </div>
            </motion.button>
          ))}
        </div>

        <div className="mt-auto pt-12 text-center">
          <p className="text-[10px] text-zinc-300 uppercase tracking-[0.3em] font-bold">Premium Social Circle</p>
        </div>
      </div>
    </div>
  );
}
