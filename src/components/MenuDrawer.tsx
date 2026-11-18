/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Home,
  User,
  Video,
  ShoppingBag,
  CreditCard,
  Store,
  Globe,
  Truck,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Search,
  Grid,
  Headphones,
} from 'lucide-react';
import { Product, ProductCategory, OFFICIAL_CATEGORIES } from '../types';
import {
  resolveSafeProductImageUrl,
  handleProductImageError,
  resolveCategoryIdFromUrl,
} from '../lib/storeSync';
import { PUBLIC_CUSTOMER_NAVIGATION, PublicCustomerNavItem } from '../config/navigationConfig';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onGoHome: () => void;
  onOpenAccount: () => void;
  onOpenLogin?: () => void;
  onOpenCart: () => void;
  onOpenCheckout?: () => void;
  onOpenTracking: () => void;
  onOpenVideoGallery?: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
  onOpenAiAssistant: () => void;
  onSelectCategory: (category: ProductCategory) => void;
  products?: Product[];
  onOpenProductDetail?: (product: Product) => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  onGoHome,
  onOpenAccount,
  onOpenLogin,
  onOpenCart,
  onOpenCheckout,
  onOpenTracking,
  onOpenVideoGallery,
  onOpenAbout,
  onOpenPrivacy,
  onOpenAiAssistant,
  onSelectCategory,
  products = [],
  onOpenProductDetail,
}) => {
  const { itemCount } = useCart();
  const { userProfile } = useAuth();
  const [productFilter, setProductFilter] = useState('');
  const [showAllProductsList, setShowAllProductsList] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard Accessibility (Escape key to close) & Body Scroll Lock
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = { all: products.length };
    OFFICIAL_CATEGORIES.forEach((cat) => {
      map[cat.id] = 0;
    });
    products.forEach((p) => {
      const norm = resolveCategoryIdFromUrl(p.category, p.name);
      map[norm] = (map[norm] || 0) + 1;
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.titleEn || '').toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, productFilter]);

  const primaryShoppingItems = useMemo(
    () => PUBLIC_CUSTOMER_NAVIGATION.filter((item) => item.section === 'primary_shopping'),
    []
  );

  const policyAndSupportItems = useMemo(
    () => PUBLIC_CUSTOMER_NAVIGATION.filter((item) => item.section === 'policies_and_support'),
    []
  );

  if (!isOpen) return null;

  const brandLogoUrl = '/assets/aistudio/Gemini_Generated_Image_4bi49x4bi49x4bi4_b4aaa34e.jpg';

  const handleNavAction = (item: PublicCustomerNavItem) => {
    switch (item.id) {
      case 'home':
        onGoHome();
        onClose();
        break;
      case 'all_products':
        onSelectCategory('all');
        onClose();
        setTimeout(() => {
          const productsElem = document.getElementById('products-section');
          if (productsElem) {
            productsElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 120);
        break;
      case 'categories': {
        const catSection = document.getElementById('menu-categories-section');
        if (catSection) {
          catSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          onSelectCategory('all');
          onClose();
        }
        break;
      }
      case 'live_tracking':
        onOpenTracking();
        onClose();
        break;
      case 'shopping_bag':
        onOpenCart();
        onClose();
        break;
      case 'checkout':
        if (onOpenCheckout) {
          onOpenCheckout();
        } else {
          onOpenCart();
        }
        onClose();
        break;
      case 'video_gallery':
        if (onOpenVideoGallery) onOpenVideoGallery();
        else onOpenTracking();
        onClose();
        break;
      case 'smart_assistant':
        onOpenAiAssistant();
        onClose();
        break;
      case 'about_us':
        onOpenAbout();
        onClose();
        break;
      case 'privacy_policy':
      case 'return_refund_policy':
        onOpenPrivacy();
        onClose();
        break;
      case 'customer_support': {
        const supportSection = document.getElementById('menu-customer-support-box');
        if (supportSection) {
          supportSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        break;
      }
    }
  };

  const renderNavIcon = (id: PublicCustomerNavItem['id']) => {
    switch (id) {
      case 'home':
        return <Home className="w-4 h-4 text-[#E11D48]" />;
      case 'all_products':
        return <Store className="w-4 h-4 text-[#E11D48]" />;
      case 'categories':
        return <Grid className="w-4 h-4 text-[#E11D48]" />;
      case 'live_tracking':
        return <Truck className="w-4 h-4 text-[#E11D48]" />;
      case 'shopping_bag':
        return <ShoppingBag className="w-4 h-4 text-emerald-700" />;
      case 'checkout':
        return <CreditCard className="w-4 h-4 text-emerald-700" />;
      case 'video_gallery':
        return <Video className="w-4 h-4 text-pink-700" />;
      case 'smart_assistant':
        return <Sparkles className="w-4 h-4 text-[#E11D48]" />;
      case 'about_us':
        return <Globe className="w-4 h-4 text-blue-700" />;
      case 'privacy_policy':
        return <ShieldCheck className="w-4 h-4 text-emerald-700" />;
      case 'return_refund_policy':
        return <RotateCcw className="w-4 h-4 text-amber-700" />;
      case 'customer_support':
        return <Headphones className="w-4 h-4 text-[#E11D48]" />;
    }
  };

  const renderNavIconBg = (id: PublicCustomerNavItem['id']) => {
    switch (id) {
      case 'shopping_bag':
      case 'checkout':
      case 'privacy_policy':
        return 'bg-emerald-50 border-emerald-200/70';
      case 'video_gallery':
        return 'bg-pink-50 border-pink-200/70';
      case 'about_us':
        return 'bg-blue-50 border-blue-200/70';
      case 'return_refund_policy':
        return 'bg-amber-50 border-amber-200/70';
      default:
        return 'bg-rose-50 border-rose-200/70';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dokandari-customer-menu-title"
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex justify-end animate-in fade-in"
      onClick={onClose}
    >
      <aside
        aria-label="Customer Store Navigation"
        className="relative bg-white w-full max-w-sm sm:max-w-md h-full overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header with Official Logo and >= 44x44px Close Button */}
        <header className="px-4 py-3.5 border-b border-stone-200/90 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex flex-col items-start min-w-0">
            <img
              src={brandLogoUrl}
              alt="Dokandari"
              className="h-8 sm:h-9 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <span
              id="dokandari-customer-menu-title"
              className="text-[11px] font-semibold text-stone-600 tracking-tight mt-0.5 truncate"
            >
              আন্তর্জাতিক মানের অল-ইন-ওয়ান ই-কমার্স প্ল্যাটফর্ম
            </span>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="মেনু বন্ধ করুন (Close menu)"
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-[#E11D48] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* Scrollable Navigation Body */}
        <div className="p-4 space-y-6 text-xs flex-1 overflow-y-auto">
          {/* Quick Product Search Box */}
          <div className="space-y-2">
            <label htmlFor="customer-menu-search" className="sr-only">
              পণ্য বা ক্যাটাগরি খুঁজুন
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="customer-menu-search"
                type="search"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="পণ্য বা ক্যাটাগরি খুঁজুন (Search products)..."
                className="w-full min-h-[44px] pl-10 pr-9 py-2.5 bg-stone-50 border border-stone-200/90 focus:border-[#E11D48] focus:bg-white rounded-xl text-xs text-stone-900 placeholder:text-stone-400 outline-none transition-all"
              />
              {productFilter && (
                <button
                  type="button"
                  onClick={() => setProductFilter('')}
                  aria-label="সার্চ মুছুন"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Instant Search Results when typing */}
            {productFilter.trim().length > 0 && (
              <div className="bg-stone-50/90 border border-stone-200 rounded-2xl p-2 max-h-64 overflow-y-auto space-y-1.5">
                {filteredProducts.length === 0 ? (
                  <div className="py-4 text-center text-stone-500 text-xs">
                    কোনো পণ্য পাওয়া যায়নি
                  </div>
                ) : (
                  filteredProducts.slice(0, 12).map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        if (onOpenProductDetail) {
                          onOpenProductDetail(prod);
                        }
                        onClose();
                      }}
                      className="w-full min-h-[48px] p-2 rounded-xl bg-white hover:bg-rose-50/60 border border-stone-200/80 hover:border-rose-200 flex items-center justify-between gap-2.5 text-left transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={resolveSafeProductImageUrl(prod.images[0], prod, 0)}
                          alt={prod.name}
                          onError={(e) => handleProductImageError(e, prod, 0)}
                          className="w-9 h-9 rounded-lg object-cover border border-stone-200 shrink-0"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <span className="font-bold text-stone-900 text-xs line-clamp-1 block">
                            {prod.name}
                          </span>
                          <span className="text-[11px] font-extrabold font-mono text-[#E11D48]">
                            ৳{prod.price.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Section 1: Primary Shopping & Customer Services */}
          <nav aria-label="প্রধান শপিং মেনু" className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
                শপিং ও অর্ডার সেবা (Shopping &amp; Orders)
              </span>
            </div>

            <div className="bg-stone-50/70 border border-stone-200/90 rounded-2xl p-1.5 space-y-1">
              {primaryShoppingItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavAction(item)}
                  className="w-full min-h-[48px] px-3 py-2.5 rounded-xl hover:bg-white hover:shadow-2xs flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${renderNavIconBg(
                        item.id
                      )}`}
                    >
                      {renderNavIcon(item.id)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900 text-xs group-hover:text-[#E11D48] transition-colors truncate">
                          {item.titleBn}
                        </span>
                        {item.badgeText && (
                          <span className="bg-[#E11D48] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none">
                            {item.badgeText}
                          </span>
                        )}
                        {(item.id === 'shopping_bag' || item.id === 'checkout') && itemCount > 0 && (
                          <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none tabular-nums">
                            {itemCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-stone-500 block truncate mt-0.5">
                        {item.subtitleBn}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#E11D48] shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </nav>

          {/* Section 2: Shop by Category (All 11 Official Categories) */}
          <section
            id="menu-categories-section"
            aria-label="প্রোডাক্ট ক্যাটাগরি সমূহ"
            className="space-y-2.5"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Grid className="w-3.5 h-3.5 text-[#E11D48]" />
                <span>শপ ক্যাটাগরি (Shop Categories)</span>
              </span>
              <span className="text-[11px] font-semibold text-stone-500">
                {OFFICIAL_CATEGORIES.length}টি কালেকশন
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectCategory('all');
                  onClose();
                }}
                className="min-h-[46px] px-3.5 py-2.5 rounded-xl bg-rose-50/90 hover:bg-rose-100 text-[#E11D48] font-bold text-left transition-colors cursor-pointer flex items-center justify-between gap-2 col-span-2 border border-rose-200"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Home className="w-4 h-4 text-[#E11D48] shrink-0" />
                  <span className="text-xs font-extrabold truncate">
                    সকল পণ্য ও কালেকশন (All Products)
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded-md border border-rose-200 text-[#E11D48] shrink-0">
                  {categoryCounts.all || products.length}
                </span>
              </button>

              {OFFICIAL_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onSelectCategory(cat.id);
                    onClose();
                  }}
                  className="min-h-[46px] p-2.5 rounded-xl bg-stone-50 hover:bg-rose-50/70 hover:border-rose-200 hover:text-[#E11D48] border border-stone-200/90 text-stone-800 font-bold text-left transition-all cursor-pointer flex items-center gap-2"
                >
                  <img
                    src={cat.image}
                    alt={cat.nameBn}
                    className="w-7 h-7 rounded-lg object-cover border border-stone-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="truncate text-[11px] font-bold block leading-tight">
                      {cat.nameBn}
                    </span>
                    <span className="text-[10px] text-stone-400 font-medium block">
                      {categoryCounts[cat.id] || 0} টি পণ্য
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Optional Expandable Quick Product Directory for Customers */}
            {products.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllProductsList((prev) => !prev)}
                  aria-expanded={showAllProductsList}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 font-bold text-xs flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span>সকল পণ্যের তালিকা দেখুন ({products.length} টি পণ্য)</span>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-500 transition-transform ${
                      showAllProductsList ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {showAllProductsList && (
                  <div className="mt-2 max-h-64 overflow-y-auto space-y-1.5 bg-stone-50/80 p-2 rounded-2xl border border-stone-200">
                    {products.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => {
                          if (onOpenProductDetail) {
                            onOpenProductDetail(prod);
                          }
                          onClose();
                        }}
                        className="w-full min-h-[46px] p-2 rounded-xl bg-white hover:bg-rose-50/60 border border-stone-200/80 hover:border-rose-200 flex items-center justify-between gap-2.5 text-left transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={resolveSafeProductImageUrl(prod.images[0], prod, 0)}
                            alt={prod.name}
                            onError={(e) => handleProductImageError(e, prod, 0)}
                            className="w-8 h-8 rounded-lg object-cover border border-stone-200 shrink-0"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0">
                            <span className="font-bold text-stone-900 text-[11px] line-clamp-1 block">
                              {prod.name}
                            </span>
                            <span className="text-[10.5px] font-extrabold font-mono text-[#E11D48]">
                              ৳{prod.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Section 3: Brand Info, Policies & Customer Care */}
          <nav aria-label="তথ্য, নীতিমালা ও কাস্টমার সাপোর্ট" className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-500">
                তথ্য ও নীতিমালা (Policies &amp; Info)
              </span>
            </div>

            <div className="bg-stone-50/70 border border-stone-200/90 rounded-2xl p-1.5 space-y-1">
              {policyAndSupportItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavAction(item)}
                  className="w-full min-h-[48px] px-3 py-2.5 rounded-xl hover:bg-white hover:shadow-2xs flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${renderNavIconBg(
                        item.id
                      )}`}
                    >
                      {renderNavIcon(item.id)}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-stone-900 text-xs group-hover:text-[#E11D48] transition-colors block truncate">
                        {item.titleBn}
                      </span>
                      <span className="text-[11px] text-stone-500 block truncate mt-0.5">
                        {item.subtitleBn}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-[#E11D48] shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </nav>

          {/* Direct Customer Support / Contact Card */}
          <div
            id="menu-customer-support-box"
            className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/90 space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 text-xs">
                ২৪/৭ কাস্টমার সাপোর্ট ও হেল্পলাইন
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                সর্বদা সচল
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <a
                href="tel:01348282356"
                className="min-h-[44px] py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-200 text-[#E11D48] rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span className="truncate">01348282356</span>
              </a>

              <a
                href="https://wa.me/8801885533437"
                target="_blank"
                rel="noreferrer"
                className="min-h-[44px] py-2.5 px-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
              >
                <MessageCircle className="w-4 h-4 fill-white shrink-0" />
                <span className="truncate">WhatsApp চ্যাট</span>
              </a>
            </div>
          </div>
        </div>

        {/* Sticky Bottom Customer Account Bar — Strictly Customer-Only */}
        <footer className="p-3.5 border-t border-stone-200 bg-white sticky bottom-0 z-20 space-y-2">
          <button
            type="button"
            onClick={() => {
              if (userProfile) {
                onOpenAccount();
              } else if (onOpenLogin) {
                onOpenLogin();
              } else {
                onOpenAccount();
              }
              onClose();
            }}
            className="w-full min-h-[44px] py-2.5 px-4 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <User className="w-4 h-4 text-white shrink-0" />
            <span>
              {userProfile
                ? `আমার অ্যাকাউন্ট ও অর্ডার (${userProfile.displayName.split(' ')[0]})`
                : 'কাস্টমার লগইন / অ্যাকাউন্ট'}
            </span>
          </button>

          <div className="text-[10px] text-stone-500 text-center">
            Dokandari (dokandari.com) · সর্বস্বত্ব সংরক্ষিত © 2026
          </div>
        </footer>
      </aside>
    </div>
  );
};
