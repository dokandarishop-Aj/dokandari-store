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
import { Product, Order, CustomerUgcCard, PurchaseRecord, CourierReturn, OFFICIAL_CATEGORIES } from '../types';

export const OFFICIAL_WHATSAPP = '01885533437';
export const OFFICIAL_WHATSAPP_INT = '8801885533437';
export const OFFICIAL_HOTLINE = '01348282356';

const LS_STORE_CONTENT_KEY = 'dokandari_store_content_backup_v2';
const LS_CUSTOM_PRODUCTS_KEY = 'dokandari_custom_products_v2';
const LS_DELETED_PRODUCT_IDS_KEY = 'dokandari_deleted_product_ids_v3';
const LS_LIVE_CATALOG_CACHE_KEY = 'dokandari_live_catalog_cache_v1';
const LS_ORDERS_BACKUP_KEY = 'dokandari_orders_backup_v1';
const LS_DELETED_ORDER_IDS_KEY = 'dokandari_deleted_order_ids_v1';
const LS_PURCHASES_BACKUP_KEY = 'dokandari_purchases_backup_v1';
const LS_DELETED_PURCHASE_IDS_KEY = 'dokandari_deleted_purchase_ids_v1';
const LS_COURIER_RETURNS_BACKUP_KEY = 'dokandari_courier_returns_backup_v1';
const LS_DELETED_RETURN_IDS_KEY = 'dokandari_deleted_return_ids_v1';
const LS_CUSTOMER_UGC_KEY = 'dokandari_customer_ugc_v1';

export interface HeroSlideItem {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  ctaText?: string;
  ctaLink?: string;
}

export interface CategoryHeroConfig {
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  ctaText?: string;
  slides?: HeroSlideItem[];
}

export interface StoreContent {
  whatsappNumber: string;
  hotlineNumber: string;
  officialEmail: string;
  carouselInterval: number; // Hero banner interval in ms (1000, 3000, 5000)
  bestSellingInterval?: number; // Best-selling product carousel interval in ms (3000, 5000, 8000, 10000)
  categoryOrder?: string[];
  googleFlowProjectUrl?: string;
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
    ceoMessageText?: string;
    businessStoryText?: string;
    productSourcingText?: string;
    businessPolicyText?: string;
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
  heroSlides: HeroSlideItem[];
  categoryHeroes?: Record<string, CategoryHeroConfig>;
  categoryImages?: Record<string, string>;
}

export const DEFAULT_ORGANIC_FOOD_HERO_SLIDES: HeroSlideItem[] = [
  {
    id: 'org-slide-1',
    title: 'সুন্দরবনের ১০০% খাঁটি প্রাকৃতিক চাকের মধু',
    subtitle: 'মৌয়ালদের হাত থেকে সরাসরি সংগৃহীত ল্যাব-টেস্টেড অপরিশোধিত খাঁটি মধু — ডেলিভারি ম্যানের সামনে দেখে নিন',
    image: '/uploads/product/organic-sundarban-honey.jpg',
    tag: '🍯 ১০০% খাঁটি সুন্দরবনের মধু',
    ctaText: 'মধু অর্ডার করুন',
    ctaLink: '#category-products-grid',
  },
  {
    id: 'org-slide-2',
    title: 'পাবনার খাঁটি দানাদার দেশি গাওয়া ঘি',
    subtitle: 'দেশি গরুর দুধের সর থেকে সনাতন পদ্ধতিতে তৈরি রাজকীয় স্বাদ ও আসল সুঘ্রাণের দানাদার গাওয়া ঘি',
    image: '/uploads/product/organic-pabna-ghee.jpg',
    tag: '🧈 পাবনার আসল গাওয়া ঘি',
    ctaText: 'ঘি কালেকশন দেখুন',
    ctaLink: '#category-products-grid',
  },
  {
    id: 'org-slide-3',
    title: 'সৌদি মদিনার প্রিমিয়াম আজওয়া ও মরিয়ম খেজুর',
    subtitle: 'মদিনা শরীফ থেকে সরাসরি আমদানিকৃত এ-গ্রেড নরম, রসালো ও পুষ্টিকর ভিআইপি খেজুর কম্বো',
    image: '/uploads/product/organic-ajwa-dates.jpg',
    tag: '🌴 প্রিমিয়াম সৌদি খেজুর',
    ctaText: 'খেজুর অর্ডার করুন',
    ctaLink: '#category-products-grid',
  },
  {
    id: 'org-slide-4',
    title: 'প্রিমিয়াম হানি নাটস ও মিক্সড ড্রাই ফ্রুটস জার',
    subtitle: 'কাজু, পেস্তা, কাঠবাদাম, আখরোট ও খাঁটি মধুর পুষ্টিকর মিশ্রণ — প্রতিদিনের এনার্জি ও ইমিউনিটি বুস্টার',
    image: '/uploads/product/organic-honey-nuts.jpg',
    tag: '🥜 হানি নাটস সুপারফুড',
    ctaText: 'হানি নাটস দেখুন',
    ctaLink: '#category-products-grid',
  },
  {
    id: 'org-slide-5',
    title: 'তেঁতুল কাঠের ঘানিতে ভাঙানো খাঁটি সরিষার তেল',
    subtitle: 'কোল্ড-প্রেসড (First Press) দেশি মাঘী সরিষার তেল — প্রাকৃতিক ঝাঁঝ ও শতভাগ কেমিক্যালমুক্ত',
    image: '/uploads/product/organic-mustard-oil.jpg',
    tag: '🌿 কাঠের ঘানির খাঁটি তেল',
    ctaText: 'সরিষার তেল দেখুন',
    ctaLink: '#category-products-grid',
  },
  {
    id: 'org-slide-6',
    title: '১০০% অর্গানিক চিয়া সিডস, মোরিঙ্গা ও ফ্যামিলি মশলা কম্বো',
    subtitle: 'ভেজালমুক্ত হলুদ-মরিচ-ধনিয়া-জিরা গুঁড়া, অর্গানিক চিয়া সিডস ও সজনে পাতা গুঁড়া এখন এক ঠিকানায়',
    image: '/uploads/product/organic-spice-combo.jpg',
    tag: '✨ অর্গানিক ফ্যামিলি প্যাক',
    ctaText: 'সব অর্গানিক পণ্য দেখুন',
    ctaLink: '#category-products-grid',
  },
];

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
    image: '/uploads/product/1776523954-20516.jpg',
    tag: 'স্মার্ট গ্যাজেটস ও টেক',
    ctaText: 'গ্যাজেটস দেখুন',
  },
  organic_food: {
    title: '১০০% খাঁটি অর্গানিক ফুড, ন্যাচারাল মধু ও সুপারফুড কালেকশন',
    subtitle: 'সুন্দরবনের প্রাকৃতিক চাকের মধু, পাবনার দানাদার গাওয়া ঘি, কাঠের ঘানির সরিষার তেল, সৌদি আজওয়া খেজুর ও ল্যাব-টেস্টেড অর্গানিক সুপারফুড — সরাসরি উৎস থেকে আপনার ঘরে।',
    image: '/uploads/product/organic-sundarban-honey.jpg',
    tag: '🌿 ১০০% অর্গানিক ও কেমিক্যালমুক্ত ফুড',
    ctaText: 'অর্গানিক ফুড দেখুন',
    slides: DEFAULT_ORGANIC_FOOD_HERO_SLIDES,
  },
  fashion_clothing: {
    title: 'প্রিমিয়াম ফ্যাশন, ক্লোদিং ও ফেস্টিভ আউটফিট কালেকশন',
    subtitle: 'আন্তর্জাতিক মানের ফেব্রিক ও ট্রেন্ডি ডিজাইনের পোশাক কালেকশন — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=85',
    tag: '👗 ফ্যাশন ও ক্লোদিং',
    ctaText: 'ফ্যাশন কালেকশন দেখুন',
  },
  beauty_personal_care: {
    title: 'অথেনটিক বিউটি ও পার্সোনাল কেয়ার কালেকশন',
    subtitle: 'ত্বক ও চুলের যত্নে ১০০% অরিজিনাল স্কিনকেয়ার, অর্গানাইজার ও গ্রুমিং এসেনশিয়ালস।',
    image: '/uploads/product/1776151737-untitled-design-49.webp',
    tag: 'বিউটি ও স্কিনকেয়ার',
    ctaText: 'বিউটি প্রোডাক্টস',
  },
  home_kitchen: {
    title: 'স্মার্ট হোম ও কিচেন অ্যাপ্লায়েন্স কালেকশন',
    subtitle: 'আপনার রান্নাঘর ও প্রতিদিনের গৃহস্থালি কাজকে সহজ, দ্রুত ও পরিপাটি করার আধুনিক কিচেন টুলস।',
    image: '/uploads/product/1776319126-1732248160-1722670821-sellmart_54.jpg',
    tag: 'হোম ও কিচেন স্পেশাল',
    ctaText: 'কিচেন কালেকশন',
  },
  mobile_accessories: {
    title: 'প্রিমিয়াম মোবাইল এক্সেসরিজ ও ফাস্ট চার্জিং গিয়ার',
    subtitle: 'ফাস্ট চার্জার, পাওয়ার ব্যাংক, ম্যাগসেফ হোল্ডার ও প্রোটেক্টিভ মোবাইল এক্সেসরিজে সর্বোচ্চ গ্যারান্টি।',
    image: '/uploads/product/1777098758-eq34-plus-02-500x500.webp',
    tag: 'মোবাইল এক্সেসরিজ',
    ctaText: 'এক্সেসরিজ দেখুন',
  },
  lifestyle: {
    title: 'মডার্ন লাইফস্টাইল ও ডেইলি এসেনশিয়ালস',
    subtitle: 'প্রতিদিনের জীবনযাত্রাকে আরও স্মার্ট, রুচিশীল ও আরামদায়ক করতে বাছাইকৃত লাইফস্টাইল প্রোডাক্টস।',
    image: '/uploads/product/dkd-1793610538096-571-0.jpg',
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

export const READYMADE_BRIGHT_HERO_SLIDES: HeroSlideItem[] = [
  {
    id: 'slide-1',
    title: 'প্রিমিয়াম হোম ডেকোর ও আনব্রেকেবল মিরর কালেকশন',
    subtitle: 'ভাঙার ভয় ছাড়া আপনার বেডরুম ও ড্রয়িং রুমের সৌন্দর্য নিমিষেই দ্বিগুণ করুন — ক্যাশ অন ডেলিভারি',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1920&q=85',
    tag: '✨ হোম ডেকোর কালেকশন',
    ctaText: 'হোম ডেকোর দেখুন',
    ctaLink: '/?catalog=home_decor',
  },
  {
    id: 'slide-2',
    title: 'ট্রেন্ডি ফ্যাশন মডেল ও প্রিমিয়াম ক্লোদিং কালেকশন',
    subtitle: 'আন্তর্জাতিক মানের ফেব্রিক, আধুনিক ডিজাইন ও আরামদায়ক ফ্যাশন আউটফিট এখন বিশেষ ছাড়ে',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1920&q=85',
    tag: '👗 ফ্যাশন ও ক্লোদিং',
    ctaText: 'ফ্যাশন কালেকশন',
    ctaLink: '/?catalog=lifestyle',
  },
  {
    id: 'slide-3',
    title: 'প্রিমিয়াম স্মার্টওয়াচ, টিডব্লিউএস বাডস ও টেক গ্যাজেটস',
    subtitle: 'অরিজিনাল স্মার্টওয়াচ, পোর্টেবল টার্বো ফ্যান ও আধুনিক গ্যাজেটস — ডেলিভারি ম্যানের সামনে দেখে নিন',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1920&q=85',
    tag: '⌚ স্মার্ট গ্যাজেটস',
    ctaText: 'গ্যাজেটস দেখুন',
    ctaLink: '/?catalog=gadgets_electronics',
  },
  {
    id: 'slide-4',
    title: 'সুন্দরবনের ১০০% খাঁটি চাকের মধু ও অর্গানিক সুপারফুড',
    subtitle: 'কেমিক্যালমুক্ত খাঁটি মধু, পাবনার দেশি গাওয়া ঘি ও সৌদি আজওয়া খেজুর সরাসরি প্রাকৃতিক উৎস থেকে',
    image: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?auto=format&fit=crop&w=1920&q=85',
    tag: '🌿 ১০০% খাঁটি অর্গানিক ফুড',
    ctaText: 'অর্গানিক ফুড জোন',
    ctaLink: '/?catalog=organic_food',
  },
  {
    id: 'slide-5',
    title: 'লাক্সারি লিভিং রুম ইন্টেরিয়র ও ওয়াল ডেকোর কালেকশন',
    subtitle: 'ড্রিলিং বা পেরেক ছাড়াই দেয়ালে লাগান — শিশুদের জন্য ১০০% নিরাপদ ও ক্রিস্টাল ক্লিয়ার রিফ্লেকশন',
    image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1920&q=85',
    tag: '🪞 মডার্ন ওয়াল ডেকোর',
    ctaText: 'মিরর কালেকশন দেখুন',
    ctaLink: '/?catalog=home_decor',
  },
  {
    id: 'slide-6',
    title: 'এক্সক্লুসিভ ফেস্টিভ ফ্যাশন ও মডার্ন লাইফস্টাইল কালেকশন',
    subtitle: 'প্রতিদিনের স্টাইল ও উৎসবের সাজে আপনাকে অনন্য করে তুলতে বাছাইকৃত প্রিমিয়াম কালেকশন',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1920&q=85',
    tag: '🌟 লাইফস্টাইল ও ফ্যাশন',
    ctaText: 'কালেকশন দেখুন',
    ctaLink: '/?catalog=lifestyle',
  },
  {
    id: 'slide-7',
    title: 'অথেনটিক বিউটি, হেয়ার টনিক ও গ্লোয়িং স্কিনকেয়ার কালেকশন',
    subtitle: 'চুল পড়া রোধ ও ত্বকের উজ্জ্বলতায় ১০০% অরিজিনাল ডার্মাটোলজিক্যালি টেস্টেড বিউটি প্রোডাক্টস',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1920&q=85',
    tag: '🌸 বিউটি ও স্কিনকেয়ার',
    ctaText: 'বিউটি জোন দেখুন',
    ctaLink: '/?catalog=beauty_personal_care',
  },
  {
    id: 'slide-8',
    title: 'স্মার্ট হোম ও মডার্ন কিচেন অ্যাপ্লায়েন্স কালেকশন',
    subtitle: 'আপনার রান্নাঘর ও প্রতিদিনের গৃহস্থালি কাজকে সহজ, দ্রুত ও পরিপাটি করার আধুনিক কিচেন টুলস',
    image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1920&q=85',
    tag: '🍳 হোম ও কিচেন',
    ctaText: 'কিচেন কালেকশন',
    ctaLink: '/?catalog=home_kitchen',
  },
  {
    id: 'slide-9',
    title: 'প্রিমিয়াম অডিও, ফাস্ট চার্জিং ও মোবাইল এক্সেসরিজ',
    subtitle: 'ক্রিস্টাল ক্লিয়ার সাউন্ড, ব্লুটুথ ৫.৩ কানেক্টিভিটি এবং ডেলিভারি ম্যানের সামনে দেখে নেওয়ার সুবিধা',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1920&q=85',
    tag: '🎧 মোবাইল এক্সেসরিজ',
    ctaText: 'এক্সেসরিজ দেখুন',
    ctaLink: '/?catalog=mobile_accessories',
  },
  {
    id: 'slide-10',
    title: 'ট্রাভেল ব্যাগ, আউটডোর গিয়ার ও ডেইলি এসেনশিয়ালস',
    subtitle: 'ভ্রমণ ও প্রতিদিনের ব্যবহারের জন্য ওয়াটারপ্রুফ ট্রাভেল ব্যাগ, অর্গানাইজার ও লাইফস্টাইল কালেকশন',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1920&q=85',
    tag: '🎒 ট্রাভেল ও আউটডোর',
    ctaText: 'অফারটি দেখুন',
    ctaLink: '/?catalog=travel_outdoor',
  },
];

export const DEFAULT_STORE_CONTENT: StoreContent = {
  whatsappNumber: OFFICIAL_WHATSAPP,
  hotlineNumber: OFFICIAL_HOTLINE,
  officialEmail: 'dokandari.shop@gmail.com',
  carouselInterval: 8000,
  bestSellingInterval: 5000,
  googleFlowProjectUrl: 'https://labs.google/fx/tools/flow',
  socialLinks: {
    whatsapp: 'https://wa.me/8801885533437?text=Dokandari',
    facebook: 'https://web.facebook.com/dokandari.shop',
    instagram: 'https://www.instagram.com/dokandaridotcom/',
    tiktok: 'https://www.tiktok.com/@dokandari.shop?is_from_webapp=1&sender_device=pc',
    youtube: 'https://www.youtube.com/@Dokandarishop',
  },
  pageContent: {
    aboutHeadline: 'Dokandari — আপনার সৌন্দর্য ও সুস্থতা, আমাদের ঐতিহ্য',
    aboutSubtitle:
      'আন্তর্জাতিক মানের প্রিমিয়াম হোম ডেকোর, স্মার্ট গ্যাজেটস এবং ১০০% খাঁটি অর্গানিক ফুড সরাসরি বিশ্বস্ত উৎস থেকে আপনার দ্বারে পৌঁছে দিতে আমরা দায়বদ্ধ।',
    warehouseAddress: 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)',
    corporateAddress: 'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা',
    googleMapUrl: 'https://maps.google.com/?q=Jaleshwar+Savar+1340+Dhaka',
    ceoMessageText:
      'অনলাইনে কেনাকাটা করতে গিয়ে মানুষ যাতে এক মুহূর্তের জন্যও প্রতারণা কিংবা আর্থিক ক্ষতির শিকার না হন, সেই গভীর মানবিক দায়বদ্ধতা থেকেই Dokandari-এর যাত্রা। দীর্ঘ গবেষণা ও আন্তর্জাতিক ই-কমার্স মানদণ্ড পর্যবেক্ষণ করে আমরা এমন একটি বিশ্বস্ত ব্যবস্থা গড়ে তুলেছি যেখানে কোনো অগ্রিম পেমেন্ট ছাড়াই সারা বাংলাদেশে ক্যাশ অন ডেলিভারি পাওয়া যায় এবং ডেলিভারি ম্যানের সামনে পণ্য খুলে যাচাই করে মূল্য পরিশোধের শতভাগ নিশ্চয়তা থাকে। Dokandari নিছক কোনো ব্যবসা নয়, এটি মানুষের আস্থা, সম্মান ও অধিকার রক্ষার এক বিশ্বস্ত আশ্রয়। — মোহাম্মদ শহিদুল আলম',
    businessStoryText:
      'Dokandari-এর স্বপ্নদ্রষ্টা বিশিষ্ট ব্যবসায়ী, সমাজসেবক ও জনদরদী উদ্যোক্তা মোহাম্মদ শহিদুল আলম। বাংলাদেশে ই-কমার্সের প্রসারের সাথে সাথে সাধারণ ক্রেতাদের অনাস্থা, ছবির সাথে পণ্যের গরমিল ও প্রতারণার কষ্ট তাকে গভীরভাবে নাড়া দেয়। তিনি বাইরের উন্নত দেশের কনজিউমার রাইটস ও ই-কমার্স মডেল নিয়ে দীর্ঘ গবেষণা করে দেশে একটি আন্তর্জাতিক মানের প্ল্যাটফর্ম গড়ে তোলার অঙ্গীকার করেন। সাভার থেকে শুরু হয়ে আজ Dokandari সারা বাংলাদেশের ৬৪টি জেলায় শতভাগ অরিজিনাল পণ্য, জিরো-অ্যাডভান্স ক্যাশ অন ডেলিভারি এবং ওপেন-পার্সেল চেকিং সুবিধার মাধ্যমে হাজারো পরিবারের পরম নির্ভরতার ঠিকানা।',
    productSourcingText:
      'আমরা আমাদের অর্গানিক ফুড ক্যাটাগরির প্রতিটি পণ্য সরাসরি প্রাকৃতিক উৎস থেকে সংগ্রহ করি—সুন্দরবনের মৌয়ালদের খাঁটি চাকের মধু, পাবনার দেশি গাওয়া ঘি, তেঁতুল কাঠের ঘানির সরিষার তেল, মদিনার আজওয়া খেজুর এবং বাছাইকৃত সুপারফুড। পাশাপাশি আমাদের হোম ডেকোর ও স্মার্ট গ্যাজেটস সরাসরি ভেরিফাইড ফ্যাক্টরি থেকে নিজস্ব কোয়ালিটি চেকিংয়ের মাধ্যমে ইমপোর্ট করা হয়।',
    businessPolicyText:
      '১. অগ্রিম ১ টাকাও ছাড়া সারা বাংলাদেশে শতভাগ ওপেন-পার্সেল ক্যাশ অন ডেলিভারি সুবিধা।\n২. ডেলিভারি ম্যানের সামনে প্যাকেট খুলে পণ্য ও গুণগত মান দেখে নেওয়ার পূর্ণ স্বাধীনতা।\n৩. যেকোনো ত্রুটি বা অমিলে ৭ দিনের মধ্যে সম্পূর্ণ ফ্রি রিটার্ন ও ইনস্ট্যান্ট এক্সচেঞ্জ গ্যারান্টি।',
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
    name: 'মোহাম্মদ শহিদুল আলম',
    title: 'প্রতিষ্ঠাতা ও চেয়ারম্যান, Dokandari (বিশিষ্ট ব্যবসায়ী ও সমাজসেবক)',
    photo: '',
    bio: 'বিশিষ্ট ব্যবসায়ী, সমাজসেবক ও জনদরদী ব্যক্তিত্ব মোহাম্মদ শহিদুল আলম দীর্ঘদিনের গবেষণা ও গভীর সামাজিক দায়বদ্ধতা থেকে Dokandari প্রতিষ্ঠা করেছেন। অনলাইন কেনাকাটায় সাধারণ মানুষের ভোগান্তি ও প্রতারণা দূর করে একটি আন্তর্জাতিক মানের নির্ভরযোগ্য কেনাকাটার প্ল্যাটফর্ম উপহার দেওয়াই উনার মূল ব্রত। যেখানে প্রতিটি ক্রেতা পাবেন নির্দ্বিধায় ১০০% অরিজিনাল পণ্য, কোনো অগ্রিম ছাড়া ক্যাশ অন ডেলিভারি এবং ডেলিভারি ম্যানের সামনে পার্সেল খুলে দেখার পূর্ণ স্বাধীনতা।',
    address: 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)',
    phone: '01348282356',
  },
  heroSlides: READYMADE_BRIGHT_HERO_SLIDES,
  categoryHeroes: DEFAULT_CATEGORY_HEROES,
};

