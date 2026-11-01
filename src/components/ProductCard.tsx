/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShoppingBag, Edit3, Check, Play } from 'lucide-react';
import { Product } from '../types';
import { useCart } from '../context/CartContext';
import { cleanProductTitle, getProductShareUrl } from '../lib/gemini';
import {
  OFFICIAL_WHATSAPP_INT,
  resolveSafeProductImageUrl,
  handleProductImageError,
} from '../lib/storeSync';
import {
  trackPixelAddToCart,
  trackPixelInitiateCheckout,
  trackPixelWhatsAppConversion,
} from '../lib/pixelManager';
import { OfficialWhatsAppIcon } from './OfficialIcons';

interface ProductCardProps {
  product: Product;
  onOpenDetail: (product: Product) => void;
  onInstantOrder: (product: Product) => void;
  onEditProduct?: (product: Product) => void;
  compact?: boolean;
  greenTheme?: boolean;
}

/**
 * Re-export Official WhatsApp Brand SVG Icon for backward compatibility
 */
export const WhatsAppBrandIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <OfficialWhatsAppIcon className={className} />
);

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onOpenDetail,
  onInstantOrder,
  onEditProduct,
  compact = false,
  greenTheme = false,
}) => {
  const { addToCart } = useCart();
  const [isAdded, setIsAdded] = useState(false);

  const isOrganic = greenTheme || product.category === 'organic_food';

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 25;

  const displayTitle = cleanProductTitle(product.name);
  const primaryImageUrl = resolveSafeProductImageUrl(product.images?.[0], product, 0);
  const shareUrl = getProductShareUrl(product.id);
  const whatsappMessage = encodeURIComponent(
    `আসসালামু আলাইকুম, আমি Dokandari (dokandari.com) থেকে এই প্রোডাক্টটি অর্ডার করতে চাই:\n\nপণ্য: ${displayTitle}\nমূল্য: ৳${product.price}\nলিংক: ${shareUrl}`
  );
  const whatsappHref = `https://wa.me/${OFFICIAL_WHATSAPP_INT}?text=${whatsappMessage}`;

  // Add to Cart handler
  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const defaultColor = product.variants.colors?.[0];
    const defaultSize = product.variants.sizes?.[0];
    addToCart(product, defaultColor, defaultSize, 1);
    trackPixelAddToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      category: product.category,
    });
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 1500);
  };

  return (
    <article
      onClick={() => onOpenDetail(product)}
      className={`group relative flex flex-col bg-white rounded-2xl border overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 cursor-pointer ${
        isOrganic
          ? 'border-emerald-200/90 hover:border-emerald-400'
          : 'border-rose-100/90 hover:border-rose-200'
      }`}
    >
      {/* Square Product Image Area */}
      <div className={`relative aspect-square w-full overflow-hidden ${isOrganic ? 'bg-[#F0FDF4]' : 'bg-stone-50'}`}>
        <img
          src={primaryImageUrl}
          alt={displayTitle}
          onError={(e) => handleProductImageError(e, product, 0)}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
          referrerPolicy="no-referrer"
        />

        {/* Top-Left Video Indicator or Organic Pure Badge */}
        {product.videos && product.videos.length > 0 ? (
          <div className="absolute top-2 left-2">
            <span className="bg-white/95 text-stone-900 border border-stone-200 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-xs shadow-2xs">
              <Play className={`w-2.5 h-2.5 ${isOrganic ? 'fill-[#16A34A] text-[#16A34A]' : 'fill-[#E11D48] text-[#E11D48]'}`} /> ভিডিও
            </span>
          </div>
        ) : isOrganic ? (
          <div className="absolute top-2 left-2">
            <span className="bg-[#ECFDF5]/95 text-[#15803D] border border-emerald-200 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs">
              🌿 ১০০% অর্গানিক
            </span>
          </div>
        ) : null}

        {/* Top-Right Golden Admin Edit Badge */}
        {onEditProduct && (
          <div className="absolute top-2 right-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditProduct(product);
              }}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-stone-950 font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 transition-all cursor-pointer"
              title="প্রোডাক্ট এডিট করুন"
            >
              <Edit3 className="w-2.5 h-2.5" />
              <span>এডিট</span>
            </button>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div
        className={`${
          compact ? 'p-2 gap-1.5' : 'p-2 sm:p-3.5 gap-1.5 sm:gap-2'
        } flex flex-col flex-1 justify-between`}
      >
        <div className="space-y-1">
          {/* Rating & Stock Pill Row */}
          <div className="flex items-center gap-1 text-[9.5px] sm:text-[11px]">
            <span className="text-amber-500 font-extrabold flex items-center gap-0.5 shrink-0">
              ★ <span className="text-stone-700">{product.rating || 5}</span>
            </span>
            <span className="text-stone-300">•</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[8.5px] sm:text-[10px] font-bold truncate border ${
                isOrganic
                  ? 'bg-[#ECFDF5] text-[#15803D] border-emerald-200/80'
                  : 'bg-rose-50 text-[#E11D48] border-rose-200/70'
              }`}
            >
              {product.inStock ? '✓ স্টকে আছে' : 'স্টক আউট'}
            </span>
          </div>

          {/* Product Title */}
          <h3
            className={`${
              compact
                ? 'text-[10.5px] line-clamp-1'
                : 'text-[11px] sm:text-[13px] line-clamp-1'
            } font-extrabold text-stone-900 leading-snug transition-colors ${
              isOrganic ? 'group-hover:text-[#15803D]' : 'group-hover:text-[#E11D48]'
            }`}
          >
            {displayTitle}
          </h3>

          {/* Secondary Subtitle Line */}
          {!compact && (
            <p
              className={`text-[9.5px] sm:text-[10px] font-medium line-clamp-1 ${
                isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'
              }`}
            >
              {product.titleEn ? `${product.titleEn} | Dokandari` : `${displayTitle} | Dokandari`}
            </p>
          )}
        </div>

        <div className="space-y-1.5 pt-0.5">
          {/* Price + Strikethrough + Discount Pill Row */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            <span
              className={`${
                compact ? 'text-xs sm:text-sm' : 'text-[13px] sm:text-base'
              } font-extrabold font-mono tabular-nums ${
                isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'
              }`}
            >
              ৳{product.price.toLocaleString()}
            </span>
            {product.originalPrice && (
              <span className="text-[9.5px] sm:text-xs text-stone-400 line-through font-mono tabular-nums">
                ৳{product.originalPrice.toLocaleString()}
              </span>
            )}
            {discountPercent > 0 && (
              <span
                className={`text-[8.5px] sm:text-[10px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded tabular-nums border ${
                  isOrganic
                    ? 'bg-[#ECFDF5] text-[#15803D] border-emerald-200/80'
                    : 'bg-rose-50 text-[#E11D48] border-rose-200/80'
                }`}
              >
                -{discountPercent}%
              </span>
            )}
          </div>

          {/* Action Buttons Layout */}
          <div className="space-y-1.5 pt-0.5">
            <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
              {/* Top-Left: Official Green WhatsApp Button with Pixel Conversion Tracking */}
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation();
                  trackPixelWhatsAppConversion(product, 'product_card');
                }}
                title="হোয়াটসঅ্যাপে অর্ডার করুন"
                className={`${
                  compact
                    ? 'py-1 px-1 text-[8.5px]'
                    : 'py-1.5 px-1 sm:px-2 text-[9.5px] sm:text-[11px]'
                } bg-[#10B981] hover:bg-[#059669] active:scale-95 text-white rounded-lg font-extrabold flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer leading-none whitespace-nowrap overflow-hidden`}
              >
                <OfficialWhatsAppIcon className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0'} />
                <span className="tracking-tight">WhatsApp</span>
              </a>

              {/* Top-Right: Cart Button */}
              <button
                type="button"
                onClick={handleQuickAdd}
                title="কার্টে যোগ করুন"
                className={`${
                  compact
                    ? 'py-1 px-1 text-[8.5px]'
                    : 'py-1.5 px-1 sm:px-2 text-[9.5px] sm:text-[11px]'
                } bg-white active:scale-95 border rounded-lg font-extrabold flex items-center justify-center gap-1 transition-all cursor-pointer leading-none whitespace-nowrap overflow-hidden ${
                  isOrganic
                    ? 'hover:bg-[#ECFDF5] border-emerald-200 text-[#15803D]'
                    : 'hover:bg-rose-50 border-rose-200 text-[#E11D48]'
                }`}
              >
                {isAdded ? (
                  <>
                    <Check className={compact ? 'w-2.5 h-2.5 text-emerald-600 shrink-0' : 'w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0'} />
                    <span className="text-emerald-700">যুক্ত</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag
                      className={`${
                        compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0'
                      } ${isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'}`}
                    />
                    <span>কার্ট</span>
                  </>
                )}
              </button>
            </div>

            {/* Bottom Row: Full-Width "অর্ডার করুন" Button (Soft Organic Green for Organic Food, Crimson Rose for others) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                trackPixelInitiateCheckout(
                  [{ id: product.id, name: product.name, price: product.price, quantity: 1 }],
                  product.price
                );
                onInstantOrder(product);
              }}
              className={`${
                compact ? 'py-1.5 px-2 text-[10px]' : 'py-2 px-2.5 text-[11px] sm:text-xs'
              } w-full active:scale-[0.98] text-white rounded-lg font-extrabold flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md ring-2 transition-all duration-200 cursor-pointer group/order ${
                isOrganic
                  ? 'bg-gradient-to-r from-[#16A34A] via-[#22C55E] to-[#15803D] hover:from-[#15803D] hover:to-[#166534] ring-emerald-200/70'
                  : 'bg-gradient-to-r from-[#E11D48] via-[#F43F5E] to-[#BE123C] hover:from-[#BE123C] hover:to-[#9F1239] ring-rose-300/60'
              }`}
            >
              <ShoppingBag
                className={`${
                  compact ? 'w-3 h-3' : 'w-3.5 h-3.5'
                } text-white shrink-0 animate-bounce`}
              />
              <span className="tracking-wide">অর্ডার করুন</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
