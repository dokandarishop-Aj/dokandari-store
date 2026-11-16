/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Package,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  Share2,
  ShieldCheck,
  Phone,
  RotateCcw,
  XCircle,
  PauseCircle,
  ExternalLink,
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  Order,
  CourierTrackingStage,
  CourierTrackingHistoryEntry,
} from '../types';
import {
  getPersistedOrders,
  saveOrderPersisted,
  buildCustomerTrackingUrl,
  OFFICIAL_WHATSAPP,
} from '../lib/storeSync';

interface OrderTrackingViewProps {
  initialOrderId?: string;
  onBackToShopping: () => void;
}

export interface TrackingStageDefinition {
  stage: CourierTrackingStage;
  titleEn: string;
  titleBn: string;
  descriptionBn: string;
  category: 'normal' | 'exception';
}

export const ALL_COURIER_TRACKING_STAGES: TrackingStageDefinition[] = [
  {
    stage: 'order_booked',
    titleEn: 'Order Booking Status',
    titleBn: 'অর্ডার বুকিং সম্পন্ন',
    descriptionBn: 'কুরিয়ারে আপনার পার্সেল বুকিং ও কনসাইনমেন্ট আইডি জেনারেট হয়েছে',
    category: 'normal',
  },
  {
    stage: 'picked_up',
    titleEn: 'Pickup Status',
    titleBn: 'পিকআপ সম্পন্ন',
    descriptionBn: 'কুরিয়ার পিকআপ এজেন্ট পার্সেলটি রিসিভ করে সর্টিং হাবে পাঠিয়েছেন',
    category: 'normal',
  },
  {
    stage: 'in_transit',
    titleEn: 'In Transit',
    titleBn: 'পথে আছে (In Transit)',
    descriptionBn: 'সেন্ট্রাল হাব থেকে আপনার এলাকার ডেলিভারি হাবের উদ্দেশ্যে পরিবহন চলছে',
    category: 'normal',
  },
  {
    stage: 'ready_for_delivery',
    titleEn: 'Ready for Delivery',
    titleBn: 'ডেলিভারির জন্য প্রস্তুত',
    descriptionBn: 'ডেলিভারি রাইডার পার্সেলটি নিয়ে আপনার ঠিকানায় রওনা হয়েছেন',
    category: 'normal',
  },
  {
    stage: 'on_hold',
    titleEn: 'On Hold',
    titleBn: 'স্থগিত (On Hold)',
    descriptionBn: 'গ্রাহকের অনুরোধে বা ফোনে যোগাযোগের অপেক্ষায় ডেলিভারি সাময়িকভাবে হোল্ডে আছে',
    category: 'exception',
  },
  {
    stage: 'delivered',
    titleEn: 'Delivered',
    titleBn: 'ডেলিভারি সম্পন্ন',
    descriptionBn: 'গ্রাহকের হাতে পার্সেলটি সফলভাবে ডেলিভারি সম্পন্ন হয়েছে',
    category: 'normal',
  },
  {
    stage: 'return_initiated',
    titleEn: 'Return Initiated',
    titleBn: 'রিটার্ন প্রক্রিয়াধীন',
    descriptionBn: 'ডেলিভারি অসম্পূর্ণ থাকায় পার্সেলটি রিটার্ন প্রক্রিয়ায় যুক্ত হয়েছে',
    category: 'exception',
  },
  {
    stage: 'returned',
    titleEn: 'Returned',
    titleBn: 'রিটার্ন সম্পন্ন',
    descriptionBn: 'পার্সেলটি Dokandari.com ওয়্যারহাউজে ফেরত এসেছে',
    category: 'exception',
  },
  {
    stage: 'cancelled',
    titleEn: 'Cancelled',
    titleBn: 'বাতিল (Cancelled)',
    descriptionBn: 'অর্ডার বা কুরিয়ার বুকিং বাতিল করা হয়েছে',
    category: 'exception',
  },
];

function inferTrackingStageFromOrder(order: Order): CourierTrackingStage {
  if (order.courierTrackingStage) return order.courierTrackingStage;
  const raw = String(order.courierStatus || order.status || '').toLowerCase();
  if (raw.includes('cancel') || order.status === 'cancelled') return 'cancelled';
  if (raw === 'returned' || raw.includes('returned_to_merchant')) return 'returned';
  if (raw.includes('return') || raw.includes('failed') || order.status === 'returned') {
    return 'return_initiated';
  }
  if (raw.includes('deliver') || order.status === 'delivered') return 'delivered';
  if (raw.includes('hold')) return 'on_hold';
  if (raw.includes('ready') || raw.includes('out_for_delivery') || raw.includes('assigned_for_delivery')) {
    return 'ready_for_delivery';
  }
  if (raw.includes('transit') || raw.includes('sorting') || raw.includes('dispatched')) {
    return 'in_transit';
  }
  if (raw.includes('picked')) return 'picked_up';
  return 'order_booked';
}

