/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { INITIAL_PRODUCTS } from '../data/initialCatalog';
import { Product } from '../types';

export const OFFICIAL_WHATSAPP = '01885533437';
export const OFFICIAL_WHATSAPP_INT = '8801885533437';

const LS_STORE_CONTENT_KEY = 'dokandari_store_content_backup_v2';
const LS_CUSTOM_PRODUCTS_KEY = 'dokandari_custom_products_v2';
const LS_DELETED_PRODUCT_IDS_KEY = 'dokandari_deleted_product_ids_v2';

export interface CategoryHeroConfig {
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  ctaText?: string;
}

export interface StoreContent {
  whatsappNumber: string;
  hotlineNumber: string;
  officialEmail: string;
  carouselInterval: number; // Hero banner interval in ms (1000, 3000, 5000)
  bestSellingInterval?: number; // Best-selling product carousel interval in ms (3000, 5000, 8000, 10000)
  categoryOrder?: string[];
  socialLinks?: {
    whatsapp: string;
    facebook: string;
    instagram: string;
    tiktok: string;
    youtube: string;
  };
  pageContent?: {
    aboutHeadline: string;
    aboutSubtitle: string;
    warehouseAddress: string;
    corporateAddress?: string;
    googleMapUrl?: string;
    policyHeadline: string;
    policySubtitle: string;
    returnPolicyText: string;
    refundPolicyText: string;
    privacyPolicyText: string;
  };
  founder: {
    name: string;
    title: string;
    photo: string;
    bio: string;
    address: string;
    phone: string;
  };
  heroSlides: {
    id: string;
    title: string;
    subtitle: string;
    image: string;
    tag: string;
    ctaText?: string;
    ctaLink?: string;
  }[];
  categoryHeroes?: Record<string, CategoryHeroConfig>;
}