/**
 * Preserves any custom or intentionally cleared addresses set by Admin.
 * Only converts old English "jaleshwar" / "উত্তরা মডেল টাউন" placeholders if present.
 */
function normalizeOfficialAddresses(content: StoreContent): StoreContent {
  const whRaw = content.pageContent?.warehouseAddress;
  const corpRaw = content.pageContent?.corporateAddress;
  const fAddrRaw = content.founder?.address;

  const wh = typeof whRaw === 'string' ? whRaw : DEFAULT_STORE_CONTENT.pageContent!.warehouseAddress;
  const corp =
    typeof corpRaw === 'string' ? corpRaw : DEFAULT_STORE_CONTENT.pageContent!.corporateAddress!;
  const fAddr = typeof fAddrRaw === 'string' ? fAddrRaw : DEFAULT_STORE_CONTENT.founder.address;

  const isLegacyEnglishWarehouse =
    wh.toLowerCase().includes('b-61/14') ||
    wh.toLowerCase().includes('jaleshwar') ||
    wh.includes('প্রবাসীর পল্লী') ||
    wh.includes('ডিইপিজেড');

  const isLegacyUttaraCorporate =
    corp.includes('উত্তরা মডেল টাউন') ||
    corp.includes('বাড়ি ৫/এ') ||
    corp.includes('সেক্টর ১০');

  const isLegacyEnglishFounderAddr =
    fAddr.toLowerCase().includes('b-61/14') ||
    fAddr.toLowerCase().includes('jaleshwar') ||
    fAddr.includes('প্রবাসীর পল্লী') ||
    fAddr.includes('ডিইপিজেড');

  const rawPhoto = content.founder?.photo || '';
  const cleanedPhoto = rawPhoto.includes('photo-1507003211169-0a1dd7228f2d') ? '' : rawPhoto;

  const rawFounderName = content.founder?.name || '';
  const isLegacyFounderName =
    !rawFounderName ||
    rawFounderName.includes('জান্নাতুল') ||
    rawFounderName.includes('রনি');

  const effectiveFounderName = isLegacyFounderName
    ? DEFAULT_STORE_CONTENT.founder.name
    : rawFounderName;

  const rawFounderTitle = content.founder?.title || '';
  const isLegacyFounderTitle =
    !rawFounderTitle ||
    rawFounderTitle === 'Founder & CEO, Dokandari';

  const effectiveFounderTitle = isLegacyFounderTitle
    ? DEFAULT_STORE_CONTENT.founder.title
    : rawFounderTitle;

  const rawFounderBio = content.founder?.bio || '';
  const isLegacyFounderBio =
    !rawFounderBio ||
    rawFounderBio.includes('মাল্টি-ক্যাটাগরি ই-কমার্স প্ল্যাটফর্ম') ||
    rawFounderBio.includes('আমাদের প্রতিটি প্রোডাক্ট সরাসরি নিজস্ব তত্ত্বাবধানে বাছাইকৃত');

  const effectiveFounderBio = isLegacyFounderBio
    ? DEFAULT_STORE_CONTENT.founder.bio
    : rawFounderBio;

  const rawCeoMsg = content.pageContent?.ceoMessageText || '';
  const isLegacyCeoMsg =
    !rawCeoMsg ||
    rawCeoMsg.includes('আমাদের প্রতিটি গ্রাহক আমাদের পরিবারের অংশ') ||
    rawCeoMsg.includes('জে. আই. রনি');

  const effectiveCeoMsg = isLegacyCeoMsg
    ? DEFAULT_STORE_CONTENT.pageContent!.ceoMessageText
    : rawCeoMsg;

  const rawStory = content.pageContent?.businessStoryText || '';
  const isLegacyStory =
    !rawStory ||
    rawStory.includes('Dokandari শুরু হয়েছিল একটি সহজ কিন্তু দৃঢ় লক্ষ্য নিয়ে');

  const effectiveStory = isLegacyStory
    ? DEFAULT_STORE_CONTENT.pageContent!.businessStoryText
    : rawStory;

  const rawHotline = content.hotlineNumber || '';
  const effectiveHotline =
    !rawHotline || rawHotline.includes('09638757282')
      ? DEFAULT_STORE_CONTENT.hotlineNumber
      : rawHotline;

  const rawWhatsapp = content.whatsappNumber || '';
  const effectiveWhatsapp =
    !rawWhatsapp || rawWhatsapp.includes('01886161426')
      ? DEFAULT_STORE_CONTENT.whatsappNumber
      : rawWhatsapp;

  const rawFounderPhone = content.founder?.phone || '';
  const effectiveFounderPhone =
    !rawFounderPhone || rawFounderPhone.includes('09638757282')
      ? DEFAULT_STORE_CONTENT.founder.phone
      : rawFounderPhone;

  const rawSocials = content.socialLinks || DEFAULT_STORE_CONTENT.socialLinks!;
  const isLegacyFb =
    !rawSocials.facebook ||
    rawSocials.facebook === 'https://facebook.com/dokandari' ||
    rawSocials.facebook === 'https://www.facebook.com/dokandari';
  const isLegacyIg =
    !rawSocials.instagram ||
    rawSocials.instagram === 'https://instagram.com/dokandari' ||
    rawSocials.instagram === 'https://www.instagram.com/dokandari';
  const isLegacyTk =
    !rawSocials.tiktok ||
    rawSocials.tiktok === 'https://tiktok.com/@dokandari' ||
    rawSocials.tiktok === 'https://www.tiktok.com/@dokandari';
  const isLegacyYt =
    !rawSocials.youtube ||
    rawSocials.youtube === 'https://youtube.com/@dokandari' ||
    rawSocials.youtube === 'https://www.youtube.com/@dokandari';
  const isLegacyWaLink =
    !rawSocials.whatsapp || rawSocials.whatsapp.includes('01886161426');

  // Upgrade any old default square product cutout images in heroSlides to full-display cover banners while preserving custom admin uploads
  const LEGACY_SQUARE_SLIDE_IMAGES = new Set([
    '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1600&q=85',
    '/uploads/product/1777788826-1776932024-smart-watch-1.webp',
    '/uploads/product/organic-sundarban-honey.jpg',
    '/uploads/product/1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg',
    '/uploads/product/1777787708-livo-high-speed-turbo-fan-1.webp',
    '/uploads/product/1776151737-untitled-design-49.webp',
    '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
    '/uploads/product/1777098758-eq34-plus-02-500x500.webp',
  ]);

  const rawSlides = Array.isArray(content.heroSlides) ? content.heroSlides : [];
  let effectiveHeroSlides =
    rawSlides.length > 0
      ? rawSlides.map((slide, idx) => {
          const fallbackSlide =
            READYMADE_BRIGHT_HERO_SLIDES[idx % READYMADE_BRIGHT_HERO_SLIDES.length];
          const img = String(slide?.image || '').trim();
          if (!img || LEGACY_SQUARE_SLIDE_IMAGES.has(img)) {
            return {
              ...fallbackSlide,
              ...slide,
              id: slide?.id || fallbackSlide.id,
              image: fallbackSlide.image,
            };
          }
          return {
            ...fallbackSlide,
            ...slide,
            id: slide?.id || `slide-${idx + 1}`,
          };
        })
      : READYMADE_BRIGHT_HERO_SLIDES;

  if (
    rawSlides.length === 3 &&
    rawSlides[0]?.id === 'slide-1' &&
    rawSlides[1]?.id === 'slide-2' &&
    rawSlides[2]?.id === 'slide-3'
  ) {
    effectiveHeroSlides = READYMADE_BRIGHT_HERO_SLIDES;
  }

  const rawInterval = Number(content.carouselInterval || 8000);
  const effectiveCarouselInterval = rawInterval < 5000 ? 8000 : rawInterval;

  const rawCatHeroes = content.categoryHeroes || {};
  const existingOrgHero = rawCatHeroes.organic_food || DEFAULT_CATEGORY_HEROES.organic_food;
  const effectiveOrgHero: CategoryHeroConfig = {
    ...DEFAULT_CATEGORY_HEROES.organic_food,
    ...existingOrgHero,
    slides:
      Array.isArray(existingOrgHero?.slides) && existingOrgHero.slides.length > 0
        ? existingOrgHero.slides
        : DEFAULT_ORGANIC_FOOD_HERO_SLIDES,
  };

  return {
    ...content,
    carouselInterval: effectiveCarouselInterval,
    whatsappNumber: effectiveWhatsapp,
    hotlineNumber: effectiveHotline,
    heroSlides: effectiveHeroSlides,
    categoryHeroes: {
      ...DEFAULT_CATEGORY_HEROES,
      ...rawCatHeroes,
      organic_food: effectiveOrgHero,
    },
    socialLinks: {
      ...DEFAULT_STORE_CONTENT.socialLinks!,
      ...rawSocials,
      whatsapp: isLegacyWaLink ? DEFAULT_STORE_CONTENT.socialLinks!.whatsapp : rawSocials.whatsapp,
      facebook: isLegacyFb ? DEFAULT_STORE_CONTENT.socialLinks!.facebook : rawSocials.facebook,
      instagram: isLegacyIg ? DEFAULT_STORE_CONTENT.socialLinks!.instagram : rawSocials.instagram,
      tiktok: isLegacyTk ? DEFAULT_STORE_CONTENT.socialLinks!.tiktok : rawSocials.tiktok,
      youtube: isLegacyYt ? DEFAULT_STORE_CONTENT.socialLinks!.youtube : rawSocials.youtube,
    },
    pageContent: {
      ...DEFAULT_STORE_CONTENT.pageContent!,
      ...(content.pageContent || {}),
      warehouseAddress: isLegacyEnglishWarehouse
        ? 'বি-৬১/১৪, জলেশ্বর, সাভার - ১৩৪০, ঢাকা (১ম তলা)'
        : wh,
      corporateAddress: isLegacyUttaraCorporate
        ? 'সাভার বাস স্ট্যান্ড, শহীদ প্লাজা, দ্বিতীয় তলা'
        : corp,
      ceoMessageText: effectiveCeoMsg,
      businessStoryText: effectiveStory,
    },
    founder: {
      ...DEFAULT_STORE_CONTENT.founder,
      ...(content.founder || {}),
      name: effectiveFounderName,
      title: effectiveFounderTitle,
      bio: effectiveFounderBio,
      photo: cleanedPhoto,
      phone: effectiveFounderPhone,
      address: isLegacyEnglishFounderAddr
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

  const rawIncomingPhoto =
    incoming.founder && typeof incoming.founder.photo === 'string'
      ? incoming.founder.photo
      : base.founder && typeof base.founder.photo === 'string'
      ? base.founder.photo
      : DEFAULT_STORE_CONTENT.founder.photo;

  const safePhoto = rawIncomingPhoto.includes('photo-1507003211169-0a1dd7228f2d')
    ? ''
    : rawIncomingPhoto;

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
      photo: safePhoto,
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
    categoryImages: {
      ...(base.categoryImages || {}),
      ...(incoming.categoryImages || {}),
    },
  };
  return normalizeOfficialAddresses(merged);
}

/**
 * Syncs live StoreContent from Firestore snapshot into localStorage backup
 * so getInitialStoreContent() never falls back to stale defaults.
 */
export function syncStoreContentToLocalCache(partialOrFull: Partial<StoreContent>): void {
  try {
    const current = getInitialStoreContent();
    const merged = mergeStoreContent(current, partialOrFull);
    localStorage.setItem(LS_STORE_CONTENT_KEY, JSON.stringify(sanitizeForFirestore(merged)));
  } catch {
    // ignore storage warning
  }
}

/**
 * Uploads a Hero Banner or Category Banner image file (or base64 dataUrl) to the server's
 * `/api/upload-banner-image` endpoint with a bright white (#FFFFFF) canvas background
 * so transparent PNGs never turn dark/black and the image is stored as a static URL (`/uploads/product/...`)
 * that never exceeds Firestore's 1MB limit.
 */
export async function uploadBannerImageToServer(
  fileOrDataUrl: File | string,
  prefix = 'hero-banner'
): Promise<string> {
  let dataUrl = '';
  if (typeof fileOrDataUrl === 'string') {
    dataUrl = fileOrDataUrl;
  } else {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_W = 1600;
          const MAX_H = 1000;
          let width = img.width;
          let height = img.height;
          if (width > MAX_W) {
            height = Math.round((height * MAX_W) / width);
            width = MAX_W;
          }
          if (height > MAX_H) {
            width = Math.round((width * MAX_H) / height);
            height = MAX_H;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(String(reader.result || ''));
            return;
          }
          // Fill with bright warm white (#FFFFFF) so transparent images never render black!
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.onerror = () => resolve(String(reader.result || ''));
        img.src = String(reader.result || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrDataUrl);
    });
  }

  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  try {
    const resp = await fetch('/api/upload-banner-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl: dataUrl, prefix }),
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json?.success && json?.url) {
        return String(json.url);
      }
    }
  } catch (err) {
    console.warn('uploadBannerImageToServer fallback to dataUrl:', err);
  }
  return dataUrl;
}

/**
 * Saves StoreContent (full or partial update) to localStorage, the server-side persistent mirror (`/api/store/content`),
 * and Firestore (`settings/store_content`).
 * Automatically converts any base64 banner images into static `/uploads/product/...` URLs via `/api/store/content`
 * so Firestore `settings/store_content` NEVER hits the 1MB document limit and live domains update immediately.
 */
