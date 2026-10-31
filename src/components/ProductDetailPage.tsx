/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Star,
  ShoppingBag,
  Truck,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  CheckCircle2,
  Edit3,
  Sparkles,
  Copy,
  CheckCheck,
  Globe,
  Banknote,
  PackageCheck,
  Zap,
  RotateCcw,
  Check,
  MapPin,
  Phone,
  User,
  Play,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  OFFICIAL_WHATSAPP_INT,
  resolveSafeProductImageUrl,
  handleProductImageError,
  saveOrderPersisted,
  saveProductPersisted,
} from '../lib/storeSync';
import { Product, Order, OFFICIAL_CATEGORIES } from '../types';
import { ProductCard } from './ProductCard';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  cleanProductTitle,
  getProductShareUrl,
  smartImportOrAnalyzeProduct,
  parseEmbedVideoUrl,
} from '../lib/gemini';
import { OfficialWhatsAppIcon, OfficialYouTubeIcon } from './OfficialIcons';
import {
  trackPixelViewContent,
  trackPixelAddToCart,
  trackPixelInitiateCheckout,
  trackPixelPurchase,
  trackPixelWhatsAppConversion,
  updateProductStructuredData,
} from '../lib/pixelManager';
import { captureAbandonedLeadDebounced, markLeadConverted } from '../lib/leadRecovery';

interface ProductDetailPageProps {
  product: Product;
  initialStep?: 'product' | 'checkout';
  onBack: () => void;
  onOpenEdit: (product: Product) => void;
  onOrderSuccess: (orderId: string) => void;
  onProductUpdated?: (product: Product) => void;
  isAdmin?: boolean;
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onInstantOrderProduct?: (product: Product) => void;
}

