/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Trash2, ArrowRight, ShoppingBag, Tag, Sparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { trackPixelInitiateCheckout } from '../lib/pixelManager';

interface CartDrawerProps {
  onProceedToCheckout: () => void;
  onExploreProducts: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  onProceedToCheckout,
  onExploreProducts,
}) => {
  const {
    items,
    removeFromCart,
    updateQuantity,
    itemCount,
    subtotal,
    deliveryZone,
    setDeliveryZone,
    shippingFee,
    discount,
    discountCode,
    applyCoupon,
    removeCoupon,
    total,
    isCartOpen,
    setIsCartOpen,
    freeShippingThreshold,
  } = useCart();

  const [inputCoupon, setInputCoupon] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<{ success: boolean; message: string } | null>(null);

  if (!isCartOpen) return null;

  const remainingForFreeShipping = Math.max(0, freeShippingThreshold - subtotal);
  const freeShippingProgress = Math.min(100, (subtotal / freeShippingThreshold) * 100);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCoupon.trim()) return;
    const res = applyCoupon(inputCoupon);
    setCouponFeedback(res);
    if (res.success) {
      setInputCoupon('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-hidden bg-stone-950/50 backdrop-blur-xs transition-opacity duration-300"
      onClick={() => setIsCartOpen(false)}
    >
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between border-l border-stone-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-stone-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-stone-900" />
              <h2 className="text-lg font-bold text-stone-900">Your Shopping Bag</h2>
              <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full tabular-nums">
                {itemCount}
              </span>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              aria-label="Close cart"
              className="p-1.5 text-stone-400 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Free Shipping Progress Bar */}
          {items.length > 0 && (
            <div className="bg-amber-50/70 p-3.5 border-b border-amber-200/60 text-xs">
              <div className="flex items-center justify-between font-medium text-amber-950 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  {remainingForFreeShipping === 0 ? (
                    <span className="font-semibold text-emerald-800">
                      🎉 Free nationwide shipping unlocked!
                    </span>
                  ) : (
                    <span>
                      Add{' '}
                      <strong className="font-mono tabular-nums">
                        ৳{remainingForFreeShipping.toLocaleString()}
                      </strong>{' '}
                      more for FREE delivery!
                    </span>
                  )}
                </span>
                <span className="font-mono font-bold text-amber-800 tabular-nums">
                  {Math.round(freeShippingProgress)}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-amber-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 rounded-full transition-all duration-300"
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Items Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">Your bag is empty</h3>
                  <p className="text-xs text-stone-500 mt-1 max-w-xs">
                    Explore our latest Dubai Cherry abayas, Malaysian hijabs, and organic serums.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    onExploreProducts();
                  }}
                  className="px-5 py-2.5 text-xs font-bold bg-[#E11D48] text-white rounded-xl hover:bg-[#BE123C] transition-colors cursor-pointer shadow-xs"
                >
                  শপিং শুরু করুন &rarr;
                </button>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 p-3 rounded-xl border border-stone-200 bg-white hover:border-stone-300 transition-colors"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-lg object-cover bg-stone-100 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-semibold text-stone-900 line-clamp-1">
                          {item.name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          aria-label="Remove item"
                          className="text-stone-400 hover:text-rose-600 p-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Variant tags */}
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                        {item.selectedColor && <span>Color: {item.selectedColor}</span>}
                        {item.selectedSize && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Size: {item.selectedSize}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-stone-200 rounded-md overflow-hidden bg-stone-50">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-200 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-mono font-medium text-stone-800 tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="px-2 py-0.5 text-xs text-stone-600 hover:bg-stone-200 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-xs font-bold text-stone-900 font-mono tabular-nums">
                        ৳{(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer & Order Calculation */}
          {items.length > 0 && (
            <div className="p-4 sm:p-6 border-t border-stone-200 bg-stone-50 space-y-4">
              
              {/* Delivery Zone Selector */}
              <div>
                <label className="text-xs font-semibold text-stone-800 block mb-1.5">
                  Select Delivery Location:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDeliveryZone('dhaka')}
                    className={`py-2 px-3 rounded-lg border text-left transition-all cursor-pointer ${
                      deliveryZone === 'dhaka'
                        ? 'border-stone-900 bg-white shadow-xs font-medium text-stone-900'
                        : 'border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <div>Inside Dhaka</div>
                    <div className="text-[11px] text-stone-500 font-mono">
                      {remainingForFreeShipping === 0 ? 'FREE' : '৳70'} (24-48h)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryZone('outside_dhaka')}
                    className={`py-2 px-3 rounded-lg border text-left transition-all cursor-pointer ${
                      deliveryZone === 'outside_dhaka'
                        ? 'border-stone-900 bg-white shadow-xs font-medium text-stone-900'
                        : 'border-stone-200 bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    <div>Outside Dhaka</div>
                    <div className="text-[11px] text-stone-500 font-mono">
                      {remainingForFreeShipping === 0 ? 'FREE' : '৳130'} (3-5 days)
                    </div>
                  </button>
                </div>
              </div>

              {/* Coupon Form */}
              <div>
                {discountCode ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs text-emerald-900">
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Code applied: <strong>{discountCode}</strong></span>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-stone-500 hover:text-stone-800 text-xs font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Coupon (e.g. DOKANDARI10)"
                      value={inputCoupon}
                      onChange={(e) => setInputCoupon(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 uppercase"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 text-xs font-semibold bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg transition-colors cursor-pointer"
                    >
                      Apply
                    </button>
                  </form>
                )}
                {couponFeedback && !discountCode && (
                  <p className="text-[11px] text-rose-600 mt-1">{couponFeedback.message}</p>
                )}
              </div>

              {/* Price Calculation Rows */}
              <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-stone-200">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono text-stone-900 tabular-nums">
                    ৳{subtotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Shipping</span>
                  <span className="font-mono text-stone-900 tabular-nums">
                    {shippingFee === 0 ? (
                      <span className="text-emerald-700 font-semibold">FREE</span>
                    ) : (
                      `৳${shippingFee}`
                    )}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Voucher Discount</span>
                    <span className="font-mono tabular-nums">-৳{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-stone-950 pt-2 border-t border-stone-200">
                  <span>Total Amount</span>
                  <span className="font-mono tabular-nums">৳{total.toLocaleString()}</span>
                </div>
              </div>

              {/* Checkout Action Button */}
              <button
                onClick={() => {
                  trackPixelInitiateCheckout(items, total);
                  setIsCartOpen(false);
                  onProceedToCheckout();
                }}
                className="w-full py-3.5 px-4 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-rose-600/20 transition-all cursor-pointer group"
              >
                <span>ক্যাশ অন ডেলিভারি চেকআউট করুন</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>

              <div className="text-center text-[11px] text-stone-500">
                ১০০% ক্যাশ অন ডেলিভারি · পার্সেল দেখে বুঝে নিয়ে মূল্য পরিশোধ
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
