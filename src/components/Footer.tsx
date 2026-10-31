/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Phone, Mail, MapPin, ExternalLink, Sparkles, User, Lock, LayoutDashboard, Edit3, Save, X, Check } from 'lucide-react';
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
  saveStoreContentPersisted,
  StoreContent,
} from '../lib/storeSync';

interface FooterProps {
  onSelectCategory: (category: ProductCategory) => void;
  onOpenTracking: () => void;
  onOpenAiAssistant: () => void;
  onOpenAbout: () => void;
  onOpenPrivacy: () => void;
  onOpenLogin?: () => void;
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
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
  onUpdateStoreContent?: (updated: StoreContent) => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectCategory,
  onOpenTracking,
  onOpenAiAssistant,
  onOpenAbout,
  onOpenPrivacy,
  onOpenLogin,
  onOpenAdmin,
  isAdmin = false,
  socialLinks,
  whatsappNumber,
  hotlineNumber,
  officialEmail,
  pageContent,
  founderAddress,
  onUpdateStoreContent,
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
    'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)';

  const address2 =
    pageContent?.corporateAddress ||
    DEFAULT_STORE_CONTENT.pageContent?.corporateAddress ||
    'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা';

  const mapUrl =
    pageContent?.googleMapUrl ||
    DEFAULT_STORE_CONTENT.pageContent?.googleMapUrl ||
    `https://maps.google.com/?q=${encodeURIComponent(address1)}`;

  // Admin-Only Social Links & Official Address Editor Modal State
  const [isEditingFooter, setIsEditingFooter] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [formWhatsapp, setFormWhatsapp] = useState(activeSocials.whatsapp);
  const [formFacebook, setFormFacebook] = useState(activeSocials.facebook);
  const [formInstagram, setFormInstagram] = useState(activeSocials.instagram);
  const [formTiktok, setFormTiktok] = useState(activeSocials.tiktok);
  const [formYoutube, setFormYoutube] = useState(activeSocials.youtube);
  const [formHotline, setFormHotline] = useState(displayHotline);
  const [formEmail, setFormEmail] = useState(displayEmail || 'dokandari.shop@gmail.com');
  const [formAddr1, setFormAddr1] = useState(address1);
  const [formAddr2, setFormAddr2] = useState(address2);

  useEffect(() => {
    setFormWhatsapp(activeSocials.whatsapp);
    setFormFacebook(activeSocials.facebook);
    setFormInstagram(activeSocials.instagram);
    setFormTiktok(activeSocials.tiktok);
    setFormYoutube(activeSocials.youtube);
    setFormHotline(displayHotline);
    setFormEmail(displayEmail || 'dokandari.shop@gmail.com');
    setFormAddr1(address1);
    setFormAddr2(address2);
  }, [
    activeSocials.whatsapp,
    activeSocials.facebook,
    activeSocials.instagram,
    activeSocials.tiktok,
    activeSocials.youtube,
    displayHotline,
    displayEmail,
    address1,
    address2,
  ]);

