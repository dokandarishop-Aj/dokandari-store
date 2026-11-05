/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, Truck, ArrowRight, Zap, Trash2, Plus, Minus, Upload } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { CustomerInfo, Order, Product } from '../types';
import { trackPixelPageView, trackPixelInitiateCheckout, trackPixelPurchase } from '../lib/pixelManager';
import { captureAbandonedLeadDebounced, markLeadConverted, normalizePhone } from '../lib/leadRecovery';
import {
  resolveSafeProductImageUrl,
  handleProductImageError,
  saveOrderPersisted,
  compressImageFileToDataUrl,
} from '../lib/storeSync';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (orderId: string) => void;
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderSuccess,
  allProducts = [],
  onSelectProduct,
}) => {
  const { items, subtotal, updateQuantity, removeFromCart, clearCart, deliveryZone, setDeliveryZone } = useCart();
  const { firebaseUser, userProfile } = useAuth();

  const initialCustomerName =
    userProfile?.displayName && !userProfile.displayName.toLowerCase().includes('dokandari')
      ? userProfile.displayName
      : '';
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [customerAddress, setCustomerAddress] = useState(userProfile?.address || '');
  const [customerScreenshot, setCustomerScreenshot] = useState<string>(() => {
    try {
      return sessionStorage.getItem('dkd_custom_screenshot_latest') || '';
    } catch {
      return '';
    }
  });
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const currentShippingFee = deliveryZone === 'dhaka' ? 70 : 120;
  const currentTotal = subtotal + currentShippingFee;

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingScreenshot(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 960, 0.78);
      if (compressed) {
        setCustomerScreenshot(compressed);
        try {
          sessionStorage.setItem('dkd_custom_screenshot_latest', compressed);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Screenshot upload note:', err);
    } finally {
      setIsUploadingScreenshot(false);
      e.target.value = '';
    }
  };

  // Track InitiateCheckout cleanly when modal opens & reset completedOrder if new items are in cart
  useEffect(() => {
    if (isOpen && items.length > 0) {
      setCompletedOrder(null);
      setErrorMsg('');
      if (!customerScreenshot) {
        try {
          const saved = sessionStorage.getItem('dkd_custom_screenshot_latest');
          if (saved) setCustomerScreenshot(saved);
        } catch {
          // ignore
        }
      }
      trackPixelInitiateCheckout(items, currentTotal);
    }
  }, [isOpen, items.length]);

  // Real-time Lead Recovery mechanism: automatically captures phone & basic info
  useEffect(() => {
    if (isOpen && customerPhone && normalizePhone(customerPhone).length >= 6) {
      captureAbandonedLeadDebounced({
        customerPhone: normalizePhone(customerPhone),
        customerName,
        customerAddress,
        deliveryArea: deliveryZone,
        source: 'cart_checkout',
        cartItems: items,
        estimatedTotal: currentTotal,
      });
    }
  }, [isOpen, customerPhone, customerName, customerAddress, deliveryZone, items, currentTotal]);

  if (!isOpen) return null;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (items.length === 0) {
      setErrorMsg('আপনার শপিং ব্যাগ খালি। অনুগ্রহ করে পণ্য যোগ করুন।');
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg('অনুগ্রহ করে আপনার সম্পূর্ণ নাম লিখুন।');
      return;
    }
    const cleanPhoneDigits = normalizePhone(customerPhone);
    if (!cleanPhoneDigits || cleanPhoneDigits.length < 10) {
      setErrorMsg('অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }
    if (!customerAddress.trim()) {
      setErrorMsg('অনুগ্রহ করে বাড়ি নং, রোড নং, এলাকা ও পূর্ণ ঠিকানা দিন।');
      return;
    }

    setIsSubmitting(true);

    try {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      const orderId = `DKD-${randomNum}`;

      const customer: CustomerInfo = {
        name: customerName.trim(),
        phone: cleanPhoneDigits,
        address: customerAddress.trim(),
        city: deliveryZone === 'dhaka' ? 'Dhaka' : 'Outside Dhaka',
        district: deliveryZone === 'dhaka' ? 'Dhaka' : 'Bangladesh',
        email: userProfile?.email || undefined,
      };

      const eventId = `dkd_purchase_${orderId}`;
      const newOrder: Order = {
        id: orderId,
        customer,
        items,
        subtotal,
        shippingCost: currentShippingFee,
        discount: 0,
        total: currentTotal,
        paymentMethod: 'cod',
        status: 'pending',
        userId: firebaseUser ? firebaseUser.uid : null,
        customerScreenshot: customerScreenshot || undefined,
        pixelTracking: {
          eventId,
          browserFired: true,
          capiDispatched: false,
          capiStatus: 'Browser Pixel Fired (Dispatching Server CAPI...)',
          updatedAt: Date.now(),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save order to Firestore and local backup
      await saveOrderPersisted(newOrder);

      // Mark abandoned lead as successfully converted
      markLeadConverted(cleanPhoneDigits, orderId);

      try {
        window.history.pushState(null, '', `/?thank_you=${encodeURIComponent(orderId)}&brand=dokandari`);
      } catch {
        // ignore
      }

      setCompletedOrder(newOrder);
      clearCart();

      trackPixelPageView();
      // Track Purchase event across all active pixels & update Firestore order with CAPI receipt
      trackPixelPurchase({
        id: orderId,
        total: currentTotal,
        items,
        customer: { phone: customerPhone, name: customerName, email: userProfile?.email },
      }).then((capiRes) => {
        if (capiRes) {
          const updatedWithTracking: Order = {
            ...newOrder,
            pixelTracking: {
              eventId: capiRes.eventId || eventId,
              browserFired: true,
              capiDispatched: Boolean(capiRes.capiResults && capiRes.capiResults.length > 0),
              capiStatus:
                Array.isArray(capiRes.capiResults) && capiRes.capiResults.length > 0
                  ? capiRes.capiResults.map((r) => `${r.platform}: ${r.status}`).join(' | ')
                  : 'Browser Pixel Active',
              metaPixels: capiRes.metaPixels,
              tiktokPixels: capiRes.tiktokPixels,
              contentIds: capiRes.contentIds,
              capiResults: capiRes.capiResults,
              updatedAt: Date.now(),
            },
          };
          setCompletedOrder(updatedWithTracking);
          saveOrderPersisted(updatedWithTracking).catch(() => null);
        }
      });

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#E11D48', '#BE123C', '#25D366', '#F59E0B'],
        });
      } catch {
        // confetti error ignored
      }
    } catch (err) {
      console.error('Order error:', err);
      setErrorMsg('অর্ডার সাবমিট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-rose-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="bg-gradient-to-r from-rose-600 via-[#E11D48] to-pink-600 text-white p-3.5 sm:p-4 rounded-t-3xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <h3 className="font-extrabold text-sm sm:text-base">
              {completedOrder ? 'অর্ডার সফলভাবে সম্পন্ন হয়েছে!' : 'অর্ডার কনফার্ম ফর্ম'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {completedOrder ? (
          /* Order Confirmation View */
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                ক্যাশ অন ডেলিভারি অর্ডার গৃহীত
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-stone-900">
                ধন্যবাদ, {completedOrder.customer.name}!
              </h2>
              <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                আপনার ক্যাশ অন ডেলিভারি অর্ডারটি আমাদের সিস্টেমে সফলভাবে সংরক্ষিত হয়েছে। আমাদের কাস্টমার প্রতিনিধি শীঘ্রই ফোন করে অর্ডার কনফার্ম করবেন।
              </p>
            </div>

            <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 text-left text-xs space-y-2">
              <div className="flex justify-between font-mono">
                <span className="text-stone-600">অর্ডার নম্বর:</span>
                <span className="font-bold text-[#E11D48] text-sm">{completedOrder.id}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-stone-600">কুরিয়ার স্ট্যাটাস:</span>
                <span className="font-bold text-stone-800">
                  {completedOrder.trackingNumber || 'কনফার্মেশনের পর বুকিং হবে'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">পেমেন্ট মেথড:</span>
                <span className="font-bold text-emerald-700">ক্যাশ অন ডেলিভারি (পণ্য দেখে পেমেন্ট)</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-rose-200 text-stone-900 text-sm">
                <span>সর্বমোট প্রদেয় মূল্য:</span>
                <span className="text-[#E11D48] font-mono">৳{completedOrder.total.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOrderSuccess(completedOrder.id);
                }}
                className="flex-1 py-3 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>অর্ডার লাইভ ট্র্যাক করুন</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="py-3 px-6 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                আরো কেনাকাটা করুন
              </button>
            </div>

            {/* Same-Category Suggested Products on Thank You View */}
            {(() => {
              const orderedCategory = completedOrder.items?.[0]?.category;
              const orderedIds = new Set((completedOrder.items || []).map((i) => i.productId));
              const sameCatProducts = allProducts.filter(
                (p) => !orderedIds.has(p.id) && (!orderedCategory || p.category === orderedCategory)
              );
              const suggested = (
                sameCatProducts.length > 0
                  ? sameCatProducts
                  : allProducts.filter((p) => !orderedIds.has(p.id))
              ).slice(0, 4);

              if (suggested.length === 0) return null;

              return (
                <div className="pt-4 border-t border-stone-200 text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                      ✨ এই ক্যাটাগরির আরও জনপ্রিয় প্রোডাক্ট (Suggested Products)
                    </h4>
                    <span className="text-[10px] font-bold text-[#E11D48] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      ১-ক্লিকে দেখুন ও অর্ডার করুন
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {suggested.map((sp) => (
                      <div
                        key={sp.id}
                        onClick={() => {
                          setCompletedOrder(null);
                          onClose();
                          if (onSelectProduct) onSelectProduct(sp);
                        }}
                        className="group bg-stone-50 hover:bg-rose-50/50 border border-stone-200 hover:border-rose-300 rounded-xl p-2 cursor-pointer transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="aspect-square rounded-lg overflow-hidden bg-white border border-stone-200 mb-1.5">
                            <img
                              src={resolveSafeProductImageUrl(sp.images[0], sp, 0)}
                              alt={sp.name}
                              onError={(e) => handleProductImageError(e, sp, 0)}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <p className="text-[11px] font-bold text-stone-900 line-clamp-2 leading-tight">
                            {sp.name}
                          </p>
                        </div>
                        <div className="mt-1.5 pt-1 border-t border-stone-200/70 flex items-center justify-between">
                          <span className="text-xs font-extrabold font-mono text-[#E11D48]">
                            ৳{sp.price.toLocaleString()}
                          </span>
                          <span className="text-[10px] font-bold text-white bg-[#E11D48] px-2 py-0.5 rounded-md">
                            অর্ডার
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* Compact & Attractive Order Form */
          <form onSubmit={handlePlaceOrder} className="p-4 sm:p-5 space-y-3.5 text-xs">
            {/* Items Summary in Bag */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                <span className="font-bold text-stone-900">
                  নির্বাচিত পণ্য ({items.length})
                </span>
                <span className="text-xs font-bold text-[#E11D48] font-mono">
                  সাবটোটাল: ৳{subtotal.toLocaleString()}
                </span>
              </div>

              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl border border-stone-200 bg-stone-50/70 flex items-center justify-between gap-2.5"
                  >
                    <img
                      src={resolveSafeProductImageUrl(item.image, {
                        id: item.productId,
                        name: item.name,
                        category: item.category,
                      })}
                      alt={item.name}
                      onError={(e) =>
                        handleProductImageError(e, {
                          id: item.productId,
                          name: item.name,
                          category: item.category,
                        })
                      }
                      className="w-11 h-11 rounded-lg object-cover border border-stone-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-stone-900 truncate">{item.name}</h4>
                      <span className="text-xs font-bold text-[#E11D48] font-mono block">
                        ৳{item.price.toLocaleString()}
                      </span>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1 bg-white border border-stone-300 rounded-lg p-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-5 h-5 flex items-center justify-center text-stone-600 hover:text-rose-600 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-bold font-mono">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-5 h-5 flex items-center justify-center text-stone-600 hover:text-rose-600 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-stone-400 hover:text-red-600 ml-1 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Compact Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-800 font-bold mb-1">
                  👤 আপনার নাম *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="আপনার সম্পূর্ণ নাম"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-[#E11D48]"
                />
              </div>

              <div>
                <label className="block text-stone-800 font-bold mb-1">
                  📞 মোবাইল নম্বর (১১ ডিজিট) *
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-[#E11D48]"
                />
              </div>
            </div>

            <div>
              <label className="block text-stone-800 font-bold mb-1">
                📍 সম্পূর্ণ ডেলিভারি ঠিকানা *
              </label>
              <input
                type="text"
                required
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="বাড়ি/রোড, এলাকা, থানা ও জেলা লিখুন..."
                className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-[#E11D48]"
              />
            </div>

            {/* Delivery Area Selection Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDeliveryZone('dhaka')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  deliveryZone === 'dhaka'
                    ? 'bg-[#E11D48] text-white shadow-xs'
                    : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>{deliveryZone === 'dhaka' ? '✓ ' : ''}ঢাকার ভেতরে (+ ৳৭০)</span>
              </button>

              <button
                type="button"
                onClick={() => setDeliveryZone('outside_dhaka')}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  deliveryZone === 'outside_dhaka'
                    ? 'bg-[#E11D48] text-white shadow-xs'
                    : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>{deliveryZone === 'outside_dhaka' ? '✓ ' : ''}ঢাকার বাইরে (+ ৳১২০)</span>
              </button>
            </div>

            {/* Customer Screenshot Upload Box (Sent Directly to Admin Panel with Order) */}
            <div className="p-2.5 rounded-xl bg-stone-50 border border-dashed border-rose-300 flex items-center justify-between gap-2.5 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                {customerScreenshot ? (
                  <img
                    src={customerScreenshot}
                    alt="স্ক্রিনশট"
                    className="w-10 h-10 rounded-lg object-cover border border-rose-300 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-rose-100 text-[#E11D48] flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11.5px] font-extrabold text-stone-900">
                    {customerScreenshot
                      ? '✅ স্ক্রিনশট যুক্ত হয়েছে (অ্যাডমিন প্যানেলে যাবে)'
                      : '📸 প্রোডাক্ট বা অর্ডারের স্ক্রিনশট দিন (ঐচ্ছিক)'}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    স্ক্রিনশট দিলে তা সরাসরি অ্যাডমিন প্যানেলে অর্ডারের সাথে যুক্ত হবে
                  </p>
                </div>
              </div>
              <label className="px-3 py-1.5 bg-white hover:bg-rose-50 text-[#E11D48] border border-rose-300 rounded-lg text-[11px] font-extrabold cursor-pointer transition-colors shrink-0">
                {isUploadingScreenshot
                  ? 'আপলোড হচ্ছে...'
                  : customerScreenshot
                  ? 'পরিবর্তন'
                  : '+ স্ক্রিনশট দিন'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Compact Price Summary */}
            <div className="bg-[#FFF0F3]/80 px-3.5 py-2.5 rounded-xl border border-rose-200 flex items-center justify-between text-xs">
              <span className="font-bold text-stone-800">
                মোট প্রদেয় বিল (ডেলিভারি ৳{currentShippingFee} সহ):
              </span>
              <span className="text-base font-extrabold text-[#E11D48] font-mono tabular-nums">
                ৳{currentTotal.toLocaleString()}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="w-full py-3.5 px-6 bg-[#E11D48] hover:bg-[#BE123C] active:scale-[0.99] text-white rounded-2xl font-black text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>
                {isSubmitting
                  ? 'অর্ডার প্রসেস হচ্ছে...'
                  : `অর্ডার কনফার্ম করুন — ৳${currentTotal.toLocaleString()}`}
              </span>
            </button>

            {/* Trust Badges */}
            <div className="pt-1 flex items-center justify-center gap-4 text-[11px] text-stone-500 font-semibold">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>১০০% রিস্ক-ফ্রি শপিং</span>
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>পণ্য দেখে মূল্য পরিশোধ</span>
              </span>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};