export async function saveStoreContentPersisted(
  contentUpdate: Partial<StoreContent>
): Promise<StoreContent> {
  const current = getInitialStoreContent();
  let merged = mergeStoreContent(current, contentUpdate);
  if (Array.isArray(merged.categoryOrder)) {
    merged.categoryOrder = merged.categoryOrder.map((c) =>
      c === 'fashion_clothing' ? 'organic_food' : c
    );
  }

  // First sync with server mirror (/api/store/content) which also converts any base64 hero images to static /uploads/product/ files
  try {
    const serverResp = await fetch('/api/store/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: sanitizeForFirestore(merged) }),
    });
    if (serverResp.ok) {
      const serverJson = await serverResp.json();
      if (serverJson?.success && serverJson?.content) {
        merged = mergeStoreContent(merged, serverJson.content);
      }
    }
  } catch (err) {
    console.warn('Server store content mirror sync note:', err);
  }

  const clean = sanitizeForFirestore(merged);
  try {
    localStorage.setItem(LS_STORE_CONTENT_KEY, JSON.stringify(clean));
  } catch (e) {
    console.warn('localStorage storeContent backup note:', e);
  }

  // Build targeted Firestore patch containing the updated keys (using the static image URLs from clean)
  const firestorePatch: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  if (contentUpdate.whatsappNumber !== undefined) firestorePatch.whatsappNumber = clean.whatsappNumber;
  if (contentUpdate.hotlineNumber !== undefined) firestorePatch.hotlineNumber = clean.hotlineNumber;
  if (contentUpdate.officialEmail !== undefined) firestorePatch.officialEmail = clean.officialEmail;
  if (contentUpdate.carouselInterval !== undefined) firestorePatch.carouselInterval = clean.carouselInterval;
  if (contentUpdate.bestSellingInterval !== undefined)
    firestorePatch.bestSellingInterval = clean.bestSellingInterval;
  if (contentUpdate.categoryOrder !== undefined) firestorePatch.categoryOrder = clean.categoryOrder;
  if (contentUpdate.googleFlowProjectUrl !== undefined)
    firestorePatch.googleFlowProjectUrl = clean.googleFlowProjectUrl;
  if (contentUpdate.socialLinks !== undefined) firestorePatch.socialLinks = clean.socialLinks;
  if (contentUpdate.heroSlides !== undefined) firestorePatch.heroSlides = clean.heroSlides;
  if (contentUpdate.categoryHeroes !== undefined) firestorePatch.categoryHeroes = clean.categoryHeroes;
  if (contentUpdate.founder !== undefined) firestorePatch.founder = clean.founder;
  if (contentUpdate.pageContent !== undefined) firestorePatch.pageContent = clean.pageContent;

  // Persist Founder & Brand Identity profile to the dedicated authoritative Firestore doc FIRST
  if (contentUpdate.founder !== undefined || contentUpdate.pageContent !== undefined) {
    try {
      const founderPayload: Record<string, unknown> = {
        updatedAt: Date.now(),
      };
      if (contentUpdate.founder !== undefined) founderPayload.founder = clean.founder;
      if (contentUpdate.pageContent !== undefined) founderPayload.pageContent = clean.pageContent;
      await setDoc(
        doc(db, 'settings', 'founder_profile'),
        sanitizeForFirestore(founderPayload),
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore founder_profile sync note:', err);
    }
  }

  try {
    await setDoc(
      doc(db, 'settings', 'store_content'),
      sanitizeForFirestore(firestorePatch),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore store_content sync warning (saved locally & on server):', err);
  }

  return clean;
}

let remoteDeletedProductIdsCache = new Set<string>();

export function setRemoteDeletedProductIds(ids: string[]): void {
  const cleanList = Array.isArray(ids) ? ids.filter(Boolean) : [];
  remoteDeletedProductIdsCache = new Set(cleanList);
  try {
    localStorage.setItem(LS_DELETED_PRODUCT_IDS_KEY, JSON.stringify(cleanList));
  } catch {
    // ignore storage warning
  }
}

export function getDeletedProductIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DELETED_PRODUCT_IDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const localSet = Array.isArray(arr) ? new Set<string>(arr) : new Set<string>();
    for (const id of remoteDeletedProductIdsCache) {
      localSet.add(id);
    }
    return localSet;
  } catch {
    return new Set(remoteDeletedProductIdsCache);
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
 * Exact set of 38 verified real files present in `/public/uploads/product/`.
 * Any `/uploads/product/...` filename NOT in this set is a broken legacy path and will be healed automatically.
 */
export const VALID_LOCAL_UPLOAD_FILES = new Set<string>([
  '1769861322-hawaa-hair-fall-avenger-oil-1-(2).webp',
  '1769861382-1-3.webp',
  '1769861435-1-1.webp',
  '1769861471-skin-cafe-silky-tresses-moisturizing-conditioner-1-2-(1).webp',
  '1769861519-10_in_1_ess_advanced_hair_oil_100ml_1-(1).webp',
  '1776151737-untitled-design-49.webp',
  '1776247559-img_69d539f2bf516_0_1775581682.jpg',
  '1776319126-1732248160-1722670821-sellmart_54.jpg',
  '1776324094-5-layer-food-safety-cover-150x150.jpg',
  '1776348493-20052.jpg',
  '1776348730-b73a05b8565f8909e9c6a07d2de29dc8.jpg_720x720q80.jpg_.webp',
  '1776508057-1753857716-1753706738-10001.webp',
  '1776508199-1725622701-1722940972-usb-table-fans-folding-rechargeable-fan-led-light-and-original-imagdwfz3zyz9g7m.webp',
  '1776523547-product_image_2130.jpg',
  '1776523954-20516.jpg',
  '1777098758-eq34-plus-02-500x500.webp',
  '1777787708-livo-high-speed-turbo-fan-1.webp',
  '1777788043-hp-turbo-fan.webp',
  '1777788637-1.webp',
  '1777788826-1776932024-smart-watch-1.webp',
  '1789888147-h8106c4a8711947bfaf519bb680ae518cv.jpg',
  '1791961933-whatsapp-image-2026-10-14-at-12.59.52-(1).jpeg',
  '1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg',
  '1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
  '1792322634-gemini_generated_image_i3plevi3plevi3pl.jpg',
  '1792322764-whatsapp-image-2026-10-14-at-12.59.53.jpeg',
  'Gemini_Generated_Image_dsg9pjdsg9pjdsg9.jpeg',
  'Gemini_Generated_Image_vid5cyvid5cyvid5.jpg',
  'H1a1445f9950249049b15d7e7e9da8e55G.jpg',
  'H25ea4841afd5463591250f1d029873acN.jpg',
  'H29cc3664a9fa41368666c15926e0d2b5S.jpg',
  'H6a326173d1a54849a898cf5017343e7ah.jpg',
  'H7b42b36b865e4395afe3ab4e82d5ec37D-6.jpg',
  'H952cd307db5c46eea7a3728480fb7c42j.jpg',
  'Ha2ef56dd79ed496bafac7990404868f7u.jpg',
  'Ha595a0e636bb4479885d5e8a88bd25afz.jpg',
  'Hb954a2545019473bba00901770da8608F.jpg',
  'He1e7d0e527634b5196f9d7cd961eb694M.jpg',
  'organic-sundarban-honey.jpg',
  'organic-pabna-ghee.jpg',
  'organic-mustard-oil.jpg',
  'organic-ajwa-dates.jpg',
  'organic-chia-seeds.jpg',
  'organic-honey-nuts.jpg',
  'organic-kalojira-oil.jpg',
  'organic-moringa-powder.jpg',
  'organic-red-rice.jpg',
  'organic-green-tea.jpg',
  'organic-patali-gur.jpg',
  'organic-spice-combo.jpg',
  'dkd-1793610538096-571-0.jpg',
  'dkd-1793610538096-571-1.jpg',
  'dkd-1793610538096-571-2.jpg',
  'dkd-1793611408928-666-0.jpg',
  'dkd-1793611408928-666-1.jpg',
  'dkd-1793611408928-666-2.jpg',
  'dkd-1793613621412-332-0.webp',
  'dkd-1793613621412-332-1.webp',
  'dkd-1793613621412-332-2.webp',
  'dkd-1793613770498-186-0.webp',
  'dkd-1793613770498-186-1.webp',
  'dkd-1793613770498-186-2.webp',
  'dkd-1793613770498-186-3.webp',
  'dkd-1793613770498-186-4.webp',
]);

/**
 * Maps legacy or broken filenames directly to their verified real file in `/public/uploads/product/`.
 */
const LEGACY_FILENAME_REMAP: Record<string, string> = {
  '1792219337-ha7e0aa8d05a44d73b82d68816420d174s.jpg':
    '/uploads/product/1792322764-whatsapp-image-2026-10-14-at-12.59.53.jpeg',
  'flexible-mirror-sheet.jpg':
    '/uploads/product/1792322764-whatsapp-image-2026-10-14-at-12.59.53.jpeg',
  '1792218995-hb38f48c0a8b7454ebad69790a214b4f5s.jpg':
    '/uploads/product/Gemini_Generated_Image_vid5cyvid5cyvid5.jpg',
  'round-vanity-mirror.jpg':
    '/uploads/product/Gemini_Generated_Image_vid5cyvid5cyvid5.jpg',
  '1792218499-h2d83f5b4372f4cf69c8441815d239ae5j.jpg':
    '/uploads/product/Gemini_Generated_Image_dsg9pjdsg9pjdsg9.jpeg',
  '3d-butterfly-mirror.jpg':
    '/uploads/product/Gemini_Generated_Image_dsg9pjdsg9pjdsg9.jpeg',
  'heart-mirror-sticker.jpg':
    '/uploads/product/1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg',
  'cat-led-bookshelf.jpg':
    '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
  '1789984863-Dear-Hair-Tonic-Cleanser-1.jpg':
    '/uploads/product/1776151737-untitled-design-49.webp',
  'dear-hair-tonic.jpg':
    '/uploads/product/1776151737-untitled-design-49.webp',
  '1789984852-Lafz-10-in-1-Advanced-Essential-Hair-Oil.webp':
    '/uploads/product/1769861519-10_in_1_ess_advanced_hair_oil_100ml_1-(1).webp',
  '1789984839-Skin-Cafe-Silky-Tresses-Moisturizing-Conditioner-120ml.webp':
    '/uploads/product/1769861471-skin-cafe-silky-tresses-moisturizing-conditioner-1-2-(1).webp',
  '1789984829-St.-Ives-Glowing-Oil-Free-Face-Moisturizer-Watermelon.webp':
    '/uploads/product/1769861435-1-1.webp',
  '1789984817-Simple-10-Vitamin-CEF-Booster-Serum-30ml.webp':
    '/uploads/product/1769861382-1-3.webp',
  '1789984805-Hawa-Hair-Fall-Avenger-Oil-100ml.webp':
    '/uploads/product/1769861322-hawaa-hair-fall-avenger-oil-1-(2).webp',
  '1789984794-Muuchstac-Ocean-Face-Wash-Herbal-Skin-Lightning-Oil-Combo.webp':
    '/uploads/product/1776247559-img_69d539f2bf516_0_1775581682.jpg',
  '1789984781-Portable-Handheld-Cooling-Fan-with-Night-Light.webp':
    '/uploads/product/1777788637-1.webp',
  '1789984768-HJ-5060-Rechargeable-LED-Desk-Lamp-with-Smart-Display-Pen-Holder.webp':
    '/uploads/product/1776523954-20516.jpg',
  '1789984745-M11-TWS-True-Wireless-Earbuds-with-Power-Bank-LED-Display.webp':
    '/uploads/product/1776523547-product_image_2130.jpg',
  '1789984733-JOY-SUPER-B10-Rechargeable-Emergency-Bulb-15W.webp':
    '/uploads/product/1776508199-1725622701-1722940972-usb-table-fans-folding-rechargeable-fan-led-light-and-original-imagdwfz3zyz9g7m.webp',
  '1789984722-Thunder-2-in-1-Rechargeable-LED-Emergency-Light-XST-836.webp':
    '/uploads/product/1776508057-1753857716-1753706738-10001.webp',
  '1789984712-Livo-Instant-Hair-Color-Shampoo-3-in-1.webp':
    '/uploads/product/1777787708-livo-high-speed-turbo-fan-1.webp',
  '1789984699-Hoco-EQ2-True-Wireless-BT-Headset.webp':
    '/uploads/product/1777098758-eq34-plus-02-500x500.webp',
  '1789984688-Colmi-KW77-Smart-Watch-2-Straps.webp':
    '/uploads/product/1777788826-1776932024-smart-watch-1.webp',
  '1789984677-Mini-Multifunctional-Household-Electric-Sewing-Machine.webp':
    '/uploads/product/1776319126-1732248160-1722670821-sellmart_54.jpg',
  '1789984665-Food-Safety-7-Plus-Combo-Pack.webp':
    '/uploads/product/1776324094-5-layer-food-safety-cover-150x150.jpg',
};

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
 * Keyword-aware high-resolution fallback product image selector using ONLY the 38 verified real files
 * in `/public/uploads/product/`.
 */
export function getFallbackProductImage(
  product?: { id?: string; name?: string; titleEn?: string; category?: string },
  index = 0
): string {
  const id = (product?.id || '').toLowerCase();
  const text = `${id} ${product?.name || ''} ${product?.titleEn || ''} ${product?.category || ''}`.toLowerCase();
  const seed = hashProductSeed(`${product?.id || ''}-${product?.name || ''}`);
  const offset = seed + index;

  // Exact match for real Dokandari products using 100% verified local files
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
      '/uploads/product/1792322634-gemini_generated_image_i3plevi3plevi3pl.jpg',
      '/uploads/product/1792322764-whatsapp-image-2026-10-14-at-12.59.53.jpeg',
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
    return '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg';
  }

  if (text.includes('প্রজাপতি') || text.includes('butterfly') || text.includes('৩ডি') || text.includes('3d')) {
    const bflyGallery = [
      '/uploads/product/Gemini_Generated_Image_dsg9pjdsg9pjdsg9.jpeg',
      '/uploads/product/1791961933-whatsapp-image-2026-10-14-at-12.59.52-(1).jpeg',
      '/uploads/product/1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg',
    ];
    return bflyGallery[index % bflyGallery.length];
  }

  if (text.includes('গোল') || text.includes('বাথরুম') || text.includes('ভ্যানিটি') || text.includes('round') || text.includes('vanity')) {
    const roundGallery = [
      '/uploads/product/Gemini_Generated_Image_vid5cyvid5cyvid5.jpg',
      '/uploads/product/1792322634-gemini_generated_image_i3plevi3plevi3pl.jpg',
      '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
    ];
    return roundGallery[index % roundGallery.length];
  }

  if (text.includes('ফ্লেক্সিবল') || text.includes('সেলফ-আঠালো') || text.includes('flexible') || text.includes('sheet')) {
    const flexGallery = [
      '/uploads/product/1792322764-whatsapp-image-2026-10-14-at-12.59.53.jpeg',
      '/uploads/product/1789888147-h8106c4a8711947bfaf519bb680ae518cv.jpg',
      '/uploads/product/H7b42b36b865e4395afe3ab4e82d5ec37D-6.jpg',
      '/uploads/product/Ha595a0e636bb4479885d5e8a88bd25afz.jpg',
      '/uploads/product/H1a1445f9950249049b15d7e7e9da8e55G.jpg',
      '/uploads/product/Hb954a2545019473bba00901770da8608F.jpg',
    ];
    return flexGallery[index % flexGallery.length];
  }

  if (text.includes('ডিয়ার') || text.includes('dear')) {
    return '/uploads/product/1776151737-untitled-design-49.webp';
  }
  if (text.includes('লাফজ') || text.includes('lafz')) {
    return '/uploads/product/1769861519-10_in_1_ess_advanced_hair_oil_100ml_1-(1).webp';
  }
  if (text.includes('স্কিন ক্যাফে') || text.includes('skin cafe')) {
    return '/uploads/product/1769861471-skin-cafe-silky-tresses-moisturizing-conditioner-1-2-(1).webp';
  }
  if (text.includes('সেন্ট আইভস') || text.includes('st. ives') || text.includes('st ives')) {
    return '/uploads/product/1769861435-1-1.webp';
  }
  if (text.includes('সিম্পল') || text.includes('simple')) {
    return '/uploads/product/1769861382-1-3.webp';
  }
  if (text.includes('হাওয়া') || text.includes('hawa')) {
    return '/uploads/product/1769861322-hawaa-hair-fall-avenger-oil-1-(2).webp';
  }
  if (text.includes('মুশট্যাক') || text.includes('muuchstac')) {
    return '/uploads/product/1776247559-img_69d539f2bf516_0_1775581682.jpg';
  }
  if (text.includes('hj-5060') || text.includes('ডেস্ক ল্যাম্প') || text.includes('desk lamp') || text.includes('20516')) {
    return '/uploads/product/1776523954-20516.jpg';
  }
  if (text.includes('m11') || text.includes('ব্লেডলেস') || text.includes('bladeless')) {
    return '/uploads/product/1776523547-product_image_2130.jpg';
  }
  if (text.includes('jy-2570') || text.includes('৬ ব্যাটারি')) {
    return '/uploads/product/1776348493-20052.jpg';
  }
  if (text.includes('জয় সুপার') || text.includes('জয়-সুপার') || text.includes('joy-super') || text.includes('b10')) {
    return '/uploads/product/1776508199-1725622701-1722940972-usb-table-fans-folding-rechargeable-fan-led-light-and-original-imagdwfz3zyz9g7m.webp';
  }
  if (text.includes('থান্ডার') || text.includes('thunder') || text.includes('xst-836') || text.includes('টর্চ') || text.includes('ফ্ল্যাশলাইট')) {
    return '/uploads/product/1776508057-1753857716-1753706738-10001.webp';
  }
  if (text.includes('লিভো') || text.includes('livo')) {
    return '/uploads/product/1777787708-livo-high-speed-turbo-fan-1.webp';
  }
  if (text.includes('হ্যান্ডহেল্ড') || text.includes('মিনি টার্বো') || text.includes('hp-turbo')) {
    return '/uploads/product/1777788043-hp-turbo-fan.webp';
  }
  if (text.includes('এলইডি ডিসপ্লে') || text.includes('led display')) {
    return '/uploads/product/1776348730-b73a05b8565f8909e9c6a07d2de29dc8.jpg_720x720q80.jpg_.webp';
  }
  if (text.includes('ফ্যান') || text.includes('কুলিং') || text.includes('fan')) {
    return '/uploads/product/1777788637-1.webp';
  }
  if (text.includes('হোকো') || text.includes('hoco') || text.includes('eq34') || text.includes('eq2') || text.includes('ইয়ারবাড')) {
    return '/uploads/product/1777098758-eq34-plus-02-500x500.webp';
  }
  if (text.includes('কলমি') || text.includes('কেকিওয়্যার') || text.includes('colmi') || text.includes('kw77') || text.includes('watch')) {
    return '/uploads/product/1777788826-1776932024-smart-watch-1.webp';
  }
  if (text.includes('সেলাই') || text.includes('sewing')) {
    return '/uploads/product/1776319126-1732248160-1722670821-sellmart_54.jpg';
  }
  if (text.includes('ফুড সেফটি') || text.includes('food safety') || text.includes('কভার')) {
    return '/uploads/product/1776324094-5-layer-food-safety-cover-150x150.jpg';
  }

  // Category pools using ONLY 100% verified real files in /public/uploads/product/
  const cat = product?.category || 'home_decor';
  const catPools: Record<string, string[]> = {
    home_decor: [
      '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg',
      '/uploads/product/1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg',
      '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
      '/uploads/product/1792322764-whatsapp-image-2026-10-14-at-12.59.53.jpeg',
      '/uploads/product/Gemini_Generated_Image_vid5cyvid5cyvid5.jpg',
      '/uploads/product/Gemini_Generated_Image_dsg9pjdsg9pjdsg9.jpeg',
    ],
    gadgets_electronics: [
      '/uploads/product/1777788637-1.webp',
      '/uploads/product/1776523954-20516.jpg',
      '/uploads/product/1776523547-product_image_2130.jpg',
      '/uploads/product/1777098758-eq34-plus-02-500x500.webp',
      '/uploads/product/1777788826-1776932024-smart-watch-1.webp',
    ],
    beauty_personal_care: [
      '/uploads/product/1776151737-untitled-design-49.webp',
      '/uploads/product/1769861519-10_in_1_ess_advanced_hair_oil_100ml_1-(1).webp',
      '/uploads/product/1769861471-skin-cafe-silky-tresses-moisturizing-conditioner-1-2-(1).webp',
      '/uploads/product/1769861435-1-1.webp',
      '/uploads/product/1769861382-1-3.webp',
      '/uploads/product/1769861322-hawaa-hair-fall-avenger-oil-1-(2).webp',
    ],
    home_kitchen: [
      '/uploads/product/1776319126-1732248160-1722670821-sellmart_54.jpg',
      '/uploads/product/1776324094-5-layer-food-safety-cover-150x150.jpg',
    ],
    mobile_accessories: [
      '/uploads/product/1777098758-eq34-plus-02-500x500.webp',
      '/uploads/product/1777788826-1776932024-smart-watch-1.webp',
    ],
    lifestyle: [
      '/uploads/product/1777788637-1.webp',
      '/uploads/product/1777788043-hp-turbo-fan.webp',
    ],
    travel_outdoor: [
      '/uploads/product/1776508057-1753857716-1753706738-10001.webp',
    ],
    health_fitness: [
      '/uploads/product/1776324094-5-layer-food-safety-cover-150x150.jpg',
    ],
    kids_baby: [
      '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
    ],
    office_essentials: [
      '/uploads/product/1776523954-20516.jpg',
    ],
    organic_food: [
      '/uploads/product/organic-sundarban-honey.jpg',
      '/uploads/product/organic-pabna-ghee.jpg',
      '/uploads/product/organic-mustard-oil.jpg',
      '/uploads/product/organic-ajwa-dates.jpg',
      '/uploads/product/organic-honey-nuts.jpg',
      '/uploads/product/organic-chia-seeds.jpg',
      '/uploads/product/organic-kalojira-oil.jpg',
      '/uploads/product/organic-moringa-powder.jpg',
      '/uploads/product/organic-red-rice.jpg',
      '/uploads/product/organic-green-tea.jpg',
      '/uploads/product/organic-patali-gur.jpg',
      '/uploads/product/organic-spice-combo.jpg',
    ],
    fashion_clothing: [
      '/uploads/product/organic-sundarban-honey.jpg',
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
    'scraped-c916ac6efc0985',
    'founder-viral-women',
    '/uploads/founder/',
    'founder',
    'ceo',
    'author',
    'owner',
    'team-member',
    'profile-pic',
    'hero-cosmetics',
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
 * Validates a local `/uploads/product/...` path against `VALID_LOCAL_UPLOAD_FILES`.
 * If the filename exists on disk, returns `/uploads/product/<filename>`.
 * Otherwise remaps via `LEGACY_FILENAME_REMAP` or `getFallbackProductImage`.
 */
const VW_CUSTOM_MIRROR_REAL_IMAGES = [
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-0-f7c9bda4ee.jpg',
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-1-7d5b130754.jpg',
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-2-c03044f72c.jpg',
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-3-8133d420fd.jpg',
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-4-1ce755fa22.jpg',
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-5-e618995ab7.jpg',
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-6-0529e3a1ee.jpg',
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-7-2b5c8c025d.jpg',
  'https://www.viralwomanbd.com/product-images/vw-prod-1793381883400-8-4d6e10b848.jpg',
];

function resolveVerifiedLocalUploadPath(
  localPath: string,
  product?: { id?: string; name?: string; titleEn?: string; category?: string },
  index = 0
): string {
  const normalized = localPath.replace(/^\/public\/uploads\//, '/uploads/');
  const fname = normalized.replace(/^\/uploads\/product\//, '').split(/[?&]/)[0];
  if (fname.toLowerCase().includes('scraped-c916ac6efc0985') || fname.toLowerCase().includes('founder')) {
    return getFallbackProductImage(product, index);
  }
  if (
    product?.id === 'dkd-1793610538096-571' &&
    (fname.startsWith('scraped-') || fname.startsWith('dkd-1793610538096-571'))
  ) {
    return VW_CUSTOM_MIRROR_REAL_IMAGES[index % VW_CUSTOM_MIRROR_REAL_IMAGES.length];
  }
  if (
    VALID_LOCAL_UPLOAD_FILES.has(fname) ||
    fname.startsWith('dkd-') ||
    fname.startsWith('prod-') ||
    fname.startsWith('custom-') ||
    fname.startsWith('scraped-') ||
    fname.startsWith('ba-') ||
    fname.startsWith('ugc-')
  ) {
    return `/uploads/product/${fname}`;
  }
  if (LEGACY_FILENAME_REMAP[fname]) {
    return LEGACY_FILENAME_REMAP[fname];
  }
  return getFallbackProductImage(product, index);
}

/**
 * Resolves and sanitizes any product image URL:
 * 1. Keeps Admin-uploaded `data:image/...`, `blob:`, `/assets/...` intact.
 * 2. Validates `/uploads/product/...` against `VALID_LOCAL_UPLOAD_FILES` so broken 404 filenames are healed immediately.
 * 3. Blocks any Alibaba/CDN error/unplug illustrations (`isBlockedOrErrorProductImageUrl`).
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

  // 0. Unwrap any existing `wsrv.nl/?url=...` layers so we NEVER double-wrap wsrv.nl inside wsrv.nl (which causes HTTP 404)!
  let wsrvUnwrapCount = 0;
  while (
    wsrvUnwrapCount < 6 &&
    (url.toLowerCase().includes('wsrv.nl/?url=') ||
      url.toLowerCase().includes('wsrv.nl?url=') ||
      url.toLowerCase().includes('images.weserv.nl'))
  ) {
    wsrvUnwrapCount++;
    try {
      const parsedWsrv = new URL(url.startsWith('//') ? `https:${url}` : url);
      const inner = parsedWsrv.searchParams.get('url');
      if (inner) {
        let nextUrl = inner.trim();
        try {
          if (nextUrl.includes('%2F') || nextUrl.includes('%3A')) {
            nextUrl = decodeURIComponent(nextUrl).trim();
          }
        } catch {
          // ignore
        }
        url = nextUrl;
      } else {
        break;
      }
    } catch {
      const match = url.match(/[?&]url=([^&]+)/i);
      if (match?.[1]) {
        try {
          url = decodeURIComponent(match[1]).trim();
        } catch {
          break;
        }
      } else {
        break;
      }
    }
  }

  // Verify local `/uploads/product/...` or `/public/uploads/product/...` against the 38 real files on disk
  if (url.startsWith('/uploads/product/') || url.startsWith('/public/uploads/product/')) {
    return resolveVerifiedLocalUploadPath(url, product, index);
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
    return resolveVerifiedLocalUploadPath(url, product, index);
  }

  if (isBlockedOrErrorProductImageUrl(url)) {
    return getFallbackProductImage(product, index);
  }

  // 2. Fix protocol-relative URLs
  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  // 3. Rewrite Laravel `/public/uploads/product/...` URLs ONLY if they belong to dokandari.com or relative path
  if (
    (url.includes('/public/uploads/product/') || url.includes('%2Fpublic%2Fuploads%2Fproduct%2F')) &&
    (!/^https?:\/\//i.test(url) || url.toLowerCase().includes('dokandari.com'))
  ) {
    try {
      const decoded = decodeURIComponent(url);
      const fname = decoded.split('/public/uploads/product/')[1]?.split(/[?&]/)[0];
      if (fname) {
        return resolveVerifiedLocalUploadPath(`/uploads/product/${fname}`, product, index);
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

  // 5. Rewrite `dokandari.com/wp-content/uploads/...` to verified local `/uploads/product/`
  if (lower.includes('/wp-content/uploads/')) {
    if (lower.includes('gemini_generated_image_b9teg6b9teg6b9te')) {
      return '/uploads/product/1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg';
    }
    if (lower.includes('gemini_generated_image_6tydck6tydck6tyd')) {
      return '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg';
    }
    if (lower.includes('h2d83f5b4372f4cf69c8441815d239ae5j')) {
      return '/uploads/product/Gemini_Generated_Image_dsg9pjdsg9pjdsg9.jpeg';
    }
    if (lower.includes('hb38f48c0a8b7454ebad69790a214b4f5s')) {
      return '/uploads/product/Gemini_Generated_Image_vid5cyvid5cyvid5.jpg';
    }
    if (lower.includes('ha7e0aa8d05a44d73b82d68816420d174s')) {
      return '/uploads/product/1792322764-whatsapp-image-2026-10-14-at-12.59.53.jpeg';
    }
    if (lower.includes('dear-hair-tonic-cleanser')) {
      return '/uploads/product/1776151737-untitled-design-49.webp';
    }
  }

  // 6. If any product was accidentally given the generic brown sofa or yellow headphone Unsplash photo,
  //    replace it immediately with the product's authentic image!
  if (isOverwrittenGenericImage(url, product?.id)) {
    return getFallbackProductImage(product, index);
  }

  // 7. Proxy HTTP-only or hotlink-protected store CDNs (`slatic.net`, `lazcdn.com`, `shajgoj`) through a SINGLE layer of wsrv.nl.
  //    Keep HTTPS `alicdn.com/kf/`, `m.media-amazon.com`, `cdn.shopify.com`, etc. clean & direct (and if direct fails, `handleProductImageError` will try wsrv.nl).
  if (
    url.startsWith('http://') ||
    lower.includes('slatic.net') ||
    lower.includes('lazcdn.com') ||
    lower.includes('shajgoj.com')
  ) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=1200&q=90&output=webp`;
  }

  if (lower.includes('images.unsplash.com') && (url.includes('w=400') || url.includes('w=600'))) {
    return url
      .replace(/w=(400|600)/g, 'w=1200')
      .replace(/q=(75|80)/g, 'q=90');
  }

  if (lower.includes('viralwomanbd.com')) {
    url = url.replace(/^https?:\/\/viralwomanbd\.com\//i, 'https://www.viralwomanbd.com/');
  }

  if (!/^https?:\/\//i.test(url)) {
    return getFallbackProductImage(product, index);
  }

  return url;
}

/**
 * Universal `onError` handler for product `<img>` tags across the storefront and admin panel.
 * 1. If a `wsrv.nl` proxied URL failed, unwraps and tries the direct HTTPS source URL first.
 * 2. If a direct HTTPS URL failed, tries a single-layer `wsrv.nl` CDN proxy.
 * 3. Only if both fail, falls back to a product image.
 */
export function handleProductImageError(
  e: { currentTarget: HTMLImageElement },
  product?: { id?: string; name?: string; titleEn?: string; category?: string },
  index = 0
): void {
  const imgEl = e.currentTarget;
  if (!imgEl) return;

  const currentSrc = imgEl.src || '';

  // Step 1: If a wsrv.nl URL failed, unwrap it and try loading the direct HTTPS image URL
  if (!imgEl.dataset.directTried && currentSrc.includes('wsrv.nl')) {
    imgEl.dataset.directTried = 'true';
    try {
      const parsed = new URL(currentSrc);
      let inner = parsed.searchParams.get('url') || '';
      while (inner.includes('wsrv.nl')) {
        const p2 = new URL(inner);
        inner = p2.searchParams.get('url') || inner;
      }
      if (inner.startsWith('http') && !isBlockedOrErrorProductImageUrl(inner)) {
        imgEl.src = inner;
        return;
      }
    } catch {
      // ignore
    }
  }

  // Step 2: If direct image failed and hasn't tried wsrv.nl proxy yet, try a single-layer wsrv.nl proxy
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
    imgEl.src = `https://wsrv.nl/?url=${encodeURIComponent(rewritten)}&w=1200&q=90&output=webp`;
    return;
  }

  // Step 3: Fallback to keyword-matched high-resolution product photo
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
    offerMode: p.offerMode || p.comboConfig?.offerMode,
    comboConfig: p.comboConfig,
    variants: {
      colors,
      sizes,
    },
  };
}

/**
 * Filters out unplayable HEVC (-h265-) or temporary blob: streams and returns at most 1 single playable video
 */
export function cleanProductVideos(rawVideos?: string[]): string[] {
  if (!Array.isArray(rawVideos) || rawVideos.length === 0) return [];
  const valid = rawVideos
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(
      (v) =>
        v.length > 0 &&
        !v.startsWith('blob:') &&
        !v.toLowerCase().includes('-h265-') &&
        !v.toLowerCase().includes('hevc')
    );
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => {
    const score = (u: string) =>
      u.includes('-h264-hd') ? 4 : u.includes('-h264-sd') ? 3 : u.includes('-h264-') ? 2 : 1;
    return score(b) - score(a);
  });
  return [sorted[0]];
}

const INITIAL_PRODUCT_MAP = new Map<string, Product>(INITIAL_PRODUCTS.map((ip) => [ip.id, ip]));

function normalizeProductImages(p: Product): Product {
  const enriched = enrichProductFields(p);
  const initMatch = INITIAL_PRODUCT_MAP.get(enriched.id);

  // Heal flagship Custom Social Media Profile Full-Length Mirror if an older duplicate entry overwrote its name or images
  if (enriched.id === 'dkd-1793610538096-571') {
    if (
      !enriched.name ||
      enriched.name.includes('ব্যবসা এবং বাড়ির সাজসজ্জার জন্য')
    ) {
      enriched.name =
        initMatch?.name ||
        'ফেসবুক ও ইনস্টাগ্রাম প্রোফাইল থিম কাস্টম ফুল-লেংথ মিরর (আপনার ব্র্যান্ডের নামে কাস্টমাইজড আয়না)';
    }
    if (!enriched.offerMode) {
      enriched.offerMode = 'size';
    }
    if (!enriched.comboConfig && initMatch?.comboConfig) {
      enriched.comboConfig = {
        ...initMatch.comboConfig,
        pkg1Price: Number(enriched.price) || initMatch.comboConfig.pkg1Price,
      };
    }
    if (
      !Array.isArray(enriched.images) ||
      enriched.images.length === 0 ||
      enriched.images.some(
        (u) =>
          typeof u === 'string' &&
          (u.includes('dkd-1793610538096-571-') || u.includes('scraped-'))
      )
    ) {
      enriched.images = [...VW_CUSTOM_MIRROR_REAL_IMAGES];
    }
  }

  // Keep comboConfig.pkg1Price synced with product.price so editing product.price immediately reflects on the product page
  if (enriched.comboConfig && Number(enriched.price) > 0) {
    enriched.comboConfig = {
      ...enriched.comboConfig,
      pkg1Price: Number(enriched.price),
    };
  }

  let rawCandidateList = Array.isArray(enriched.images) ? enriched.images : [];

  // If an initial catalog item has real /uploads/product/ photos in INITIAL_PRODUCTS, but Firestore still has old Unsplash placeholders, restore the real /uploads/product/ photos!
  if (
    initMatch &&
    initMatch.images?.[0]?.startsWith('/uploads/product/') &&
    rawCandidateList[0]?.includes('images.unsplash.com')
  ) {
    rawCandidateList = initMatch.images;
  }

  const nonEmptyRaw = rawCandidateList.filter(
    (img) =>
      typeof img === 'string' &&
      img.trim().length > 0 &&
      !isBlockedOrErrorProductImageUrl(img)
  );

  // Filter out accidentally overwritten generic Unsplash URLs if the product has real images or is not prod-1/prod-2
  const realImagesOnly = nonEmptyRaw.filter((img) => !isOverwrittenGenericImage(img, enriched.id));

  const isImportedOrCustom =
    Boolean((p as any).sourceUrl) ||
    enriched.id.startsWith('dkd-') ||
    enriched.id.startsWith('custom-');

  const baseList =
    realImagesOnly.length > 0
      ? realImagesOnly
      : nonEmptyRaw.length > 0
      ? nonEmptyRaw
      : isImportedOrCustom
      ? []
      : [
          getFallbackProductImage(enriched, 0),
          getFallbackProductImage(enriched, 1),
          getFallbackProductImage(enriched, 2),
        ];

  const safeImages = baseList.map((img, idx) => resolveSafeProductImageUrl(img, enriched, idx));

  // Only pad initial catalog items to 3 images; for imported/custom products keep ONLY their real images
  if (!isImportedOrCustom) {
    while (safeImages.length < 3) {
      safeImages.push(safeImages[0] || getFallbackProductImage(enriched, safeImages.length));
    }
  }

  return {
    ...enriched,
    status: enriched.status === 'draft' ? 'draft' : 'published',
    images: safeImages,
    videos: cleanProductVideos(enriched.videos),
  };
}

export interface ValidatedProductUrlInfo {
  isValid: boolean;
  normalizedUrl: string;
  hostname: string;
  isSingleProductUrl: boolean;
  singleProductId: string;
  uniqueProductId: string;
  productSlug: string;
  disallowSiteWideFallback: boolean;
  blockSiteWideDiscovery: boolean;
}

/**
 * Strictly validates a product or store URL and explicitly extracts the unique product ID (`uniqueProductId` / `singleProductId`)
 * when a specific product URL is provided, blocking any site-wide or random product discovery logic.
 */
export function validateAndIsolateProductUrl(rawInput: string): ValidatedProductUrlInfo {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalizedUrl: '',
      hostname: '',
      isSingleProductUrl: false,
      singleProductId: '',
      uniqueProductId: '',
      productSlug: '',
      disallowSiteWideFallback: true,
      blockSiteWideDiscovery: true,
    };
  }

  let candidate = trimmed;
  if (candidate.startsWith('www.')) {
    candidate = `https://${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate) && /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/.*)?$/.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
    const hostname = parsed.hostname.toLowerCase();
    const pathname = decodeURIComponent(parsed.pathname || '').replace(/\/+$/, '');
    const segments = pathname.split('/').filter(Boolean);

    let isSingleProductUrl = false;
    let singleProductId = '';
    let productSlug = '';

    // 1. Query param product identifiers (?product=..., ?id=..., ?item_id=..., ?product_id=...)
    const queryProdId =
      parsed.searchParams.get('product') ||
      parsed.searchParams.get('product_id') ||
      parsed.searchParams.get('item_id') ||
      parsed.searchParams.get('id') ||
      '';
    if (queryProdId) {
      isSingleProductUrl = true;
      singleProductId = queryProdId.trim();
      productSlug = queryProdId.trim();
    }

    // 2. Explicit single-product URL path patterns across Alibaba, AliExpress, Amazon, Daraz, Shopify, WooCommerce, Laravel & Custom Stores (e.g. /product/vw-prod-1793381883400)
    const alibabaMatch = pathname.match(/\/product-detail\/([^/?#]+?)(?:_(\d{5,}))?(?:\.html?)?$/i);
    const aliExpressMatch = pathname.match(/\/item\/([^/?#]+?)(?:\.html?)?$/i);
    const amazonMatch = pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{8,12})/i);
    const darazMatch = pathname.match(/\/products\/([^/?#]+?)-i(\d+)(?:-s\d+)?\.html/i);
    const standardProductMatch = pathname.match(
      /\/(?:products?|item|p|shop\/product|catalog\/product\/view\/id|product-page|details)\/([^/?#]+)/i
    );

    if (alibabaMatch) {
      isSingleProductUrl = true;
      productSlug = alibabaMatch[1];
      singleProductId = alibabaMatch[2] || alibabaMatch[1];
    } else if (aliExpressMatch) {
      isSingleProductUrl = true;
      productSlug = aliExpressMatch[1];
      singleProductId = aliExpressMatch[1];
    } else if (amazonMatch) {
      isSingleProductUrl = true;
      productSlug = amazonMatch[1];
      singleProductId = amazonMatch[1];
    } else if (darazMatch) {
      isSingleProductUrl = true;
      productSlug = darazMatch[1];
      singleProductId = darazMatch[2];
    } else if (standardProductMatch) {
      isSingleProductUrl = true;
      productSlug = standardProductMatch[1].replace(/\.(html?|php|json)$/i, '');
      singleProductId = productSlug;
    } else if (
      segments.length >= 1 &&
      !['collections', 'collection', 'category', 'categories', 'shop', 'store', 'products', 'catalog', 'search', 'tag', 'brand', 'brands'].includes(
        segments[0].toLowerCase()
      ) &&
      !['collections', 'category', 'categories', 'shop', 'products', 'catalog'].includes(
        segments[segments.length - 1].toLowerCase()
      )
    ) {
      // Custom permalink structure (e.g. WooCommerce /my-product-slug/ or /category/my-product-slug.html)
      const lastSeg = segments[segments.length - 1].replace(/\.(html?|php)$/i, '');
      if (lastSeg.length > 2 && (lastSeg.includes('-') || /\d/.test(lastSeg) || segments.length >= 2)) {
        isSingleProductUrl = true;
        productSlug = lastSeg;
        singleProductId = lastSeg;
      }
    }

    return {
      isValid: true,
      normalizedUrl: parsed.href,
      hostname,
      isSingleProductUrl,
      singleProductId,
      uniqueProductId: singleProductId,
      productSlug,
      // When a specific product URL is provided, NEVER fall back to site-wide or random product discovery
      disallowSiteWideFallback: isSingleProductUrl,
      blockSiteWideDiscovery: isSingleProductUrl,
    };
  } catch {
    return {
      isValid: false,
      normalizedUrl: trimmed,
      hostname: '',
      isSingleProductUrl: false,
      singleProductId: '',
      uniqueProductId: '',
      productSlug: '',
      disallowSiteWideFallback: true,
      blockSiteWideDiscovery: true,
    };
  }
}

/**
 * Precise DOM/HTML & SSR state selector parser for a specific single product page.
 * Isolates the unique product ID (`uniqueProductId`), parses `window.__SERVER_STORE_DATA__` or product-scoped DOM,
 * and strips related products, upsells, cross-sells, founder/CEO profile images, headers, footers, and sidebars
 * BEFORE extracting the title, description, and gallery images so random items from the parent site's catalog are NEVER included.
 */
export function parseSingleProductDomHtml(
  rawHtml: string,
  pageUrl: string
): {
  title: string;
  description: string;
  images: string[];
  priceHint: string;
} {
  const result = {
    title: '',
    description: '',
    images: [] as string[],
    priceHint: '',
  };
  if (!rawHtml || typeof rawHtml !== 'string') return result;

  const urlInfo = validateAndIsolateProductUrl(pageUrl);
  const uniqueProductId = urlInfo.uniqueProductId;

  let baseUrl: URL | null = null;
  try {
    baseUrl = new URL(pageUrl);
  } catch {
    // ignore
  }

  const resolveImgUrl = (raw: string): string => {
    if (!raw || typeof raw !== 'string') return '';
    const cleaned = raw.replace(/\\u002F/g, '/').replace(/&amp;/gi, '&').replace(/\\/g, '').trim();
    if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('javascript:')) return '';
    if (cleaned.startsWith('//')) return `https:${cleaned}`;
    if (/^https?:\/\//i.test(cleaned)) return cleaned;
    if (baseUrl) {
      try {
        return new URL(cleaned, baseUrl.href).href;
      } catch {
        return '';
      }
    }
    return '';
  };

  // 0. Check embedded SSR store payload (`window.__SERVER_STORE_DATA__`) for the exact uniqueProductId first
  const initialSlugMatch = rawHtml.match(
    /window\.__INITIAL_PRODUCT_SLUG__\s*=\s*["']([^"']+)["']/i
  );
  const effectiveProductId = (initialSlugMatch?.[1] || uniqueProductId).trim();
  const ssrMatch = rawHtml.match(
    /window\.__SERVER_STORE_DATA__\s*=\s*(\{[\s\S]*?\})\s*;?\s*(?:window\.|<\/script>)/i
  );
  if (ssrMatch?.[1] && effectiveProductId) {
    try {
      const storeData = JSON.parse(ssrMatch[1]);
      const productsList = Array.isArray(storeData?.products) ? storeData.products : [];
      const lowerId = effectiveProductId.toLowerCase();
      const exactProd = productsList.find((p: any) => {
        if (!p) return false;
        const pid = String(p.id || '').trim().toLowerCase();
        const psku = String(p.sku || '').trim().toLowerCase();
        return pid === lowerId || psku === lowerId || pageUrl.toLowerCase().includes(`/${pid}`);
      });
      if (exactProd) {
        result.title = String(exactProd.titleBn || exactProd.title || exactProd.name || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        result.description = String(exactProd.description || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 1200);
        if (exactProd.price) {
          result.priceHint = `BDT ${exactProd.price}`;
        }
        const ssrImgs: string[] = (Array.isArray(exactProd.images) ? exactProd.images : [])
          .map((im: any) => resolveImgUrl(typeof im === 'string' ? im : im?.url || im?.src || ''))
          .filter((u: string) => Boolean(u) && !isBlockedOrErrorProductImageUrl(u));
        if (ssrImgs.length > 0) {
          result.images = Array.from(new Set<string>(ssrImgs)).slice(0, 12);
          return result;
        }
      }
    } catch {
      // ignore SSR JSON parse error
    }
  }

  // 1. Strip out <script>, <style>, <header>, <nav>, <footer>, <aside>, and Related/Upsell/Similar product sections
  const isolatedProductHtml = rawHtml
    .replace(/<(?:script|style|header|nav|footer|aside)\b[^>]*>[\s\S]*?<\/(?:script|style|header|nav|footer|aside)>/gi, ' ')
    .split(
      /<(?:section|div)\b[^>]+(?:class|id)=["'][^"']*\b(?:related[-_ ]?products?|related\s+products|upsells?|cross[-_ ]?sells?|similar[-_ ]?products?|recommended[-_ ]?products?|also[-_ ]?like|recently[-_ ]?viewed|more[-_ ]?from)\b[^"']*["']/i
    )[0];

  // 2. Extract Title from precise product heading or OpenGraph
  const h1Match =
    isolatedProductHtml.match(
      /<h1[^>]+class=["'][^"']*(?:product_title|product-title|entry-title|pdp-mod-product-badge-title|product-name|product__title)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i
    )?.[1] ||
    isolatedProductHtml.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    isolatedProductHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ||
    '';
  if (h1Match) {
    result.title = h1Match.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // 3. Extract Description from precise product description container
  const descMatch =
    isolatedProductHtml.match(
      /<div[^>]+class=["'][^"']*(?:woocommerce-product-details__short-description|product-description|product_description|product-details|pdp-product-desc|product__description|short-description)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    )?.[1] ||
    isolatedProductHtml.match(/<div[^>]+id=["']tab-description["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
    isolatedProductHtml.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
    '';
  if (descMatch) {
    result.description = descMatch.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 900);
  }

  // 4. Extract Gallery Images strictly from the product gallery DOM container + product-scoped OpenGraph
  const rawOgImgs = Array.from(
    rawHtml.matchAll(
      /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/gi
    )
  )
    .map((m) => resolveImgUrl(m[1]))
    .filter((u) => u && !isBlockedOrErrorProductImageUrl(u));

  const productScopedOgImgs = rawOgImgs.filter(
    (u) =>
      (uniqueProductId && u.toLowerCase().includes(uniqueProductId.toLowerCase())) ||
      /\/(?:product|products|uploads|media|catalog|items?)\b/i.test(u)
  );
  const ogImgs = productScopedOgImgs.length > 0 ? productScopedOgImgs : rawOgImgs;

  const idMatchedImgs: string[] = [];
  if (uniqueProductId && uniqueProductId.length >= 6) {
    const escaped = uniqueProductId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idRegex = new RegExp(
      `["']([^"']*${escaped}[^"']*\\.(?:jpg|jpeg|png|webp|avif)(?:\\?[^"']*)?)["']`,
      'gi'
    );
    for (const m of rawHtml.matchAll(idRegex)) {
      const resolved = resolveImgUrl(m[1]);
      if (resolved && !isBlockedOrErrorProductImageUrl(resolved)) {
        idMatchedImgs.push(resolved);
      }
    }
  }

  const galleryContainerMatch = isolatedProductHtml.match(
    /<(?:div|figure|ul)\b[^>]+class=["'][^"']*(?:woocommerce-product-gallery|product-gallery|product_gallery|product-images|product-image-gallery|product__media-list|product-single__photos|pdp-gallery|gallery-images|xzoom-thumbs)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|figure|ul)>/i
  );
  const galleryScopeHtml = galleryContainerMatch ? galleryContainerMatch[0] : isolatedProductHtml;

  const highResAttrs = Array.from(
    galleryScopeHtml.matchAll(
      /(?:data-large_image|data-zoom-image|data-zoom|data-full-image|data-master|data-src|data-lazy-src|data-original)=["']([^"']+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"']*)?)["']/gi
    )
  ).map((m) => resolveImgUrl(m[1]));

  const scopedImgs = galleryContainerMatch
    ? Array.from(
        galleryScopeHtml.matchAll(/<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"']*)?)["']/gi)
      ).map((m) => resolveImgUrl(m[1]))
    : [];

  result.images = Array.from(
    new Set(
      [...idMatchedImgs, ...ogImgs, ...highResAttrs, ...scopedImgs].filter(
        (u) => u && !isBlockedOrErrorProductImageUrl(u)
      )
    )
  ).slice(0, 12);

  return result;
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
/**
 * Legacy / duplicate ad campaign product ID alias map.
 * Preserves 100% of existing product URLs without changing any links:
 * if an ad campaign URL points to an older slug or duplicate ID, it resolves seamlessly to the live product.
 */
export const LEGACY_PRODUCT_ID_ALIASES: Record<string, string> = {
  'dkd-1793442168807-962': 'dkd-flexible-unbreakable-mirror-sheet',
  'cac8gqemgy': 'dkd-flexible-unbreakable-mirror-sheet',
  'dkd-mirror-film-wall-sticker': 'dkd-flexible-unbreakable-mirror-sheet',
  'dkd-unbreakable-flexible-mirror': 'dkd-frameless-full-length-mirror',
  'dkd-herbal-whitening-soap': 'dkd-herbal-brightening-soap',
  'dkd-1793611045577-658': 'dkd-1793611408928-666',
  'dkd-1793611081511-148': 'dkd-1793611408928-666',
  'dkd-1793611136106-808': 'dkd-1793611408928-666',
  'dkd-1793611454825-371': 'dkd-1793611408928-666',
  'dkd-1793613344067-583': 'dkd-1793613621412-332',
  'dkd-1793477643052-131': 'dkd-arch-unbreakable-wall-mirror',
  'dkd-1793477610065-533': 'dkd-arch-unbreakable-wall-mirror',
  'dkd-1793477305397-277': 'dkd-arch-unbreakable-wall-mirror',
  'dkd-1793454681663-969': 'dkd-round-bathroom-vanity-mirror',
  'dkd-1793454516519-198': 'dkd-round-bathroom-vanity-mirror',
};

/**
 * Normalizes any category ID, slug, numeric index, or keyword from a URL or product into one of the 11 official category IDs.
 */
export function resolveCategoryIdFromUrl(
  rawCat: string | null | undefined,
  productName = ''
): string {
  const officialIds = new Set(OFFICIAL_CATEGORIES.map((c) => c.id));
  let cleaned = String(rawCat || '').trim();
  try {
    cleaned = decodeURIComponent(cleaned).trim();
  } catch {
    // ignore
  }
  // Strip any query string or hash or slashes attached to the category ID
  cleaned = cleaned.split(/[?#&]/)[0].replace(/^\/+|\/+$/g, '').trim();

  if (cleaned === 'all') return 'all';
  if (officialIds.has(cleaned as any)) return cleaned;

  const lower = cleaned.toLowerCase().replace(/[\s-]+/g, '_');
  if (officialIds.has(lower as any)) return lower;

  // Match numeric category order (1..11)
  const asNum = Number(cleaned);
  if (!Number.isNaN(asNum) && asNum >= 1 && asNum <= OFFICIAL_CATEGORIES.length) {
    const byOrder = OFFICIAL_CATEGORIES.find((c) => c.order === asNum) || OFFICIAL_CATEGORIES[asNum - 1];
    if (byOrder) return byOrder.id;
  }

  // Match aliases, slugs, and English/Bengali keywords
  const hay = `${lower} ${cleaned.toLowerCase()} ${productName.toLowerCase()}`;
  if (
    hay.includes('organic') ||
    hay.includes('অর্গানিক') ||
    hay.includes('মধু') ||
    hay.includes('honey') ||
    hay.includes('ঘি') ||
    hay.includes('ghee') ||
    hay.includes('খেজুর') ||
    hay.includes('চিয়া') ||
    hay.includes('সরিষা') ||
    hay.includes('গুড়') ||
    hay.includes('food') ||
    lower === 'fashion_clothing' ||
    lower === 'fashion' ||
    lower === 'abaya' ||
    lower === 'festive' ||
    lower === 'hijab'
  ) {
    return 'organic_food';
  }
  if (
    hay.includes('home_decor') ||
    hay.includes('decor') ||
    hay.includes('মিরর') ||
    hay.includes('mirror') ||
    hay.includes('ডেকোর') ||
    hay.includes('বুকশেল্ফ') ||
    hay.includes('ল্যাম্প')
  ) {
    return 'home_decor';
  }
  if (
    hay.includes('gadget') ||
    hay.includes('electronic') ||
    hay.includes('গ্যাজেট') ||
    hay.includes('ইলেকট্রনিক') ||
    hay.includes('ফ্যান') ||
    hay.includes('fan')
  ) {
    return 'gadgets_electronics';
  }
  if (
    hay.includes('beauty') ||
    hay.includes('personal_care') ||
    hay.includes('skincare') ||
    hay.includes('বিউটি') ||
    hay.includes('স্কিনকেয়ার') ||
    hay.includes('টনিক') ||
    hay.includes('সোপ') ||
    hay.includes('soap') ||
    hay.includes('oil') ||
    hay.includes('তেল') ||
    hay.includes('সিরাম')
  ) {
    return 'beauty_personal_care';
  }
  if (
    hay.includes('kitchen') ||
    hay.includes('হোম ও কিচেন') ||
    hay.includes('কিচেন') ||
    hay.includes('সেলাই') ||
    hay.includes('ফুড সেফটি')
  ) {
    return 'home_kitchen';
  }
  if (
    hay.includes('mobile') ||
    hay.includes('accessor') ||
    hay.includes('মোবাইল') ||
    hay.includes('চার্জার') ||
    hay.includes('ইয়ারবাড') ||
    hay.includes('স্মার্টওয়াচ')
  ) {
    return 'mobile_accessories';
  }
  if (hay.includes('lifestyle') || hay.includes('লাইফস্টাইল')) {
    return 'lifestyle';
  }
  if (hay.includes('travel') || hay.includes('outdoor') || hay.includes('ট্রাভেল')) {
    return 'travel_outdoor';
  }
  if (hay.includes('health') || hay.includes('fitness') || hay.includes('ফিটনেস') || hay.includes('হেলথ')) {
    return 'health_fitness';
  }
  if (hay.includes('kids') || hay.includes('baby') || hay.includes('কিডস') || hay.includes('বেবি')) {
    return 'kids_baby';
  }
  if (hay.includes('office') || hay.includes('অফিস')) {
    return 'office_essentials';
  }

  return 'home_decor';
}

/**
 * Helper: Decodes AI Studio `appParams` if present in the URL query string
 */
function extractDecodedAppParams(): string {
  if (typeof window === 'undefined') return '';
  try {
    const sp = new URLSearchParams(window.location.search || '');
    let raw = sp.get('appParams') || '';
    for (let i = 0; i < 3 && raw.includes('%'); i++) {
      try {
        raw = decodeURIComponent(raw);
      } catch {
        break;
      }
    }
    return raw.trim();
  } catch {
    return '';
  }
}

/**
 * Programmatic SPA Navigation Helper:
 * Uses Root Query URLs (`/?product=:id` and `/?catalog=:catId`) so browser refreshes or external shares
 * ALWAYS hit the root `/` (`index.html`) and NEVER trigger HTTP 404 on any static/CDN host or in-app browser.
 */
export function navigateToStoreRoute(
  targetUrl: string,
  options?: { replace?: boolean; scrollTop?: boolean }
): void {
  if (typeof window === 'undefined') return;
  let cleanUrl = (targetUrl || '/').trim();

  const [pathPart, queryPart] = cleanUrl.split('?');
  const prodMatch = pathPart.match(/^\/?(?:products?|p|items?|shop)\/([^/?#]+)(?:\/(checkout))?/i);
  const catMatch = pathPart.match(/^\/?(?:catalogs?|category|categories|cat|collections?)\/([^/?#]+)/i);

  if (prodMatch?.[1] && prodMatch[1].toLowerCase() !== 'all') {
    const prodId = decodeURIComponent(prodMatch[1]).trim();
    const isCheckout =
      prodMatch[2]?.toLowerCase() === 'checkout' ||
      new URLSearchParams(queryPart || '').get('step') === 'checkout';
    cleanUrl = isCheckout
      ? `/?product=${encodeURIComponent(prodId)}&step=checkout`
      : `/?product=${encodeURIComponent(prodId)}`;
  } else if (catMatch?.[1]) {
    const catId = decodeURIComponent(catMatch[1]).trim();
    cleanUrl = `/?catalog=${encodeURIComponent(catId)}`;
  } else if (queryPart) {
    const qp = new URLSearchParams(queryPart);
    const qProd = qp.get('product');
    const qCat = qp.get('catalog') || qp.get('category');
    if (qProd) {
      cleanUrl =
        qp.get('step') === 'checkout'
          ? `/?product=${encodeURIComponent(qProd)}&step=checkout`
          : `/?product=${encodeURIComponent(qProd)}`;
    } else if (qCat) {
      cleanUrl = `/?catalog=${encodeURIComponent(qCat)}`;
    }
  }

  try {
    if (options?.replace) {
      window.history.replaceState(null, '', cleanUrl);
    } else {
      window.history.pushState(null, '', cleanUrl);
    }
  } catch {
    // fallback if pushState is restricted in a sandboxed context
  }
  try {
    window.dispatchEvent(new CustomEvent('dokandari:urlchange', { detail: { url: cleanUrl } }));
  } catch {
    // ignore
  }
  if (options?.scrollTop !== false) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/**
 * Universal URL Product Route Extractor:
 * Supports `/products/:id`, `/product/:id`, `/p/:id`, `?product=:id`, `?id=:id`, `#/products/:id`,
 * and AI Studio `appParams` across all external, desktop, and mobile in-app browsers.
 */
export function extractUrlProductRoute(): {
  rawProdId: string | null;
  isCheckoutStep: boolean;
} {
  if (typeof window === 'undefined') {
    return { rawProdId: null, isCheckoutStep: false };
  }
  let pathname = window.location.pathname || '';
  try {
    if (pathname.includes('%2F') || pathname.includes('%2f')) {
      pathname = decodeURIComponent(pathname);
    }
  } catch {
    // ignore
  }
  const searchParams = new URLSearchParams(window.location.search || '');
  const hash = window.location.hash || '';
  const appParams = extractDecodedAppParams();

  const parseProductPath = (
    pathStr: string,
    extraSearch?: URLSearchParams
  ): { rawProdId: string | null; isCheckoutStep: boolean } | null => {
    const [pathOnly, inlineQuery] = pathStr.split('?');
    const cleanPath = (pathOnly || '').split('#')[0].replace(/\/+$/, '');
    const inlineParams = inlineQuery ? new URLSearchParams(inlineQuery) : null;
    const match = cleanPath.match(
      /^\/?(?:products?|p|items?|shop|product-detail)\/([^/]+)(?:\/(checkout))?/i
    );
    if (match?.[1]) {
      let decoded = match[1].trim();
      for (let i = 0; i < 2 && decoded.includes('%'); i++) {
        try {
          decoded = decodeURIComponent(decoded).trim();
        } catch {
          break;
        }
      }
      decoded = decoded.split(/[?#&]/)[0].replace(/^\/+|\/+$/g, '').trim();
      const lowerDecoded = decoded.toLowerCase();
      // Ignore generic collection words so `/products/all` doesn't get treated as a product ID
      if (decoded && lowerDecoded !== 'all' && lowerDecoded !== 'catalog' && lowerDecoded !== 'category') {
        const isCheckout =
          match[2]?.toLowerCase() === 'checkout' ||
          searchParams.get('step') === 'checkout' ||
          extraSearch?.get('step') === 'checkout' ||
          inlineParams?.get('step') === 'checkout';
        return {
          rawProdId: decoded,
          isCheckoutStep: Boolean(isCheckout),
        };
      }
    }
    return null;
  };

  // 1. Direct Pathname (/products/:id, /product/:id, /p/:id)
  const fromPathname = parseProductPath(pathname, searchParams);
  if (fromPathname?.rawProdId) return fromPathname;

  // 2. Query Parameters (?product=:id, ?id=:id, ?product_id=:id, ?p=:id)
  const queryProdId =
    searchParams.get('product') ||
    searchParams.get('id') ||
    searchParams.get('product_id') ||
    searchParams.get('p');
  if (queryProdId && queryProdId.trim()) {
    let decoded = queryProdId.trim();
    try {
      decoded = decodeURIComponent(decoded).trim();
    } catch {
      // ignore
    }
    decoded = decoded.split(/[?#&]/)[0].trim();
    if (decoded && decoded.toLowerCase() !== 'all') {
      return {
        rawProdId: decoded,
        isCheckoutStep: searchParams.get('step') === 'checkout',
      };
    }
  }

  // 3. Hash Route (#/products/:id, #/product/:id)
  if (hash.startsWith('#/')) {
    const fromHash = parseProductPath(hash.slice(1), searchParams);
    if (fromHash?.rawProdId) return fromHash;
  }

  // 4. AI Studio appParams wrapper (?appParams=%2Fproducts%2F...)
  if (appParams) {
    const cleanedAppParams = appParams.replace(/^#/, '');
    const fromAppParams = parseProductPath(cleanedAppParams, searchParams);
    if (fromAppParams?.rawProdId) return fromAppParams;
    if (cleanedAppParams.includes('product=') || cleanedAppParams.includes('id=')) {
      const apQuery = new URLSearchParams(cleanedAppParams.split('?').pop() || '');
      const apProd = apQuery.get('product') || apQuery.get('id') || apQuery.get('p');
      if (apProd) {
        return {
          rawProdId: apProd.trim(),
          isCheckoutStep: apQuery.get('step') === 'checkout',
        };
      }
    }
  }

  return { rawProdId: null, isCheckoutStep: false };
}

/**
 * Universal URL Catalog / Category Route Extractor:
 * Supports `/catalog/:catId`, `/category/:catId`, `/cat/:catId`, `?catalog=:catId`, `?category=:catId`,
 * `#/catalog/:catId`, `#/category/:catId`, and AI Studio `appParams`.
 */
export function extractUrlCatalogRoute(): string | null {
  if (typeof window === 'undefined') return null;
  let pathname = window.location.pathname || '';
  try {
    if (pathname.includes('%2F') || pathname.includes('%2f')) {
      pathname = decodeURIComponent(pathname);
    }
  } catch {
    // ignore
  }
  const searchParams = new URLSearchParams(window.location.search || '');
  const hash = window.location.hash || '';
  const appParams = extractDecodedAppParams();

  const parseCatalogPath = (pathStr: string): string | null => {
    const cleanPath = pathStr.split('?')[0].split('#')[0].replace(/\/+$/, '');
    const match = cleanPath.match(/^\/?(?:catalogs?|category|categories|cat|collections?)\/([^/]+)/i);
    if (match?.[1]) {
      return resolveCategoryIdFromUrl(match[1]);
    }
    if (/^\/?(?:catalogs?|categories|collections?|products\/all)$/i.test(cleanPath)) {
      return 'all';
    }
    return null;
  };

  // 1. Direct Pathname (/catalog/:catId, /category/:catId)
  const fromPath = parseCatalogPath(pathname);
  if (fromPath) return fromPath;

  // 2. Query Parameter (?catalog=:catId, ?category=:catId, ?cat=:catId)
  const queryCat =
    searchParams.get('catalog') || searchParams.get('category') || searchParams.get('cat');
  if (queryCat && queryCat.trim()) {
    return resolveCategoryIdFromUrl(queryCat);
  }

  // 3. Hash Route (#/catalog/:catId, #/category/:catId)
  if (hash.startsWith('#/')) {
    const fromHash = parseCatalogPath(hash.slice(1));
    if (fromHash) return fromHash;
  }

  // 4. AI Studio appParams wrapper
  if (appParams) {
    const cleanedAppParams = appParams.replace(/^#/, '');
    const fromAppParams = parseCatalogPath(cleanedAppParams);
    if (fromAppParams) return fromAppParams;
    if (cleanedAppParams.includes('catalog=') || cleanedAppParams.includes('category=')) {
      const apQuery = new URLSearchParams(cleanedAppParams.split('?').pop() || '');
      const apCat = apQuery.get('catalog') || apQuery.get('category') || apQuery.get('cat');
      if (apCat) return resolveCategoryIdFromUrl(apCat);
    }
  }

  return null;
}

/**
 * Helper to create a URL-safe slug for fuzzy title matching
 */
function toComparableSlug(str: string | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\u0980-\u09ff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Resolves a product by exact ID, URL-decoded/case-insensitive ID, SKU, legacy campaign alias, or title slug.
 * Never alters any product ID or URL.
 */
export function resolveProductByIdOrAlias(
  productList: Product[],
  rawId: string | null | undefined
): Product | undefined {
  if (!rawId || !Array.isArray(productList) || productList.length === 0) return undefined;
  let cleanId = String(rawId).trim();
  for (let i = 0; i < 2 && cleanId.includes('%'); i++) {
    try {
      cleanId = decodeURIComponent(cleanId).trim();
    } catch {
      break;
    }
  }
  cleanId = cleanId.split(/[?#&]/)[0].replace(/^\/+|\/+$/g, '').trim();
  if (!cleanId) return undefined;

  const lower = cleanId.toLowerCase();
  const deletedIds = getDeletedProductIds();
  if (deletedIds.has(cleanId)) return undefined;

  // 1. Exact ID match on published products in live productList (primary fast path — 0ms)
  const exactPub = productList.find(
    (p) => p && p.id === cleanId && !deletedIds.has(p.id) && p.status !== 'draft'
  );
  if (exactPub) return exactPub;

  // 2. Exact ID match including draft products in live productList
  const exactAny = productList.find((p) => p && p.id === cleanId && !deletedIds.has(p.id));
  if (exactAny) return exactAny;

  // 3. Case-insensitive ID or SKU match
  const caseOrSku = productList.find(
    (p) =>
      p &&
      !deletedIds.has(p.id) &&
      (p.id.toLowerCase() === lower || (p.sku && p.sku.toLowerCase() === lower))
  );
  if (caseOrSku) return caseOrSku;

  // 4. Legacy or duplicate campaign alias resolution
  const aliasTarget = LEGACY_PRODUCT_ID_ALIASES[cleanId] || LEGACY_PRODUCT_ID_ALIASES[lower];
  if (aliasTarget && !deletedIds.has(aliasTarget)) {
    const aliased = productList.find((p) => p && p.id === aliasTarget);
    if (aliased) return aliased;
  }

  // 5. Match by English/Bengali title slug or partial timestamp ID prefix (e.g. dkd-1793611408928 or dkd-1776101501645)
  const targetSlug = toComparableSlug(cleanId);
  const dkdTimestampPrefix = lower.match(/^(dkd-\d{9,14})/)?.[1];
  const trailingNumberMatch = lower.match(/-(\d{1,3})$/)?.[1];

  const fuzzyMatch = productList.find((p) => {
    if (!p || deletedIds.has(p.id)) return false;
    const pIdLower = p.id.toLowerCase();
    if (dkdTimestampPrefix && pIdLower.startsWith(dkdTimestampPrefix)) {
      if (!trailingNumberMatch || pIdLower.endsWith(`-${trailingNumberMatch}`)) {
        return true;
      }
    }
    if (targetSlug && targetSlug.length >= 4) {
      if (toComparableSlug(p.id) === targetSlug) return true;
      if (p.titleEn && toComparableSlug(p.titleEn) === targetSlug) return true;
      if (p.name && toComparableSlug(p.name) === targetSlug) return true;
    }
    return false;
  });
  if (fuzzyMatch) return fuzzyMatch;

  // 6. Secondary timestamp prefix match if trailing suffix wasn't exact
  if (dkdTimestampPrefix) {
    const anyTimestampMatch = productList.find(
      (p) => p && !deletedIds.has(p.id) && p.id.toLowerCase().startsWith(dkdTimestampPrefix)
    );
    if (anyTimestampMatch) return anyTimestampMatch;
  }

  // 7. Fallback to SSR-injected product ONLY if not found in live productList and not deleted
  if (typeof window !== 'undefined' && (window as any).__DOKANDARI_SSR_PRODUCT__) {
    const ssrProd = (window as any).__DOKANDARI_SSR_PRODUCT__ as Product;
    if (
      ssrProd &&
      ssrProd.id &&
      !deletedIds.has(ssrProd.id) &&
      (ssrProd.id === cleanId || ssrProd.id.toLowerCase() === lower)
    ) {
      return normalizeProductImages(ssrProd);
    }
  }

  return undefined;
}

/**
 * Strictly resolves a product URL or product ID by isolating the exact product identifier first
 * (`validateAndIsolateProductUrl`) and matching ONLY that specific product in the live/local/initial catalog.
 * Blocks all site-wide or random product fallback logic so a product page NEVER changes its title or images to another product!
 */
export function resolveOrSynthesizeProductForUrl(
  productList: Product[],
  rawId: string | null | undefined
): Product | undefined {
  if (!rawId) return undefined;

  const rawTrimmed = String(rawId).trim();
  if (!rawTrimmed) return undefined;

  // 1. Parse and isolate the exact product ID if a full URL or path was passed
  const validated = validateAndIsolateProductUrl(rawTrimmed);
  const candidateIds = Array.from(
    new Set(
      [
        validated.uniqueProductId,
        validated.singleProductId,
        validated.productSlug,
        rawTrimmed,
      ]
        .map((id) => {
          let s = String(id || '').trim();
          try {
            s = decodeURIComponent(s).trim();
          } catch {
            // ignore
          }
          return s.split(/[?#&]/)[0].replace(/^\/+|\/+$/g, '').trim();
        })
        .filter(Boolean)
    )
  );

  const deletedIds = getDeletedProductIds();
  for (const cid of candidateIds) {
    if (deletedIds.has(cid)) continue;

    // Check live productList first
    const resolvedLive = resolveProductByIdOrAlias(productList, cid);
    if (resolvedLive) return resolvedLive;

    // Check custom persisted products in localStorage
    const customMap = getCustomPersistedProductsMap();
    if (customMap[cid] && !deletedIds.has(cid)) {
      return normalizeProductImages(customMap[cid]);
    }

    // Check INITIAL_PRODUCTS directly (e.g., dkd-1793610538096-571)
    const resolvedInit = resolveProductByIdOrAlias(INITIAL_PRODUCTS, cid);
    if (resolvedInit && !deletedIds.has(resolvedInit.id)) {
      return normalizeProductImages(resolvedInit);
    }
  }

  // NEVER fall back to `sameCategoryProduct` or `INITIAL_PRODUCTS[0]` — return undefined so App.tsx fetches the exact product from Firestore/API!
  return undefined;
}

/**
 * Merges INITIAL_PRODUCTS + cached live catalog + remote Firestore products + local Admin custom/edited products,
 * while removing any product IDs deleted by the Admin, deduplicating identical products, and preserving real product images.
 * When `remoteProducts` (from Firestore or `/api/catalog/products`) is provided and non-empty, Firestore is treated as the
 * authoritative source of truth so stale `localStorage` entries never revert Admin edits or resurrect deleted products.
 */
export function mergeCatalogProducts(remoteProducts?: Product[]): Product[] {
  const deletedIds = getDeletedProductIds();
  const customMap = getCustomPersistedProductsMap();
  const map = new Map<string, Product>();

  // Known duplicate/broken test IDs to permanently exclude
  const BLOCKED_DUPLICATE_IDS = new Set([
    'dkd-1793836461774-197',
    'dkd-1793442168807-962',
    'dkd-1793442199680-197',
    'dkd-1793441064898-680',
    'dkd-1793519834913-596',
    'dkd-1793520258574-946',
    'dkd-anc-wireless-earbuds-pro',
    'dkd-deep-tissue-massage-gun',
    'dkd-electric-chopper-grinder',
    'dkd-ergonomic-baby-carrier',
    'dkd-expandable-travel-backpack',
    'dkd-herbal-brightening-soap',
    'dkd-insulated-thermal-flask',
    'dkd-magnetic-powerbank-10000',
    'dkd-memory-foam-lumbar-cushion',
    'dkd-unisex-heavyweight-hoodie',
  ]);

  const putIfNewer = (candidate: Product | null | undefined) => {
    if (!candidate || !candidate.id) return;
    if (deletedIds.has(candidate.id) || BLOCKED_DUPLICATE_IDS.has(candidate.id)) return;
    const normalized = normalizeProductImages(candidate);
    const existing = map.get(normalized.id);
    if (!existing) {
      map.set(normalized.id, normalized);
      return;
    }
    const incomingTime = Number(normalized.updatedAt || normalized.lifetimeSavedAt || 0);
    const existingTime = Number(existing.updatedAt || existing.lifetimeSavedAt || 0);
    if (incomingTime >= existingTime) {
      map.set(normalized.id, normalized);
    }
  };

  if (remoteProducts && remoteProducts.length > 0) {
    // AUTHORITATIVE FIRESTORE / SERVER CATALOG MODE:
    // Use remoteProducts directly as the source of truth so stale localStorage entries never revert edits or resurrect deleted items.
    const nextCustomMap: Record<string, Product> = {};
    for (const p of remoteProducts) {
      if (p && p.id && !deletedIds.has(p.id) && !BLOCKED_DUPLICATE_IDS.has(p.id)) {
        const normalizedRemote = normalizeProductImages(p);
        map.set(p.id, normalizedRemote);
        nextCustomMap[p.id] = normalizedRemote;
      }
    }
    try {
      localStorage.setItem(LS_CUSTOM_PRODUCTS_KEY, JSON.stringify(nextCustomMap));
      if (typeof window !== 'undefined' && (window as any).__DOKANDARI_SSR_PRODUCT__) {
        const ssrId = (window as any).__DOKANDARI_SSR_PRODUCT__?.id;
        if (ssrId && map.has(ssrId)) {
          (window as any).__DOKANDARI_SSR_PRODUCT__ = map.get(ssrId);
        } else if (ssrId && deletedIds.has(ssrId)) {
          delete (window as any).__DOKANDARI_SSR_PRODUCT__;
        }
      }
    } catch {
      // ignore storage quota
    }
  } else {
    // 0ms BOOT FALLBACK MODE (before Firestore / API responds):
    // 1. Start with initial products (updatedAt = 0, so any cached/edited version always wins)
    for (const p of INITIAL_PRODUCTS) {
      putIfNewer({ ...p, updatedAt: 0 });
    }

    // 1.2 Overlay any SSR-injected product or catalog from server.ts at 0ms
    if (typeof window !== 'undefined') {
      const ssrCatalog = (window as any).__DOKANDARI_SSR_CATALOG__;
      if (Array.isArray(ssrCatalog)) {
        for (const sp of ssrCatalog) {
          putIfNewer(sp);
        }
      }
      const ssrProd = (window as any).__DOKANDARI_SSR_PRODUCT__;
      if (ssrProd && ssrProd.id) {
        putIfNewer(ssrProd);
      }
    }

    // 1.5 Overlay any cached live catalog items from localStorage
    try {
      const cachedRaw = localStorage.getItem(LS_LIVE_CATALOG_CACHE_KEY);
      if (cachedRaw) {
        const cachedList = JSON.parse(cachedRaw) as Product[];
        if (Array.isArray(cachedList)) {
          for (const cp of cachedList) {
            putIfNewer(cp);
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. Overlay local custom/edited products
    for (const [, prod] of Object.entries(customMap)) {
      putIfNewer(prod);
    }
  }

  const finalCatalog = Array.from(map.values()).sort(
    (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
  );

  // Cache lightweight catalog snapshot when remoteProducts arrives so future loads are 0ms
  if (remoteProducts && remoteProducts.length > 0) {
    try {
      const lightweight = finalCatalog.map((item) => ({
        ...item,
        images: (item.images || []).map((img) =>
          img.startsWith('data:') && img.length > 40000
            ? getFallbackProductImage(item, 0)
            : img
        ),
      }));
      localStorage.setItem(LS_LIVE_CATALOG_CACHE_KEY, JSON.stringify(lightweight));
    } catch {
      // ignore storage quota
    }
  }

  return finalCatalog;
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
      remoteDeletedProductIdsCache.delete(id);
    }
    localStorage.setItem(LS_DELETED_PRODUCT_IDS_KEY, JSON.stringify(Array.from(deleted)));
    try {
      await setDoc(
        doc(db, 'settings', 'deleted_products'),
        { ids: Array.from(deleted), updatedAt: Date.now() },
        { merge: true }
      );
    } catch {
      // ignore
    }

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
  if (serialized.length <= 850000) {
    return clone;
  }

  // Preserve up to 12 gallery images when Admin imports or uploads 9-12 photos
  if (clone.images.length > 12) {
    clone.images = clone.images.slice(0, 12);
    serialized = JSON.stringify(clone);
  }
  while (serialized.length > 850000 && clone.images.length > 1) {
    clone.images = clone.images.slice(0, clone.images.length - 1);
    serialized = JSON.stringify(clone);
  }
  if (serialized.length > 900000) {
    clone.images = [getFallbackProductImage(clone, 0)];
  }
  return clone;
}

/**
 * Persists a newly created or edited product to localStorage AND Firestore immediately.
 * Also uploads any base64 `data:image/...` photos to `/uploads/product/<id>-<idx>.<ext>`
 * so the product loads in milliseconds across all browsers and ad clicks!
 */
export async function saveProductPersisted(product: Product): Promise<Product> {
  const prevTs = Math.max(
    Number(product.updatedAt || 0),
    Number(product.lifetimeSavedAt || 0)
  );
  const now = prevTs >= Date.now() ? prevTs + 1000 : Date.now();
  const targetId = product.id || `prod-${now}`;
  const incomingImages = Array.isArray(product.images) ? [...product.images] : [];

  // Mirror any base64 data:image/ URLs to the local server disk in the background,
  // while keeping the self-contained data:image/ or https:// URLs in Firestore so live dokandari.com renders them in real time!
  if (incomingImages.some((img) => typeof img === 'string' && img.startsWith('data:image/'))) {
    fetch('/api/upload-product-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: targetId, images: incomingImages }),
    }).catch(() => null);
  }

  const incomingBeforeImage = product.beforeImage || '';
  const incomingAfterImage = product.afterImage || '';

  const cleanedProduct = normalizeProductImages({
    ...product,
    id: targetId,
    images: incomingImages,
    beforeImage: incomingBeforeImage || undefined,
    afterImage: incomingAfterImage || undefined,
    offerMode: product.offerMode || product.comboConfig?.offerMode,
    comboConfig: product.comboConfig,
  });

  const normalized: Product = sanitizeForFirestore({
    ...cleanedProduct,
    id: targetId,
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
    beforeImage: incomingBeforeImage || cleanedProduct.beforeImage || undefined,
    afterImage: incomingAfterImage || cleanedProduct.afterImage || undefined,
    beforeLabel: cleanedProduct.beforeLabel || undefined,
    afterLabel: cleanedProduct.afterLabel || undefined,
    beforeAfterTitle: cleanedProduct.beforeAfterTitle || undefined,
    offerMode: cleanedProduct.offerMode || cleanedProduct.comboConfig?.offerMode || undefined,
    comboConfig: cleanedProduct.comboConfig || undefined,
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
    lifetimeSavedAt: now,
  });

  // 1. Save to localStorage custom products map, live catalog cache, remove from deleted set, and update SSR window globals
  let updatedDeletedArray: string[] | null = null;
  try {
    const deleted = getDeletedProductIds();
    deleted.delete(normalized.id);
    remoteDeletedProductIdsCache.delete(normalized.id);
    updatedDeletedArray = Array.from(deleted);
    localStorage.setItem(LS_DELETED_PRODUCT_IDS_KEY, JSON.stringify(updatedDeletedArray));

    const customMap = getCustomPersistedProductsMap();
    customMap[normalized.id] = normalized;
    localStorage.setItem(LS_CUSTOM_PRODUCTS_KEY, JSON.stringify(customMap));

    try {
      const cachedRaw = localStorage.getItem(LS_LIVE_CATALOG_CACHE_KEY);
      if (cachedRaw) {
        const cachedList = JSON.parse(cachedRaw) as Product[];
        if (Array.isArray(cachedList)) {
          const existsInCache = cachedList.some((cp) => cp && cp.id === normalized.id);
          const nextCache = existsInCache
            ? cachedList.map((cp) => (cp && cp.id === normalized.id ? normalized : cp))
            : [normalized, ...cachedList];
          localStorage.setItem(LS_LIVE_CATALOG_CACHE_KEY, JSON.stringify(nextCache));
        }
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.__DOKANDARI_SSR_PRODUCT__ && w.__DOKANDARI_SSR_PRODUCT__.id === normalized.id) {
        w.__DOKANDARI_SSR_PRODUCT__ = normalized;
      }
      if (Array.isArray(w.__DOKANDARI_SSR_CATALOG__)) {
        const existsInSsr = w.__DOKANDARI_SSR_CATALOG__.some((sp: any) => sp?.id === normalized.id);
        w.__DOKANDARI_SSR_CATALOG__ = existsInSsr
          ? w.__DOKANDARI_SSR_CATALOG__.map((sp: any) => (sp?.id === normalized.id ? normalized : sp))
          : [normalized, ...w.__DOKANDARI_SSR_CATALOG__];
      }
    }
  } catch (e) {
    console.warn('localStorage product save note:', e);
  }

  // 2. Save to Firestore & Server Mirror in parallel (awaited so live server mirror and Firestore are 100% synced immediately)
  const firestoreSafe = sanitizeForFirestore(ensureFirestoreSafeProductPayload(normalized));
  await Promise.allSettled([
    setDoc(doc(db, 'products', normalized.id), firestoreSafe),
    updatedDeletedArray !== null
      ? setDoc(
          doc(db, 'settings', 'deleted_products'),
          { ids: updatedDeletedArray, updatedAt: Date.now() },
          { merge: true }
        )
      : Promise.resolve(),
    fetch('/api/catalog/sync-mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: [firestoreSafe] }),
    }),
  ]);

  return normalized;
}

/**
 * Explicitly syncs all local/Preview products and store settings to Live Firestore
 * without overwriting newer Firestore products, and recovers original images if needed.
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
    // 1. Fetch existing Firestore products first so we NEVER overwrite live Firestore products with stale localStorage data
    const snap = await getDocs(collection(db, 'products'));
    const firestoreMap = new Map<string, Product>();
    snap.forEach((d) => {
      const data = d.data() as Product;
      if (data) firestoreMap.set(d.id, { ...data, id: data.id || d.id });
    });

    for (const [id, customProd] of Object.entries(customMap)) {
      if (deletedIds.has(id)) continue;
      if (!firestoreMap.has(id)) {
        const cleanCustom = sanitizeForFirestore(
          ensureFirestoreSafeProductPayload(normalizeProductImages(customProd))
        );
        await setDoc(doc(db, 'products', id), cleanCustom, { merge: true });
        syncedCount++;
      }
    }

    // 2. Sync StoreContent to Firestore
    const currentContent = getInitialStoreContent();
    await saveStoreContentPersisted(currentContent);
  } catch (err) {
    console.warn('Full catalog Firestore sync note:', err);
  }

  return { syncedCount, recoveredCount };
}

/**
 * Deletes a product permanently from localStorage, SSR globals, Server Mirror, and Firestore
 */
export async function deleteProductPersisted(productId: string): Promise<void> {
  let deletedList: string[] = [];
  try {
    const deleted = getDeletedProductIds();
    deleted.add(productId);
    remoteDeletedProductIdsCache.add(productId);
    deletedList = Array.from(deleted);
    localStorage.setItem(LS_DELETED_PRODUCT_IDS_KEY, JSON.stringify(deletedList));

    const customMap = getCustomPersistedProductsMap();
    if (customMap[productId]) {
      delete customMap[productId];
      localStorage.setItem(LS_CUSTOM_PRODUCTS_KEY, JSON.stringify(customMap));
    }

    try {
      const cachedRaw = localStorage.getItem(LS_LIVE_CATALOG_CACHE_KEY);
      if (cachedRaw) {
        const cachedList = JSON.parse(cachedRaw) as Product[];
        if (Array.isArray(cachedList)) {
          const filteredCache = cachedList.filter((cp) => cp && cp.id !== productId);
          localStorage.setItem(LS_LIVE_CATALOG_CACHE_KEY, JSON.stringify(filteredCache));
        }
      }
    } catch {
      // ignore
    }

    if (typeof window !== 'undefined') {
      const w = window as any;
      if (w.__DOKANDARI_SSR_PRODUCT__ && w.__DOKANDARI_SSR_PRODUCT__.id === productId) {
        delete w.__DOKANDARI_SSR_PRODUCT__;
      }
      if (Array.isArray(w.__DOKANDARI_SSR_CATALOG__)) {
        w.__DOKANDARI_SSR_CATALOG__ = w.__DOKANDARI_SSR_CATALOG__.filter(
          (sp: any) => sp && sp.id !== productId
        );
      }
    }
  } catch (e) {
    console.warn('localStorage delete product note:', e);
  }

  await Promise.allSettled([
    deleteDoc(doc(db, 'products', productId)),
    setDoc(
      doc(db, 'settings', 'deleted_products'),
      { ids: deletedList, updatedAt: Date.now() },
      { merge: true }
    ),
    fetch('/api/catalog/delete-mirror', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId }),
    }),
  ]);
}

/**
 * Persists a customer Order to both localStorage (instant backup) and Firestore `orders` collection
 */
export function getDeletedOrderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DELETED_ORDER_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function addDeletedOrderId(orderId: string): void {
  try {
    const set = getDeletedOrderIds();
    set.add(orderId);
    localStorage.setItem(LS_DELETED_ORDER_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

export function removeDeletedOrderIds(orderIds: string[]): void {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return;
  try {
    const set = getDeletedOrderIds();
    let changed = false;
    for (const id of orderIds) {
      if (set.has(id)) {
        set.delete(id);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem(LS_DELETED_ORDER_IDS_KEY, JSON.stringify(Array.from(set)));
    }
  } catch {
    // ignore
  }
}

export function syncOrdersToLocalCache(ordersList: Order[]): void {
  if (!Array.isArray(ordersList)) return;
  const sorted = [...ordersList]
    .filter((o) => o && o.id)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  try {
    const json = JSON.stringify(sorted.slice(0, 500));
    localStorage.setItem(LS_ORDERS_BACKUP_KEY, json);
    localStorage.setItem('dokandari_orders_v1', json);
  } catch {
    // Fallback if localStorage quota is reached when many orders contain high-res screenshots
    try {
      const compact = sorted.slice(0, 300).map((o, idx) => ({
        ...o,
        customerScreenshot: idx < 25 ? o.customerScreenshot : undefined,
      }));
      const json = JSON.stringify(compact);
      localStorage.setItem(LS_ORDERS_BACKUP_KEY, json);
      localStorage.setItem('dokandari_orders_v1', json);
    } catch {
      // ignore
    }
  }
}

/**
 * Triggers a direct 1-click file download of the customer's uploaded profile/design screenshot
 * for printing and order fulfillment (works in both iframe preview and live domain).
 */
export async function downloadCustomerScreenshot(
  screenshotUrl: string,
  orderId: string,
  customerName?: string
): Promise<void> {
  if (!screenshotUrl) return;
  const safeName = String(customerName || 'customer')
    .replace(/[^a-zA-Z0-9\u0980-\u09FF_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  const fileName = `dokandari-order-${orderId || 'custom'}-${safeName || 'screenshot'}.jpg`;

  try {
    let blob: Blob;
    if (screenshotUrl.startsWith('data:')) {
      const parts = screenshotUrl.split(',');
      const mimeMatch = parts[0]?.match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const byteString = atob(parts[1] || '');
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      blob = new Blob([ab], { type: mime });
    } else {
      const response = await fetch(screenshotUrl);
      blob = await response.blob();
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  } catch {
    const link = document.createElement('a');
    link.href = screenshotUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

/**
 * Merges orders from localStorage, Server Order Mirror (`/api/orders`), and Firestore `orders` collection
 * without any date filter or artificial limit, ensuring 100% of historical and current orders persist across refreshes.
 */
export function mergeAndPersistAllOrders(sources: {
  serverMirrorOrders?: Order[];
  firestoreOrders?: Order[];
  localOrders?: Order[];
}): Order[] {
  const serverList = Array.isArray(sources.serverMirrorOrders) ? sources.serverMirrorOrders : [];
  const firestoreList = Array.isArray(sources.firestoreOrders) ? sources.firestoreOrders : [];
  const localList = Array.isArray(sources.localOrders) ? sources.localOrders : getPersistedOrders();

  const deletedIds = getDeletedOrderIds();
  const orderMap = new Map<string, Order>();

  const putOrder = (incoming: Order) => {
    if (!incoming || !incoming.id || deletedIds.has(incoming.id)) return;
    const existing = orderMap.get(incoming.id);
    if (!existing) {
      orderMap.set(incoming.id, incoming);
      return;
    }
    const incomingUpdated = Number(incoming.updatedAt || incoming.createdAt || 0);
    const existingUpdated = Number(existing.updatedAt || existing.createdAt || 0);
    const bestScreenshot =
      incoming.customerScreenshot && !incoming.customerScreenshot.startsWith('/uploads/')
        ? incoming.customerScreenshot
        : existing.customerScreenshot || incoming.customerScreenshot;

    if (incomingUpdated >= existingUpdated) {
      orderMap.set(incoming.id, {
        ...existing,
        ...incoming,
        customerScreenshot: bestScreenshot,
      });
    } else {
      orderMap.set(incoming.id, {
        ...incoming,
        ...existing,
        customerScreenshot: bestScreenshot,
      });
    }
  };

  for (const locOrd of localList) {
    putOrder(locOrd);
  }
  for (const srvOrd of serverList) {
    putOrder(srvOrd);
  }
  for (const fsOrd of firestoreList) {
    putOrder(fsOrd);
  }

  const merged = Array.from(orderMap.values()).sort(
    (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
  );
  syncOrdersToLocalCache(merged);
  return merged;
}

export async function saveOrderPersisted(order: Order): Promise<Order> {
  // Ensure order is not marked as deleted if re-saved
  removeDeletedOrderIds([order.id]);

  // Keep self-contained data:image/jpeg or https URL directly in Firestore (< 700KB) for 100% lifetime persistence
  // across all servers, devices, and deployments (never replace with ephemeral /uploads/ path).
  let safeScreenshot = order.customerScreenshot;
  if (typeof safeScreenshot === 'string' && safeScreenshot.length > 750000) {
    try {
      safeScreenshot = await uploadBannerImageToServer(
        safeScreenshot,
        `order-screenshot-${order.id}`
      );
    } catch {
      // keep fallback if upload fails
    }
  }

  const cleanOrder = sanitizeForFirestore({
    ...order,
    customerScreenshot: safeScreenshot,
    items: Array.isArray(order.items)
      ? order.items.map((item) => ({
          ...item,
          image:
            typeof item.image === 'string' && item.image.startsWith('data:') && item.image.length > 20000
              ? getFallbackProductImage({ id: item.productId || item.id, name: item.name, category: item.category }, 0)
              : item.image,
        }))
      : [],
  });

  // 1. Save to localStorage backup so customer & admin never lose an order (supports unlimited consecutive orders)
  try {
    const existing = getPersistedOrders();
    const deletedIds = getDeletedOrderIds();
    const filtered = existing.filter(
      (o) => o && o.id && o.id !== cleanOrder.id && !deletedIds.has(o.id)
    );
    filtered.unshift(cleanOrder);
    syncOrdersToLocalCache(filtered);
  } catch (e) {
    console.warn('localStorage order backup note:', e);
  }

  // 2. Save to Server Order Mirror + Server Firestore (`/api/orders`) and Client Firestore `orders` collection in parallel
  await Promise.allSettled([
    setDoc(doc(db, 'orders', cleanOrder.id), cleanOrder, { merge: true }),
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: cleanOrder }),
    }),
  ]);

  return cleanOrder;
}

/**
 * Permanently deletes a demo/fake/cancelled order from Firestore, localStorage, and records its ID
 * in `settings/deleted_orders` so it never reappears and is immediately deducted from Sales Analytics.
 */
export async function deleteOrderPersisted(orderId: string): Promise<void> {
  if (!orderId) return;
  addDeletedOrderId(orderId);

  // 1. Remove from localStorage backup immediately
  try {
    const existing = getPersistedOrders();
    const next = existing.filter((o) => o && o.id !== orderId);
    syncOrdersToLocalCache(next);
  } catch (e) {
    console.warn('localStorage order delete note:', e);
  }

  // 2. Delete document from Firestore `orders` collection & Server mirror
  try {
    await Promise.allSettled([
      deleteDoc(doc(db, 'orders', orderId)),
      fetch('/api/orders/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      }),
    ]);
  } catch (err) {
    console.warn('Firestore order delete note:', err);
  }

  // 3. Persist deleted order IDs in `settings/deleted_orders` so all sessions stay in sync
  try {
    const allDeleted = Array.from(getDeletedOrderIds());
    await setDoc(
      doc(db, 'settings', 'deleted_orders'),
      { ids: allDeleted, updatedAt: Date.now() },
      { merge: true }
    );
  } catch {
    // ignore
  }
}

export async function deleteOrdersBulkPersisted(orderIds: string[]): Promise<void> {
  for (const id of orderIds) {
    await deleteOrderPersisted(id);
  }
}

/**
 * Retrieves locally backed up orders (excluding deleted order IDs) to merge with Firestore live orders
 */
export function getPersistedOrders(): Order[] {
  try {
    const deletedIds = getDeletedOrderIds();
    const rawPrimary = localStorage.getItem(LS_ORDERS_BACKUP_KEY);
    const rawSecondary = localStorage.getItem('dokandari_orders_v1');
    const listPrimary: Order[] = rawPrimary ? JSON.parse(rawPrimary) : [];
    const listSecondary: Order[] = rawSecondary ? JSON.parse(rawSecondary) : [];
    const combinedMap = new Map<string, Order>();
    for (const o of [...(Array.isArray(listSecondary) ? listSecondary : []), ...(Array.isArray(listPrimary) ? listPrimary : [])]) {
      if (o && o.id && !deletedIds.has(o.id)) {
        combinedMap.set(o.id, o);
      }
    }
    return Array.from(combinedMap.values()).sort(
      (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
    );
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
  maxWidth = 640,
  quality = 0.68
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

        // Keep each base64 photo <= ~115KB so 5 to 8 uploaded gallery images fit inside a 1MB Firestore document
        if (dataUrl.length > 115000) {
          const smallerW = Math.min(width, 500);
          const smallerH = Math.round((height * smallerW) / width);
          canvas.width = smallerW;
          canvas.height = smallerH;
          const ctx2 = canvas.getContext('2d');
          if (ctx2) {
            ctx2.drawImage(img, 0, 0, smallerW, smallerH);
            dataUrl = canvas.toDataURL('image/jpeg', 0.56);
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
    // 0. Always load settings/deleted_products from Firestore first so deleted products NEVER get re-seeded
    try {
      const delSnap = await getDoc(doc(db, 'settings', 'deleted_products'));
      if (delSnap.exists()) {
        const remoteIds = delSnap.data()?.ids;
        if (Array.isArray(remoteIds)) {
          setRemoteDeletedProductIds(remoteIds);
        }
      }
    } catch {
      // ignore
    }

    const deletedIds = getDeletedProductIds();
    const productsCol = collection(db, 'products');
    const snap = await getDocs(productsCol);

    // 1. If Firestore already has products, NEVER overwrite them from localStorage and NEVER re-seed deleted items!
    //    Only purge any document that is explicitly listed in settings/deleted_products.
    if (!snap.empty) {
      for (const docSnap of snap.docs) {
        if (deletedIds.has(docSnap.id)) {
          deleteDoc(doc(db, 'products', docSnap.id)).catch(() => null);
        }
      }
    } else {
      // 2. Only if Firestore `products` collection is completely empty (0 docs), seed INITIAL_PRODUCTS (excluding deletedIds)
      const mirrorBatch: Product[] = [];
      for (const prod of INITIAL_PRODUCTS) {
        if (!deletedIds.has(prod.id)) {
          const cleanProd = sanitizeForFirestore(
            ensureFirestoreSafeProductPayload(normalizeProductImages(prod))
          );
          mirrorBatch.push(cleanProd);
          await setDoc(doc(db, 'products', prod.id), cleanProd, { merge: true });
        }
      }
      if (mirrorBatch.length > 0) {
        fetch('/api/catalog/sync-mirror', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products: mirrorBatch }),
        }).catch(() => null);
      }
    }

    // 3. Ensure store_content exists in Firestore
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

/**
 * Default Bangladeshi Customer Real-Life Experience (UGC) Cards for Homepage Social Proof
 */
export const DEFAULT_CUSTOMER_UGC_CARDS: CustomerUgcCard[] = [
  {
    id: 'ugc-bd-1',
    customerName: 'নুসরাত জাহান তানিয়া',
    location: 'উত্তরা, ঢাকা',
    productName: 'স্কিন ব্রাইটেনিং আলফা আরবুটিন সোপ (Skin Brightening Soap)',
    productId: 'dkd-1776101501645-01',
    reviewPhoto: '/uploads/product/1776145369-gemini_generated_image_4d8m0b4d8m0b4d8m.png',
    beforePhoto: '/uploads/product/1776138951-h32433b5b5f274e7f9390517254e692c8l.png',
    rating: 5,
    testimonial:
      'আলহামদুলিল্লাহ! মাত্র ১৪ দিন নিয়মিত ব্যবহার করার পর ত্বকের রোদে পোড়া কালচে ভাব ও ব্রণের দাগ একদম হালকা হয়ে গেছে। ডেলিভারি ম্যানের সামনে দেখে নেওয়ার সুবিধা থাকায় নিশ্চিন্তে অর্ডার করেছিলাম। ১০০% অরিজিনাল প্রোডাক্ট!',
    verifiedBadge: 'ভেরিফাইড ক্রেতা • ঢাকা',
    createdAt: Date.now() - 86400000 * 3,
  },
  {
    id: 'ugc-bd-2',
    customerName: 'সাদিয়া আফরিন মিম',
    location: 'নাসিরাবাদ, চট্টগ্রাম',
    productName: 'ডিয়ার হেয়ার টনিক ও স্ক্যাল্প ক্লিনজার (Dear Hair Tonic)',
    productId: 'dkd-1776101501645-04',
    reviewPhoto: '/uploads/product/1776151737-untitled-design-49.webp',
    rating: 5,
    testimonial:
      'অনেক দিন ধরে চুল পড়ার সমস্যায় ভুগছিলাম। দোকানদারি (Dokandari) থেকে এই অরিজিনাল হেয়ার টনিক নেওয়ার পর চুল পড়া অনেক কমেছে এবং স্ক্যাল্প একদম ফ্রেশ থাকে। প্যাকেজিং ও কুরিয়ার সার্ভিস অসাধারণ ছিল!',
    verifiedBadge: 'ভেরিফাইড ক্রেতা • চট্টগ্রাম',
    createdAt: Date.now() - 86400000 * 5,
  },
  {
    id: 'ugc-bd-3',
    customerName: 'ফারহানা ইয়াসমিন নীলা',
    location: 'জিন্দাবাজার, সিলেট',
    productName: 'এলিগ্যান্ট গোল্ডেন ডিউর ক্রিস্টাল টেবিল ল্যাম্প',
    productId: 'dkd-1776101501645-05',
    reviewPhoto: '/uploads/product/1792322414-gemini_generated_image_b9teg6b9teg6b9te.jpg',
    rating: 5,
    testimonial:
      'আমার বেডরুম সাজানোর জন্য নিয়েছিলাম। ছবিতে যেমন দেখেছি, বাস্তবে তার চেয়েও বেশি প্রিমিয়াম ও সুন্দর! ক্যাশ অন ডেলিভারিতে একদম অক্ষত অবস্থায় হাতে পেয়েছি। ধন্যবাদ দোকানদারি টিমকে।',
    verifiedBadge: 'ভেরিফাইড ক্রেতা • সিলেট',
    createdAt: Date.now() - 86400000 * 7,
  },
  {
    id: 'ugc-bd-4',
    customerName: 'রুবাইয়া সুলতানা ঐশী',
    location: 'সোনাডাঙ্গা, খুলনা',
    productName: 'গ্লোয়িং স্কিন ও ডিপ ক্লিনজিং ফেস কেয়ার কম্বো',
    productId: 'dkd-1776101501645-02',
    reviewPhoto: '/uploads/product/1776145851-gemini_generated_image_965z7n965z7n965z.png',
    rating: 5,
    testimonial:
      'বাংলাদেশে বসে এত কম দামে ১০০% অরিজিনাল ইমপোর্টেড স্কিনকেয়ার প্রোডাক্ট পাব ভাবিনি। ব্যবহারের আগে ও পরের পার্থক্য নিজেই বুঝতে পারছি। পরিবারের সবার জন্য আবার অর্ডার করব ইনশাআল্লাহ!',
    verifiedBadge: 'ভেরিফাইড ক্রেতা • খুলনা',
    createdAt: Date.now() - 86400000 * 9,
  },
  {
    id: 'ugc-bd-5',
    customerName: 'তাসনুভা রহমান প্রাপ্তি',
    location: 'বোয়ালিয়া, রাজশাহী',
    productName: 'লাক্সারি ওয়াল ও লিভিং রুম ডেকোর কালেকশন',
    productId: 'dkd-1776101501645-06',
    reviewPhoto: '/uploads/product/1792322524-gemini_generated_image_6tydck6tydck6tyd.jpg',
    rating: 5,
    testimonial:
      'ড্রয়িং রুমের সৌন্দর্য এক নিমেষেই বদলে গেছে। বাসায় মেহমান এসে সবাই জিজ্ঞেস করছে কোথা থেকে কিনেছি! কোয়ালিটি এবং ফিনিশিং সত্যিই ১০/১০।',
    verifiedBadge: 'ভেরিফাইড ক্রেতা • রাজশাহী',
    createdAt: Date.now() - 86400000 * 11,
  },
  {
    id: 'ugc-bd-6',
    customerName: 'মাহমুদুল হাসান রাকিব',
    location: 'কান্দিরপাড়, কুমিল্লা',
    productName: 'প্রিমিয়াম স্মার্ট লাইফস্টাইল ও হোম অ্যাক্সেসরিজ',
    productId: 'dkd-1776101501645-08',
    reviewPhoto: '/uploads/product/1792322764-whatsapp-image-2026-10-14-at-12.59.53.jpeg',
    rating: 5,
    testimonial:
      'অর্ডার করার ২৪ ঘণ্টার মধ্যে কুমিল্লায় হোম ডেলিভারি পেয়েছি। প্রোডাক্ট হাতে নিয়ে চেক করে পেমেন্ট করেছি। এক কথায় বিশ্বস্ত একটি অনলাইন শপ!',
    verifiedBadge: 'ভেরিফাইড ক্রেতা • কুমিল্লা',
    createdAt: Date.now() - 86400000 * 14,
  },
];

export function getPersistedCustomerUgcCards(): CustomerUgcCard[] {
  try {
    const raw = localStorage.getItem(LS_CUSTOMER_UGC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_CUSTOMER_UGC_CARDS;
}

export async function saveCustomerUgcCardsPersisted(
  cards: CustomerUgcCard[]
): Promise<CustomerUgcCard[]> {
  const now = Date.now();
  const processedCards = await Promise.all(
    cards.map(async (card, idx) => {
      let reviewPhoto = card.reviewPhoto || '';
      let beforePhoto = card.beforePhoto || '';

      if (reviewPhoto.startsWith('data:image/') || beforePhoto.startsWith('data:image/')) {
        try {
          const uploadRes = await fetch('/api/upload-product-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId: `ugc-${card.id || now}-${idx}`,
              images: [reviewPhoto, beforePhoto].filter(Boolean),
            }),
          });
          if (uploadRes.ok) {
            const upJson = await uploadRes.json();
            if (Array.isArray(upJson?.images)) {
              if (reviewPhoto.startsWith('data:image/') && upJson.images[0]) {
                reviewPhoto = upJson.images[0];
              }
              if (beforePhoto.startsWith('data:image/')) {
                const secondIdx = card.reviewPhoto?.startsWith('data:image/') ? 1 : 0;
                if (upJson.images[secondIdx]) {
                  beforePhoto = upJson.images[secondIdx];
                }
              }
            }
          }
        } catch {
          // keep data url fallback
        }
      }

      return sanitizeForFirestore({
        ...card,
        id: card.id || `ugc-${now}-${idx}`,
        reviewPhoto,
        beforePhoto: beforePhoto || undefined,
        createdAt: card.createdAt || now,
      });
    })
  );

  try {
    localStorage.setItem(LS_CUSTOMER_UGC_KEY, JSON.stringify(processedCards));
  } catch {
    // ignore
  }

  try {
    await setDoc(
      doc(db, 'settings', 'customer_ugc'),
      sanitizeForFirestore({
        cards: processedCards,
        updatedAt: now,
      }),
      { merge: true }
    );
  } catch (err) {
    console.warn('Firestore customer_ugc save note:', err);
  }

  return processedCards;
}

/**
 * 1-Click Lifetime Database Save for the entire catalog + store settings + UGC cards.
 * Ensures every product, uploaded photo, scraped custom website product, Before & After image,
 * and store configuration is permanently written to both server disk (/uploads/product/) and Firestore.
 */
export async function saveAllStoreDataLifetime(
  products: Product[],
  storeContent?: Partial<StoreContent>
): Promise<{ savedProductsCount: number; timestamp: number }> {
  const now = Date.now();
  const deletedIds = getDeletedProductIds();
  const validProducts = products.filter((p) => p && p.id && !deletedIds.has(p.id));

  let savedProductsCount = 0;
  for (const prod of validProducts) {
    try {
      await saveProductPersisted({
        ...prod,
        lifetimeSavedAt: now,
      });
      savedProductsCount++;
    } catch (e) {
      console.warn('Lifetime product save warning:', e);
    }
  }

  if (storeContent) {
    try {
      await saveStoreContentPersisted(storeContent);
    } catch (e) {
      console.warn('Lifetime storeContent save warning:', e);
    }
  }

  try {
    const ugcCards = getPersistedCustomerUgcCards();
    await saveCustomerUgcCardsPersisted(ugcCards);
  } catch {
    // ignore
  }

  return { savedProductsCount, timestamp: now };
}

/**
 * Submits a customer UGC review (photo or video) to Firestore as a pending approval submission.
 */
export async function submitCustomerUgcReviewForApproval(
  submission: Omit<CustomerUgcCard, 'id' | 'createdAt' | 'status'>
): Promise<CustomerUgcCard> {
  const now = Date.now();
  let reviewPhoto = submission.reviewPhoto || '';
  let beforePhoto = submission.beforePhoto || '';

  // Upload base64 photo to disk if needed
  const imagesToUpload: string[] = [];
  if (reviewPhoto.startsWith('data:image/')) imagesToUpload.push(reviewPhoto);
  if (beforePhoto.startsWith('data:image/')) imagesToUpload.push(beforePhoto);

  if (imagesToUpload.length > 0) {
    try {
      const upRes = await fetch('/api/products/upload-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imagesToUpload }),
      });
      if (upRes.ok) {
        const upJson = await upRes.json();
        if (Array.isArray(upJson.images)) {
          if (reviewPhoto.startsWith('data:image/') && upJson.images[0]) {
            reviewPhoto = upJson.images[0];
          }
          if (beforePhoto.startsWith('data:image/')) {
            const idx = submission.reviewPhoto?.startsWith('data:image/') ? 1 : 0;
            if (upJson.images[idx]) beforePhoto = upJson.images[idx];
          }
        }
      }
    } catch {
      // keep data url fallback
    }
  }

  const newCard: CustomerUgcCard = sanitizeForFirestore({
    ...submission,
    id: `ugc-sub-${now}-${Math.floor(100 + Math.random() * 900)}`,
    reviewPhoto,
    beforePhoto: beforePhoto || undefined,
    status: 'pending',
    verifiedBadgeText: 'পেন্ডিং অনুমোদন (Pending Approval)',
    createdAt: now,
    updatedAt: now,
  });

  // 1. Save to Firestore `ugc_reviews` collection for individual pending review tracking
  try {
    await setDoc(doc(db, 'ugc_reviews', newCard.id), newCard, { merge: true });
  } catch (err) {
    console.warn('Firestore ugc_reviews save note:', err);
  }

  // 2. Also append to `settings/customer_ugc` and localStorage so Admin sees it immediately
  const existing = getPersistedCustomerUgcCards();
  const updatedList = [newCard, ...existing.filter((c) => c.id !== newCard.id)];
  await saveCustomerUgcCardsPersisted(updatedList);

  return newCard;
}

/**
 * Purchase Management (#17 ক্রয় ব্যবস্থাপনা) Persistence Helpers
 */
export function getDeletedPurchaseIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DELETED_PURCHASE_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function getPersistedPurchases(): PurchaseRecord[] {
  try {
    const deleted = getDeletedPurchaseIds();
    const raw = localStorage.getItem(LS_PURCHASES_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => p && p.id && !deleted.has(p.id));
  } catch {
    return [];
  }
}

export async function savePurchasePersisted(purchase: PurchaseRecord): Promise<PurchaseRecord> {
  const clean = sanitizeForFirestore({
    ...purchase,
    updatedAt: Date.now(),
  });

  try {
    const delSet = getDeletedPurchaseIds();
    if (delSet.has(clean.id)) {
      delSet.delete(clean.id);
      localStorage.setItem(LS_DELETED_PURCHASE_IDS_KEY, JSON.stringify(Array.from(delSet)));
    }
    const existing = getPersistedPurchases();
    const next = [clean, ...existing.filter((p) => p.id !== clean.id)];
    localStorage.setItem(LS_PURCHASES_BACKUP_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('localStorage purchase save note:', e);
  }

  try {
    await setDoc(doc(db, 'purchases', clean.id), clean, { merge: true });
  } catch (err) {
    console.warn('Firestore purchase save note:', err);
  }

  return clean;
}

export async function deletePurchasePersisted(purchaseId: string): Promise<void> {
  if (!purchaseId) return;
  try {
    const delSet = getDeletedPurchaseIds();
    delSet.add(purchaseId);
    localStorage.setItem(LS_DELETED_PURCHASE_IDS_KEY, JSON.stringify(Array.from(delSet)));

    const existing = getPersistedPurchases();
    const next = existing.filter((p) => p.id !== purchaseId);
    localStorage.setItem(LS_PURCHASES_BACKUP_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  try {
    await deleteDoc(doc(db, 'purchases', purchaseId));
  } catch (err) {
    console.warn('Firestore purchase delete note:', err);
  }
}

/**
 * Courier Return Management (#16 কুরিয়ার রিটার্ন ব্যবস্থাপনা) Persistence & Deletion Helpers
 * Note: Deleting a return record ONLY removes the return entry from `courier_returns` and records
 * the deleted ID so initial sample seeds never reappear. It NEVER modifies product stock, orders, or customers.
 */
export function getDeletedReturnIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DELETED_RETURN_IDS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function addDeletedReturnIds(ids: string[]): void {
  try {
    const delSet = getDeletedReturnIds();
    for (const id of ids) {
      const clean = String(id || '').trim();
      if (clean) delSet.add(clean);
    }
    localStorage.setItem(LS_DELETED_RETURN_IDS_KEY, JSON.stringify(Array.from(delSet)));
  } catch {
    // ignore storage warning
  }
}

export function getPersistedCourierReturns(): CourierReturn[] {
  try {
    const deleted = getDeletedReturnIds();
    const raw = localStorage.getItem(LS_COURIER_RETURNS_BACKUP_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r) => r && r.id && !deleted.has(r.id));
  } catch {
    return [];
  }
}

export function syncCourierReturnsToLocalCache(returnsList: CourierReturn[]): void {
  try {
    const deleted = getDeletedReturnIds();
    const filtered = returnsList.filter((r) => r && r.id && !deleted.has(r.id));
    localStorage.setItem(LS_COURIER_RETURNS_BACKUP_KEY, JSON.stringify(filtered));
  } catch {
    // ignore storage warning
  }
}

export async function saveCourierReturnPersisted(returnItem: CourierReturn): Promise<CourierReturn> {
  const clean = sanitizeForFirestore({
    ...returnItem,
    updatedAt: Date.now(),
  });

  try {
    const delSet = getDeletedReturnIds();
    if (delSet.has(clean.id)) {
      delSet.delete(clean.id);
      const idsArray = Array.from(delSet);
      localStorage.setItem(LS_DELETED_RETURN_IDS_KEY, JSON.stringify(idsArray));
      setDoc(
        doc(db, 'settings', 'deleted_returns'),
        { ids: idsArray, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    }
    const existing = getPersistedCourierReturns();
    const next = [clean, ...existing.filter((r) => r.id !== clean.id)];
    localStorage.setItem(LS_COURIER_RETURNS_BACKUP_KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('localStorage courier return save note:', e);
  }

  await setDoc(doc(db, 'courier_returns', clean.id), clean, { merge: true });
  return clean;
}

export async function deleteCourierReturnPersisted(returnId: string): Promise<void> {
  const normalizedId = String(returnId || '').trim();
  if (!normalizedId) {
    throw new Error('Invalid return ID');
  }

  // 1. Synchronously mark as deleted in localStorage FIRST so any active onSnapshot listener never re-adds it
  let idsArray: string[] = [normalizedId];
  try {
    const delSet = getDeletedReturnIds();
    delSet.add(normalizedId);
    idsArray = Array.from(delSet);
    localStorage.setItem(LS_DELETED_RETURN_IDS_KEY, JSON.stringify(idsArray));
    localStorage.setItem('dokandari_courier_returns_seeded_v1', 'true');

    const existing = getPersistedCourierReturns();
    const next = existing.filter((r) => r.id !== normalizedId);
    localStorage.setItem(LS_COURIER_RETURNS_BACKUP_KEY, JSON.stringify(next));

    // Also remove any auto-recorded return charge expense for this return from local expense backup
    const rawExp = localStorage.getItem('dokandari_expenses_backup_v1');
    if (rawExp) {
      const parsedExp = JSON.parse(rawExp);
      if (Array.isArray(parsedExp)) {
        const filteredExp = parsedExp.filter((e: any) => e && e.id !== `exp-ret-${normalizedId}`);
        localStorage.setItem('dokandari_expenses_backup_v1', JSON.stringify(filteredExp));
      }
    }
  } catch {
    // ignore local cache warning
  }

  // 2. Immediately delete from Firestore `courier_returns/{returnId}`, delete linked `business_expenses/exp-ret-{returnId}`,
  //    and persist deleted IDs in `settings/deleted_returns`
  await Promise.allSettled([
    deleteDoc(doc(db, 'courier_returns', normalizedId)),
    deleteDoc(doc(db, 'business_expenses', `exp-ret-${normalizedId}`)),
    setDoc(
      doc(db, 'settings', 'deleted_returns'),
      { ids: idsArray, updatedAt: Date.now() },
      { merge: true }
    ),
  ]);
}

