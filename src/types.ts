/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MainCategory {
  id: string;
  nameBn: string;
  nameEn: string;
  order: number;
  icon: string;
  image: string;
  count?: number;
  visible: boolean;
}

export interface CategoryHeroBanner {
  categoryId: string;
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  ctaText?: string;
}

export const OFFICIAL_CATEGORIES: MainCategory[] = [
  {
    id: 'home_decor',
    nameBn: 'হোম ডেকোর',
    nameEn: 'Home Decor',
    order: 1,
    icon: '',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'gadgets_electronics',
    nameBn: 'গ্যাজেটস ও ইলেকট্রনিক্স',
    nameEn: 'Gadgets & Electronics',
    order: 2,
    icon: '',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'fashion_clothing',
    nameBn: 'ফ্যাশন ও ক্লদিং',
    nameEn: 'Fashion & Clothing',
    order: 3,
    icon: '',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'beauty_personal_care',
    nameBn: 'বিউটি ও পার্সোনাল কেয়ার',
    nameEn: 'Beauty & Personal Care',
    order: 4,
    icon: '',
    image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'home_kitchen',
    nameBn: 'হোম ও কিচেন',
    nameEn: 'Home & Kitchen',
    order: 5,
    icon: '',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'mobile_accessories',
    nameBn: 'মোবাইল এক্সেসরিজ',
    nameEn: 'Mobile Accessories',
    order: 6,
    icon: '',
    image: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'lifestyle',
    nameBn: 'লাইফস্টাইল প্রোডাক্টস',
    nameEn: 'Lifestyle Products',
    order: 7,
    icon: '',
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'travel_outdoor',
    nameBn: 'ট্রাভেল ও আউটডোর',
    nameEn: 'Travel & Outdoor',
    order: 8,
    icon: '',
    image: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'health_fitness',
    nameBn: 'হেলথ ও ফিটনেস এক্সেসরিজ',
    nameEn: 'Health & Fitness Accessories',
    order: 9,
    icon: '',
    image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'kids_baby',
    nameBn: 'কিডস ও বেবি প্রোডাক্টস',
    nameEn: 'Kids & Baby Products',
    order: 10,
    icon: '',
    image: 'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
  {
    id: 'office_essentials',
    nameBn: 'অফিস ও নিত্যপ্রয়োজনীয়',
    nameEn: 'Office & Everyday Essentials',
    order: 11,
    icon: '',
    image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=400&q=80',
    visible: true,
  },
];

export type ProductCategory = string;

export interface ProductVariant {
  colors?: string[];
  sizes?: string[];
}

export interface Product {
  id: string;
  name: string;
  titleEn?: string;
  category: string;
  price: number;
  originalPrice?: number;
  description: string;
  features: string[];
  images: string[];
  videos?: string[];
  variants: ProductVariant;
  inStock: boolean;
  rating: number;
  reviewCount: number;
  tag?: string;
  fabric?: string;
  sku?: string;
  brand?: string;
  specifications?: Record<string, string>;
  status?: 'published' | 'draft';
  sourceUrl?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  selectedColor?: string;
  selectedSize?: string;
  category: string;
}

export type PaymentMethod = 'cod' | 'bkash' | 'nagad' | 'rocket';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'packed'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export interface CustomerInfo {
  name: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  district: string;
  deliveryNotes?: string;
}

export interface PixelTrackingInfo {
  eventId: string;
  browserFired: boolean;
  capiDispatched: boolean;
  capiStatus: string;
  metaPixels?: string[];
  tiktokPixels?: string[];
  contentIds?: string[];
  capiResults?: Array<{
    platform: string;
    pixelId: string;
    status: string;
    eventId: string;
    eventsReceived?: number;
    detail?: string;
  }>;
  updatedAt: number;
}

export interface Order {
  id: string;
  customer: CustomerInfo;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  status: OrderStatus;
  userId: string | null;
  createdAt: number;
  updatedAt: number;
  trackingNumber?: string;
  courierName?: string;
  consignmentId?: string;
  courierStatus?: string;
  customerScreenshot?: string;
  pixelTracking?: PixelTrackingInfo;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'customer' | 'admin';
  phone?: string;
  address?: string;
  district?: string;
}

export interface HeroCarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  tag: string;
  ctaText?: string;
  ctaLink?: string;
  enabled: boolean;
  order: number;
}

export interface ImportPreviewItem {
  id: string;
  sourceUrl: string;
  titleBn: string;
  titleEn: string;
  category: string;
  price: number;
  originalPrice: number;
  description: string;
  fabric?: string;
  sku: string;
  colors: string[];
  sizes: string[];
  images: string[];
  videos: string[];
  features: string[];
  status: 'draft' | 'published';
  warnings?: string[];
  importedAt: number;
}

export type AbandonedLeadStatus = 'pending' | 'contacted' | 'converted' | 'cancelled';

export interface AbandonedLeadItem {
  productId?: string;
  productName: string;
  productImage?: string;
  quantity: number;
  price: number;
  selectedColor?: string;
  selectedSize?: string;
}

export interface AbandonedLead {
  id: string; // phone or generated unique lead id
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  customerDistrict?: string;
  deliveryArea?: 'dhaka' | 'outside_dhaka';
  source: 'pdp_direct' | 'cart_checkout';
  productId?: string;
  productName?: string;
  productPrice?: number;
  productImage?: string;
  productVariant?: string;
  cartItems?: CartItem[];
  items?: AbandonedLeadItem[];
  quantity?: number;
  estimatedTotal?: number;
  totalAmount?: number;
  status: AbandonedLeadStatus;
  notes?: string;
  convertedOrderId?: string;
  createdAt: number;
  updatedAt: number;
}
