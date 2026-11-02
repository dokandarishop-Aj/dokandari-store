/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, MapPin, Phone, Truck, ShieldCheck, RefreshCw, MessageCircle, Edit3, Trash2, Sparkles } from 'lucide-react';

export interface FounderData {
  name: string;
  title: string;
  photo: string;
  bio: string;
  address: string;
  phone: string;
}

interface FounderSectionProps {
  founderData?: FounderData;
  onEdit?: () => void;
  onRemovePhoto?: () => void;
}

export const FounderSection: React.FC<FounderSectionProps> = ({
  founderData,
  onEdit,
  onRemovePhoto,
}) => {
  const data = founderData || {
    name: 'মোহাম্মদ শহিদুল আলম',
    title: 'প্রতিষ্ঠাতা ও চেয়ারম্যান, Dokandari (বিশিষ্ট ব্যবসায়ী ও সমাজসেবক)',
    photo: '',
    bio: 'বিশিষ্ট ব্যবসায়ী, সমাজসেবক ও জনদরদী ব্যক্তিত্ব মোহাম্মদ শহিদুল আলম দীর্ঘদিনের গবেষণা ও গভীর সামাজিক দায়বদ্ধতা থেকে Dokandari প্রতিষ্ঠা করেছেন। অনলাইন কেনাকাটায় সাধারণ মানুষের ভোগান্তি ও প্রতারণা দূর করে একটি আন্তর্জাতিক মানের নির্ভরযোগ্য কেনাকাটার প্ল্যাটফর্ম উপহার দেওয়াই উনার মূল ব্রত। যেখানে প্রতিটি ক্রেতা পাবেন নির্দ্বিধায় ১০০% অরিজিনাল পণ্য, কোনো অগ্রিম ছাড়া ক্যাশ অন ডেলিভারি এবং ডেলিভারি ম্যানের সামনে পার্সেল খুলে দেখার পূর্ণ স্বাধীনতা।',
    address: 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)',
    phone: '+8809638757282',
  };

  const cleanPhoto =
    data.photo && !data.photo.includes('photo-1507003211169-0a1dd7228f2d')
      ? data.photo.trim()
      : '';
  const hasPhoto = Boolean(cleanPhoto);


  return (
    <section className="bg-[#FFF8F9] border-t border-rose-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Founder & CEO Card */}
        <div className="relative bg-white rounded-3xl border border-rose-200/80 p-6 sm:p-8 shadow-xs max-w-5xl mx-auto">
          {onEdit && (
            <div className="flex flex-wrap items-center gap-2 sm:absolute sm:top-4 sm:right-4 z-10 mb-4 sm:mb-0 justify-end">
              {hasPhoto && onRemovePhoto && (
                <button
                  type="button"
                  onClick={onRemovePhoto}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-[11px] font-bold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="ফাউন্ডার ছবি রিমুভ করুন"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>ছবি রিমুভ</span>
                </button>
              )}
              <button
                type="button"
                onClick={onEdit}
                className="px-3 py-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Edit Founder Details & AI Bio"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <Edit3 className="w-3.5 h-3.5 text-white" />
                <span>AI ও প্রোফাইল এডিট</span>
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            
            {/* Founder Avatar with Verified Badge (or Luxury Monogram when photo is removed) */}
            <div className="flex flex-col items-center shrink-0">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-rose-200 shadow-sm bg-gradient-to-br from-[#FFF1F2] via-rose-100 to-rose-200 flex items-center justify-center">
                {hasPhoto ? (
                  <img
                    src={cleanPhoto}
                    alt={`${data.name} - Dokandari Founder & CEO`}
                    className="w-full h-full object-cover object-top"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-2">
                    <ShieldCheck className="w-10 h-10 text-[#E11D48] mb-1" />
                    <span className="text-[11px] font-extrabold text-[#9F1239] leading-tight">
                      DOKANDARI
                    </span>
                    <span className="text-[9px] font-bold text-[#E11D48]">
                      FOUNDER & CEO
                    </span>
                  </div>
                )}
              </div>
              <div className="-mt-3 z-10 bg-[#E11D48] text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-xs">
                <Check className="w-3 h-3 stroke-3" />
                <span>Verified Founder</span>
              </div>
            </div>

            {/* Founder Details */}
            <div className="flex-1 text-center md:text-left space-y-3">
              <div className="inline-block bg-[#FFF1F2] text-[#E11D48] border border-rose-200 text-xs font-bold px-3 py-1 rounded-full">
                {data.title}
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-stone-900">
                {data.name}
              </h3>

              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
                {data.bio}
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 text-xs text-stone-600 font-medium">
                <div className="flex items-center gap-1.5 text-stone-700">
                  <MapPin className="w-4 h-4 text-[#E11D48] shrink-0" />
                  <span>{data.address || 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)'}</span>
                </div>
                <span className="hidden sm:inline text-rose-200">|</span>
                <div className="flex items-center gap-1.5 text-stone-700">
                  <Phone className="w-4 h-4 text-[#E11D48] shrink-0" />
                  <span className="font-mono">হটলাইন: {data.phone}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 4-Column Trust Features Strip (Exact replica from image_af94ab88.png) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
          {/* 1. Cash on Delivery */}
          <div className="bg-white p-4 rounded-2xl border border-rose-100 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-[#E11D48] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-900">ক্যাশ অন ডেলিভারি</h4>
              <p className="text-[11px] text-stone-500">পণ্য দেখে পেমেন্ট</p>
            </div>
          </div>

          {/* 2. 100% Quality */}
          <div className="bg-white p-4 rounded-2xl border border-rose-100 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-[#E11D48] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-900">১০০% কোয়ালিটি</h4>
              <p className="text-[11px] text-stone-500">অরিজিনাল প্রিমিয়াম ফ্যাব্রিক</p>
            </div>
          </div>

          {/* 3. Easy Exchange Policy */}
          <div className="bg-white p-4 rounded-2xl border border-rose-100 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-[#E11D48] flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-900">সহজ এক্সচেঞ্জ পলিসি</h4>
              <p className="text-[11px] text-stone-500">কাস্টমার ফ্রেন্ডলি সাপোর্ট</p>
            </div>
          </div>

          {/* 4. 24h Helpline */}
          <div className="bg-white p-4 rounded-2xl border border-rose-100 flex items-center gap-3 shadow-2xs">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 fill-emerald-600/20" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-stone-900">২৪ ঘণ্টা হেল্পলাইন</h4>
              <p className="text-[11px] text-stone-500">সরাসরি কল ও WhatsApp</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
