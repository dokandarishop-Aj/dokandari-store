/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ArrowLeft,
  SlidersHorizontal,
  Search,
  ShieldCheck,
  Truck,
  RotateCcw,
  Edit3,
  Upload,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Product, ProductCategory, OFFICIAL_CATEGORIES } from '../types';
import { ProductCard } from './ProductCard';
import {
  CategoryHeroConfig,
  DEFAULT_CATEGORY_HEROES,
  compressImageFileToDataUrl,
} from '../lib/storeSync';

interface CategoryDetailPageProps {
  categoryId: ProductCategory;
  products: Product[];
  onBackToHome: () => void;
  onSelectCategory: (cat: ProductCategory) => void;
  onOpenProductDetail: (product: Product) => void;
  onInstantOrder: (product: Product) => void;
  onEditProduct?: (product: Product) => void;
  categoryHeroes?: Record<string, CategoryHeroConfig>;
  isAdmin?: boolean;
  onSaveCategoryHero?: (categoryId: string, config: CategoryHeroConfig) => Promise<void> | void;
}

export const CategoryDetailPage: React.FC<CategoryDetailPageProps> = ({
  categoryId,
  products,
  onBackToHome,
  onSelectCategory,
  onOpenProductDetail,
  onInstantOrder,
  onEditProduct,
  categoryHeroes,
  isAdmin,
  onSaveCategoryHero,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'rating'>('popular');

  const foundCategory = OFFICIAL_CATEGORIES.find((c) => c.id === categoryId);
  const activeHero: CategoryHeroConfig = useMemo(() => {
    const custom = categoryHeroes?.[categoryId];
    const fallback = DEFAULT_CATEGORY_HEROES[categoryId] || {
      title: foundCategory?.nameBn || 'সকল এক্সক্লুসিভ কালেকশন',
      subtitle:
        'Dokandari আন্তর্জাতিক মানের প্রিমিয়াম প্রডাক্ট কালেকশন। সরাসরি ১০০% অরিজিনাল কোয়ালিটি ও ক্যাশ অন ডেলিভারি নিশ্চয়তা।',
      image:
        foundCategory?.image ||
        'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80',
      tag: foundCategory?.nameBn || 'স্পেশাল কালেকশন',
      ctaText: 'কালেকশন দেখুন',
    };
    return custom ? { ...fallback, ...custom } : fallback;
  }, [categoryHeroes, categoryId, foundCategory]);

  // Inline Category Hero Editor modal state
  const [isEditingHero, setIsEditingHero] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editTag, setEditTag] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editCtaText, setEditCtaText] = useState('');
  const [isUploadingHeroImg, setIsUploadingHeroImg] = useState(false);
  const [isSavingHero, setIsSavingHero] = useState(false);

  const openHeroEditor = () => {
    setEditTitle(activeHero.title);
    setEditSubtitle(activeHero.subtitle);
    setEditTag(activeHero.tag);
    setEditImage(activeHero.image);
    setEditCtaText(activeHero.ctaText || 'কালেকশন দেখুন');
    setIsEditingHero(true);
  };

  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHeroImg(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 1280, 0.82);
      setEditImage(dataUrl);
    } catch (err) {
      console.warn('Hero image upload error:', err);
    } finally {
      setIsUploadingHeroImg(false);
    }
  };

  const handleSaveHero = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveCategoryHero) return;
    setIsSavingHero(true);
    try {
      await onSaveCategoryHero(categoryId, {
        title: editTitle.trim() || activeHero.title,
        subtitle: editSubtitle.trim() || activeHero.subtitle,
        tag: editTag.trim() || activeHero.tag,
        image: editImage.trim() || activeHero.image,
        ctaText: editCtaText.trim() || 'কালেকশন দেখুন',
      });
      setIsEditingHero(false);
    } finally {
      setIsSavingHero(false);
    }
  };

  // Filter products for this specific category
  const categoryProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.status === 'draft') return false;
      if (categoryId === 'all') return true;
      return p.category === categoryId;
    });
  }, [products, categoryId]);

  // Apply search & sorting
  const filteredProducts = useMemo(() => {
    const list = categoryProducts.filter((p) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        p.name.toLowerCase().includes(q) ||
        (p.titleEn && p.titleEn.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q))
      );
    });

    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 5) - (a.rating || 5));
    }
    return list;
  }, [categoryProducts, searchQuery, sortBy]);

  return (
    <div className="bg-[#FAF9F6] min-h-screen pb-16 animate-in fade-in">
      {/* Dedicated Editable Category Hero Banner Section */}
      <div className="relative w-full bg-stone-900 text-white overflow-hidden py-8 sm:py-14">
        <div className="absolute inset-0 z-0">
          <img
            src={activeHero.image}
            alt={activeHero.title}
            loading="eager"
            decoding="async"
            className="w-full h-full object-cover object-center opacity-55"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/70 to-stone-950/35 z-10" />

        <div className="relative z-20 w-full px-3 sm:px-6 lg:px-8 space-y-4">
          {/* Top Bar: Breadcrumb + Admin Edit Hero Button */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <nav className="flex items-center gap-2 text-xs text-rose-200">
              <button
                onClick={onBackToHome}
                className="hover:text-white transition-colors cursor-pointer flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>হোম</span>
              </button>
              <ChevronRight className="w-3 h-3 text-rose-400" />
              <span className="font-semibold text-rose-100">ক্যাটাগরি</span>
              <ChevronRight className="w-3 h-3 text-rose-400" />
              <span className="text-white font-bold">
                {foundCategory?.nameBn || 'সকল প্রোডাক্ট'}
              </span>
            </nav>

            {isAdmin && onSaveCategoryHero && (
              <button
                type="button"
                onClick={openHeroEditor}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-stone-950 text-xs font-extrabold shadow-md cursor-pointer transition-all"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>হিরো ব্যানার এডিট করুন</span>
              </button>
            )}
          </div>

          <div className="max-w-2xl space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E11D48] text-white text-[11px] font-extrabold tracking-wide shadow-xs">
              <img
                src={foundCategory?.image || activeHero.image}
                alt={foundCategory?.nameBn || ''}
                className="w-4 h-4 rounded-full object-cover border border-white/50"
                referrerPolicy="no-referrer"
              />
              <span>{activeHero.tag || foundCategory?.nameBn}</span>
            </div>

            <h1 className="text-xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              {activeHero.title}
            </h1>

            <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-medium">
              {activeHero.subtitle}
            </p>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  const gridEl = document.getElementById('category-products-grid');
                  if (gridEl) gridEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition-all"
              >
                {activeHero.ctaText || 'কালেকশন দেখুন'} &rarr;
              </button>
            </div>
          </div>

          {/* Value Badges */}
          <div className="pt-2 flex flex-wrap items-center gap-2.5 text-[11px] font-bold text-white/95">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>১০০% অরিজিনাল গ্যারান্টি</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
              <Truck className="w-4 h-4 text-rose-400" />
              <span>ক্যাশ অন ডেলিভারি (পার্সেল খুলে দেখার সুবিধা)</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>৭ দিনের সহজ এক্সচেঞ্জ</span>
            </span>
          </div>
        </div>
      </div>

      {/* Inline Modal for Editing Category Hero Banner */}
      {isEditingHero && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-rose-200 max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  ক্যাটাগরি হিরো ব্যানার কাস্টমাইজেশন ({foundCategory?.nameBn})
                </h3>
                <p className="text-[11px] text-stone-500">
                  এই ক্যাটাগরির হিরো ছবি, টাইটেল ও সাবটাইটেল পরিবর্তন করলে সাথে সাথে লাইভ আপডেট হবে।
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingHero(false)}
                className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveHero} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">হিরো ব্যানার ট্যাগ (Tag)</label>
                <input
                  type="text"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#E11D48]"
                  placeholder="যেমন: হোম ডেকোর স্পেশাল"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">হিরো প্রধান শিরোনাম (Headline)</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#E11D48] font-bold"
                  placeholder="ক্যাটাগরি হিরো টাইটেল..."
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">হিরো সাবটাইটেল (Subtitle)</label>
                <textarea
                  rows={2}
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#E11D48]"
                  placeholder="বিস্তারিত সাবটাইটেল..."
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  হিরো ব্যানার ছবি (সরাসরি ফাইল আপলোড বা Image URL)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editImage}
                    onChange={(e) => setEditImage(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#E11D48]"
                    placeholder="https://..."
                  />
                  <label className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingHeroImg ? 'আপলোড হচ্ছে...' : 'ছবি আপলোড'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeroFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {editImage && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-stone-200 h-28 bg-stone-100">
                    <img
                      src={editImage}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">বাটন টেক্সট (Button Text)</label>
                <input
                  type="text"
                  value={editCtaText}
                  onChange={(e) => setEditCtaText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#E11D48]"
                  placeholder="কালেকশন দেখুন"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingHero(false)}
                  className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 font-bold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingHero}
                  className="px-5 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingHero ? 'সেভ হচ্ছে...' : 'হিরো ব্যানার সেভ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div id="category-products-grid" className="w-full px-3 sm:px-6 lg:px-8 mt-6 space-y-6">
        {/* Quick Category Switcher Pills with Real Category Thumbnails (No raw icon strings) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => onSelectCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              categoryId === 'all'
                ? 'bg-[#E11D48] text-white shadow-xs'
                : 'bg-white hover:bg-rose-50 text-stone-700 border border-stone-200'
            }`}
          >
            সব পণ্য
          </button>
          {OFFICIAL_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                categoryId === cat.id
                  ? 'bg-[#E11D48] text-white shadow-xs'
                  : 'bg-white hover:bg-rose-50 text-stone-700 border border-stone-200'
              }`}
            >
              <img
                src={cat.image}
                alt={cat.nameBn}
                className="w-4 h-4 rounded-full object-cover shrink-0"
                referrerPolicy="no-referrer"
              />
              <span>{cat.nameBn}</span>
            </button>
          ))}
        </div>

        {/* Filter & Sorting Bar */}
        <div className="bg-white rounded-2xl border border-rose-200/80 p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-[#E11D48]" />
              <span>মোট {filteredProducts.length} টি পণ্য পাওয়া গেছে</span>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="এই ক্যাটাগরিতে খুঁজুন..."
                className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:border-[#E11D48] focus:bg-white"
              />
            </div>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-700 cursor-pointer focus:outline-none focus:border-[#E11D48]"
            >
              <option value="popular">জনপ্রিয় পণ্য (Popular)</option>
              <option value="price_asc">দাম: কম থেকে বেশি (Low &rarr; High)</option>
              <option value="price_desc">দাম: বেশি থেকে কম (High &rarr; Low)</option>
              <option value="rating">সর্বোচ্চ রেটিং (Top Rated ★)</option>
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-rose-100 p-12 text-center space-y-4 shadow-xs">
            <img
              src={foundCategory?.image || activeHero.image}
              alt={foundCategory?.nameBn || ''}
              className="w-16 h-16 rounded-2xl object-cover mx-auto border border-rose-200"
              referrerPolicy="no-referrer"
            />
            <div>
              <h3 className="text-base font-extrabold text-stone-900">
                এই ক্যাটাগরিতে বর্তমানে কোনো প্রোডাক্ট পাওয়া যায়নি
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">
                আমাদের অন্যান্য প্রিমিয়াম ক্যাটাগরি ঘুরে দেখুন অথবা সকল প্রোডাক্ট দেখুন।
              </p>
            </div>
            <button
              onClick={() => onSelectCategory('all')}
              className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors"
            >
              সকল পণ্য দেখুন &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpenDetail={onOpenProductDetail}
                onInstantOrder={onInstantOrder}
                onEditProduct={onEditProduct}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
