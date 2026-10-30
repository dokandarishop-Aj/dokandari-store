/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const MarqueeTicker: React.FC = () => {
  const tickerItems = [
    '১ টি প্রোডাক্ট অর্ডারেও ফ্রি ডেলিভারি!',
    'ক্যাশ অন ডেলিভারি সারা দেশে হোম ডেলিভারি ও দেখে নেওয়ার সুবিধা',
    'DOKANDARI · আপনার সৌন্দর্য আমাদের ঐতিহ্য',
    '🔥 ট্রেন্ডিং: লাক্সারি ২-পিস ও ৩-পিস ফেস্টিভ কালেকশন',
    '☀️ বেস্ট সেলার: দুবাই চেরি সফট ব্ল্যাক আবায়া ও বোরকা',
    '🌸 ভাইরাল আইটেম: প্রিমিয়াম মালয়েশিয়ান রেডি পিনলেস হিজাব',
    '✨ ১০০% অরিজিনাল কোয়ালিটি ও ৭ দিনের সহজ এক্সচেঞ্জ গ্যারান্টি',
  ];

  return (
    <aside aria-label="Announcements" className="bg-[#FFF1F2] border-b border-rose-200 text-rose-800 text-xs py-2 overflow-hidden select-none">
      <div className="flex items-center whitespace-nowrap animate-marquee">
        {/* Double list for seamless marquee loop */}
        {[...tickerItems, ...tickerItems].map((item, idx) => (
          <div key={idx} className="flex items-center mx-6 gap-3">
            <span className="font-semibold tracking-wide text-xs">{item}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
          </div>
        ))}
      </div>
    </aside>
  );
};
