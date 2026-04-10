import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";
import { initializeFirestore, memoryLocalCache, doc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app, "europe-west2");

// Initialize Firestore with specific settings to stabilize connection
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(), // Disable offline persistence
  experimentalForceLongPolling: true // Stabilize network connection in restricted environments
}, firebaseConfig.firestoreDatabaseId);

// Minimal connection test for stability
async function verifyConnection() {
  try {
    await getDoc(doc(db, 'config', 'global'));
    console.log("Firebase connection verified.");
  } catch (error) {
    console.warn("Firebase connection verification failed:", error);
  }
}
verifyConnection();

export const storage = getStorage(app);

/**
 * Uploads a base64 string to Firebase Storage and returns the download URL.
 */
export async function uploadBase64Image(base64: string, path: string): Promise<string> {
  const { ref, uploadString, getDownloadURL } = await import("firebase/storage");
  const storageRef = ref(storage, path);
  
  // Handle data:image/jpeg;base64, prefix if present
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
  
  await uploadString(storageRef, base64Data, 'base64');
  return getDownloadURL(storageRef);
}

export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

// Error handling helper
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
