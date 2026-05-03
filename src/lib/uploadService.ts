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
  try {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
    console.log("Storage photo deleted successfully:", url);
  } catch (error) {
    console.error("Error deleting photo from storage:", error);
    // Even if storage deletion fails (e.g. file already gone), we might want to continue
    // but here we throw to let the caller know if they want to stop Firestore update
    throw error;
  }
};
