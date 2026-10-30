/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, MapPin, Phone, Truck, ShieldCheck, RefreshCw, MessageCircle, Edit3 } from 'lucide-react';

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
}

export const FounderSection: React.FC<FounderSectionProps> = ({ founderData, onEdit }) => {
  const data = founderData || {
    name: 'মোঃ জান্নাতুল ইসলাম (জে. আই. রনি)',
    title: 'Founder & CEO, Dokandari',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bio: 'Dokandari বাংলাদেশের অন্যতম বিশ্বস্ত ই-কমার্স ও প্রিমিয়াম লাইফস্টাইল ব্র্যান্ড। আমাদের প্রতিটি প্রোডাক্ট সরাসরি নিজস্ব তত্ত্বাবধানে বাছাইকৃত এবং ১০০% কোয়ালিটি গ্যারান্টিযুক্ত।',
    address: 'প্রধান কার্যালয়: বাইপাইল, আশুলিয়া, সাভার, ঢাকা',
    phone: '+8809638757282',
  };

  return (
    <section className="bg-[#FFF8F9] border-t border-rose-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Founder & CEO Card (Exact replica from user's attached screenshot image_af94ab88.png) */}
        <div className="relative bg-white rounded-3xl border border-rose-200/80 p-6 sm:p-8 shadow-xs max-w-5xl mx-auto">
          {onEdit && (
            <button
              onClick={onEdit}
              className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-white hover:bg-rose-50 text-[#E11D48] border border-rose-200 text-xs font-bold rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer transition-colors"
              title="Edit Founder Details"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#E11D48]" />
              <span>এডিট করুন</span>
            </button>
          )}

          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            
            {/* Founder Avatar with Verified Badge */}
            <div className="flex flex-col items-center shrink-0">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-2 border-rose-200 shadow-sm bg-rose-50">
                <img
                  src={data.photo}
                  alt={`${data.name} - Dokandari Founder & CEO`}
                  className="w-full h-full object-cover object-top"
                  referrerPolicy="no-referrer"
                />
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
                  <span>{data.address}</span>
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
