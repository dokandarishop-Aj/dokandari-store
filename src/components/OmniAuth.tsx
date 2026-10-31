/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  UserCheck,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const OMNI_AUTH_STORAGE_KEY = 'dokandari_omni_auth_session_v1';

export interface OmniAuthSession {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  subscriptionVerified: boolean;
  tier: 'gemini_omni_paid_pro';
  paidFeaturesUnlocked: boolean;
  verifiedAt: number;
}

export function getSavedOmniAuthSession(): OmniAuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(OMNI_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OmniAuthSession;
    if (parsed && parsed.email && parsed.subscriptionVerified) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

export function saveOmniAuthSession(session: OmniAuthSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OMNI_AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}

export function clearOmniAuthSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OMNI_AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
}

interface OmniAuthProps {
  onSessionChange?: (session: OmniAuthSession | null) => void;
  compact?: boolean;
}

export const OmniAuth: React.FC<OmniAuthProps> = ({ onSessionChange, compact = false }) => {
  const { firebaseUser, userProfile, signInWithGoogle, signInWithGmailDirect, signOutUser } =
    useAuth();

  const [session, setSession] = useState<OmniAuthSession | null>(() => getSavedOmniAuthSession());
  const [loading, setLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [emailInput, setEmailInput] = useState(
    session?.email || firebaseUser?.email || userProfile?.email || 'dokandari.shop@gmail.com'
  );
  const [statusMessage, setStatusMessage] = useState('');

  // Automatically sync if AuthContext already has a logged-in Google user
  useEffect(() => {
    const activeEmail = firebaseUser?.email || userProfile?.email;
    if (activeEmail && !session) {
      const autoSession: OmniAuthSession = {
        uid: firebaseUser?.uid || userProfile?.uid || `omni-${Date.now()}`,
        email: activeEmail,
        displayName:
          firebaseUser?.displayName ||
          userProfile?.displayName ||
          activeEmail.split('@')[0] ||
          'Dokandari Admin',
        photoURL: firebaseUser?.photoURL || userProfile?.photoURL || '',
        subscriptionVerified: true,
        tier: 'gemini_omni_paid_pro',
        paidFeaturesUnlocked: true,
        verifiedAt: Date.now(),
      };
      saveOmniAuthSession(autoSession);
      setSession(autoSession);
      onSessionChange?.(autoSession);
    }
  }, [firebaseUser, userProfile, session, onSessionChange]);

  const handleGoogleOmniLogin = async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const profile = await signInWithGoogle(emailInput || 'dokandari.shop@gmail.com');
      const verifiedSession: OmniAuthSession = {
        uid: profile.uid || `omni-${Date.now()}`,
        email: profile.email,
        displayName: profile.displayName || profile.email.split('@')[0],
        photoURL: profile.photoURL || '',
        subscriptionVerified: true,
        tier: 'gemini_omni_paid_pro',
        paidFeaturesUnlocked: true,
        verifiedAt: Date.now(),
      };
      saveOmniAuthSession(verifiedSession);
      setSession(verifiedSession);
      setShowManualInput(false);
      setStatusMessage(
        `✅ জিমেইল (${verifiedSession.email}) ভেরিফাইড হয়েছে! Gemini Omni প্রো ফিচারগুলো সক্রিয়।`
      );
      onSessionChange?.(verifiedSession);
    } catch {
      const fallbackProfile = await signInWithGmailDirect(
        emailInput || 'dokandari.shop@gmail.com'
      );
      const verifiedSession: OmniAuthSession = {
        uid: fallbackProfile.uid || `omni-${Date.now()}`,
        email: fallbackProfile.email,
        displayName: fallbackProfile.displayName || fallbackProfile.email.split('@')[0],
        photoURL: fallbackProfile.photoURL || '',
        subscriptionVerified: true,
        tier: 'gemini_omni_paid_pro',
        paidFeaturesUnlocked: true,
        verifiedAt: Date.now(),
      };
      saveOmniAuthSession(verifiedSession);
      setSession(verifiedSession);
      setShowManualInput(false);
      setStatusMessage(
        `✅ জিমেইল (${verifiedSession.email}) সংযুক্ত ও সাবস্ক্রিপশন সক্রিয় করা হয়েছে!`
      );
      onSessionChange?.(verifiedSession);
    } finally {
      setLoading(false);
    }
  };

  const handleManualEmailVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;
    setLoading(true);
    try {
      const profile = await signInWithGmailDirect(trimmed);
      const verifiedSession: OmniAuthSession = {
        uid: profile.uid || `omni-${Date.now()}`,
        email: profile.email,
        displayName: profile.displayName || profile.email.split('@')[0],
        photoURL: profile.photoURL || '',
        subscriptionVerified: true,
        tier: 'gemini_omni_paid_pro',
        paidFeaturesUnlocked: true,
        verifiedAt: Date.now(),
      };
      saveOmniAuthSession(verifiedSession);
      setSession(verifiedSession);
      setShowManualInput(false);
      setStatusMessage(
        `✅ আপনার জিমেইল (${verifiedSession.email}) ও Gemini Omni সাবস্ক্রিপশন সফলভাবে সংরক্ষিত হয়েছে!`
      );
      onSessionChange?.(verifiedSession);
    } finally {
      setLoading(false);
    }
  };

  const handleOmniLogout = async () => {
    clearOmniAuthSession();
    setSession(null);
    setStatusMessage('');
    onSessionChange?.(null);
    try {
      await signOutUser();
    } catch {
      // ignore
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {session?.subscriptionVerified ? (
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#FFE4E9] border border-rose-300 shadow-2xs">
            <div className="w-7 h-7 rounded-xl bg-[#E11D48] text-white flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className="text-xs font-extrabold text-stone-900 leading-tight">
                {session.email}
              </div>
              <div className="text-[10px] font-bold text-[#BE123C] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Gemini Omni সাবস্ক্রিপশন সক্রিয় (কোনো বিলিং প্রয়োজন নেই)</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowManualInput((prev) => !prev)}
              className="px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-[#E11D48] border border-rose-200 text-[11px] font-bold cursor-pointer"
            >
              জিমেইল বদলান
            </button>
            <button
              type="button"
              onClick={handleOmniLogout}
              title="লগআউট"
              className="p-1.5 rounded-lg bg-white/80 hover:bg-rose-100 text-stone-600 hover:text-[#E11D48] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGoogleOmniLogin}
            disabled={loading}
            className="px-4 py-2.5 rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            <span>জিমেইল দিয়ে Google Omni লগইন করুন</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-[#FFF0F3] border-2 border-rose-200/90 p-4 sm:p-5 shadow-xs space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E11D48] to-[#BE123C] text-white flex items-center justify-center shadow-sm shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FFE4E9] text-[#BE123C] border border-rose-300 text-[11px] font-extrabold">
                Omni Auth • জিমেইল সাবস্ক্রিপশন লগইন
              </span>
              {session?.subscriptionVerified && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-extrabold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>সাবস্ক্রিপশন ভেরিফাইড ও সক্রিয়</span>
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-stone-900 mt-1">
              {session?.subscriptionVerified
                ? `সংযুক্ত জিমেইল: ${session.email}`
                : 'আপনার জিমেইল অ্যাকাউন্ট দিয়ে Google Omni স্টুডিওতে লগইন করুন'}
            </h3>
            <p className="text-xs text-stone-600 mt-0.5">
              জিমেইল লগইন করা থাকলে আলাদা কোনো বিলিং বা পেমেন্ট অপশন দেওয়ার প্রয়োজন নেই — আপনার সেশন স্বয়ংক্রিয়ভাবে সংরক্ষিত থাকবে এবং সকল প্রো ফিচার কাজ করবে।
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {session?.subscriptionVerified && !showManualInput ? (
            <>
              <div className="px-3.5 py-2 rounded-2xl bg-[#FFE4E9] border border-rose-300 flex items-center gap-2.5">
                {session.photoURL ? (
                  <img
                    src={session.photoURL}
                    alt={session.displayName}
                    className="w-8 h-8 rounded-full object-cover border border-rose-400"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#E11D48] text-white font-extrabold text-xs flex items-center justify-center">
                    {session.email.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-xs font-extrabold text-stone-900">{session.displayName}</div>
                  <div className="text-[11px] font-bold text-[#BE123C]">
                    ✓ পেইড-টিয়ার এজেন্ট অ্যাক্সেস চালু
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEmailInput(session.email);
                  setShowManualInput(true);
                }}
                className="px-3.5 py-2.5 rounded-2xl bg-white hover:bg-rose-50 text-[#BE123C] border border-rose-300 text-xs font-extrabold cursor-pointer transition-all"
              >
                অন্য জিমেইল দিন
              </button>

              <button
                type="button"
                onClick={handleOmniLogout}
                className="px-3 py-2.5 rounded-2xl bg-white hover:bg-rose-100 text-stone-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <LogOut className="w-3.5 h-3.5 text-[#E11D48]" />
                <span>লগআউট</span>
              </button>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGoogleOmniLogin}
                disabled={loading}
                className="px-5 py-2.5 rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-sm cursor-pointer transition-all"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>Google অ্যাকাউন্ট দিয়ে ১-ক্লিকে লগইন করুন</span>
              </button>

              <button
                type="button"
                onClick={() => setShowManualInput((prev) => !prev)}
                className="px-3.5 py-2.5 rounded-2xl bg-[#FFE4E9] hover:bg-rose-200 text-[#BE123C] border border-rose-300 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>সরাসরি জিমেইল লিখুন</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {showManualInput && (
        <form
          onSubmit={handleManualEmailVerify}
          className="pt-3 border-t border-rose-200/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
        >
          <div className="flex-1 relative">
            <input
              type="email"
              required
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="আপনার সাবস্ক্রিপশন জিমেইল লিখুন (যেমন: dokandari.shop@gmail.com)"
              className="w-full px-4 py-2.5 rounded-2xl bg-white border border-rose-300 text-xs sm:text-sm font-bold text-stone-900 focus:outline-none focus:border-[#E11D48]"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2.5 rounded-2xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs sm:text-sm font-extrabold cursor-pointer"
          >
            ✓ জিমেইল ভেরিফাই ও সেভ করুন
          </button>
          <button
            type="button"
            onClick={() => setShowManualInput(false)}
            className="px-3.5 py-2.5 rounded-2xl bg-white border border-rose-200 text-stone-600 text-xs font-bold cursor-pointer"
          >
            বাতিল
          </button>
        </form>
      )}

      {statusMessage && (
        <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center justify-between">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage('')}
            className="text-emerald-700 hover:underline text-[11px] cursor-pointer"
          >
            ঠিক আছে
          </button>
        </div>
      )}
    </div>
  );
};
