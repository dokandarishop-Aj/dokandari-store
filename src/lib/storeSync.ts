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
import { Product, Order } from '../types';

export const OFFICIAL_WHATSAPP = '01885533437';
export const OFFICIAL_WHATSAPP_INT = '8801885533437';

const LS_STORE_CONTENT_KEY = 'dokandari_store_content_backup_v2';
const LS_CUSTOM_PRODUCTS_KEY = 'dokandari_custom_products_v2';
const LS_DELETED_PRODUCT_IDS_KEY = 'dokandari_deleted_product_ids_v2';
const LS_ORDERS_BACKUP_KEY = 'dokandari_orders_backup_v1';

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
    image: '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
    tag: 'হোম ডেকোর স্পেশাল',
    ctaText: 'কালেকশন দেখুন',
  },
  gadgets_electronics: {
    title: 'অরিজিনাল স্মার্ট গ্যাজেটস ও ইলেকট্রনিক্স কালেকশন',
    subtitle: 'টিডব্লিউএস ইয়ারবাডস, স্মার্টওয়াচ, পোর্টেবল মিনি ফ্যান ও আধুনিক টেক গ্যাজেটস এখন আকর্ষণীয় ডিসকাউন্টে।',
    image: '/uploads/product/1789984768-HJ-5060-Rechargeable-LED-Desk-Lamp-with-Smart-Display-Pen-Holder.webp',
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
    image: '/uploads/product/1789984863-Dear-Hair-Tonic-Cleanser-1.jpg',
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
    warehouseAddress: 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)',
    corporateAddress: 'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা',
    googleMapUrl: 'https://maps.google.com/?q=Jaleshwar+Savar+1340+Dhaka',
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
    address: 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)',
    phone: '+8809638757282',
  },
  heroSlides: [
    {
      id: 'slide-1',
      title: 'প্রিমিয়াম হোম ডেকোর ও আনব্রেকেবল মিরর কালেকশন',
      subtitle: 'ভাঙার ভয় ছাড়া আপনার ঘরের সৌন্দর্য নিমিষেই দ্বিগুণ করুন',
      image: '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
      tag: 'হোম ডেকোর স্পেশাল',
      ctaText: 'কালেকশন দেখুন',
      ctaLink: '#products-section',
    },
    {
      id: 'slide-2',
      title: 'অরিজিনাল স্মার্ট গ্যাজেটস ও ওয়্যারলেস অ্যাক্সেসরিজ',
      subtitle: 'আন্তর্জাতিক ব্র্যান্ডের লেটেস্ট টেকনোলজি এখন আপনার হাতের মুঠোয়',
      image: '/uploads/product/1789984768-HJ-5060-Rechargeable-LED-Desk-Lamp-with-Smart-Display-Pen-Holder.webp',
      tag: 'স্মার্ট গ্যাজেটস',
      ctaText: 'গ্যাজেট দেখুন',
      ctaLink: '#products-section',
    },
    {
      id: 'slide-3',
      title: 'আন্তর্জাতিক কোয়ালিটি স্কিনকেয়ার ও হেয়ার কেয়ার কালেকশন',
      subtitle: '১০০% অথেনটিক হেয়ার টনিক, সিরাম ও নিত্যপ্রয়োজনীয় বিউটি পণ্য',
      image: '/uploads/product/1789984863-Dear-Hair-Tonic-Cleanser-1.jpg',
      tag: 'বিউটি ও লাইফস্টাইল',
      ctaText: 'অর্ডার করুন',
      ctaLink: '#products-section',
    },
  ],
  categoryHeroes: DEFAULT_CATEGORY_HEROES,
};

/**
 * Normalizes legacy English/Uttara addresses to the official Bengali Savar addresses
 * unless the admin has entered a custom new address.
 */
function normalizeOfficialAddresses(content: StoreContent): StoreContent {
  const wh = (content.pageContent?.warehouseAddress || '').trim();
  const corp = (content.pageContent?.corporateAddress || '').trim();
  const fAddr = (content.founder?.address || '').trim();

  const isLegacyWarehouse =
    !wh ||
    wh.toLowerCase().includes('b-61/14') ||
    wh.toLowerCase().includes('jaleshwar') ||
    wh.includes('প্রবাসীর পল্লী') ||
    wh.includes('ডিইপিজেড');

  const isLegacyCorporate =
    !corp ||
    corp.includes('উত্তরা মডেল টাউন') ||
    corp.includes('বাড়ি ৫/এ') ||
    corp.includes('সেক্টর ১০');

  const isLegacyFounderAddr =
    !fAddr ||
    fAddr.toLowerCase().includes('b-61/14') ||
    fAddr.toLowerCase().includes('jaleshwar') ||
    fAddr.includes('প্রবাসীর পল্লী') ||
    fAddr.includes('ডিইপিজেড');

  return {
    ...content,
    pageContent: {
      ...DEFAULT_STORE_CONTENT.pageContent!,
      ...(content.pageContent || {}),
      warehouseAddress: isLegacyWarehouse
        ? 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)'
        : wh,
      corporateAddress: isLegacyCorporate
        ? 'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা'
        : corp,
    },
    founder: {
      ...DEFAULT_STORE_CONTENT.founder,
      ...(content.founder || {}),
      address: isLegacyFounderAddr
        ? 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)'
        : fAddr,
    },
  };
}

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
  const base: StoreContent = incomingArg ? (baseOrIncoming as StoreContent) : DEFAULT_STORE_CONTENT;
  const incoming: Partial<StoreContent> = incomingArg ? incomingArg : baseOrIncoming;
  const merged: StoreContent = {
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
      // Preserve explicit empty string if admin removed founder photo
      photo:
        incoming.founder && typeof incoming.founder.photo === 'string'
          ? incoming.founder.photo
          : base.founder && typeof base.founder.photo === 'string'
          ? base.founder.photo
          : DEFAULT_STORE_CONTENT.founder.photo,
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
  return normalizeOfficialAddresses(merged);
}

