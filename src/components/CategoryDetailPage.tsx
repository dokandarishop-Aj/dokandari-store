/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Copy,
  Check,
} from 'lucide-react';
import { Product, ProductCategory, OFFICIAL_CATEGORIES } from '../types';
import { ProductCard } from './ProductCard';
import {
  CategoryHeroConfig,
  DEFAULT_CATEGORY_HEROES,
  DEFAULT_ORGANIC_FOOD_HERO_SLIDES,
  HeroSlideItem,
  uploadBannerImageToServer,
  resolveSafeProductImageUrl,
  handleProductImageError,
  resolveCategoryIdFromUrl,
} from '../lib/storeSync';
import { getCatalogShareUrl } from '../lib/gemini';

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
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'in_stock' | 'out_of_stock' | 'on_sale'>('all');
  const [priceBracket, setPriceBracket] = useState<'all' | 'under_500' | '500_1000' | '1000_2000' | 'over_2000'>('all');
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [catLinkCopied, setCatLinkCopied] = useState(false);
  const [organicSlideIdx, setOrganicSlideIdx] = useState(0);
  const bestSellingRef = useRef<HTMLDivElement | null>(null);

  const effectiveCategoryId = useMemo(
    () => resolveCategoryIdFromUrl(categoryId),
    [categoryId]
  );

  const isOrganic = effectiveCategoryId === 'organic_food';

  const foundCategory = OFFICIAL_CATEGORIES.find((c) => c.id === effectiveCategoryId);
  const activeHero: CategoryHeroConfig = useMemo(() => {
    const custom = categoryHeroes?.[effectiveCategoryId];
    const fallback = DEFAULT_CATEGORY_HEROES[effectiveCategoryId] || {
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
  }, [categoryHeroes, effectiveCategoryId, foundCategory, isOrganic]);

  const organicSlides: HeroSlideItem[] = useMemo(() => {
    if (Array.isArray(activeHero.slides) && activeHero.slides.length > 0) {
      return activeHero.slides;
    }
    return DEFAULT_ORGANIC_FOOD_HERO_SLIDES;
  }, [activeHero.slides]);

  useEffect(() => {
    if (!isOrganic || organicSlides.length <= 1) return;
    const timer = setInterval(() => {
      setOrganicSlideIdx((prev) => (prev + 1) % organicSlides.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [isOrganic, organicSlides.length]);

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
    if (isOrganic && organicSlides[organicSlideIdx]) {
      const s = organicSlides[organicSlideIdx];
      setEditTitle(s.title);
      setEditSubtitle(s.subtitle);
      setEditTag(s.tag);
      setEditImage(s.image);
      setEditCtaText(s.ctaText || 'অর্গানিক ফুড দেখুন');
    } else {
      setEditTitle(activeHero.title);
      setEditSubtitle(activeHero.subtitle);
      setEditTag(activeHero.tag);
      setEditImage(activeHero.image);
      setEditCtaText(activeHero.ctaText || (isOrganic ? 'অর্গানিক ফুড দেখুন' : 'কালেকশন দেখুন'));
    }
    setIsEditingHero(true);
  };

  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingHeroImg(true);
    try {
      const uploadedUrl = await uploadBannerImageToServer(file, `cat-hero-${effectiveCategoryId}`);
      setEditImage(uploadedUrl);
      if (onSaveCategoryHero) {
        if (isOrganic) {
          const nextSlides = organicSlides.map((s, idx) =>
            idx === organicSlideIdx ? { ...s, image: uploadedUrl } : s
          );
          await onSaveCategoryHero(effectiveCategoryId, {
            ...activeHero,
            image: organicSlideIdx === 0 ? uploadedUrl : activeHero.image,
            slides: nextSlides,
          });
        } else {
          await onSaveCategoryHero(effectiveCategoryId, {
            ...activeHero,
            image: uploadedUrl,
          });
        }
      }
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
      if (isOrganic) {
        const nextSlides = organicSlides.map((s, idx) =>
          idx === organicSlideIdx
            ? {
                ...s,
                title: editTitle.trim() || s.title,
                subtitle: editSubtitle.trim() || s.subtitle,
                tag: editTag.trim() || s.tag,
                image: editImage.trim() || s.image,
                ctaText: editCtaText.trim() || 'অর্গানিক ফুড দেখুন',
              }
            : s
        );
        await onSaveCategoryHero(effectiveCategoryId, {
          ...activeHero,
          title: organicSlideIdx === 0 ? editTitle.trim() || activeHero.title : activeHero.title,
          subtitle: organicSlideIdx === 0 ? editSubtitle.trim() || activeHero.subtitle : activeHero.subtitle,
          tag: organicSlideIdx === 0 ? editTag.trim() || activeHero.tag : activeHero.tag,
          image: organicSlideIdx === 0 ? editImage.trim() || activeHero.image : activeHero.image,
          ctaText: editCtaText.trim() || 'অর্গানিক ফুড দেখুন',
          slides: nextSlides,
        });
      } else {
        await onSaveCategoryHero(effectiveCategoryId, {
          title: editTitle.trim() || activeHero.title,
          subtitle: editSubtitle.trim() || activeHero.subtitle,
          tag: editTag.trim() || activeHero.tag,
          image: editImage.trim() || activeHero.image,
          ctaText: editCtaText.trim() || 'কালেকশন দেখুন',
        });
      }
      setIsEditingHero(false);
    } finally {
      setIsSavingHero(false);
    }
  };

  // Filter products for this specific category (with normalized category & keyword matching)
  // If a category has 0 exact matches on initial load, fall back to published catalog products so /catalog/:catId never renders empty
  const categoryProducts = useMemo(() => {
    const publishedOnly = products.filter((p) => p && p.status !== 'draft');
    const exactMatches = publishedOnly.filter((p) => {
      if (effectiveCategoryId === 'all') return true;
      const normProdCat = resolveCategoryIdFromUrl(p.category, p.name);
      if (
        isOrganic &&
        (p.category === 'organic_food' ||
          p.category === 'fashion_clothing' ||
          normProdCat === 'organic_food')
      ) {
        return true;
      }
      return p.category === effectiveCategoryId || normProdCat === effectiveCategoryId;
    });
    if (exactMatches.length > 0) return exactMatches;
    return publishedOnly.filter(
      (p) => p.category !== 'organic_food' && resolveCategoryIdFromUrl(p.category, p.name) !== 'organic_food'
    );
  }, [products, effectiveCategoryId, isOrganic]);

  // Extract unique available variant attributes (colors & sizes) from this catalog's products
  const { availableColors, availableSizes } = useMemo(() => {
    const colorSet = new Set<string>();
    const sizeSet = new Set<string>();
    categoryProducts.forEach((p) => {
      p.variants?.colors?.forEach((c) => {
        const clean = c?.trim();
        if (clean) colorSet.add(clean);
      });
      p.variants?.sizes?.forEach((s) => {
        const clean = s?.trim();
        if (clean) sizeSet.add(clean);
      });
    });
    return {
      availableColors: Array.from(colorSet).slice(0, 18),
      availableSizes: Array.from(sizeSet).slice(0, 18),
    };
  }, [categoryProducts]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (sortBy !== 'popular') count++;
    if (availabilityFilter !== 'all') count++;
    if (priceBracket !== 'all' || minPriceInput.trim() !== '' || maxPriceInput.trim() !== '') count++;
    count += selectedColors.length;
    count += selectedSizes.length;
    return count;
  }, [sortBy, availabilityFilter, priceBracket, minPriceInput, maxPriceInput, selectedColors, selectedSizes]);

  const resetAllCatalogFilters = () => {
    setSortBy('popular');
    setAvailabilityFilter('all');
    setPriceBracket('all');
    setMinPriceInput('');
    setMaxPriceInput('');
    setSelectedColors([]);
    setSelectedSizes([]);
    setSearchQuery('');
  };

  const toggleColorFilter = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const toggleSizeFilter = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  // Apply search, availability, price, variant attributes & sorting
  const filteredProducts = useMemo(() => {
    const minCustom = minPriceInput.trim() !== '' ? Number(minPriceInput) : null;
    const maxCustom = maxPriceInput.trim() !== '' ? Number(maxPriceInput) : null;

    const list = categoryProducts.filter((p) => {
      // 1. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesText =
          p.name.toLowerCase().includes(q) ||
          (p.titleEn && p.titleEn.toLowerCase().includes(q)) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q));
        if (!matchesText) return false;
      }

      // 2. Availability filter
      const isAvailable = p.inStock !== false && (typeof p.stock !== 'number' || p.stock > 0);
      if (availabilityFilter === 'in_stock' && !isAvailable) return false;
      if (availabilityFilter === 'out_of_stock' && isAvailable) return false;
      if (availabilityFilter === 'on_sale' && !(p.originalPrice && p.originalPrice > p.price)) {
        return false;
      }

      // 3. Price bracket & custom min/max
      const price = Number(p.price) || 0;
      if (priceBracket === 'under_500' && price >= 500) return false;
      if (priceBracket === '500_1000' && (price < 500 || price > 1000)) return false;
      if (priceBracket === '1000_2000' && (price < 1000 || price > 2000)) return false;
      if (priceBracket === 'over_2000' && price <= 2000) return false;
      if (minCustom !== null && !Number.isNaN(minCustom) && price < minCustom) return false;
      if (maxCustom !== null && !Number.isNaN(maxCustom) && price > maxCustom) return false;

      // 4. Variant Colors filter
      if (selectedColors.length > 0) {
        const prodColors = (p.variants?.colors || []).map((c) => c.toLowerCase().trim());
        const hasMatchingColor = selectedColors.some((sc) =>
          prodColors.includes(sc.toLowerCase().trim())
        );
        if (!hasMatchingColor) return false;
      }

      // 5. Variant Sizes filter
      if (selectedSizes.length > 0) {
        const prodSizes = (p.variants?.sizes || []).map((s) => s.toLowerCase().trim());
        const hasMatchingSize = selectedSizes.some((ss) =>
          prodSizes.includes(ss.toLowerCase().trim())
        );
        if (!hasMatchingSize) return false;
      }

      return true;
    });

    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.rating || 5) - (a.rating || 5));
    }
    return list;
  }, [
    categoryProducts,
    searchQuery,
    availabilityFilter,
    priceBracket,
    minPriceInput,
    maxPriceInput,
    selectedColors,
    selectedSizes,
    sortBy,
  ]);

  const bestSellingList = useMemo(() => {
    return categoryProducts.slice(0, 8);
  }, [categoryProducts]);

  return (
    <div
      className={`min-h-screen pb-16 animate-in fade-in ${
        isOrganic ? 'bg-[#F4FBF7]' : 'bg-[#FAF9F6]'
      }`}
    >
      {/* Top Header / Hero Area (Desktop Only — Hidden on Mobile so mobile catalog visitors see products directly below Header):
          - Organic Food gets a Homepage-style Full-Width Bright Hero Banner Carousel on Desktop
          - All other Catalog Pages get a compact, ultra-slim 100% Bright Header Bar on Desktop */}
      <div
        className={`hidden md:block relative w-full overflow-hidden border-b ${
          isOrganic
            ? 'bg-gradient-to-r from-[#ECFDF5] via-[#F9FEFB] to-[#DCFCE7] border-emerald-200 py-3 sm:py-5 text-stone-900'
            : 'bg-gradient-to-r from-[#FFF5F7] via-[#FFFDF9] to-[#FFF0F3] border-rose-200/80 py-2.5 sm:py-3.5 text-stone-900'
        }`}
      >
        <div className="w-full px-3 sm:px-6 lg:px-8 space-y-3">
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
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = getCatalogShareUrl(effectiveCategoryId);
                    navigator.clipboard.writeText(shareUrl).catch(() => null);
                    setCatLinkCopied(true);
                    setTimeout(() => setCatLinkCopied(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-stone-800 border border-stone-200 text-xs font-extrabold shadow-2xs cursor-pointer transition-all"
                  title={getCatalogShareUrl(effectiveCategoryId)}
                >
                  {catLinkCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">ক্যাটালগ লিংক কপি হয়েছে!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#E11D48]" />
                      <span>🔗 ক্যাটালগ লিংক কপি</span>
                    </>
                  )}
                </button>
                {onAddNewCategoryProduct && (
                  <button
                    type="button"
                    onClick={() => onAddNewCategoryProduct(effectiveCategoryId)}
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
                    <span>
                      {isOrganic
                        ? `✎ অর্গানিক স্লাইড #${organicSlideIdx + 1} এডিট`
                        : '✎ ক্যাটাগরি হেডার এডিট'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Organic Food: Full-Display Facebook-Cover Style Bright Hero Banner Carousel */}
          {isOrganic ? (
            <div className="relative w-full h-[165px] sm:h-[235px] md:h-[285px] rounded-2xl bg-[#ECFDF5] border border-emerald-200 shadow-xs overflow-hidden select-none">
              {organicSlides.map((slide, idx) => {
                const activeIdx = organicSlides.length > 0 ? organicSlideIdx % organicSlides.length : 0;
                return (
                  <div
                    key={slide.id || idx}
                    onClick={() => {
                      const gridEl = document.getElementById('category-products-grid');
                      if (gridEl) gridEl.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`absolute inset-0 w-full h-full cursor-pointer transition-opacity duration-700 ${
                      activeIdx === idx ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    }`}
                  >
                    <img
                      src={resolveSafeProductImageUrl(
                        slide.image,
                        categoryProducts[idx % Math.max(1, categoryProducts.length)],
                        0
                      )}
                      alt={slide.title}
                      onError={(e) => handleProductImageError(e, categoryProducts[0], 0)}
                      loading="eager"
                      decoding="async"
                      className="w-full h-full object-cover object-center bg-white"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                );
              })}

              {/* Prev / Next Controls */}
              <button
                type="button"
                onClick={() => setOrganicSlideIdx((prev) => (prev - 1 + organicSlides.length) % organicSlides.length)}
                className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 hover:bg-[#16A34A] text-stone-800 hover:text-white border border-emerald-200 shadow-xs flex items-center justify-center cursor-pointer transition-all"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                type="button"
                onClick={() => setOrganicSlideIdx((prev) => (prev + 1) % organicSlides.length)}
                className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 hover:bg-[#16A34A] text-stone-800 hover:text-white border border-emerald-200 shadow-xs flex items-center justify-center cursor-pointer transition-all"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Slide Dots */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-white/90 px-3 py-1 rounded-full border border-emerald-200 shadow-2xs">
                {organicSlides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setOrganicSlideIdx(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      organicSlideIdx === idx ? 'w-6 bg-[#16A34A]' : 'w-2 bg-emerald-300 hover:bg-emerald-400'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Non-Organic Categories: Ultra-Slim, Compact 100% Bright Header Bar (Zero Black/Dark Placeholders) */
            <div className="w-full rounded-xl bg-white border border-rose-200/90 px-3.5 py-2.5 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl overflow-hidden bg-[#FFFDF9] border border-rose-200 shrink-0 flex items-center justify-center">
                  <img
                    src={resolveSafeProductImageUrl(activeHero.image, categoryProducts[0], 0)}
                    alt={foundCategory?.nameBn || activeHero.title}
                    onError={(e) => handleProductImageError(e, categoryProducts[0], 0)}
                    loading="eager"
                    decoding="async"
                    className="w-full h-full object-cover object-center bg-white"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FFF1F2] text-[#E11D48] border border-rose-200">
                      {foundCategory?.nameBn}
                    </span>
                    <span className="text-[11px] font-bold text-stone-500">
                      মোট {categoryProducts.length}টি অরিজিনাল প্রোডাক্ট
                    </span>
                  </div>
                  <h1 className="text-sm sm:text-base font-extrabold text-stone-900 truncate">
                    {activeHero.title || `${foundCategory?.nameBn} — অফিশিয়াল কালেকশন`}
                  </h1>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-[11px] font-bold text-stone-700">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF5F7] border border-rose-200 text-[#BE123C]">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>১০০% অরিজিনাল গ্যারান্টি</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFF5F7] border border-rose-200 text-stone-800">
                  <Truck className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>ক্যাশ অন ডেলিভারি</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline Modal for Editing Category Hero Banner (Bright Backdrop) */}
      {isEditingHero && (
        <div className="fixed inset-0 z-50 bg-rose-950/25 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`bg-white rounded-2xl border max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
              isOrganic ? 'border-emerald-300' : 'border-rose-200'
            }`}
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900">
                  {isOrganic
                    ? `অর্গানিক ফুড হিরো স্লাইড #${organicSlideIdx + 1} কাস্টমাইজেশন`
                    : `ক্যাটাগরি হেডার কাস্টমাইজেশন (${foundCategory?.nameBn})`}
                </h3>
                <p className="text-[11px] text-stone-500">
                  ছবি আপলোড বা টাইটেল পরিবর্তন করলে সাথে সাথে ডাটাবেজ ও লাইভ ডোমেইনে সেভ হবে।
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
                <label className="block font-bold text-stone-700 mb-1">ব্যানার ট্যাগ (Tag)</label>
                <input
                  type="text"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#16A34A]"
                  placeholder="যেমন: 🌿 ১০০% অর্গানিক ও কেমিক্যালমুক্ত ফুড"
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">প্রধান শিরোনাম (Headline)</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-[#16A34A] font-bold"
                  placeholder="ক্যাটাগরি হিরো টাইটেল..."
                />
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">সাবটাইটেল (Subtitle)</label>
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
                  ছবি (সরাসরি ফাইল আপলোড বা Image URL)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editImage}
                    onChange={(e) => setEditImage(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-stone-300 focus:outline-none"
                    placeholder="/uploads/product/... অথবা https://..."
                  />
                  <label
                    className={`px-3.5 py-2 rounded-xl border font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 shrink-0 ${
                      isOrganic
                        ? 'bg-[#ECFDF5] hover:bg-emerald-100 text-[#15803D] border-emerald-200'
                        : 'bg-rose-50 hover:bg-rose-100 text-[#E11D48] border-rose-200'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingHeroImg ? 'আপলোড ও সেভ হচ্ছে...' : '📸 ছবি আপলোড'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeroFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {editImage && (
                  <div className="mt-2 rounded-xl overflow-hidden border border-stone-200 h-28 bg-white">
                    <img
                      src={editImage}
                      alt="Preview"
                      className="w-full h-full object-cover bg-white"
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

      <div className="w-full px-2.5 sm:px-6 lg:px-8 pt-2.5 md:pt-0 md:mt-6 space-y-3 md:space-y-7">
        {/* Quick Category Switcher Pills (Desktop Only — Mobile shows products directly under Header) */}
        <div className="hidden md:flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
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

        {/* Standalone Website Section 1: Best-Selling Spotlight Carousel for this Category (Desktop Only) */}
        {bestSellingList.length > 0 && !searchQuery.trim() && (
          <section
            className={`hidden md:block bg-white rounded-2xl border p-3.5 sm:p-5 shadow-2xs space-y-3.5 ${
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

        {/* Compact Mobile Filter & Sort Strip (No Hero Image on Mobile — Direct Product Access + Filter Drawer Trigger) */}
        <div className="flex md:hidden items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-stone-200 shadow-2xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={onBackToHome}
              className="p-1.5 rounded-lg bg-stone-100 text-stone-700 shrink-0 cursor-pointer"
              aria-label="হোমপেজে ফিরে যান"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-extrabold text-stone-900 truncate">
              {foundCategory?.nameBn || 'সকল প্রোডাক্ট'} ({filteredProducts.length})
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-bold text-stone-700 focus:outline-none"
            >
              <option value="popular">জনপ্রিয়</option>
              <option value="price_asc">দাম: কম → বেশি</option>
              <option value="price_desc">দাম: বেশি → কম</option>
              <option value="rating">সেরা রেটিং ★</option>
            </select>

            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 cursor-pointer border transition-colors ${
                activeFilterCount > 0
                  ? isOrganic
                    ? 'bg-[#16A34A] text-white border-[#16A34A]'
                    : 'bg-[#E11D48] text-white border-[#E11D48]'
                  : 'bg-stone-900 text-white border-stone-900'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>ফিল্টার</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 bg-white text-stone-900 rounded-full text-[9.5px] font-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Filter & Sorting Bar (Desktop) */}
        <div
          id="category-products-grid"
          className={`hidden md:flex bg-white rounded-2xl border p-3.5 sm:p-4 shadow-2xs flex-col sm:flex-row sm:items-center justify-between gap-3 ${
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {/* Search Input */}
            <div className="relative w-full sm:w-60">
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

            {/* Open Filter Drawer Button */}
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer border transition-all shadow-2xs ${
                activeFilterCount > 0
                  ? isOrganic
                    ? 'bg-[#16A34A] hover:bg-[#15803D] text-white border-[#16A34A]'
                    : 'bg-[#E11D48] hover:bg-[#BE123C] text-white border-[#E11D48]'
                  : 'bg-stone-900 hover:bg-stone-800 text-white border-stone-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>ফিল্টার ও ভ্যারিয়েন্ট</span>
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.2 bg-white text-stone-900 rounded-full text-[10px] font-black">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active Filter Chips Bar (when filters are active) */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap bg-white px-3.5 py-2 rounded-xl border border-stone-200 text-xs">
            <span className="font-bold text-stone-500 text-[11px]">সক্রিয় ফিল্টার:</span>
            {availabilityFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-[#E11D48] border border-rose-200 text-[11px] font-bold">
                <span>
                  {availabilityFilter === 'in_stock'
                    ? 'স্টকে আছে (In Stock)'
                    : availabilityFilter === 'out_of_stock'
                    ? 'স্টক আউট'
                    : 'ডিসকাউন্ট অফার'}
                </span>
                <button
                  type="button"
                  onClick={() => setAvailabilityFilter('all')}
                  className="hover:text-rose-900 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {priceBracket !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold">
                <span>
                  {priceBracket === 'under_500'
                    ? '৳৫০০ এর নিচে'
                    : priceBracket === '500_1000'
                    ? '৳৫০০ - ৳১,০০০'
                    : priceBracket === '1000_2000'
                    ? '৳১,০০০ - ৳২,০০০'
                    : '৳২,০০০+'}
                </span>
                <button
                  type="button"
                  onClick={() => setPriceBracket('all')}
                  className="hover:text-amber-950 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(minPriceInput || maxPriceInput) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold">
                <span>
                  দাম: ৳{minPriceInput || '0'} - ৳{maxPriceInput || '∞'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMinPriceInput('');
                    setMaxPriceInput('');
                  }}
                  className="hover:text-amber-950 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedColors.map((col) => (
              <span
                key={`chip-col-${col}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px] font-bold"
              >
                <span>রঙ: {col}</span>
                <button
                  type="button"
                  onClick={() => toggleColorFilter(col)}
                  className="hover:text-indigo-950 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedSizes.map((sz) => (
              <span
                key={`chip-sz-${sz}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200 text-[11px] font-bold"
              >
                <span>সাইজ: {sz}</span>
                <button
                  type="button"
                  onClick={() => toggleSizeFilter(sz)}
                  className="hover:text-teal-950 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={resetAllCatalogFilters}
              className="ml-auto text-[11px] font-extrabold text-[#E11D48] hover:underline cursor-pointer"
            >
              সব ফিল্টার মুছুন
            </button>
          </div>
        )}

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

      {/* SLIDE-OVER CATALOG FILTER & SORT DRAWER */}
      {isFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-stone-950/60 backdrop-blur-xs animate-in fade-in">
          <div
            className="fixed inset-0"
            onClick={() => setIsFilterDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-sm bg-white h-full shadow-2xl border-l border-stone-200 flex flex-col justify-between overflow-hidden">
            {/* Drawer Header */}
            <div
              className={`p-4 border-b flex items-center justify-between ${
                isOrganic
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-rose-50/70 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`p-2 rounded-xl text-white ${
                    isOrganic ? 'bg-[#16A34A]' : 'bg-[#E11D48]'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-stone-900">
                    প্রোডাক্ট ফিল্টার ও সর্টিং
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    দাম, স্টক এবং ভ্যারিয়েন্ট অনুযায়ী পছন্দসই পণ্য খুঁজুন
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className="p-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-600 border border-stone-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
              {/* 1. Sort By (Price Low/High, Popularity, Rating) */}
              <div className="space-y-2">
                <label className="block font-extrabold text-stone-900 text-xs">
                  ১. সাজানোর ক্রম (Sort By Price & Rating)
                </label>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { id: 'popular', label: '🔥 জনপ্রিয় পণ্য (Default Popular)' },
                    { id: 'price_asc', label: '⬆️ দাম: কম থেকে বেশি (Price: Low to High)' },
                    { id: 'price_desc', label: '⬇️ দাম: বেশি থেকে কম (Price: High to Low)' },
                    { id: 'rating', label: '⭐ সর্বোচ্চ কাস্টমার রেটিং (Top Rated)' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortBy(opt.id as any)}
                      className={`w-full px-3 py-2.5 rounded-xl border text-left font-bold flex items-center justify-between cursor-pointer transition-all ${
                        sortBy === opt.id
                          ? isOrganic
                            ? 'bg-emerald-50 border-[#16A34A] text-[#15803D]'
                            : 'bg-rose-50 border-[#E11D48] text-[#E11D48]'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {sortBy === opt.id && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Availability Filter */}
              <div className="space-y-2 pt-3 border-t border-stone-100">
                <label className="block font-extrabold text-stone-900 text-xs">
                  ২. প্রাপ্যতা ও অফার (Availability)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'all', label: 'সব পণ্য (All)' },
                    { id: 'in_stock', label: '✓ স্টকে আছে (In Stock)' },
                    { id: 'on_sale', label: '🏷️ ডিসকাউন্ট অফার' },
                    { id: 'out_of_stock', label: 'স্টক আউট' },
                  ].map((av) => (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => setAvailabilityFilter(av.id as any)}
                      className={`px-3 py-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        availabilityFilter === av.id
                          ? isOrganic
                            ? 'bg-[#16A34A] text-white border-[#16A34A]'
                            : 'bg-[#E11D48] text-white border-[#E11D48]'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      {av.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Price Range Filter */}
              <div className="space-y-2.5 pt-3 border-t border-stone-100">
                <label className="block font-extrabold text-stone-900 text-xs">
                  ৩. মূল্যের সীমা (Price Range)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'all', label: 'যেকোনো দাম' },
                    { id: 'under_500', label: '৳৫০০ এর নিচে' },
                    { id: '500_1000', label: '৳৫০০ - ৳১,০০০' },
                    { id: '1000_2000', label: '৳১,০০০ - ৳২,০০০' },
                    { id: 'over_2000', label: '৳২,০০০ এর উপরে' },
                  ].map((br) => (
                    <button
                      key={br.id}
                      type="button"
                      onClick={() => setPriceBracket(br.id as any)}
                      className={`px-2.5 py-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        priceBracket === br.id
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                      }`}
                    >
                      {br.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">
                      সর্বনিম্ন দাম (৳)
                    </span>
                    <input
                      type="number"
                      min={0}
                      placeholder="যেমন: ৩০০"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-mono text-xs"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-500 block mb-1">
                      সর্বোচ্চ দাম (৳)
                    </span>
                    <input
                      type="number"
                      min={0}
                      placeholder="যেমন: ২৫০০"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Variant Attributes: Colors */}
              {availableColors.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <label className="block font-extrabold text-stone-900 text-xs">
                      ৪. কালার ভ্যারিয়েন্ট (Color Attributes)
                    </label>
                    {selectedColors.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedColors([])}
                        className="text-[10.5px] font-bold text-[#E11D48] hover:underline cursor-pointer"
                      >
                        রিসেট
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableColors.map((color) => {
                      const active = selectedColors.includes(color);
                      return (
                        <button
                          key={`filter-color-${color}`}
                          type="button"
                          onClick={() => toggleColorFilter(color)}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
                            active
                              ? isOrganic
                                ? 'bg-[#16A34A] text-white border-[#16A34A]'
                                : 'bg-[#E11D48] text-white border-[#E11D48]'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Variant Attributes: Sizes */}
              {availableSizes.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <label className="block font-extrabold text-stone-900 text-xs">
                      ৫. সাইজ / প্যাক ভ্যারিয়েন্ট (Size Attributes)
                    </label>
                    {selectedSizes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedSizes([])}
                        className="text-[10.5px] font-bold text-[#E11D48] hover:underline cursor-pointer"
                      >
                        রিসেট
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSizes.map((size) => {
                      const active = selectedSizes.includes(size);
                      return (
                        <button
                          key={`filter-size-${size}`}
                          type="button"
                          onClick={() => toggleSizeFilter(size)}
                          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
                            active
                              ? isOrganic
                                ? 'bg-[#16A34A] text-white border-[#16A34A]'
                                : 'bg-[#E11D48] text-white border-[#E11D48]'
                              : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center gap-2.5">
              <button
                type="button"
                onClick={resetAllCatalogFilters}
                className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 text-xs font-extrabold cursor-pointer transition-colors"
              >
                সব রিসেট করুন
              </button>
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(false)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-extrabold cursor-pointer shadow-sm transition-colors ${
                  isOrganic
                    ? 'bg-[#16A34A] hover:bg-[#15803D]'
                    : 'bg-[#E11D48] hover:bg-[#BE123C]'
                }`}
              >
                ফলাফল দেখুন ({filteredProducts.length} টি পণ্য)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
