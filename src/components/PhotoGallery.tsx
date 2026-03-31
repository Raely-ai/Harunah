import React, { useRef } from 'react';
import { Plus, X } from 'lucide-react';
import { updateSocialField } from '../services/socialService';
import { uploadPhoto } from '../lib/uploadService';

interface PhotoGalleryProps {
  photos: string[];
  uid: string;
}

export default function PhotoGallery({ photos, uid }: PhotoGalleryProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const url = await uploadPhoto(file, uid);
        const newPhotos = [...photos, url];
        await updateSocialField(uid, 'photos', newPhotos);
      } catch (error) {
        console.error("Error uploading photo:", error);
      }
    }
  };
  
  const handleRemove = async (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    await updateSocialField(uid, 'photos', newPhotos);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="aspect-square bg-slate-100 rounded-xl overflow-hidden relative border border-slate-200">
          {photos[i] ? (
            <>
              <img src={photos[i]} className="w-full h-full object-cover" />
              <button onClick={() => handleRemove(i)} className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white">
                <X size={12} />
              </button>
            </>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="w-full h-full flex items-center justify-center text-slate-400">
              <Plus size={24} />
            </button>
          )}
        </div>
      ))}
      <input type="file" ref={fileInputRef} onChange={handleAdd} className="hidden" accept="image/*" />
    </div>
  );
}
