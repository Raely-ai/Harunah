import { storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