/**
 * Saves StoreContent (full or partial update) to both localStorage (instant 0ms persistence) and Firestore
 */
export async function saveStoreContentPersisted(
  contentUpdate: Partial<StoreContent>
): Promise<StoreContent> {
  const current = getInitialStoreContent();
  const merged = mergeStoreContent(current, contentUpdate);
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
 * Deterministic string hash so every product gets a unique, consistent image index from its category pool.
 */
function hashProductSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Keyword-aware high-resolution fallback product image selector so every product
 * gets a matching visual even if a legacy WordPress (dokandari.com/wp-content/...), Alibaba, or hotlink fails.
 */
export function getFallbackProductImage(
  product?: { id?: string; name?: string; titleEn?: string; category?: string },
  index = 0
): string {
  const id = (product?.id || '').toLowerCase();
  const text = `${id} ${product?.name || ''} ${product?.titleEn || ''} ${product?.category || ''}`.toLowerCase();
  const seed = hashProductSeed(`${product?.id || ''}-${product?.name || ''}`);
  const offset = seed + index;

  // Exact match for real Dokandari products
  if (text.includes('arch') || text.includes('খিলান')) {
    const archGallery = [
      '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
      '/uploads/product/He1e7d0e527634b5196f9d7cd961eb694M.jpg',
      '/uploads/product/H25ea4841afd5463591250f1d029873acN.jpg',
      '/uploads/product/H29cc3664a9fa41368666c15926e0d2b5S.jpg',
      '/uploads/product/H6a326173d1a54849a898cf5017343e7ah.jpg',
      '/uploads/product/H952cd307db5c46eea7a3728480fb7c42j.jpg',
    ];
    return archGallery[index % archGallery.length];
  }

  if (text.includes('হার্ট') || text.includes('heart')) {
    const heartGallery = [
      '/uploads/product/1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg',
      '/uploads/product/heart-mirror-sticker.jpg',
    ];
    return heartGallery[index % heartGallery.length];
  }

  if (
    text.includes('বেড়াল') ||
    text.includes('বিড়াল') ||
    text.includes('বুকশেল্ফ') ||
    text.includes('বুকসেল্ফ') ||
    text.includes('শোকেস') ||
    text.includes('cat') ||
    text.includes('shelf') ||
    text.includes('bookshelf')
  ) {
    const catGallery = [
      '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
      '/uploads/product/cat-led-bookshelf.jpg',
    ];
    return catGallery[index % catGallery.length];
  }

  if (text.includes('প্রজাপতি') || text.includes('butterfly') || text.includes('৩ডি') || text.includes('3d')) {
    const bflyGallery = [
      '/uploads/product/1792218499-h2d83f5b4372f4cf69c8441815d239ae5j.jpg',
      '/uploads/product/3d-butterfly-mirror.jpg',
    ];
    return bflyGallery[index % bflyGallery.length];
  }

  if (text.includes('গোল') || text.includes('বাথরুম') || text.includes('ভ্যানিটি') || text.includes('round') || text.includes('vanity')) {
    const roundGallery = [
      '/uploads/product/1792218995-hb38f48c0a8b7454ebad69790a214b4f5s.jpg',
      '/uploads/product/round-vanity-mirror.jpg',
    ];
    return roundGallery[index % roundGallery.length];
  }

  if (text.includes('ফ্লেক্সিবল') || text.includes('সেলফ-আঠালো') || text.includes('flexible') || text.includes('sheet')) {
    const flexGallery = [
      '/uploads/product/1792219337-ha7e0aa8d05a44d73b82d68816420d174s.jpg',
      '/uploads/product/flexible-mirror-sheet.jpg',
    ];
    return flexGallery[index % flexGallery.length];
  }

  if (text.includes('ডিয়ার') || text.includes('dear')) {
    const dearGallery = [
      '/uploads/product/1789984863-Dear-Hair-Tonic-Cleanser-1.jpg',
      '/uploads/product/dear-hair-tonic.jpg',
    ];
    return dearGallery[index % dearGallery.length];
  }

  if (text.includes('লাফজ') || text.includes('lafz')) {
    return '/uploads/product/1789984852-Lafz-10-in-1-Advanced-Essential-Hair-Oil.webp';
  }
  if (text.includes('স্কিন ক্যাফে') || text.includes('skin cafe')) {
    return '/uploads/product/1789984839-Skin-Cafe-Silky-Tresses-Moisturizing-Conditioner-120ml.webp';
  }
  if (text.includes('সেন্ট আইভস') || text.includes('st. ives') || text.includes('st ives')) {
    return '/uploads/product/1789984829-St.-Ives-Glowing-Oil-Free-Face-Moisturizer-Watermelon.webp';
  }
  if (text.includes('সিম্পল') || text.includes('simple')) {
    return '/uploads/product/1789984817-Simple-10-Vitamin-CEF-Booster-Serum-30ml.webp';
  }
  if (text.includes('হাওয়া') || text.includes('hawa')) {
    return '/uploads/product/1789984805-Hawa-Hair-Fall-Avenger-Oil-100ml.webp';
  }
  if (text.includes('মুশট্যাক') || text.includes('muuchstac')) {
    return '/uploads/product/1789984794-Muuchstac-Ocean-Face-Wash-Herbal-Skin-Lightning-Oil-Combo.webp';
  }
  if (text.includes('ফ্যান') || text.includes('কুলিং') || text.includes('fan')) {
    return '/uploads/product/1789984781-Portable-Handheld-Cooling-Fan-with-Night-Light.webp';
  }
  if (text.includes('hj-5060') || text.includes('ডেস্ক ল্যাম্প') || text.includes('desk lamp')) {
    return '/uploads/product/1789984768-HJ-5060-Rechargeable-LED-Desk-Lamp-with-Smart-Display-Pen-Holder.webp';
  }
  if (text.includes('m11')) {
    return '/uploads/product/1789984745-M11-TWS-True-Wireless-Earbuds-with-Power-Bank-LED-Display.webp';
  }
  if (text.includes('জয় সুপার') || text.includes('joy-super') || text.includes('b10')) {
    return '/uploads/product/1789984733-JOY-SUPER-B10-Rechargeable-Emergency-Bulb-15W.webp';
  }
  if (text.includes('থান্ডার') || text.includes('thunder') || text.includes('xst-836')) {
    return '/uploads/product/1789984722-Thunder-2-in-1-Rechargeable-LED-Emergency-Light-XST-836.webp';
  }
  if (text.includes('লিভো') || text.includes('livo')) {
    return '/uploads/product/1789984712-Livo-Instant-Hair-Color-Shampoo-3-in-1.webp';
  }
  if (text.includes('হোকো') || text.includes('hoco') || text.includes('eq2')) {
    return '/uploads/product/1789984699-Hoco-EQ2-True-Wireless-BT-Headset.webp';
  }
  if (text.includes('কলমি') || text.includes('colmi') || text.includes('kw77')) {
    return '/uploads/product/1789984688-Colmi-KW77-Smart-Watch-2-Straps.webp';
  }
  if (text.includes('সেলাই') || text.includes('sewing')) {
    return '/uploads/product/1789984677-Mini-Multifunctional-Household-Electric-Sewing-Machine.webp';
  }
  if (text.includes('ফুড সেফটি') || text.includes('food safety')) {
    return '/uploads/product/1789984665-Food-Safety-7-Plus-Combo-Pack.webp';
  }

  // Category pools using 100% real Dokandari product images
  const cat = product?.category || 'home_decor';
  const catPools: Record<string, string[]> = {
    home_decor: [
      '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
      '/uploads/product/1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg',
      '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
      '/uploads/product/1792219337-ha7e0aa8d05a44d73b82d68816420d174s.jpg',
      '/uploads/product/1792218995-hb38f48c0a8b7454ebad69790a214b4f5s.jpg',
      '/uploads/product/1792218499-h2d83f5b4372f4cf69c8441815d239ae5j.jpg',
    ],
    gadgets_electronics: [
      '/uploads/product/1789984768-HJ-5060-Rechargeable-LED-Desk-Lamp-with-Smart-Display-Pen-Holder.webp',
      '/uploads/product/1789984733-JOY-SUPER-B10-Rechargeable-Emergency-Bulb-15W.webp',
      '/uploads/product/1789984722-Thunder-2-in-1-Rechargeable-LED-Emergency-Light-XST-836.webp',
      '/uploads/product/1789984688-Colmi-KW77-Smart-Watch-2-Straps.webp',
    ],
    beauty_personal_care: [
      '/uploads/product/1789984863-Dear-Hair-Tonic-Cleanser-1.jpg',
      '/uploads/product/1789984852-Lafz-10-in-1-Advanced-Essential-Hair-Oil.webp',
      '/uploads/product/1789984839-Skin-Cafe-Silky-Tresses-Moisturizing-Conditioner-120ml.webp',
      '/uploads/product/1789984829-St.-Ives-Glowing-Oil-Free-Face-Moisturizer-Watermelon.webp',
      '/uploads/product/1789984817-Simple-10-Vitamin-CEF-Booster-Serum-30ml.webp',
      '/uploads/product/1789984805-Hawa-Hair-Fall-Avenger-Oil-100ml.webp',
    ],
    home_kitchen: [
      '/uploads/product/1789984677-Mini-Multifunctional-Household-Electric-Sewing-Machine.webp',
      '/uploads/product/1789984665-Food-Safety-7-Plus-Combo-Pack.webp',
    ],
    mobile_accessories: [
      '/uploads/product/1789984745-M11-TWS-True-Wireless-Earbuds-with-Power-Bank-LED-Display.webp',
      '/uploads/product/1789984699-Hoco-EQ2-True-Wireless-BT-Headset.webp',
    ],
    lifestyle: [
      '/uploads/product/1789984781-Portable-Handheld-Cooling-Fan-with-Night-Light.webp',
    ],
    travel_outdoor: [
      '/uploads/product/1789984722-Thunder-2-in-1-Rechargeable-LED-Emergency-Light-XST-836.webp',
    ],
    health_fitness: [
      '/uploads/product/1789984665-Food-Safety-7-Plus-Combo-Pack.webp',
    ],
    kids_baby: [
      '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
    ],
    office_essentials: [
      '/uploads/product/1789984768-HJ-5060-Rechargeable-LED-Desk-Lamp-with-Smart-Display-Pen-Holder.webp',
    ],
    fashion_clothing: [
      '/uploads/product/1789984712-Livo-Instant-Hair-Color-Shampoo-3-in-1.webp',
    ],
  };

  const pool = catPools[cat] || catPools.home_decor;
  return pool[offset % pool.length];
}

// Generic Unsplash URLs (brown living-room sofa, white sofa, yellow headphones, etc.) that accidentally overwrote real products
const OVERWRITTEN_UNSPLASH_IDS = [
  'photo-1618221195710-dd6b41faaea6',
  'photo-1505740420928-5e560c06d30e',
  'photo-1583847268964-b28dc8f51f92',
  'photo-1616486338812-3dadae4b4ace',
  'photo-1615873968403-89e068629265',
  'photo-1594620302200-9a762244a156',
  'photo-1616046229478-9901c5536a45',
  'photo-1513694203232-719a280e022f',
];

export function isOverwrittenGenericImage(url: string | undefined, _productId?: string): boolean {
  if (!url) return true;
  const trimmed = url.trim();
  return OVERWRITTEN_UNSPLASH_IDS.some((token) => trimmed.includes(token));
}

/**
 * Detects Alibaba/AliExpress/CDN bot-challenge or error graphics (such as the "hand unplugging power cord" tfs graphic)
 * so they can NEVER be displayed or saved in the catalog.
 */
export function isBlockedOrErrorProductImageUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return true;
  let decoded = rawUrl.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // ignore
  }
  const lower = decoded.toLowerCase();

  const badTokens = [
    '/tfs/',
    'imgextra',
    'tps-',
    'unplug',
    'punish',
    'captcha',
    'interception',
    'error',
    'access-denied',
    'placeholder',
    'lazyload',
    'assets.alicdn.com',
    'g.alicdn.com',
    'u.alicdn.com',
    'avatar',
    'sprite',
    '1x1',
    'favicon',
  ];
  for (const token of badTokens) {
    if (lower.includes(token)) return true;
  }

  // Genuine Alibaba / AliExpress product images ALWAYS contain `/kf/`
  if (lower.includes('alicdn.com') && !lower.includes('/kf/')) {
    return true;
  }

  return false;
}

