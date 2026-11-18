/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Eye, EyeOff, Lock, ArrowLeft, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  hasValidAdminTokenFormat,
  setAdminSessionToken,
  clearAdminSessionToken,
  verifyAdminSessionWithServer,
} from '../lib/adminAuthClient';

interface AdminLoginGateProps {
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Strictly checks whether a cryptographically signed server Admin session token is present.
 * Never trusts plain `localStorage.getItem('dokandari_admin_session') === 'active'` flags!
 */
export function isAdminSessionValid(): boolean {
  return hasValidAdminTokenFormat();
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({ onSuccess, onCancel }) => {
  const { userProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // On mount, if a signed token exists, verify it against the backend server before granting access
  useEffect(() => {
    let active = true;
    if (hasValidAdminTokenFormat()) {
      verifyAdminSessionWithServer().then((verified) => {
        if (active && verified) {
          onSuccess();
        }
      });
    } else {
      clearAdminSessionToken();
    }
    return () => {
      active = false;
    };
  }, [onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          emailOrUsername: username.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data?.authenticated && data?.adminToken) {
        setAdminSessionToken(data.adminToken, rememberMe);
        setIsLoading(false);
        onSuccess();
      } else {
        clearAdminSessionToken();
        setIsLoading(false);
        setError(
          data?.error ||
            'অননুমোদিত অ্যাক্সেস (403 Forbidden)! শুধুমাত্র নির্ধারিত অ্যাডমিন ইমেইল ও সিক্রেট পাসওয়ার্ড দিয়ে প্রবেশ করা যাবে।'
        );
      }
    } catch {
      setIsLoading(false);
      setError('সার্ভার ভেরিফিকেশনে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    }
  };

  const isLoggedInNormalCustomer = Boolean(userProfile && userProfile.role !== 'admin');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-gate-heading"
      className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-3xl border border-rose-200 w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#E11D48] to-[#9F1239] p-6 text-white text-center relative">
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-4 left-4 min-w-[40px] min-h-[40px] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center justify-center"
            title="স্টোরে ফিরে যান"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center mx-auto mb-3 backdrop-blur-xs">
            <Lock className="w-7 h-7 text-white" />
          </div>

          <h3 id="admin-gate-heading" className="text-xl font-extrabold tracking-tight">
            Restricted Admin Access (403)
          </h3>
          <p className="text-xs text-rose-100 mt-1">
            এই অংশটি সম্পূর্ণ সংরক্ষিত। সাধারণ কাস্টমার বা অননুমোদিত ব্যবহারকারীর প্রবেশ নিষিদ্ধ।
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {isLoggedInNormalCustomer && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5 font-medium">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">
                  কাস্টমার অ্যাকাউন্ট দিয়ে অ্যাডমিন প্যানেলে প্রবেশ করা যাবে না!
                </span>
                <span className="text-[11px] text-amber-800 block mt-0.5">
                  আপনি বর্তমানে কাস্টমার হিসেবে লগইন আছেন ({userProfile?.email})। কেনাকাটা চালিয়ে যেতে নিচে স্টোরে ফিরে যান।
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-[#E11D48] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block font-bold text-stone-700 mb-1.5">
              অ্যাডমিন ইমেইল (Authorized Admin Email)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="আপনার নির্ধারিত অ্যাডমিন ইমেইল দিন..."
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-medium text-stone-900 focus:outline-none focus:border-[#E11D48] focus:bg-white"
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
                placeholder="সিক্রেট পাসওয়ার্ড দিন..."
                className="w-full min-h-[44px] pl-3.5 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono text-stone-900 focus:outline-none focus:border-[#E11D48] focus:bg-white text-xs"
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
                সার্ভার-ভেরিফাইড অ্যাডমিন সেশন চালু রাখুন
              </span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 min-h-[44px] py-2.5 border border-stone-300 rounded-xl font-bold text-stone-700 hover:bg-stone-50 cursor-pointer transition-colors"
            >
              স্টোরে ফিরে যান
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 min-h-[44px] py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold shadow-md cursor-pointer transition-colors flex items-center justify-center gap-1.5"
            >
              <Shield className="w-4 h-4" />
              <span>{isLoading ? 'যাচাই হচ্ছে...' : 'অ্যাডমিন লগইন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
