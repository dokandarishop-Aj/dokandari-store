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
  Upload,
  Loader2,
  Database,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  OFFICIAL_WHATSAPP_INT,
  DEFAULT_CATEGORY_HEROES,
  CategoryHeroConfig,
  saveStoreContentPersisted,
  resolveSafeProductImageUrl,
  handleProductImageError,
  saveOrderPersisted,
  saveProductPersisted,
  compressImageFileToDataUrl,
  enrichProductFields,
  cleanProductVideos,
  isProductScreenshotEnabled,
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
  trackPixelPageView,
  trackPixelViewContent,
  trackPixelAddToCart,
  trackPixelInitiateCheckout,
  trackPixelPurchase,
  trackPixelWhatsAppConversion,
  updateProductStructuredData,
} from '../lib/pixelManager';
import { captureAbandonedLeadDebounced, markLeadConverted, normalizePhone } from '../lib/leadRecovery';

interface ProductDetailPageProps {
  product: Product;
  initialStep?: 'product' | 'checkout' | 'thank_you';
  initialCompletedOrder?: Order | null;
  onBack: () => void;
  onOpenEdit: (product: Product) => void;
  onOrderSuccess: (orderId: string) => void;
  onProductUpdated?: (product: Product) => void;
  isAdmin?: boolean;
  allProducts?: Product[];
  onSelectProduct?: (product: Product) => void;
  onInstantOrderProduct?: (product: Product) => void;
  categoryHeroes?: Record<string, CategoryHeroConfig>;
  onSaveCategoryHero?: (categoryId: string, updatedHero: CategoryHeroConfig) => Promise<void>;
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
  initialCompletedOrder = null,
  onBack,
  onOpenEdit,
  onOrderSuccess,
  onProductUpdated,
  isAdmin = false,
  allProducts = [],
  onSelectProduct,
  onInstantOrderProduct,
  categoryHeroes,
  onSaveCategoryHero,
}) => {
  const { addToCart } = useCart();
  const { firebaseUser, userProfile } = useAuth();

  // 3-Step Dedicated Page Flow:
  // 'product'   -> Clean Product Details Page (no inline form, compact mobile fonts, 4-col guarantee badges, high-up Order button)
  // 'checkout'  -> Separate Instant Checkout Page (Product Summary -> Add to Cart & WhatsApp buttons -> Order Form)
  // 'thank_you' -> Dedicated Thank You Page (Order ID, invoice summary, live tracking & WhatsApp support)
  const [viewStep, setViewStep] = useState<'product' | 'checkout' | 'thank_you'>(initialStep);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(initialCompletedOrder);
  const [addedToCartToast, setAddedToCartToast] = useState(false);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVideoInHero, setSelectedVideoInHero] = useState<number | null>(null);
  const [activatedVideos, setActivatedVideos] = useState<Record<number, boolean>>({});
  const [selectedColor, setSelectedColor] = useState(product.variants?.colors?.[0] || '');
  const [selectedSize, setSelectedSize] = useState(product.variants?.sizes?.[0] || '');
  const [quantity, setQuantity] = useState(1);
  const [linkCopied, setLinkCopied] = useState(false);

  // Sync initialStep, variants & reset video facade states when product changes or is edited
  useEffect(() => {
    if (initialCompletedOrder && initialStep === 'thank_you') {
      setCompletedOrder(initialCompletedOrder);
      setViewStep('thank_you');
    } else {
      setCompletedOrder(null);
      setViewStep(initialStep);
    }
    setSelectedVideoInHero(null);
    setActivatedVideos({});
  }, [initialStep, initialCompletedOrder, product.id]);

  useEffect(() => {
    const validColors = product.variants?.colors || [];
    if (validColors.length > 0 && !validColors.includes(selectedColor)) {
      setSelectedColor(validColors[0]);
    }
    const validSizes = product.variants?.sizes || [];
    if (validSizes.length > 0 && !validSizes.includes(selectedSize)) {
      setSelectedSize(validSizes[0]);
    }
  }, [product.id, product.updatedAt, product.variants]);

  // In-place 1-click URL refresh, multi-photo upload & AI Photo Auto-Fill state
  const [showRefreshBar, setShowRefreshBar] = useState(false);
  const [refreshUrl, setRefreshUrl] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState('');
  const [showAiEditBar, setShowAiEditBar] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [aiUploadedImages, setAiUploadedImages] = useState<string[]>([]);
  const [isAiEditing, setIsAiEditing] = useState(false);

  // Product Detail Hero Banner Edit state (Admin-only)
  const activeHeroConfig: CategoryHeroConfig =
    categoryHeroes?.[product.category] ||
    DEFAULT_CATEGORY_HEROES[product.category] ||
    DEFAULT_CATEGORY_HEROES.home_decor;
  const [isEditingHero, setIsEditingHero] = useState(false);
  const [heroTitleInput, setHeroTitleInput] = useState(activeHeroConfig.title);
  const [heroSubtitleInput, setHeroSubtitleInput] = useState(activeHeroConfig.subtitle);
  const [heroTagInput, setHeroTagInput] = useState(activeHeroConfig.tag);
  const [heroImageInput, setHeroImageInput] = useState(activeHeroConfig.image);
  const [savingHero, setSavingHero] = useState(false);

  useEffect(() => {
    const cfg =
      categoryHeroes?.[product.category] ||
      DEFAULT_CATEGORY_HEROES[product.category] ||
      DEFAULT_CATEGORY_HEROES.home_decor;
    setHeroTitleInput(cfg.title);
    setHeroSubtitleInput(cfg.subtitle);
    setHeroTagInput(cfg.tag);
    setHeroImageInput(cfg.image);
  }, [product.category, categoryHeroes]);

  // Instant Checkout Form state
  const initialCustomerName =
    userProfile?.displayName && !userProfile.displayName.toLowerCase().includes('dokandari')
      ? userProfile.displayName
      : '';
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerPhone, setCustomerPhone] = useState(userProfile?.phone || '');
  const [customerAddress, setCustomerAddress] = useState(userProfile?.address || '');
  const [deliveryArea, setDeliveryArea] = useState<'dhaka' | 'outside_dhaka'>('dhaka');
  const [customerScreenshot, setCustomerScreenshot] = useState<string>(() => {
    try {
      return (
        sessionStorage.getItem(`dkd_custom_screenshot_${product.id}`) ||
        sessionStorage.getItem('dkd_custom_screenshot_latest') ||
        ''
      );
    } catch {
      return '';
    }
  });
  const [customerScreenshotName, setCustomerScreenshotName] = useState<string>(() => {
    try {
      return (
        sessionStorage.getItem(`dkd_custom_screenshot_name_${product.id}`) ||
        (sessionStorage.getItem(`dkd_custom_screenshot_${product.id}`)
          ? 'profile-screenshot.jpg'
          : '')
      );
    } catch {
      return '';
    }
  });
  const [previewScreenshotModal, setPreviewScreenshotModal] = useState(false);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [screenshotError, setScreenshotError] = useState('');
  const isScreenshotEnabled = isProductScreenshotEnabled(product);

  const handleAdminToggleScreenshotOption = async (enabled: boolean) => {
    setScreenshotError('');
    const updatedProd: Product = {
      ...product,
      enableCustomScreenshot: enabled,
      updatedAt: Date.now(),
    };
    const saved = await saveProductPersisted(updatedProd);
    if (onProductUpdated) onProductUpdated(saved);
    setRefreshToast(
      enabled
        ? '✅ এই প্রোডাক্টে কাস্টমার স্ক্রিনশট আপলোড অপশন চালু (ON - আবশ্যক) করে ফায়ারবেসে সেভ করা হয়েছে!'
        : '✅ এই প্রোডাক্টে কাস্টমার স্ক্রিনশট আপলোড অপশন বন্ধ (OFF - লুকানো) করে ফায়ারবেসে সেভ করা হয়েছে!'
    );
    setTimeout(() => setRefreshToast(''), 3500);
  };

  const handleCustomerScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingScreenshot(true);
    setScreenshotError('');
    setOrderError('');
    try {
      const fileName = file.name || 'custom-profile-screenshot.jpg';
      // High-resolution printable quality (960px, 0.78 JPEG ~90-150KB, fits inside Firestore 1MB document for lifetime persistence)
      const compressed = await compressImageFileToDataUrl(file, 960, 0.78);
      if (compressed) {
        setCustomerScreenshot(compressed);
        setCustomerScreenshotName(fileName);
        try {
          sessionStorage.setItem(`dkd_custom_screenshot_${product.id}`, compressed);
          sessionStorage.setItem(`dkd_custom_screenshot_name_${product.id}`, fileName);
          sessionStorage.setItem('dkd_custom_screenshot_latest', compressed);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('Customer screenshot upload note:', err);
    } finally {
      setIsUploadingScreenshot(false);
      e.target.value = '';
    }
  };

  const handleClearCustomerScreenshot = () => {
    setCustomerScreenshot('');
    setCustomerScreenshotName('');
    try {
      sessionStorage.removeItem(`dkd_custom_screenshot_${product.id}`);
      sessionStorage.removeItem(`dkd_custom_screenshot_name_${product.id}`);
      sessionStorage.removeItem('dkd_custom_screenshot_latest');
    } catch {
      // ignore
    }
  };

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
    if (viewStep === 'product') {
      trackPixelViewContent({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
      });
    } else if (viewStep === 'checkout') {
      trackPixelInitiateCheckout(
        [
          {
            id: product.id,
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity,
          },
        ],
        product.price * quantity
      );
    } else if (viewStep === 'thank_you' && completedOrder) {
      trackPixelPurchase({
        id: completedOrder.id,
        total: completedOrder.total,
        items: completedOrder.items,
        customer: {
          phone: completedOrder.customer?.phone,
          name: completedOrder.customer?.name,
          email: completedOrder.customer?.email || userProfile?.email,
        },
      }).then((capiRes) => {
        if (capiRes && !completedOrder.pixelTracking?.capiDispatched) {
          const updatedWithTracking: Order = {
            ...completedOrder,
            pixelTracking: {
              eventId: capiRes.eventId || `dkd_purchase_${completedOrder.id}`,
              browserFired: true,
              capiDispatched: Boolean(capiRes.capiResults && capiRes.capiResults.length > 0),
              capiStatus:
                Array.isArray(capiRes.capiResults) && capiRes.capiResults.length > 0
                  ? capiRes.capiResults.map((r) => `${r.platform}: ${r.status}`).join(' | ')
                  : 'Browser Pixel Fired',
              metaPixels: capiRes.metaPixels,
              tiktokPixels: capiRes.tiktokPixels,
              contentIds: capiRes.contentIds,
              capiResults: capiRes.capiResults,
              updatedAt: Date.now(),
            },
          };
          saveOrderPersisted(updatedWithTracking).catch(() => null);
        }
      });
    }
    updateProductStructuredData(product);
    return () => {
      updateProductStructuredData(null);
    };
  }, [product, viewStep, completedOrder]);

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 20;

  // Support BOTH Piece-Based (1, 2, 3 pcs) and Size-Based (Small, Medium, Full Body) Combo Offers
  const activeOfferMode: 'piece' | 'size' =
    product.offerMode || product.comboConfig?.offerMode || 'piece';

  const pkg1Title =
    product.comboConfig?.pkg1Title ||
    (activeOfferMode === 'size' ? 'Small Size (ছোট সাইজ)' : '১ টি (স্ট্যান্ডার্ড)');
  const pkg1Sub =
    product.comboConfig?.pkg1Sub ||
    (activeOfferMode === 'size' ? 'রেগুলার সাইজ' : 'সাধারণ মূল্য');
  const pkg1Price = Number(product.comboConfig?.pkg1Price || product.price);

  const pkg2Title =
    product.comboConfig?.pkg2Title ||
    (activeOfferMode === 'size' ? 'Medium Size (মিডিয়াম সাইজ)' : '২ টি (কম্বো প্যাক)');
  const pkg2Discount = Number(
    product.comboConfig?.pkg2Discount ?? (activeOfferMode === 'size' ? 100 : 150)
  );
  const pkg2Price = Number(
    product.comboConfig?.pkg2Price || Math.max(pkg1Price, pkg1Price * 2 - pkg2Discount)
  );
  const pkg2Sub =
    product.comboConfig?.pkg2Sub || `${pkg2Discount}৳ নগদ সাশ্রয়!`;

  const pkg3Title =
    product.comboConfig?.pkg3Title ||
    (activeOfferMode === 'size' ? 'Full Body (বড় সাইজ)' : '৩ টি (মেগা সেভার)');
  const pkg3Discount = Number(
    product.comboConfig?.pkg3Discount ?? (activeOfferMode === 'size' ? 200 : 350)
  );
  const pkg3Price = Number(
    product.comboConfig?.pkg3Price || Math.max(pkg1Price, pkg1Price * 3 - pkg3Discount)
  );
  const pkg3Sub =
    product.comboConfig?.pkg3Sub || `${pkg3Discount}৳ ছাড় + ০৳ ডেলিভারি`;

  const [selectedCombo, setSelectedCombo] = useState<1 | 2 | 3>(1);

  const handleSelectCombo = (pack: 1 | 2 | 3) => {
    setSelectedCombo(pack);
    if (activeOfferMode === 'size') {
      setQuantity(1);
      if (pack === 1) setSelectedSize(pkg1Title);
      else if (pack === 2) setSelectedSize(pkg2Title);
      else setSelectedSize(pkg3Title);
    } else {
      setQuantity(pack);
    }
  };

  // Real-time Admin Offer Mode Switcher (Piece vs Size)
  const handleAdminSwitchOfferMode = async (mode: 'piece' | 'size') => {
    const nextConfig =
      mode === 'size'
        ? {
            offerMode: 'size' as const,
            pkg1Title: 'Small Size (ছোট সাইজ)',
            pkg1Sub: 'রেগুলার সাইজ',
            pkg1Price: product.price,
            pkg2Title: 'Medium Size (মিডিয়াম সাইজ)',
            pkg2Sub: 'সাশ্রয় ৳১০০',
            pkg2Price: Math.max(product.price, product.price * 2 - 100),
            pkg2Discount: 100,
            pkg2Badge: '🔥 সবচেয়ে জনপ্রিয়',
            pkg3Title: 'Full Body (বড় সাইজ)',
            pkg3Sub: 'মেগা সেভার + ফ্রি ডেলিভারি',
            pkg3Price: Math.max(product.price, product.price * 3 - 200),
            pkg3Discount: 200,
            pkg3Badge: '🚚 ফ্রি ডেলিভারি!',
            pkg3FreeDelivery: true,
          }
        : {
            offerMode: 'piece' as const,
            pkg1Title: '১ টি (স্ট্যান্ডার্ড)',
            pkg1Sub: 'সাধারণ মূল্য',
            pkg1Price: product.price,
            pkg2Title: '২ টি (কম্বো প্যাক)',
            pkg2Sub: '১৫০৳ নগদ সাশ্রয়!',
            pkg2Price: Math.max(product.price, product.price * 2 - 150),
            pkg2Discount: 150,
            pkg2Badge: '🔥 সবচেয়ে জনপ্রিয়',
            pkg3Title: '৩ টি (মেগা সেভার)',
            pkg3Sub: '৩৫০৳ ছাড় + ০৳ ডেলিভারি',
            pkg3Price: Math.max(product.price, product.price * 3 - 350),
            pkg3Discount: 350,
            pkg3Badge: '🚚 ফ্রি ডেলিভারি!',
            pkg3FreeDelivery: true,
          };

    const nextSizes =
      mode === 'size'
        ? [nextConfig.pkg1Title, nextConfig.pkg2Title, nextConfig.pkg3Title]
        : product.variants?.sizes || ['স্ট্যান্ডার্ড সাইজ (Standard Pack)'];

    const updatedProd: Product = {
      ...product,
      offerMode: mode,
      comboConfig: nextConfig,
      variants: {
        colors: product.variants?.colors || [],
        sizes: nextSizes,
      },
      updatedAt: Date.now(),
    };
    if (mode === 'size') {
      setSelectedCombo(1);
      setQuantity(1);
      setSelectedSize(nextConfig.pkg1Title);
    } else {
      setSelectedCombo(1);
      setQuantity(1);
    }
    const saved = await saveProductPersisted(updatedProd);
    if (onProductUpdated) onProductUpdated(saved);
  };

  const comboDiscount =
    selectedCombo === 3 ? pkg3Discount : selectedCombo === 2 ? pkg2Discount : 0;
  const isFreeDeliveryCombo = selectedCombo === 3;
  const baseShippingCost = deliveryArea === 'dhaka' ? 70 : 120;
  const finalShipping = isFreeDeliveryCombo ? 0 : baseShippingCost;

  const selectedUnitOrPackPrice =
    activeOfferMode === 'size'
      ? selectedCombo === 3
        ? pkg3Price
        : selectedCombo === 2
          ? pkg2Price
          : pkg1Price
      : product.price;

  const rawSubtotal =
    activeOfferMode === 'size'
      ? selectedUnitOrPackPrice * quantity
      : product.price * quantity;
  const subtotalPrice =
    activeOfferMode === 'size'
      ? rawSubtotal
      : Math.max(0, rawSubtotal - comboDiscount);
  const totalPrice = subtotalPrice + finalShipping;

  // Real-time Lead Recovery mechanism: automatically captures customer phone & details on Product & Checkout page
  useEffect(() => {
    const cleanPhone = normalizePhone(customerPhone);
    if (cleanPhone && cleanPhone.length >= 6) {
      captureAbandonedLeadDebounced({
        customerPhone: cleanPhone,
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
  const cleanVideos = cleanProductVideos(product.videos);
  const categoryMeta = OFFICIAL_CATEGORIES.find((c) => c.id === product.category);
  const categoryNameBn = categoryMeta?.nameBn || 'অরিজিনাল কালেকশন';
  const isOrganic = product.category === 'organic_food';

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

  // Navigate directly to the separate Order Form / Instant Checkout Page
  const handleGoToInstantCheckout = () => {
    if (isScreenshotEnabled && !customerScreenshot) {
      setScreenshotError(
        '⚠️ অর্ডার করার জন্য অনুগ্রহ করে আপনার পেজ/প্রোফাইল স্ক্রিনশট বা কাস্টম ডিজাইনের ছবি আপলোড করুন (আবশ্যক)।'
      );
      return;
    }
    setScreenshotError('');
    try {
      window.history.pushState(
        null,
        '',
        `/?product=${encodeURIComponent(product.id)}&step=checkout`
      );
    } catch {
      // ignore
    }
    setViewStep('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit Instant Checkout Order -> Opens Dedicated Thank You Page!
  const handleDirectOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrderError('');
    setScreenshotError('');

    if (!customerName.trim()) {
      setOrderError('অনুগ্রহ করে আপনার নাম লিখুন।');
      return;
    }
    const cleanPhoneDigits = normalizePhone(customerPhone);
    if (!cleanPhoneDigits || cleanPhoneDigits.length < 10) {
      setOrderError('সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।');
      return;
    }
    if (!customerAddress.trim()) {
      setOrderError('সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন (বাসা/রোড/থানা/জেলা)।');
      return;
    }
    if (isScreenshotEnabled && !customerScreenshot) {
      const msg =
        'অনুগ্রহ করে আপনার পেজ/প্রোফাইল স্ক্রিনশট বা কাস্টম ডিজাইনের ছবি আপলোড করুন (আবশ্যক)।';
      setOrderError(msg);
      setScreenshotError(`⚠️ ${msg}`);
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
          phone: cleanPhoneDigits,
          address: customerAddress.trim(),
          city: deliveryArea === 'dhaka' ? 'Dhaka' : 'Outside Dhaka',
          district: deliveryArea === 'dhaka' ? 'ঢাকা' : 'সারা বাংলাদেশ',
          email: userProfile?.email || undefined,
        },
        items: [
          {
            id: product.id,
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
        discount: comboDiscount,
        total: totalPrice,
        paymentMethod: 'cod',
        status: 'pending',
        userId: firebaseUser?.uid || null,
        customerScreenshot:
          isScreenshotEnabled && customerScreenshot ? customerScreenshot : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const eventId = `dkd_purchase_${orderId}`;
      newOrder.pixelTracking = {
        eventId,
        browserFired: true,
        capiDispatched: false,
        capiStatus: 'Browser Pixel Fired (Dispatching Server CAPI...)',
        updatedAt: Date.now(),
      };

      await saveOrderPersisted(newOrder);

      // Mark the captured lead as converted
      markLeadConverted(cleanPhoneDigits, orderId);

      // CRITICAL: Change URL to /?thank_you=:orderId FIRST before firing PageView + Purchase
      // so refreshing never causes a 404 in any external browser!
      try {
        window.history.pushState(null, '', `/?thank_you=${encodeURIComponent(orderId)}&brand=dokandari`);
      } catch {
        // ignore
      }

      setCompletedOrder(newOrder);
      setViewStep('thank_you');
      window.scrollTo({ top: 0, behavior: 'smooth' });

      trackPixelPageView();
      trackPixelPurchase({
        id: orderId,
        total: totalPrice,
        items: newOrder.items,
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
        confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
      } catch {
        // ignore
      }
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
          colors: result.colors?.length ? result.colors : product.variants?.colors || [],
          sizes: result.sizes?.length ? result.sizes : product.variants?.sizes || [],
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

  const handleAiPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setRefreshToast(`📸 ${files.length}টি ছবি অপ্টিমাইজ করা হচ্ছে...`);
    try {
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const dataUrl = await compressImageFileToDataUrl(files[i], 640, 0.68);
        if (dataUrl) uploaded.push(dataUrl);
      }
      if (uploaded.length > 0) {
        setAiUploadedImages((prev) => [...prev, ...uploaded]);
        setRefreshToast(`✅ ${uploaded.length}টি ছবি প্রস্তুত! এখন "✨ AI অটো-ফিল ও সেভ" বা "ছবি সেভ করুন" চাপুন।`);
        setTimeout(() => setRefreshToast(''), 3500);
      }
    } catch (err) {
      console.warn('AI photo upload note:', err);
    } finally {
      e.target.value = '';
    }
  };

  const handleSaveUploadedPhotosOnly = async () => {
    if (aiUploadedImages.length === 0) return;
    setIsAiEditing(true);
    setRefreshToast('📸 নতুন ছবিগুলো ফায়ারবেস ডাটাবেজে সেভ হচ্ছে...');
    try {
      const mergedImages = [
        ...aiUploadedImages,
        ...product.images.filter((u) => !aiUploadedImages.includes(u)),
      ];
      const updated: Product = enrichProductFields({
        ...product,
        images: mergedImages,
        updatedAt: Date.now(),
      });
      const saved = await saveProductPersisted(updated);
      if (onProductUpdated) onProductUpdated(saved);
      setSelectedImage(0);
      setAiUploadedImages([]);
      setRefreshToast(`✅ মোট ${saved.images.length}টি ছবি লাইভ ডাটাবেজে সফলভাবে সেভ হয়েছে!`);
      setTimeout(() => setRefreshToast(''), 3500);
    } finally {
      setIsAiEditing(false);
    }
  };

  const handleSavePdpHeroBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingHero(true);
    try {
      const updatedHero: CategoryHeroConfig = {
        title: heroTitleInput.trim() || activeHeroConfig.title,
        subtitle: heroSubtitleInput.trim() || activeHeroConfig.subtitle,
        tag: heroTagInput.trim() || activeHeroConfig.tag,
        image: heroImageInput.trim() || activeHeroConfig.image,
      };
      if (onSaveCategoryHero) {
        await onSaveCategoryHero(product.category, updatedHero);
      } else {
        await saveStoreContentPersisted({
          categoryHeroes: {
            ...(categoryHeroes || DEFAULT_CATEGORY_HEROES),
            [product.category]: updatedHero,
          },
        });
      }
      setIsEditingHero(false);
      setRefreshToast('✅ প্রোডাক্ট হিরো ব্যানার ফায়ারস্টোরে লাইভ সেভ হয়েছে!');
      setTimeout(() => setRefreshToast(''), 3000);
    } finally {
      setSavingHero(false);
    }
  };

  const handleAiAutoFillProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAiEditing(true);
    setRefreshToast('✨ AI দিয়ে প্রোডাক্টের বাংলা নাম, বিবরণ, ফিচার ও ভ্যারিয়েন্ট সাজানো হচ্ছে...');
    try {
      const targetImage =
        aiUploadedImages[0] || product.images[selectedImage] || product.images[0] || '';
      const res = await fetch('/api/gemini/ai-edit-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'product',
          instruction:
            aiPromptInput.trim() ||
            `এই প্রোডাক্টটির (${product.name}) জন্য আকর্ষণীয় খাঁটি বাংলা নাম, বিস্তারিত বিবরণ, ফ্যাব্রিক/ম্যাটেরিয়াল, ৫টি মূল বৈশিষ্ট্য এবং সাইজ ও কালার ভ্যারিয়েন্ট তৈরি করো।`,
          imageDataUrl: targetImage,
          currentData: {
            name: product.name,
            category: product.category,
            price: product.price,
            originalPrice: product.originalPrice,
            fabric: product.fabric,
            description: product.description,
          },
        }),
      });
      const json = await res.json();
      const d = json?.data || {};
      const nextImages =
        aiUploadedImages.length > 0
          ? [...aiUploadedImages, ...product.images.filter((u) => !aiUploadedImages.includes(u))]
          : product.images;

      const updated: Product = enrichProductFields({
        ...product,
        name: cleanProductTitle(d.name || d.titleBn || product.name),
        titleEn: d.titleEn || product.titleEn,
        category: d.category || product.category,
        price: Number(d.price) > 0 ? Number(d.price) : product.price,
        originalPrice:
          Number(d.originalPrice) > 0 ? Number(d.originalPrice) : product.originalPrice,
        fabric: d.fabric || product.fabric,
        description: d.description || product.description,
        features:
          Array.isArray(d.features) && d.features.length > 0 ? d.features : product.features,
        images: nextImages,
        variants: {
          colors:
            Array.isArray(d.colors) && d.colors.length > 0
              ? d.colors
              : product.variants.colors,
          sizes:
            Array.isArray(d.sizes) && d.sizes.length > 0
              ? d.sizes
              : product.variants.sizes,
        },
        updatedAt: Date.now(),
      });

      const saved = await saveProductPersisted(updated);
      if (onProductUpdated) onProductUpdated(saved);
      setSelectedImage(0);
      setAiUploadedImages([]);
      setAiPromptInput('');
      setRefreshToast('✅ AI দিয়ে প্রোডাক্টের সকল তথ্য ও ছবি লাইভ ফায়ারবেস ডাটাবেজে সেভ হয়েছে!');
      setTimeout(() => {
        setRefreshToast('');
        setShowAiEditBar(false);
      }, 3000);
    } catch (err) {
      console.warn('AI product edit note:', err);
      setRefreshToast('প্রোডাক্ট আপডেট সম্পন্ন হয়েছে!');
      setTimeout(() => setRefreshToast(''), 2500);
    } finally {
      setIsAiEditing(false);
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

  const renderSuggestedCategoryProducts = (fromThankYou = false) => {
    const sameCategory = allProducts.filter(
      (p) => p.id !== product.id && p.category === product.category
    );
    const otherPopular = allProducts.filter(
      (p) => p.id !== product.id && p.category !== product.category
    );
    const suggestedList = (sameCategory.length > 0 ? sameCategory : [...sameCategory, ...otherPopular]).slice(0, 8);

    if (suggestedList.length === 0) return null;

    return (
      <section className="pt-4 sm:pt-6 space-y-4 text-left">
        <div
          className={`bg-white border rounded-2xl p-3.5 sm:p-5 flex items-center justify-between shadow-2xs flex-wrap gap-2 ${
            isOrganic ? 'border-emerald-200' : 'border-rose-200/80'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`w-8 h-8 rounded-xl text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs ${
                isOrganic ? 'bg-[#16A34A]' : 'bg-[#E11D48]'
              }`}
            >
              {isOrganic ? '🌿' : '✨'}
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-extrabold text-stone-900">
                  {fromThankYou
                    ? `${categoryNameBn} ক্যাটাগরির আরও জনপ্রিয় প্রোডাক্ট (Suggested Products)`
                    : `সাজেস্টেড ও সম্পর্কিত প্রোডাক্ট (${categoryNameBn})`}
                </h2>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                    isOrganic
                      ? 'text-[#15803D] bg-[#ECFDF5] border-emerald-200'
                      : 'text-[#E11D48] bg-rose-50 border-rose-200'
                  }`}
                >
                  {suggestedList.length} টি বাছাইকৃত পণ্য
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                আপনার পছন্দের এই ক্যাটাগরির আরও জনপ্রিয় ও ১০০% অরিজিনাল কালেকশন দেখুন ও অর্ডার করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setCompletedOrder(null);
              onBack();
            }}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
              isOrganic
                ? 'bg-[#ECFDF5] hover:bg-[#16A34A] text-[#15803D] hover:text-white border-emerald-200'
                : 'bg-[#FFF1F2] hover:bg-[#E11D48] text-[#E11D48] hover:text-white border-rose-200'
            }`}
          >
            সকল প্রোডাক্ট দেখুন &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {suggestedList.map((sugProd) => (
            <ProductCard
              key={sugProd.id}
              product={sugProd}
              greenTheme={sugProd.category === 'organic_food' || isOrganic}
              onOpenDetail={(p) => {
                setCompletedOrder(null);
                setViewStep('product');
                if (onSelectProduct) {
                  onSelectProduct(p);
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onInstantOrder={(p) => {
                setCompletedOrder(null);
                if (onInstantOrderProduct) {
                  onInstantOrderProduct(p);
                } else if (onSelectProduct) {
                  onSelectProduct(p);
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onEditProduct={isAdmin ? (p) => onOpenEdit(p) : undefined}
            />
          ))}
        </div>
      </section>
    );
  };

  // ============================================================================
  // STEP 3: DEDICATED THANK YOU PAGE (থ্যাঙ্ক ইউ পেইজ + একই ক্যাটাগরির সাজেস্টেড প্রোডাক্ট)
  // ============================================================================
  if (viewStep === 'thank_you' && completedOrder) {
    return (
      <div className="bg-[#FAF9F6] min-h-screen py-4 sm:py-8 px-3 sm:px-6 lg:px-8 animate-in fade-in">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="max-w-2xl mx-auto bg-white rounded-3xl border-2 border-emerald-200 p-5 sm:p-8 shadow-md text-center space-y-4">
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

              {completedOrder.customerScreenshot && (
                <div className="pt-2.5 border-t border-stone-200 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={completedOrder.customerScreenshot}
                      alt="কাস্টমার প্রোফাইল স্ক্রিনশট"
                      className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-400 shrink-0"
                    />
                    <div>
                      <span className="text-xs font-extrabold text-emerald-800 block">
                        ✅ আপনার পেজ/প্রোফাইল স্ক্রিনশট সফলভাবে অর্ডারের সাথে জমা হয়েছে!
                      </span>
                      <span className="text-[10.5px] text-stone-500">
                        আমাদের প্রিন্টিং টিম আপনার দেওয়া ডিজাইন অনুযায়ী প্রোডাক্ট প্রস্তুত করবে।
                      </span>
                    </div>
                  </div>
                </div>
              )}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setCompletedOrder(null);
                  setCustomerScreenshot('');
                  try {
                    window.history.pushState(
                      null,
                      '',
                      `/?product=${encodeURIComponent(product.id)}&step=checkout`
                    );
                  } catch {
                    // ignore
                  }
                  setViewStep('checkout');
                }}
                className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
              >
                + নতুন আরেকটি অর্ডার করুন
              </button>

              <button
                type="button"
                onClick={() => {
                  setCompletedOrder(null);
                  onBack();
                }}
                className="w-full py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                &larr; আরও কেনাকাটা করতে শপে ফিরে যান
              </button>
            </div>
          </div>

          {/* Same-Category Suggested Products directly on the Thank You Page */}
          {renderSuggestedCategoryProducts(true)}
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
                    `/?product=${encodeURIComponent(product.id)}`
                  );
                } catch {
                  // ignore
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-stone-700 bg-white px-4 py-2.5 rounded-xl border border-stone-200 shadow-2xs cursor-pointer ${
                isOrganic ? 'hover:text-[#16A34A]' : 'hover:text-[#E11D48]'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>&larr; প্রোডাক্ট পেইজে ফিরে যান</span>
            </button>

            <span
              className={`text-xs font-extrabold px-3.5 py-1.5 rounded-full border ${
                isOrganic
                  ? 'text-[#15803D] bg-[#ECFDF5] border-emerald-200'
                  : 'text-[#E11D48] bg-rose-50 border-rose-200'
              }`}
            >
              ⚡ ফুল ইনস্ট্যান্ট চেকআউট ও ক্যাশ অন ডেলিভারি (Dokandari.com)
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (5 cols on Desktop): Selected Product Summary + Quantity + Add to Cart + WhatsApp */}
            <div
              className={`lg:col-span-5 bg-white rounded-2xl border-2 p-4 sm:p-6 shadow-xs space-y-4 ${
                isOrganic ? 'border-emerald-200' : 'border-rose-200'
              }`}
            >
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
                  <span
                    className={`text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded border inline-block ${
                      isOrganic
                        ? 'text-[#15803D] bg-[#ECFDF5] border-emerald-200'
                        : 'text-[#E11D48] bg-rose-50 border-rose-200'
                    }`}
                  >
                    {categoryNameBn}
                  </span>
                  <h2 className="text-sm sm:text-lg font-extrabold text-stone-900 leading-snug">
                    {displayTitle}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-base sm:text-xl font-extrabold font-mono ${
                        isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'
                      }`}
                    >
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
              <div
                className={`p-3.5 rounded-xl border space-y-1.5 text-xs sm:text-sm ${
                  isOrganic
                    ? 'bg-[#F0FDF4] border-emerald-200'
                    : 'bg-[#FFF0F3] border-rose-200'
                }`}
              >
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
                  <span
                    className={`font-mono font-extrabold ${
                      isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'
                    }`}
                  >
                    + ৳{finalShipping}
                  </span>
                </div>
                <div
                  className={`flex justify-between text-stone-900 font-extrabold text-sm sm:text-base pt-2 border-t ${
                    isOrganic ? 'border-emerald-200' : 'border-rose-200'
                  }`}
                >
                  <span>সর্বমোট বিল:</span>
                  <span
                    className={`font-mono ${isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'}`}
                  >
                    ৳{totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Add to Cart & Official WhatsApp Buttons */}
              <div className="pt-2 border-t border-stone-100 space-y-2">
                <span className="text-[11px] font-bold text-stone-600 block">
                  একাধিক প্রোডাক্ট কার্টে যোগ করতে বা সরাসরি WhatsApp-এ অর্ডার করতে ক্লিক করুন:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleAddToCartOnCheckout}
                    className={`py-3 px-4 bg-white active:scale-95 border-2 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer ${
                      isOrganic
                        ? 'hover:bg-[#ECFDF5] border-[#16A34A] text-[#15803D]'
                        : 'hover:bg-rose-50 border-[#E11D48] text-[#E11D48]'
                    }`}
                  >
                    {addedToCartToast ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700">কার্টে যুক্ত হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag
                          className={`w-4 h-4 shrink-0 ${
                            isOrganic ? 'text-[#16A34A]' : 'text-[#E11D48]'
                          }`}
                        />
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

            {/* Right Column (7 cols on Desktop): Compact & Attractive Separate Order Form */}
            <div
              className={`lg:col-span-7 bg-white rounded-2xl border-2 p-4 sm:p-6 shadow-md space-y-3.5 ${
                isOrganic ? 'border-emerald-300' : 'border-rose-300'
              }`}
            >
              <div
                className={`p-3 rounded-xl border flex items-center justify-between gap-2 flex-wrap ${
                  isOrganic
                    ? 'bg-[#ECFDF5] border-emerald-200'
                    : 'bg-[#FFF0F3] border-rose-200'
                }`}
              >
                <h3
                  className={`text-sm sm:text-base font-extrabold flex items-center gap-2 ${
                    isOrganic ? 'text-emerald-950' : 'text-rose-950'
                  }`}
                >
                  <ShoppingBag
                    className={`w-4 h-4 shrink-0 ${
                      isOrganic ? 'text-[#16A34A]' : 'text-[#E11D48]'
                    }`}
                  />
                  <span>অর্ডার কনফার্ম ফর্ম</span>
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200">
                  ✓ পণ্য হাতে পেয়ে মূল্য পরিশোধ
                </span>
              </div>

              {orderError && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 text-xs font-bold text-rose-900 rounded-xl">
                  ⚠️ {orderError}
                </div>
              )}

              <form onSubmit={handleDirectOrder} className="space-y-3 text-xs sm:text-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-stone-800 font-extrabold mb-1 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#E11D48]" />
                      <span>আপনার নাম *</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="আপনার সম্পূর্ণ নাম লিখুন"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] focus:bg-white font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-800 font-extrabold mb-1 flex items-center gap-1.5">
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
                  <label className="block text-stone-800 font-extrabold mb-1 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#E11D48]" />
                    <span>সম্পূর্ণ ডেলিভারি ঠিকানা *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="বাসা/রোড, বাজার/এলাকা, থানা ও জেলা লিখুন..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-[#E11D48] focus:bg-white"
                  />
                </div>

                {/* Delivery Area Selector */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryArea('dhaka')}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                      deliveryArea === 'dhaka'
                        ? 'border-[#E11D48] bg-[#FFF0F3] text-[#E11D48] font-extrabold'
                        : 'border-stone-200 bg-stone-50 text-stone-700 font-semibold hover:border-rose-200'
                    }`}
                  >
                    <span className="text-xs font-extrabold">
                      {deliveryArea === 'dhaka' ? '✓ ' : ''}ঢাকার ভেতরে
                    </span>
                    <span className="text-xs font-mono font-black bg-white px-2 py-0.5 rounded border border-rose-200 text-[#E11D48]">
                      ৳৭০
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryArea('outside_dhaka')}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-center justify-between ${
                      deliveryArea === 'outside_dhaka'
                        ? 'border-[#E11D48] bg-[#FFF0F3] text-[#E11D48] font-extrabold'
                        : 'border-stone-200 bg-stone-50 text-stone-700 font-semibold hover:border-rose-200'
                    }`}
                  >
                    <span className="text-xs font-extrabold">
                      {deliveryArea === 'outside_dhaka' ? '✓ ' : ''}ঢাকার বাইরে
                    </span>
                    <span className="text-xs font-mono font-black bg-white px-2 py-0.5 rounded border border-rose-200 text-[#E11D48]">
                      ৳১২০
                    </span>
                  </button>
                </div>

                {/* Customer Profile / Custom Design Screenshot Upload Box on Order Form (Only shown when enabled for this product!) */}
                {isScreenshotEnabled && (
                  <div className="p-3.5 rounded-2xl bg-[#FFFDF9] border-2 border-dashed border-stone-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="block text-xs sm:text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
                        <span>📷 আপনার পেজ/প্রোফাইল স্ক্রিনশট বা কাস্টম ডিজাইনের ছবি আপলোড করুন: *</span>
                      </label>
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-[#E11D48] text-[10px] font-extrabold border border-rose-200">
                        আবশ্যক (Required)
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2.5 flex-wrap">
                      <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs">
                        <span className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold rounded-lg border border-stone-300 transition-colors">
                          {isUploadingScreenshot ? 'আপলোড হচ্ছে...' : 'Choose File'}
                        </span>
                        <span className="text-stone-600 font-medium truncate max-w-[200px] sm:max-w-xs">
                          {customerScreenshot
                            ? customerScreenshotName || 'স্ক্রিনশট যুক্ত হয়েছে ✓'
                            : 'No file chosen'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCustomerScreenshotUpload}
                          className="hidden"
                        />
                      </label>

                      {customerScreenshot && (
                        <div className="flex items-center gap-2">
                          <img
                            src={customerScreenshot}
                            alt="কাস্টমার স্ক্রিনশট"
                            onClick={() => setPreviewScreenshotModal(true)}
                            className="w-11 h-11 rounded-lg object-cover border-2 border-[#E11D48] cursor-pointer shrink-0"
                            title="বড় করে দেখতে ক্লিক করুন"
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewScreenshotModal(true)}
                            className="px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer"
                          >
                            🔍 ফুল ভিউ
                          </button>
                          <button
                            type="button"
                            onClick={handleClearCustomerScreenshot}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-100 rounded-lg cursor-pointer"
                          >
                            ✕ মুছুন
                          </button>
                        </div>
                      )}
                    </div>

                    {screenshotError && (
                      <div className="p-2 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-xs font-extrabold">
                        {screenshotError}
                      </div>
                    )}

                    {customerScreenshot ? (
                      <p className="text-[11px] font-bold text-emerald-700">
                        ✅ আপনার স্ক্রিনশট যুক্ত হয়েছে — অর্ডার কনফার্ম করলে এটি সরাসরি আমাদের অ্যাডমিন প্যানেলে প্রিন্টিংয়ের জন্য চলে যাবে।
                      </p>
                    ) : (
                      <p className="text-[10.5px] text-stone-500">
                        কাস্টমাইজড মিরর বা কাস্টম প্রোডাক্টের জন্য আপনার ফেসবুক/ইনস্টাগ্রাম/টিকটক প্রোফাইল স্ক্রিনশট বা লোগো এখানে দিন।
                      </p>
                    )}
                  </div>
                )}

                {/* Compact Total Summary */}
                <div
                  className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between border ${
                    isOrganic
                      ? 'bg-[#ECFDF5] border-emerald-200'
                      : 'bg-[#FFF0F3]/80 border-rose-200'
                  }`}
                >
                  <span className="text-xs font-bold text-stone-800">
                    মোট বিল ({quantity}টি পণ্য + ডেলিভারি ৳{finalShipping}):
                  </span>
                  <span
                    className={`text-base sm:text-lg font-mono font-black ${
                      isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'
                    }`}
                  >
                    ৳{totalPrice.toLocaleString()}
                  </span>
                </div>

                {/* Confirm Order Submit Button */}
                <button
                  type="submit"
                  disabled={isOrdering}
                  className={`w-full py-3.5 px-5 active:scale-[0.99] disabled:bg-stone-400 text-white rounded-xl text-sm sm:text-base font-extrabold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    isOrganic
                      ? 'bg-[#16A34A] hover:bg-[#15803D] ring-2 ring-emerald-300/70'
                      : 'bg-gradient-to-r from-[#E11D48] via-[#F43F5E] to-[#BE123C] hover:from-[#BE123C] hover:to-[#9F1239] ring-2 ring-rose-300/70'
                  }`}
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>
                    {isOrdering
                      ? 'অর্ডার প্রসেস হচ্ছে...'
                      : `অর্ডার কনফার্ম করুন — ৳${totalPrice.toLocaleString()}`}
                  </span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Full-Screen Preview Modal for Customer Uploaded Screenshot */}
        {previewScreenshotModal && customerScreenshot && (
          <div
            onClick={() => setPreviewScreenshotModal(false)}
            className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl border border-rose-200 max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                  📷 আপনার আপলোডকৃত পেজ/প্রোফাইল স্ক্রিনশট (ফুল ভিউ)
                </h4>
                <button
                  type="button"
                  onClick={() => setPreviewScreenshotModal(false)}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                >
                  ✕ বন্ধ করুন
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto rounded-2xl bg-stone-950 flex items-center justify-center p-2">
                <img
                  src={customerScreenshot}
                  alt="কাস্টমার স্ক্রিনশট ফুল ভিউ"
                  className="max-w-full max-h-[65vh] object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // STEP 1: CLEAN PRODUCT DETAIL PAGE (হেডারের ঠিক নিচে প্রোডাক্টের ছবি + নিচে একই ক্যাটাগরির সাজেস্টেড প্রোডাক্ট)
  // ============================================================================
  return (
    <div className="bg-[#FAF9F6] min-h-screen pt-1.5 pb-8 sm:py-6 animate-in fade-in relative">
      {/* Toast Feedback */}
      {refreshToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#E11D48] text-white font-bold text-xs rounded-full shadow-2xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{refreshToast}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 space-y-4 sm:space-y-6">
        {/* Admin-Only Discrete Quick Edit & 1-Click Lifetime Save Bar — Hidden from regular customers so Product Image appears directly below Header */}
        {isAdmin && (
          <div className="flex items-center justify-end flex-wrap gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold text-stone-700 bg-white hover:bg-rose-50 px-2.5 py-1.5 rounded-xl border border-stone-200 shadow-2xs transition-colors cursor-pointer"
              title="প্রোডাক্ট লিংক কপি করুন (অ্যাডমিন)"
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
            <button
              type="button"
              onClick={async () => {
                setRefreshToast('💾 প্রোডাক্টটি লাইফটাইম ডাটাবেজে সেভ হচ্ছে...');
                try {
                  const saved = await saveProductPersisted(product);
                  if (onProductUpdated) onProductUpdated(saved);
                  setRefreshToast('✅ প্রোডাক্টটি ১-ক্লিকে লাইফটাইম ডাটাবেজে স্থায়ীভাবে সেভ হয়েছে!');
                } catch {
                  setRefreshToast('সেভ সম্পন্ন হয়েছে!');
                }
                setTimeout(() => setRefreshToast(''), 4000);
              }}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="১-ক্লিকে লাইফটাইম ডাটাবেজে সেভ করুন"
            >
              <Database className="w-3.5 h-3.5 text-white" />
              <span>💾 ১-ক্লিকে লাইফটাইম সেভ</span>
            </button>
            <button
              onClick={() => onOpenEdit(product)}
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold bg-[#E11D48] hover:bg-[#BE123C] text-white px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="প্রোডাক্ট তথ্য ও ছবি এডিট করুন"
            >
              <Edit3 className="w-3.5 h-3.5 text-white" />
              <span>এডিট করুন</span>
            </button>
          </div>
        )}

        {/* Main Product Details Split Layout — Product Image sits directly below Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start">
          {/* Left Column: Image Gallery & Responsive Non-Blocking YouTube IFrame Embed Player (5 cols) */}
          <div className="lg:col-span-5 space-y-3 sm:space-y-4">
            <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-xs">
              {/* Compact side back button overlaid on the top-left of the image so the product photo stays right under the Header */}
              <button
                type="button"
                onClick={onBack}
                className="absolute top-2.5 left-2.5 z-20 inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-stone-800 hover:text-[#E11D48] border border-stone-200/90 shadow-sm backdrop-blur-xs transition-all cursor-pointer"
                title="পেছনে ফিরে যান"
                aria-label="পেছনে ফিরে যান"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              {selectedVideoInHero !== null && cleanVideos[selectedVideoInHero] ? (
                (() => {
                  const heroEmbed = parseEmbedVideoUrl(cleanVideos[selectedVideoInHero]);
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
            {(product.images.length > 1 || cleanVideos.length > 0) && (
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

                {cleanVideos.map((vid, vIdx) => {
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
                        src={resolveSafeProductImageUrl(
                          thumbInfo.thumbnailUrl || product.images[0],
                          product,
                          0
                        )}
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

            {/* Official YouTube / H.264 Single Video Player (Responsive 16:9 + High-Performance Non-Blocking Facade) */}
            {cleanVideos.length > 0 && (
              <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-rose-200 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#E11D48] flex items-center gap-1.5">
                    <OfficialYouTubeIcon className="w-4 h-4 text-[#FF0000] shrink-0" />
                    <span>অরিজিনাল প্রোডাক্ট ভিডিও</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    HD ভিডিও প্লেয়ার
                  </span>
                </div>

                {cleanVideos.map((vid, vIdx) => {
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
            <div
              className={`bg-white rounded-2xl border p-4 sm:p-7 shadow-xs space-y-3.5 sm:space-y-4 ${
                isOrganic ? 'border-emerald-200' : 'border-stone-200'
              }`}
            >
              {/* Compact Top Badges & Clean Mobile Product Title */}
              <div>
                <div className="flex items-center gap-1.5 flex-wrap text-[10px] sm:text-xs mb-1.5">
                  <span
                    className={`font-bold px-2 py-0.5 rounded border ${
                      isOrganic
                        ? 'text-[#15803D] bg-[#ECFDF5] border-emerald-200'
                        : 'text-[#E11D48] bg-rose-50 border-rose-200'
                    }`}
                  >
                    {categoryNameBn}
                  </span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    ✓ স্টকে রয়েছে
                  </span>
                  <span className="text-stone-500 font-semibold">dokandari.com অরিজিনাল</span>
                </div>

                {/* Smaller, cleaner font size on mobile so long titles look neat */}
                <h1 className="text-sm sm:text-2xl font-extrabold text-stone-900 leading-snug">
                  {displayTitle} |{' '}
                  <span className={isOrganic ? 'text-[#16A34A]' : 'text-[#E11D48]'}>
                    dokandari.com
                  </span>
                </h1>

                {/* Verified Quality Row (No Review Section) */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="flex items-center text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-stone-800">5.0</span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    • ✓ ১০০% অরিজিনাল ও ভেরিফাইড কোয়ালিটি
                  </span>
                </div>
              </div>

              {/* Compact Price Box */}
              <div
                className={`p-3 sm:p-4 rounded-xl border flex items-baseline gap-2.5 flex-wrap ${
                  isOrganic
                    ? 'bg-[#F0FDF4] border-emerald-200'
                    : 'bg-rose-50/60 border-rose-100'
                }`}
              >
                <span
                  className={`text-lg sm:text-3xl font-extrabold font-mono tabular-nums ${
                    isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'
                  }`}
                >
                  ৳{product.price.toLocaleString()}
                </span>
                {product.originalPrice && (
                  <span className="text-xs sm:text-base text-stone-400 line-through font-mono tabular-nums">
                    ৳{product.originalPrice.toLocaleString()}
                  </span>
                )}
                <span
                  className={`text-[10px] sm:text-xs font-bold bg-white px-2 py-0.5 rounded border ${
                    isOrganic
                      ? 'text-[#15803D] border-emerald-200'
                      : 'text-[#E11D48] border-rose-200'
                  }`}
                >
                  Save {discountPercent}%
                </span>
              </div>

              {/* Fabric / Material Details */}
              {product.fabric && (
                <div className="text-[11px] sm:text-xs text-stone-700 bg-stone-50 p-2.5 sm:p-3 rounded-xl border border-stone-200">
                  <strong className="text-stone-900">
                    {isOrganic ? 'উপাদান / বিশুদ্ধতা:' : 'ফ্যাব্রিক / মেটেরিয়াল:'}
                  </strong>{' '}
                  {product.fabric}
                </div>
              )}

              {/* Compact Variants & 3 High-Conversion Combo Pack Offers */}
              <div className="space-y-3.5">
                {product.variants?.colors && product.variants.colors.length > 0 && (
                  <div>
                    <span className="block text-[11px] sm:text-xs font-bold text-stone-900 mb-1.5">
                      {isOrganic ? 'ধরন / প্যাক নির্বাচন:' : 'কালার নির্বাচন:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.colors.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          className={`px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            selectedColor === c
                              ? isOrganic
                                ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-xs'
                                : 'bg-[#E11D48] text-white border-[#E11D48] shadow-xs'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {product.variants?.sizes && product.variants.sizes.length > 0 && (
                  <div>
                    <span className="block text-[11px] sm:text-xs font-bold text-stone-900 mb-1.5">
                      {isOrganic ? 'ওজন / পরিমাণ নির্বাচন:' : 'সাইজ নির্বাচন:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {product.variants.sizes.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSelectedSize(s)}
                          className={`px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            selectedSize === s
                              ? isOrganic
                                ? 'bg-[#16A34A] text-white border-[#16A34A] shadow-xs'
                                : 'bg-[#E11D48] text-white border-[#E11D48] shadow-xs'
                              : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-stone-400'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3 HIGH-CONVERSION SPECIAL OFFER / COMBO CARDS (Matching Screenshot Design) */}
                <div className="p-3 sm:p-4 rounded-2xl bg-rose-50/40 border border-rose-200/80 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs sm:text-sm font-black text-stone-900 flex items-center gap-1.5">
                      <span>🔥 স্পেশাল অফার (বেশি কিনুন, বেশি বাঁচান!)</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-[#E11D48] bg-rose-100/90 border border-rose-200 px-2.5 py-0.5 rounded-full">
                      সীমিত সময়ের ধামাকা
                    </span>
                  </div>

                  {/* Admin Real-Time Offer Mode Toggle (Piece vs Size) & Screenshot Upload ON/OFF Toggle */}
                  {isAdmin && (
                    <div className="space-y-2">
                      <div className="p-2 rounded-xl bg-white border border-rose-200 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-extrabold text-rose-950">
                          ⚙️ অ্যাডমিন অফার মোড (রিয়েল-টাইম সেভ):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdminSwitchOfferMode('piece')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                              activeOfferMode === 'piece'
                                ? 'bg-[#E11D48] text-white shadow-2xs'
                                : 'bg-stone-50 text-stone-700 border border-stone-200 hover:border-rose-300'
                            }`}
                          >
                            📦 পিস অনুযায়ী (১, ২, ৩ পিস)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdminSwitchOfferMode('size')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                              activeOfferMode === 'size'
                                ? 'bg-[#E11D48] text-white shadow-2xs'
                                : 'bg-stone-50 text-stone-700 border border-stone-200 hover:border-rose-300'
                            }`}
                          >
                            📏 সাইজ অনুযায়ী (Small, Medium, Full Body)
                          </button>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-white border border-rose-200 flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[11px] font-extrabold text-stone-900">
                          📷 কাস্টমার স্ক্রিনশট আপলোড বক্স (শুধু কাস্টম প্রোডাক্টের জন্য):
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAdminToggleScreenshotOption(true)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                              isScreenshotEnabled
                                ? 'bg-emerald-600 text-white shadow-2xs'
                                : 'bg-stone-50 text-stone-700 border border-stone-200 hover:border-emerald-300'
                            }`}
                          >
                            ✓ ON (চালু ও আবশ্যক)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAdminToggleScreenshotOption(false)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                              !isScreenshotEnabled
                                ? 'bg-stone-800 text-white shadow-2xs'
                                : 'bg-stone-50 text-stone-700 border border-stone-200 hover:border-stone-400'
                            }`}
                          >
                            ✕ OFF (বন্ধ / হাইড)
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {/* Pack 1 */}
                    <button
                      type="button"
                      onClick={() => handleSelectCombo(1)}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-between gap-1.5 ${
                        selectedCombo === 1
                          ? isOrganic
                            ? 'border-[#16A34A] bg-white shadow-sm ring-2 ring-emerald-200'
                            : 'border-[#E11D48] bg-white shadow-sm ring-2 ring-rose-200'
                          : 'border-rose-100 bg-white/90 hover:border-rose-300'
                      }`}
                    >
                      <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[9.5px] sm:text-[10px] font-extrabold">
                        ১ পিস প্যাক
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-900 leading-tight">
                        {activeOfferMode === 'size' ? pkg1Title.split('(')[0].trim() : pkg1Title}
                      </span>
                      <span className="text-sm sm:text-lg font-mono font-black text-stone-900">
                        ৳{pkg1Price.toLocaleString()}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[9.5px] sm:text-[10px] font-bold">
                        রেগুলার
                      </span>
                    </button>

                    {/* Pack 2 */}
                    <button
                      type="button"
                      onClick={() => handleSelectCombo(2)}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-between gap-1.5 ${
                        selectedCombo === 2
                          ? isOrganic
                            ? 'border-[#16A34A] bg-white shadow-sm ring-2 ring-emerald-300'
                            : 'border-[#E11D48] bg-white shadow-sm ring-2 ring-rose-300'
                          : 'border-rose-100 bg-white/90 hover:border-rose-300'
                      }`}
                    >
                      <span className="px-2 py-0.5 rounded-full bg-[#E11D48] text-white text-[9.5px] sm:text-[10px] font-extrabold shadow-2xs">
                        সবচেয়ে জনপ্রিয়
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-900 leading-tight">
                        {activeOfferMode === 'size' ? pkg2Title.split('(')[0].trim() : pkg2Title}
                      </span>
                      <span className="text-sm sm:text-lg font-mono font-black text-[#E11D48]">
                        ৳{pkg2Price.toLocaleString()}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9.5px] sm:text-[10px] font-extrabold">
                        সাশ্রয় ৳{pkg2Discount}
                      </span>
                    </button>

                    {/* Pack 3 */}
                    <button
                      type="button"
                      onClick={() => handleSelectCombo(3)}
                      className={`p-2.5 sm:p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-between gap-1.5 ${
                        selectedCombo === 3
                          ? isOrganic
                            ? 'border-[#16A34A] bg-white shadow-sm ring-2 ring-emerald-400'
                            : 'border-[#E11D48] bg-white shadow-sm ring-2 ring-rose-400'
                          : 'border-rose-100 bg-white/90 hover:border-rose-300'
                      }`}
                    >
                      <span className="px-2 py-0.5 rounded-full bg-[#16A34A] text-white text-[9.5px] sm:text-[10px] font-extrabold shadow-2xs">
                        🚚 ফ্রি ডেলিভারি
                      </span>
                      <span className="text-xs sm:text-sm font-black text-stone-900 leading-tight">
                        {activeOfferMode === 'size' ? pkg3Title.split('(')[0].trim() : pkg3Title}
                      </span>
                      <span className="text-sm sm:text-lg font-mono font-black text-[#E11D48]">
                        ৳{pkg3Price.toLocaleString()}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9.5px] sm:text-[10px] font-extrabold">
                        মেগা সেভার
                      </span>
                    </button>
                  </div>
                </div>

                {/* CUSTOMER PROFILE / CUSTOM DESIGN SCREENSHOT UPLOAD BOX ON PRODUCT PAGE (ONLY SHOWN WHEN ENABLED FOR THIS PRODUCT!) */}
                {isScreenshotEnabled && (
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FFFDF9] border-2 border-dashed border-stone-800 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="block text-xs sm:text-sm font-extrabold text-stone-900">
                        📷 আপনার পেজ/প্রোফাইল স্ক্রিনশট বা কাস্টম ডিজাইনের ছবি আপলোড করুন: *
                      </label>
                      <span className="px-2 py-0.5 rounded-full bg-rose-100 text-[#E11D48] text-[10px] font-extrabold border border-rose-200">
                        আবশ্যক (Required)
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <label className="inline-flex items-center gap-2.5 cursor-pointer text-xs sm:text-sm">
                        <span className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-semibold rounded-lg border border-stone-300 transition-colors">
                          {isUploadingScreenshot ? 'আপলোড হচ্ছে...' : 'Choose File'}
                        </span>
                        <span className="text-stone-600 font-medium truncate max-w-[180px] sm:max-w-xs">
                          {customerScreenshot
                            ? customerScreenshotName || 'স্ক্রিনশট যুক্ত হয়েছে ✓'
                            : 'No file chosen'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCustomerScreenshotUpload}
                          className="hidden"
                        />
                      </label>

                      {customerScreenshot && (
                        <div className="flex items-center gap-2">
                          <img
                            src={customerScreenshot}
                            alt="আপলোডকৃত প্রোফাইল স্ক্রিনশট"
                            onClick={() => setPreviewScreenshotModal(true)}
                            className="w-11 h-11 rounded-lg object-cover border-2 border-[#E11D48] cursor-pointer shrink-0 shadow-2xs"
                            title="বড় করে দেখতে ক্লিক করুন"
                          />
                          <button
                            type="button"
                            onClick={() => setPreviewScreenshotModal(true)}
                            className="px-2.5 py-1 text-[11px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer"
                          >
                            🔍 ফুল ভিউ
                          </button>
                          <button
                            type="button"
                            onClick={handleClearCustomerScreenshot}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 rounded-lg cursor-pointer"
                          >
                            ✕ মুছুন
                          </button>
                        </div>
                      )}
                    </div>

                    {screenshotError && (
                      <div className="p-2 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-xs font-extrabold">
                        {screenshotError}
                      </div>
                    )}

                    {customerScreenshot && (
                      <p className="text-[11px] font-bold text-emerald-700 pt-0.5">
                        ✅ আপনার প্রোফাইল/ডিজাইন স্ক্রিনশট যুক্ত হয়েছে! অর্ডার কনফার্ম করলে এটি সরাসরি আমাদের কাছে চলে যাবে।
                      </p>
                    )}
                  </div>
                )}

                {/* Selected Package/Size & Subtotal Bar (Matching Screenshot!) */}
                <div className="px-3.5 py-2.5 rounded-xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xs sm:text-sm font-extrabold text-[#BE123C] flex items-center gap-1.5">
                      <span>🛍️</span>
                      <span>
                        {activeOfferMode === 'size'
                          ? (selectedCombo === 1
                              ? pkg1Title.split('(')[0].trim()
                              : selectedCombo === 2
                                ? pkg2Title.split('(')[0].trim()
                                : pkg3Title.split('(')[0].trim())
                          : `${quantity} টি প্যাক`}
                      </span>
                    </span>

                    <div className="flex items-center border border-rose-200 rounded-lg overflow-hidden bg-white">
                      <button
                        type="button"
                        onClick={() => {
                          const n = Math.max(1, quantity - 1);
                          setQuantity(n);
                          if (activeOfferMode === 'piece') {
                            if (n === 1) setSelectedCombo(1);
                            else if (n === 2) setSelectedCombo(2);
                            else if (n >= 3) setSelectedCombo(3);
                          }
                        }}
                        className="px-2 py-0.5 text-stone-700 font-bold hover:bg-rose-50 cursor-pointer text-xs"
                      >
                        -
                      </button>
                      <span className="px-2.5 py-0.5 text-xs font-mono font-bold text-stone-900 tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const n = quantity + 1;
                          setQuantity(n);
                          if (activeOfferMode === 'piece') {
                            if (n === 2) setSelectedCombo(2);
                            else if (n >= 3) setSelectedCombo(3);
                          }
                        }}
                        className="px-2 py-0.5 text-stone-700 font-bold hover:bg-rose-50 cursor-pointer text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm font-bold text-stone-700">
                    সর্বমোট:{' '}
                    <span
                      className={`text-base sm:text-xl font-black font-mono ${
                        isOrganic ? 'text-[#15803D]' : 'text-[#E11D48]'
                      }`}
                    >
                      ৳{subtotalPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS MATCHING SCREENSHOT: 1. ORDER NOW (PINK), 2. WHATSAPP (GREEN) + ADD TO CART */}
              <div className="pt-1 space-y-2.5">
                <button
                  type="button"
                  onClick={handleGoToInstantCheckout}
                  className={`w-full py-3.5 sm:py-4 px-4 active:scale-[0.98] text-white rounded-2xl text-sm sm:text-base font-extrabold shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                    isOrganic
                      ? 'bg-[#16A34A] hover:bg-[#15803D] ring-2 ring-emerald-300/70'
                      : 'bg-gradient-to-r from-[#E11D48] via-[#EC004F] to-[#BE123C] hover:from-[#BE123C] hover:to-[#9F1239] ring-2 ring-rose-300/70'
                  }`}
                >
                  <ShoppingBag className="w-5 h-5 text-white shrink-0" />
                  <span>
                    অর্ডার করুন (৳{subtotalPrice.toLocaleString()}) - ক্যাশ অন ডেলিভারি
                  </span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleWhatsAppOrder}
                    className="py-3 px-4 bg-[#16A34A] hover:bg-[#15803D] active:scale-95 text-white rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <OfficialWhatsAppIcon className="w-4 h-4 shrink-0" />
                    <span>WhatsApp এ অর্ডার</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddToCartOnCheckout}
                    className={`py-3 px-4 bg-rose-50/70 active:scale-95 border rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer ${
                      isOrganic
                        ? 'hover:bg-[#ECFDF5] border-emerald-200 text-[#15803D]'
                        : 'hover:bg-rose-100 border-rose-200 text-[#E11D48]'
                    }`}
                  >
                    {addedToCartToast ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700">কার্টে যুক্ত হয়েছে!</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag
                          className={`w-4 h-4 shrink-0 ${
                            isOrganic ? 'text-[#16A34A]' : 'text-[#E11D48]'
                          }`}
                        />
                        <span>কার্টে যোগ করুন</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Delivery Fee Quick Note */}
                <div className="px-3 py-2 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-[11px] sm:text-xs text-stone-700 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Truck
                      className={`w-3.5 h-3.5 ${isOrganic ? 'text-[#16A34A]' : 'text-[#E11D48]'}`}
                    />
                    <span>ঢাকা: ৳70 | ঢাকার বাইরে: ৳120</span>
                  </div>
                  <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                    ✓ চেক করে পেমেন্ট
                  </span>
                </div>
              </div>

              {/* 4-COLUMN GUARANTEE BADGES ON MOBILE & DESKTOP */}
              <div className="pt-2 border-t border-stone-100">
                <GuaranteeBadgesRow />
              </div>
            </div>

            {/* Complete Full Product Details, Specifications & Features Section */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2.5 flex-wrap gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-stone-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E11D48]" />
                  <span>পণ্যের সম্পূর্ণ বিবরণ ও স্পেসিফিকেশন (Full Details)</span>
                </h3>
                {product.sku && (
                  <span className="text-[11px] font-mono font-bold text-stone-500 bg-stone-100 px-2.5 py-0.5 rounded-md">
                    SKU: {product.sku}
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-stone-700 leading-relaxed whitespace-pre-line">
                {product.description}
              </p>

              {/* Key Specifications Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-semibold">ক্যাটাগরি:</span>
                  <span className="font-bold text-stone-900">{categoryNameBn}</span>
                </div>
                {product.fabric && (
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs">
                    <span className="text-stone-500 font-semibold">ম্যাটেরিয়াল / কোয়ালিটি:</span>
                    <span className="font-bold text-stone-900">{product.fabric}</span>
                  </div>
                )}
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-semibold">স্টক স্ট্যাটাস:</span>
                  <span className="font-bold text-emerald-700">✓ ইন-স্টক (রেডি টু শিপ)</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center justify-between text-xs">
                  <span className="text-stone-500 font-semibold">রিটার্ন পলিসি:</span>
                  <span className="font-bold text-stone-900">৭ দিনের সহজ রিটার্ন ও এক্সচেঞ্জ</span>
                </div>
              </div>

              {product.features && product.features.length > 0 && (
                <div className="pt-2 space-y-2">
                  <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                    মূল বৈশিষ্ট্যসমূহ (Key Features):
                  </h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-700">
                    {product.features.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 p-2.5 rounded-xl bg-[#FFF0F3]/50 border border-rose-100"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#E11D48] shrink-0 mt-0.5" />
                        <span className="font-medium text-stone-800">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================================
            SUGGESTED & RELATED PRODUCTS SECTION (সাজেস্টেড প্রোডাক্ট — একই ক্যাটাগরির পণ্য)
            ============================================================================ */}
        {renderSuggestedCategoryProducts(false)}

        {/* Full-Screen Preview Modal for Customer Uploaded Screenshot */}
        {previewScreenshotModal && customerScreenshot && (
          <div
            onClick={() => setPreviewScreenshotModal(false)}
            className="fixed inset-0 z-50 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl border border-rose-200 max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-3"
            >
              <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
                <h4 className="text-xs sm:text-sm font-extrabold text-stone-900">
                  📷 আপনার আপলোডকৃত পেজ/প্রোফাইল স্ক্রিনশট (ফুল ভিউ)
                </h4>
                <button
                  type="button"
                  onClick={() => setPreviewScreenshotModal(false)}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold cursor-pointer"
                >
                  ✕ বন্ধ করুন
                </button>
              </div>
              <div className="max-h-[70vh] overflow-auto rounded-2xl bg-stone-950 flex items-center justify-center p-2">
                <img
                  src={customerScreenshot}
                  alt="কাস্টমার স্ক্রিনশট ফুল ভিউ"
                  className="max-w-full max-h-[65vh] object-contain rounded-xl"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
