/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Check, Upload, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { FounderData } from './FounderSection';
import {
  getInitialStoreContent,
  saveStoreContentPersisted,
  compressImageFileToDataUrl,
  StoreContent,
} from '../lib/storeSync';

interface FounderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  founderData: FounderData;
  onSave: (updated: FounderData, updatedStore?: StoreContent) => void;
}

export const FounderEditModal: React.FC<FounderEditModalProps> = ({
  isOpen,
  onClose,
  founderData,
  onSave,
}) => {
  const initialStore = getInitialStoreContent();
  const [name, setName] = useState(founderData.name || '');
  const [title, setTitle] = useState(founderData.title || '');
  const [photo, setPhoto] = useState(
    founderData.photo && !founderData.photo.includes('photo-1507003211169-0a1dd7228f2d')
      ? founderData.photo
      : ''
  );
  const [bio, setBio] = useState(founderData.bio || '');
  const [address, setAddress] = useState(
    founderData.address ?? initialStore.pageContent?.warehouseAddress ?? ''
  );
  const [corporateAddress, setCorporateAddress] = useState(
    initialStore.pageContent?.corporateAddress ?? ''
  );
  const [phone, setPhone] = useState(founderData.phone ?? '');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string>('');

  const wasOpenRef = useRef(false);
  const isDirtyRef = useRef(false);

  // Initialize form state ONLY when modal transitions from closed -> open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const store = getInitialStoreContent();
      setName(founderData.name ?? '');
      setTitle(founderData.title ?? '');
      const cleanInitialPhoto =
        founderData.photo && !founderData.photo.includes('photo-1507003211169-0a1dd7228f2d')
          ? founderData.photo
          : '';
      setPhoto(cleanInitialPhoto);
      setBio(founderData.bio ?? '');
      setAddress(founderData.address ?? store.pageContent?.warehouseAddress ?? '');
      setCorporateAddress(store.pageContent?.corporateAddress ?? '');
      setPhone(founderData.phone ?? '');
      isDirtyRef.current = false;
      setAutoSaveStatus('');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, founderData]);

  // Real-time debounced auto-save to Firestore whenever admin edits any field
  useEffect(() => {
    if (!isOpen || !isDirtyRef.current) return;
    setAutoSaveStatus('⚡ রিয়েল-টাইম ডাটাবেজে সেভ হচ্ছে...');
    const timer = setTimeout(async () => {
      const updated: FounderData = {
        name: name.trim(),
        title: title.trim(),
        photo: photo.trim(),
        bio: bio.trim(),
        address: address.trim(),
        phone: phone.trim(),
      };
      try {
        const current = getInitialStoreContent();
        const mergedStore = await saveStoreContentPersisted({
          founder: updated,
          pageContent: {
            ...current.pageContent!,
            warehouseAddress: address.trim(),
            corporateAddress: corporateAddress.trim(),
          },
        });
        onSave(updated, mergedStore);
        setAutoSaveStatus('✓ লাইভ ডাটাবেজে অটো-সেভ সম্পন্ন');
      } catch (err) {
        console.warn('Realtime founder auto-save note:', err);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [name, title, photo, bio, address, corporateAddress, phone, isOpen]);

  if (!isOpen) return null;

  const persistImmediately = async (overridePhoto?: string) => {
    setSaving(true);
    setAutoSaveStatus('⚡ রিয়েল-টাইম ডাটাবেজে সেভ হচ্ছে...');
    const finalPhoto = overridePhoto !== undefined ? overridePhoto : photo.trim();
    const updated: FounderData = {
      name: name.trim(),
      title: title.trim(),
      photo: finalPhoto,
      bio: bio.trim(),
      address: address.trim(),
      phone: phone.trim(),
    };
    try {
      const current = getInitialStoreContent();
      const mergedStore = await saveStoreContentPersisted({
        founder: updated,
        pageContent: {
          ...current.pageContent!,
          warehouseAddress: address.trim(),
          corporateAddress: corporateAddress.trim(),
        },
      });
      onSave(updated, mergedStore);
      setAutoSaveStatus('✓ লাইভ ডাটাবেজে স্থায়ীভাবে সেভ হয়েছে');
      return mergedStore;
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setAutoSaveStatus('⚡ ছবি সার্ভার ও ক্লাউডে আপলোড হচ্ছে...');
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
        console.warn('Server upload fallback to compressed dataUrl:', err);
      }

      isDirtyRef.current = true;
      setPhoto(finalPhotoUrl);
      await persistImmediately(finalPhotoUrl);
      setAutoSaveStatus('✓ ছবি স্থায়ীভাবে সংরক্ষিত হয়েছে');
    } catch (err) {
      console.warn('Founder photo upload error:', err);
      setAutoSaveStatus('❌ ছবি আপলোডে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePhotoNow = async () => {
    isDirtyRef.current = true;
    setPhoto('');
    await persistImmediately('');
  };

  const handleAiGenerateBio = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch('/api/gemini/ai-edit-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'founder_brand',
          prompt:
            aiPrompt.trim() ||
            `প্রতিষ্ঠাতা: ${name}, পদবী: ${title}। Dokandari বাংলাদেশের শীর্ষস্থানীয় প্রিমিয়াম ই-কমার্স ব্র্যান্ড। একটি সুন্দর, বিশ্বাসযোগ্য ও আকর্ষণীয় বাংলা ফাউন্ডার বায়ো ও ব্র্যান্ড পরিচিতি তৈরি করুন।`,
          imageDataUrl: photo && photo.startsWith('data:image/') ? photo : undefined,
          currentData: {
            name,
            title,
            bio,
            warehouseAddress: address,
            corporateAddress,
          },
        }),
      });
      const json = await res.json();
      if (json?.data) {
        isDirtyRef.current = true;
        if (json.data.name) setName(json.data.name);
        if (json.data.title) setTitle(json.data.title);
        if (json.data.bio) setBio(json.data.bio);
        if (json.data.warehouseAddress) setAddress(json.data.warehouseAddress);
        if (json.data.corporateAddress) setCorporateAddress(json.data.corporateAddress);
      }
    } catch (err) {
      console.warn('AI bio generation fallback:', err);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await persistImmediately();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-rose-200 text-xs space-y-4 my-auto max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-rose-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-extrabold text-stone-900">
                প্রতিষ্ঠাতা প্রোফাইল, ব্র্যান্ড পরিচিতি ও অফিসের ঠিকানা এডিট করুন
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                {autoSaveStatus || '⚡ রিয়েল-টাইম অটো-সেভ চালু'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 mt-0.5">
              যেখানেই লিখুন, লিংক পেস্ট করুন বা ছবি রিমুভ করুন — সাথে সাথে লাইভ ডাটাবেজে অটোমেটিক সেভ হয়ে যাবে
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Smart Auto-Fill Bar */}
        <div className="bg-[#FFF5F7] border border-rose-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-[#E11D48] flex items-center gap-1.5 text-xs">
              <Sparkles className="w-4 h-4" />
              <span>✨ AI দিয়ে ফাউন্ডার বায়ো ও ব্র্যান্ড পরিচিতি সাজান</span>
            </span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="সংক্ষেপে লিখুন (যেমন: প্রিমিয়াম কাস্টমার সার্ভিস ও সততার বার্তা দিয়ে বায়ো সাজাও)..."
              className="flex-1 px-3 py-2 bg-white border border-rose-200 rounded-lg text-xs outline-none focus:border-[#E11D48]"
            />
            <button
              type="button"
              onClick={handleAiGenerateBio}
              disabled={aiGenerating}
              className="px-3.5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              {aiGenerating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{aiGenerating ? 'তৈরি হচ্ছে...' : '✨ AI অটো-ফিল'}</span>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Founder Photo Preview + Upload + Remove */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-2.5">
            <label className="block text-stone-800 font-bold">
              প্রতিষ্ঠাতার ছবি (আপলোড করুন, লিংক দিন অথবা ছবি রিমুভ করুন)
            </label>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-rose-200 bg-white flex items-center justify-center shrink-0">
                {photo.trim() ? (
                  <img
                    src={photo}
                    alt={name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-stone-400 text-center px-2">
                    ছবি নেই (Monogram)
                  </span>
                )}
              </div>

              <div className="flex-1 w-full space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold rounded-lg flex items-center gap-1.5 cursor-pointer text-[11px]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>📁 গ্যালারি থেকে ছবি আপলোড</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>

                  {photo.trim() && (
                    <button
                      type="button"
                      onClick={handleRemovePhotoNow}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 font-bold rounded-lg flex items-center gap-1 cursor-pointer text-[11px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>🗑️ ছবি রিমুভ করুন (অটো-সেভ)</span>
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={photo}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setPhoto(e.target.value);
                  }}
                  placeholder="অথবা ছবির সরাসরি লিংক (URL) দিন (ফাঁকা রাখলে ছবি রিমুভ থাকবে)..."
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-[11px]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 font-bold mb-1">প্রতিষ্ঠাতার নাম</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  isDirtyRef.current = true;
                  setName(e.target.value);
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-bold mb-1">পদবী ও ডেজিগনেশন</label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  isDirtyRef.current = true;
                  setTitle(e.target.value);
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-700 font-bold mb-1">ব্র্যান্ড বায়ো / বিবরণ</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => {
                isDirtyRef.current = true;
                setBio(e.target.value);
              }}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 font-bold mb-1">
                ঠিকানা ১ (উপরের ঠিকানা — শোরুম ও ওয়্যারহাউজ)
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  isDirtyRef.current = true;
                  setAddress(e.target.value);
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-stone-700 font-bold mb-1">
                ঠিকানা ২ (নিচের ঠিকানা — কর্পোরেট অফিস)
              </label>
              <input
                type="text"
                value={corporateAddress}
                onChange={(e) => {
                  isDirtyRef.current = true;
                  setCorporateAddress(e.target.value);
                }}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-stone-700 font-bold mb-1">হটলাইন নম্বর</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => {
                isDirtyRef.current = true;
                setPhone(e.target.value);
              }}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 cursor-pointer"
            >
              বন্ধ করুন
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : saved ? 'সংরক্ষিত হয়েছে' : 'সেভ ও বন্ধ করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


