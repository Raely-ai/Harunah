import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, Upload, Sparkles, X, Loader2 } from "lucide-react";
import Markdown from "react-markdown";
import { getCoffeeFortune } from "../services/geminiService";

interface CoffeeFortuneProps {
  onClose: () => void;
}

export default function CoffeeFortune({ onClose }: CoffeeFortuneProps) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGetReading = async () => {
    if (!image) return;
    setLoading(true);
    try {
      const result = await getCoffeeFortune(image);
      setReading(result.text);
    } catch (error) {
      console.error("Error getting coffee fortune:", error);
      setReading("Üzgünüm, fincanı tam okuyamadım. Tekrar dener misin?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-amber-500/30 bg-black/60 shadow-2xl shadow-purple-500/20 p-8">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 transition-colors text-amber-100/50 hover:text-amber-100"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="p-4 rounded-full bg-amber-500/10 mb-4">
            <Camera className="w-10 h-10 text-amber-400" />
          </div>
          <h2 className="text-3xl font-serif font-bold text-amber-50 mb-2">Kahve Falı</h2>
          <p className="text-purple-200/60 font-medium">Fincanının ve tabağının fotoğrafını yükle, Ahlas senin için yorumlasın.</p>
        </div>

        {!reading ? (
          <div className="space-y-8">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative aspect-square md:aspect-video rounded-2xl border-2 border-dashed border-amber-500/20 hover:border-amber-500/40 transition-colors cursor-pointer flex flex-col items-center justify-center overflow-hidden group"
            >
              {image ? (
                <img src={image} alt="Coffee cup" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="flex flex-col items-center gap-4 text-amber-500/40 group-hover:text-amber-500/60 transition-colors">
                  <Upload className="w-12 h-12" />
                  <span className="text-sm font-medium uppercase tracking-widest">Fotoğraf Yükle</span>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleGetReading}
              disabled={!image || loading}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-lg shadow-lg shadow-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Fincan Okunuyor...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-6 h-6" />
                  <span>Falıma Bak</span>
                </>
              )}
            </motion.button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="prose prose-invert prose-amber max-w-none bg-white/5 p-8 rounded-2xl border border-white/10"
          >
            <div className="flex items-center gap-3 mb-6 text-amber-400">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-widest">Ahlas'ın Yorumu</span>
            </div>
            <div className="text-purple-50/90 leading-relaxed font-serif text-lg">
              <Markdown>{reading}</Markdown>
            </div>
            <button
              onClick={() => {
                setReading(null);
                setImage(null);
              }}
              className="mt-8 w-full py-3 rounded-xl border border-amber-500/30 text-amber-100 hover:bg-amber-500/10 transition-colors font-bold uppercase tracking-widest text-sm"
            >
              Yeni Fal Baktır
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
