/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
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
} from 'lucide-react';
import { ProductCategory, OFFICIAL_CATEGORIES } from '../types';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onGoHome: () => void;
  onOpenAccount: () => void;
  onOpenCart: () => void;
  onOpenTracking: () => void;
  onOpenVideoGallery?: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
  onOpenAiAssistant: () => void;
  onOpenAdmin: () => void;
  onSelectCategory: (category: ProductCategory) => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  onGoHome,
  onOpenAccount,
  onOpenCart,
  onOpenTracking,
  onOpenVideoGallery,
  onOpenAbout,
  onOpenPrivacy,
  onOpenAiAssistant,
  onOpenAdmin,
  onSelectCategory,
}) => {
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
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex flex-col items-start">
            <img
              src={brandLogoUrl}
              alt="Dokandari"
              className="h-9 w-auto object-contain"
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

        {/* Content Body */}
        <div className="p-4 sm:p-5 space-y-5 text-xs flex-1">
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
              href="tel:+8809638757282"
              className="py-2.5 px-3 bg-white hover:bg-rose-50 border border-rose-300 text-[#E11D48] rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>📞 হটলাইন কল</span>
            </a>

            <a
              href="https://wa.me/8801885533437"
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>💬 WhatsApp চ্যাট</span>
            </a>
          </div>

          {/* Section 1: মূল পেজসমূহ (MAIN STORE PAGES) */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block px-1">
              মূল পেজসমূহ (MAIN STORE PAGES)
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
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#E11D48] flex items-center justify-center">
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">হোম পেজ ও সকল কালেকশন</span>
                    <span className="text-[10px] text-stone-500">১১টি প্রধান ক্যাটাগরির সকল অরিজিনাল পণ্য</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>

              {/* Customer Account & OTP Login */}
              <button
                onClick={() => {
                  onOpenAccount();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">কাস্টমার ড্যাশবোর্ড ও লগইন</span>
                    <span className="text-[10px] text-stone-500">প্রোফাইল ও লাইভ অর্ডার হিস্ট্রি</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
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
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#E11D48] flex items-center justify-center">
                    <Rocket className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 flex items-center gap-1.5">
                      <span>লাইভ অর্ডার ট্র্যাকিং</span>
                      <span className="bg-[#E11D48] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">Live</span>
                    </span>
                    <span className="text-[10px] text-stone-500">অর্ডার আইডি দিয়ে ডেলিভারি স্ট্যাটাস দেখুন</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
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
                  <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-700 flex items-center justify-center">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">ভিডিও গ্যালারি ও কাস্টমার রিভিউ</span>
                    <span className="text-[10px] text-stone-500">প্রোডাক্টের আনবক্সিং ও রিয়েল ভিডিও দেখুন</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
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
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">শপিং ব্যাগ ও চেকআউট</span>
                    <span className="text-[10px] text-stone-500">ক্যাশ অন ডেলিভারি ১-ক্লিক অর্ডার</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
            </div>
          </div>

          {/* Section 2: ব্র্যান্ড পরিচিতি ও পলিসি */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block px-1">
              ব্র্যান্ড পরিচিতি ও পলিসি (STORE POLICIES)
            </span>

            <div className="space-y-1 bg-stone-50/70 p-2 rounded-2xl border border-stone-200">
              <button
                onClick={() => {
                  onOpenAbout();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">আমাদের ব্র্যান্ড পরিচিতি ও ইমপোর্ট সোর্সিং</span>
                    <span className="text-[10px] text-stone-500">আন্তর্জাতিক মানের সরাসরি ফ্যাক্টরি সোর্সিং</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>

              <button
                onClick={() => {
                  onOpenPrivacy();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">প্রাইভেসি পলিসি ও ৭ দিনের রিটার্ন নীতিমালা</span>
                    <span className="text-[10px] text-stone-500">১০০% ক্যাশ অন ডেলিভারি ও দেখে নেওয়ার সুবিধা</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>

              <button
                onClick={() => {
                  onOpenAiAssistant();
                  onClose();
                }}
                className="w-full p-2.5 rounded-xl hover:bg-white hover:shadow-xs flex items-center justify-between text-left transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-rose-100 text-[#E11D48] flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-[#E11D48]" />
                  </div>
                  <div>
                    <span className="font-bold text-stone-900 block">Dokandari স্মার্ট শপিং অ্যাসিস্ট্যান্ট</span>
                    <span className="text-[10px] text-stone-500">প্রোডাক্ট পরামর্শ, স্টক অনুসন্ধান ও অর্ডার সাপোর্ট</span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-stone-400" />
              </button>
            </div>
          </div>

          {/* Section 3: ১১টি প্রধান ক্যাটাগরি (11 OFFICIAL CATEGORIES) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block px-1">
              ১১টি প্রধান ক্যাটাগরি (ALL 11 CATEGORIES)
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
                <span>সকল কালেকশন (All Categories)</span>
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

          {/* Section 4: এডমিন হাব */}
          <div className="pt-2 border-t border-stone-200">
            <button
              onClick={() => {
                onOpenAdmin();
                onClose();
              }}
              className="w-full py-3 px-4 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-2xl font-bold flex items-center justify-between shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                <span>এডমিন ড্যাশবোর্ড ও AI বাল্ক ইমপোর্ট স্টুডিও</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 text-[11px] text-stone-500 text-center">
          <span>Dokandari · আন্তর্জাতিক মানের ই-কমার্স প্ল্যাটফর্ম © 2026</span>
        </div>
      </div>
    </div>
  );
};