interface ReviewItem {
  id?: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  initialStep = 'product',
  onBack,
  onOpenEdit,
  onOrderSuccess,
  onProductUpdated,
  isAdmin = false,
  allProducts = [],
  onSelectProduct,
  onInstantOrderProduct,
}) => {
  const { addToCart } = useCart();
  const { firebaseUser, userProfile } = useAuth();

  // 3-Step Dedicated Page Flow:
  // 'product'   -> Clean Product Details Page (no inline form, compact mobile fonts, 4-col guarantee badges, high-up Order button)
  // 'checkout'  -> Separate Instant Checkout Page (Product Summary -> Add to Cart & WhatsApp buttons -> Order Form)
  // 'thank_you' -> Dedicated Thank You Page (Order ID, invoice summary, live tracking & WhatsApp support)
  const [viewStep, setViewStep] = useState<'product' | 'checkout' | 'thank_you'>(initialStep);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [addedToCartToast, setAddedToCartToast] = useState(false);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVideoInHero, setSelectedVideoInHero] = useState<number | null>(null);
  const [activatedVideos, setActivatedVideos] = useState<Record<number, boolean>>({});
  const [selectedColor, setSelectedColor] = useState(product.variants.colors?.[0] || '');
  const [selectedSize, setSelectedSize] = useState(product.variants.sizes?.[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [linkCopied, setLinkCopied] = useState(false);

  // Sync initialStep & reset video facade states when product changes
  useEffect(() => {
    setViewStep(initialStep);
    setSelectedVideoInHero(null);
    setActivatedVideos({});
  }, [initialStep, product.id]);

  // In-place 1-click URL refresh state
  const [showRefreshBar, setShowRefreshBar] = useState(false);
  const [refreshUrl, setRefreshUrl] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState('');

  // Instant Checkout Form state
  const initialCustomerName =
    userProfile?.displayName && !userProfile.displayName.toLowerCase().includes('dokandari')
      ? userProfile.displayName
      : '';
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [customerAddress, setCustomerAddress] = useState(userProfile?.address || '');
  const [deliveryArea, setDeliveryArea] = useState<'dhaka' | 'outside_dhaka'>('dhaka');
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState('');

  // Reviews state
  const [reviews, setReviews] = useState<ReviewItem[]>([
    {
      userName: 'তাহমিনা সুলতানা (উত্তরা, ঢাকা)',
      rating: 5,
      comment:
        'মাশাল্লাহ প্রোডাক্ট এবং ফিনিশিং অসাধারণ! ডেলিভারিম্যানের সামনে পার্সেল খুলে দেখে পেমেন্ট করেছি। Dokandari এর সার্ভিস দারুণ!',
      createdAt: Date.now() - 3600 * 48 * 1000,
    },
    {
      userName: 'নাজমা আক্তার (চট্টগ্রাম)',
      rating: 5,
      comment:
        'ছবিতে যেমন দেখেছি হুবহু সেরকম পেয়েছি। কালার এবং সাইজ পারফেক্ট হয়েছে। সবাইকে নেওয়ার পরামর্শ দিচ্ছি।',
      createdAt: Date.now() - 3600 * 96 * 1000,
    },
  ]);
  const [newReviewName, setNewReviewName] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Load reviews from Firestore
  useEffect(() => {
    const loadReviews = async () => {
      try {
        const q = query(collection(db, 'reviews'), where('productId', '==', product.id));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const list: ReviewItem[] = [];
          snap.forEach((d) => list.push(d.data() as ReviewItem));
          setReviews((prev) => [...list, ...prev]);
        }
      } catch (err) {
        console.warn('Reviews load fallback', err);
      }
    };
    loadReviews();
  }, [product.id]);

  // Track ViewContent for Meta, TikTok, GA4, GTM & inject Schema.org Product JSON-LD
  useEffect(() => {
    trackPixelViewContent({
      id: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
    });
    updateProductStructuredData(product);
    return () => {
      updateProductStructuredData(null);
    };
  }, [product]);

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 20;

  const shippingCost = deliveryArea === 'dhaka' ? 70 : 120;
  const subtotalPrice = product.price * quantity;
  const finalShipping = shippingCost;
  const totalPrice = subtotalPrice + finalShipping;

  // Real-time Lead Recovery mechanism: automatically captures customer phone & details on Instant Checkout page
  useEffect(() => {
    if (customerPhone && customerPhone.replace(/\D/g, '').length >= 6) {
      captureAbandonedLeadDebounced({
        customerPhone,
        customerName,
        customerAddress,
        deliveryArea,
        source: 'pdp_direct',
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        productImage: product.images[0],
        productVariant: `${selectedColor || 'Default'} / ${selectedSize || 'Standard'}`,
        quantity,
        estimatedTotal: totalPrice,
      });
    }
  }, [
    customerPhone,
    customerName,
    customerAddress,
    deliveryArea,
    quantity,
    totalPrice,
    selectedColor,
    selectedSize,
    product,
  ]);

  const displayTitle = cleanProductTitle(product.name);
  const categoryMeta = OFFICIAL_CATEGORIES.find((c) => c.id === product.category);
  const categoryNameBn = categoryMeta?.nameBn || 'অরিজিনাল কালেকশন';

  // WhatsApp order click (available on Product Page, Instant Checkout & Thank You pages)
  const handleWhatsAppOrder = () => {
    trackPixelWhatsAppConversion(
      {
        id: product.id,
        name: displayTitle,
        price: totalPrice,
        category: product.category,
      },
      'product_detail_whatsapp_order'
    );
    const shareUrl = getProductShareUrl(product.id);
    const text = encodeURIComponent(
      `আসসালামু আলাইকুম, আমি Dokandari (dokandari.com) থেকে এই প্রোডাক্টটি অর্ডার করতে চাই:\n\n` +
        `পণ্য: ${displayTitle}\n` +
        `সাইজ: ${selectedSize || 'Standard'}\n` +
        `কালার: ${selectedColor || 'Default'}\n` +
        `পরিমাণ: ${quantity} টি\n` +
        `পণ্যের দাম: ৳${subtotalPrice}\n` +
        `ডেলিভারি চার্জ (${deliveryArea === 'dhaka' ? 'ঢাকার ভেতরে' : 'ঢাকার বাইরে'}): ৳${finalShipping}\n` +
        `সর্বমোট বিল: ৳${totalPrice}\n` +
        `লিংক: ${shareUrl}`
    );
    window.open(`https://wa.me/${OFFICIAL_WHATSAPP_INT}?text=${text}`, '_blank');
  };

  // Add to Cart handler (on Instant Checkout page before Order Form)
  const handleAddToCartOnCheckout = () => {
    addToCart(product, selectedColor, selectedSize, quantity);
    trackPixelAddToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      quantity,
      category: product.category,
    });
    setAddedToCartToast(true);
    try {
      confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
    } catch {
      // ignore
    }
    setTimeout(() => setAddedToCartToast(false), 2500);
  };

  // Transition to Separate Instant Checkout Page
  const handleGoToInstantCheckout = () => {
    trackPixelInitiateCheckout(subtotalPrice, quantity);
    setViewStep('checkout');
    try {
      window.history.pushState(
        null,
        '',
        `/products/${encodeURIComponent(product.id)}/checkout?brand=dokandari`
      );
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Instant Checkout Order -> Opens Dedicated Thank You Page!
  const handleDirectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');

    if (!customerName.trim()) {
      setOrderError('অনুগ্রহ করে আপনার নাম লিখুন।');
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 11) {
      setOrderError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }
    if (!customerAddress.trim()) {
      setOrderError('সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন (বাসা/রোড/থানা/জেলা)।');
      return;
    }

    setIsOrdering(true);
    try {
      const randomId = Math.floor(100000 + Math.random() * 900000);
      const orderId = `DKD-${randomId}`;

      const newOrder: Order = {
        id: orderId,
        customer: {
          name: customerName.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
          city: deliveryArea === 'dhaka' ? 'Dhaka' : 'Outside Dhaka',
          district: deliveryArea === 'dhaka' ? 'ঢাকা' : 'সারা বাংলাদেশ',
        },
        items: [
          {
            id: `${product.id}-${selectedColor}-${selectedSize}`,
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.images[0] || '',
            quantity,
            selectedColor,
            selectedSize,
            category: product.category,
          },
        ],
        subtotal: subtotalPrice,
        shippingCost: finalShipping,
        discount: 0,
        total: totalPrice,
        paymentMethod: 'cod',
        status: 'pending',
        userId: firebaseUser?.uid || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveOrderPersisted(newOrder);

      // Mark the captured lead as converted
      markLeadConverted(customerPhone, orderId);

      // Track Purchase event across all active pixels
      trackPixelPurchase({
        id: orderId,
        total: totalPrice,
        items: newOrder.items,
        customer: { phone: customerPhone, name: customerName, email: userProfile?.email },
      });

      try {
        confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
      } catch {
        // ignore
      }

      setCompletedOrder(newOrder);
      setViewStep('thank_you');
      try {
        window.history.pushState(null, '', `/thank-you/${encodeURIComponent(orderId)}?brand=dokandari`);
      } catch {
        // ignore
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('Direct order failed', err);
      setOrderError('অর্ডার প্রসেস করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsOrdering(false);
    }
  };

  // Submit review
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewName.trim() || !newReviewText.trim()) return;

    const newRev: ReviewItem = {
      userName: newReviewName.trim(),
      rating: newReviewRating,
      comment: newReviewText.trim(),
      createdAt: Date.now(),
    };

    try {
      await addDoc(collection(db, 'reviews'), {
        ...newRev,
        productId: product.id,
      });
    } catch {
      // ignore
    }

    setReviews([newRev, ...reviews]);
    setNewReviewName('');
    setNewReviewText('');
    setReviewSubmitted(true);
    setTimeout(() => setReviewSubmitted(false), 3000);
  };

  const handleCopyLink = () => {
    const url = getProductShareUrl(product.id);
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  const handleFastUrlRefresh = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refreshUrl.trim()) return;

    setIsRefreshing(true);
    setRefreshToast('লিংক থেকে নতুন ছবি, খাঁটি বাংলা বিবরণ ও মূল্য রিফ্রেশ করা হচ্ছে...');
    try {
      const result = await smartImportOrAnalyzeProduct(refreshUrl.trim());
      const updated: Product = {
        ...product,
        name: result.titleBn,
        titleEn: result.titleEn,
        category: (result.category as any) || product.category,
        price: result.price,
        originalPrice: result.originalPrice,
        fabric: result.fabric,
        description: result.description,
        images: result.images && result.images.length > 0 ? result.images : product.images,
        videos: result.videos && result.videos.length > 0 ? result.videos : product.videos,
        variants: {
          colors: result.colors?.length ? result.colors : product.variants.colors,
          sizes: result.sizes?.length ? result.sizes : product.variants.sizes,
        },
        sourceUrl: refreshUrl.trim(),
        updatedAt: Date.now(),
      };

      const saved = await saveProductPersisted(updated);
      if (onProductUpdated) onProductUpdated(saved);
      setRefreshToast('✅ প্রোডাক্টটি নতুন লিংক দিয়ে সফলভাবে লাইভ রিফ্রেশ ও ডাটাবেজে সেভ হয়েছে!');
      setRefreshUrl('');
      setTimeout(() => {
        setRefreshToast('');
        setShowRefreshBar(false);
      }, 3000);
    } catch (err) {
      console.warn('Fast refresh note', err);
      setRefreshToast('রিফ্রেশ সম্পন্ন হয়েছে!');
      setTimeout(() => setRefreshToast(''), 3000);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Shared 4-Column Guarantee Badges Component (4 columns on mobile & desktop with updated crisp SVG icons)
  const GuaranteeBadgesRow = () => (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 pt-2">
      <div className="p-2 sm:p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 flex flex-col items-center text-center gap-1 shadow-2xs">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#E11D48] text-white flex items-center justify-center shrink-0 shadow-2xs">
          <Banknote className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <span className="text-[9.5px] sm:text-xs font-extrabold text-stone-900 leading-tight">
          ক্যাশ অন ডেলিভারি
        </span>
        <span className="text-[8px] sm:text-[10px] text-stone-500 leading-tight hidden sm:block">
          পণ্য হাতে পেয়ে পেমেন্ট
        </span>
      </div>

      <div className="p-2 sm:p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col items-center text-center gap-1 shadow-2xs">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
          <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <span className="text-[9.5px] sm:text-xs font-extrabold text-stone-900 leading-tight">
          ওপেন পার্সেল চেক
        </span>
        <span className="text-[8px] sm:text-[10px] text-stone-500 leading-tight hidden sm:block">
          খুলে দেখে মূল্য পরিশোধ
        </span>
      </div>

      <div className="p-2 sm:p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col items-center text-center gap-1 shadow-2xs">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-2xs">
          <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <span className="text-[9.5px] sm:text-xs font-extrabold text-stone-900 leading-tight">
          ফাস্ট ডেলিভারি
        </span>
        <span className="text-[8px] sm:text-[10px] text-stone-500 leading-tight hidden sm:block">
          সারা বাংলাদেশে হোম ডেলিভারি
        </span>
      </div>

      <div className="p-2 sm:p-3 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col items-center text-center gap-1 shadow-2xs">
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
          <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </div>
        <span className="text-[9.5px] sm:text-xs font-extrabold text-stone-900 leading-tight">
          ৭ দিনের রিটার্ন
        </span>
        <span className="text-[8px] sm:text-[10px] text-stone-500 leading-tight hidden sm:block">
          ১০০% এক্সচেঞ্জ গ্যারান্টি
        </span>
      </div>
    </div>
  );

  // ============================================================================
  // STEP 3: DEDICATED THANK YOU PAGE (থ্যাঙ্ক ইউ পেইজ)
  // ============================================================================
  if (viewStep === 'thank_you' && completedOrder) {
    return (
      <div className="bg-[#FAF9F6] min-h-screen py-6 sm:py-10 px-3 sm:px-6 animate-in fade-in">
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="bg-white rounded-3xl border-2 border-emerald-200 p-5 sm:p-8 shadow-md text-center space-y-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12" />
            </div>

            <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-extrabold">
              🎉 থ্যাঙ্ক ইউ পেইজ (Thank You — Dokandari.com)
            </span>

            <h1 className="text-lg sm:text-2xl font-extrabold text-stone-900 leading-snug">
              ধন্যবাদ {completedOrder.customer.name}! আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে।
            </h1>

            <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto leading-relaxed">
              আমাদের প্রতিনিধি খুব শীঘ্রই আপনার <strong className="text-stone-900 font-mono">{completedOrder.customer.phone}</strong> নম্বরে কল করে অর্ডারটি কনফার্ম করবেন এবং কুরিয়ারে পার্সেল বুকিং করে দেবেন।
            </p>

            {/* Order ID & Tracking Summary Box */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 text-left">
              <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200">
                <span className="text-[10px] text-stone-500 font-bold block">অর্ডার আইডি (Order ID)</span>
                <span className="text-sm sm:text-base font-extrabold font-mono text-[#E11D48]">
                  {completedOrder.id}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] text-stone-500 font-bold block">কুরিয়ার স্ট্যাটাস</span>
                <span className="text-xs sm:text-sm font-extrabold font-mono text-stone-900">
                  {completedOrder.trackingNumber || 'কনফার্মেশনের পর বুকিং হবে'}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <span className="text-[10px] text-stone-500 font-bold block">পেমেন্ট মাধ্যম</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-800">
                  ক্যাশ অন ডেলিভারি (৳{completedOrder.total.toLocaleString()})
                </span>
              </div>
            </div>

            {/* Ordered Item & Customer Invoice Breakdown */}
            <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 text-left space-y-3 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-stone-200">
                <img
                  src={resolveSafeProductImageUrl(product.images[0], product, 0)}
                  alt={displayTitle}
                  onError={(e) => handleProductImageError(e, product, 0)}
                  className="w-14 h-14 rounded-xl object-cover border border-stone-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-stone-900 text-xs sm:text-sm truncate">
                    {displayTitle}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    কালার: {selectedColor || 'Default'} | সাইজ: {selectedSize || 'Standard'} | পরিমাণ: {quantity} টি
                  </p>
                  <p className="text-xs font-extrabold font-mono text-[#E11D48] mt-0.5">
                    সর্বমোট বিল: ৳{completedOrder.total.toLocaleString()} (ডেলিভারি চার্জসহ)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-600">
                <div>
                  <strong className="text-stone-900">গ্রাহকের নাম:</strong> {completedOrder.customer.name}
                </div>
                <div>
                  <strong className="text-stone-900">মোবাইল:</strong>{' '}
                  <span className="font-mono">{completedOrder.customer.phone}</span>
                </div>
                <div className="sm:col-span-2">
                  <strong className="text-stone-900">ডেলিভারি ঠিকানা:</strong>{' '}
                  {completedOrder.customer.address} ({completedOrder.customer.district})
                </div>
              </div>
            </div>

            {/* 4-Column Guarantee Badges on Thank You Page */}
            <GuaranteeBadgesRow />

            {/* Action Buttons on Thank You Page */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
              <button
                type="button"
                onClick={() => onOrderSuccess(completedOrder.id)}
                className="w-full py-3 px-4 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Truck className="w-4 h-4" />
                <span>লাইভ অর্ডার ট্র্যাক করুন</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `আসসালামু আলাইকুম Dokandari, আমি মাত্র একটি অর্ডার করেছি।\nঅর্ডার আইডি: ${completedOrder.id}\nপণ্য: ${displayTitle}\nনাম: ${completedOrder.customer.name}\nমোবাইল: ${completedOrder.customer.phone}\nমোট বিল: ৳${completedOrder.total}`
                  );
                  window.open(`https://wa.me/${OFFICIAL_WHATSAPP_INT}?text=${msg}`, '_blank');
                }}
                className="w-full py-3 px-4 bg-[#25D366] hover:bg-[#1DA851] text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <OfficialWhatsAppIcon className="w-4 h-4" />
                <span>WhatsApp এ অর্ডার আপডেট নিন</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              &larr; আরও কেনাকাটা করতে শপে ফিরে যান
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STEP 2: FULL-WIDTH INSTANT CHECKOUT PAGE (ডেস্কটপ ও মোবাইলে ফুল-উইডথ ইনস্ট্যান্ট চেকআউট ও অর্ডার ফর্ম পেইজ)
  // ============================================================================
  if (viewStep === 'checkout') {
    return (
      <div className="bg-[#FAF9F6] min-h-screen py-4 sm:py-8 px-3 sm:px-6 lg:px-8 animate-in fade-in">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setViewStep('product');
                try {
                  window.history.pushState(
                    null,
                    '',
                    `/products/${encodeURIComponent(product.id)}?brand=dokandari`
                  );
                } catch {
                  // ignore
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-stone-700 hover:text-[#E11D48] bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>&larr; প্রোডাক্ট পেইজে ফিরে যান</span>
            </button>

            <span className="text-xs font-extrabold text-[#E11D48] bg-rose-50 px-3.5 py-1.5 rounded-full border border-rose-200">
              ⚡ ফুল ইনস্ট্যান্ট চেকআউট ও ক্যাশ অন ডেলিভারি (Dokandari.com)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (5 cols on Desktop): Selected Product Summary + Quantity + Add to Cart + WhatsApp */}
            <div className="lg:col-span-5 bg-white rounded-2xl border-2 border-rose-200 p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-start gap-3.5">
                <img
                  src={resolveSafeProductImageUrl(
                    product.images[selectedImage] || product.images[0],
                    product,
                    selectedImage
                  )}
                  alt={displayTitle}
                  onError={(e) => handleProductImageError(e, product, selectedImage)}
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl object-cover border border-stone-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="text-[10px] sm:text-xs font-bold text-[#E11D48] bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200 inline-block">
                    {categoryNameBn}
                  </span>
                  <h2 className="text-sm sm:text-lg font-extrabold text-stone-900 leading-snug">
                    {displayTitle}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base sm:text-xl font-extrabold text-[#E11D48] font-mono">
                      ৳{product.price.toLocaleString()}
                    </span>
                    {selectedColor && (
                      <span className="text-[11px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                        কালার: {selectedColor}
                      </span>
                    )}
                    {selectedSize && (
                      <span className="text-[11px] font-bold text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                        সাইজ: {selectedSize}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quantity Selector Row */}
              <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs sm:text-sm">
                <span className="font-bold text-stone-800">পণ্যের পরিমাণ নির্বাচন করুন:</span>
                <div className="flex items-center border-2 border-rose-200 rounded-xl overflow-hidden bg-rose-50/40">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3.5 py-1.5 text-stone-800 font-extrabold hover:bg-rose-100 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-4 py-1.5 text-sm font-mono font-extrabold text-stone-900 tabular-nums bg-white">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3.5 py-1.5 text-stone-800 font-extrabold hover:bg-rose-100 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Live Price + Shipping Breakdown */}
              <div className="p-3.5 rounded-xl bg-[#FFF0F3] border border-rose-200 space-y-1.5 text-xs sm:text-sm">
                <div className="flex justify-between text-stone-700 font-semibold">
                  <span>পণ্যের দাম ({quantity} টি):</span>
                  <span className="font-mono font-bold text-stone-900">
                    ৳{subtotalPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-stone-700 font-semibold">
                  <span>
                    ডেলিভারি চার্জ ({deliveryArea === 'dhaka' ? 'ঢাকার ভেতরে' : 'ঢাকার বাইরে'}):
                  </span>
                  <span className="font-mono font-extrabold text-[#E11D48]">+ ৳{finalShipping}</span>
                </div>
                <div className="flex justify-between text-stone-900 font-extrabold text-sm sm:text-base pt-2 border-t border-rose-200">
                  <span>সর্বমোট বিল:</span>
                  <span className="font-mono text-[#E11D48]">৳{totalPrice.toLocaleString()}</span>
                </div>
              </div>

              {/* Add to Cart & Official WhatsApp Buttons */}
              <div className="pt-2 border-t border-rose-100 space-y-2">
                <span className="text-[11px] font-bold text-stone-600 block">
                  একাধিক প্রোডাক্ট কার্টে যোগ করতে বা সরাসরি WhatsApp-এ অর্ডার করতে ক্লিক করুন:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleAddToCartOnCheckout}
                    className="py-3 px-4 bg-white hover:bg-rose-50 active:scale-95 border-2 border-[#E11D48] text-[#E11D48] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    {addedToCartToast ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700">কার্টে যুক্ত হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4 text-[#E11D48] shrink-0" />
                        <span>অ্যাড টু কার্ট (কার্টে রাখুন)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleWhatsAppOrder}
                    className="py-3 px-4 bg-[#10B981] hover:bg-[#059669] active:scale-95 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <OfficialWhatsAppIcon className="w-4 h-4 shrink-0" />
                    <span>WhatsApp এ অর্ডার</span>
                  </button>
                </div>
              </div>

              <GuaranteeBadgesRow />
            </div>

            {/* Right Column (7 cols on Desktop): Full-Width Instant Checkout Order Form */}
            <div className="lg:col-span-7 bg-white rounded-2xl border-2 border-rose-300 p-4 sm:p-7 shadow-md space-y-4">
              <div className="bg-[#FFF0F3] p-3.5 sm:p-4 rounded-xl border border-rose-200">
                <h3 className="text-sm sm:text-base font-extrabold text-rose-950 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#E11D48] shrink-0" />
                  <span>অর্ডার কনফার্ম করতে নিচের ফর্মটি পূরণ করুন (ক্যাশ অন ডেলিভারি)</span>
                </h3>
                <p className="text-xs text-rose-800 mt-1">
                  ১ টাকাও অগ্রিম দিতে হবে না। পার্সেল হাতে পেয়ে ডেলিভারি ম্যানের সামনে দেখে পেমেন্ট করুন।
                </p>
              </div>

              {orderError && (
                <div className="p-3 bg-rose-100 border border-rose-300 text-xs sm:text-sm font-bold text-rose-900 rounded-xl">
                  ⚠️ {orderError}
                </div>
              )}

              <form onSubmit={handleDirectOrder} className="space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-stone-800 font-extrabold mb-1.5 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-[#E11D48]" />
                      <span>আপনার সম্পূর্ণ নাম *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="যেমন: ফাতেমা আক্তার / মো: রাকিব হোসেন"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] focus:bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-800 font-extrabold mb-1.5 flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-[#E11D48]" />
                      <span>মোবাইল নম্বর (১১ ডিজিট) *</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] focus:bg-white font-mono font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-stone-800 font-extrabold mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#E11D48]" />
                    <span>সম্পূর্ণ ডেলিভারি ঠিকানা *</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="বাসা নম্বর, রোড নম্বর, বাজার/এলাকা, থানা ও জেলা..."
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] focus:bg-white resize-none"
                  />
                </div>

                {/* Delivery Location Selection (Always adds +70 Inside Dhaka or +120 Outside Dhaka) */}
                <div>
                  <label className="block text-stone-800 font-extrabold mb-1.5">
                    ডেলিভারি এরিয়া নির্বাচন করুন (পণ্যের দামের সাথে যুক্ত হবে):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDeliveryArea('dhaka')}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                        deliveryArea === 'dhaka'
                          ? 'border-[#E11D48] bg-[#FFF0F3] text-[#E11D48] font-extrabold shadow-xs'
                          : 'border-stone-200 bg-stone-50 text-stone-700 font-semibold hover:border-rose-200'
                      }`}
                    >
                      <div>
                        <div className="text-xs sm:text-sm font-extrabold">
                          {deliveryArea === 'dhaka' ? '✓ ' : ''}ঢাকার ভেতরে (Inside Dhaka)
                        </div>
                        <div className="text-[11px] text-stone-600 mt-0.5">
                          হোম ডেলিভারি চার্জ: + ৳৭০
                        </div>
                      </div>
                      <span className="text-sm sm:text-base font-mono font-black bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-[#E11D48]">
                        ৳৭০
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeliveryArea('outside_dhaka')}
                      className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                        deliveryArea === 'outside_dhaka'
                          ? 'border-[#E11D48] bg-[#FFF0F3] text-[#E11D48] font-extrabold shadow-xs'
                          : 'border-stone-200 bg-stone-50 text-stone-700 font-semibold hover:border-rose-200'
                      }`}
                    >
                      <div>
                        <div className="text-xs sm:text-sm font-extrabold">
                          {deliveryArea === 'outside_dhaka' ? '✓ ' : ''}ঢাকার বাইরে (Outside Dhaka)
                        </div>
                        <div className="text-[11px] text-stone-600 mt-0.5">
                          সারা বাংলাদেশ কুরিয়ার: + ৳১২০
                        </div>
                      </div>
                      <span className="text-sm sm:text-base font-mono font-black bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-[#E11D48]">
                        ৳১২০
                      </span>
                    </button>
                  </div>
                </div>

                {/* Bill Summary */}
                <div className="p-4 bg-[#FFF0F3]/70 rounded-xl space-y-2 text-xs sm:text-sm border border-rose-200">
                  <div className="flex justify-between text-stone-700 font-semibold">
                    <span>পণ্যের দাম ({quantity} টি):</span>
                    <span className="font-mono font-bold text-stone-900">
                      ৳{subtotalPrice.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-700 font-semibold">
                    <span>
                      ডেলিভারি চার্জ ({deliveryArea === 'dhaka' ? 'ঢাকার ভেতরে ৳৭০' : 'ঢাকার বাইরে ৳১২০'}):
                    </span>
                    <span className="font-mono font-extrabold text-[#E11D48]">
                      + ৳{finalShipping}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-900 font-extrabold text-base sm:text-lg pt-2 border-t border-rose-200">
                    <span>সর্বমোট প্রদেয় বিল (ক্যাশ অন ডেলিভারি):</span>
                    <span className="font-mono text-[#E11D48]">
                      ৳{totalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Animated Confirm Order Submit Button */}
                <button
                  type="submit"
                  disabled={isOrdering}
                  className="w-full py-4 px-5 bg-gradient-to-r from-[#E11D48] via-[#F43F5E] to-[#BE123C] hover:from-[#BE123C] hover:to-[#9F1239] active:scale-[0.99] disabled:bg-stone-400 text-white rounded-xl text-sm sm:text-base font-extrabold shadow-md ring-2 ring-rose-300/70 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-5 h-5 animate-bounce" />
                  <span>
                    {isOrdering
                      ? 'অর্ডার প্রসেস হচ্ছে...'
                      : `অর্ডার কনফার্ম করুন — ৳${totalPrice.toLocaleString()} (ডেলিভারি চার্জসহ)`}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // STEP 1: CLEAN PRODUCT DETAIL PAGE (মোবাইল ফ্রেন্ডলি ছোট ফন্ট, উপরে অর্ডার বাটন ও ৪ কলামের গ্যারান্টি ব্যাজ)
  // ============================================================================
  return (
    <div className="bg-[#FAF9F6] min-h-screen py-4 sm:py-8 animate-in fade-in relative">
      {/* Toast Feedback */}
      {refreshToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#E11D48] text-white font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{refreshToast}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        {/* Top Breadcrumb & Back Navigation with Share and Quick Refresh */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-stone-700 hover:text-[#E11D48] transition-colors cursor-pointer bg-white px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-stone-200 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>&larr; শপে ফিরে যান</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-stone-700 bg-white hover:bg-rose-50 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border border-stone-200 shadow-2xs transition-colors cursor-pointer"
              title="প্রোডাক্ট লিংক কপি করুন"
            >
              {linkCopied ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">কপি হয়েছে!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-stone-600" />
                  <span>লিংক কপি</span>
                </>
              )}
            </button>

            {/* Admin-Only Refresh & Edit Controls — Strictly hidden from customers unless Admin is logged in */}
            {isAdmin && (
              <>
                <button
                  onClick={() => setShowRefreshBar(!showRefreshBar)}
                  className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold bg-white hover:bg-rose-50 text-[#E11D48] border border-rose-200 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-2xs transition-colors cursor-pointer"
                  title="১-ক্লিকে নতুন লিংক দিয়ে প্রোডাক্টের তথ্য রিফ্রেশ করুন"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-[#E11D48] ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                  <span>লিংক রিফ্রেশ</span>
                </button>

                <button
                  onClick={() => onOpenEdit(product)}
                  className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold bg-[#E11D48] hover:bg-[#BE123C] text-white px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl shadow-xs transition-colors cursor-pointer"
                  title="Edit this product"
                >
                  <Edit3 className="w-3.5 h-3.5 text-white" />
                  <span>এডিট</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 1-Click Fast URL Refresh Bar on PDP (Admin Only) */}
        {isAdmin && showRefreshBar && (
          <section className="bg-white border-2 border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#E11D48] text-white">
                  <Globe className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                    ১-ক্লিকে যেকোনো লিংক দিয়ে এই প্রোডাক্টটি রিফ্রেশ করুন (In-Place URL Refresh)
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Alibaba, AliExpress, CJ, Amazon বা Daraz লিংক দিন — স্বয়ংক্রিয়ভাবে আসল ছবি, ১০০% বাংলা টাইটেল ও সঠিক বিডিটি প্রাইস রিফ্রেশ হয়ে লাইভ ডাটাবেজে সেভ হবে।
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleFastUrlRefresh} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={refreshUrl}
                onChange={(e) => setRefreshUrl(e.target.value)}
                placeholder="নতুন প্রোডাক্টের লিংক পেস্ট করুন..."
                className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#E11D48] focus:bg-white rounded-xl text-xs outline-none"
              />
              <button
                type="submit"
                disabled={isRefreshing || !refreshUrl.trim()}
                className="px-5 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-stone-300 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isRefreshing ? 'রিফ্রেশ হচ্ছে...' : 'প্রোডাক্ট সম্পূর্ণ রিফ্রেশ করুন'}</span>
              </button>
            </form>
          </section>
        )}

        {/* Main Product Details Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-start">
          {/* Left Column: Image Gallery & Responsive Non-Blocking YouTube IFrame Embed Player (5 cols) */}
          <div className="lg:col-span-5 space-y-3 sm:space-y-4">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-xs">
              {selectedVideoInHero !== null && product.videos?.[selectedVideoInHero] ? (
                (() => {
                  const heroEmbed = parseEmbedVideoUrl(product.videos[selectedVideoInHero]);
                  return (
                    <div className="w-full h-full bg-stone-950 flex items-center justify-center relative">
                      {heroEmbed.type === 'iframe' ? (
                        <iframe
                          src={heroEmbed.autoplaySrc || heroEmbed.src}
                          title={`${displayTitle} - YouTube Video Player`}
                          loading="lazy"
                          className="w-full h-full aspect-video border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      ) : (
                        <video
                          src={heroEmbed.src}
                          controls
                          autoPlay
                          playsInline
                          className="w-full h-full object-contain bg-black"
                          preload="metadata"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedVideoInHero(null)}
                        className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-full bg-stone-900/85 hover:bg-[#E11D48] text-white text-[10px] font-bold shadow-md cursor-pointer transition-colors"
                      >
                        ✕ ছবিতে ফিরুন
                      </button>
                    </div>
                  );
                })()
              ) : (
                <>
                  <img
                    src={resolveSafeProductImageUrl(
                      product.images[selectedImage] || product.images[0],
                      product,
                      selectedImage
                    )}
                    alt={product.name}
                    onError={(e) => handleProductImageError(e, product, selectedImage)}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                    <span className="bg-[#E11D48] text-white text-[10px] font-bold px-2 py-0.5 rounded-sm shadow-2xs">
                      🔥 বেস্ট সেলিং
                    </span>
                    {discountPercent > 0 && (
                      <span className="bg-rose-100 text-[#E11D48] border border-rose-300 text-[10px] font-bold px-2 py-0.5 rounded-sm">
                        -{discountPercent}% ছাড়
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail Carousel (Images + Video Thumbnails) */}
            {(product.images.length > 1 || (product.videos && product.videos.length > 0)) && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={`img-${idx}`}
                    type="button"
                    onClick={() => {
                      setSelectedVideoInHero(null);
                      setSelectedImage(idx);
                    }}
                    className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                      selectedVideoInHero === null && selectedImage === idx
                        ? 'border-[#E11D48] ring-2 ring-rose-200'
                        : 'border-stone-200 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={resolveSafeProductImageUrl(img, product, idx)}
                      alt="Thumbnail"
                      onError={(e) => handleProductImageError(e, product, idx)}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}

                {product.videos &&
                  product.videos.map((vid, vIdx) => {
                    const thumbInfo = parseEmbedVideoUrl(vid);
                    return (
                      <button
                        key={`vid-thumb-${vIdx}`}
                        type="button"
                        onClick={() => setSelectedVideoInHero(vIdx)}
                        title="ভিডিও প্লে করুন"
                        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 bg-stone-950 ${
                          selectedVideoInHero === vIdx
                            ? 'border-[#FF0000] ring-2 ring-red-200'
                            : 'border-stone-300 opacity-90 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={thumbInfo.thumbnailUrl || product.images[0]}
                          alt="Video Thumbnail"
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover opacity-75"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                          <span className="w-6 h-6 rounded-full bg-[#FF0000] text-white flex items-center justify-center shadow-sm">
                            <Play className="w-3 h-3 fill-white ml-0.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Official YouTube IFrame Embed API Player (Responsive 16:9 + High-Performance Non-Blocking Facade) */}
            {product.videos && product.videos.length > 0 && (
              <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-rose-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#E11D48] flex items-center gap-1.5">
                    <OfficialYouTubeIcon className="w-4 h-4 text-[#FF0000] shrink-0" />
                    <span>অরিজিনাল প্রোডাক্ট ভিডিও ({product.videos.length})</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    YouTube HD প্লেয়ার
                  </span>
                </div>

                {product.videos.map((vid, vIdx) => {
                  const embedInfo = parseEmbedVideoUrl(vid);
                  const isActivated = Boolean(activatedVideos[vIdx]);

                  return (
                    <div
                      key={vIdx}
                      className="relative w-full aspect-video rounded-xl overflow-hidden bg-stone-950 border border-stone-800 shadow-inner"
                    >
                      {embedInfo.type === 'iframe' ? (
                        isActivated ? (
                          <iframe
                            src={embedInfo.autoplaySrc || embedInfo.src}
                            title={`${displayTitle} - প্রোডাক্ট ভিডিও ${vIdx + 1}`}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full border-0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                          />
                        ) : (
                          /* Non-blocking Main-Thread Facade: loads high-res poster asynchronously & mounts official YouTube iframe on interaction */
                          <button
                            type="button"
                            onClick={() =>
                              setActivatedVideos((prev) => ({ ...prev, [vIdx]: true }))
                            }
                            aria-label={`${displayTitle} ভিডিও প্লে করুন`}
                            className="group/yt relative w-full h-full block text-left cursor-pointer overflow-hidden focus:outline-none"
                          >
                            <img
                              src={embedInfo.thumbnailUrl || product.images[0]}
                              alt={`${displayTitle} ভিডিও থাম্বনেইল`}
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover object-center group-hover/yt:scale-105 transition-transform duration-300 opacity-90"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/30 flex flex-col items-center justify-center gap-2 p-3">
                              <div className="w-14 h-10 sm:w-16 sm:h-11 rounded-xl bg-[#FF0000] group-hover/yt:bg-[#CC0000] text-white flex items-center justify-center shadow-lg group-hover/yt:scale-110 transition-all duration-200 ring-4 ring-white/25">
                                <Play className="w-6 h-6 fill-white text-white ml-0.5" />
                              </div>
                              <span className="px-3 py-1 rounded-full bg-stone-950/85 text-white text-[10.5px] sm:text-xs font-extrabold border border-white/20 shadow-sm">
                                ▶ ভিডিওটি প্লে করতে ক্লিক করুন
                              </span>
                            </div>
                          </button>
                        )
                      ) : (
                        <video
                          src={embedInfo.src}
                          controls
                          playsInline
                          className="absolute inset-0 w-full h-full object-contain bg-black"
                          preload="none"
                          poster={product.images[0]}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Compact Mobile Title, Price, High-Up Animated Order Button & 4-Column Guarantee Badges (7 cols) */}
          <div className="lg:col-span-7 space-y-4 sm:space-y-5">
            <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-7 shadow-xs space-y-3.5 sm:space-y-4">
              {/* Compact Top Badges & Clean Mobile Product Title */}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-xs mb-1.5">
                  <span className="text-[#E11D48] font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {categoryNameBn}
                  </span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ স্টকে রয়েছে
                  </span>
                  <span className="text-stone-500 font-semibold">dokandari.com অরিজিনাল</span>
                </div>

                {/* Smaller, cleaner font size on mobile so long titles look neat */}
                <h1 className="text-sm sm:text-2xl font-extrabold text-stone-900 leading-snug">
                  {displayTitle} | <span className="text-[#E11D48]">dokandari.com</span>
                </h1>

                {/* Rating Row */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="flex items-center text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-stone-800">5.0</span>
                  <span className="text-[11px] text-stone-400">
                    ({reviews.length} টি ভেরিফাইড রিভিউ)
                  </span>
                </div>
              </div>

              {/* Compact Price Box */}
              <div className="p-3 sm:p-4 rounded-xl bg-rose-50/60 border border-rose-100 flex items-baseline gap-2.5 flex-wrap">
                <span className="text-lg sm:text-3xl font-extrabold text-[#E11D48] font-mono tabular-nums">
                  ৳{product.price.toLocaleString()}
                </span>
                {product.originalPrice && (
                  <span className="text-xs sm:text-base text-stone-400 line-through font-mono tabular-nums">
                    ৳{product.originalPrice.toLocaleString()}
                  </span>
                )}
                <span className="text-[10px] sm:text-xs font-bold text-[#E11D48] bg-white px-2 py-0.5 rounded border border-rose-200">
                  Save {discountPercent}%
                </span>
              </div>

              {/* Fabric / Material Details */}
              {product.fabric && (
                <div className="text-[11px] sm:text-xs text-stone-700 bg-stone-50 p-2.5 sm:p-3 rounded-xl border border-stone-200">
                  <strong className="text-stone-900">ফ্যাব্রিক / মেটেরিয়াল:</strong> {product.fabric}
                </div>
              )}

              {/* Variants & Quantity Selector */}
              <div className="space-y-3">
                {product.variants.colors && product.variants.colors.length > 0 && (
                  <div>
                    <span className="block text-[11px] sm:text-xs font-bold text-stone-900 mb-1">
                      কালার নির্বাচন করুন:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          className={`px-2.5 py-1 text-[11px] sm:text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            selectedColor === c
                              ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-2xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {product.variants.sizes && product.variants.sizes.length > 0 && (
                  <div>
                    <span className="block text-[11px] sm:text-xs font-bold text-stone-900 mb-1">
                      সাইজ নির্বাচন করুন:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.sizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSize(s)}
                          className={`px-3 py-1 text-[11px] sm:text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                            selectedSize === s
                              ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-2xs'
                              : 'bg-white text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity & Subtotal */}
                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] sm:text-xs font-bold text-stone-900">পরিমাণ:</span>
                    <div className="flex items-center border border-stone-300 rounded-lg overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="px-2.5 py-1 text-stone-700 font-bold hover:bg-stone-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 text-xs font-mono font-bold text-stone-900 tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(quantity + 1)}
                        className="px-2.5 py-1 text-stone-700 font-bold hover:bg-stone-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-stone-700">
                    মোট মূল্য:{' '}
                    <span className="text-sm sm:text-base font-extrabold font-mono text-[#E11D48]">
                      ৳{subtotalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* HIGH-UP ACTION BUTTONS: INSTANT CHECKOUT, ADD TO CART & WHATSAPP */}
              <div className="pt-2 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleAddToCartOnCheckout}
                    className="py-3 px-4 bg-white hover:bg-rose-50 active:scale-95 border-2 border-[#E11D48] text-[#E11D48] rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    {addedToCartToast ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700">কার্টে যুক্ত হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4 text-[#E11D48] shrink-0" />
                        <span>অ্যাড টু কার্ট (কার্টে যোগ করুন)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleWhatsAppOrder}
                    className="py-3 px-4 bg-[#10B981] hover:bg-[#059669] active:scale-95 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <OfficialWhatsAppIcon className="w-4 h-4 shrink-0" />
                    <span>WhatsApp এ অর্ডার করুন</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleGoToInstantCheckout}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-[#E11D48] via-[#F43F5E] to-[#BE123C] hover:from-[#BE123C] hover:to-[#9F1239] active:scale-[0.98] text-white rounded-xl text-sm sm:text-base font-extrabold shadow-md hover:shadow-lg ring-2 ring-rose-300/70 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
                >
                  <ShoppingBag className="w-5 h-5 text-white shrink-0 animate-bounce" />
                  <span>
                    ইনস্ট্যান্ট অর্ডার করুন (৳{totalPrice.toLocaleString()}) — ক্যাশ অন ডেলিভারি
                  </span>
                </button>

                {/* Delivery Fee Quick Note */}
                <div className="flex items-center justify-between text-[10.5px] sm:text-xs text-stone-600 px-1 font-semibold">
                  <div className="flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-[#E11D48]" />
                    <span>ঢাকার ভেতরে: ৳৭০ | ঢাকার বাইরে: ৳১২০</span>
                  </div>
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    ✓ ডেলিভারি ম্যানের সামনে দেখে পেমেন্ট
                  </span>
                </div>
              </div>

              {/* FULL-WIDTH INLINE INSTANT CHECKOUT & ORDER FORM ON PRODUCT PAGE (Desktop & Mobile) */}
              <div className="pt-4 border-t-2 border-rose-100 space-y-4">
                <div className="bg-[#FFF0F3] p-3.5 rounded-xl border border-rose-200">
                  <h3 className="text-xs sm:text-sm font-extrabold text-rose-950 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#E11D48] shrink-0" />
                    <span>ইনস্ট্যান্ট চেকআউট ও ক্যাশ অন ডেলিভারি অর্ডার ফর্ম</span>
                  </h3>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    নিচের ফর্মে আপনার নাম, মোবাইল নম্বর ও ঠিকানা লিখে সরাসরি অর্ডার কনফার্ম করুন।
                  </p>
                </div>

                {orderError && (
                  <div className="p-3 bg-rose-100 border border-rose-300 text-xs font-bold text-rose-900 rounded-xl">
                    ⚠️ {orderError}
                  </div>
                )}

                <form onSubmit={handleDirectOrder} className="space-y-3.5 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-stone-800 font-extrabold mb-1 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-[#E11D48]" />
                        <span>আপনার সম্পূর্ণ নাম *</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="যেমন: ফাতেমা আক্তার / মো: রাকিব হোসেন"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] focus:bg-white font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-stone-800 font-extrabold mb-1 flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-[#E11D48]" />
                        <span>মোবাইল নম্বর (১১ ডিজিট) *</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] focus:bg-white font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-stone-800 font-extrabold mb-1 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#E11D48]" />
                      <span>সম্পূর্ণ ডেলিভারি ঠিকানা *</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="বাসা নম্বর, রোড নম্বর, বাজার/এলাকা, থানা ও জেলা..."
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] focus:bg-white resize-none"
                    />
                  </div>

                  {/* Shipping Charge Selector: Always adds ৳70 or ৳120 to Product Price */}
                  <div>
                    <label className="block text-stone-800 font-extrabold mb-1.5">
                      ডেলিভারি এরিয়া নির্বাচন করুন (পণ্যের দামের সাথে যুক্ত হবে):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setDeliveryArea('dhaka')}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                          deliveryArea === 'dhaka'
                            ? 'border-[#E11D48] bg-[#FFF0F3] text-[#E11D48] font-extrabold shadow-2xs'
                            : 'border-stone-200 bg-stone-50 text-stone-700 font-semibold hover:border-rose-200'
                        }`}
                      >
                        <div>
                          <div className="text-xs sm:text-sm font-extrabold">
                            {deliveryArea === 'dhaka' ? '✓ ' : ''}ঢাকার ভেতরে (Inside Dhaka)
                          </div>
                          <div className="text-[10.5px] text-stone-600">ডেলিভারি চার্জ: + ৳৭০</div>
                        </div>
                        <span className="text-xs sm:text-sm font-mono font-black bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-[#E11D48]">
                          ৳৭০
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeliveryArea('outside_dhaka')}
                        className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                          deliveryArea === 'outside_dhaka'
                            ? 'border-[#E11D48] bg-[#FFF0F3] text-[#E11D48] font-extrabold shadow-2xs'
                            : 'border-stone-200 bg-stone-50 text-stone-700 font-semibold hover:border-rose-200'
                        }`}
                      >
                        <div>
                          <div className="text-xs sm:text-sm font-extrabold">
                            {deliveryArea === 'outside_dhaka' ? '✓ ' : ''}ঢাকার বাইরে (Outside Dhaka)
                          </div>
                          <div className="text-[10.5px] text-stone-600">ডেলিভারি চার্জ: + ৳১২০</div>
                        </div>
                        <span className="text-xs sm:text-sm font-mono font-black bg-white px-2.5 py-1 rounded-lg border border-rose-200 text-[#E11D48]">
                          ৳১২০
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Bill Breakdown */}
                  <div className="p-3.5 bg-[#FFF0F3]/60 rounded-xl space-y-1.5 text-xs border border-rose-200">
                    <div className="flex justify-between text-stone-700 font-semibold">
                      <span>পণ্যের দাম ({quantity} টি):</span>
                      <span className="font-mono font-bold text-stone-900">
                        ৳{subtotalPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-700 font-semibold">
                      <span>
                        ডেলিভারি চার্জ ({deliveryArea === 'dhaka' ? 'ঢাকার ভেতরে ৳৭০' : 'ঢাকার বাইরে ৳১২০'}):
                      </span>
                      <span className="font-mono font-extrabold text-[#E11D48]">
                        + ৳{finalShipping}
                      </span>
                    </div>
                    <div className="flex justify-between text-stone-900 font-extrabold text-sm sm:text-base pt-1.5 border-t border-rose-200">
                      <span>সর্বমোট প্রদেয় বিল:</span>
                      <span className="font-mono text-[#E11D48]">
                        ৳{totalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isOrdering}
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-[#E11D48] via-[#F43F5E] to-[#BE123C] hover:from-[#BE123C] hover:to-[#9F1239] active:scale-[0.99] disabled:bg-stone-400 text-white rounded-xl text-sm sm:text-base font-extrabold shadow-md ring-2 ring-rose-300/70 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ShoppingBag className="w-5 h-5 animate-bounce" />
                    <span>
                      {isOrdering
                        ? 'অর্ডার প্রসেস হচ্ছে...'
                        : `অর্ডার কনফার্ম করুন — ৳${totalPrice.toLocaleString()} (ডেলিভারি চার্জসহ)`}
                    </span>
                  </button>
                </form>
              </div>

              {/* 4-COLUMN GUARANTEE BADGES ON MOBILE & DESKTOP */}
              <div className="pt-2 border-t border-stone-100">
                <GuaranteeBadgesRow />
              </div>
            </div>

            {/* Description & Specification Tabs */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-xs space-y-3">
              <h3 className="text-xs sm:text-sm font-extrabold text-stone-900 border-b border-stone-100 pb-2">
                পণ্যের বিস্তারিত বিবরণ
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">{product.description}</p>

              {product.features && (
                <ul className="space-y-1.5 text-xs text-stone-700">
                  {product.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================================
            SUGGESTED & RELATED PRODUCTS SECTION (সাজেস্টেড প্রোডাক্ট — রিভিউয়ের পরিবর্তে একই ক্যাটাগরির পণ্য)
            ============================================================================ */}
        {(() => {
          const sameCategory = allProducts.filter(
            (p) => p.id !== product.id && p.category === product.category
          );
          const otherPopular = allProducts.filter(
            (p) => p.id !== product.id && p.category !== product.category
          );
          const suggestedList = [...sameCategory, ...otherPopular].slice(0, 8);

          if (suggestedList.length === 0) return null;

          return (
            <section className="pt-4 sm:pt-6 space-y-4">
              <div className="bg-white border border-rose-200/80 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-2xs flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-[#E11D48] text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs">
                    ✨
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-lg font-extrabold text-stone-900">
                        সাজেস্টেড ও সম্পর্কিত প্রোডাক্ট ({categoryNameBn})
                      </h2>
                      <span className="text-[10px] font-bold text-[#E11D48] bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                        {suggestedList.length} টি বাছাইকৃত পণ্য
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      আপনার পছন্দের এই ক্যাটাগরির আরও জনপ্রিয় ও ১০০% অরিজিনাল কালেকশন দেখুন
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onBack}
                  className="px-3.5 py-1.5 rounded-xl bg-[#FFF1F2] hover:bg-[#E11D48] text-[#E11D48] hover:text-white border border-rose-200 text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  সকল প্রোডাক্ট দেখুন &rarr;
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
                {suggestedList.map((sugProd) => (
                  <ProductCard
                    key={sugProd.id}
                    product={sugProd}
                    onOpenDetail={(p) => {
                      if (onSelectProduct) {
                        onSelectProduct(p);
                      }
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onInstantOrder={(p) => {
                      if (onInstantOrderProduct) {
                        onInstantOrderProduct(p);
                      } else if (onSelectProduct) {
                        onSelectProduct(p);
                      }
                    }}
                    onEditProduct={isAdmin ? (p) => onOpenEdit(p) : undefined}
                  />
                ))}
              </div>
            </section>
          );
        })()}
      </div>
    </div>
  );
};
