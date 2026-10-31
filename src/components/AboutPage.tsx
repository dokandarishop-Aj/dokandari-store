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
  Trash2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import {
  DEFAULT_STORE_CONTENT,
  saveStoreContentPersisted,
} from '../lib/storeSync';
import { FounderData } from './FounderSection';

interface AboutPageProps {
  founderData: FounderData;
  pageContent?: typeof DEFAULT_STORE_CONTENT.pageContent;
  isAdmin?: boolean;
  onBackToHome: () => void;
  onOpenStoreProducts?: () => void;
  onEditFounder?: () => void;
  onRemoveFounderPhoto?: () => void;
  totalProductsCount?: number;
}

export const AboutPage: React.FC<AboutPageProps> = ({
  founderData,
  pageContent,
  isAdmin = false,
  onBackToHome,
  onOpenStoreProducts,
  onEditFounder,
  onRemoveFounderPhoto,
  totalProductsCount = 27,
}) => {
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [localPage, setLocalPage] = useState(
    pageContent || DEFAULT_STORE_CONTENT.pageContent!
  );

  useEffect(() => {
    if (pageContent) {
      setLocalPage((prev) => ({ ...prev, ...pageContent }));
    }
  }, [pageContent]);

  const handleAiPolishPage = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/gemini/ai-edit-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'founder_brand',
          instruction:
            aiPrompt.trim() ||
            'Dokandari ব্র্যান্ড পরিচিতি, প্রতিষ্ঠাতা পরিচিতি এবং অফিসের ঠিকানা সুন্দর ও প্রফেশনাল বাংলায় সাজিয়ে দাও।',
          currentData: {
            aboutHeadline: localPage.aboutHeadline,
            aboutSubtitle: localPage.aboutSubtitle,
            warehouseAddress:
              localPage.warehouseAddress || 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)',
            corporateAddress:
              localPage.corporateAddress || 'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা',
          },
        }),
      });
      const json = await res.json();
      if (json?.data) {
        setLocalPage((prev) => ({
          ...prev,
          aboutHeadline: json.data.aboutHeadline || prev.aboutHeadline,
          aboutSubtitle: json.data.aboutSubtitle || prev.aboutSubtitle,
          warehouseAddress:
            json.data.warehouseAddress ||
            prev.warehouseAddress ||
            'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)',
          corporateAddress:
            json.data.corporateAddress ||
            prev.corporateAddress ||
            'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা',
        }));
      }
    } catch (err) {
      console.warn('AI polish about page note:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAboutContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveStoreContentPersisted({
        pageContent: localPage,
      });
      setIsEditingPage(false);
    } catch (err) {
      console.warn('Save about page error:', err);
    } finally {
      setSaving(false);
    }
  };

  const hasPhoto = Boolean(founderData.photo && founderData.photo.trim());

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-16 animate-in fade-in">
      {/* Top Hero Banner with Live Store Metrics */}
      <div className="relative bg-gradient-to-br from-stone-900 via-stone-950 to-[#4c0519] text-white py-10 sm:py-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onBackToHome}
                className="inline-flex items-center gap-2 text-xs font-bold text-rose-200 hover:text-white transition-colors cursor-pointer bg-white/10 px-3.5 py-2 rounded-xl backdrop-blur-xs border border-white/15"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>হোম পেজে ফিরে যান</span>
              </button>
              {onOpenStoreProducts && (
                <button
                  onClick={onOpenStoreProducts}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#E11D48] hover:bg-[#BE123C] text-white px-3.5 py-2 rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  <span>সকল প্রোডাক্ট দেখুন ({totalProductsCount}টি)</span>
                </button>
              )}
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 flex-wrap">
                {onEditFounder && (
                  <button
                    onClick={onEditFounder}
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 hover:bg-white/25 text-white px-3.5 py-1.5 rounded-xl border border-white/20 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>ফাউন্ডার ছবি ও প্রোফাইল এডিট</span>
                  </button>
                )}
                <button
                  onClick={() => setIsEditingPage(!isEditingPage)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-stone-950 px-4 py-1.5 rounded-xl shadow-sm cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingPage ? 'এডিট বন্ধ করুন' : '✨ AI ও পেইজ এডিট করুন'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E11D48] text-white text-xs font-bold tracking-wider uppercase">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ভেরিফাইড ব্র্যান্ড পরিচিতি • Dokandari Official</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                {localPage.aboutHeadline}
              </h1>
              <p className="text-xs sm:text-base text-stone-200 max-w-2xl leading-relaxed">
                {localPage.aboutSubtitle}
              </p>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 gap-2.5">
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 text-center">
                <span className="block text-xl sm:text-2xl font-black text-amber-300">{totalProductsCount}+</span>
                <span className="text-[11px] text-rose-100">অরিজিনাল পণ্য</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 text-center">
                <span className="block text-xl sm:text-2xl font-black text-emerald-300">৬৪ জেলা</span>
                <span className="text-[11px] text-rose-100">হোম ডেলিভারি</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 text-center">
                <span className="block text-xl sm:text-2xl font-black text-white">১০০%</span>
                <span className="text-[11px] text-rose-100">পার্সেল খুলে দেখার সুবিধা</span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-3.5 text-center">
                <span className="block text-xl sm:text-2xl font-black text-amber-300">৭ দিন</span>
                <span className="text-[11px] text-rose-100">সহজ এক্সচেঞ্জ গ্যারান্টি</span>
              </div>
            </div>
          </div>
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
                <span>ব্র্যান্ড পরিচিতি ও অফিস ঠিকানা লাইভ এডিটর (ফায়ারস্টোর অটো-সিঙ্ক)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingPage(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI Auto-Fill Bar */}
            <div className="bg-[#FFF5F7] p-3 rounded-2xl border border-rose-200 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="AI নির্দেশনা লিখুন (যেমন: প্রিমিয়াম ব্র্যান্ড স্টোরি ও ঠিকানা সাজিয়ে দাও)..."
                className="flex-1 px-3 py-2 bg-white border border-rose-200 rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={handleAiPolishPage}
                disabled={aiLoading}
                className="px-4 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {aiLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{aiLoading ? 'AI সাজাচ্ছে...' : '✨ AI দিয়ে সাজান'}</span>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    ঠিকানা ১ (উপরের ঠিকানা — শোরুম ও ওয়্যারহাউজ)
                  </label>
                  <input
                    type="text"
                    value={localPage.warehouseAddress}
                    onChange={(e) => setLocalPage({ ...localPage, warehouseAddress: e.target.value })}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    ঠিকানা ২ (নিচের ঠিকানা — কর্পোরেট অফিস)
                  </label>
                  <input
                    type="text"
                    value={
                      localPage.corporateAddress ||
                      'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা'
                    }
                    onChange={(e) => setLocalPage({ ...localPage, corporateAddress: e.target.value })}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
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
          <div className="relative w-44 h-44 sm:w-56 sm:h-56 rounded-3xl overflow-hidden border-4 border-rose-100 shadow-md shrink-0 bg-gradient-to-br from-[#FFF1F2] via-rose-100 to-rose-200 flex items-center justify-center">
            {hasPhoto ? (
              <img
                src={founderData.photo}
                alt={founderData.name}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-4">
                <ShieldCheck className="w-14 h-14 text-[#E11D48] mb-2" />
                <span className="text-sm font-black text-[#9F1239] tracking-wide">
                  DOKANDARI
                </span>
                <span className="text-[11px] font-bold text-[#E11D48] mt-0.5">
                  VERIFIED FOUNDER
                </span>
              </div>
            )}
            <div className="absolute bottom-2 left-2 right-2 bg-stone-900/85 backdrop-blur-xs text-white text-[10px] text-center font-bold py-1 rounded-lg">
              {founderData.title || 'Founder & CEO'}
            </div>
          </div>

          <div className="space-y-4 flex-1 text-center md:text-left">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#E11D48]">
                প্রতিষ্ঠাতা ও সিইও পরিচিতি (Founder &amp; CEO Profile)
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

            {/* Founder Direct Details Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left bg-stone-50 p-3.5 rounded-2xl border border-stone-200 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900 block">ঠিকানা ১ (ওয়্যারহাউজ ও শোরুম):</span>
                  <span className="text-stone-600">
                    {localPage.warehouseAddress ||
                      founderData.address ||
                      'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)'}
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900 block">ঠিকানা ২ (কর্পোরেট অফিস):</span>
                  <span className="text-stone-600">
                    {localPage.corporateAddress ||
                      'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-2">
              <button
                onClick={onOpenStoreProducts || onBackToHome}
                className="px-5 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                আমাদের কালেকশন দেখুন &rarr;
              </button>
              {isAdmin && onEditFounder && (
                <button
                  onClick={onEditFounder}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✎ ফাউন্ডার ছবি ও প্রোফাইল এডিট</span>
                </button>
              )}
              {isAdmin && hasPhoto && onRemoveFounderPhoto && (
                <button
                  onClick={onRemoveFounderPhoto}
                  className="px-3.5 py-2.5 bg-white hover:bg-rose-50 text-[#E11D48] border border-rose-200 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ছবি রিমুভ করুন</span>
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
          <div className="border-b border-rose-100 pb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-lg font-bold text-stone-900">আমাদের অফিস ও ওয়্যারহাউস ঠিকানা</h3>
              <p className="text-xs text-stone-500 mt-0.5">যেকোনো প্রশ্ন বা অর্ডারের সহায়তায় সরাসরি যোগাযোগ করুন</p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditingPage(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>ঠিকানা এডিট করুন</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-xs text-stone-700">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-stone-900">ঠিকানা ১ (শোরুম ও ওয়্যারহাউজ)</span>
                <span className="text-stone-600 block">
                  {localPage.warehouseAddress ||
                    founderData.address ||
                    'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)'}
                </span>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Jaleshwar+Savar+Dhaka+1340+Bangladesh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E11D48] hover:underline"
                >
                  <span>📍 Google Map-এ লোকেশন দেখুন &rarr;</span>
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block text-stone-900">ঠিকানা ২ (কর্পোরেট ও ট্রেনিং অফিস)</span>
                <span className="text-stone-600 block">
                  {localPage.corporateAddress ||
                    'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা'}
                </span>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Shahid+Plaza+Savar+Bus+Stand+Dhaka+Bangladesh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E11D48] hover:underline"
                >
                  <span>📍 Google Map-এ লোকেশন দেখুন &rarr;</span>
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-stone-900">হটলাইন ও কাস্টমার কেয়ার</span>
                <a href={`tel:${founderData.phone || '+8809638757282'}`} className="font-mono text-stone-600 hover:text-[#E11D48] block">
                  {founderData.phone || '+8809638757282'}
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