export const DEFAULT_CATEGORY_HEROES: Record<string, CategoryHeroConfig> = {
  home_decor: {
    title: 'প্রিমিয়াম হোম ডেকোর ও আনব্রেকেবল মিরর কালেকশন',
    subtitle: 'ভাঙার ভয় ছাড়া আপনার ঘর, ড্রয়িং রুম ও বেডরুমকে দিন রাজকীয় ও নান্দনিক লুক — ১০০% অরিজিনাল ইমপোর্টেড ডেকোর আইটেম।',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80',
    tag: 'হোম ডেকোর স্পেশাল',
    ctaText: 'কালেকশন দেখুন',
  },
  gadgets_electronics: {
    title: 'অরিজিনাল স্মার্ট গ্যাজেটস ও ইলেকট্রনিক্স কালেকশন',
    subtitle: 'টিডব্লিউএস ইয়ারবাডস, স্মার্টওয়াচ, পোর্টেবল মিনি ফ্যান ও আধুনিক টেক গ্যাজেটস এখন আকর্ষণীয় ডিসকাউন্টে।',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1600&q=80',
    tag: 'স্মার্ট গ্যাজেটস ও টেক',
    ctaText: 'গ্যাজেটস দেখুন',
  },
  fashion_clothing: {
    title: 'প্রিমিয়াম ফ্যাশন, হিজাব ও মডেস্ট ক্লদিং কালেকশন',
    subtitle: 'মালয়েশিয়ান শিফন হিজাব, প্রিমিয়াম পার্টি আবায়া ও ট্রেন্ডি ফ্যাশন ওয়্যার — আরামদায়ক ফেব্রিক ও নিখুঁত ফিনিশিং।',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=80',
    tag: 'ফ্যাশন ও ক্লদিং',
    ctaText: 'ফ্যাশন কালেকশন',
  },
  beauty_personal_care: {
    title: 'অথেনটিক বিউটি ও পার্সোনাল কেয়ার কালেকশন',
    subtitle: 'ত্বক ও চুলের যত্নে ১০০% অরিজিনাল স্কিনকেয়ার, অর্গানাইজার ও গ্রুমিং এসেনশিয়ালস।',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1600&q=80',
    tag: 'বিউটি ও স্কিনকেয়ার',
    ctaText: 'বিউটি প্রোডাক্টস',
  },
  home_kitchen: {
    title: 'স্মার্ট হোম ও কিচেন অ্যাপ্লায়েন্স কালেকশন',
    subtitle: 'আপনার রান্নাঘর ও প্রতিদিনের গৃহস্থালি কাজকে সহজ, দ্রুত ও পরিপাটি করার আধুনিক কিচেন টুলস।',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1600&q=80',
    tag: 'হোম ও কিচেন স্পেশাল',
    ctaText: 'কিচেন কালেকশন',
  },
  mobile_accessories: {
    title: 'প্রিমিয়াম মোবাইল এক্সেসরিজ ও ফাস্ট চার্জিং গিয়ার',
    subtitle: 'ফাস্ট চার্জার, পাওয়ার ব্যাংক, ম্যাগসেফ হোল্ডার ও প্রোটেক্টিভ মোবাইল এক্সেসরিজে সর্বোচ্চ গ্যারান্টি।',
    image: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=1600&q=80',
    tag: 'মোবাইল এক্সেসরিজ',
    ctaText: 'এক্সেসরিজ দেখুন',
  },
  lifestyle: {
    title: 'মডার্ন লাইফস্টাইল ও ডেইলি এসেনশিয়ালস',
    subtitle: 'প্রতিদিনের জীবনযাত্রাকে আরও স্মার্ট, রুচিশীল ও আরামদায়ক করতে বাছাইকৃত লাইফস্টাইল প্রোডাক্টস।',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1600&q=80',
    tag: 'লাইফস্টাইল ট্রেন্ডস',
    ctaText: 'লাইফস্টাইল পণ্য',
  },
  travel_outdoor: {
    title: 'ট্রাভেল ও আউটডোর অ্যাডভেঞ্চার কালেকশন',
    subtitle: 'ভ্রমণপ্রেমীদের জন্য ওয়াটারপ্রুফ ট্রাভেল ব্যাগ, অর্গানাইজার ও আউটডোর গিয়ার কালেকশন।',
    image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80',
    tag: 'ট্রাভেল ও আউটডোর',
    ctaText: 'ট্রাভেল গিয়ার',
  },
  health_fitness: {
    title: 'হেলথ, ওয়েলনেস ও ফিটনেস এক্সেসরিজ',
    subtitle: 'ঘরে বসে ফিটনেস চর্চা ও সুস্বাস্থ্যের জন্য প্রিমিয়াম ম্যাসাজার ও ওয়ার্কআউট ইকুইপমেন্ট।',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1600&q=80',
    tag: 'হেলথ ও ফিটনেস',
    ctaText: 'ফিটনেস পণ্য',
  },
  kids_baby: {
    title: 'কিডস ও বেবি কেয়ার প্রিমিয়াম প্রোডাক্টস',
    subtitle: 'আপনার সোনামণির মানসিক বিকাশ, নিরাপত্তা ও আনন্দের জন্য নিরাপদ এডুকেশনাল টয় ও বেবি কেয়ার আইটেম।',
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=1600&q=80',
    tag: 'কিডস ও বেবি জোন',
    ctaText: 'বেবি প্রোডাক্টস',
  },
  office_essentials: {
    title: 'অফিস ডেস্ক অর্গানাইজার ও নিত্যপ্রয়োজনীয় পণ্য',
    subtitle: 'আপনার ওয়ার্কস্টেশন ও অফিস ডেস্ককে প্রফেশনাল ও গোছানো রাখার স্মার্ট এক্সেসরিজ।',
    image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1600&q=80',
    tag: 'অফিস ও ডেইলি নিডস',
    ctaText: 'অফিস কালেকশন',
  },
};

