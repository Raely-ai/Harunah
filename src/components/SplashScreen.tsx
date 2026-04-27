import { useEffect } from "react";

export default function SplashScreen() {
  return (
    /* Lüks Kırık Beyaz Arka Plan - UX akışı için korunuyor */
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FAFAFA]">
      <div className="flex flex-col items-center justify-center">
        
        {/* LASYA Logo - Şeffaf PNG logonu buraya koymalısın */}
        <div className="w-40 h-40 flex items-center justify-center drop-shadow-sm">
          <img 
            src="/assets/logo.png" 
            alt="LASYA Logo" 
            className="w-full h-full object-contain"
          />
        </div>

        {/* MARKA TİPOGRAFİSİ (Logonun Renkleriyle Uyumlu) */}
        <div className="mt-8 flex flex-col items-center">
          
          {/* Ana İsim - Jilet gibi ince fontta LOGONUN CANLI GRADIENT RENKLERİ */}
          {/* text-transparent bg-clip-text ile logodaki mor ve pembe geçişini yazıya verdik */}
          <h1 className="text-4xl font-serif font-thin tracking-[0.5em] uppercase bg-gradient-to-r from-[#A855F7] to-[#EC4899] inline-block text-transparent bg-clip-text ml-3">
            LASYA
          </h1>
          
          {/* Alt Slogan (Tagline) - Çok daha zarif, daha geniş aralıklı ve subtle bir renk */}
          <span className="mt-3 text-[10px] font-sans font-medium tracking-[0.9em] text-[#A6A6B1] uppercase ml-2">
            Astroloji & Uyum
          </span>
        </div>

      </div>
    </div>
  );
}