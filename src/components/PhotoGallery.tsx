import React, { useRef, useState } from 'react';
import { Plus, X, GripVertical, Star, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { socialService } from '../lib/socialService';
import { uploadPhoto, deletePhotoByUrl } from '../lib/uploadService';
import { toast } from 'sonner';

interface PhotoGalleryProps {
  photos: string[];
  uid: string;
  isPreviewMode?: boolean;
}

export default function PhotoGallery({ photos, uid, isPreviewMode }: PhotoGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  const handleAdd = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const url = await uploadPhoto(file, uid);
        const newPhotos = [...photos, url];
        if (newPhotos.length > 6) {
          toast.error("En fazla 6 fotoğraf ekleyebilirsin.");
          return;
        }
        await socialService.updateSocialField(uid, 'photos', newPhotos);
      } catch (error) {
        console.error("Error uploading photo:", error);
        toast.error("Fotoğraf yüklenemedi.");
      } finally {
        setIsUploading(false);
      }
    }
  };
  
  const handleRemove = async (index: number) => {
    const urlToDelete = photos[index];
    if (!urlToDelete) return;

    if (!window.confirm("Bu fotoğrafı silmek istiyor musun?")) return;
    
    const toastId = toast.loading("Fotoğraf siliniyor...");
    try {
      // 1. Delete from Storage
      try {
        await deletePhotoByUrl(urlToDelete);
      } catch (storageError) {
        console.warn("Storage deletion failed, but proceeding to remove from database:", storageError);
        // We continue because if the photo is orphan or manually deleted, we still want it off the profile
      }

      // 2. Update Firestore
      const newPhotos = photos.filter((_, i) => i !== index);
      await socialService.updateSocialField(uid, 'photos', newPhotos);
      
      if (viewingIndex === index) setViewingIndex(null);
      
      toast.success("Fotoğraf başarıyla silindi.", { id: toastId });
    } catch (error) {
      console.error("Error in handleRemove:", error);
      toast.error("Fotoğraf silinirken bir hata oluştu.", { id: toastId });
    }
  };

  const handleSetCover = async (index: number) => {
    if (index === 0) return;
    const newPhotos = [...photos];
    const [selectedPhoto] = newPhotos.splice(index, 1);
    newPhotos.unshift(selectedPhoto);
    await socialService.updateSocialField(uid, 'photos', newPhotos);
    if (viewingIndex !== null) setViewingIndex(0); // Update viewing index to 0 as it's now first
    toast.success("Kapak fotoğrafı güncellendi.");
  };

  const handleDragStart = (index: number) => {
    if (isPreviewMode) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newPhotos = [...photos];
    const [movedItem] = newPhotos.splice(draggedIndex, 1);
    newPhotos.splice(targetIndex, 0, movedItem);
    
    setDraggedIndex(null);
    await socialService.updateSocialField(uid, 'photos', newPhotos);
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i} 
            className={`
              aspect-[3/4] rounded-2xl overflow-hidden relative transition-all duration-300
              ${photos[i] ? 'bg-slate-200 ring-1 ring-slate-100 shadow-sm' : 'bg-slate-50 border-2 border-dashed border-slate-200'}
              ${draggedIndex === i ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}
            `}
            draggable={!!photos[i] && !isPreviewMode}
            onDragStart={() => handleDragStart(i)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(i)}
            onClick={() => photos[i] && setViewingIndex(i)}
          >
            {photos[i] ? (
              <>
                <img src={photos[i]} className="w-full h-full object-cover pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                
                {/* Actions Overlay (Desktop only hint, mobile uses tap to open) */}
                {!isPreviewMode && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 cursor-pointer">
                    <Star className="text-white/80 w-6 h-6 mb-1 drop-shadow-md" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest bg-black/40 px-2 py-0.5 rounded-full">Görüntüle</span>
                  </div>
                )}

                {!isPreviewMode && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(i);
                    }} 
                    className="absolute top-2 right-2 w-7 h-7 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/30 hover:bg-red-500 hover:border-red-600 transition-all z-10"
                  >
                    <X size={14} />
                  </button>
                )}

                {i === 0 && (
                  <div className="absolute bottom-0 inset-x-0 bg-indigo-600/90 backdrop-blur-sm py-1.5 flex flex-col items-center justify-center border-t border-indigo-400">
                    <span className="text-[8px] font-black text-white uppercase tracking-wider mb-0.5">Kapak Fotoğrafı</span>
                    <span className="text-[7px] font-bold text-white/70 uppercase tracking-[0.1em]">En çok görünen fotoğrafın</span>
                  </div>
                )}
              </>
            ) : !isPreviewMode && (
              <button 
                onClick={() => !isUploading && fileInputRef.current?.click()} 
                className={`w-full h-full flex flex-col items-center justify-center gap-3 transition-all duration-500 ${isUploading ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-100/50 hover:border-indigo-200 group/add'}`}
                disabled={isUploading}
              >
                <div className="w-10 h-10 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm group-hover/add:scale-110 group-hover/add:rotate-90 transition-transform">
                  {isUploading ? <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /> : <Plus size={20} className="text-slate-400 group-hover/add:text-indigo-500" />}
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover/add:text-indigo-600">Fotoğraf Ekle</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAdd} 
        className="hidden" 
        accept="image/*" 
      />

      {/* FULL SCREEN PREVIEW MODAL */}
      <AnimatePresence>
        {viewingIndex !== null && photos[viewingIndex] && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6"
          >
            <button 
              onClick={() => setViewingIndex(null)}
              className="absolute top-8 right-8 w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white border border-white/10 transition-all z-50 group"
            >
              <X size={24} className="group-active:scale-95 duration-200" />
            </button>

            <motion.div 
              layoutId={`photo-${viewingIndex}`}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative w-full max-w-lg aspect-[3/4] rounded-[3rem] overflow-hidden shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10"
            >
              <img src={photos[viewingIndex]} className="w-full h-full object-cover" />
              
              {/* Cover Indicator if first photo */}
              {viewingIndex === 0 && (
                <div className="absolute top-6 left-6 px-4 py-1.5 bg-indigo-600 rounded-full border border-indigo-400/50 shadow-xl shadow-indigo-500/20">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Varsayılan Kapak Fotoğrafı</span>
                </div>
              )}
            </motion.div>

            {/* Actions Bar */}
            {!isPreviewMode && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="mt-8 flex items-center gap-4 w-full max-w-lg"
              >
                {viewingIndex !== 0 && (
                  <button 
                    onClick={() => handleSetCover(viewingIndex!)}
                    className="flex-1 bg-white text-slate-900 py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-white/5 group active:scale-95 transition-all"
                  >
                    <Star size={16} className="text-amber-500 fill-amber-500" />
                    Kapak Fotoğrafı Yap
                  </button>
                )}
                <button 
                  onClick={() => handleRemove(viewingIndex!)}
                  className={`py-4 rounded-[2rem] font-black text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 border transition-all active:scale-95 ${
                    viewingIndex === 0 
                      ? 'w-full bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20' 
                      : 'px-8 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                  }`}
                >
                  <Trash2 size={16} />
                  {viewingIndex === 0 ? 'Kapak Fotoğrafını Sil' : 'Sil'}
                </button>
              </motion.div>
            )}

            <div className="mt-8 text-center px-12">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
                {viewingIndex === 0 ? 'Bu fotoğraf senin ana profil fotoğrafın olarak görünür.' : 'Diğer kullanıcılar bu fotoğrafı galerinde görecek.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
