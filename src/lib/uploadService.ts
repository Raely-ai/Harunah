import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export const uploadPhoto = async (file: File, userId: string): Promise<string> => {
  const path = `profiles/${userId}/${Date.now()}_${file.name}`;
  console.log("Attempting upload to:", path);
  const storageRef = ref(storage, path);
  
  try {
    await uploadBytes(storageRef, file);
    console.log("Upload bytes successful");
  } catch (error) {
    console.error("Upload bytes failed:", error);
    throw error;
  }

  try {
    const url = await getDownloadURL(storageRef);
    console.log("Get download URL successful:", url);
    return url;
  } catch (error) {
    console.error("Get download URL failed:", error);
    throw error;
  }
};

export const deletePhotoByUrl = async (url: string): Promise<void> => {
  if (!url) return;
  
  // Skip deletion if it's not a Firebase Storage URL (e.g. external Google photo)
  const isStorageUrl = url.includes('firebasestorage.googleapis.com') || 
                       url.includes('storage.googleapis.com') || 
                       url.startsWith('gs://');
                       
  if (!isStorageUrl) {
    console.log("Skipping storage deletion for non-storage URL:", url);
    return;
  }

  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
    console.log("Storage photo deleted successfully:", url);
  } catch (error: any) {
    // If it's a 404 (not found), we can consider it "deleted" anyway
    if (error.code === 'storage/object-not-found') {
      console.warn("Photo not found in storage, skipping deletion:", url);
      return;
    }
    console.error("Error deleting photo from storage:", error);
    throw error;
  }
};
