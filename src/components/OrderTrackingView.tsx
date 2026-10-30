/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, Package, CheckCircle2, Clock, Truck, MapPin, AlertCircle, ArrowLeft } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, OrderStatus } from '../types';

interface OrderTrackingViewProps {
  initialOrderId?: string;
  onBackToShopping: () => void;
}

const STATUS_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'pending', label: 'Order Received', description: 'Order details submitted to Dokandari system' },
  { status: 'confirmed', label: 'Confirmed & Verified', description: 'Item verified and passed quality inspection' },
  { status: 'packed', label: 'Packed for Dispatch', description: 'Sealed with tamper-evident Dokandari packaging' },
  { status: 'in_transit', label: 'With Courier Partner', description: 'Handed over for nationwide home delivery' },
  { status: 'delivered', label: 'Delivered', description: 'Parcel delivered and inspected by recipient' },
];

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialOrderId = '',
  onBackToShopping,
}) => {
  const [searchInput, setSearchInput] = useState(initialOrderId);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Sample order for immediate demonstration
  const handleLoadDemo = () => {
    const demo: Order = {
      id: 'DKD-842915',
      customer: {
        name: 'Sadia Sultana',
        phone: '01712345678',
        address: 'House 24, Road 7, Banani',
        city: 'Dhaka',
        district: 'Dhaka',
      },
      items: [
        {
          id: 'item-demo-1',
          productId: 'dkd-dubai-cherry-abaya-black',
          name: 'Dubai Cherry Luxury Front-Open Abaya with Stone Work',
          price: 3450,
          quantity: 1,
          selectedColor: 'Jet Black',
          selectedSize: '54',
          image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=400&q=80',
          category: 'abaya',
        },
      ],
      subtotal: 3450,
      shippingCost: 0,
      discount: 0,
      total: 3450,
      paymentMethod: 'cod',
      status: 'in_transit',
      userId: null,
      createdAt: Date.now() - 3600 * 24 * 1000,
      updatedAt: Date.now(),
      trackingNumber: 'STEADFAST-984210',
      courierName: 'Steadfast Courier (Air/Surface Logistics)',
    };
    setOrder(demo);
    setErrorMsg('');
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const queryTerm = searchInput.trim();
    if (!queryTerm) return;

    setLoading(true);
    setErrorMsg('');
    setOrder(null);

    try {
      // 1. Try finding by direct ID
      const cleanedId = queryTerm.toUpperCase().startsWith('DKD-')
        ? queryTerm.toUpperCase()
        : `DKD-${queryTerm}`;

      const orderRef = doc(db, 'orders', cleanedId);
      const docSnap = await getDoc(orderRef);

      if (docSnap.exists()) {
        setOrder(docSnap.data() as Order);
        setLoading(false);
        return;
      }

      // 2. Alternatively search by phone number
      const ordersCol = collection(db, 'orders');
      const q = query(ordersCol, where('customer.phone', '==', queryTerm));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        setOrder(querySnap.docs[0].data() as Order);
      } else {
        setErrorMsg(`No order found matching "${queryTerm}". Please verify your Order ID or phone number.`);
      }
    } catch (err) {
      console.warn('Order lookup error, presenting fallback guidance', err);
      setErrorMsg('Could not reach order server. Try entering your Order Reference ID.');
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (stepIndex: number, currentStatus: OrderStatus) => {
    const statusOrder: OrderStatus[] = ['pending', 'confirmed', 'packed', 'in_transit', 'delivered'];
    const currentIndex = statusOrder.indexOf(currentStatus);
    if (currentIndex === -1) return 'pending';
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Back button */}
      <button
        onClick={onBackToShopping}
        className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-stone-950 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dokandari Store</span>
      </button>

      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-2 mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-800">
          Real-Time Consignment Tracker
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
          Track Your Dokandari Shipment
        </h1>
        <p className="text-xs sm:text-sm text-stone-500">
          Enter your Order Reference ID (e.g. <code>DKD-842915</code>) or your 11-digit mobile number to check package progress.
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearch} className="max-w-lg mx-auto flex gap-2 mb-8">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Order ID (e.g. DKD-123456) or Mobile..."
            className="w-full pl-9 pr-3 py-3 text-xs sm:text-sm bg-white border border-stone-300 rounded-xl focus:border-stone-900 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-3 bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-rose-300 text-white text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
        >
          {loading ? 'খোঁজা হচ্ছে...' : 'অর্ডার ট্র্যাক করুন'}
        </button>
      </form>

      {/* Helper quick demo test */}
      {!order && !loading && (
        <div className="text-center text-xs text-stone-500 mb-8">
          টেস্টিং অর্ডার দেখতে চান?{' '}
          <button
            onClick={handleLoadDemo}
            className="text-rose-600 font-bold underline hover:text-rose-700 cursor-pointer"
          >
            ডেমো পার্সেল স্ট্যাটাস লোড করুন
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="max-w-lg mx-auto p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5 mb-8">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <p>{errorMsg}</p>
            <p className="mt-1 text-stone-500">
              সহায়তা প্রয়োজন? অফিশিয়াল হোয়াটসঅ্যাপ: <strong>০১৮৮৫৫৩৩৪৩৭</strong>
            </p>
          </div>
        </div>
      )}

      {/* Order Status Display */}
      {order && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 sm:p-8 space-y-8 animate-in fade-in duration-200">
          {/* Order Header Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
            <div>
              <span className="text-xs text-stone-500">Order Reference</span>
              <h2 className="text-xl font-bold font-mono text-stone-900">{order.id}</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold uppercase tracking-wider">
                Status: {order.status.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="py-4">
            <div className="relative">
              {/* Stepper Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-6 sm:gap-2">
                {STATUS_STEPS.map((step, idx) => {
                  const state = getStepStatus(idx, order.status);
                  return (
                    <div key={step.status} className="flex sm:flex-col items-start gap-3 sm:gap-2 text-left">
                      <div className="relative">
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors shrink-0 ${
                            state === 'completed'
                              ? 'bg-emerald-600 text-white'
                              : state === 'current'
                              ? 'bg-[#E11D48] text-white ring-4 ring-rose-100 shadow-xs'
                              : 'bg-stone-100 text-stone-400 border border-stone-300'
                          }`}
                        >
                          {state === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : state === 'current' ? (
                            <Truck className="w-4 h-4" />
                          ) : (
                            idx + 1
                          )}
                        </div>
                      </div>

                      <div>
                        <h4
                          className={`text-xs font-bold ${
                            state === 'completed' || state === 'current'
                              ? 'text-stone-900'
                              : 'text-stone-400'
                          }`}
                        >
                          {step.label}
                        </h4>
                        <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Shipping & Consignment Information Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-stone-200">
            {/* Courier Details */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2 text-xs">
              <h4 className="font-bold text-stone-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-amber-700" />
                <span>Courier Logistics</span>
              </h4>
              <p className="text-stone-700">
                <strong className="text-stone-900">Partner:</strong> {order.courierName || 'Steadfast Courier'}
              </p>
              <p className="text-stone-700 font-mono">
                <strong className="text-stone-900 font-sans">Tracking Code:</strong> {order.trackingNumber || 'PENDING'}
              </p>
              <p className="text-stone-500">
                Delivery rider will contact before arrival. Open parcel inspection is permitted.
              </p>
            </div>

            {/* Delivery Recipient Info */}
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-2 text-xs">
              <h4 className="font-bold text-stone-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-700" />
                <span>Shipping Address</span>
              </h4>
              <p className="text-stone-900 font-medium">{order.customer.name}</p>
              <p className="text-stone-600">{order.customer.address}</p>
              <p className="text-stone-600">
                {order.customer.district}, Bangladesh · {order.customer.phone}
              </p>
            </div>
          </div>

          {/* Items In Parcel */}
          <div className="pt-6 border-t border-stone-200">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900 mb-3">
              Items in this consignment
            </h4>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-stone-200 bg-stone-50/50 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-10 h-10 rounded-md object-cover bg-stone-200 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h5 className="font-semibold text-stone-900">{item.name}</h5>
                      <span className="text-[11px] text-stone-500">
                        Qty: {item.quantity} {item.selectedColor ? `· Color: ${item.selectedColor}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold font-mono text-stone-900 tabular-nums">
                    ৳{(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 text-sm font-bold text-stone-900 border-t border-stone-200 mt-4">
              <span>Total Payable on Delivery:</span>
              <span className="font-mono tabular-nums text-base">
                ৳{order.total.toLocaleString()} ({order.paymentMethod.toUpperCase()})
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
