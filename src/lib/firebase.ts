import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider } from "firebase/auth";
import { initializeFirestore, memoryLocalCache, doc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import firebaseConfig from "../../firebase-applet-config.json";

console.log("Firebase config loaded:", firebaseConfig);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Initialize Firestore with specific settings to stabilize connection
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(), // Disable offline persistence
  experimentalForceLongPolling: true // Stabilize network connection in restricted environments
}, firebaseConfig.firestoreDatabaseId);

console.log("Firestore initialized with databaseId:", firebaseConfig.firestoreDatabaseId);

// Test connection on boot
async function testConnection() {
  try {
    console.log("Testing Firestore connection (test/connection)...");
    await getDoc(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful via test/connection");
  } catch (error) {
    console.warn("test/connection failed, trying config/general...", error);
    try {
      await getDoc(doc(db, 'config', 'general'));
      console.log("Firestore connection successful via config/general");
    } catch (innerError) {
      if(innerError instanceof Error && innerError.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. The client is offline.");
      } else {
        console.error("Firestore connection test error (all attempts failed):", innerError);
      }
    }
  }
}
testConnection();

export const storage = getStorage(app);
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
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = errorMessage.includes('Quota limit exceeded') || errorMessage.includes('Quota exceeded');

  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
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

  if (isQuotaError) {
    console.warn('Firestore Quota Exceeded (Graceful):', path);
    // We don't throw here to allow the app to continue rendering what it can
    // The App.tsx will detect the quota error via its own effects if needed
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
