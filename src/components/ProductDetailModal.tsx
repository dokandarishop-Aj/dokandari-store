/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Star, ShoppingBag, ShieldCheck, Truck, RotateCcw, Check, Zap, Copy, CheckCheck } from 'lucide-react';
import { Product, OFFICIAL_CATEGORIES } from '../types';
import { useCart } from '../context/CartContext';
import { cleanProductTitle, getProductShareUrl, parseEmbedVideoUrl } from '../lib/gemini';
import { OFFICIAL_WHATSAPP_INT } from '../lib/storeSync';
import { WhatsAppBrandIcon } from './ProductCard';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onInstantBuy: (product: Product, color?: string, size?: string, qty?: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onInstantBuy,
}) => {
  if (!product) return null;

  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.variants.colors?.[0] || '');
  const [selectedSize, setSelectedSize] = useState(product.variants.sizes?.[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'details' | 'care' | 'reviews'>('details');
  const [isAdded, setIsAdded] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const displayTitle = cleanProductTitle(product.name);
  const categoryMeta = OFFICIAL_CATEGORIES.find((c) => c.id === product.category);
  const categoryNameBn = categoryMeta?.nameBn || 'অরিজিনাল কালেকশন';

  const handleCopyLink = () => {
    const url = getProductShareUrl(product.id);
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  const handleAddToCart = () => {
    addToCart(product, selectedColor, selectedSize, quantity);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const handleBuyNow = () => {
    onInstantBuy(product, selectedColor, selectedSize, quantity);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-stone-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 z-10 p-2 text-stone-500 hover:text-stone-900 bg-white/80 backdrop-blur-xs rounded-full border border-stone-200 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 sm:p-8">
          
          {/* Left Column: Image Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-stone-100 border border-stone-200">
              <img
                src={product.images[selectedImage] || product.images[0]}
                alt={displayTitle}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
              {product.tag && (
                <span className="absolute top-3 left-3 bg-[#E11D48] text-white text-[11px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-xs">
                  {product.tag}
                </span>
              )}
            </div>

            {/* Thumbnail selector if multiple images */}
            {product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                      selectedImage === idx
                        ? 'border-[#E11D48] ring-2 ring-rose-200'
                        : 'border-stone-200 hover:border-stone-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${displayTitle} view ${idx + 1}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Product Video Player inside Quick View Modal */}
            {product.videos && product.videos.length > 0 && (
              <div className="rounded-xl overflow-hidden bg-stone-950 aspect-video border border-stone-800">
                {(() => {
                  const embed = parseEmbedVideoUrl(product.videos[0]);
                  return embed.type === 'iframe' ? (
                    <iframe
                      src={embed.src}
                      title={`${displayTitle} video`}
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

            {/* Trust Points (100% Bengali) */}
            <div className="bg-rose-50/40 rounded-xl p-4 border border-rose-100 space-y-2 text-xs text-stone-700">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#E11D48] shrink-0" />
                <span>সারা দেশে হোম ডেলিভারি ও ক্যাশ অন ডেলিভারি সুবিধা</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>ওপেন পার্সেল ডেলিভারি — ডেলিভারিম্যানের সামনে দেখে মূল্য পরিশোধ</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
                <span>৭ দিনের সহজ সাইজ বা কালার এক্সচেঞ্জ গ্যারান্টি</span>
              </div>
            </div>
          </div>

          {/* Right Column: Contiguous Purchase Module */}
          <div className="flex flex-col justify-between space-y-6">
            <div>
              {/* Category & Verified Badge - SKU completely hidden from customer view */}
              <div className="flex items-center justify-between text-xs mb-1.5 flex-wrap gap-2">
                <span className="font-bold text-[#E11D48] bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                  {categoryNameBn}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 text-[11px] font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ✔️ dokandari.com ভেরিফাইড
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600 hover:text-[#E11D48] bg-stone-100 hover:bg-rose-50 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                    title="প্রোডাক্ট লিংক কপি করুন"
                  >
                    {linkCopied ? (
                      <>
                        <CheckCheck className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">কপি হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>লিংক কপি</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <h2 className="text-xl sm:text-2xl font-bold text-stone-900 leading-snug">
                {displayTitle} | <span className="text-[#E11D48]">dokandari.com</span>
              </h2>

              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center text-amber-500">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(product.rating) ? 'fill-amber-400' : 'text-stone-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs font-semibold text-stone-800 tabular-nums">
                  {product.rating}
                </span>
                <span className="text-xs text-stone-400">({product.reviewCount} customer reviews)</span>
              </div>

              {/* Price Row */}
              <div className="flex items-baseline gap-3 mt-4">
                <span className="text-2xl font-bold text-stone-950 font-mono tabular-nums">
                  ৳{product.price.toLocaleString()}
                </span>
                {product.originalPrice && (
                  <span className="text-sm text-stone-400 line-through font-mono tabular-nums">
                    ৳{product.originalPrice.toLocaleString()}
                  </span>
                )}
                {discountPercent > 0 && (
                  <span className="text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-sm">
                    {discountPercent}% OFF
                  </span>
                )}
              </div>

              {/* Fabric Specification */}
              {product.fabric && (
                <div className="mt-3 text-xs text-stone-600 bg-stone-100/70 px-3 py-1.5 rounded-md inline-block">
                  <span className="font-medium text-stone-900">Fabric:</span> {product.fabric}
                </div>
              )}

              {/* Color Selector */}
              {product.variants.colors && product.variants.colors.length > 0 && (
                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-900">Color:</span>
                    <span className="text-stone-500">{selectedColor}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          selectedColor === color
                            ? 'border-[#E11D48] bg-[#E11D48] text-white shadow-xs font-bold'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Size Selector */}
              {product.variants.sizes && product.variants.sizes.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-900">সাইজ / মাপ:</span>
                    <span className="text-stone-500 font-semibold">{selectedSize}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {product.variants.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                          selectedSize === size
                            ? 'border-[#E11D48] bg-[#E11D48] text-white shadow-xs font-bold'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-400'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity Stepper */}
              <div className="mt-5 flex items-center gap-4">
                <span className="text-xs font-medium text-stone-900">পরিমাণ:</span>
                <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden bg-white">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 transition-colors font-bold text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-3 py-1.5 text-xs font-mono font-semibold text-stone-900 tabular-nums">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-1.5 text-stone-600 hover:bg-stone-100 transition-colors font-bold text-sm cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* CTAs: Top row = WhatsApp (left) + Cart (right), Bottom row = Full-width Order Now */}
              <div className="mt-6 space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = getProductShareUrl(product.id);
                      const msg = encodeURIComponent(
                        `আসসালামু আলাইকুম, আমি Dokandari থেকে এই প্রোডাক্টটি অর্ডার করতে চাই:\n\nপণ্য: ${displayTitle}\nপরিমাণ: ${quantity} টি\nমূল্য: ৳${product.price * quantity}\nলিংক: ${shareUrl}`
                      );
                      window.open(`https://wa.me/${OFFICIAL_WHATSAPP_INT}?text=${msg}`, '_blank');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold bg-[#10B981] hover:bg-[#059669] text-white flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <WhatsAppBrandIcon className="w-4 h-4 shrink-0" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-[#E11D48] border border-rose-200 hover:bg-rose-50'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-4 h-4 text-white shrink-0" />
                        <span>যুক্ত হয়েছে</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4 text-[#E11D48] shrink-0" />
                        <span>কার্ট</span>
                      </>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  className="w-full py-3.5 px-4 rounded-xl text-sm font-extrabold bg-[#E11D48] hover:bg-[#BE123C] text-white flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <ShoppingBag className="w-4 h-4 text-white shrink-0" />
                  <span>অর্ডার করুন</span>
                </button>
              </div>
            </div>

            {/* Information Tabs */}
            <div className="pt-4 border-t border-stone-200">
              <div className="flex border-b border-stone-200 text-xs">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`pb-2 px-3 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'details'
                      ? 'border-b-2 border-stone-900 text-stone-950'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Description &amp; Highlights
                </button>
                <button
                  onClick={() => setActiveTab('care')}
                  className={`pb-2 px-3 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'care'
                      ? 'border-b-2 border-stone-900 text-stone-950'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Fabric &amp; Care
                </button>
                <button
                  onClick={() => setActiveTab('reviews')}
                  className={`pb-2 px-3 font-semibold transition-colors cursor-pointer ${
                    activeTab === 'reviews'
                      ? 'border-b-2 border-stone-900 text-stone-950'
                      : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Reviews ({product.reviewCount})
                </button>
              </div>

              <div className="pt-3 text-xs text-stone-600 leading-relaxed">
                {activeTab === 'details' && (
                  <div className="space-y-2">
                    <p>{product.description}</p>
                    <ul className="list-disc list-inside space-y-1 text-stone-700 pt-1">
                      {product.features.map((feat, i) => (
                        <li key={i}>{feat}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {activeTab === 'care' && (
                  <div className="space-y-1 text-stone-600">
                    <p>• Dry cleaning or gentle cold water hand wash recommended.</p>
                    <p>• Avoid harsh chemical detergents or bleaching agents.</p>
                    <p>• Iron on low-heat reverse setting for embroidered zari or stone work.</p>
                    <p>• Hang in a dry, ventilated closet away from direct harsh sunlight.</p>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="space-y-3">
                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-stone-800">Farzana Ahmed (Dhaka)</span>
                        <span className="text-amber-500 font-mono">★★★★★</span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        "The fabric quality is beyond expectations! Very breathable and the crystal stonework on the sleeves is neat and elegant."
                      </p>
                    </div>
                    <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-stone-800">Nusrat Jahan (Chattogram)</span>
                        <span className="text-amber-500 font-mono">★★★★★</span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        "Fast delivery via Steadfast courier. I opened the parcel in front of the delivery man, checked the size, and paid in cash. 10/10 service by Dokandari!"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
};
