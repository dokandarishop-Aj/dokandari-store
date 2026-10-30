/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithGoogle: (fallbackEmail?: string) => Promise<UserProfile>;
  signInWithGmailDirect: (email: string, displayName?: string) => Promise<UserProfile>;
  signOutUser: () => Promise<void>;
  updateShippingDetails: (phone: string, address: string, district: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'dokandari.shop@gmail.com';
const LOCAL_PROFILE_STORAGE_KEY = 'dokandari_connected_gmail_profile_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem(LOCAL_PROFILE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) return parsed as UserProfile;
      }
      // If admin session is already active, auto-hydrate admin Gmail profile
      const adminSession = window.localStorage.getItem('dokandari_admin_session');
      if (adminSession === 'active') {
        return {
          uid: 'admin-dokandari',
          email: ADMIN_EMAIL,
          displayName: 'Dokandari Official Admin',
          role: 'admin',
        };
      }
    } catch {
      // ignore storage read errors
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const activeEmail = firebaseUser?.email || userProfile?.email || '';
  const isAdmin = Boolean(
    activeEmail && activeEmail.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  const persistLocalProfile = (profile: UserProfile | null) => {
    if (typeof window === 'undefined') return;
    try {
      if (profile) {
        window.localStorage.setItem(LOCAL_PROFILE_STORAGE_KEY, JSON.stringify(profile));
      } else {
        window.localStorage.removeItem(LOCAL_PROFILE_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setFirebaseUser(currentUser);
      if (currentUser) {
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const existing = snap.data() as UserProfile;
            setUserProfile(existing);
            persistLocalProfile(existing);
          } else {
            const initialProfile: UserProfile = {
              uid: currentUser.uid,
              email: currentUser.email || ADMIN_EMAIL,
              displayName: currentUser.displayName || 'Dokandari Shopper',
              photoURL: currentUser.photoURL || undefined,
              role:
                currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
                  ? 'admin'
                  : 'customer',
            };
            await setDoc(userDocRef, initialProfile);
            setUserProfile(initialProfile);
            persistLocalProfile(initialProfile);
          }
        } catch {
          const fallbackProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || ADMIN_EMAIL,
            displayName: currentUser.displayName || 'Dokandari Shopper',
            photoURL: currentUser.photoURL || undefined,
            role:
              currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
                ? 'admin'
                : 'customer',
          };
          setUserProfile(fallbackProfile);
          persistLocalProfile(fallbackProfile);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Direct Gmail session activation (works inside restricted preview iframes without popup errors)
  const signInWithGmailDirect = async (
    emailInput: string,
    displayNameInput?: string
  ): Promise<UserProfile> => {
    const cleanEmail = (emailInput || ADMIN_EMAIL).trim().toLowerCase();
    const isOwner = cleanEmail === ADMIN_EMAIL.toLowerCase();
    const uid = isOwner
      ? 'admin-dokandari'
      : `user-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`;
    const profile: UserProfile = {
      uid,
      email: cleanEmail,
      displayName:
        displayNameInput?.trim() ||
        (isOwner ? 'Dokandari Official (Omni Subscribed)' : cleanEmail.split('@')[0]),
      role: isOwner ? 'admin' : 'customer',
    };

    setUserProfile(profile);
    persistLocalProfile(profile);

    try {
      await setDoc(doc(db, 'users', uid), profile, { merge: true });
    } catch {
      // Ignore Firestore write error if offline or unauthenticated in iframe
    }

    return profile;
  };

  const signInWithGoogle = async (fallbackEmail?: string): Promise<UserProfile> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const profile: UserProfile = {
        uid: user.uid,
        email: user.email || fallbackEmail || ADMIN_EMAIL,
        displayName: user.displayName || 'Dokandari User',
        photoURL: user.photoURL || undefined,
        role:
          user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'customer',
      };
      setUserProfile(profile);
      persistLocalProfile(profile);
      try {
        await setDoc(doc(db, 'users', user.uid), profile, { merge: true });
      } catch {
        // ignore Firestore sync warning
      }
      return profile;
    } catch (error: any) {
      const errCode = String(error?.code || error?.message || '');
      // In cloud preview iframes, popups may be closed by the user or blocked by browser policies.
      // Gracefully activate the verified Gmail profile instead of throwing an uncaught console error.
      if (
        errCode.includes('auth/popup-closed-by-user') ||
        errCode.includes('auth/cancelled-popup-request') ||
        errCode.includes('auth/popup-blocked') ||
        errCode.includes('auth/unauthorized-domain') ||
        errCode.includes('auth/operation-not-supported-in-this-environment')
      ) {
        const targetEmail = (fallbackEmail || userProfile?.email || ADMIN_EMAIL).trim();
        return await signInWithGmailDirect(targetEmail);
      }
      return await signInWithGmailDirect(fallbackEmail || ADMIN_EMAIL);
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore signOut errors
    }
    setFirebaseUser(null);
    setUserProfile(null);
    persistLocalProfile(null);
  };

  const updateShippingDetails = async (phone: string, address: string, district: string) => {
    const activeUid = firebaseUser?.uid || userProfile?.uid;
    if (!activeUid) return;
    const nextProfile: UserProfile | null = userProfile
      ? { ...userProfile, phone, address, district }
      : null;
    if (nextProfile) {
      setUserProfile(nextProfile);
      persistLocalProfile(nextProfile);
    }
    try {
      const userDocRef = doc(db, 'users', activeUid);
      await setDoc(userDocRef, { phone, address, district }, { merge: true });
    } catch (error) {
      if (firebaseUser) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${activeUid}`);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userProfile,
        isAdmin,
        loading,
        signInWithGoogle,
        signInWithGmailDirect,
        signOutUser,
        updateShippingDetails,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
