/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, ShieldCheck, Truck, ArrowRight, Zap, Trash2, Plus, Minus } from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { CustomerInfo, Order } from '../types';
import { trackPixelInitiateCheckout, trackPixelPurchase } from '../lib/pixelManager';
import { captureAbandonedLeadDebounced, markLeadConverted } from '../lib/leadRecovery';
import { resolveSafeProductImageUrl, handleProductImageError, saveOrderPersisted } from '../lib/storeSync';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderSuccess: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  onOrderSuccess,
}) => {
  const { items, subtotal, shippingFee, total, updateQuantity, removeFromCart, clearCart, deliveryZone, setDeliveryZone } = useCart();
  const { firebaseUser, userProfile } = useAuth();

  const initialCustomerName =
    userProfile?.displayName && !userProfile.displayName.toLowerCase().includes('dokandari')
      ? userProfile.displayName
      : '';
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [customerAddress, setCustomerAddress] = useState(userProfile?.address || '');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const currentShippingFee = deliveryZone === 'dhaka' ? 70 : 120;
  const currentTotal = subtotal + currentShippingFee;

  // Track InitiateCheckout cleanly when modal opens
  useEffect(() => {
    if (isOpen && items.length > 0) {
      trackPixelInitiateCheckout(items, currentTotal);
    }
  }, [isOpen, items, currentTotal]);

  // Real-time Lead Recovery mechanism: automatically captures phone & basic info
  useEffect(() => {
    if (isOpen && customerPhone && customerPhone.replace(/\D/g, '').length >= 6) {
      captureAbandonedLeadDebounced({
        customerPhone,
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
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 10) {
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
        phone: customerPhone.trim(),
        address: customerAddress.trim(),
        city: deliveryZone === 'dhaka' ? 'Dhaka' : 'Outside Dhaka',
        district: deliveryZone === 'dhaka' ? 'Dhaka' : 'Bangladesh',
        deliveryNotes: deliveryNotes.trim() || undefined,
        email: userProfile?.email || undefined,
      };

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
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save order to Firestore and local backup
      await saveOrderPersisted(newOrder);

      // Mark abandoned lead as successfully converted
      markLeadConverted(customerPhone, orderId);

      // Track Purchase event across all active pixels
      trackPixelPurchase({
        id: orderId,
        total: currentTotal,
        items,
        customer: { phone: customerPhone, name: customerName, email: userProfile?.email },
      });

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#E11D48', '#BE123C', '#25D366', '#F59E0B'],
        });
      } catch (e) {
        // confetti error ignored
      }

      setCompletedOrder(newOrder);
      clearCart();
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
        className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-rose-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header matching image_89df9fa6.png */}
        <div className="bg-gradient-to-r from-rose-600 via-[#E11D48] to-pink-600 text-white p-4 sm:p-5 rounded-t-3xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            <h3 className="font-extrabold text-sm sm:text-base">
              {completedOrder ? 'অর্ডার সফলভাবে সম্পন্ন হয়েছে!' : `${items.reduce((s, i) => s + i.quantity, 0)} টি আইটেম ব্যাগে সংরক্ষিত`}
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
                <span className="font-bold text-emerald-700">ক্যাশ অন ডেলিভারি (১০০% পণ্য দেখে পেমেন্ট)</span>
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
          </div>
        ) : (
          /* Order Checkout Form matching image_89df9fa6.png */
          <form onSubmit={handlePlaceOrder} className="p-5 sm:p-6 space-y-5 text-xs">
            
            {/* Items Summary in Bag */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-stone-100">
                <span className="font-bold text-stone-900">
                  অর্ডারের আইটেমসমূহ ({items.length})
                </span>
                <span className="text-xs font-bold text-[#E11D48] font-mono">
                  সাবটোটাল: ৳{subtotal.toLocaleString()}
                </span>
              </div>

              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl border border-stone-200 bg-stone-50/70 flex items-center justify-between gap-3"
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
                      className="w-12 h-12 rounded-lg object-cover border border-stone-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-stone-900 truncate">{item.name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-0.5">
                        {item.selectedSize && <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-sm">সাইজ: {item.selectedSize}</span>}
                        {item.selectedColor && <span className="bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-sm">{item.selectedColor}</span>}
                      </div>
                      <span className="text-xs font-bold text-[#E11D48] font-mono mt-0.5 block">
                        ৳{item.price.toLocaleString()}
                      </span>
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center gap-1.5 bg-white border border-stone-300 rounded-lg p-1 shrink-0">
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

            {/* Cash on Delivery Information Banner */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 font-bold text-stone-900">
                <span className="text-[#E11D48]">⚡</span>
                <span>ক্যাশ অন ডেলিভারি তথ্য ও গ্রাহক একাউন্ট</span>
              </div>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                অগ্রিম টাকা লাগবে না
              </span>
            </div>

            {/* Pink Notice Card matching image_89df9fa6.png */}
            <div className="bg-[#FFF1F2] border border-rose-200 rounded-2xl p-3 sm:p-4 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-[#BE123C] text-xs">
                <span>🔒</span>
                <span>১-ক্লিক ক্যাশ অন ডেলিভারি (পাসওয়ার্ড ছাড়াই দ্রুত অর্ডার):</span>
              </div>
              <p className="text-[11px] text-stone-700 leading-relaxed">
                নাম, ১১ ডিজিটের মোবাইল নম্বর এবং ঠিকানা দিয়ে অর্ডার কনফার্ম করুন। পণ্য হাতে পেয়ে মূল্য পরিশোধ করবেন।
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Input Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-stone-800 font-bold mb-1 flex items-center gap-1">
                  <span>👤 আপনার সম্পূর্ণ নাম: *</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="যেমন: ফারহানা হক / ফাতেমা আক্তার"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-[#E11D48] transition-colors"
                />
              </div>

              <div>
                <label className="block text-stone-800 font-bold mb-1 flex items-center gap-1">
                  <span>📞 মোবাইল নম্বর (১১ ডিজিট): *</span>
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="017XXXXXXXX (১১ ডিজিট)"
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-[#E11D48] transition-colors"
                />
              </div>

              {/* Delivery Area Selection Buttons matching image_89df9fa6.png */}
              <div>
                <label className="block text-stone-800 font-bold mb-1 flex items-center gap-1">
                  <span>🚚 ডেলিভারি এরিয়া সিলেক্ট করুন:</span>
                </label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setDeliveryZone('dhaka')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      deliveryZone === 'dhaka'
                        ? 'bg-[#E11D48] text-white shadow-md'
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
                        ? 'bg-[#E11D48] text-white shadow-md'
                        : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <span>{deliveryZone === 'outside_dhaka' ? '✓ ' : ''}ঢাকার বাইরে (+ ৳১২০)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-stone-800 font-bold mb-1 flex items-center gap-1">
                  <span>📍 সম্পূর্ণ ডেলিভারি ঠিকানা: *</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="বাড়ি নং, রোড নং, এলাকা, থানা ও জেলা..."
                  className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-[#E11D48] transition-colors"
                />
              </div>

              <div>
                <label className="block text-stone-600 font-medium mb-1">
                  বিশেষ কোনো নির্দেশনা / নোট (ঐচ্ছিক):
                </label>
                <input
                  type="text"
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="যেমন: বিকেলে ডেলিভারি দিলে ভালো হয়"
                  className="w-full px-3.5 py-2 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-[#E11D48] transition-colors"
                />
              </div>
            </div>

            {/* Price Calculations */}
            <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>প্রোডাক্ট সাবটোটাল:</span>
                <span className="font-mono font-bold">৳{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>ডেলিভারি চার্জ:</span>
                <span className="font-mono font-bold">৳{currentShippingFee}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold text-[#E11D48] pt-2 border-t border-stone-200">
                <span>সর্বমোট ক্যাশ অন ডেলিভারি:</span>
                <span className="font-mono tabular-nums">৳{currentTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Big Vivid Crimson Button (NO BLACK BUTTON!) matching image_89df9fa6.png */}
            <button
              type="submit"
              disabled={isSubmitting || items.length === 0}
              className="w-full py-3.5 px-6 bg-[#E11D48] hover:bg-[#BE123C] active:scale-[0.99] text-white rounded-2xl font-black text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-5 h-5 fill-white" />
              <span>
                {isSubmitting
                  ? 'অর্ডার প্রসেস হচ্ছে...'
                  : `⚡ অর্ডার কনফার্ম করুন (৳${currentTotal.toLocaleString()}) - ক্যাশ অন ডেলিভারি`}
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
