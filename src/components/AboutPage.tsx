/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  Award,
  Truck,
  RotateCcw,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_STORE_CONTENT } from '../lib/storeSync';
import { FounderData } from './FounderSection';

interface AboutPageProps {
  founderData: FounderData;
  pageContent?: typeof DEFAULT_STORE_CONTENT.pageContent;
  isAdmin?: boolean;
  onBackToHome: () => void;
  onOpenStoreProducts?: () => void;
  onEditFounder?: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  founderData,
  pageContent,
  isAdmin = false,
  onBackToHome,
  onOpenStoreProducts,
  onEditFounder,
}) => {
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPage, setLocalPage] = useState(
    pageContent || DEFAULT_STORE_CONTENT.pageContent!
  );

  useEffect(() => {
    if (pageContent) {
      setLocalPage((prev) => ({ ...prev, ...pageContent }));
    }
  }, [pageContent]);

  const handleSaveAboutContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(
        doc(db, 'settings', 'store_content'),
        { pageContent: localPage },
        { merge: true }
      );
      setIsEditingPage(false);
    } catch (err) {
      console.warn('Save about page error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-16 animate-in fade-in">
      {/* Top Hero Banner */}
      <div className="relative bg-gradient-to-br from-stone-900 via-stone-950 to-[#4c0519] text-white py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              onClick={onBackToHome}
              className="inline-flex items-center gap-2 text-xs font-bold text-rose-200 hover:text-white transition-colors cursor-pointer bg-white/10 px-3.5 py-1.5 rounded-full backdrop-blur-xs border border-white/15"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>&larr; হোম পেজে ফিরে যান</span>
            </button>

            {isAdmin && (
              <button
                onClick={() => setIsEditingPage(!isEditingPage)}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#E11D48] hover:bg-[#BE123C] text-white px-4 py-1.5 rounded-xl shadow-sm cursor-pointer transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingPage ? 'এডিট বন্ধ করুন' : 'এই পেইজের লেখা লাইভ এডিট করুন'}</span>
              </button>
            )}
          </div>

          <div className="inline-block px-3 py-1 rounded-md bg-[#E11D48] text-white text-xs font-bold tracking-wider uppercase">
            BRAND STORY & HERITAGE
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            {localPage.aboutHeadline}
          </h1>
          <p className="text-xs sm:text-base text-stone-200 max-w-2xl leading-relaxed">
            {localPage.aboutSubtitle}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 space-y-8">
        {/* Live Page Editor Box for Admin */}
        {isAdmin && isEditingPage && (
          <form
            onSubmit={handleSaveAboutContent}
            className="bg-white rounded-3xl border-2 border-[#E11D48] p-6 shadow-xl space-y-4 text-xs animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h3 className="text-sm font-extrabold text-[#E11D48] flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                <span>ব্র্যান্ড পরিচিতি পেইজ লাইভ এডিটর (ফায়ারস্টোর অটো-সিঙ্ক)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingPage(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-stone-700 mb-1">পেইজ শিরোনাম (Headline)</label>
                <input
                  type="text"
                  value={localPage.aboutHeadline}
                  onChange={(e) => setLocalPage({ ...localPage, aboutHeadline: e.target.value })}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">সাবটাইটেল / বিবরণ (Subtitle)</label>
                <textarea
                  rows={2}
                  value={localPage.aboutSubtitle}
                  onChange={(e) => setLocalPage({ ...localPage, aboutSubtitle: e.target.value })}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">অফিস ও ওয়্যারহাউজ ঠিকানা</label>
                <input
                  type="text"
                  value={localPage.warehouseAddress}
                  onChange={(e) => setLocalPage({ ...localPage, warehouseAddress: e.target.value })}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
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

        {/* Founder Card Spotlight */}
        <div className="bg-white rounded-3xl border border-rose-200 p-6 sm:p-10 shadow-lg flex flex-col md:flex-row items-center gap-8">
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-3xl overflow-hidden border-4 border-rose-100 shadow-md shrink-0">
            <img
              src={founderData.photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80'}
              alt={founderData.name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-2 left-2 right-2 bg-stone-900/85 backdrop-blur-xs text-white text-[10px] text-center font-bold py-1 rounded-lg">
              {founderData.title || 'Founder & CEO'}
            </div>
          </div>

          <div className="space-y-4 flex-1 text-center md:text-left">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#E11D48]">
                ফাউন্ডার ও সিইও-এর বার্তা
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-1">
                {founderData.name}
              </h2>
              <p className="text-xs font-bold text-stone-500 mt-0.5">
                {founderData.title} — Dokandari Bangladesh
              </p>
            </div>

            <p className="text-xs sm:text-sm text-stone-700 leading-relaxed italic bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
              "{founderData.bio || 'আমাদের লক্ষ্য প্রতিটি গ্রাহককে সততা, সর্বোচ্চ কোয়ালিটি এবং ঝামেলামুক্ত ক্যাশ অন ডেলিভারি সেবা প্রদান করা।'}"
            </p>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
              <button
                onClick={onOpenStoreProducts || onBackToHome}
                className="px-5 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                আমাদের কালেকশন দেখুন &rarr;
              </button>
              {isAdmin && onEditFounder && (
                <button
                  onClick={onEditFounder}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  ✎ ফাউন্ডার প্রোফাইল এডিট করুন
                </button>
              )}
              <a
                href="https://wa.me/8801885533437"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>সরাসরি হোয়াটসঅ্যাপ কথা বলুন</span>
              </a>
            </div>
          </div>
        </div>

        {/* 4 Pillars of Dokandari */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">১০০% অরিজিনাল কোয়ালিটি</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              কোনো নকল বা কপি প্রোডাক্ট নয়। সরাসরি ইমপোর্টকৃত প্রিমিয়াম ম্যাটেরিয়াল ও আন্তর্জাতিক ফিনিশিং।
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#E11D48] flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">ওপেন পার্সেল ক্যাশ অন ডেলিভারি</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              অগ্রিম ১ টাকাও পেমেন্ট ছাড়াই সারা বাংলাদেশে হোম ডেলিভারি। ডেলিভারিম্যানের সামনে খুলে দেখে টাকা দিন।
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">৭ দিনের রিটার্ন ও এক্সচেঞ্জ</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              পণ্য পছন্দ না হলে বা সাইজে সমস্যা হলে ৭ দিনের ভেতর ঝামেলাহীনভাবে এক্সচেঞ্জ বা রিটার্ন করার গ্যারান্টি।
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-2xs space-y-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-stone-900">২৪/৭ কাস্টমার সাপোর্ট</h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              হোয়াটসঅ্যাপ, ফোন কল এবং লাইভ চ্যাটে আমাদের ডেডিকেটেড টিম সবসময় আপনার সেবায় প্রস্তুত।
            </p>
          </div>
        </div>

        {/* Contact and Warehouse details */}
        <div className="bg-white rounded-3xl border border-rose-200 p-6 sm:p-8 shadow-xs space-y-6">
          <div className="border-b border-rose-100 pb-4">
            <h3 className="text-lg font-bold text-stone-900">আমাদের অফিস ও ওয়্যারহাউস ঠিকানা</h3>
            <p className="text-xs text-stone-500 mt-0.5">যেকোনো প্রশ্ন বা অর্ডারের সহায়তায় সরাসরি যোগাযোগ করুন</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs text-stone-700">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-stone-900">হেড অফিস ও ওয়্যারহাউজ</span>
                <span className="text-stone-600">
                  {localPage.warehouseAddress || founderData.address || 'বাইপাইল, আশুলিয়া, সাভার, ঢাকা'}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-stone-900">হটলাইন ও কাস্টমার কেয়ার</span>
                <a href={`tel:${founderData.phone || '+8801885533437'}`} className="font-mono text-stone-600 hover:text-[#E11D48] block">
                  {founderData.phone || '+880 1885-533437'}
                </a>
                <span className="text-[10px] text-stone-400">সকাল ১০টা থেকে রাত ১০টা (প্রতিদিন)</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-stone-900">ইমেইল যোগাযোগ</span>
                <a href="mailto:dokandari.shop@gmail.com" className="font-mono text-stone-600 hover:text-[#E11D48] block">
                  dokandari.shop@gmail.com
                </a>
                <span className="text-[10px] text-stone-400">অফিশিয়াল বিজনেস মেইল</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
