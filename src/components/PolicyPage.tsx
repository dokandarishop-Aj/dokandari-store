/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  RotateCcw,
  Package,
  Globe,
  CheckCircle2,
  Lock,
  MessageCircle,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { OFFICIAL_WHATSAPP, DEFAULT_STORE_CONTENT } from '../lib/storeSync';

interface PolicyPageProps {
  onBackToShopping: () => void;
  pageContent?: typeof DEFAULT_STORE_CONTENT.pageContent;
  isAdmin?: boolean;
}

export const PolicyPage: React.FC<PolicyPageProps> = ({
  onBackToShopping,
  pageContent,
  isAdmin = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPage, setLocalPage] = useState(
    pageContent || DEFAULT_STORE_CONTENT.pageContent!
  );

  useEffect(() => {
    if (pageContent) {
      setLocalPage((prev) => ({ ...prev, ...pageContent }));
    }
  }, [pageContent]);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'settings', 'store_content'),
        { pageContent: localPage },
        { merge: true }
      );
      setIsEditing(false);
    } catch (err) {
      console.warn('Policy save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F6] py-6 sm:py-10 animate-in fade-in">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onBackToShopping}
              className="px-3.5 py-1.5 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 rounded-lg font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>হোম পেজে ফিরুন</span>
            </button>
            <span className="text-stone-300">/</span>
            <span className="text-emerald-800 font-semibold">
              পলিসি ও ৭ দিনের রিটার্ন গ্যারান্টি
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditing ? 'এডিট বন্ধ করুন' : 'পলিসি লেখা লাইভ এডিট করুন'}</span>
              </button>
            )}
            <button
              onClick={onBackToShopping}
              className="px-4 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>🛍️ শপ করুন</span>
            </button>
          </div>
        </div>

        {/* Live Admin Editor Box */}
        {isAdmin && isEditing && (
          <form
            onSubmit={handleSavePolicy}
            className="bg-white rounded-3xl border-2 border-[#E11D48] p-6 shadow-xl space-y-4 text-xs animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h3 className="text-sm font-extrabold text-[#E11D48] flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                <span>প্রাইভেসি ও রিটার্ন পলিসি লাইভ এডিটর (ফায়ারস্টোর অটো-সিঙ্ক)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-stone-700 mb-1">পলিসি শিরোনাম</label>
                <input
                  type="text"
                  value={localPage.policyHeadline}
                  onChange={(e) => setLocalPage({ ...localPage, policyHeadline: e.target.value })}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">পলিসি সাবটাইটেল</label>
                <input
                  type="text"
                  value={localPage.policySubtitle}
                  onChange={(e) => setLocalPage({ ...localPage, policySubtitle: e.target.value })}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-bold text-stone-700 mb-1">৭ দিনের রিটার্ন ও এক্সচেঞ্জ নীতিমালা</label>
                <textarea
                  rows={2}
                  value={localPage.returnPolicyText}
                  onChange={(e) => setLocalPage({ ...localPage, returnPolicyText: e.target.value })}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">রিফান্ড নীতিমালা</label>
                <textarea
                  rows={2}
                  value={localPage.refundPolicyText}
                  onChange={(e) => setLocalPage({ ...localPage, refundPolicyText: e.target.value })}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">প্রাইভেসি ও ডেটা সুরক্ষা নীতিমালা</label>
                <textarea
                  rows={2}
                  value={localPage.privacyPolicyText}
                  onChange={(e) => setLocalPage({ ...localPage, privacyPolicyText: e.target.value })}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'সেভ হচ্ছে...' : 'লাইভ ডাটাবেজে সেভ করুন'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Deep Emerald Header Banner */}
        <div className="relative rounded-3xl bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 text-white p-6 sm:p-10 shadow-xl overflow-hidden space-y-4">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-3 py-1 rounded-md">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>১০০% ক্যাশ অন ডেলিভারি ও যাচাই সুবিধা</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black leading-tight text-white">
            {localPage.policyHeadline}
            <span className="block text-emerald-300 text-lg sm:text-2xl font-bold mt-1">
              (Return, Refund & Privacy Policy)
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-emerald-100/90 max-w-3xl leading-relaxed">
            {localPage.policySubtitle}
          </p>
        </div>

        {/* 3 Metric Cards */}
        <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-stone-200">
            <div className="flex items-center gap-2 text-stone-900 font-black text-sm sm:text-base">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Official Return, Refund & Exchange Policy (Google Merchant Verified)</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 font-mono">
              Return Window: 7 Days · Return Cost: 0 BDT (Free)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
              <div className="flex items-center gap-2 text-blue-700 font-bold">
                <Globe className="w-4 h-4" />
                <span>Country & Policy URL</span>
              </div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                <strong>Countries:</strong> Bangladesh (BD)<br />
                <strong>URL:</strong> https://dokandari.com/privacy
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <RotateCcw className="w-4 h-4" />
                <span>Returns & Exchanges</span>
              </div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                Accept returns for both defective and non-defective products. Full size and color exchange supported nationwide.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-800 font-bold">
                <Package className="w-4 h-4" />
                <span>Condition, Window & Cost</span>
              </div>
              <p className="text-stone-600 leading-relaxed text-[11px]">
                <strong>Product Condition:</strong> New only<br />
                <strong>Return Window:</strong> 7 days<br />
                <strong>Return Cost:</strong> Free (0.00 BDT)
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Sections */}
        <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-10 shadow-xs space-y-8 text-stone-700 text-xs sm:text-sm leading-relaxed">
          <div className="space-y-3">
            <h2 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </span>
              <span>৭ দিনের সহজ রিটার্ন ও এক্সচেঞ্জ নীতিমালা</span>
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {localPage.returnPolicyText}
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-stone-100">
            <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-rose-100 text-[#E11D48] flex items-center justify-center shrink-0">
                <RotateCcw className="w-4 h-4" />
              </span>
              <span>রিফান্ড পাওয়ার সময় ও মাধ্যম (Refund Policy)</span>
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {localPage.refundPolicyText}
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t border-stone-100">
            <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </span>
              <span>গ্রাহকের তথ্যের গোপনীয়তা ও সুরক্ষা (Privacy Policy)</span>
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {localPage.privacyPolicyText}
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="font-bold text-stone-900 text-sm">যেকোনো প্রশ্ন বা সহযোগিতার জন্য সরাসরি যোগাযোগ করুন</h4>
              <p className="text-xs text-stone-600">আমাদের কাস্টমার কেয়ার টিম সপ্তাহের ৭ দিনই ২৪ ঘণ্টা আপনার সেবায় নিয়োজিত।</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`https://wa.me/88${OFFICIAL_WHATSAPP}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp সাপোর্ট</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