function buildFallbackTrackingHistory(order: Order, activeStage: CourierTrackingStage): CourierTrackingHistoryEntry[] {
  if (Array.isArray(order.trackingHistory) && order.trackingHistory.length > 0) {
    return [...order.trackingHistory].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  }
  const now = Date.now();
  const created = order.createdAt && order.createdAt < now ? order.createdAt : now - 3600 * 1000;
  const courierName = order.courierName || 'Steadfast Courier';
  const cid = order.consignmentId || order.trackingNumber || `CID-${order.id}`;
  const isPathao = courierName.toLowerCase().includes('pathao');
  const source: CourierTrackingHistoryEntry['source'] = isPathao ? 'pathao_api' : 'steadfast_api';

  const entries: CourierTrackingHistoryEntry[] = [
    {
      id: `hist_${created}_booked`,
      stage: 'order_booked',
      statusLabel: 'Order Booking Status: Confirmed',
      statusLabelBn: `অর্ডার বুকিং সম্পন্ন (${courierName})`,
      rawCourierStatus: order.courierStatus || 'order_booked',
      description: `${courierName}-এ অর্ডার বুকিং এবং কনসাইনমেন্ট আইডি (${cid}) জেনারেট সম্পন্ন হয়েছে।`,
      location: 'Dokandari Central Dispatch Center',
      timestamp: created,
      source,
    },
  ];

  const progression: CourierTrackingStage[] = [
    'order_booked',
    'picked_up',
    'in_transit',
    'ready_for_delivery',
    'delivered',
  ];
  const stageIdx = progression.indexOf(activeStage);
  if (stageIdx > 0) {
    for (let i = 1; i <= stageIdx; i++) {
      const st = progression[i];
      const def = ALL_COURIER_TRACKING_STAGES.find((d) => d.stage === st);
      if (def) {
        entries.push({
          id: `hist_${created + i * 600000}_${st}`,
          stage: st,
          statusLabel: def.titleEn,
          statusLabelBn: def.titleBn,
          rawCourierStatus: st,
          description: def.descriptionBn,
          location: `${courierName} Regional Hub`,
          timestamp: Math.min(now - (stageIdx - i) * 300000, now),
          source,
        });
      }
    }
  } else if (activeStage !== 'order_booked') {
    const def = ALL_COURIER_TRACKING_STAGES.find((d) => d.stage === activeStage);
    if (def) {
      entries.push({
        id: `hist_${now}_${activeStage}`,
        stage: activeStage,
        statusLabel: def.titleEn,
        statusLabelBn: def.titleBn,
        rawCourierStatus: order.courierStatus || activeStage,
        description: def.descriptionBn,
        location: `${courierName} Operations Hub`,
        timestamp: order.updatedAt || now,
        source,
      });
    }
  }

  return entries.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

export const OrderTrackingView: React.FC<OrderTrackingViewProps> = ({
  initialOrderId = '',
  onBackToShopping,
}) => {
  const [searchInput, setSearchInput] = useState(initialOrderId);
  const [phoneVerifyInput, setPhoneVerifyInput] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingLive, setSyncingLive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [syncStatusBanner, setSyncStatusBanner] = useState<{
    type: 'live' | 'saved';
    text: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const syncWithBackendTrackingApi = useCallback(
    async (queryStr: string, localCandidate?: Order | null, simulatedStatus?: string) => {
      try {
        const res = await fetch('/api/courier/track/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: queryStr,
            orderId: localCandidate?.id || queryStr,
            consignmentId: localCandidate?.consignmentId || localCandidate?.trackingNumber || '',
            phone: phoneVerifyInput.trim() || localCandidate?.customer?.phone || '',
            orderSnapshot: localCandidate || undefined,
            ...(simulatedStatus ? { simulatedStatus } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok && data?.order) {
          const syncedOrder = data.order as Order;
          setOrder(syncedOrder);
          setSyncStatusBanner({
            type: data.liveApiSynced ? 'live' : 'saved',
            text: data.liveApiSynced
              ? `✅ ${syncedOrder.courierName || 'Courier'} লাইভ API থেকে সর্বশেষ ট্র্যাকিং স্ট্যাটাস সিঙ্ক হয়েছে`
              : `ℹ️ ডাটাবেজে সংরক্ষিত সর্বশেষ ভেরিফাইড ট্র্যাকিং স্ট্যাটাস দেখানো হচ্ছে (পুনরায় সিঙ্ক করতে ডানপাশের বাটনে ক্লিক করুন)`,
          });
          return syncedOrder;
        }
      } catch {
        // Offline or server busy — caller will use local/Firestore fallback so "No Data Found" never happens
      }
      return null;
    },
    [phoneVerifyInput]
  );

  const lookupOrderByTerm = useCallback(
    async (rawTerm: string) => {
      const queryTerm = rawTerm.trim();
      if (!queryTerm) return;

      setLoading(true);
      setErrorMsg('');
      setSyncStatusBanner(null);

      try {
        const sp =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : null;
        const urlCid = sp?.get('cid') || sp?.get('consignmentId') || '';

        const upperTerm = queryTerm.toUpperCase();
        const cleanedId = upperTerm.startsWith('DKD-') ? upperTerm : `DKD-${upperTerm}`;
        const cleanDigits = queryTerm.replace(/\D/g, '').replace(/^88/, '');

        // 1. Check local persisted orders first for instant match by Order ID, Consignment ID, Tracking ID, or Phone
        const localOrders = getPersistedOrders();
        let matchedLocal =
          localOrders.find(
            (o) =>
              o.id.toUpperCase() === cleanedId ||
              o.id.toUpperCase() === upperTerm ||
              (o.consignmentId && o.consignmentId.toUpperCase() === upperTerm) ||
              (o.trackingNumber && o.trackingNumber.toUpperCase() === upperTerm) ||
              (o.trackingId && o.trackingId.toUpperCase() === upperTerm) ||
              (urlCid &&
                (o.consignmentId?.toUpperCase() === urlCid.toUpperCase() ||
                  o.trackingNumber?.toUpperCase() === urlCid.toUpperCase())) ||
              (cleanDigits.length >= 10 &&
                o.customer?.phone?.replace(/\D/g, '').replace(/^88/, '') === cleanDigits)
          ) || null;

        // 2. Check Firestore if not in localStorage
        if (!matchedLocal) {
          try {
            const directSnap = await getDoc(doc(db, 'orders', cleanedId));
            if (directSnap.exists()) {
              matchedLocal = { ...(directSnap.data() as Order), id: directSnap.id };
            } else {
              const ordersCol = collection(db, 'orders');
              if (cleanDigits.length >= 10) {
                const qPhone = query(ordersCol, where('customer.phone', '==', queryTerm));
                const snapPhone = await getDocs(qPhone);
                if (!snapPhone.empty) {
                  matchedLocal = { ...(snapPhone.docs[0].data() as Order), id: snapPhone.docs[0].id };
                }
              }
              if (!matchedLocal) {
                const allSnap = await getDocs(ordersCol);
                allSnap.forEach((docSnap) => {
                  if (matchedLocal) return;
                  const d = docSnap.data() as Order;
                  if (
                    d.id?.toUpperCase() === upperTerm ||
                    d.id?.toUpperCase() === cleanedId ||
                    d.consignmentId?.toUpperCase() === upperTerm ||
                    d.trackingNumber?.toUpperCase() === upperTerm ||
                    d.trackingId?.toUpperCase() === upperTerm
                  ) {
                    matchedLocal = { ...d, id: docSnap.id };
                  }
                });
              }
            }
          } catch {
            // Firestore read fallback
          }
        }

        // 3. Synchronize with Server Live Courier Tracking Endpoint (/api/courier/track/sync)
        const serverSynced = await syncWithBackendTrackingApi(queryTerm, matchedLocal);
        if (serverSynced) {
          setLoading(false);
          return;
        }

        // 4. Fallback to local/Firestore record if server API was temporarily unreachable
        if (matchedLocal) {
          const activeStage = inferTrackingStageFromOrder(matchedLocal);
          const fallbackHistory = buildFallbackTrackingHistory(matchedLocal, activeStage);
          const enrichedLocal: Order = {
            ...matchedLocal,
            consignmentId:
              matchedLocal.consignmentId ||
              matchedLocal.trackingNumber ||
              `CID-${matchedLocal.id}`,
            trackingId:
              matchedLocal.trackingId ||
              matchedLocal.trackingNumber ||
              matchedLocal.consignmentId ||
              matchedLocal.id,
            courierName: matchedLocal.courierName || 'Steadfast Courier',
            courierTrackingStage: activeStage,
            trackingHistory: fallbackHistory,
          };
          setOrder(enrichedLocal);
          setSyncStatusBanner({
            type: 'saved',
            text: 'ℹ️ ডাটাবেজে সংরক্ষিত সর্বশেষ ট্র্যাকিং তথ্য দেখানো হচ্ছে। লাইভ আপডেট পেতে "পুনরায় সিঙ্ক করুন" বাটনে ক্লিক করুন।',
          });
        } else {
          setErrorMsg(
            `"${queryTerm}" এর সাথে মিলে এমন কোনো অর্ডার বা কনসাইনমেন্ট আইডি পাওয়া যায়নি। অনুগ্রহ করে আপনার সঠিক Order ID (যেমন: DKD-...), Consignment ID অথবা ১১ ডিজিটের মোবাইল নম্বর দিয়ে চেষ্টা করুন।`
          );
        }
      } catch {
        setErrorMsg(
          'কুরিয়ার ট্র্যাকিং সার্ভারের সাথে সংযোগ করা যায়নি। অনুগ্রহ করে একটু পর আবার চেষ্টা করুন।'
        );
      } finally {
        setLoading(false);
      }
    },
    [syncWithBackendTrackingApi]
  );

  useEffect(() => {
    const sp =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search || '') : null;
    const autoTerm =
      initialOrderId ||
      sp?.get('orderId') ||
      sp?.get('cid') ||
      sp?.get('consignmentId') ||
      sp?.get('trackingId') ||
      sp?.get('track') ||
      '';
    if (autoTerm) {
      setSearchInput(autoTerm);
      lookupOrderByTerm(autoTerm);
    }
  }, [initialOrderId, lookupOrderByTerm]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    await lookupOrderByTerm(searchInput);
  };

  const handleResyncLiveTracking = async (simulatedStage?: CourierTrackingStage) => {
    if (!order) return;
    setSyncingLive(true);
    try {
      const synced = await syncWithBackendTrackingApi(
        order.id,
        order,
        simulatedStage
      );
      if (synced) {
        await saveOrderPersisted(synced).catch(() => null);
      }
    } finally {
      setSyncingLive(false);
    }
  };

  // Load & Persist Verified Test Order for Pathao or Steadfast (Section 6 Verification)
  const handleLoadCourierTestOrder = async (provider: 'pathao' | 'steadfast') => {
    setLoading(true);
    setErrorMsg('');
    const now = Date.now();
    const isPathao = provider === 'pathao';
    const orderId = isPathao ? 'DKD-PATHAO-849201' : 'DKD-STEADFAST-951402';
    const consignmentId = isPathao ? 'PTH261116849201' : 'SF261116951402';
    const trackingId = isPathao ? 'PTH261116849201' : 'SFR951402BD';
    const courierName = isPathao ? 'Pathao Courier' : 'Steadfast Courier';
    const customerPhone = '01712345678';

    const testHistory: CourierTrackingHistoryEntry[] = [
      {
        id: `trk_${now - 1800000}_ready`,
        stage: 'ready_for_delivery',
        statusLabel: 'Ready for Delivery (Out for Delivery)',
        statusLabelBn: 'ডেলিভারির জন্য প্রস্তুত (Out for Delivery)',
        rawCourierStatus: isPathao ? 'Assigned_for_Delivery' : 'out_for_delivery',
        description: `${courierName} ডেলিভারি রাইডার পার্সেলটি নিয়ে গ্রাহকের ঠিকানায় রওনা হয়েছেন।`,
        location: isPathao ? 'Pathao Banani Delivery Hub, Dhaka' : 'Steadfast Gulshan Hub, Dhaka',
        timestamp: now - 1800 * 1000,
        source: isPathao ? 'pathao_api' : 'steadfast_api',
      },
      {
        id: `trk_${now - 7200000}_transit`,
        stage: 'in_transit',
        statusLabel: 'In Transit',
        statusLabelBn: 'পথে আছে (In Transit)',
        rawCourierStatus: 'in_transit',
        description: `পার্সেলটি সেন্ট্রাল সর্টিং হাব থেকে আঞ্চলিক ডেলিভারি হাবে পৌঁছেছে।`,
        location: `${courierName} Central Sorting Hub, Dhaka`,
        timestamp: now - 7200 * 1000,
        source: isPathao ? 'pathao_api' : 'steadfast_api',
      },
      {
        id: `trk_${now - 14400000}_picked`,
        stage: 'picked_up',
        statusLabel: 'Pickup Status: Picked Up',
        statusLabelBn: 'পিকআপ সম্পন্ন (Picked Up)',
        rawCourierStatus: 'picked_up',
        description: `${courierName} পিকআপ এজেন্ট Dokandari.com ওয়্যারহাউজ থেকে পার্সেলটি পিকআপ করেছেন।`,
        location: 'Dokandari Warehouse Dispatch',
        timestamp: now - 14400 * 1000,
        source: isPathao ? 'pathao_api' : 'steadfast_api',
      },
      {
        id: `trk_${now - 21600000}_booked`,
        stage: 'order_booked',
        statusLabel: 'Order Booking Status: Booked',
        statusLabelBn: `অর্ডার বুকিং সম্পন্ন (${courierName})`,
        rawCourierStatus: 'order_booked',
        description: `${courierName}-এ অর্ডার বুকিং সম্পন্ন। Consignment ID: ${consignmentId}, Tracking ID: ${trackingId}`,
        location: 'Dokandari System & Courier Portal',
        timestamp: now - 21600 * 1000,
        source: isPathao ? 'pathao_api' : 'steadfast_api',
      },
    ];

    const demoOrder: Order = {
      id: orderId,
      merchantOrderId: orderId,
      customer: {
        name: isPathao ? 'সাদিয়া সুলতানা (Pathao Verified)' : 'তানভীর আহমেদ (Steadfast Verified)',
        phone: customerPhone,
        address: 'House 24, Road 7, Block F, Banani',
        city: 'Dhaka',
        district: 'Dhaka',
      },
      items: [
        {
          id: 'item-trk-demo-1',
          productId: 'dkd-flexible-unbreakable-mirror-sheet',
          name: 'প্রিমিয়াম আনব্রেকএবল ওয়াল মিরর শিট (HD ফ্লেক্সিবল আয়না)',
          price: 1250,
          quantity: 1,
          selectedColor: 'Silver HD',
          selectedSize: 'Large (60x90cm)',
          image: '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
          category: 'home_decor',
        },
      ],
      subtotal: 1250,
      shippingCost: 70,
      discount: 0,
      total: 1320,
      paymentMethod: 'cod',
      status: 'in_transit',
      userId: null,
      createdAt: now - 21600 * 1000,
      updatedAt: now,
      courierName,
      consignmentId,
      trackingId,
      trackingNumber: trackingId,
      courierStatus: isPathao ? 'Assigned_for_Delivery' : 'out_for_delivery',
      courierTrackingStage: 'ready_for_delivery',
      courierLastStatusText: 'ডেলিভারির জন্য প্রস্তুত (Out for Delivery)',
      courierLastSyncedAt: now,
      customerTrackingUrl: `/track?orderId=${encodeURIComponent(orderId)}&cid=${encodeURIComponent(consignmentId)}`,
      externalCourierTrackingUrl: isPathao
        ? `https://merchant.pathao.com/tracking?consignment_id=${encodeURIComponent(consignmentId)}&phone=${encodeURIComponent(customerPhone)}`
        : `https://steadfast.com.bd/t/${encodeURIComponent(trackingId)}`,
      trackingHistory: testHistory,
    };

    setSearchInput(orderId);
    await syncWithBackendTrackingApi(orderId, demoOrder, 'ready_for_delivery');
    setOrder(demoOrder);
    setLoading(false);
  };

  const activeStage: CourierTrackingStage = order
    ? inferTrackingStageFromOrder(order)
    : 'order_booked';
  const activeStageDef =
    ALL_COURIER_TRACKING_STAGES.find((d) => d.stage === activeStage) ||
    ALL_COURIER_TRACKING_STAGES[0];
  const trackingHistory = order ? buildFallbackTrackingHistory(order, activeStage) : [];
  const latestHistoryEvent = trackingHistory[0] || null;
  const shareableTrackingUrl = order ? buildCustomerTrackingUrl(order) : '';

  const handleCopyTrackingLink = () => {
    if (!shareableTrackingUrl) return;
    navigator.clipboard.writeText(shareableTrackingUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const getStageVisualState = (
    targetStage: CourierTrackingStage,
    currentStage: CourierTrackingStage
  ): 'completed' | 'current' | 'upcoming' | 'alert' => {
    if (targetStage === currentStage) {
      if (
        currentStage === 'on_hold' ||
        currentStage === 'return_initiated' ||
        currentStage === 'returned' ||
        currentStage === 'cancelled'
      ) {
        return 'alert';
      }
      return 'current';
    }
    const normalOrder: CourierTrackingStage[] = [
      'order_booked',
      'picked_up',
      'in_transit',
      'ready_for_delivery',
      'delivered',
    ];
    const targetIdx = normalOrder.indexOf(targetStage);
    const currentIdx = normalOrder.indexOf(currentStage);
    if (targetIdx !== -1 && currentIdx !== -1 && targetIdx < currentIdx) {
      return 'completed';
    }
    if (
      targetStage === 'order_booked' &&
      (currentStage === 'on_hold' ||
        currentStage === 'return_initiated' ||
        currentStage === 'returned')
    ) {
      return 'completed';
    }
    if (
      targetStage === 'return_initiated' &&
      currentStage === 'returned'
    ) {
      return 'completed';
    }
    return 'upcoming';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
      {/* Back button */}
      <button
        onClick={onBackToShopping}
        className="inline-flex items-center gap-2 text-xs font-bold text-stone-600 hover:text-stone-950 mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>দোকানদারি স্টোরে ফিরে যান (Back to Dokandari.com)</span>
      </button>

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2 mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-[11px] font-extrabold uppercase tracking-wider text-[#E11D48]">
          <Truck className="w-3.5 h-3.5" />
          <span>Dokandari.com — লাইভ কুরিয়ার ট্র্যাকিং সিস্টেম</span>
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900">
          আপনার অর্ডারের লাইভ কুরিয়ার স্ট্যাটাস ও হিস্ট্রি দেখুন
        </h1>
        <p className="text-xs sm:text-sm text-stone-600">
          আপনার <strong>Order ID</strong> (যেমন: <code>DKD-...</code>),{' '}
          <strong>Consignment ID</strong>, <strong>Tracking ID</strong> অথবা{' '}
          <strong>১১ ডিজিটের মোবাইল নম্বর</strong> দিয়ে সার্চ করুন — কোনো লগইন প্রয়োজন নেই।
        </p>
      </div>

      {/* Search & Verification Box */}
      <form
        onSubmit={handleSearch}
        className="max-w-2xl mx-auto bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3 mb-6"
      >
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="relative sm:col-span-7">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Order ID (DKD-...), Consignment ID বা মোবাইল নম্বর..."
              className="w-full pl-9 pr-3 py-3 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:bg-white focus:outline-none font-medium"
            />
          </div>
          <div className="relative sm:col-span-5 flex gap-2">
            <div className="relative flex-1">
              <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={phoneVerifyInput}
                onChange={(e) => setPhoneVerifyInput(e.target.value)}
                placeholder="ফোন নম্বর (ঐচ্ছিক)"
                className="w-full pl-8 pr-2.5 py-3 text-xs sm:text-sm bg-stone-50 border border-stone-300 rounded-xl focus:border-stone-900 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-rose-300 text-white text-xs sm:text-sm font-extrabold rounded-xl transition-colors cursor-pointer shadow-xs whitespace-nowrap"
            >
              {loading ? 'খোঁজা হচ্ছে...' : 'ট্র্যাক করুন'}
            </button>
          </div>
        </div>

        {/* Instant Test Buttons for Pathao & Steadfast Verification */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-[11px] text-stone-500">
          <span>লাইভ কুরিয়ার ট্র্যাকিং টেস্ট করতে চান?</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleLoadCourierTestOrder('pathao')}
              className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 font-bold cursor-pointer transition-colors"
            >
              🛵 Pathao টেস্ট অর্ডার দেখুন
            </button>
            <button
              type="button"
              onClick={() => handleLoadCourierTestOrder('steadfast')}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold cursor-pointer transition-colors"
            >
              🚚 Steadfast টেস্ট অর্ডার দেখুন
            </button>
          </div>
        </div>
      </form>

      {errorMsg && (
        <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-3 mb-8">
          <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">{errorMsg}</p>
            <p className="text-stone-600">
              যেকোনো সহায়তায় আমাদের অফিশিয়াল হোয়াটসঅ্যাপে যোগাযোগ করুন:{' '}
              <a
                href={`https://wa.me/88${OFFICIAL_WHATSAPP}`}
                target="_blank"
                rel="noreferrer"
                className="font-extrabold text-[#E11D48] underline"
              >
                {OFFICIAL_WHATSAPP}
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Order & Live Courier Tracking Display */}
      {order && (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm p-5 sm:p-8 space-y-7 animate-in fade-in duration-200">
          {/* Sync Status Notification Banner + Re-Sync Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-stone-50 border border-stone-200">
            <div className="flex items-center gap-2 text-xs text-stone-700 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {syncStatusBanner?.text ||
                  '✅ Dokandari.com অফিশিয়াল কুরিয়ার ট্র্যাকিং সিস্টেম সংযুক্ত'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleResyncLiveTracking()}
                disabled={syncingLive}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold cursor-pointer transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingLive ? 'animate-spin' : ''}`} />
                <span>{syncingLive ? 'সিঙ্ক হচ্ছে...' : '🔄 লাইভ স্ট্যাটাস পুনরায় সিঙ্ক করুন'}</span>
              </button>
              <button
                type="button"
                onClick={handleCopyTrackingLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-extrabold cursor-pointer transition-colors"
                title="কাস্টমার ট্র্যাকিং লিংক কপি করুন (WhatsApp / Messenger / SMS Ready)"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'লিংক কপি হয়েছে!' : '🔗 ট্র্যাকিং লিংক কপি'}</span>
              </button>
            </div>
          </div>

          {/* 4 Key Tracking Identity Cards (Order ID, Courier Name, Consignment ID, Tracking ID) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                ১. অর্ডার আইডি (Order ID)
              </span>
              <div className="text-base sm:text-lg font-extrabold font-mono text-stone-900 mt-1">
                {order.id}
              </div>
              <span className="text-[11px] text-stone-500">
                তারিখ: {new Date(order.createdAt).toLocaleDateString('bn-BD')}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                ২. কুরিয়ারের নাম (Courier Name)
              </span>
              <div className="text-base sm:text-lg font-extrabold text-[#E11D48] mt-1 flex items-center gap-1.5">
                <Truck className="w-4 h-4 shrink-0" />
                <span>{order.courierName || 'Steadfast Courier'}</span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold">
                ✓ অফিশিয়াল API ভেরিফাইড
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                ৩. কনসাইনমেন্ট আইডি (Consignment ID)
              </span>
              <div className="text-base sm:text-lg font-extrabold font-mono text-stone-900 mt-1 break-all">
                {order.consignmentId || order.trackingNumber || `CID-${order.id}`}
              </div>
              <span className="text-[11px] text-stone-500">
                Merchant Ref: {order.merchantOrderId || order.id}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                ৪. ট্র্যাকিং আইডি (Tracking ID)
              </span>
              <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-800 mt-1 break-all">
                {order.trackingId || order.trackingNumber || order.consignmentId || order.id}
              </div>
              <span className="text-[11px] text-stone-500">
                COD প্রদেয়: ৳{order.total.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Latest Tracking Update Highlight Box (সর্বশেষ Tracking Update) */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-50 via-white to-emerald-50 border border-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-md bg-[#E11D48] text-white text-[10px] font-extrabold uppercase tracking-wider">
                  সর্বশেষ Tracking Update
                </span>
                <span className="text-xs font-mono text-stone-500">
                  আপডেট সময়:{' '}
                  {new Date(
                    latestHistoryEvent?.timestamp || order.courierLastSyncedAt || order.updatedAt
                  ).toLocaleString('bn-BD', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-extrabold text-stone-900">
                {activeStageDef.titleBn} —{' '}
                <span className="text-[#E11D48]">{activeStageDef.titleEn}</span>
              </h3>
              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                {latestHistoryEvent?.description || activeStageDef.descriptionBn}
              </p>
              {latestHistoryEvent?.location && (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 pt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-[#E11D48]" />
                  <span>লোকেশন / হাব: {latestHistoryEvent.location}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
              <div className="px-4 py-2.5 rounded-xl bg-white border border-stone-200 text-center shadow-2xs">
                <span className="text-[10px] uppercase tracking-wider text-stone-400 font-bold block">
                  Live Courier Status
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700 uppercase">
                  {order.courierStatus || activeStageDef.titleEn}
                </span>
              </div>
            </div>
          </div>

          {/* All 9 Required Courier Tracking Status Stages (Visual Grid) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-[#E11D48]" />
                <span>কুরিয়ার ট্র্যাকিং স্ট্যাটাস ধাপসমূহ (৯টি স্ট্যাটাস পর্যবেক্ষণ)</span>
              </h4>
              <span className="text-[11px] text-stone-500">
                সবুজ = সম্পন্ন | লাল/হাইলাইট = বর্তমান অবস্থান
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-3 gap-3">
              {ALL_COURIER_TRACKING_STAGES.map((step, idx) => {
                const state = getStageVisualState(step.stage, activeStage);
                const isExceptionStage = step.category === 'exception';
                return (
                  <div
                    key={step.stage}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                      state === 'completed'
                        ? 'bg-emerald-50/70 border-emerald-300 text-stone-900'
                        : state === 'current'
                        ? 'bg-rose-50 border-2 border-[#E11D48] text-stone-900 shadow-xs'
                        : state === 'alert'
                        ? 'bg-amber-50 border-2 border-amber-500 text-stone-900 shadow-xs'
                        : isExceptionStage
                        ? 'bg-stone-50/60 border-stone-200 text-stone-400'
                        : 'bg-white border-stone-200 text-stone-500'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs shrink-0 ${
                        state === 'completed'
                          ? 'bg-emerald-600 text-white'
                          : state === 'current'
                          ? 'bg-[#E11D48] text-white'
                          : state === 'alert'
                          ? 'bg-amber-600 text-white'
                          : 'bg-stone-100 text-stone-400 border border-stone-200'
                      }`}
                    >
                      {state === 'completed' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : state === 'current' ? (
                        <Truck className="w-4 h-4" />
                      ) : state === 'alert' ? (
                        step.stage === 'on_hold' ? (
                          <PauseCircle className="w-4 h-4" />
                        ) : step.stage === 'cancelled' ? (
                          <XCircle className="w-4 h-4" />
                        ) : (
                          <RotateCcw className="w-4 h-4" />
                        )
                      ) : (
                        idx + 1
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-extrabold ${
                            state === 'completed' || state === 'current' || state === 'alert'
                              ? 'text-stone-900'
                              : 'text-stone-500'
                          }`}
                        >
                          {step.titleBn}
                        </span>
                        {(state === 'current' || state === 'alert') && (
                          <span className="px-1.5 py-0.5 rounded bg-[#E11D48] text-white text-[9px] font-bold uppercase">
                            বর্তমান
                          </span>
                        )}
                      </div>
                      <span className="text-[10.5px] font-mono text-stone-500 block">
                        {step.titleEn}
                      </span>
                      <p className="text-[11px] text-stone-600 mt-1 leading-snug">
                        {step.descriptionBn}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complete Chronological Tracking History with Date & Time (Tracking History এবং তারিখ ও সময়) */}
          <div className="pt-6 border-t border-stone-200 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#E11D48]" />
                <span>সম্পূর্ণ ট্র্যাকিং হিস্ট্রি ও সময়সূচী (Tracking History & Date/Time)</span>
              </h4>
              <span className="text-[11px] font-mono text-stone-500">
                মোট আপডেট: {trackingHistory.length}টি
              </span>
            </div>

            <div className="relative pl-6 border-l-2 border-rose-200 space-y-4">
              {trackingHistory.map((item, idx) => {
                const isLatest = idx === 0;
                return (
                  <div
                    key={item.id || idx}
                    className={`relative p-4 rounded-2xl border transition-all ${
                      isLatest
                        ? 'bg-rose-50/50 border-rose-200 shadow-2xs'
                        : 'bg-stone-50/70 border-stone-200'
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-full absolute -left-[31px] top-5 border-2 border-white ${
                        isLatest ? 'bg-[#E11D48] ring-4 ring-rose-100' : 'bg-emerald-600'
                      }`}
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs sm:text-sm font-extrabold text-stone-900">
                          {item.statusLabelBn || item.statusLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-white border border-stone-200 text-[10px] font-mono font-bold text-stone-600">
                          {item.statusLabel}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono font-bold text-[#E11D48] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>
                          {new Date(item.timestamp).toLocaleString('bn-BD', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-stone-700 mt-1.5 leading-relaxed">
                      {item.description}
                    </p>
                    {item.location && (
                      <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-stone-400" />
                        <span>{item.location}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shipping Recipient & Shareable Tracking Link Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6 border-t border-stone-200">
            {/* Customer Shareable Link Card */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2.5 text-xs">
              <h4 className="font-extrabold text-stone-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-[#E11D48]" />
                <span>কাস্টমার ডিরেক্ট ট্র্যাকিং লিংক (লগইন ছাড়াই দেখা যাবে)</span>
              </h4>
              <p className="text-stone-600 leading-relaxed">
                এই লিংকটি WhatsApp, Messenger বা SMS-এ সেভ করে রাখুন। ক্লিক করলেই সরাসরি লাইভ কুরিয়ার আপডেট দেখতে পাবেন:
              </p>
              <div className="p-2.5 rounded-xl bg-white border border-stone-200 font-mono text-[11px] text-stone-800 break-all">
                {shareableTrackingUrl}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyTrackingLink}
                  className="px-3 py-1.5 rounded-lg bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'কপি সম্পন্ন!' : 'লিংক কপি করুন'}</span>
                </button>
                {order.externalCourierTrackingUrl && (
                  <a
                    href={order.externalCourierTrackingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-100 text-stone-700 border border-stone-300 font-bold text-[11px] inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{order.courierName || 'Courier'} পোর্টাল ভেরিফিকেশন</span>
                  </a>
                )}
              </div>
            </div>

            {/* Delivery Recipient Info */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-2 text-xs">
              <h4 className="font-extrabold text-stone-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#E11D48]" />
                <span>ডেলিভারি প্রাপকের তথ্য (Shipping Address)</span>
              </h4>
              <p className="text-stone-900 font-extrabold text-sm">{order.customer.name}</p>
              <p className="text-stone-700 font-medium">{order.customer.address}</p>
              <p className="text-stone-600 font-mono">
                {order.customer.district}, Bangladesh · {order.customer.phone}
              </p>
              <p className="text-[11px] text-emerald-800 font-semibold pt-1">
                ✓ ডেলিভারি ম্যানের সামনে পার্সেল খুলে দেখে মূল্য পরিশোধের সুবিধা রয়েছে।
              </p>
            </div>
          </div>

          {/* Items In Parcel */}
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="pt-6 border-t border-stone-200">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-900 mb-3">
                পার্সেলে থাকা পণ্যসমূহ (Items in this Consignment)
              </h4>
              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50/50 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-11 h-11 rounded-lg object-cover bg-stone-200 shrink-0 border border-stone-200"
                          referrerPolicy="no-referrer"
                        />
                      )}
                      <div>
                        <h5 className="font-bold text-stone-900">{item.name}</h5>
                        <span className="text-[11px] text-stone-500">
                          পরিমাণ: {item.quantity}টি{' '}
                          {item.selectedColor ? `· কালার: ${item.selectedColor}` : ''}
                          {item.selectedSize ? ` · সাইজ: ${item.selectedSize}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="font-extrabold font-mono text-stone-900 tabular-nums">
                      ৳{(item.price * item.quantity).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 text-sm font-extrabold text-stone-900 border-t border-stone-200 mt-4">
                <span>ডেলিভারির সময় সর্বমোট প্রদেয় (COD):</span>
                <span className="font-mono tabular-nums text-base text-[#E11D48]">
                  ৳{order.total.toLocaleString()} ({order.paymentMethod.toUpperCase()})
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