/**
 * Resolves and sanitizes any product image URL:
 * 1. Keeps Admin-uploaded `data:image/...`, `blob:`, `/assets/...`, and `/uploads/product/...` intact.
 * 2. Blocks any Alibaba/CDN error/unplug illustrations (`isBlockedOrErrorProductImageUrl`).
 * 3. Rewrites `dokandari.com/public/uploads/product/...` directly to local `/uploads/product/...`.
 * 4. Preserves real product images from `alicdn.com/kf/`, `shajgoj`, `daraz`, Firebase Storage, etc.
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
  if (!url || url === 'undefined' || url === 'null') {
    return getFallbackProductImage(product, index);
  }

  // Keep Admin-uploaded base64 data: URLs, blob: URLs, and local static assets intact
  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('/assets/')) {
    return url;
  }

  // Keep local authentic product uploads (/uploads/product/... or /public/uploads/product/...) intact
  if (url.startsWith('/uploads/product/') || url.startsWith('/public/uploads/product/')) {
    return url.replace(/^\/public\/uploads\//, '/uploads/');
  }

  // Reject any error/unplug/tfs/captcha image immediately
  if (isBlockedOrErrorProductImageUrl(url)) {
    return getFallbackProductImage(product, index);
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

  if (url.startsWith('/uploads/product/') || url.startsWith('/public/uploads/product/')) {
    return url.replace(/^\/public\/uploads\//, '/uploads/');
  }

  if (isBlockedOrErrorProductImageUrl(url)) {
    return getFallbackProductImage(product, index);
  }

  // 2. Fix protocol-relative URLs
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  // 3. Rewrite Laravel `/public/uploads/product/...` URLs (from dokandari.com or wsrv.nl) to local `/uploads/product/...`
  if (url.includes('/public/uploads/product/') || url.includes('%2Fpublic%2Fuploads%2Fproduct%2F')) {
    try {
      const decoded = decodeURIComponent(url);
      const fname = decoded.split('/public/uploads/product/')[1]?.split(/[?&]/)[0];
      if (fname) {
        return `/uploads/product/${fname}`;
      }
    } catch {
      // ignore
    }
  }

  // 4. Relative WordPress paths `/wp-content/uploads/...` -> route to `buy.dokandari.com`
  if (url.startsWith('/wp-content/')) {
    url = `https://buy.dokandari.com${url}`;
  }

  const lower = url.toLowerCase();

  // 5. Rewrite `dokandari.com/wp-content/uploads/...` to local `/uploads/product/` if we have it, or `buy.dokandari.com`
  if (lower.includes('/wp-content/uploads/')) {
    if (lower.includes('gemini_generated_image_b9teg6b9teg6b9te')) {
      return '/uploads/product/heart-mirror-sticker.jpg';
    }
    if (lower.includes('gemini_generated_image_6tydck6tydck6tyd')) {
      return '/uploads/product/cat-led-bookshelf.jpg';
    }
    if (lower.includes('h2d83f5b4372f4cf69c8441815d239ae5j')) {
      return '/uploads/product/3d-butterfly-mirror.jpg';
    }
    if (lower.includes('hb38f48c0a8b7454ebad69790a214b4f5s')) {
      return '/uploads/product/round-vanity-mirror.jpg';
    }
    if (lower.includes('ha7e0aa8d05a44d73b82d68816420d174s')) {
      return '/uploads/product/flexible-mirror-sheet.jpg';
    }
    if (lower.includes('dear-hair-tonic-cleanser')) {
      return '/uploads/product/dear-hair-tonic.jpg';
    }
  }

  // 6. If any product was accidentally given the generic brown sofa or yellow headphone Unsplash photo,
  //    replace it immediately with the product's authentic image!
  if (isOverwrittenGenericImage(url, product?.id)) {
    return getFallbackProductImage(product, index);
  }

  // 7. Proxy hotlink-protected or HTTP external store CDNs (`alicdn.com`, `slatic.net`, `lazcdn.com`, `shajgoj`)
  //    through wsrv.nl global image proxy so CORS/hotlink/SSL issues never block real product photos on live domain
  if (
    url.startsWith('http://') ||
    lower.includes('alicdn.com') ||
    lower.includes('slatic.net') ||
    lower.includes('lazcdn.com') ||
    lower.includes('shajgoj.com')
  ) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=800&output=webp`;
  }

  if (!/^https?:\/\//i.test(url)) {
    return getFallbackProductImage(product, index);
  }

  return url;
}

/**
 * Universal `onError` handler for product `<img>` tags across the storefront and admin panel.
 * First attempts `wsrv.nl` CDN proxy if direct URL failed, then falls back to keyword-matched product image.
 */
