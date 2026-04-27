import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, onAuthStateChanged, User } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
const firebaseConfig = {
  apiKey: "AIzaSyDy4qcu0_-dW1a_bml90fxeqfPZcqNy39I",
  authDomain: "lasya-app.firebaseapp.com",
  projectId: "lasya-app",
  storageBucket: "lasya-app.firebasestorage.app",
  messagingSenderId: "654177015558",
  appId: "1:654177015558:web:d16b0b23704b2b3501b087",
};

const app = initializeApp(firebaseConfig);

// Use the default database
export const db = initializeFirestore(app, { experimentalForceLongPolling: true });
export const auth = getAuth(app);
export const functions = getFunctions(app, "us-central1");

export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();

/**
 * Ensures the auth state is fully initialized.
 * Returns the User object if authenticated, or null if not.
 */
export function waitForAuth(): Promise<User | null> {
  return new Promise((resolve, reject) => {
    // If already initialized and we have a user, ensure token is ready
    if (auth.currentUser) {
      auth.currentUser.getIdToken(false)
        .then(() => resolve(auth.currentUser))
        .catch(() => resolve(auth.currentUser)); // Resolve anyway, callable will fail gracefully
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        // Force token refresh/verification to ensure it's valid for callable functions
        try {
          await user.getIdToken(true);
        } catch (e) {
          console.warn("Token initialization warning:", e);
        }
      }
      resolve(user);
    }, (error) => {
      unsubscribe();
      reject(error);
    });
  });
}

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
  const isQuotaError = errorMessage.toLowerCase().includes('quota limit exceeded') || 
                       errorMessage.toLowerCase().includes('quota exceeded');

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
