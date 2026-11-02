/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import {
  ChevronRight,
  ChevronLeft,
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
  Plus,
  Sparkles,
} from 'lucide-react';
import { Product, ProductCategory, OFFICIAL_CATEGORIES } from '../types';
import { ProductCard } from './ProductCard';
import {
  CategoryHeroConfig,
  DEFAULT_CATEGORY_HEROES,
  compressImageFileToDataUrl,
  resolveSafeProductImageUrl,
  handleProductImageError,
} from '../lib/storeSync';

interface CategoryDetailPageProps {
  categoryId: ProductCategory;
  products: Product[];
  onBackToHome: () => void;
  onSelectCategory: (cat: ProductCategory) => void;
  onOpenProductDetail: (product: Product) => void;
  onInstantOrder: (product: Product) => void;
  onEditProduct?: (product: Product) => void;
  onAddNewCategoryProduct?: (categoryId: string) => void;
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
  onAddNewCategoryProduct,
  categoryHeroes,
  isAdmin,
  onSaveCategoryHero,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'price_asc' | 'price_desc' | 'rating'>('popular');
  const bestSellingRef = useRef<HTMLDivElement | null>(null);

  const isOrganic = categoryId === 'organic_food';

  const foundCategory = OFFICIAL_CATEGORIES.find((c) => c.id === categoryId);
  const activeHero: CategoryHeroConfig = useMemo(() => {
    const custom = categoryHeroes?.[categoryId];
    const fallback = DEFAULT_CATEGORY_HEROES[categoryId] || {
      title: foundCategory?.nameBn || 'সকল এক্সক্লুসিভ কালেকশন',
      subtitle:
        'Dokandari আন্তর্জাতিক মানের প্রিমিয়াম প্রডাক্ট কালেকশন। সরাসরি ১০০% অরিজিনাল কোয়ালিটি ও ক্যাশ অন ডেলিভারি নিশ্চয়তা।',
      image:
        foundCategory?.image ||
        '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
      tag: foundCategory?.nameBn || 'স্পেশাল কালেকশন',
      ctaText: isOrganic ? 'অর্গানিক ফুড দেখুন' : 'কালেকশন দেখুন',
    };
    return custom ? { ...fallback, ...custom } : fallback;
  }, [categoryHeroes, categoryId, foundCategory, isOrganic]);

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
    setEditCtaText(activeHero.ctaText || (isOrganic ? 'অর্গানিক ফুড দেখুন' : 'কালেকশন দেখুন'));
    setIsEditingHero(true);
  };

  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHeroImg(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 960, 0.78);
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
        ctaText: editCtaText.trim() || (isOrganic ? 'অর্গানিক ফুড দেখুন' : 'কালেকশন দেখুন'),
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
      if (isOrganic && (p.category === 'organic_food' || p.category === 'fashion_clothing')) {
        return true;
      }
      return p.category === categoryId;
    });
  }, [products, categoryId, isOrganic]);

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

  const bestSellingList = useMemo(() => {
    return categoryProducts.slice(0, 8);
  }, [categoryProducts]);

  return (
    <div
      className={`min-h-screen pb-16 animate-in fade-in ${
        isOrganic ? 'bg-[#F4FBF7]' : 'bg-[#FAF9F6]'
      }`}
    >
      {/* Dedicated Light-Theme Category Hero Banner Section (Soft Green for Organic Food, Soft Rose for other categories) */}
      <div
        className={`relative w-full overflow-hidden py-6 sm:py-10 border-b ${
          isOrganic
            ? 'bg-gradient-to-br from-[#F0FDF4] via-[#ECFDF5] to-[#DCFCE7] border-emerald-200 text-stone-900'
            : 'bg-gradient-to-br from-[#FFF5F7] via-[#FFF0F3] to-[#FFE4E8] border-rose-200 text-stone-900'
        }`}
      >
        <div className="w-full px-3 sm:px-6 lg:px-8 space-y-5">
          {/* Top Bar: Breadcrumb + Admin Edit Hero & Add Product Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <nav
              className={`flex items-center gap-2 text-xs font-semibold ${
                isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'
              }`}
            >
              <button
                onClick={onBackToHome}
                className="hover:underline transition-colors cursor-pointer flex items-center gap-1 font-extrabold bg-white px-3 py-1.5 rounded-xl border border-stone-200 shadow-2xs text-stone-800"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>মেইন হোমপেজ</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              <span className="text-stone-600">ক্যাটালগ #{foundCategory?.order || 3}</span>
              <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              <span className="font-extrabold text-stone-900">
                {foundCategory?.nameBn || 'সকল প্রোডাক্ট'}
              </span>
            </nav>

            {isAdmin && (
              <div className="flex items-center gap-2 flex-wrap">
                {onAddNewCategoryProduct && (
                  <button
                    type="button"
                    onClick={() => onAddNewCategoryProduct(categoryId)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-white text-xs font-extrabold shadow-xs cursor-pointer transition-all ${
                      isOrganic
                        ? 'bg-[#16A34A] hover:bg-[#15803D]'
                        : 'bg-[#E11D48] hover:bg-[#BE123C]'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>এই ক্যাটাগরিতে নতুন প্রোডাক্ট যোগ করুন</span>
                  </button>
                )}
                {onSaveCategoryHero && (
                  <button
                    type="button"
                    onClick={openHeroEditor}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-stone-950 text-xs font-extrabold shadow-xs cursor-pointer transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>✎ হিরো ব্যানার এডিট করুন</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Organic Food gets the Rich Hero Section; All other categories get a sleek thin display banner without promo text */}
          {isOrganic ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-3.5">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-white text-xs font-extrabold tracking-wide shadow-2xs bg-[#16A34A]">
                  <img
                    src={foundCategory?.image || activeHero.image}
                    alt={foundCategory?.nameBn || ''}
                    className="w-4 h-4 rounded-full object-cover border border-white/60"
                    referrerPolicy="no-referrer"
                  />
                  <span>{activeHero.tag || foundCategory?.nameBn}</span>
                </div>

                <h1 className="text-xl sm:text-4xl font-extrabold tracking-tight text-stone-900 leading-tight">
                  {activeHero.title}
                </h1>

                <p className="text-xs sm:text-base text-stone-700 leading-relaxed font-medium max-w-2xl">
                  {activeHero.subtitle}
                </p>

                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const gridEl = document.getElementById('category-products-grid');
                      if (gridEl) gridEl.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-5 py-2.5 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-sm cursor-pointer transition-all bg-gradient-to-r from-[#16A34A] to-[#15803D] hover:from-[#15803D] hover:to-[#166534]"
                  >
                    {activeHero.ctaText || 'অর্গানিক ফুড দেখুন'} &rarr;
                  </button>

                  <span className="px-3.5 py-2 rounded-xl bg-white border text-xs font-extrabold shadow-2xs border-emerald-200 text-[#15803D]">
                    মোট {categoryProducts.length}টি বাছাইকৃত অর্গানিক ফুড স্টক
                  </span>
                </div>

                {/* Value Badges in Organic Light Mode */}
                <div className="pt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-stone-800">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border shadow-2xs border-emerald-200">
                    <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                    <span>১০০% কেমিক্যালমুক্ত ও খাঁটি অর্গানিক</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border shadow-2xs border-emerald-200">
                    <Truck className="w-4 h-4 text-[#16A34A]" />
                    <span>ক্যাশ অন ডেলিভারি (খুলে দেখে পেমেন্ট)</span>
                  </span>
                </div>
              </div>

              {/* Right Column: Organic Showcase Image */}
              <div className="lg:col-span-5">
                <div className="relative rounded-3xl overflow-hidden bg-white border-2 p-2 shadow-md border-emerald-200">
                  <div className="relative aspect-16/10 w-full rounded-2xl overflow-hidden bg-stone-50">
                    <img
                      src={resolveSafeProductImageUrl(activeHero.image, categoryProducts[0], 0)}
                      alt={activeHero.title}
                      onError={(e) => handleProductImageError(e, categoryProducts[0], 0)}
                      loading="eager"
                      decoding="async"
                      className="w-full h-full object-cover object-center"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-xs border border-emerald-200 flex items-center justify-between shadow-sm">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider block text-[#15803D]">
                          🌿 Dokandari Organic Store
                        </span>
                        <span className="text-xs font-extrabold text-stone-900 line-clamp-1">
                          {foundCategory?.nameBn} — সরাসরি ফার্ম থেকে সংগৃহীত
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold text-white shrink-0 bg-[#16A34A]">
                        ১০০% খাঁটি
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Non-Organic Categories: Sleek, Thin Full-Width Display Banner — Zero Promotional Clutter */
            <div className="relative w-full h-24 sm:h-32 rounded-2xl overflow-hidden border border-rose-200 shadow-xs bg-stone-100">
              <img
                src={resolveSafeProductImageUrl(activeHero.image, categoryProducts[0], 0)}
                alt={foundCategory?.nameBn || activeHero.title}
                onError={(e) => handleProductImageError(e, categoryProducts[0], 0)}
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/75 via-stone-950/40 to-transparent flex items-center px-4 sm:px-6">
                <div className="text-white space-y-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E11D48] text-white uppercase tracking-wider inline-block">
                    {foundCategory?.nameBn}
                  </span>
                  <h1 className="text-sm sm:text-xl font-black text-white drop-shadow-sm">
                    {foundCategory?.nameBn} — অফিশিয়াল কালেকশন
                  </h1>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline Modal for Editing Category Hero Banner */}
      {isEditingHero && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`bg-white rounded-2xl border max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              isOrganic ? 'border-emerald-300' : 'border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  ক্যাটাগরি হিরো ব্যানার কাস্টমাইজেশন ({foundCategory?.nameBn})
                </h3>
                <p className="text-[11px] text-stone-500">
                  এই ক্যাটাগরির হিরো ছবি, টাইটেল ও সাবটাইটেল পরিবর্তন করলে সাথে সাথে লাইভ ডোমেইনে আপডেট হবে।
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
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#16A34A]"
                  placeholder="যেমন: 🌿 ১০০% অর্গানিক ও কেমিক্যালমুক্ত ফুড"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">হিরো প্রধান শিরোনাম (Headline)</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#16A34A] font-bold"
                  placeholder="ক্যাটাগরি হিরো টাইটেল..."
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">হিরো সাবটাইটেল (Subtitle)</label>
                <textarea
                  rows={2}
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#16A34A]"
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
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-300 focus:outline-none"
                    placeholder="https://..."
                  />
                  <label
                    className={`px-3.5 py-2 rounded-xl border font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                      isOrganic
                        ? 'bg-[#ECFDF5] hover:bg-emerald-100 text-[#15803D] border-emerald-200'
                        : 'bg-rose-50 hover:bg-rose-100 text-[#E11D48] border-rose-200'
                    }`}
                  >
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
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none"
                  placeholder="অর্গানিক ফুড দেখুন"
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
                  className={`px-5 py-2 rounded-xl text-white font-extrabold flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    isOrganic
                      ? 'bg-[#16A34A] hover:bg-[#15803D]'
                      : 'bg-[#E11D48] hover:bg-[#BE123C]'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingHero ? 'সেভ হচ্ছে...' : 'লাইভ সেভ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="w-full px-3 sm:px-6 lg:px-8 mt-6 space-y-7">
        {/* Quick Category Switcher Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => onSelectCategory('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              categoryId === 'all'
                ? 'bg-[#E11D48] text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
            }`}
          >
            সব পণ্য
          </button>
          {OFFICIAL_CATEGORIES.map((cat) => {
            const active = categoryId === cat.id;
            const catIsGreen = cat.id === 'organic_food';
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 ${
                  active
                    ? catIsGreen
                      ? 'bg-[#16A34A] text-white shadow-xs ring-2 ring-emerald-200'
                      : 'bg-[#E11D48] text-white shadow-xs'
                    : catIsGreen
                    ? 'bg-[#ECFDF5] hover:bg-emerald-100 text-[#15803D] border border-emerald-200'
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
            );
          })}
        </div>

        {/* Standalone Website Section 1: Best-Selling Spotlight Carousel for this Category */}
        {bestSellingList.length > 0 && !searchQuery.trim() && (
          <section
            className={`bg-white rounded-2xl border p-3.5 sm:p-5 shadow-2xs space-y-3.5 ${
              isOrganic ? 'border-emerald-200' : 'border-rose-200/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-8 h-8 rounded-xl text-white flex items-center justify-center text-sm font-bold shrink-0 ${
                    isOrganic ? 'bg-[#16A34A]' : 'bg-[#E11D48]'
                  }`}
                >
                  {isOrganic ? '🌿' : '🔥'}
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xs sm:text-lg font-extrabold text-stone-900">
                      {isOrganic
                        ? 'বেস্ট সেলিং অর্গানিক ফুড ও সুপারফুড (Best Selling Organic)'
                        : `বেস্ট সেলিং ${foundCategory?.nameBn || ''} কালেকশন`}
                    </h2>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        isOrganic
                          ? 'bg-[#ECFDF5] text-[#15803D] border-emerald-200'
                          : 'bg-rose-50 text-[#E11D48] border-rose-200'
                      }`}
                    >
                      টপ রেটেড ★ 5.0
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    {isOrganic
                      ? 'গ্রাহকদের সবচেয়ে পছন্দের ১০০% খাঁটি ও কেমিক্যালমুক্ত অর্গানিক ফুড আইটেম'
                      : 'সবচেয়ে বেশি অর্ডারকৃত প্রিমিয়াম কালেকশন'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (bestSellingRef.current) {
                      bestSellingRef.current.scrollBy({ left: -220, behavior: 'smooth' });
                    }
                  }}
                  className={`w-8 h-8 rounded-xl border bg-stone-50 flex items-center justify-center cursor-pointer ${
                    isOrganic
                      ? 'border-emerald-200 text-[#15803D] hover:bg-[#ECFDF5]'
                      : 'border-rose-200 text-[#E11D48] hover:bg-rose-50'
                  }`}
                  title="বামে যান"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (bestSellingRef.current) {
                      bestSellingRef.current.scrollBy({ left: 220, behavior: 'smooth' });
                    }
                  }}
                  className={`w-8 h-8 rounded-xl border bg-stone-50 flex items-center justify-center cursor-pointer ${
                    isOrganic
                      ? 'border-emerald-200 text-[#15803D] hover:bg-[#ECFDF5]'
                      : 'border-rose-200 text-[#E11D48] hover:bg-rose-50'
                  }`}
                  title="ডানে যান"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div
              ref={bestSellingRef}
              className="flex items-stretch gap-3 overflow-x-auto scroll-smooth pb-1 scrollbar-none"
            >
              {bestSellingList.map((item) => (
                <div
                  key={`cat-bs-${item.id}`}
                  className="w-[155px] sm:w-[190px] md:w-[205px] shrink-0"
                >
                  <ProductCard
                    compact
                    greenTheme={isOrganic}
                    product={item}
                    onOpenDetail={onOpenProductDetail}
                    onInstantOrder={onInstantOrder}
                    onEditProduct={onEditProduct}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Filter & Sorting Bar */}
        <div
          id="category-products-grid"
          className={`bg-white rounded-2xl border p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isOrganic ? 'border-emerald-200' : 'border-rose-200/80'
          }`}
        >
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs sm:text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
              <SlidersHorizontal
                className={`w-4 h-4 ${isOrganic ? 'text-[#16A34A]' : 'text-[#E11D48]'}`}
              />
              <span>
                {foundCategory?.nameBn || 'সকল প্রোডাক্ট'} — মোট {filteredProducts.length} টি পণ্য
              </span>
            </span>
            {isAdmin && (
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  isOrganic
                    ? 'bg-[#ECFDF5] text-[#15803D] border-emerald-200'
                    : 'bg-rose-50 text-[#E11D48] border-rose-200'
                }`}
              >
                ✎ প্রতিটি কার্ডের উপরে ‘এডিট’ বাটনে ক্লিক করে ছবি, দাম ও নাম পরিবর্তন করতে পারবেন
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`${foundCategory?.nameBn || 'এই ক্যাটাগরিতে'} খুঁজুন...`}
                className={`w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:bg-white ${
                  isOrganic ? 'focus:border-[#16A34A]' : 'focus:border-[#E11D48]'
                }`}
              />
            </div>

            {/* Sort Select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className={`px-3 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-700 cursor-pointer focus:outline-none ${
                isOrganic ? 'focus:border-[#16A34A]' : 'focus:border-[#E11D48]'
              }`}
            >
              <option value="popular">জনপ্রিয় পণ্য (Popular)</option>
              <option value="price_asc">দাম: কম থেকে বেশি (Low &rarr; High)</option>
              <option value="price_desc">দাম: বেশি থেকে কম (High &rarr; Low)</option>
              <option value="rating">সর্বোচ্চ রেটিং (Top Rated ★)</option>
            </select>
          </div>
        </div>

        {/* Full Product Grid */}
        {filteredProducts.length === 0 ? (
          <div
            className={`bg-white rounded-3xl border p-12 text-center space-y-4 shadow-xs ${
              isOrganic ? 'border-emerald-200' : 'border-rose-100'
            }`}
          >
            <img
              src={foundCategory?.image || activeHero.image}
              alt={foundCategory?.nameBn || ''}
              className={`w-16 h-16 rounded-2xl object-cover mx-auto border ${
                isOrganic ? 'border-emerald-200' : 'border-rose-200'
              }`}
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
              className={`px-6 py-2.5 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-colors ${
                isOrganic
                  ? 'bg-[#16A34A] hover:bg-[#15803D]'
                  : 'bg-[#E11D48] hover:bg-[#BE123C]'
              }`}
            >
              সকল পণ্য দেখুন &rarr;
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                greenTheme={isOrganic}
                product={product}
                onOpenDetail={onOpenProductDetail}
                onInstantOrder={onInstantOrder}
                onEditProduct={onEditProduct}
              />
            ))}
          </div>
        )}

        {/* Organic Food Purity Assurance Footer Strip (Only on Organic Food Landing Page) */}
        {isOrganic && (
          <section className="bg-gradient-to-r from-[#ECFDF5] via-[#F0FDF4] to-[#DCFCE7] rounded-3xl border border-emerald-200 p-5 sm:p-7 shadow-2xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/90 rounded-2xl p-4 border border-emerald-200/80 space-y-1.5">
                <span className="text-xs font-extrabold text-[#15803D] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#16A34A]" />
                  <span>১০০% প্রাকৃতিক ও কেমিক্যালমুক্ত উৎস</span>
                </span>
                <p className="text-xs text-stone-600 leading-relaxed">
                  সুন্দরবনের চাকের মধু, পাবনার দানাদার গাওয়া ঘি, তেঁতুল কাঠের ঘানির সরিষার তেল ও প্রিমিয়াম খেজুর সরাসরি প্রাকৃতিক উৎস থেকে সংগৃহীত।
                </p>
              </div>
              <div className="bg-white/90 rounded-2xl p-4 border border-emerald-200/80 space-y-1.5">
                <span className="text-xs font-extrabold text-[#15803D] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                  <span>ওপেন-পার্সেল ক্যাশ অন ডেলিভারি</span>
                </span>
                <p className="text-xs text-stone-600 leading-relaxed">
                  সারা বাংলাদেশে অগ্রিম ১ টাকাও পেমেন্ট ছাড়া অর্ডার করুন। ডেলিভারি ম্যানের সামনে প্যাক খুলে ঘ্রাণ ও মান যাচাই করে মূল্য পরিশোধ করুন।
                </p>
              </div>
              <div className="bg-white/90 rounded-2xl p-4 border border-emerald-200/80 space-y-1.5">
                <span className="text-xs font-extrabold text-[#15803D] flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-[#16A34A]" />
                  <span>৭ দিনের ১০০% মানি-ব্যাক ও রিপ্লেসমেন্ট</span>
                </span>
                <p className="text-xs text-stone-600 leading-relaxed">
                  খাবারের মান বা স্বাদে বিন্দুমাত্র অতৃপ্তি থাকলে ৭ দিনের মধ্যে সম্পূর্ণ ফ্রি রিটার্ন বা ইনস্ট্যান্ট রিপ্লেসমেন্ট সুবিধা।
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