export const DEFAULT_STORE_CONTENT: StoreContent = {
  whatsappNumber: OFFICIAL_WHATSAPP,
  hotlineNumber: '+8809638757282',
  officialEmail: 'dokandari.shop@gmail.com',
  carouselInterval: 3000,
  bestSellingInterval: 5000,
  socialLinks: {
    whatsapp: 'https://wa.me/8801885533437?text=Dokandari',
    facebook: 'https://facebook.com/dokandari',
    instagram: 'https://instagram.com/dokandari',
    tiktok: 'https://tiktok.com/@dokandari',
    youtube: 'https://youtube.com/@dokandari',
  },
  pageContent: {
    aboutHeadline: 'Dokandari — আপনার সৌন্দর্য, আমাদের ঐতিহ্য',
    aboutSubtitle:
      'আন্তর্জাতিক মানের প্রিমিয়াম হোম ডেকোর, ফ্যাশন ও গ্যাজেটস কালেকশন সরাসরি বিশ্বস্ত প্রস্তুতকারক থেকে আপনার দ্বারে পৌঁছে দিতে আমরা দায়বদ্ধ।',
    warehouseAddress: 'প্রবাসীর পল্লী, ডিইপিজেড (DEPZ) রোড, আশুলিয়া, সাভার, ঢাকা - ১৩৪৯',
    corporateAddress: 'বাড়ি ৫/এ, রোড ১২, সেক্টর ১০, উত্তরা মডেল টাউন, ঢাকা - ১২৩০',
    googleMapUrl: 'https://maps.google.com/?q=DEPZ+Ashulia+Savar+Dhaka',
    policyHeadline: 'গোপনীয়তা, রিটার্ন ও রিফান্ড পলিসি',
    policySubtitle:
      'Dokandari এর সাথে আপনার প্রতিটি কেনাকাটা শতভাগ নিরাপদ — ৭ দিনের ফ্রি রিটার্ন ও এক্সচেঞ্জ গ্যারান্টি (0 BDT Return Cost)। ডেলিভারি ম্যানের সামনে পার্সেল খুলে যাচাই করে নেওয়ার পূর্ণ সুবিধা।',
    returnPolicyText:
      'পার্সেল রিসিভ করার সময় ডেলিভারি রাইডারের সামনে প্যাকেট খুলে পণ্যটি দেখে নিন। পণ্যে কোনো ত্রুটি বা অমিল থাকলে তাৎক্ষণিক রিটার্ন বা ৭ দিনের মধ্যে সাইজ ও কালার এক্সচেঞ্জ করতে পারবেন।',
    refundPolicyText:
      'আপনি যদি কোনো পণ্য রিটার্ন করেন, আমাদের ওয়্যারহাউজে পণ্য ফেরত পৌঁছার ২৪ থেকে ৪৮ ঘণ্টার মধ্যে আপনার সম্পূর্ণ মূল্য বিকাশ, নগদ, রকেট অথবা ব্যাংক ট্রান্সফারের মাধ্যমে রিফান্ড করা হবে।',
    privacyPolicyText:
      'Dokandari গ্রাহকের কোনো ব্যক্তিগত তথ্য (নাম, মোবাইল নম্বর, ঠিকানা) তৃতীয় কোনো পক্ষের কাছে বিক্রি বা শেয়ার করে না। আপনার দেওয়া প্রতিটি তথ্য শুধুমাত্র পার্সেল ডেলিভারি ও অর্ডার স্ট্যাটাস জানানোর কাজে ব্যবহৃত হয়।',
  },
  founder: {
    name: 'মোঃ জান্নাতুল ইসলাম (জে. আই. রনি)',
    title: 'Founder & CEO, Dokandari',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    bio: 'Dokandari বাংলাদেশের অন্যতম শীর্ষস্থানীয় আন্তর্জাতিক মানের মাল্টি-ক্যাটাগরি ই-কমার্স প্ল্যাটফর্ম। হোম ডেকোর, স্মার্ট গ্যাজেটস, লাইফস্টাইল ও দৈনন্দিন পণ্যে ১০০% অরিজিনাল কোয়ালিটি নিশ্চয়তা।',
    address: 'প্রবাসীর পল্লী, ডিইপিজেড (DEPZ) রোড, আশুলিয়া, সাভার, ঢাকা - ১৩৪৯',
    phone: '+8809638757282',
  },
  heroSlides: [
    {
      id: 'slide-1',
      title: 'প্রিমিয়াম হোম ডেকোর ও আনব্রেকেবল মিরর কালেকশন',
      subtitle: 'ভাঙার ভয় ছাড়া আপনার ঘরের সৌন্দর্য নিমিষেই দ্বিগুণ করুন',
      image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1600&q=80',
      tag: 'হোম ডেকোর স্পেশাল',
      ctaText: 'কালেকশন দেখুন',
      ctaLink: '#products-section',
    },
    {
      id: 'slide-2',
      title: 'অরিজিনাল স্মার্ট গ্যাজেটস ও ওয়্যারলেস অ্যাক্সেসরিজ',
      subtitle: 'আন্তর্জাতিক ব্র্যান্ডের লেটেস্ট টেকনোলজি এখন আপনার হাতের মুঠোয়',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1600&q=80',
      tag: 'স্মার্ট গ্যাজেটস',
      ctaText: 'গ্যাজেট দেখুন',
      ctaLink: '#products-section',
    },
    {
      id: 'slide-3',
      title: 'আন্তর্জাতিক কোয়ালিটি লাইফস্টাইল ও ফ্যাশন ট্রেন্ডস',
      subtitle: 'সব জেন্ডার ও বয়সের জন্য আধুনিক লাইফস্টাইল ও নিত্যপ্রয়োজনীয় পণ্য',
      image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1600&q=80',
      tag: 'লাইফস্টাইল এসেনশিয়ালস',
      ctaText: 'অর্ডার করুন',
      ctaLink: '#products-section',
    },
  ],
  categoryHeroes: DEFAULT_CATEGORY_HEROES,
};

