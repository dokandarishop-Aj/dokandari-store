/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Home,
  User,
  Video,
  ShoppingBag,
  Globe,
  Rocket,
  ShieldCheck,
  Sparkles,
  LayoutDashboard,
  ChevronRight,
  Search,
  Package,
  Lock,
} from 'lucide-react';
import { Product, ProductCategory, OFFICIAL_CATEGORIES } from '../types';
import { resolveSafeProductImageUrl, handleProductImageError } from '../lib/storeSync';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onGoHome: () => void;
  onOpenAccount: () => void;
  onOpenLogin?: () => void;
  onOpenCart: () => void;
  onOpenTracking: () => void;
  onOpenVideoGallery?: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
  onOpenAiAssistant: () => void;
  onOpenAdmin: () => void;
  onSelectCategory: (category: ProductCategory) => void;
  products?: Product[];
  onOpenProductDetail?: (product: Product) => void;
  isAdmin?: boolean;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  onGoHome,
  onOpenAccount,
  onOpenLogin,
  onOpenCart,
  onOpenTracking,
  onOpenVideoGallery,
  onOpenAbout,
  onOpenPrivacy,
  onOpenAiAssistant,
  onOpenAdmin,
  onSelectCategory,
  products = [],
  onOpenProductDetail,
  isAdmin = false,
}) => {
  const [productFilter, setProductFilter] = useState('');

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

  if (!isOpen) return null;

  const brandLogoUrl = '/assets/aistudio/Gemini_Generated_Image_4bi49x4bi49x4bi4_b4aaa34e.jpg';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex justify-end animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-full max-w-sm sm:max-w-md h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Logo and Close */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex flex-col items-start">
            <img
              src={brandLogoUrl}
              alt="Dokandari"
              className="h-8 sm:h-9 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
            <span className="text-[10px] font-semibold text-rose-600 tracking-tight mt-0.5">
              আন্তর্জাতিক মানের অল-ইন-ওয়ান ই-কমার্স প্ল্যাটফর্ম
            </span>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-rose-50 text-[#E11D48] hover:bg-rose-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 space-y-5 text-xs flex-1 overflow-y-auto">
          {/* Welcome Banner */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200/80 text-center space-y-1">
            <span className="font-extrabold text-[#E11D48] text-xs block">
              ✨ আসসালামু আলাইকুম, Dokandari-তে স্বাগতম!
            </span>
            <p className="text-[11px] text-stone-600">
              হোম ডেকোর, স্মার্ট গ্যাজেট, লাইফস্টাইল ও নিত্যপ্রয়োজনীয় পণ্যে ১০০% অরিজিনাল কোয়ালিটি
            </p>
          </div>

          {/* Hotline & WhatsApp Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href="tel:01348282356"
              className="py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-300 text-[#E11D48] rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>📞 হটলাইন: 01348282356</span>
            </a>

            <a
              href="https://wa.me/8801885533437"
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>💬 WhatsApp: 01885533437</span>
            </a>
          </div>

          {/* Section 1: মূল পেজসমূহ ও পলিসি (ALL MAIN PAGES & POLICIES) */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 block px-1">
              ১. সকল পেজ ও পলিসি লিংক (ALL STORE PAGES)
            </span>

            <div className="space-y-1 bg-stone-50/70 p-2 rounded-2xl border border-stone-200">
              {/* Home */}
              <button
                onClick={() => {
                  onGoHome();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#E11D48] flex items-center justify-center shrink-0">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">হোম পেজ ও সকল কালেকশন</span>
                    <span className="text-[10px] text-stone-500">১১টি প্রধান ক্যাটাগরির সকল অরিজিনাল পণ্য</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
              </button>

              {/* Live Order Tracking */}
              <button
                onClick={() => {
                  onOpenTracking();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#E11D48] flex items-center justify-center shrink-0">
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span>লাইভ অর্ডার ট্র্যাকিং</span>
                      <span className="bg-[#E11D48] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                        Live
                      </span>
                    </span>
                    <span className="text-[10px] text-stone-500">অর্ডার আইডি দিয়ে ডেলিভারি স্ট্যাটাস দেখুন</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
              </button>

              {/* Cart & Bag */}
              <button
                onClick={() => {
                  onOpenCart();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">শপিং ব্যাগ ও চেকআউট পেইজ</span>
                    <span className="text-[10px] text-stone-500">ক্যাশ অন ডেলিভারি ১-ক্লিক অর্ডার</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
              </button>

              {/* Dedicated Video Gallery */}
              <button
                onClick={() => {
                  if (onOpenVideoGallery) onOpenVideoGallery();
                  else onOpenTracking();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">প্রোডাক্ট ভিডিও গ্যালারি</span>
                    <span className="text-[10px] text-stone-500">প্রোডাক্টের আনবক্সিং ও রিয়েল ভিডিও দেখুন</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
              </button>

              {/* About Brand */}
              <button
                onClick={() => {
                  onOpenAbout();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">আমাদের ব্র্যান্ড পরিচিতি (About Us)</span>
                    <span className="text-[10px] text-stone-500">আন্তর্জাতিক মানের সরাসরি ফ্যাক্টরি সোর্সিং</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
              </button>

              {/* Privacy Policy & Return Policy */}
              <button
                onClick={() => {
                  onOpenPrivacy();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">প্রাইভেসি পলিসি ও ৭ দিনের রিটার্ন নীতিমালা</span>
                    <span className="text-[10px] text-stone-500">১০০% ক্যাশ অন ডেলিভারি ও দেখে নেওয়ার সুবিধা</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
              </button>

              {/* Smart AI Shopping Assistant */}
              <button
                onClick={() => {
                  onOpenAiAssistant();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#E11D48] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-[#E11D48]" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">Dokandari স্মার্ট শপিং অ্যাসিস্ট্যান্ট</span>
                    <span className="text-[10px] text-stone-500">প্রোডাক্ট পরামর্শ, স্টক ও অর্ডার সাপোর্ট</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
              </button>
            </div>
          </div>

          {/* Section 2: ১১টি ক্যাটালগ ও ক্যাটাগরি লিংক (ALL 11 CATALOG LINKS) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 block px-1">
              ২. ১১টি ক্যাটালগ পেইজ লিংক (ALL 11 CATALOGS)
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onSelectCategory('all');
                  onClose();
                }}
                className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] font-bold text-left transition-colors cursor-pointer flex items-center gap-2 col-span-2 border border-rose-200"
              >
                <span className="text-sm">✨</span>
                <span>সকল ক্যাটালগ ও কালেকশন (All Categories)</span>
              </button>

              {OFFICIAL_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    onSelectCategory(cat.id);
                    onClose();
                  }}
                  className="p-2 rounded-xl bg-stone-50 hover:bg-rose-50 hover:text-[#E11D48] border border-stone-200/80 text-stone-800 font-bold text-left transition-colors cursor-pointer flex items-center gap-2"
                >
                  <img
                    src={cat.image}
                    alt={cat.nameBn}
                    className="w-6 h-6 rounded-lg object-cover border border-rose-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <span className="truncate text-[11px]">{cat.nameBn}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: সকল প্রোডাক্ট পেইজের লিংক (ALL PRODUCT PAGE LINKS) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-[#E11D48]" />
                <span>৩. সকল প্রোডাক্ট পেইজের লিংক ({products.length} টি পণ্য)</span>
              </span>
            </div>

            {/* Search Filter inside Menu for Quick Product Jump */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                placeholder="মেনুতে যেকোনো প্রোডাক্ট পেইজ খুঁজুন..."
                className="w-full pl-8 pr-3 py-2 bg-stone-50 border border-stone-200 focus:border-[#E11D48] focus:bg-white rounded-xl text-xs outline-none"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 bg-stone-50/70 p-2 rounded-2xl border border-stone-200">
              {filteredProducts.length === 0 ? (
                <div className="py-4 text-center text-stone-400 text-[11px]">
                  কোনো প্রোডাক্ট পাওয়া যায়নি
                </div>
              ) : (
                filteredProducts.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => {
                      if (onOpenProductDetail) {
                        onOpenProductDetail(prod);
                      }
                      onClose();
                    }}
                    className="w-full p-2 rounded-xl bg-white hover:bg-rose-50/70 border border-stone-200/80 hover:border-rose-200 flex items-center justify-between gap-2.5 text-left transition-all cursor-pointer"
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
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Corner Login & Admin Access Bar (নিচের দিকে এক কোণায় লগইন বাটন) */}
        <div className="p-3.5 border-t border-rose-100 bg-rose-50/50 sticky bottom-0 z-20 space-y-2">
          <div className="flex items-center justify-between gap-2">
            {/* Customer Login / Account Button */}
            <button
              type="button"
              onClick={() => {
                if (onOpenLogin) onOpenLogin();
                else onOpenAccount();
                onClose();
              }}
              className="flex-1 py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-200 text-stone-800 hover:text-[#E11D48] rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-[#E11D48]" />
              <span>কাস্টমার লগইন / অ্যাকাউন্ট</span>
            </button>

            {/* Bottom-Right Corner Admin Login / Dashboard Button */}
            <button
              type="button"
              onClick={() => {
                onOpenAdmin();
                onClose();
              }}
              className="py-2.5 px-3 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-[11px] font-extrabold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
            >
              {isAdmin ? (
                <>
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>অ্যাডমিন প্যানেল</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>লগইন</span>
                </>
              )}
            </button>
          </div>
          <div className="text-[10px] text-stone-500 text-center">
            Dokandari (dokandari.com) · সর্বস্বত্ব সংরক্ষিত © 2026
          </div>
        </div>
      </div>
    </div>
  );
};