  const handleSaveFooterConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      const updated = await saveStoreContentPersisted({
        socialLinks: {
          whatsapp: formWhatsapp.trim(),
          facebook: formFacebook.trim(),
          instagram: formInstagram.trim(),
          tiktok: formTiktok.trim(),
          youtube: formYoutube.trim(),
        },
        hotlineNumber: formHotline.trim(),
        officialEmail: formEmail.trim(),
        pageContent: {
          ...(pageContent as any),
          warehouseAddress: formAddr1.trim(),
          corporateAddress: formAddr2.trim(),
        },
      });
      if (onUpdateStoreContent) {
        onUpdateStoreContent(updated);
      }
      setEditSaved(true);
      setTimeout(() => {
        setEditSaved(false);
        setIsEditingFooter(false);
      }, 700);
    } catch (err) {
      console.warn('Footer config save note:', err);
      setIsEditingFooter(false);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <footer className="bg-white border-t border-stone-200 text-stone-700 pt-12 pb-8 relative">
      {/* Admin-Only Quick Edit Bar in Footer */}
      {isAdmin && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="bg-[#FFF5F7] border border-rose-200 rounded-2xl p-3 sm:p-4 flex items-center justify-between flex-wrap gap-2 shadow-2xs">
            <div className="text-xs">
              <span className="font-extrabold text-[#E11D48] block">
                অ্যাডমিন কুইক কন্ট্রোল: সোশ্যাল মিডিয়া লিংক ও অফিসিয়াল ঠিকানা (শুধুমাত্র অ্যাডমিন দেখতে পাচ্ছেন)
              </span>
              <span className="text-[11px] text-stone-500">
                কাস্টমার ভিউতে এই এডিট বারটি সম্পূর্ণ লুকানো থাকে
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsEditingFooter(true)}
              className="px-3.5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>✏️ সোশ্যাল লিংক ও ঠিকানা এডিট করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* Admin-Only Modal for Editing Social Media Links & Official Addresses */}
      {isAdmin && isEditingFooter && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-rose-200 text-xs space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900">
                  অফিসিয়াল ঠিকানা ও সোশ্যাল মিডিয়া লিংক এডিট করুন
                </h3>
                <p className="text-[11px] text-stone-500">
                  সেভ করলে সরাসরি ফায়ারস্টোর ডাটাবেজে ও লাইভ ডোমেইনে আপডেট হয়ে যাবে
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingFooter(false)}
                className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFooterConfig} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    ঠিকানা ১ (উপরের ঠিকানা — শোরুম ও ওয়্যারহাউজ)
                  </label>
                  <input
                    type="text"
                    required
                    value={formAddr1}
                    onChange={(e) => setFormAddr1(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">
                    ঠিকানা ২ (নিচের ঠিকানা — কর্পোরেট অফিস)
                  </label>
                  <input
                    type="text"
                    required
                    value={formAddr2}
                    onChange={(e) => setFormAddr2(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">হটলাইন নম্বর</label>
                  <input
                    type="text"
                    value={formHotline}
                    onChange={(e) => setFormHotline(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">অফিসিয়াল ইমেইল</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-stone-200 space-y-2.5">
                <span className="font-extrabold text-[#E11D48] block">
                  সোশ্যাল মিডিয়া পেজ ও চ্যানেল লিংকসমূহ:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">WhatsApp Link / Number</label>
                    <input
                      type="text"
                      value={formWhatsapp}
                      onChange={(e) => setFormWhatsapp(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Facebook Page URL</label>
                    <input
                      type="text"
                      value={formFacebook}
                      onChange={(e) => setFormFacebook(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">Instagram Profile URL</label>
                    <input
                      type="text"
                      value={formInstagram}
                      onChange={(e) => setFormInstagram(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">TikTok Profile URL</label>
                    <input
                      type="text"
                      value={formTiktok}
                      onChange={(e) => setFormTiktok(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-stone-700 mb-1">YouTube Channel URL</label>
                    <input
                      type="text"
                      value={formYoutube}
                      onChange={(e) => setFormYoutube(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setIsEditingFooter(false)}
                  className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  {editSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  <span>{editSaving ? 'সেভ হচ্ছে...' : editSaved ? 'সেভ হয়েছে!' : 'ডাটাবেজে সেভ করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

        {/* Bottom Bar: Copyright, 3 Trust Badges & Bottom-Corner Login Buttons */}
        <div className="pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span>
              &copy; 2026 <strong>Dokandari (dokandari.com)</strong>. সর্বস্বত্ব সংরক্ষিত।
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="bg-[#FFF1F2] text-[#E11D48] font-bold px-3 py-1 rounded-full text-[11px]">
              ক্যাশ অন ডেলিভারি
            </span>
            <span className="bg-[#FFF1F2] text-[#E11D48] font-bold px-3 py-1 rounded-full text-[11px]">
              ফাস্ট এক্সপ্রেস ডেলিভারি
            </span>
            <span className="bg-[#FFF1F2] text-[#E11D48] font-bold px-3 py-1 rounded-full text-[11px]">
              সারা দেশে হোম ডেলিভারি
            </span>

            {/* Bottom Corner Login & Admin Access Buttons (নিচের কোণায় লগইন বাটন) */}
            {onOpenLogin && (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3 py-1 rounded-full border border-stone-200 hover:border-rose-300 bg-stone-50 hover:bg-rose-50 text-stone-700 hover:text-[#E11D48] font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <User className="w-3 h-3 text-[#E11D48]" />
                <span>লগইন</span>
              </button>
            )}

            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="px-3 py-1 rounded-full border border-rose-200 bg-rose-50/70 hover:bg-[#E11D48] text-[#E11D48] hover:text-white font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                {isAdmin ? (
                  <>
                    <LayoutDashboard className="w-3 h-3" />
                    <span>অ্যাডমিন প্যানেল</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3" />
                    <span>স্টোর লগইন</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