/**
 * Recursively strips `undefined` values so Firestore `setDoc` never rejects an object.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = sanitizeForFirestore(v);
      }
    }
    return out as T;
  }
  return obj;
}

/**
 * Loads the initial StoreContent merged with any locally saved Admin updates
 */
export function getInitialStoreContent(): StoreContent {
  try {
    const raw = localStorage.getItem(LS_STORE_CONTENT_KEY);
    if (!raw) return DEFAULT_STORE_CONTENT;
    const parsed = JSON.parse(raw) as Partial<StoreContent>;
    return mergeStoreContent(DEFAULT_STORE_CONTENT, parsed);
  } catch {
    return DEFAULT_STORE_CONTENT;
  }
}

export function mergeStoreContent(
  baseOrIncoming: Partial<StoreContent>,
  incomingArg?: Partial<StoreContent>
): StoreContent {
  const base: StoreContent = incomingArg ? (baseOrIncoming as StoreContent) : getInitialStoreContent();
  const incoming: Partial<StoreContent> = incomingArg ? incomingArg : baseOrIncoming;
  return {
    ...DEFAULT_STORE_CONTENT,
    ...base,
    ...incoming,
    socialLinks: {
      ...DEFAULT_STORE_CONTENT.socialLinks!,
      ...(base.socialLinks || {}),
      ...(incoming.socialLinks || {}),
    },
    pageContent: {
      ...DEFAULT_STORE_CONTENT.pageContent!,
      ...(base.pageContent || {}),
      ...(incoming.pageContent || {}),
    },
    founder: {
      ...DEFAULT_STORE_CONTENT.founder,
      ...(base.founder || {}),
      ...(incoming.founder || {}),
    },
    heroSlides:
      incoming.heroSlides && incoming.heroSlides.length > 0
        ? incoming.heroSlides
        : base.heroSlides || DEFAULT_STORE_CONTENT.heroSlides,
    categoryHeroes: {
      ...DEFAULT_CATEGORY_HEROES,
      ...(base.categoryHeroes || {}),
      ...(incoming.categoryHeroes || {}),
    },
  };
}

