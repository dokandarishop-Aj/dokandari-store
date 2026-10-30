/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Phone, Mail, MapPin, ExternalLink, Sparkles } from 'lucide-react';
import { ProductCategory, OFFICIAL_CATEGORIES } from '../types';
import {
  OfficialWhatsAppIcon,
  OfficialFacebookIcon,
  OfficialInstagramIcon,
  OfficialTikTokIcon,
  OfficialYouTubeIcon,
} from './OfficialIcons';
import {
  DEFAULT_STORE_CONTENT,
  formatDokandariSocialUrl,
  OFFICIAL_WHATSAPP,
} from '../lib/storeSync';

interface FooterProps {
  onSelectCategory: (category: ProductCategory) => void;
  onOpenTracking: () => void;
  onOpenAiAssistant: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
  socialLinks?: {
    whatsapp: string;
    facebook: string;
    instagram: string;
    tiktok: string;
    youtube: string;
  };
  whatsappNumber?: string;
  hotlineNumber?: string;
  officialEmail?: string;
  pageContent?: {
    warehouseAddress?: string;
    corporateAddress?: string;
    googleMapUrl?: string;
  };
  founderAddress?: string;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectCategory,
  onOpenTracking,
  onOpenAiAssistant,
  onOpenAbout,
  onOpenPrivacy,
  socialLinks,
  whatsappNumber,
  hotlineNumber,
  officialEmail,
  pageContent,
  founderAddress,
}) => {
  const brandLogoUrl = '/assets/aistudio/Gemini_Generated_Image_4bi49x4bi49x4bi4_b4aaa34e.jpg';
  const activeSocials = socialLinks || DEFAULT_STORE_CONTENT.socialLinks!;

  const waUrl = formatDokandariSocialUrl(activeSocials.whatsapp, 'whatsapp');
  const fbUrl = formatDokandariSocialUrl(activeSocials.facebook, 'facebook');
  const igUrl = formatDokandariSocialUrl(activeSocials.instagram, 'instagram');
  const tkUrl = formatDokandariSocialUrl(activeSocials.tiktok, 'tiktok');
  const ytUrl = formatDokandariSocialUrl(activeSocials.youtube, 'youtube');

  const displayWhatsApp = whatsappNumber || OFFICIAL_WHATSAPP;
  const displayHotline = hotlineNumber || DEFAULT_STORE_CONTENT.hotlineNumber;
  const displayEmail = officialEmail || DEFAULT_STORE_CONTENT.officialEmail;

  const address1 =
    pageContent?.warehouseAddress ||
    founderAddress ||
    DEFAULT_STORE_CONTENT.pageContent?.warehouseAddress ||
    'প্রবাসীর পল্লী, ডিইপিজেড (DEPZ) রোড, আশুলিয়া, সাভার, ঢাকা - ১৩৪৯';

  const address2 =
    pageContent?.corporateAddress ||
    DEFAULT_STORE_CONTENT.pageContent?.corporateAddress ||
    'বাড়ি ৫/এ, রোড ১২, সেক্টর ১০, উত্তরা মডেল টাউন, ঢাকা - ১২৩০';

  const mapUrl =
    pageContent?.googleMapUrl ||
    DEFAULT_STORE_CONTENT.pageContent?.googleMapUrl ||
    `https://maps.google.com/?q=${encodeURIComponent(address1)}`;

  return (
    <footer className="bg-white border-t border-stone-200 text-stone-700 pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Main 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: Brand & Slogan + Official Social Media SVG Icons */}
          <div className="space-y-4">
            <div className="flex flex-col items-start">
              <img
                src={brandLogoUrl}
                alt="Dokandari"
                className="h-10 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
              <span className="text-[11px] font-semibold text-[#E11D48] tracking-tight mt-1">
                আন্তর্জাতিক মানের অল-ইন-ওয়ান ই-কমার্স প্ল্যাটফর্ম
              </span>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              বাংলাদেশের অন্যতম শীর্ষস্থানীয় মাল্টি-ক্যাটাগরি ই-কমার্স ব্র্যান্ড। হোম ডেকোর, স্মার্ট গ্যাজেট, লাইফস্টাইল ও নিত্যপ্রয়োজনীয় পণ্যে সরাসরি ইমপোর্ট ও ১০০% কোয়ালিটি নিশ্চয়তা।
            </p>

            {/* Official Social Media Brand SVG Icons (WhatsApp, Facebook, Instagram, TikTok, YouTube) */}
            <div className="pt-2">
              <span className="text-[11px] font-bold text-stone-600 block mb-2.5">
                অফিসিয়াল সোশ্যাল মিডিয়া (Dokandari):
              </span>
              <div className="flex items-center gap-2.5">
                {/* 1. Official WhatsApp SVG */}
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Dokandari Official WhatsApp"
                  title="Dokandari Official WhatsApp"
                  className="w-9 h-9 rounded-full bg-[#25D366] hover:bg-[#1DA851] text-white flex items-center justify-center hover:scale-110 transition-all shadow-xs"
                >
                  <OfficialWhatsAppIcon className="w-5 h-5" />
                </a>

                {/* 2. Official Facebook SVG */}
                <a
                  href={fbUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Dokandari Official Facebook"
                  title="Dokandari Official Facebook"
                  className="w-9 h-9 rounded-full bg-[#1877F2] hover:bg-[#0D65D9] text-white flex items-center justify-center hover:scale-110 transition-all shadow-xs"
                >
                  <OfficialFacebookIcon className="w-5 h-5" />
                </a>

                {/* 3. Official Instagram SVG */}
                <a
                  href={igUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Dokandari Official Instagram"
                  title="Dokandari Official Instagram"
                  className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white flex items-center justify-center hover:scale-110 transition-all shadow-xs"
                >
                  <OfficialInstagramIcon className="w-5 h-5" />
                </a>

                {/* 4. Official TikTok SVG */}
                <a
                  href={tkUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Dokandari Official TikTok"
                  title="Dokandari Official TikTok"
                  className="w-9 h-9 rounded-full bg-stone-950 hover:bg-[#EE1D52] text-white flex items-center justify-center hover:scale-110 transition-all shadow-xs"
                >
                  <OfficialTikTokIcon className="w-4 h-4" />
                </a>

                {/* 5. Official YouTube SVG */}
                <a
                  href={ytUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Dokandari Official YouTube"
                  title="Dokandari Official YouTube"
                  className="w-9 h-9 rounded-full bg-[#FF0000] hover:bg-[#CC0000] text-white flex items-center justify-center hover:scale-110 transition-all shadow-xs"
                >
                  <OfficialYouTubeIcon className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: ১১টি প্রধান ক্যাটাগরি */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 border-b border-stone-100 pb-2">
              কালেকশন ও ১১টি ক্যাটাগরি
            </h4>
            <ul className="grid grid-cols-1 gap-1.5 text-xs text-stone-600">
              {OFFICIAL_CATEGORIES.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => onSelectCategory(cat.id)}
                    className="hover:text-[#E11D48] transition-colors flex items-center gap-1.5 cursor-pointer text-left"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                    <span>{cat.nameBn}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: কাস্টমার কেয়ার ও সাপোর্ট */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 border-b border-stone-100 pb-2">
              কাস্টমার কেয়ার ও সাপোর্ট
            </h4>
            <ul className="space-y-2 text-xs text-stone-600">
              <li>
                <button
                  onClick={onOpenAbout}
                  className="hover:text-[#E11D48] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                  <span>আমাদের সম্পর্কে (About Dokandari)</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPrivacy}
                  className="hover:text-[#E11D48] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                  <span>প্রাইভেসি পলিসি (Privacy Policy)</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPrivacy}
                  className="hover:text-[#E11D48] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                  <span>৭ দিনের রিটার্ন ও রিফান্ড পলিসি</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPrivacy}
                  className="hover:text-[#E11D48] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                  <span>ডেলিভারি ও শিপিং পলিসি</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPrivacy}
                  className="hover:text-[#E11D48] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                  <span>ব্যবহারের শর্তাবলী (Terms &amp; Conditions)</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenTracking}
                  className="hover:text-[#E11D48] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                  <span>লাইভ অর্ডার ট্র্যাকিং ও রিভিউ</span>
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenAiAssistant}
                  className="text-[#E11D48] font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>Dokandari স্মার্ট শপিং অ্যাসিস্ট্যান্ট</span>
                </button>
              </li>
              <li>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-700 font-bold hover:underline flex items-center gap-1.5"
                >
                  <OfficialWhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
                  <span>২৪ ঘণ্টা সরাসরি WhatsApp সহায়তা</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: অফিসিয়াল যোগাযোগ ও হেল্পলাইন */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 border-b border-stone-100 pb-2">
              অফিসিয়াল যোগাযোগ ও হেল্পলাইন
            </h4>

            {/* Hotline Box */}
            <div className="bg-[#FFF1F2] p-2.5 rounded-xl border border-rose-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-rose-200/70 text-[#E11D48] flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-[10px] text-stone-500 block">হটলাইন (সরাসরি কল):</span>
                <span className="font-mono font-bold text-[#E11D48]">{displayHotline}</span>
              </div>
            </div>

            {/* WhatsApp Box with Official Icon */}
            <a
              href={waUrl}
              target="_blank"
              rel="noreferrer"
              className="bg-[#F0FDF4] hover:bg-emerald-100/70 p-2.5 rounded-xl border border-emerald-200 flex items-center gap-3 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-2xs">
                <OfficialWhatsAppIcon className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <span className="text-[10px] text-stone-500 block">হোয়াটসঅ্যাপ ও ইমো (WhatsApp):</span>
                <span className="font-mono font-bold text-emerald-800">{displayWhatsApp}</span>
              </div>
            </a>

            {/* Email Box */}
            <div className="text-xs text-stone-600 flex items-center gap-2 px-1">
              <Mail className="w-4 h-4 text-stone-400 shrink-0" />
              <span>{displayEmail}</span>
            </div>

            {/* Address 1 Box (Dynamic from Admin Panel) */}
            {address1 && (
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex items-start gap-2.5 text-xs text-stone-600">
                <MapPin className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-stone-900 block text-[11px]">ঠিকানা ১ (শোরুম ও ওয়্যারহাউজ):</strong>
                  <span>{address1}</span>
                </div>
              </div>
            )}

            {/* Address 2 Box (Dynamic from Admin Panel) */}
            {address2 && (
              <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 flex items-start gap-2.5 text-xs text-stone-600">
                <MapPin className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-stone-900 block text-[11px]">ঠিকানা ২ (কর্পোরেট ও ট্রেনিং অফিস):</strong>
                  <span>{address2}</span>
                </div>
              </div>
            )}

            {/* Google Map Link */}
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E11D48] hover:underline pt-1 px-1"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>গুগল ম্যাপে লোকেশন দেখুন (Google Maps)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Bottom Bar: Copyright & 3 Trust Badges */}
        <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <div>
            &copy; 2026 <strong>Dokandari (dokandari.com)</strong>. সর্বস্বত্ব সংরক্ষিত।
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-[#FFF1F2] text-[#E11D48] font-bold px-3 py-1 rounded-full text-[11px]">
              ক্যাশ অন ডেলিভারি
            </span>
            <span className="bg-[#FFF1F2] text-[#E11D48] font-bold px-3 py-1 rounded-full text-[11px]">
              ফাস্ট এক্সপ্রেস ডেলিভারি
            </span>
            <span className="bg-[#FFF1F2] text-[#E11D48] font-bold px-3 py-1 rounded-full text-[11px]">
              সারা দেশে হোম ডেলিভারি
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