export function handleProductImageError(
  e: { currentTarget: HTMLImageElement },
  product?: { id?: string; name?: string; titleEn?: string; category?: string },
  index = 0
): void {
  const imgEl = e.currentTarget;
  if (!imgEl) return;

  const currentSrc = imgEl.src || '';

  // Step 1: If direct image failed and hasn't tried wsrv.nl proxy yet, try wsrv.nl proxy first
  if (
    !imgEl.dataset.proxyTried &&
    currentSrc.startsWith('http') &&
    !currentSrc.includes('wsrv.nl') &&
    !currentSrc.includes('images.unsplash.com') &&
    !isBlockedOrErrorProductImageUrl(currentSrc)
  ) {
    imgEl.dataset.proxyTried = 'true';
    const rewritten = currentSrc.replace(
      /^(https?:\/\/)?(www\.)?dokandari\.com\/wp-content\//i,
      'https://buy.dokandari.com/wp-content/'
    );
    imgEl.src = `https://wsrv.nl/?url=${encodeURIComponent(rewritten)}&w=800&output=webp`;
    return;
  }

  // Step 2: Fallback to keyword-matched high-resolution product photo
  const fallback = getFallbackProductImage(product, index);
  imgEl.dataset.fallbackApplied = 'true';
  if (imgEl.src !== fallback) {
    imgEl.src = fallback;
  }
}

