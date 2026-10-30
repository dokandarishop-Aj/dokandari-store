/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

interface AdminLoginGateProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function isAdminSessionValid(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('dokandari_admin_session');
    if (!raw) return false;
    if (raw === 'active') return true;
    const parsed = JSON.parse(raw);
    return Boolean(parsed && parsed.authenticated === true);
  } catch {
    return false;
  }
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({ onSuccess, onCancel }) => {
  const { signInWithGoogle, isAdmin } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customSecurityConfig, setCustomSecurityConfig] = useState<any>(null);

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem('dokandari_admin_session', 'active');
      onSuccess();
    }
  }, [isAdmin, onSuccess]);

  useEffect(() => {
    const loadSecurityConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'security_config'));
        if (snap.exists()) {
          setCustomSecurityConfig(snap.data());
        }
      } catch (err) {
        console.warn('Security config fetch note:', err);
      }
    };
    loadSecurityConfig();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: username.trim(),
          password: password.trim(),
          customConfig: customSecurityConfig || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data?.authenticated) {
        if (rememberMe) {
          localStorage.setItem('dokandari_admin_session', 'active');
        } else {
          sessionStorage.setItem('dokandari_admin_session', 'active');
          localStorage.setItem('dokandari_admin_session', 'active');
        }
        setIsLoading(false);
        onSuccess();
      } else {
        setIsLoading(false);
        setError(
          data?.error ||
            'অননুমোদিত অ্যাক্সেস! শুধুমাত্র নির্ধারিত অ্যাডমিন ইমেইল ও সিক্রেট পাসওয়ার্ড দিয়ে লগইন করা যাবে।'
        );
      }
    } catch {
      setIsLoading(false);
      setError('সার্ভার ভেরিফিকেশনে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  const handleGoogleAdminLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch {
      setError('গুগল অ্যাডমিন লগইন সম্পন্ন হয়নি। আপনার অ্যাডমিন ইমেইল ও সিক্রেট পাসওয়ার্ড ব্যবহার করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl border border-rose-200 w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#E11D48] to-[#9F1239] p-6 text-white text-center relative">
          <button
            onClick={onCancel}
            className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="ফিরে যান"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-3 backdrop-blur-xs">
            <Lock className="w-7 h-7 text-white" />
          </div>

          <h3 className="text-xl font-extrabold tracking-tight">Dokandari Master Admin Login</h3>
          <p className="text-xs text-rose-100 mt-1">
            শুধুমাত্র অনুমোদিত অ্যাডমিন লাইভ ডোমেইন থেকে স্টোর কন্ট্রোল ও এডিট করতে পারবেন
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-[#E11D48] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-stone-700 mb-1.5">
              অ্যাডমিন ইমেইল (Admin Email)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="আপনার নির্ধারিত অ্যাডমিন ইমেইল দিন..."
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium text-stone-900 focus:outline-none focus:border-[#E11D48] focus:bg-white"
              autoFocus
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1.5">
              অ্যাডমিন সিক্রেট পাসওয়ার্ড (Secret Password)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="সিক্রেট বক্সে সেট করা পাসওয়ার্ড দিন..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono text-stone-900 focus:outline-none focus:border-[#E11D48] focus:bg-white text-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded text-[#E11D48] focus:ring-[#E11D48]"
              />
              <span className="font-semibold text-stone-600 text-[11px]">
                এই ডিভাইসে লাইভ অ্যাডমিন সেশন চালু রাখুন
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 border border-stone-300 rounded-xl font-bold text-stone-700 hover:bg-stone-50 cursor-pointer transition-colors"
            >
              বাতিল করুন
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold shadow-md cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Shield className="w-4 h-4" />
              <span>{isLoading ? 'যাচাই হচ্ছে...' : 'লগইন করুন'}</span>
            </button>
          </div>

          <div className="relative py-1 flex items-center justify-center">
            <div className="border-t border-stone-200 w-full" />
            <span className="bg-white px-3 text-[10px] text-stone-400 font-semibold uppercase">অথবা</span>
            <div className="border-t border-stone-200 w-full" />
          </div>

          <button
            type="button"
            onClick={handleGoogleAdminLogin}
            className="w-full py-2.5 px-4 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-rose-400" />
            <span>অনুমোদিত অ্যাডমিন Google ইমেইল দিয়ে প্রবেশ করুন</span>
          </button>
        </form>
      </div>
    </div>
  );
};
