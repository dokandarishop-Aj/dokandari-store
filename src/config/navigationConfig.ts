/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AdminTool } from '../components/AdminPanel';

/**
 * STRICT SEPARATION OF NAVIGATION SYSTEMS:
 * 1. `PublicCustomerNavigation` — Strictly public customer-facing links only.
 *    Zero Admin links, zero Admin Menu (1–19) items, zero Business Command Center shortcuts.
 * 2. `AdminNavigation` — Strictly private internal business & admin routes.
 */

export interface PublicCustomerNavItem {
  id:
    | 'home'
    | 'all_products'
    | 'categories'
    | 'live_tracking'
    | 'shopping_bag'
    | 'checkout'
    | 'video_gallery'
    | 'smart_assistant'
    | 'about_us'
    | 'privacy_policy'
    | 'return_refund_policy'
    | 'customer_support';
  section: 'primary_shopping' | 'categories' | 'policies_and_support';
  titleBn: string;
  titleEn: string;
  subtitleBn: string;
  href: string;
  badgeText?: string;
}

export const PUBLIC_CUSTOMER_NAVIGATION: readonly PublicCustomerNavItem[] = Object.freeze([
  {
    id: 'home',
    section: 'primary_shopping',
    titleBn: 'হোমপেজ (Home / Homepage)',
    titleEn: 'Home / Homepage',
    subtitleBn: 'Dokandari স্টোরের মূল হোমপেজ ও নতুন অফার দেখুন',
    href: '/',
  },
  {
    id: 'all_products',
    section: 'primary_shopping',
    titleBn: 'সকল পণ্য / শপ (All Products / Shop)',
    titleEn: 'All Products / Shop',
    subtitleBn: 'সকল ১০০% অরিজিনাল পণ্য ও বেস্ট-সেলিং কালেকশন ব্রাউজ করুন',
    href: '/#products-section',
  },
  {
    id: 'categories',
    section: 'primary_shopping',
    titleBn: 'শপ ক্যাটাগরি (Shop Categories)',
    titleEn: 'Shop Categories',
    subtitleBn: '১১টি প্রিমিয়াম ক্যাটাগরি থেকে পছন্দের পণ্য বেছে নিন',
    href: '/#categories-section',
  },
  {
    id: 'live_tracking',
    section: 'primary_shopping',
    titleBn: 'লাইভ অর্ডার ট্র্যাকিং (Live Order Tracking)',
    titleEn: 'Live Order Tracking',
    subtitleBn: 'অর্ডার আইডি বা মোবাইল নম্বর দিয়ে ডেলিভারি স্ট্যাটাস দেখুন',
    href: '/track',
    badgeText: 'Live',
  },
  {
    id: 'shopping_bag',
    section: 'primary_shopping',
    titleBn: 'শপিং ব্যাগ / কার্ট (Shopping Bag / Cart)',
    titleEn: 'Shopping Bag / Cart',
    subtitleBn: 'আপনার বাছাইকৃত পণ্যের তালিকা ও কার্ট দেখুন',
    href: '/#cart',
  },
  {
    id: 'checkout',
    section: 'primary_shopping',
    titleBn: 'চেকআউট (Checkout)',
    titleEn: 'Checkout',
    subtitleBn: 'ক্যাশ অন ডেলিভারিতে দ্রুত অর্ডার কনফার্ম করুন',
    href: '/#checkout',
  },
  {
    id: 'video_gallery',
    section: 'primary_shopping',
    titleBn: 'প্রোডাক্ট ভিডিও গ্যালারি (Product Video Gallery)',
    titleEn: 'Product Video Gallery',
    subtitleBn: 'প্রোডাক্টের আনবক্সিং ও রিয়েল ভিডিও রিভিউ দেখুন',
    href: '/videos',
  },
  {
    id: 'smart_assistant',
    section: 'primary_shopping',
    titleBn: 'স্মার্ট শপিং অ্যাসিস্ট্যান্ট (Smart Shopping Assistant)',
    titleEn: 'Smart Shopping Assistant',
    subtitleBn: 'প্রোডাক্ট পরামর্শ, সাইজ ও তাৎক্ষণিক অর্ডার সহায়তা',
    href: '/#assistant',
  },
  {
    id: 'about_us',
    section: 'policies_and_support',
    titleBn: 'আমাদের সম্পর্কে (About Us)',
    titleEn: 'About Us',
    subtitleBn: 'আন্তর্জাতিক মানের সরাসরি ফ্যাক্টরি সোর্সিং ও ব্র্যান্ড পরিচিতি',
    href: '/about',
  },
  {
    id: 'privacy_policy',
    section: 'policies_and_support',
    titleBn: 'প্রাইভেসি পলিসি (Privacy Policy)',
    titleEn: 'Privacy Policy',
    subtitleBn: 'গ্রাহকের ব্যক্তিগত তথ্য ও পেমেন্ট নিরাপত্তার নিশ্চয়তা',
    href: '/privacy',
  },
  {
    id: 'return_refund_policy',
    section: 'policies_and_support',
    titleBn: 'রিটার্ন ও রিফান্ড নীতিমালা (Return & Refund Policy)',
    titleEn: 'Return & Refund Policy',
    subtitleBn: 'ডেলিভারিম্যানের সামনে পণ্য চেক ও ৭ দিনের সহজ এক্সচেঞ্জ সুবিধা',
    href: '/privacy#return-policy',
  },
  {
    id: 'customer_support',
    section: 'policies_and_support',
    titleBn: 'কাস্টমার সাপোর্ট ও যোগাযোগ (Customer Support / Contact)',
    titleEn: 'Customer Support / Contact',
    subtitleBn: '২৪/৭ হটলাইন ও অফিসিয়াল WhatsApp কাস্টমার কেয়ার',
    href: 'tel:01348282356',
  },
]);

/**
 * Protected Admin Routes that MUST NEVER be accessible to anonymous visitors or normal customers.
 */
export const PROTECTED_ADMIN_ROUTE_MAP: Readonly<Record<string, AdminTool>> = Object.freeze({
  '/admin': 'business_command_center',
  '/dashboard': 'business_command_center',
  '/command-center': 'business_command_center',
  '/orders': 'orders',
  '/products/manage': 'products',
  '/stock': 'purchase_management',
  '/finance': 'analytics',
  '/expenses': 'business_command_center',
  '/courier': 'orders',
  '/settings': 'settings',
});

/**
 * Checks whether the current URL path or hash targets any protected Admin route.
 */
export function matchProtectedAdminRoute(
  pathname: string,
  hash: string,
  search: string
): { isAdminRoute: boolean; targetTool?: AdminTool } {
  const cleanPath = (pathname || '').replace(/\/+$/, '') || '/';
  const cleanHash = (hash || '').replace(/^#/, '').split('?')[0].replace(/\/+$/, '');
  const sp = new URLSearchParams(search || (hash.includes('?') ? hash.split('?')[1] : ''));
  const explicitTool = sp.get('tool') as AdminTool | null;

  for (const [routePrefix, defaultTool] of Object.entries(PROTECTED_ADMIN_ROUTE_MAP)) {
    if (
      cleanPath === routePrefix ||
      cleanPath.startsWith(`${routePrefix}/`) ||
      cleanHash === routePrefix ||
      cleanHash.startsWith(`${routePrefix}/`)
    ) {
      return {
        isAdminRoute: true,
        targetTool: explicitTool || defaultTool,
      };
    }
  }

  return { isAdminRoute: false };
}
