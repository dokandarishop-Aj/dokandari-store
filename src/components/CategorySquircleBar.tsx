/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { OFFICIAL_CATEGORIES, ProductCategory } from '../types';

interface CategorySquircleBarProps {
  activeCategory: ProductCategory;
  onSelectCategory: (cat: ProductCategory) => void;
  onOpenDedicatedPage?: (cat: string) => void;
  productCounts?: Record<string, number>;
  orderedCategories?: typeof OFFICIAL_CATEGORIES;
}

export const CategorySquircleBar: React.FC<CategorySquircleBarProps> = ({
  activeCategory,
  onSelectCategory,
  onOpenDedicatedPage,
  productCounts = {},
  orderedCategories = OFFICIAL_CATEGORIES,
}) => {
  return (
    <section className="bg-white border-b border-rose-100/60 py-5 w-full">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[#E11D48] rounded-full" />
            <h2 className="text-sm sm:text-base font-extrabold text-stone-900 tracking-tight">
              পণ্য ক্যাটালগ ও ক্যাটাগরি (Product Categories)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectCategory('all')}
              className={`text-xs font-bold px-3 py-1 rounded-full border transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-2xs'
                  : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
              }`}
            >
              সব পণ্য (All Products)
            </button>
            {activeCategory !== 'all' && onOpenDedicatedPage && (
              <button
                onClick={() => onOpenDedicatedPage(activeCategory)}
                className="text-xs font-bold px-3 py-1 rounded-full bg-rose-50 hover:bg-[#E11D48] text-[#E11D48] hover:text-white border border-rose-200 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>ক্যাটাগরি পেজ দেখুন &rarr;</span>
              </button>
            )}
            <span className="text-xs text-stone-500 font-medium hidden sm:inline">
              {orderedCategories.length} টি প্রধান ক্যাটাগরি
            </span>
          </div>
        </div>

        {/* Dynamic Ordered Product Categories (Default: Home Decor 1st, Gadgets 2nd, Fashion 3rd, etc.) */}
        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
          {orderedCategories.filter((c) => c.visible).map((cat, idx) => {
            const isSelected = activeCategory === cat.id;
            const count = productCounts[cat.id] || 0;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className="flex flex-col items-center shrink-0 w-22 sm:w-26 group transition-transform hover:scale-104 cursor-pointer"
              >
                <div
                  className={`relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 transition-all p-0.5 shadow-2xs ${
                    isSelected
                      ? 'border-[#E11D48] ring-2 ring-rose-200 bg-rose-50 shadow-xs'
                      : 'border-stone-200 hover:border-rose-300 bg-stone-50'
                  }`}
                >
                  <img
                    src={cat.image}
                    alt={cat.nameEn}
                    className="w-full h-full object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                  {/* Subtle Scrim for Contrast */}
                  <div className="absolute inset-x-0 bottom-0 bg-stone-950/75 text-white text-[9px] font-bold py-0.5 text-center leading-tight">
                    {count > 0 ? `${count} টি পণ্য` : `#${idx + 1}`}
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold text-center mt-2 leading-tight transition-colors line-clamp-1 ${
                    isSelected ? 'text-[#E11D48]' : 'text-stone-800 group-hover:text-[#E11D48]'
                  }`}
                >
                  {cat.nameBn}
                </span>
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
};
