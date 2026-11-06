/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Save, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Product, OFFICIAL_CATEGORIES } from '../types';
import { parseEmbedVideoUrl } from '../lib/gemini';
import { saveProductPersisted, deleteProductPersisted } from '../lib/storeSync';

interface ProductEditModalProps {
  product: Product | null;
  onClose: () => void;
  onProductUpdated: (updated: Product) => void;
  onProductDeleted?: (productId: string) => void;
}

export const ProductEditModal: React.FC<ProductEditModalProps> = ({
  product,
  onClose,
  onProductUpdated,
  onProductDeleted,
}) => {
  if (!product) return null;

  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price);
  const [originalPrice, setOriginalPrice] = useState(product.originalPrice || product.price + 500);
  const [category, setCategory] = useState(product.category);
  const [fabric, setFabric] = useState(product.fabric || '');
  const [inStock, setInStock] = useState(product.inStock);
  const [imageUrl, setImageUrl] = useState(product.images[0] || '');
  const [videoUrl, setVideoUrl] = useState(product.videos?.[0] || '');
  const [colorsStr, setColorsStr] = useState(product.variants?.colors?.join(', ') || '');
  const [sizesStr, setSizesStr] = useState(product.variants?.sizes?.join(', ') || '');
  const [description, setDescription] = useState(product.description);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback('');

    const colors = colorsStr
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const sizes = sizesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const numPrice = Number(price) || 0;
    const numOrig = Number.isFinite(Number(originalPrice)) ? Number(originalPrice) : numPrice;

    const updatedProduct: Product = {
      ...product,
      name,
      price: numPrice,
      originalPrice: numOrig,
      category: category as any,
      fabric,
      inStock,
      description,
      images: imageUrl ? [imageUrl, ...product.images.slice(1)] : product.images,
      videos: videoUrl.trim() ? [videoUrl.trim(), ...(product.videos?.slice(1) || [])] : [],
      variants: {
        colors,
        sizes,
      },
      comboConfig: product.comboConfig
        ? {
            ...product.comboConfig,
            pkg1Price: numPrice,
            pkg2Price: Math.max(numPrice, numPrice * 2 - Number(product.comboConfig.pkg2Discount ?? 100)),
            pkg3Price: Math.max(numPrice, numPrice * 3 - Number(product.comboConfig.pkg3Discount ?? 200)),
          }
        : undefined,
      updatedAt: Date.now(),
    };

    try {
      const persisted = await saveProductPersisted(updatedProduct);
      onProductUpdated(persisted);
      setFeedback('প্রোডাক্ট সফলভাবে ডাটাবেজে আপডেট হয়েছে!');
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err) {
      console.warn('Firestore write warning, updated locally', err);
      onProductUpdated(updatedProduct);
      setFeedback('প্রোডাক্ট আপডেট সম্পন্ন হয়েছে!');
      setTimeout(() => {
        onClose();
      }, 800);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (onProductDeleted) onProductDeleted(product.id);
      await deleteProductPersisted(product.id);
      onClose();
    } catch (err) {
      if (onProductDeleted) onProductDeleted(product.id);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-stone-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-[#F59E0B] text-stone-900 font-bold text-xs">
              ✏️ এডিট
            </span>
            <h3 className="text-sm font-bold text-stone-900">
              প্রোডাক্ট তথ্য সম্পাদনা (Live Edit)
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {feedback && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedback}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Product Name */}
          <div>
            <label className="block text-stone-700 font-bold mb-1">প্রোডাক্টের নাম *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 font-medium"
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 font-bold mb-1">বিক্রয় মূল্য (৳ BDT) *</label>
              <input
                type="number"
                required
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold text-rose-700"
              />
            </div>

            <div>
              <label className="block text-stone-700 font-bold mb-1">পূর্বের মূল্য (Strikethrough)</label>
              <input
                type="number"
                value={originalPrice}
                onChange={(e) => setOriginalPrice(Number(e.target.value))}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-mono"
              />
            </div>
          </div>

          {/* Category & Stock */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 font-bold mb-1">ক্যাটাগরি *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
              >
                {OFFICIAL_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {cat.nameBn}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-stone-700 font-bold mb-1">স্টক স্ট্যাটাস</label>
              <select
                value={inStock ? 'yes' : 'no'}
                onChange={(e) => setInStock(e.target.value === 'yes')}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-bold"
              >
                <option value="yes">✔️ ইন স্টক (In Stock)</option>
                <option value="no">❌ স্টক আউট (Out of Stock)</option>
              </select>
            </div>
          </div>

          {/* Fabric */}
          <div>
            <label className="block text-stone-700 font-bold mb-1">ফ্যাব্রিক / মেটেরিয়াল স্পেসিফিকেশন</label>
            <input
              type="text"
              value={fabric}
              onChange={(e) => setFabric(e.target.value)}
              placeholder="যেমন: অরিজিনাল দুবাই চেরি জর্জেট"
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg"
            />
          </div>

          {/* Variants */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 font-bold mb-1">কালার সমূহ (কমা দিয়ে লিখুন)</label>
              <input
                type="text"
                value={colorsStr}
                onChange={(e) => setColorsStr(e.target.value)}
                placeholder="Black, Navy, Emerald"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-stone-700 font-bold mb-1">সাইজ সমূহ (কমা দিয়ে লিখুন)</label>
              <input
                type="text"
                value={sizesStr}
                onChange={(e) => setSizesStr(e.target.value)}
                placeholder="34 (M), 36 (L), 38 (XL)..."
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-stone-700 font-bold mb-1">প্রধান ছবির লিঙ্ক (Image URL)</label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg"
            />
          </div>

          {/* YouTube / Video URL with Live Preview */}
          <div className="space-y-2">
            <label className="block text-stone-700 font-bold">
              🎥 প্রোডাক্ট ভিডিও লিঙ্ক (YouTube / Shorts / MP4 Video URL)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="যেমন: https://www.youtube.com/watch?v=... অথবা https://youtu.be/..."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-mono text-[11px]"
            />
            {videoUrl.trim() && (
              <div className="rounded-xl overflow-hidden bg-black aspect-video border border-stone-300">
                {(() => {
                  const embed = parseEmbedVideoUrl(videoUrl);
                  return embed.type === 'iframe' ? (
                    <iframe
                      src={embed.src}
                      title="Video Preview"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video src={embed.src} controls playsInline className="w-full h-full object-contain" />
                  );
                })()}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-stone-700 font-bold mb-1">বিস্তারিত বিবরণ</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>মুছে ফেলুন</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-stone-300 hover:bg-stone-50 text-stone-700 rounded-lg font-bold"
              >
                বাতিল
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'সংরক্ষণ হচ্ছে...' : 'আপডেট করুন'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