/**
 * Saves StoreContent (full or partial update) to both localStorage (instant 0ms persistence) and Firestore
 */
export async function saveStoreContentPersisted(
  contentUpdate: Partial<StoreContent>
): Promise<StoreContent> {
  const merged = mergeStoreContent(getInitialStoreContent(), contentUpdate);
  const clean = sanitizeForFirestore(merged);
  try {
    localStorage.setItem(LS_STORE_CONTENT_KEY, JSON.stringify(clean));
  } catch (e) {
    console.warn('localStorage storeContent backup note:', e);
  }

  try {
    await setDoc(doc(db, 'settings', 'store_content'), clean, { merge: true });
  } catch (err) {
    console.warn('Firestore store_content sync warning (saved locally):', err);
  }
  return clean;
}

export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DELETED_PRODUCT_IDS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function getCustomPersistedProductsMap(): Record<string, Product> {
  try {
    const raw = localStorage.getItem(LS_CUSTOM_PRODUCTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Keyword-aware high-resolution fallback product image selector so every product
 * gets a matching visual even if a legacy WordPress (dokandari.com/wp-content/...) or external hotlink fails.
 */
export function getFallbackProductImage(
  product?: { id?: string; name?: string; titleEn?: string; category?: string },
  index = 0
): string {
  const text = `${product?.name || ''} ${product?.titleEn || ''} ${product?.category || ''}`.toLowerCase();

  // Specific product type matching based on Bengali & English keywords
  if (text.includes('মিরর') || text.includes('আয়না') || text.includes('mirror')) {
    const mirrors = [
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=900&q=80',
    ];
    return mirrors[index % mirrors.length];
  }
  if (text.includes('বুকশেল্ফ') || text.includes('শোকেস') || text.includes('shelf') || text.includes('ডেকোর')) {
    const decor = [
      'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=900&q=80',
    ];
    return decor[index % decor.length];
  }
  if (
    text.includes('হেয়ার') ||
    text.includes('টনিক') ||
    text.includes('অয়েল') ||
    text.includes('তেল') ||
    text.includes('কন্ডিশনার') ||
    text.includes('শ্যাম্পু') ||
    text.includes('hair') ||
    text.includes('shampoo')
  ) {
    const hairCare = [
      'https://images.unsplash.com/photo-1608248597359-05f30325493b?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&w=900&q=80',
    ];
    return hairCare[index % hairCare.length];
  }
  if (
    text.includes('সিরাম') ||
    text.includes('ময়েশ্চারাইজার') ||
    text.includes('স্কিন') ||
    text.includes('ফেইস') ||
    text.includes('ক্রিম') ||
    text.includes('লোশন') ||
    text.includes('সোপ') ||
    text.includes('সাবান') ||
    text.includes('serum') ||
    text.includes('beauty') ||
    text.includes('skin')
  ) {
    const skincare = [
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=900&q=80',
    ];
    return skincare[index % skincare.length];
  }
  if (
    text.includes('ফ্যান') ||
    text.includes('ইয়ারবাড') ||
    text.includes('ওয়াচ') ||
    text.includes('চার্জার') ||
    text.includes('গ্যাজেট') ||
    text.includes('fan') ||
    text.includes('gadget') ||
    text.includes('watch')
  ) {
    const gadgets = [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=900&q=80',
    ];
    return gadgets[index % gadgets.length];
  }
  if (
    text.includes('হিজাব') ||
    text.includes('আবায়া') ||
    text.includes('বোরকা') ||
    text.includes('ক্যামিসোল') ||
    text.includes('পোশাক') ||
    text.includes('ফ্যাশন') ||
    text.includes('fashion')
  ) {
    const fashion = [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=900&q=80',
    ];
    return fashion[index % fashion.length];
  }

  const cat = product?.category || 'home_decor';
  return DEFAULT_CATEGORY_HEROES[cat]?.image || DEFAULT_CATEGORY_HEROES.home_decor.image;
}

/**
 * Resolves and sanitizes any product image URL:
 * 1. Unwraps `/images/:id/:idx?src=...` URLs so static/live domains don't 404.
 * 2. Replaces dead legacy WordPress URLs (`dokandari.com/wp-content/uploads/...`) that stopped existing after DNS migration.
 * 3. Converts protocol-relative `//...` to `https://...` and upgrades insecure `http://` to `https://` via wsrv.nl CDN proxy.
 */
export function resolveSafeProductImageUrl(
  rawUrl: string | undefined,
  product?: { id?: string; name?: string; titleEn?: string; category?: string },
  index = 0
): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return getFallbackProductImage(product, index);
  }

  let url = rawUrl.trim();
  if (!url) {
    return getFallbackProductImage(product, index);
  }

  // Keep data: and blob: URLs intact
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // 1. Unwrap `/images/:productId/:index?src=...`
  if (url.includes('/images/') && url.includes('src=')) {
    try {
      const parsed = new URL(url, 'https://dokandari.com');
      const innerSrc = parsed.searchParams.get('src');
      if (innerSrc) {
        url = decodeURIComponent(innerSrc).trim();
      }
    } catch {
      const match = url.match(/[?&]src=([^&]+)/);
      if (match?.[1]) {
        try {
          url = decodeURIComponent(match[1]).trim();
        } catch {
          // ignore
        }
      }
    }
  }

  // 2. Fix protocol-relative URLs (e.g. //sc04.alicdn.com/...)
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  // 3. Detect dead legacy WordPress paths on dokandari.com/wp-content/uploads/
  const lower = url.toLowerCase();
  if (
    lower.includes('dokandari.com/wp-content/') ||
    lower.includes('buy.dokandari.com/wp-content/') ||
    lower.startsWith('/wp-content/') ||
    lower.startsWith('/images/')
  ) {
    return getFallbackProductImage(product, index);
  }

  // 4. Route hotlink-blocked e-commerce CDNs or HTTP-only URLs through global WebP image proxy
  const needsProxy =
    url.startsWith('http://') ||
    lower.includes('alicdn.com') ||
    lower.includes('alibaba.com') ||
    lower.includes('aliexpress') ||
    lower.includes('slatic.net') ||
    lower.includes('daraz') ||
    lower.includes('shajgoj') ||
    lower.includes('fbcdn.net');

  if (needsProxy && /^https?:\/\//i.test(url) && !lower.includes('wsrv.nl')) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=800&output=webp`;
  }

  return url;
}

/**
 * Universal `onError` handler for product `<img>` tags across the storefront and admin panel.
 * Retries via wsrv.nl CDN proxy first, then falls back to a high-resolution product-matched image.
 */
export function handleProductImageError(
  e: { currentTarget: HTMLImageElement },
  product?: { id?: string; name?: string; titleEn?: string; category?: string },
  index = 0
): void {
  const imgEl = e.currentTarget;
  if (!imgEl) return;

  const currentSrc = imgEl.src || '';
  const fallback = getFallbackProductImage(product, index);

  // Prevent infinite loop if already on fallback
  if (currentSrc === fallback || imgEl.dataset.fallbackApplied === 'true') {
    imgEl.dataset.fallbackApplied = 'true';
    if (imgEl.src !== fallback) {
      imgEl.src = fallback;
    }
    return;
  }

  // If not yet proxied via wsrv.nl and it's an external http/https URL (not unsplash/dokandari), try wsrv.nl once
  if (
    !currentSrc.includes('wsrv.nl') &&
    !currentSrc.includes('images.unsplash.com') &&
    !currentSrc.includes('dokandari.com') &&
    /^https?:\/\//i.test(currentSrc) &&
    imgEl.dataset.proxyTried !== 'true'
  ) {
    imgEl.dataset.proxyTried = 'true';
    imgEl.src = `https://wsrv.nl/?url=${encodeURIComponent(currentSrc)}&w=800&output=webp`;
    return;
  }

  imgEl.dataset.fallbackApplied = 'true';
  imgEl.src = fallback;
}

function normalizeProductImages(p: Product): Product {
  const rawList = Array.isArray(p.images) && p.images.length > 0 ? p.images : [''];
  const safeImages = rawList.map((img, idx) => resolveSafeProductImageUrl(img, p, idx));
  return {
    ...p,
    images: safeImages,
  };
}

/**
 * Merges INITIAL_PRODUCTS + remote Firestore products + local Admin custom/edited products,
 * while removing any product IDs deleted by the Admin and repairing broken image URLs.
 */
export function mergeCatalogProducts(remoteProducts?: Product[]): Product[] {
  const deletedIds = getDeletedProductIds();
  const customMap = getCustomPersistedProductsMap();
  const map = new Map<string, Product>();

  // 1. Start with initial products (if not deleted)
  for (const p of INITIAL_PRODUCTS) {
    if (!deletedIds.has(p.id)) {
      map.set(p.id, normalizeProductImages(p));
    }
  }

  // 2. Overlay remote Firestore products (if not deleted)
  if (remoteProducts && remoteProducts.length > 0) {
    for (const p of remoteProducts) {
      if (!deletedIds.has(p.id)) {
        map.set(p.id, normalizeProductImages(p));
      }
    }
  }

  // 3. Overlay newest local custom/edited products (if not deleted)
  for (const [id, prod] of Object.entries(customMap)) {
    if (!deletedIds.has(id)) {
      const existing = map.get(id);
      if (!existing || (prod.updatedAt || 0) >= (existing.updatedAt || 0)) {
        map.set(id, normalizeProductImages(prod));
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
  );
}

/**
 * Persists a newly created or edited product to localStorage AND Firestore immediately
 */
export async function saveProductPersisted(product: Product): Promise<Product> {
  const now = Date.now();
  const rawImages =
    Array.isArray(product.images) && product.images.length > 0
      ? product.images
      : [getFallbackProductImage(product, 0)];
  const safeImages = rawImages.map((img, idx) => resolveSafeProductImageUrl(img, product, idx));

  const normalized: Product = sanitizeForFirestore({
    ...product,
    id: product.id || `prod-${now}`,
    name: (product.name || 'নতুন প্রোডাক্ট').trim(),
    price: Number(product.price) || 0,
    originalPrice: Number(product.originalPrice) || Math.round((Number(product.price) || 0) * 1.25),
    category: product.category || 'home_decor',
    description: product.description || product.name || '',
    features: Array.isArray(product.features) ? product.features : [],
    images: safeImages,
    videos: Array.isArray(product.videos) ? product.videos : [],
    variants: {
      colors: product.variants?.colors?.length ? product.variants.colors : ['Standard Color'],
      sizes: product.variants?.sizes?.length ? product.variants.sizes : ['Standard Size'],
    },
    inStock: product.inStock !== false,
    rating: Number(product.rating) || 4.9,
    reviewCount: Number(product.reviewCount) || 18,
    status: product.status || 'published',
    createdAt: product.createdAt || now,
    updatedAt: now,
  });

  // 1. Save to localStorage custom products map & remove from deleted set if re-added
  try {
    const deleted = getDeletedProductIds();
    if (deleted.has(normalized.id)) {
      deleted.delete(normalized.id);
      localStorage.setItem(LS_DELETED_PRODUCT_IDS_KEY, JSON.stringify(Array.from(deleted)));
    }
    const customMap = getCustomPersistedProductsMap();
    customMap[normalized.id] = normalized;
    localStorage.setItem(LS_CUSTOM_PRODUCTS_KEY, JSON.stringify(customMap));
  } catch (e) {
    console.warn('localStorage product save note:', e);
  }

  // 2. Save to Firestore
  try {
    await setDoc(doc(db, 'products', normalized.id), normalized, { merge: true });
  } catch (err) {
    console.warn('Firestore product save warning (saved locally):', err);
  }

  return normalized;
}

/**
 * Deletes a product permanently from localStorage, prevents re-seeding, and deletes from Firestore
 */
export async function deleteProductPersisted(productId: string): Promise<void> {
  try {
    const deleted = getDeletedProductIds();
    deleted.add(productId);
    localStorage.setItem(LS_DELETED_PRODUCT_IDS_KEY, JSON.stringify(Array.from(deleted)));

    const customMap = getCustomPersistedProductsMap();
    if (customMap[productId]) {
      delete customMap[productId];
      localStorage.setItem(LS_CUSTOM_PRODUCTS_KEY, JSON.stringify(customMap));
    }
  } catch (e) {
    console.warn('localStorage delete product note:', e);
  }

  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (err) {
    console.warn('Firestore delete product warning:', err);
  }
}

/**
 * Compresses an uploaded image File into a lightweight JPEG/WebP DataURL suitable for Firestore & instant preview
 */
export function compressImageFileToDataUrl(
  file: File,
  maxWidth = 960,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ফাইলটি পড়া যায়নি'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ছবিটি লোড করা যায়নি'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Ensures initial catalog is seeded in Firestore if not already present,
 * skipping any products that the Admin has deleted.
 */
export async function seedProductsIfEmpty(): Promise<void> {
  try {
    const deletedIds = getDeletedProductIds();
    const customMap = getCustomPersistedProductsMap();
    const productsCol = collection(db, 'products');
    const snap = await getDocs(productsCol);
    const existingIds = new Set(snap.docs.map((d) => d.id));

    // Seed missing items from initial catalog ONLY if not deleted by Admin
    for (const prod of INITIAL_PRODUCTS) {
      if (!existingIds.has(prod.id) && !deletedIds.has(prod.id)) {
        const cleanProd = sanitizeForFirestore(customMap[prod.id] || prod);
        await setDoc(doc(db, 'products', prod.id), cleanProd);
      }
    }

    // Also push any locally created custom products that weren't in Firestore yet
    for (const [id, customProd] of Object.entries(customMap)) {
      if (!existingIds.has(id) && !deletedIds.has(id)) {
        await setDoc(doc(db, 'products', id), sanitizeForFirestore(customProd));
      }
    }

    // Seed default store content if not present
    const contentRef = doc(db, 'settings', 'store_content');
    const contentSnap = await getDoc(contentRef);
    if (!contentSnap.exists()) {
      const initialContent = getInitialStoreContent();
      await setDoc(contentRef, sanitizeForFirestore(initialContent));
    }
  } catch (err) {
    console.warn('Seeding check note', err);
  }
}

/**
 * Ensures any social or external link includes the Dokandari brand identifier
 * and normalizes raw handles or URLs pasted in the Admin Panel.
 */
export function formatDokandariSocialUrl(
  rawUrl: string | undefined,
  platform: 'whatsapp' | 'facebook' | 'instagram' | 'tiktok' | 'youtube'
): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return DEFAULT_STORE_CONTENT.socialLinks?.[platform] || 'https://dokandari.com';
  }

  // Handle plain phone number for WhatsApp
  if (platform === 'whatsapp' && /^[0-9+\s-]+$/.test(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    const intl = digits.startsWith('88') ? digits : `88${digits}`;
    return `https://wa.me/${intl}?text=${encodeURIComponent('আসসালামু আলাইকুম Dokandari')}`;
  }

  let url = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;

  // Ensure "dokandari" appears in the link as requested by user
  if (!url.toLowerCase().includes('dokandari')) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}brand=dokandari`;
  }

  return url;
}
