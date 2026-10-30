/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Save, Check, Upload } from 'lucide-react';
import { FounderData } from './FounderSection';
import {
  getInitialStoreContent,
  saveStoreContentPersisted,
  compressImageFileToDataUrl,
} from '../lib/storeSync';

interface FounderEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  founderData: FounderData;
  onSave: (updated: FounderData) => void;
}

export const FounderEditModal: React.FC<FounderEditModalProps> = ({
  isOpen,
  onClose,
  founderData,
  onSave,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(founderData.name);
  const [title, setTitle] = useState(founderData.title);
  const [photo, setPhoto] = useState(founderData.photo);
  const [bio, setBio] = useState(founderData.bio);
  const [address, setAddress] = useState(founderData.address);
  const [phone, setPhone] = useState(founderData.phone);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const updated: FounderData = {
      name,
      title,
      photo,
      bio,
      address,
      phone,
    };

    try {
      const current = getInitialStoreContent();
      await saveStoreContentPersisted({
        ...current,
        founder: updated,
        pageContent: {
          ...current.pageContent!,
          warehouseAddress: address || current.pageContent?.warehouseAddress || '',
        },
      });
      onSave(updated);
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    } catch (err) {
      console.warn('Founder save fallback', err);
      onSave(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 text-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <h3 className="text-sm font-bold text-stone-900">প্রতিষ্ঠাতা ও ব্র্যান্ড ইনফরমেশন এডিট করুন</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-stone-700 font-bold mb-1">প্রতিষ্ঠাতার নাম</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-stone-700 font-bold mb-1">পদবী ও ডেজিগনেশন</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-stone-700 font-bold mb-1">ছবি URL</label>
            <input
              type="url"
              required
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-stone-700 font-bold mb-1">ব্র্যান্ড বায়ো / বিবরণ</label>
            <textarea
              rows={3}
              required
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 font-bold mb-1">প্রধান কার্যালয়ের ঠিকানা</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-stone-700 font-bold mb-1">হটলাইন নম্বর</label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-lg font-bold flex items-center gap-1.5 cursor-pointer"
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              <span>{saving ? 'সংরক্ষণ হচ্ছে...' : saved ? 'সংরক্ষিত হয়েছে' : 'সেভ করুন'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
