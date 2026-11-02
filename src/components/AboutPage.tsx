/**
 * @license
 * @SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Upload,
  Check,
  Leaf,
  Building2,
  FileText,
} from 'lucide-react';
import {
  DEFAULT_STORE_CONTENT,
  getInitialStoreContent,
  saveStoreContentPersisted,
  compressImageFileToDataUrl,
  StoreContent,
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
  onFounderDirectSaved?: (updatedFounder: FounderData, updatedStore?: StoreContent) => void;
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
  onFounderDirectSaved,
  totalProductsCount = 39,
}) => {
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [editingFounderInline, setEditingFounderInline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const isDirtyRef = useRef(false);

  const [localFounder, setLocalFounder] = useState<FounderData>(() => ({
    ...founderData,
    photo:
      founderData.photo && !founderData.photo.includes('photo-1507003211169-0a1dd7228f2d')
        ? founderData.photo
        : '',
  }));
  const [localPage, setLocalPage] = useState(
    pageContent || DEFAULT_STORE_CONTENT.pageContent!
  );

  useEffect(() => {
    if (!isEditingPage && !isDirtyRef.current) {
      setLocalFounder({
        ...founderData,
        photo:
          founderData.photo && !founderData.photo.includes('photo-1507003211169-0a1dd7228f2d')
            ? founderData.photo
            : '',
      });
    }
  }, [founderData, isEditingPage]);

  useEffect(() => {
    if (pageContent && !isEditingPage && !isDirtyRef.current) {
      setLocalPage((prev) => ({
        ...DEFAULT_STORE_CONTENT.pageContent!,
        ...prev,
        ...pageContent,
      }));
    }
  }, [pageContent, isEditingPage]);

  // Real-time debounced auto-save to Firestore whenever admin edits any field on AboutPage
  useEffect(() => {
    if (!isEditingPage || !isDirtyRef.current) return;
    const timer = setTimeout(async () => {
      try {
        const updatedFounder: FounderData = {
          ...localFounder,
          name: (localFounder.name ?? '').trim(),
          title: (localFounder.title ?? '').trim(),
          photo: (localFounder.photo ?? '').trim(),
          bio: (localFounder.bio ?? '').trim(),
          address: (localPage.warehouseAddress ?? localFounder.address ?? '').trim(),
          phone: (localFounder.phone ?? '').trim(),
        };
        const updatedPageContent = {
          ...DEFAULT_STORE_CONTENT.pageContent!,
          ...localPage,
          warehouseAddress: updatedFounder.address,
          corporateAddress: (localPage.corporateAddress ?? '').trim(),
        };
        const merged = await saveStoreContentPersisted({
          founder: updatedFounder,
          pageContent: updatedPageContent,
        });
        if (onFounderDirectSaved) {
          onFounderDirectSaved(updatedFounder, merged);
        }
      } catch (err) {
        console.warn('Realtime about page auto-save note:', err);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [localFounder, localPage, isEditingPage]);

  const showSavedToast = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(''), 3500);
  };

  const handleDirectPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 640, 0.85);
      
      let finalPhotoUrl = compressed;
      try {
        const uploadRes = await fetch('/api/upload-founder-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageDataUrl: compressed }),
        });
        const uploadJson = await uploadRes.json();
        if (uploadJson?.success && uploadJson?.url) {
          finalPhotoUrl = uploadJson.url;
        }
      } catch (err) {
        console.warn('Server upload fallback:', err);
      }

      const updatedFounder: FounderData = {
        ...localFounder,
        photo: finalPhotoUrl,
      };
      isDirtyRef.current = true;
      setLocalFounder(updatedFounder);
      const current = getInitialStoreContent();
      const merged = await saveStoreContentPersisted({
        founder: updatedFounder,
        pageContent: {
          ...DEFAULT_STORE_CONTENT.pageContent!,
          ...current.pageContent,
          ...localPage,
        },
      });
      if (onFounderDirectSaved) {
        onFounderDirectSaved(updatedFounder, merged);
      }
      showSavedToast('✓ ফাউন্ডারের ছবি লাইভ ডাটাবেজ ও ডোমেইনে স্থায়ীভাবে সংরক্ষিত হয়েছে!');
    } catch (err) {
      console.warn('Direct founder photo upload error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDirectRemovePhoto = async () => {
    setSaving(true);
    try {
      const updatedFounder: FounderData = {
        ...localFounder,
        photo: '',
      };
      isDirtyRef.current = true;
      setLocalFounder(updatedFounder);
      const current = getInitialStoreContent();
      const merged = await saveStoreContentPersisted({
        founder: updatedFounder,
        pageContent: {
          ...DEFAULT_STORE_CONTENT.pageContent!,
          ...current.pageContent,
          ...localPage,
        },
      });
      if (onFounderDirectSaved) {
        onFounderDirectSaved(updatedFounder, merged);
      }
      if (onRemoveFounderPhoto) {
        onRemoveFounderPhoto();
      }
      showSavedToast('✓ ফাউন্ডারের ছবি লাইভ ডাটাবেজ থেকে স্থায়ীভাবে রিমুভ করা হয়েছে!');
    } catch (err) {
      console.warn('Direct founder photo remove error:', err);
    } finally {
      setSaving(false);
    }
  };

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
            'Dokandari ব্র্যান্ড পরিচিতি, প্রতিষ্ঠাতা ও সিইও পরিচিতি, অফিসের ঠিকানা, বিজনেস স্টোরি, প্রোডাক্ট সোর্সিং ও অর্গানিক ফুড এবং বিজনেস পলিসি সুন্দর ও প্রফেশনাল বাংলায় সাজিয়ে দাও।',
          currentData: {
            name: localFounder.name,
            title: localFounder.title,
            bio: localFounder.bio,
            aboutHeadline: localPage.aboutHeadline,
            aboutSubtitle: localPage.aboutSubtitle,
            warehouseAddress: localPage.warehouseAddress,
            corporateAddress: localPage.corporateAddress,
            ceoMessageText: localPage.ceoMessageText,
            businessStoryText: localPage.businessStoryText,
            productSourcingText: localPage.productSourcingText,
            businessPolicyText: localPage.businessPolicyText,
          },
        }),
      });
      const json = await res.json();
      if (json?.data) {
        isDirtyRef.current = true;
        if (json.data.name || json.data.title || json.data.bio) {
          setLocalFounder((prev) => ({
            ...prev,
            name: json.data.name || prev.name,
            title: json.data.title || prev.title,
            bio: json.data.bio || prev.bio,
          }));
        }
        setLocalPage((prev) => ({
          ...prev,
          aboutHeadline: json.data.aboutHeadline || prev.aboutHeadline,
          aboutSubtitle: json.data.aboutSubtitle || prev.aboutSubtitle,
          warehouseAddress: json.data.warehouseAddress || prev.warehouseAddress,
          corporateAddress: json.data.corporateAddress || prev.corporateAddress,
          ceoMessageText: json.data.ceoMessageText || prev.ceoMessageText,
          businessStoryText: json.data.businessStoryText || prev.businessStoryText,
          productSourcingText: json.data.productSourcingText || prev.productSourcingText,
          businessPolicyText: json.data.businessPolicyText || prev.businessPolicyText,
        }));
      }
    } catch (err) {
      console.warn('AI polish about page note:', err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveAllAboutAndFounder = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const updatedFounder: FounderData = {
        ...localFounder,
        name: (localFounder.name ?? '').trim(),
        title: (localFounder.title ?? '').trim(),
        photo: (localFounder.photo ?? '').trim(),
        bio: (localFounder.bio ?? '').trim(),
        address: (localPage.warehouseAddress ?? localFounder.address ?? '').trim(),
        phone: (localFounder.phone ?? '').trim(),
      };
      const updatedPageContent = {
        ...DEFAULT_STORE_CONTENT.pageContent!,
        ...localPage,
        warehouseAddress: updatedFounder.address,
        corporateAddress: (localPage.corporateAddress ?? '').trim(),
      };

      const merged = await saveStoreContentPersisted({
        founder: updatedFounder,
        pageContent: updatedPageContent,
      });

      if (onFounderDirectSaved) {
        onFounderDirectSaved(updatedFounder, merged);
      }
      isDirtyRef.current = false;
      setIsEditingPage(false);
      setEditingFounderInline(false);
      showSavedToast('✓ ব্র্যান্ড পরিচিতি ও ফাউন্ডার প্রোফাইল লাইভ ডাটাবেজে ও ডোমেইনে স্থায়ীভাবে সেভ হয়েছে!');
    } catch (err) {
      console.warn('Save about page error:', err);
    } finally {
      setSaving(false);
    }
  };

  const cleanPhoto =
    localFounder.photo && !localFounder.photo.includes('photo-1507003211169-0a1dd7228f2d')
      ? localFounder.photo.trim()
      : '';
  const hasPhoto = Boolean(cleanPhoto);


  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-16 animate-in fade-in">
      {/* 100% Light Rose/Cream Hero Banner — Zero Dark Background */}
      <div className="relative bg-gradient-to-br from-[#FFF5F7] via-[#FFF0F3] to-[#FFE4E8] text-stone-900 border-b border-rose-200 py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onBackToHome}
                className="inline-flex items-center gap-2 text-xs font-bold text-stone-800 hover:text-[#E11D48] transition-colors cursor-pointer bg-white px-3.5 py-2 rounded-xl shadow-2xs border border-rose-200"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#E11D48]" />
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
                    className="inline-flex items-center gap-1.5 text-xs font-bold bg-white hover:bg-rose-50 text-[#E11D48] px-3.5 py-2 rounded-xl border border-rose-300 shadow-2xs cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#E11D48]" />
                    <span>ফাউন্ডার ছবি ও প্রোফাইল এডিট</span>
                  </button>
                )}
                <button
                  onClick={() => setIsEditingPage(!isEditingPage)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#E11D48] hover:bg-[#BE123C] text-white px-4 py-2 rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingPage ? 'এডিট বন্ধ করুন' : '✎ সম্পূর্ণ ব্র্যান্ড পরিচিতি এডিট করুন'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 space-y-3">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white text-[#E11D48] border border-rose-200 text-xs font-extrabold tracking-wider uppercase shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ভেরিফাইড ব্র্যান্ড পরিচিতি • Dokandari Official</span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight leading-tight">
                {localPage.aboutHeadline}
              </h1>
              <p className="text-xs sm:text-base text-stone-700 max-w-2xl leading-relaxed font-medium">
                {localPage.aboutSubtitle}
              </p>
            </div>

            <div className="lg:col-span-4 grid grid-cols-2 gap-2.5">
              <div className="bg-white border border-rose-200 rounded-2xl p-3.5 text-center shadow-2xs">
                <span className="block text-xl sm:text-2xl font-black text-[#E11D48]">{totalProductsCount}+</span>
                <span className="text-[11px] font-bold text-stone-600">অরিজিনাল পণ্য</span>
              </div>
              <div className="bg-white border border-rose-200 rounded-2xl p-3.5 text-center shadow-2xs">
                <span className="block text-xl sm:text-2xl font-black text-emerald-700">৬৪ জেলা</span>
                <span className="text-[11px] font-bold text-stone-600">হোম ডেলিভারি</span>
              </div>
              <div className="bg-white border border-rose-200 rounded-2xl p-3.5 text-center shadow-2xs">
                <span className="block text-xl sm:text-2xl font-black text-stone-900">১০০%</span>
                <span className="text-[11px] font-bold text-stone-600">পার্সেল খুলে দেখার সুবিধা</span>
              </div>
              <div className="bg-white border border-rose-200 rounded-2xl p-3.5 text-center shadow-2xs">
                <span className="block text-xl sm:text-2xl font-black text-[#E11D48]">৭ দিন</span>
                <span className="text-[11px] font-bold text-stone-600">সহজ এক্সচেঞ্জ গ্যারান্টি</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl text-xs font-extrabold flex items-center justify-between shadow-sm animate-in fade-in">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </span>
          </div>
        )}

        {/* Live Full-Page Editor Box for Admin */}
        {isAdmin && isEditingPage && (
          <form
            onSubmit={handleSaveAllAboutAndFounder}
            className="bg-white rounded-3xl border-2 border-[#E11D48] p-5 sm:p-6 shadow-xl space-y-4 text-xs animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <h3 className="text-sm font-extrabold text-[#E11D48] flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                <span>ব্র্যান্ড পরিচিতি, ফাউন্ডার প্রোফাইল ও সকল সেকশন লাইভ এডিটর (সরাসরি ডোমেইনে সেভ হবে)</span>
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
                placeholder="AI নির্দেশনা লিখুন (যেমন: প্রিমিয়াম ব্র্যান্ড স্টোরি, ফাউন্ডার বার্তা ও অর্গানিক ফুড সোর্সিং সাজিয়ে দাও)..."
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">প্রতিষ্ঠাতা ও সিইও-এর নাম</label>
                  <input
                    type="text"
                    value={localFounder.name}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setLocalFounder({ ...localFounder, name: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">পদবী ও ডেজিগনেশন (CEO Title)</label>
                  <input
                    type="text"
                    value={localFounder.title}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setLocalFounder({ ...localFounder, title: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">প্রতিষ্ঠাতার সংক্ষিপ্ত পরিচিতি (Founder Bio)</label>
                <textarea
                  rows={2}
                  value={localFounder.bio}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setLocalFounder({ ...localFounder, bio: e.target.value });
                  }}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">সিইও-এর বিশেষ বার্তা (CEO Message)</label>
                <textarea
                  rows={2}
                  value={localPage.ceoMessageText ?? ''}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setLocalPage({ ...localPage, ceoMessageText: e.target.value });
                  }}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    ঠিকানা ১ (শোরুম ও ওয়্যারহাউজ)
                  </label>
                  <input
                    type="text"
                    value={localPage.warehouseAddress ?? ''}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setLocalPage({ ...localPage, warehouseAddress: e.target.value });
                      setLocalFounder((prev) => ({ ...prev, address: e.target.value }));
                    }}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    ঠিকানা ২ (কর্পোরেট অফিস)
                  </label>
                  <input
                    type="text"
                    value={localPage.corporateAddress ?? ''}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setLocalPage({ ...localPage, corporateAddress: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">হটলাইন নম্বর</label>
                  <input
                    type="text"
                    value={localFounder.phone ?? ''}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setLocalFounder({ ...localFounder, phone: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">পেইজ শিরোনাম (Headline)</label>
                  <input
                    type="text"
                    value={localPage.aboutHeadline ?? ''}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setLocalPage({ ...localPage, aboutHeadline: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">সাবটাইটেল / বিবরণ (Subtitle)</label>
                  <input
                    type="text"
                    value={localPage.aboutSubtitle ?? ''}
                    onChange={(e) => {
                      isDirtyRef.current = true;
                      setLocalPage({ ...localPage, aboutSubtitle: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">আমাদের বিজনেস স্টোরি ও যাত্রা (Business Story)</label>
                <textarea
                  rows={3}
                  value={localPage.businessStoryText ?? ''}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setLocalPage({ ...localPage, businessStoryText: e.target.value });
                  }}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">প্রোডাক্ট সোর্সিং ও ১০০% অর্গানিক ফুড কালেকশন (Product Sourcing)</label>
                <textarea
                  rows={3}
                  value={localPage.productSourcingText ?? ''}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setLocalPage({ ...localPage, productSourcingText: e.target.value });
                  }}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">আমাদের বিজনেস পলিসি ও কাস্টমার গ্যারান্টি (Business Policy)</label>
                <textarea
                  rows={3}
                  value={localPage.businessPolicyText ?? ''}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setLocalPage({ ...localPage, businessPolicyText: e.target.value });
                  }}
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'সেভ হচ্ছে...' : 'লাইভ ডাটাবেজে ও ডোমেইনে সেভ করুন'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ===================================================================== */}
        {/* 1. TOP SECTION: প্রতিষ্ঠাতা ও সিইও পরিচিতি (FOUNDER & CEO SECTION) */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-3xl border border-rose-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3 border-b border-rose-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#FFF1F2] text-[#E11D48] flex items-center justify-center font-black border border-rose-200">
                ০১
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900">
                  প্রতিষ্ঠাতা ও সিইও পরিচিতি (Founder &amp; CEO Profile)
                </h2>
                <p className="text-[11px] text-stone-500">
                  Dokandari Bangladesh-এর প্রতিষ্ঠাতা ও প্রধান নির্বাহী কর্মকর্তার পরিচিতি ও বার্তা
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="px-3 py-1.5 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{saving ? 'আপলোড হচ্ছে...' : '📸 ছবি আপলোড / পরিবর্তন'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleDirectPhotoUpload}
                    className="hidden"
                  />
                </label>

                {hasPhoto && (
                  <button
                    type="button"
                    onClick={handleDirectRemovePhoto}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>ছবি রিমুভ</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (onEditFounder) {
                      onEditFounder();
                    } else {
                      setEditingFounderInline(!editingFounderInline);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>✎ ফাউন্ডার প্রোফাইল এডিট</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-7">
            {/* Founder Photo Box */}
            <div className="flex flex-col items-center gap-2.5 shrink-0">
              <div className="relative w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden border-4 border-rose-100 shadow-md bg-gradient-to-br from-[#FFF1F2] via-rose-100 to-rose-200 flex items-center justify-center">
                {hasPhoto ? (
                  <img
                    src={cleanPhoto}
                    alt={localFounder.name}
                    loading="eager"
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
                <div className="absolute bottom-2 left-2 right-2 bg-white/95 backdrop-blur-xs text-[#E11D48] border border-rose-200 text-[10px] text-center font-extrabold py-1 rounded-lg shadow-2xs">
                  {localFounder.title || 'Founder & CEO, Dokandari'}
                </div>
              </div>
            </div>

            {/* Founder Name, Designation, Bio & CEO Message */}
            <div className="space-y-4 flex-1 text-center md:text-left">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF1F2] text-[#E11D48] border border-rose-200 text-xs font-extrabold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{localFounder.title || 'Founder & CEO, Dokandari'}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-stone-900 mt-2">
                  {localFounder.name}
                </h3>
                <p className="text-xs font-bold text-stone-500 mt-0.5">
                  প্রতিষ্ঠাতা ও প্রধান নির্বাহী কর্মকর্তা — Dokandari Bangladesh (dokandari.com)
                </p>
              </div>

              <div className="bg-[#FFF5F7] p-4 rounded-2xl border border-rose-200 space-y-2 text-left">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#E11D48] block">
                  প্রতিষ্ঠাতার পরিচিতি ও লক্ষ্য:
                </span>
                <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-medium">
                  "{localFounder.bio || 'আমাদের লক্ষ্য প্রতিটি গ্রাহককে সততা, সর্বোচ্চ কোয়ালিটি এবং ঝামেলামুক্ত ক্যাশ অন ডেলিভারি সেবা প্রদান করা।'}"
                </p>
              </div>

              <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-1.5 text-left">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-700 block">
                  সিইও-এর বার্তা (Message from the CEO):
                </span>
                <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                  {localPage.ceoMessageText ||
                    DEFAULT_STORE_CONTENT.pageContent!.ceoMessageText}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1">
                <button
                  onClick={onOpenStoreProducts || onBackToHome}
                  className="px-5 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  আমাদের কালেকশন দেখুন &rarr;
                </button>
                <a
                  href="https://wa.me/8801885533437"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 border border-stone-300 hover:bg-stone-50 text-stone-800 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>সরাসরি হোয়াটসঅ্যাপে কথা বলুন</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2. SECOND SECTION: যোগাযোগ ও অফিসের ঠিকানা (CONTACT & OFFICIAL ADDRESSES) */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-3xl border border-rose-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="border-b border-rose-100 pb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#FFF1F2] text-[#E11D48] flex items-center justify-center font-black border border-rose-200">
                ০২
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900">
                  যোগাযোগ ও অফিসের ঠিকানা (Official Addresses &amp; Contact)
                </h3>
                <p className="text-[11px] text-stone-500">
                  আমাদের শোরুম, ওয়্যারহাউজ, কর্পোরেট অফিস ও সরাসরি কাস্টমার কেয়ার হটলাইন
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditingPage(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>✎ ঠিকানা ও নম্বর এডিট করুন</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-stone-700">
            <div className="bg-[#FFF8F9] p-4 rounded-2xl border border-rose-100 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold block text-stone-900">ঠিকানা ১ (শোরুম ও ওয়্যারহাউজ)</span>
                <span className="text-stone-700 block leading-relaxed">
                  {localPage.warehouseAddress ||
                    localFounder.address ||
                    'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)'}
                </span>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Jaleshwar+Savar+Dhaka+1340+Bangladesh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E11D48] hover:underline pt-1"
                >
                  <span>📍 Google Map লোকেশন &rarr;</span>
                </a>
              </div>
            </div>

            <div className="bg-[#FFF8F9] p-4 rounded-2xl border border-rose-100 flex items-start gap-3">
              <Building2 className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold block text-stone-900">ঠিকানা ২ (কর্পোরেট অফিস)</span>
                <span className="text-stone-700 block leading-relaxed">
                  {localPage.corporateAddress ||
                    'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা'}
                </span>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Shahid+Plaza+Savar+Bus+Stand+Dhaka+Bangladesh"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#E11D48] hover:underline pt-1"
                >
                  <span>📍 Google Map লোকেশন &rarr;</span>
                </a>
              </div>
            </div>

            <div className="bg-[#FFF8F9] p-4 rounded-2xl border border-rose-100 flex items-start gap-3">
              <Phone className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold block text-stone-900">হটলাইন ও হোয়াটসঅ্যাপ</span>
                <a
                  href={`tel:${localFounder.phone && !localFounder.phone.includes('09638757282') ? localFounder.phone : '01348282356'}`}
                  className="font-mono font-bold text-stone-800 hover:text-[#E11D48] block"
                >
                  হটলাইন: {localFounder.phone && !localFounder.phone.includes('09638757282') ? localFounder.phone : '01348282356'}
                </a>
                <a
                  href="https://wa.me/8801885533437"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-bold text-emerald-700 hover:underline block"
                >
                  WhatsApp: 01885533437
                </a>
                <span className="text-[10px] text-stone-500 block">সকাল ১০টা — রাত ১০টা (প্রতিদিন)</span>
              </div>
            </div>

            <div className="bg-[#FFF8F9] p-4 rounded-2xl border border-rose-100 flex items-start gap-3">
              <Mail className="w-5 h-5 text-[#E11D48] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-extrabold block text-stone-900">অফিশিয়াল ইমেইল ও ওয়েবসাইট</span>
                <a
                  href="mailto:dokandari.shop@gmail.com"
                  className="font-mono font-bold text-stone-800 hover:text-[#E11D48] block break-all"
                >
                  dokandari.shop@gmail.com
                </a>
                <span className="text-[11px] font-bold text-[#E11D48] block">www.dokandari.com</span>
                <span className="text-[10px] text-stone-500 block">২৪/৭ অনলাইন অর্ডার সাপোর্ট</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 3. THIRD SECTION: আমাদের বিজনেস স্টোরি ও যাত্রা (BUSINESS STORY)       */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-3xl border border-rose-200 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="border-b border-rose-100 pb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#FFF1F2] text-[#E11D48] flex items-center justify-center font-black border border-rose-200">
                ০৩
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900">
                  আমাদের বিজনেস স্টোরি ও যাত্রা (Our Business Story)
                </h3>
                <p className="text-[11px] text-stone-500">
                  গ্রাহকের আস্থা, সততা ও গুণগত মানের ওপর ভিত্তি করে গড়ে ওঠা Dokandari-এর পথচলা
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditingPage(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>✎ বিজনেস স্টোরি এডিট করুন</span>
              </button>
            )}
          </div>

          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-[#FFF8F9] p-5 rounded-2xl border border-rose-100">
            {localPage.businessStoryText ||
              DEFAULT_STORE_CONTENT.pageContent!.businessStoryText}
          </p>
        </div>

        {/* ===================================================================== */}
        {/* 4. FOURTH SECTION: প্রোডাক্ট সোর্সিং ও অর্গানিক ফুড কালেকশন             */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-3xl border border-emerald-200 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="border-b border-emerald-100 pb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#16A34A] flex items-center justify-center font-black border border-emerald-200">
                <Leaf className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900">
                  প্রোডাক্ট সোর্সিং ও ১০০% অর্গানিক ফুড কালেকশন (Product Sourcing &amp; Organic Food)
                </h3>
                <p className="text-[11px] text-stone-500">
                  সরাসরি ইমপোর্টকৃত লাইফস্টাইল পণ্য এবং কেমিক্যালমুক্ত খাঁটি অর্গানিক ফুডের নিশ্চয়তা
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditingPage(true)}
                className="px-3.5 py-1.5 rounded-xl bg-[#ECFDF5] hover:bg-emerald-100 text-[#15803D] border border-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>✎ প্রোডাক্ট সোর্সিং এডিট করুন</span>
              </button>
            )}
          </div>

          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-[#F0FDF4] p-5 rounded-2xl border border-emerald-200">
            {localPage.productSourcingText ||
              DEFAULT_STORE_CONTENT.pageContent!.productSourcingText}
          </p>
        </div>

        {/* ===================================================================== */}
        {/* 5. FIFTH SECTION: আমাদের বিজনেস পলিসি ও কাস্টমার গ্যারান্টি             */}
        {/* ===================================================================== */}
        <div className="bg-white rounded-3xl border border-rose-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="border-b border-rose-100 pb-4 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#FFF1F2] text-[#E11D48] flex items-center justify-center font-black border border-rose-200">
                <FileText className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-stone-900">
                  আমাদের বিজনেস পলিসি ও কাস্টমার গ্যারান্টি (Business Policy &amp; Customer Guarantee)
                </h3>
                <p className="text-[11px] text-stone-500">
                  ওপেন পার্সেল চেক, ক্যাশ অন ডেলিভারি এবং ৭ দিনের সহজ রিটার্ন ও এক্সচেঞ্জ সুবিধা
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsEditingPage(true)}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>✎ বিজনেস পলিসি এডিট করুন</span>
              </button>
            )}
          </div>

          <p className="text-xs sm:text-sm text-stone-700 leading-relaxed bg-[#FFF8F9] p-5 rounded-2xl border border-rose-100">
            {localPage.businessPolicyText ||
              DEFAULT_STORE_CONTENT.pageContent!.businessPolicyText}
          </p>

          {/* 4 Pillars Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-stone-200 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-extrabold text-stone-900">১০০% অরিজিনাল ও খাঁটি পণ্য</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                প্রতিটি পণ্য নিজস্ব ওয়্যারহাউজে ৩ ধাপে কোয়ালিটি চেক করে প্যাকিং করা হয়।
              </p>
            </div>

            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-stone-200 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#E11D48] flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-extrabold text-stone-900">ওপেন পার্সেল ক্যাশ অন ডেলিভারি</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                অগ্রিম ১ টাকাও ছাড়াই সারা বাংলাদেশে ডেলিভারিম্যানের সামনে খুলে দেখে পেমেন্ট।
              </p>
            </div>

            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-stone-200 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-extrabold text-stone-900">৭ দিনের রিটার্ন ও এক্সচেঞ্জ</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                পণ্য পছন্দ না হলে বা ত্রুটি থাকলে ৭ দিনের মধ্যে ঝামেলাহীন এক্সচেঞ্জ বা রিটার্ন।
              </p>
            </div>

            <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-stone-200 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-extrabold text-stone-900">ডেডিকেটেড কাস্টমার কেয়ার</h4>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                হটলাইন কল এবং হোয়াটসঅ্যাপে আমাদের সাপোর্ট টিম প্রতিদিন আপনার সেবায় প্রস্তুত।
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
