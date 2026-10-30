/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ArrowRight, Truck, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react';
import { ProductCategory } from '../types';

interface HeroProps {
  onSelectCategory: (category: ProductCategory) => void;
  onExploreFestive: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onSelectCategory, onExploreFestive }) => {
  return (
    <section className="relative overflow-hidden bg-[#FAF9F6] border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Text / Value Proposition (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-800 uppercase">
              <span>Authentic Bangladeshi &amp; Dubai Collections</span>
              <span aria-hidden="true">·</span>
              <span>2026 Winter &amp; Festive Edit</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 leading-[1.15] text-balance">
              Timeless modest fashion &amp; botanical skincare crafted for elegance.
            </h1>

            <p className="text-stone-600 text-base sm:text-lg max-w-2xl leading-relaxed">
              Discover authentic Dubai Cherry abayas, Malaysian instant pinless hijabs, Pakistani festive 3-piece suites, and cold-pressed organic glowing serums. Direct to your doorstep with open parcel inspection.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onSelectCategory('abaya')}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-[#E11D48] text-white text-sm font-bold rounded-xl hover:bg-[#BE123C] transition-all shadow-xs cursor-pointer group"
              >
                <span>Shop Dubai Abayas</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onSelectCategory('hijab')}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white text-stone-900 text-sm font-semibold rounded-xl border border-stone-300 hover:border-stone-400 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                <span>Instant Ready Hijabs</span>
              </button>

              <button
                onClick={onExploreFestive}
                className="inline-flex items-center gap-2 px-5 py-3.5 text-stone-700 text-sm font-medium hover:text-amber-800 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Festive 3-Piece Edit</span>
              </button>
            </div>
          </div>

          {/* Right Visual Showcase (5 cols) */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 shadow-sm aspect-4/3 sm:aspect-16/9 lg:aspect-4/3">
              <img
                src="https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=1200&q=80"
                alt="Dokandari Modest Fashion"
                className="w-full h-full object-cover object-center"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                }}
              />
              
              {/* Subtle scrim overlay with brand caption */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/70 via-stone-950/20 to-transparent flex flex-col justify-end p-6 text-white">
                <span className="text-xs uppercase tracking-widest text-amber-300 font-semibold">
                  Hand-Finished Detail
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  Signature Dubai Cherry Collection
                </h3>
                <div className="flex items-center gap-2 text-xs text-stone-300 mt-1">
                  <span>Starting from ৳3,450</span>
                  <span aria-hidden="true">·</span>
                  <span>Free Chiffon Scarf Included</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Full-width 4-Column Trust & Service Strip */}
        <div className="mt-12 pt-8 border-t border-stone-200 grid grid-cols-2 lg:grid-cols-4 gap-6 text-stone-700">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-white border border-stone-200 text-amber-700 shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Nationwide Delivery
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Dhaka in 24–48h, all 64 districts via Steadfast/Pathao
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-white border border-stone-200 text-amber-700 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Open Parcel Inspection
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Check fabric, color &amp; size before paying the rider
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-white border border-stone-200 text-amber-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                100% Genuine Fabrics
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Authentic Korean crepe, Dubai georgette &amp; organic oils
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-white border border-stone-200 text-amber-700 shrink-0">
              <div className="w-5 h-5 flex items-center justify-center font-bold text-xs">
                ৳
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                Flexible Payment
              </h4>
              <p className="text-xs text-stone-500 mt-0.5">
                Cash on Delivery, bKash, Nagad &amp; Rocket supported
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
