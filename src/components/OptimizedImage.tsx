import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  containerClassName?: string;
}

export default function OptimizedImage({ 
  src, 
  alt, 
  className, 
  fallback, 
  containerClassName = "",
  ...props 
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);

  useEffect(() => {
    setIsLoaded(false);
    setError(false);
    setCurrentSrc(src);
  }, [src]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setError(true);
    if (fallback) {
      setCurrentSrc(fallback);
    }
  };

  return (
    <div className={`relative overflow-hidden ${containerClassName}`}>
      {/* Skeleton / Placeholder */}
      <AnimatePresence>
        {!isLoaded && !error && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-zinc-800 animate-pulse z-10"
          />
        )}
      </AnimatePresence>

      <motion.img
        src={currentSrc}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        initial={{ opacity: 0 }}
        animate={{ opacity: isLoaded ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className={className}
        referrerPolicy="no-referrer"
        {...(props as any)}
      />

      {error && !fallback && (
        <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
          <span className="text-[10px] text-zinc-600 uppercase font-bold">Yüklenemedi</span>
        </div>
      )}
    </div>
  );
}