/**
 * Ensures every product has complete Bengali description, fabric/specification, features, and variants
 * so ProductDetailPage is always 100% rich and populated.
 */
export function enrichProductFields(p: Product): Product {
  const name = (p.name || 'প্রিমিয়াম কালেকশন').trim();
  const rawDesc = (p.description || '').trim();
  const description =
    rawDesc.length >= 25
      ? rawDesc
      : `${name} — Dokandari অফিশিয়াল স্টোরের ১০০% অরিজিনাল ও প্রিমিয়াম কোয়ালিটি পণ্য। আধুনিক ডিজাইন, দীর্ঘস্থায়ী ফিনিশিং এবং দৈনন্দিন ব্যবহারে সর্বোচ্চ মানের নিশ্চয়তা। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি এবং ডেলিভারি ম্যানের সামনে পার্সেল খুলে দেখে মূল্য পরিশোধের সুবিধা রয়েছে।`;

  const fabric =
    p.fabric && p.fabric.trim().length > 2
      ? p.fabric.trim()
      : p.category === 'beauty_personal_care'
      ? '১০০% অথেনটিক ও ডার্মাটোলজিক্যালি টেস্টেড ফর্মুলা'
      : p.category === 'gadgets_electronics' || p.category === 'mobile_accessories'
      ? 'প্রিমিয়াম গ্রেড এবিএস পলিমার ও স্মার্ট সার্কিট প্রোটেকশন'
      : p.category === 'fashion_clothing'
      ? '১০০% প্রিমিয়াম এক্সপোর্ট কোয়ালিটি কম্ফোর্ট ফেব্রিক'
      : '১০০% অরিজিনাল ইমপোর্টেড হাই-গ্রেড মেটেরিয়াল';

  const features =
    Array.isArray(p.features) && p.features.length >= 3
      ? p.features
      : [
          '১০০% অরিজিনাল ও বাছাইকৃত প্রিমিয়াম কোয়ালিটি পণ্য',
          'সারা বাংলাদেশে দ্রুততম হোম ডেলিভারি (ক্যাশ অন ডেলিভারি)',
          'ডেলিভারি রাইডারের সামনে পার্সেল খুলে যাচাই করে নেওয়ার সুবিধা',
          '৭ দিনের সহজ রিটার্ন ও ইনস্ট্যান্ট এক্সচেঞ্জ গ্যারান্টি',
        ];

  const colors =
    p.variants?.colors && p.variants.colors.length > 0
      ? p.variants.colors
      : ['অরিজিনাল কালার (Original Picture Color)'];

  const sizes =
    p.variants?.sizes && p.variants.sizes.length > 0
      ? p.variants.sizes
      : ['স্ট্যান্ডার্ড সাইজ (Standard Pack)'];

  const price = Number(p.price) || 990;
  const originalPrice =
    Number(p.originalPrice) && Number(p.originalPrice) > price
      ? Number(p.originalPrice)
      : Math.round(price * 1.25);

  return {
    ...p,
    name,
    price,
    originalPrice,
    description,
    fabric,
    features,
    variants: {
      colors,
      sizes,
    },
  };
}

function normalizeProductImages(p: Product): Product {
  const enriched = enrichProductFields(p);
  const nonEmptyRaw = Array.isArray(enriched.images)
    ? enriched.images.filter(
        (img) =>
          typeof img === 'string' &&
          img.trim().length > 0 &&
          !isBlockedOrErrorProductImageUrl(img)
      )
    : [];

  // Filter out accidentally overwritten generic Unsplash URLs if the product has real images or is not prod-1/prod-2
  const realImagesOnly = nonEmptyRaw.filter((img) => !isOverwrittenGenericImage(img, enriched.id));

  const baseList =
    realImagesOnly.length > 0
      ? realImagesOnly
      : nonEmptyRaw.length > 0
      ? nonEmptyRaw
      : [
          getFallbackProductImage(enriched, 0),
          getFallbackProductImage(enriched, 1),
          getFallbackProductImage(enriched, 2),
        ];

  const safeImages = baseList.map((img, idx) => resolveSafeProductImageUrl(img, enriched, idx));

  // Ensure at least 3 gallery images for ProductDetailPage thumbnails
  while (safeImages.length < 3) {
    safeImages.push(safeImages[0] || getFallbackProductImage(enriched, safeImages.length));
  }

  return {
    ...enriched,
    status: enriched.status === 'draft' ? 'draft' : 'published',
    images: safeImages,
  };
}

