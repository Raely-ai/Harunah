import React, { useRef, useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import { socialService } from '../lib/socialService';
import { uploadPhoto } from '../lib/uploadService';
import { toast } from 'sonner';

interface PhotoGalleryProps {
  photos: string[];
  uid: string;
}

export default function PhotoGallery({ photos, uid }: PhotoGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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
    const newPhotos = photos.filter((_, i) => i !== index);
    await socialService.updateSocialField(uid, 'photos', newPhotos);
  };

  const handleDragStart = (index: number) => {
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
            draggable={!!photos[i]}
            onDragStart={() => handleDragStart(i)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(i)}
          >
            {photos[i] ? (
              <>
                <img src={photos[i]} className="w-full h-full object-cover pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                
                {/* Drag Handle Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10 cursor-grab active:cursor-grabbing">
                  <GripVertical className="text-white w-6 h-6 drop-shadow-md" />
                </div>

                <button 
                  onClick={() => handleRemove(i)} 
                  className="absolute top-2 right-2 w-6 h-6 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center text-white border border-white/30 hover:bg-red-500 hover:border-red-600 transition-all z-10"
                >
                  <X size={12} />
                </button>

                {i === 0 && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-indigo-600 rounded-md">
                    <span className="text-[8px] font-black text-white uppercase tracking-wider">Kapak</span>
                  </div>
                )}
              </>
            ) : (
              <button 
                onClick={() => !isUploading && fileInputRef.current?.click()} 
                className={`w-full h-full flex flex-col items-center justify-center gap-2 transition-colors ${isUploading ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-100'}`}
                disabled={isUploading}
              >
                <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                  <Plus size={16} className="text-slate-400" />
                </div>
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
    </div>
  );
}
