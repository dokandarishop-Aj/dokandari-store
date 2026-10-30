/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, User, MapPin, Package, Phone, Check, LogOut } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Order } from '../types';

interface CustomerAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectOrderToTrack: (orderId: string) => void;
}

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({
  isOpen,
  onClose,
  onSelectOrderToTrack,
}) => {
  const { userProfile, signOutUser, updateShippingDetails } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [address, setAddress] = useState(userProfile?.address || '');
  const [district, setDistrict] = useState(userProfile?.district || 'Dhaka');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (userProfile?.uid && isOpen) {
      setPhone(userProfile.phone || '');
      setAddress(userProfile.address || '');
      setDistrict(userProfile.district || 'Dhaka');

      const loadOrders = async () => {
        setLoading(true);
        try {
          const ordersCol = collection(db, 'orders');
          const q = query(ordersCol, where('userId', '==', userProfile.uid));
          const snap = await getDocs(q);
          const list: Order[] = [];
          snap.forEach((d) => list.push(d.data() as Order));
          list.sort((a, b) => b.createdAt - a.createdAt);
          setOrders(list);
        } catch (err) {
          console.warn('Could not fetch user orders', err);
        } finally {
          setLoading(false);
        }
      };
      loadOrders();
    }
  }, [userProfile, isOpen]);

  if (!isOpen || !userProfile) return null;

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateShippingDetails(phone, address, district);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-stone-200 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Profile Card Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-stone-200">
          {userProfile.photoURL ? (
            <img
              src={userProfile.photoURL}
              alt={userProfile.displayName}
              className="w-14 h-14 rounded-full object-cover border border-stone-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-[#E11D48] text-white font-bold text-xl flex items-center justify-center shadow-xs">
              {userProfile.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-stone-900">{userProfile.displayName}</h2>
            <p className="text-xs text-stone-500">{userProfile.email}</p>
            <span className="inline-block mt-1 text-[11px] font-semibold uppercase tracking-wider text-rose-800 bg-rose-50 px-2 py-0.5 rounded-sm">
              {userProfile.role === 'admin' ? 'মার্চেন্ট এডমিন' : 'ভেরিফাইড কাস্টমার'}
            </span>
          </div>
        </div>

        {/* Saved Shipping Details Form */}
        <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3 text-xs">
          <h3 className="font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-rose-600" />
            <span>ডিফল্ট ডেলিভারি ঠিকানা</span>
          </h3>

          <form onSubmit={handleSaveShipping} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-600 mb-1 font-medium">মোবাইল নম্বর</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="018XXXXXXXX"
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-rose-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-stone-600 mb-1 font-medium">জেলা / শহর</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="ঢাকা, চট্টগ্রাম, সিলেট..."
                  className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-stone-600 mb-1 font-medium">সম্পূর্ণ ঠিকানা</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="বাসা/হোল্ডিং, রোড, এলাকা/থানা"
                className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              {savedSuccess && (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> ঠিকানা সফলভাবে সংরক্ষিত
                </span>
              )}
              <button
                type="submit"
                className="ml-auto px-4 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-lg font-bold transition-colors cursor-pointer shadow-xs"
              >
                ঠিকানা সেভ করুন
              </button>
            </div>
          </form>
        </div>

        {/* Order History */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
            <Package className="w-4 h-4 text-amber-700" />
            <span>My Order History</span>
          </h3>

          {loading ? (
            <div className="py-6 text-center text-xs text-stone-400">Loading order records...</div>
          ) : orders.length === 0 ? (
            <div className="p-6 text-center bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-500">
              No orders placed under this account yet.
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => {
                    onClose();
                    onSelectOrderToTrack(o.id);
                  }}
                  className="p-3 rounded-xl border border-stone-200 hover:border-stone-400 bg-white transition-all cursor-pointer flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-stone-900">{o.id}</div>
                    <div className="text-[11px] text-stone-400">
                      {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} items
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-stone-900 tabular-nums">
                      ৳{o.total.toLocaleString()}
                    </div>
                    <span className="inline-block text-[10px] font-semibold uppercase px-2 py-0.5 rounded-sm bg-stone-100 text-stone-800">
                      {o.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="pt-4 border-t border-stone-200 flex justify-end">
          <button
            onClick={() => {
              signOutUser();
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