/**
 * Checks if a product has authentic non-placeholder images (e.g. data:image, buy.dokandari.com, alicdn/kf/, wsrv.nl, etc.)
 */
function hasAuthenticCustomImage(p?: Product): boolean {
  if (!p || !Array.isArray(p.images) || p.images.length === 0) return false;
  const first = (p.images[0] || '').trim();
  if (!first) return false;
  if (isBlockedOrErrorProductImageUrl(first)) return false;
  if (isOverwrittenGenericImage(first, p.id)) return false;
  if (
    first.startsWith('/uploads/product/') ||
    first.startsWith('/public/uploads/product/') ||
    first.startsWith('data:image/') ||
    first.includes('wsrv.nl') ||
    first.includes('alicdn.com/kf/') ||
    first.includes('firebasestorage')
  ) {
    return true;
  }
  return !first.includes('images.unsplash.com');
}

/**
 * Merges INITIAL_PRODUCTS + remote Firestore products + local Admin custom/edited products,
 * while removing any product IDs deleted by the Admin and preserving real product images.
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
      if (p && p.id && !deletedIds.has(p.id)) {
        map.set(p.id, normalizeProductImages(p));
      }
    }
  }

  // 3. Overlay local custom/edited products (prefer local if newer OR if local has real images while remote was overwritten)
  for (const [id, prod] of Object.entries(customMap)) {
    if (!deletedIds.has(id)) {
      const existing = map.get(id);
      const localHasReal = hasAuthenticCustomImage(prod);
      const remoteHasReal = hasAuthenticCustomImage(existing);
      if (
        !existing ||
        (prod.updatedAt || 0) >= (existing.updatedAt || 0) ||
        (localHasReal && !remoteHasReal)
      ) {
        map.set(id, normalizeProductImages(prod));
      }
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
  );
}

/**
 * Restores all real Dokandari catalog products (from INITIAL_PRODUCTS + buy.dokandari.com recovery),
 * clears any accidental deletion flags on initial products, heals any unplugged/broken images,
 * and syncs them to both localStorage and Firestore.
 */
export async function restoreAllRealCatalogProducts(): Promise<Product[]> {
  try {
    // 1. Remove INITIAL_PRODUCTS IDs from the deleted set so all real products come back
    const initialIds = new Set(INITIAL_PRODUCTS.map((p) => p.id));
    const deleted = getDeletedProductIds();
    for (const id of initialIds) {
      deleted.delete(id);
    }
    localStorage.setItem(LS_DELETED_PRODUCT_IDS_KEY, JSON.stringify(Array.from(deleted)));

    // 2. Clean any corrupted/unplugged images in customMap and merge INITIAL_PRODUCTS
    const customMap = getCustomPersistedProductsMap();
    for (const [id, prod] of Object.entries(customMap)) {
      customMap[id] = normalizeProductImages(prod);
    }
    for (const initProd of INITIAL_PRODUCTS) {
      if (!customMap[initProd.id]) {
        customMap[initProd.id] = normalizeProductImages(initProd);
      } else {
        customMap[initProd.id] = normalizeProductImages({
          ...initProd,
          ...customMap[initProd.id],
          status: 'published',
        });
      }
    }
    localStorage.setItem(LS_CUSTOM_PRODUCTS_KEY, JSON.stringify(customMap));

    // 3. Sync all restored real products to Firestore in parallel batches
    const allToSync = Object.values(customMap);
    await Promise.all(
      allToSync.map(async (prod) => {
        try {
          const payload = sanitizeForFirestore(ensureFirestoreSafeProductPayload(prod));
          await setDoc(doc(db, 'products', prod.id), payload, { merge: true });
        } catch {
          // ignore individual write warning
        }
      })
    );
  } catch (err) {
    console.warn('Restore real catalog products note:', err);
  }

  return mergeCatalogProducts();
}

/**
 * Ensures a product's JSON payload stays well under Firestore's 1MB document limit
 * so base64 `data:image/...` photos NEVER fail to save to Firestore.
 */
function ensureFirestoreSafeProductPayload(product: Product): Product {
  const clone = { ...product, images: [...(product.images || [])] };
  let serialized = JSON.stringify(clone);
  if (serialized.length <= 750000) {
    return clone;
  }

  // If multiple large base64 images push the document over 750KB, keep the primary image + up to 2 compact images
  if (clone.images.length > 2) {
    clone.images = clone.images.slice(0, 2);
    serialized = JSON.stringify(clone);
  }
  if (serialized.length > 850000 && clone.images.length > 1) {
    clone.images = [clone.images[0]];
  }
  return clone;
}

/**
 * Persists a newly created or edited product to localStorage AND Firestore immediately
 */
