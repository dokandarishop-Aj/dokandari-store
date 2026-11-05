/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  Firestore,
  doc,
  getDoc,
  setLogLevel,
  memoryLocalCache,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence internal @firebase/firestore WebChannel probe timeout logs so transient network jitter
// or proxy fallback negotiation never triggers false-alarm console.error overlays.
try {
  setLogLevel('silent');
} catch {
  // ignore
}

// Clean up any stale cached Firebase Auth tokens in localStorage/IndexedDB that trigger
// securetoken.googleapis.com refresh errors if Token Service API is not enabled.
if (typeof window !== 'undefined') {
  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith('firebase:authUser:') || key.startsWith('firebase:host:')) {
        window.localStorage.removeItem(key);
      }
    });
    if (window.indexedDB && typeof window.indexedDB.deleteDatabase === 'function') {
      window.indexedDB.deleteDatabase('firebaseLocalStorageDb');
    }
  } catch {
    // Ignore storage cleanup errors in restricted iframes
  }
}

// Primary Firebase app for Authentication & Firestore
export const app =
  getApps().find((a) => a.name === '[DEFAULT]') || initializeApp(firebaseConfig);

// Initialize Firestore with explicit database ID, in-memory cache (avoids cross-tab IndexedDB locks),
// and automatic long-polling fallback for iframe/proxy environments.
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache(),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}
export const db = firestoreInstance;

// Initialize Authentication with in-memory persistence to avoid stale token refresh loops
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: inMemoryPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Operation types for hardened error logging
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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Standardized Firestore error handler adhering to Firebase integration specification
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Operation Note: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validates initial connection to Firestore on app startup without blocking primary catalog listeners
 */
export async function testConnection(): Promise<boolean> {
  try {
    await getDoc(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connection operating in local cache mode temporarily.');
    }
    return false;
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    testConnection().catch(() => null);
  }, 2000);
}