export async function saveProductPersisted(product: Product): Promise<Product> {
  const now = Date.now();
  const cleanedProduct = normalizeProductImages(product);

  const normalized: Product = sanitizeForFirestore({
    ...cleanedProduct,
    id: cleanedProduct.id || `prod-${now}`,
    name: (cleanedProduct.name || 'নতুন প্রোডাক্ট').trim(),
    price: Number(cleanedProduct.price) || 0,
    originalPrice:
      Number(cleanedProduct.originalPrice) ||
      Math.round((Number(cleanedProduct.price) || 0) * 1.25),
    category: cleanedProduct.category || 'home_decor',
    description: cleanedProduct.description || cleanedProduct.name || '',
    features: Array.isArray(cleanedProduct.features) ? cleanedProduct.features : [],
    images: cleanedProduct.images,
    videos: Array.isArray(cleanedProduct.videos) ? cleanedProduct.videos : [],
    variants: {
      colors: cleanedProduct.variants?.colors?.length
        ? cleanedProduct.variants.colors
        : ['Standard Color'],
      sizes: cleanedProduct.variants?.sizes?.length
        ? cleanedProduct.variants.sizes
        : ['Standard Size'],
    },
    inStock: cleanedProduct.inStock !== false,
    rating: Number(cleanedProduct.rating) || 4.9,
    reviewCount: Number(cleanedProduct.reviewCount) || 18,
    status: cleanedProduct.status || 'published',
    createdAt: cleanedProduct.createdAt || now,
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

  // 2. Save to Firestore (guarded for 1MB limit)
  try {
    const firestoreSafe = sanitizeForFirestore(ensureFirestoreSafeProductPayload(normalized));
    await setDoc(doc(db, 'products', normalized.id), firestoreSafe, { merge: true });
  } catch (err) {
    console.warn('Firestore product save warning (saved locally):', err);
  }

  return normalized;
}

/**
 * Explicitly syncs all local/Preview products and store settings to Live Firestore
 * and recovers original images from `buy.dokandari.com` / `sourceUrl` if any were overwritten.
 */
export async function syncAllLocalProductsToFirestore(): Promise<{
  syncedCount: number;
  recoveredCount: number;
}> {
  let syncedCount = 0;
  let recoveredCount = 0;
  const deletedIds = getDeletedProductIds();
  const customMap = getCustomPersistedProductsMap();

  try {
    // 1. Push all local custom products to Firestore
    for (const [id, customProd] of Object.entries(customMap)) {
      if (deletedIds.has(id)) continue;
      const cleanCustom = sanitizeForFirestore(
        ensureFirestoreSafeProductPayload(normalizeProductImages(customProd))
      );
      await setDoc(doc(db, 'products', id), cleanCustom, { merge: true });
      syncedCount++;
    }

    // 2. Ask server to recover any original images from buy.dokandari.com / sourceUrl for Firestore products
    const snap = await getDocs(collection(db, 'products'));
    const candidatesForRecovery: { id: string; name: string; titleEn?: string; sourceUrl?: string }[] = [];

    for (const docSnap of snap.docs) {
      const p = docSnap.data() as Product & { sourceUrl?: string };
      if (deletedIds.has(p.id)) continue;
      const localProd = customMap[p.id];
      if (localProd && hasAuthenticCustomImage(localProd)) {
        const cleanLocal = sanitizeForFirestore(
          ensureFirestoreSafeProductPayload(normalizeProductImages(localProd))
        );
        await setDoc(doc(db, 'products', p.id), cleanLocal, { merge: true });
        recoveredCount++;
        continue;
      }

      const firstImg = p.images?.[0] || '';
      if (
        isOverwrittenGenericImage(firstImg, p.id) ||
        firstImg.includes('images.unsplash.com')
      ) {
        candidatesForRecovery.push({
          id: p.id,
          name: p.name,
          titleEn: p.titleEn,
          sourceUrl: p.sourceUrl,
        });
      }
    }

    if (candidatesForRecovery.length > 0) {
      try {
        const res = await fetch('/api/catalog/recover-real-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: candidatesForRecovery }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.recovered && typeof data.recovered === 'object') {
            for (const [prodId, realUrls] of Object.entries(data.recovered as Record<string, string[]>)) {
              if (Array.isArray(realUrls) && realUrls.length > 0) {
                const proxiedUrls = realUrls.map((u) =>
                  u.startsWith('data:')
                    ? u
                    : `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=800&output=webp`
                );
                await setDoc(
                  doc(db, 'products', prodId),
                  { images: proxiedUrls, updatedAt: Date.now() },
                  { merge: true }
                );
                if (customMap[prodId]) {
                  customMap[prodId] = { ...customMap[prodId], images: proxiedUrls, updatedAt: Date.now() };
                }
                recoveredCount++;
              }
            }
            localStorage.setItem(LS_CUSTOM_PRODUCTS_KEY, JSON.stringify(customMap));
          }
        }
      } catch {
        // ignore recovery network note
      }
    }

    // 3. Sync StoreContent (including normalized Bengali Savar addresses) to Firestore
    const currentContent = getInitialStoreContent();
    await saveStoreContentPersisted(currentContent);
  } catch (err) {
    console.warn('Full catalog Firestore sync note:', err);
  }

  return { syncedCount, recoveredCount };
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
 * Persists a customer Order to both localStorage (instant backup) and Firestore `orders` collection
 */
export async function saveOrderPersisted(order: Order): Promise<Order> {
  const cleanOrder = sanitizeForFirestore(order);

  // 1. Save to localStorage backup so customer & admin never lose an order
  try {
    const existingRaw = localStorage.getItem(LS_ORDERS_BACKUP_KEY);
    const list: Order[] = existingRaw ? JSON.parse(existingRaw) : [];
    const filtered = Array.isArray(list) ? list.filter((o) => o && o.id !== cleanOrder.id) : [];
    filtered.unshift(cleanOrder);
    localStorage.setItem(LS_ORDERS_BACKUP_KEY, JSON.stringify(filtered.slice(0, 200)));
  } catch (e) {
    console.warn('localStorage order backup note:', e);
  }

  // 2. Save to Firestore `orders` collection
  try {
    await setDoc(doc(db, 'orders', cleanOrder.id), cleanOrder, { merge: true });
  } catch (err) {
    console.warn('Firestore order save note (saved in local backup):', err);
  }

  return cleanOrder;
}

/**
 * Retrieves locally backed up orders to merge with Firestore live orders
 */
export function getPersistedOrders(): Order[] {
  try {
    const raw = localStorage.getItem(LS_ORDERS_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Compresses an uploaded image File into a lightweight JPEG DataURL (<140KB)
 * so multiple uploaded photos per product never exceed Firestore's 1MB document limit.
 */
export function compressImageFileToDataUrl(
  file: File,
  maxWidth = 680,
  quality = 0.72
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
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // If still large (>160KB base64), compress slightly more so Firestore 1MB limit is never exceeded
        if (dataUrl.length > 160000) {
          const smallerW = Math.min(width, 520);
          const smallerH = Math.round((height * smallerW) / width);
          canvas.width = smallerW;
          canvas.height = smallerH;
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            ctx2.drawImage(img, 0, 0, smallerW, smallerH);
            dataUrl = canvas.toDataURL('image/jpeg', 0.58);
          }
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Ensures initial catalog is seeded in Firestore if not already present,
 * restores any real custom images from Preview `localStorage` or `buy.dokandari.com`,
 * and migrates legacy addresses in `settings/store_content`.
 */
export async function seedProductsIfEmpty(): Promise<void> {
  try {
    const deletedIds = getDeletedProductIds();
    const customMap = getCustomPersistedProductsMap();
    const productsCol = collection(db, 'products');
    const snap = await getDocs(productsCol);
    const existingIds = new Set<string>();
    const recoveryCandidates: { id: string; name: string; titleEn?: string; sourceUrl?: string }[] = [];

    // 1. Inspect existing Firestore docs: if local customMap has real images while Firestore was overwritten, restore local!
    for (const docSnap of snap.docs) {
      const id = docSnap.id;
      existingIds.add(id);
      if (deletedIds.has(id)) continue;

      const data = docSnap.data() as Product & { sourceUrl?: string };
      const localProd = customMap[id];

      if (localProd && hasAuthenticCustomImage(localProd) && !hasAuthenticCustomImage(data)) {
        const restored = sanitizeForFirestore(
          ensureFirestoreSafeProductPayload(normalizeProductImages(localProd))
        );
        try {
          await setDoc(doc(db, 'products', id), restored, { merge: true });
        } catch {
          // ignore
        }
        continue;
      }

      if (isOverwrittenGenericImage(data.images?.[0], id)) {
        recoveryCandidates.push({
          id,
          name: data.name,
          titleEn: data.titleEn,
          sourceUrl: data.sourceUrl,
        });
      }

      const healed = normalizeProductImages(data);
      const origImagesJson = JSON.stringify(data.images || []);
      const healedImagesJson = JSON.stringify(healed.images || []);

      if (origImagesJson !== healedImagesJson || !data.status || !data.description || !data.fabric) {
        try {
          await setDoc(
            doc(db, 'products', id),
            sanitizeForFirestore(ensureFirestoreSafeProductPayload(healed)),
            { merge: true }
          );
        } catch {
          // ignore individual doc heal warning
        }
      }
    }

    // 2. Seed missing items from initial catalog ONLY if not deleted by Admin
    for (const prod of INITIAL_PRODUCTS) {
      if (!existingIds.has(prod.id) && !deletedIds.has(prod.id)) {
        const cleanProd = sanitizeForFirestore(
          ensureFirestoreSafeProductPayload(normalizeProductImages(customMap[prod.id] || prod))
        );
        await setDoc(doc(db, 'products', prod.id), cleanProd, { merge: true });
      }
    }

    // 3. Push any locally created/edited custom products to Firestore
    for (const [id, customProd] of Object.entries(customMap)) {
      if (deletedIds.has(id)) continue;
      if (!existingIds.has(id) || hasAuthenticCustomImage(customProd)) {
        const cleanCustom = sanitizeForFirestore(
          ensureFirestoreSafeProductPayload(normalizeProductImages(customProd))
        );
        await setDoc(doc(db, 'products', id), cleanCustom, { merge: true });
      }
    }

    // 4. If any products had overwritten generic images, recover their real images from buy.dokandari.com / sourceUrl
    if (recoveryCandidates.length > 0) {
      try {
        const res = await fetch('/api/catalog/recover-real-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: recoveryCandidates }),
        });
        if (res.ok) {
          const recData = await res.json();
          if (recData?.recovered && typeof recData.recovered === 'object') {
            for (const [prodId, realUrls] of Object.entries(recData.recovered as Record<string, string[]>)) {
              if (Array.isArray(realUrls) && realUrls.length > 0) {
                const proxied = realUrls.map((u) =>
                  u.startsWith('data:')
                    ? u
                    : `https://wsrv.nl/?url=${encodeURIComponent(u)}&w=800&output=webp`
                );
                await setDoc(doc(db, 'products', prodId), { images: proxied }, { merge: true });
              }
            }
          }
        }
      } catch {
        // ignore background recovery note
      }
    }

    // 5. Ensure store_content exists and legacy addresses are normalized to official Bengali Savar addresses
    const contentRef = doc(db, 'settings', 'store_content');
    const contentSnap = await getDoc(contentRef);
    if (!contentSnap.exists()) {
      const initialContent = getInitialStoreContent();
      await setDoc(contentRef, sanitizeForFirestore(initialContent));
    } else {
      const existingData = contentSnap.data() as Partial<StoreContent>;
      const normalizedContent = mergeStoreContent(DEFAULT_STORE_CONTENT, existingData);
      if (
        existingData.pageContent?.warehouseAddress !== normalizedContent.pageContent?.warehouseAddress ||
        existingData.pageContent?.corporateAddress !== normalizedContent.pageContent?.corporateAddress
      ) {
        await setDoc(contentRef, sanitizeForFirestore(normalizedContent), { merge: true });
      }
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

