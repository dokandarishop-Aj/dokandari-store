/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AuthProvider } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { INITIAL_PRODUCTS } from './data/initialCatalog';
import { Product, ProductCategory, OFFICIAL_CATEGORIES, Order } from './types';
import { Header } from './components/Header';
import { CategorySquircleBar } from './components/CategorySquircleBar';
import { ProductCard } from './components/ProductCard';
import { ProductDetailPage } from './components/ProductDetailPage';
import { ProductCustomizationPage } from './components/ProductCustomizationPage';
import { FounderEditModal } from './components/FounderEditModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { OrderTrackingView } from './components/OrderTrackingView';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginGate, isAdminSessionValid } from './components/AdminLoginGate';
import { CategoryDetailPage } from './components/CategoryDetailPage';
import { AboutPage } from './components/AboutPage';
import { VideoGalleryPage } from './components/VideoGalleryPage';
import { CustomerAccountModal } from './components/CustomerAccountModal';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { MenuDrawer } from './components/MenuDrawer';
import { PolicyPage } from './components/PolicyPage';
import { FounderSection, FounderData } from './components/FounderSection';
import { CustomerUgcSection } from './components/CustomerUgcSection';
import { Footer } from './components/Footer';
import { FloatingAdminButton } from './components/FloatingAdminButton';
import { AiAssistantModal } from './components/AiAssistantModal';
import {
  DEFAULT_STORE_CONTENT,
  DEFAULT_CATEGORY_HEROES,
  StoreContent,
  CategoryHeroConfig,
  seedProductsIfEmpty,
  getInitialStoreContent,
  mergeStoreContent,
  saveStoreContentPersisted,
  mergeCatalogProducts,
  saveProductPersisted,
  deleteProductPersisted,
  setRemoteDeletedProductIds,
  resolveProductByIdOrAlias,
  resolveOrSynthesizeProductForUrl,
  LEGACY_PRODUCT_ID_ALIASES,
  compressImageFileToDataUrl,
  getPersistedOrders,
  syncStoreContentToLocalCache,
  resolveCategoryIdFromUrl,
  extractUrlProductRoute,
  extractUrlCatalogRoute,
  navigateToStoreRoute,
  uploadBannerImageToServer,
} from './lib/storeSync';
import {
  initializeMultiPixels,
  initializeGoogleSeoAndTags,
  trackPixelPageView,
  syncAutoCatalogWithPixels,
} from './lib/pixelManager';
import { ChevronLeft, ChevronRight, Clock, Sparkles, Upload, X, Loader2 } from 'lucide-react';

// Map legacy category strings to the 11 official category IDs so all products match accurately
function normalizeCategoryId(cat: string, productName = ''): string {
  return resolveCategoryIdFromUrl(cat, productName);
}

function StoreMain() {
  const initialStore = useMemo(() => getInitialStoreContent(), []);
  const [products, setProducts] = useState<Product[]>(() => mergeCatalogProducts(INITIAL_PRODUCTS));
  const initialUrlProdRoute = useMemo(() => extractUrlProductRoute(), []);
  const initialUrlCatRoute = useMemo(() => extractUrlCatalogRoute(), []);
  const [activeCategory, setActiveCategory] = useState<ProductCategory>(() =>
    !initialUrlProdRoute.rawProdId && initialUrlCatRoute ? initialUrlCatRoute : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [detailedProduct, setDetailedProduct] = useState<Product | null>(() => {
    if (initialUrlProdRoute.rawProdId) {
      const initialList = mergeCatalogProducts(INITIAL_PRODUCTS);
      return (
        resolveProductByIdOrAlias(initialList, initialUrlProdRoute.rawProdId) ||
        resolveOrSynthesizeProductForUrl(initialList, initialUrlProdRoute.rawProdId) ||
        null
      );
    }
    return null;
  });
  const [detailedProductStep, setDetailedProductStep] = useState<'product' | 'checkout' | 'thank_you'>(() =>
    initialUrlProdRoute.isCheckoutStep ? 'checkout' : 'product'
  );
  const [isResolvingUrlProduct, setIsResolvingUrlProduct] = useState<boolean>(false);
  const [thankYouOrder, setThankYouOrder] = useState<Order | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFounderEditOpen, setIsFounderEditOpen] = useState(false);
  const [founderData, setFounderData] = useState<FounderData>(initialStore.founder);
  const [pageContent, setPageContent] = useState(
    initialStore.pageContent || DEFAULT_STORE_CONTENT.pageContent!
  );
  const [socialLinks, setSocialLinks] = useState(
    initialStore.socialLinks || DEFAULT_STORE_CONTENT.socialLinks!
  );
  const [whatsappNumber, setWhatsappNumber] = useState(initialStore.whatsappNumber);
  const [hotlineNumber, setHotlineNumber] = useState(initialStore.hotlineNumber);
  const [officialEmail, setOfficialEmail] = useState(
    initialStore.officialEmail || DEFAULT_STORE_CONTENT.officialEmail || 'dokandari.shop@gmail.com'
  );
  const [heroSlides, setHeroSlides] = useState(initialStore.heroSlides);
  const [categoryHeroes, setCategoryHeroes] = useState<Record<string, CategoryHeroConfig>>(
    initialStore.categoryHeroes || DEFAULT_CATEGORY_HEROES
  );
  const [carouselInterval, setCarouselInterval] = useState<number>(
    initialStore.carouselInterval || 3000
  );
  const [bestSellingInterval, setBestSellingInterval] = useState<number>(
    initialStore.bestSellingInterval || 5000
  );
  const [bestSellingIndex, setBestSellingIndex] = useState<number>(0);
  const [categoryOrder, setCategoryOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dokandari_category_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map((id: string) =>
            id === 'fashion_clothing' ? 'organic_food' : id
          );
          if (!migrated.includes('organic_food')) {
            migrated.splice(2, 0, 'organic_food');
          }
          return Array.from(new Set(migrated));
        }
      }
    } catch {
      // ignore
    }
    return initialStore.categoryOrder || OFFICIAL_CATEGORIES.map((c) => c.id);
  });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | undefined>(undefined);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return isAdminSessionValid();
  });
  const [activeCategoryPage, setActiveCategoryPage] = useState<string | null>(() =>
    !initialUrlProdRoute.rawProdId && initialUrlCatRoute && initialUrlCatRoute !== 'all'
      ? initialUrlCatRoute
      : null
  );
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isVideoGalleryOpen, setIsVideoGalleryOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHeroAiModalOpen, setIsHeroAiModalOpen] = useState(false);
  const [heroAiPrompt, setHeroAiPrompt] = useState('');
  const [heroAiImage, setHeroAiImage] = useState('');
  const [isHeroAiLoading, setIsHeroAiLoading] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const bestSellingTrackRef = useRef<HTMLDivElement | null>(null);
  const { addToCart, setIsCartOpen } = useCart();

  // Compute ordered categories according to Admin drag-and-drop sequence (Default: Home Decor 1st, Gadgets 2nd, Fashion 3rd...)
  const orderedCategories = useMemo(() => {
    const map = new Map(OFFICIAL_CATEGORIES.map((c) => [c.id, c]));
    const result: typeof OFFICIAL_CATEGORIES = [];
    for (const id of categoryOrder) {
      const item = map.get(id as any);
      if (item) {
        result.push(item);
        map.delete(id as any);
      }
    }
    for (const remaining of map.values()) {
      result.push(remaining);
    }
    return result;
  }, [categoryOrder]);

  // Configurable automatic sliding interval (controlled from Admin Panel)
  useEffect(() => {
    if (!heroSlides.length) return;
    const ms = Math.max(1000, carouselInterval || 3000);
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, ms);
    return () => clearInterval(timer);
  }, [heroSlides.length, carouselInterval]);

  const hasFounderProfileDocRef = useRef(false);
  const hasAutoSyncedPixelCatalogRef = useRef(false);

  // Automatically emit full catalog Schema.org ItemList + Product Microdata to connected Meta & TikTok Pixels
  useEffect(() => {
    if (products.length > 0 && !hasAutoSyncedPixelCatalogRef.current) {
      hasAutoSyncedPixelCatalogRef.current = true;
      syncAutoCatalogWithPixels(products, { forceFullBroadcast: false }).catch(() => null);
    }
  }, [products]);

  // Attach real-time Firestore listeners + Server Catalog Mirror fallback for 100% external/mobile browser reliability
  useEffect(() => {
    let latestRemoteList: Product[] = INITIAL_PRODUCTS;
    let hasSeededThisSession = false;

    // 0. Always fetch `/api/catalog/products` so external/mobile browsers get all live products even if WebChannel is slow/restricted
    fetch('/api/catalog/products')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.products) && data.products.length > 0) {
          const merged = mergeCatalogProducts([...data.products, ...latestRemoteList]);
          latestRemoteList = merged;
          setProducts(merged);
          syncAutoCatalogWithPixels(merged, { forceFullBroadcast: false }).catch(() => null);
          setDetailedProduct((current) => {
            if (!current) {
              const route = extractUrlProductRoute();
              if (route.rawProdId) {
                const matchedFromUrl = resolveProductByIdOrAlias(merged, route.rawProdId);
                if (matchedFromUrl) {
                  setIsResolvingUrlProduct(false);
                  return matchedFromUrl;
                }
              }
              return null;
            }
            return resolveProductByIdOrAlias(merged, current.id) || current;
          });
        }
      })
      .catch(() => null);

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        if (!hasSeededThisSession) {
          hasSeededThisSession = true;
          seedProductsIfEmpty().catch(() => null);
        }
        if (!snap.empty) {
          const list: Product[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data() as Product;
            list.push({ ...data, id: data.id || docSnap.id });
          });
          latestRemoteList = list;
          const merged = mergeCatalogProducts(list);
          setProducts(merged);
          setDetailedProduct((current) => {
            if (!current) {
              const route = extractUrlProductRoute();
              if (route.rawProdId) {
                const matchedFromUrl = resolveProductByIdOrAlias(merged, route.rawProdId);
                if (matchedFromUrl) {
                  setIsResolvingUrlProduct(false);
                  return matchedFromUrl;
                }
              }
              return null;
            }
            const updated = resolveProductByIdOrAlias(merged, current.id);
            return updated || current;
          });
        } else {
          latestRemoteList = INITIAL_PRODUCTS;
          setProducts(mergeCatalogProducts(INITIAL_PRODUCTS));
        }
      },
      (err) => {
        console.warn('Realtime products listener note', err);
      }
    );

    // Initialize local pixel credentials immediately at 0ms while Firestore snapshot connects
    const localCredsRaw = localStorage.getItem('dokandari_api_credentials');
    if (localCredsRaw) {
      try {
        const creds = JSON.parse(localCredsRaw);
        initializeMultiPixels(creds?.facebookPixelId, creds?.tiktokPixelId, creds?.youtubeTagId);
        initializeGoogleSeoAndTags({
          gtmContainerId: creds?.gtmContainerId,
          ga4MeasurementId: creds?.ga4MeasurementId || creds?.youtubeTagId,
          googleSearchConsoleCode: creds?.googleSearchConsoleCode,
        });
        trackPixelPageView();
      } catch {
        // ignore
      }
    }

    // Fetch server-side store content mirror immediately on boot so live domains (dokandari.com / dukandari.com)
    // always render the latest saved Hero Banners & Category Heroes even before Firestore WebChannel connects
    fetch('/api/store/content')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.success && d?.content) {
          const mergedServer = mergeStoreContent(d.content);
          syncStoreContentToLocalCache(mergedServer);
          if (Array.isArray(mergedServer.heroSlides) && mergedServer.heroSlides.length > 0) {
            setHeroSlides(mergedServer.heroSlides);
          }
          if (mergedServer.categoryHeroes) {
            setCategoryHeroes(mergedServer.categoryHeroes);
          }
          if (typeof mergedServer.carouselInterval === 'number' && mergedServer.carouselInterval >= 1000) {
            setCarouselInterval(mergedServer.carouselInterval);
          }
        }
      })
      .catch(() => null);

    // Unified single collection listener for `settings` (fetches deleted_products, store_content, api_credentials, founder_profile in 1 stream)
    const unsubAllSettings = onSnapshot(
      collection(db, 'settings'),
      (snap) => {
        const docsMap: Record<string, any> = {};
        snap.forEach((d) => {
          docsMap[d.id] = d.data();
        });

        // 1. Deleted products
        if (docsMap.deleted_products && Array.isArray(docsMap.deleted_products.ids)) {
          setRemoteDeletedProductIds(docsMap.deleted_products.ids);
          const merged = mergeCatalogProducts(latestRemoteList);
          setProducts(merged);
        }

        // 2. Founder profile (process before store_content so hasFounderProfileDocRef is set)
        if (docsMap.founder_profile) {
          const data = docsMap.founder_profile;
          hasFounderProfileDocRef.current = true;
          if (data?.founder) {
            const rawPhoto = String(data.founder.photo || '').trim();
            const cleanPhoto = rawPhoto.includes('photo-1507003211169-0a1dd7228f2d') ? '' : rawPhoto;
            const fName = String(data.founder.name || '').trim();
            const fPhone = String(data.founder.phone || '').trim();
            const isLegacy = !fName || fName.includes('জান্নাতুল') || fName.includes('রনি');
            const isLegacyPhone = !fPhone || fPhone.includes('09638757282');
            const cleanedFounder = {
              ...data.founder,
              name: isLegacy ? DEFAULT_STORE_CONTENT.founder.name : data.founder.name,
              title:
                isLegacy || data.founder.title === 'Founder & CEO, Dokandari'
                  ? DEFAULT_STORE_CONTENT.founder.title
                  : data.founder.title,
              bio:
                isLegacy || String(data.founder.bio || '').includes('মাল্টি-ক্যাটাগরি')
                  ? DEFAULT_STORE_CONTENT.founder.bio
                  : data.founder.bio,
              phone: isLegacyPhone ? DEFAULT_STORE_CONTENT.founder.phone : data.founder.phone,
              photo: cleanPhoto,
            };
            setFounderData((prev) => {
              const next = { ...prev, ...cleanedFounder };
              syncStoreContentToLocalCache({ founder: next });
              return next;
            });
          }
          if (data?.pageContent) {
            setPageContent((prev) => {
              const next = { ...prev, ...data.pageContent };
              syncStoreContentToLocalCache({ pageContent: next });
              return next;
            });
          }
        }

        // 3. Store content
        if (docsMap.store_content) {
          const mergedContent = mergeStoreContent(docsMap.store_content);
          if (!hasFounderProfileDocRef.current) {
            setFounderData(mergedContent.founder);
            setPageContent(mergedContent.pageContent!);
            syncStoreContentToLocalCache({
              founder: mergedContent.founder,
              pageContent: mergedContent.pageContent,
            });
          }
          setSocialLinks(mergedContent.socialLinks!);
          setWhatsappNumber(mergedContent.whatsappNumber);
          setHotlineNumber(mergedContent.hotlineNumber);
          setOfficialEmail(
            mergedContent.officialEmail ||
              DEFAULT_STORE_CONTENT.officialEmail ||
              'dokandari.shop@gmail.com'
          );
          if (Array.isArray(mergedContent.heroSlides) && mergedContent.heroSlides.length > 0) {
            setHeroSlides(mergedContent.heroSlides);
          }
          if (mergedContent.categoryHeroes) {
            setCategoryHeroes(mergedContent.categoryHeroes);
          }
          if (
            typeof mergedContent.carouselInterval === 'number' &&
            mergedContent.carouselInterval >= 1000
          ) {
            setCarouselInterval(mergedContent.carouselInterval);
          }
          if (
            typeof mergedContent.bestSellingInterval === 'number' &&
            mergedContent.bestSellingInterval >= 1000
          ) {
            setBestSellingInterval(mergedContent.bestSellingInterval);
          }
          if (Array.isArray(mergedContent.categoryOrder) && mergedContent.categoryOrder.length > 0) {
            setCategoryOrder(mergedContent.categoryOrder);
            localStorage.setItem(
              'dokandari_category_order',
              JSON.stringify(mergedContent.categoryOrder)
            );
          }
        }

        // 4. API & Pixel credentials
        if (docsMap.api_credentials) {
          const creds = docsMap.api_credentials;
          localStorage.setItem('dokandari_api_credentials', JSON.stringify(creds));
          const metaIds = creds?.facebookPixelId || '';
          const tiktokIds = creds?.tiktokPixelId || '';
          const youtubeIds = creds?.youtubeTagId || '';
          initializeMultiPixels(metaIds, tiktokIds, youtubeIds);
          initializeGoogleSeoAndTags({
            gtmContainerId: creds?.gtmContainerId,
            ga4MeasurementId: creds?.ga4MeasurementId || creds?.youtubeTagId,
            googleSearchConsoleCode: creds?.googleSearchConsoleCode,
          });
          trackPixelPageView();
        }
      },
      (err) => {
        console.warn('Realtime settings collection listener note', err);
      }
    );

    return () => {
      unsubProducts();
      unsubAllSettings();
    };
  }, []);

  // Support clean domain-relative pathname routing (/products/:id, /product/:id, /thank-you/:orderId, /catalog/:catId) + query (?product=id) + hash
  useEffect(() => {
    const syncFromUrl = () => {
      const pathname = window.location.pathname;
      const hash = window.location.hash;

      // 1. Thank You Order Confirmation Route: /thank-you/:orderId
      if (pathname.startsWith('/thank-you/')) {
        const orderId = decodeURIComponent(pathname.replace('/thank-you/', '').split('/')[0]);
        if (orderId) {
          const localOrders = getPersistedOrders();
          const foundLocalOrder = localOrders.find((o) => o.id === orderId);
          if (foundLocalOrder) {
            const firstItemProdId =
              foundLocalOrder.items?.[0]?.productId || foundLocalOrder.items?.[0]?.id;
            const matchedProd =
              resolveProductByIdOrAlias(products, firstItemProdId) ||
              products[0] ||
              INITIAL_PRODUCTS[0];
            setThankYouOrder(foundLocalOrder);
            setDetailedProductStep('thank_you');
            setDetailedProduct(matchedProd);
            setIsResolvingUrlProduct(false);
            setActiveCategoryPage(null);
            setIsAboutOpen(false);
            setIsVideoGalleryOpen(false);
            return;
          }
          // Also check Firestore if not in localStorage
          getDoc(doc(db, 'orders', orderId))
            .then((snap) => {
              if (snap.exists()) {
                const remoteOrder = snap.data() as Order;
                const firstItemProdId =
                  remoteOrder.items?.[0]?.productId || remoteOrder.items?.[0]?.id;
                const matchedProd =
                  resolveProductByIdOrAlias(products, firstItemProdId) ||
                  products[0] ||
                  INITIAL_PRODUCTS[0];
                setThankYouOrder(remoteOrder);
                setDetailedProductStep('thank_you');
                setDetailedProduct(matchedProd);
                setIsResolvingUrlProduct(false);
                setActiveCategoryPage(null);
                setIsAboutOpen(false);
                setIsVideoGalleryOpen(false);
              }
            })
            .catch(() => null);
          return;
        }
      }

      // 2. Product Detail & Instant Checkout Routes (/products/:id, /product/:id, ?product=:id, #/products/:id)
      const prodRoute = extractUrlProductRoute();
      if (prodRoute.rawProdId) {
        const found = resolveProductByIdOrAlias(products, prodRoute.rawProdId);
        if (found) {
          setThankYouOrder(null);
          setDetailedProductStep(prodRoute.isCheckoutStep ? 'checkout' : 'product');
          setDetailedProduct(found);
          setIsResolvingUrlProduct(false);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          return;
        }

        // Fast dual lookup (Firestore + Server REST Mirror `/api/catalog/product/:id`) for any external/mobile browser
        setIsResolvingUrlProduct(true);
        const targetDocId =
          LEGACY_PRODUCT_ID_ALIASES[prodRoute.rawProdId] ||
          LEGACY_PRODUCT_ID_ALIASES[prodRoute.rawProdId.toLowerCase()] ||
          prodRoute.rawProdId;

        const applyResolvedProduct = (remoteProd: Product) => {
          const merged = mergeCatalogProducts([remoteProd, ...products]);
          const resolved = resolveProductByIdOrAlias(merged, remoteProd.id) || remoteProd;
          setProducts(merged);
          setThankYouOrder(null);
          setDetailedProductStep(prodRoute.isCheckoutStep ? 'checkout' : 'product');
          setDetailedProduct(resolved);
          setIsResolvingUrlProduct(false);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
        };

        Promise.allSettled([
          getDoc(doc(db, 'products', targetDocId)).then((snap) =>
            snap.exists() ? ({ ...(snap.data() as Product), id: snap.id } as Product) : null
          ),
          fetch(`/api/catalog/product/${encodeURIComponent(prodRoute.rawProdId)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => (d?.product ? (d.product as Product) : null)),
        ])
          .then(async (results) => {
            const fsProd = results[0].status === 'fulfilled' ? results[0].value : null;
            const apiProd = results[1].status === 'fulfilled' ? results[1].value : null;
            const chosen = fsProd || apiProd;
            if (chosen) {
              applyResolvedProduct(chosen);
              return;
            }
            // Final fallback: fetch full catalog from server mirror and match by alias/slug or guaranteed product synthesis
            try {
              const allRes = await fetch('/api/catalog/products');
              if (allRes.ok) {
                const allData = await allRes.json();
                if (Array.isArray(allData?.products)) {
                  const mergedAll = mergeCatalogProducts([...allData.products, ...products]);
                  setProducts(mergedAll);
                  const matched =
                    resolveProductByIdOrAlias(mergedAll, prodRoute.rawProdId) ||
                    resolveOrSynthesizeProductForUrl(mergedAll, prodRoute.rawProdId);
                  if (matched) {
                    applyResolvedProduct(matched);
                    return;
                  }
                }
              }
            } catch {
              // ignore
            }
            // Guaranteed fallback so `/products/:id` on live domain never shows a blank page
            const guaranteed = resolveOrSynthesizeProductForUrl(products, prodRoute.rawProdId);
            if (guaranteed) {
              applyResolvedProduct(guaranteed);
            }
          })
          .finally(() => {
            setIsResolvingUrlProduct(false);
          });
        return;
      }

      // 3. Category / Catalog Routes (/catalog/:catId, /category/:catId, ?catalog=:catId, #/catalog/:catId)
      const catRoute = extractUrlCatalogRoute();
      if (catRoute) {
        setThankYouOrder(null);
        setActiveCategory(catRoute as ProductCategory);
        setActiveCategoryPage(catRoute === 'all' ? null : catRoute);
        setDetailedProduct(null);
        setIsResolvingUrlProduct(false);
        setIsAboutOpen(false);
        setIsVideoGalleryOpen(false);
        setIsPolicyOpen(false);
        setIsTrackingOpen(false);
        setIsAdminOpen(false);
        return;
      }

      // 4. Static Page Routes
      const normalizedPath = pathname.replace(/\/+$/, '') || '/';
      if (normalizedPath === '/about' || hash === '#/about') {
        setIsAboutOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsVideoGalleryOpen(false);
        setIsPolicyOpen(false);
        setIsTrackingOpen(false);
        setIsAdminOpen(false);
        return;
      } else if (normalizedPath === '/videos' || hash === '#/videos') {
        setIsVideoGalleryOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsAboutOpen(false);
        setIsPolicyOpen(false);
        setIsTrackingOpen(false);
        setIsAdminOpen(false);
        return;
      } else if (normalizedPath === '/privacy' || hash === '#/privacy') {
        setIsPolicyOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsAboutOpen(false);
        setIsVideoGalleryOpen(false);
        setIsTrackingOpen(false);
        setIsAdminOpen(false);
        return;
      } else if (normalizedPath === '/track' || normalizedPath === '/tracking' || hash === '#/track') {
        setIsTrackingOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsAboutOpen(false);
        setIsVideoGalleryOpen(false);
        setIsPolicyOpen(false);
        setIsAdminOpen(false);
        return;
      } else if (normalizedPath === '/admin' || hash === '#/admin') {
        setIsAdminOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsAboutOpen(false);
        setIsVideoGalleryOpen(false);
        setIsPolicyOpen(false);
        setIsTrackingOpen(false);
        return;
      } else if (normalizedPath === '/' && (!hash || hash === '#' || hash === '#/')) {
        // Explicit Home Route fallback: ensure no stale detail or overlay page blocks the storefront
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsResolvingUrlProduct(false);
        setIsAboutOpen(false);
        setIsVideoGalleryOpen(false);
        setIsPolicyOpen(false);
      }
    };
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    window.addEventListener('dokandari:urlchange', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
      window.removeEventListener('dokandari:urlchange', syncFromUrl);
    };
  }, [products]);

  // Only show published products to customers on storefront
  const publishedProducts = useMemo(() => {
    return products.filter((p) => p.status !== 'draft');
  }, [products]);

  // Homepage Best-Selling Carousel & Homepage general products strictly exclude organic_food
  // (Organic Food products appear ONLY inside the dedicated Organic Food category section and /catalog/organic_food page)
  const homepageNonOrganicProducts = useMemo(() => {
    return publishedProducts.filter(
      (p) => p.category !== 'organic_food' && normalizeCategoryId(p.category, p.name) !== 'organic_food'
    );
  }, [publishedProducts]);

  // Step-by-step Right-to-Left auto-sliding for Best-Selling Compact Square Carousel (3s, 5s, 8s, 10s)
  useEffect(() => {
    if (homepageNonOrganicProducts.length <= 1) return;
    const ms = Math.max(2000, bestSellingInterval || 5000);
    const timer = setInterval(() => {
      setBestSellingIndex((prev) => {
        const nextIdx = (prev + 1) % homepageNonOrganicProducts.length;
        const container = bestSellingTrackRef.current;
        if (container) {
          const firstChild = container.firstElementChild as HTMLElement | null;
          const stepWidth = firstChild ? firstChild.offsetWidth + 10 : 160;
          const maxScroll = container.scrollWidth - container.clientWidth;
          if (container.scrollLeft + stepWidth >= maxScroll + 20) {
            container.scrollTo({ left: 0, behavior: 'smooth' });
          } else {
            container.scrollBy({ left: stepWidth, behavior: 'smooth' });
          }
        }
        return nextIdx;
      });
    }, ms);
    return () => clearInterval(timer);
  }, [homepageNonOrganicProducts.length, bestSellingInterval]);

  // Calculate dynamic product counts per category
  const productCounts = useMemo(() => {
    const counts: Record<string, number> = { all: publishedProducts.length };
    OFFICIAL_CATEGORIES.forEach((c) => {
      counts[c.id] = 0;
    });
    publishedProducts.forEach((p) => {
      const norm = normalizeCategoryId(p.category, p.name);
      counts[norm] = (counts[norm] || 0) + 1;
    });
    return counts;
  }, [publishedProducts]);

  // Filter products by category & search (with automatic non-empty catalog fallback when searchQuery is empty)
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const matched = publishedProducts.filter((p) => {
      const normCat = normalizeCategoryId(p.category, p.name);
      if (activeCategory === 'all' && !q && (p.category === 'organic_food' || normCat === 'organic_food')) {
        return false;
      }
      const matchCat =
        activeCategory === 'all' || p.category === activeCategory || normCat === activeCategory;
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.titleEn && p.titleEn.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
    if (matched.length === 0 && !q) {
      return homepageNonOrganicProducts.length > 0 ? homepageNonOrganicProducts : publishedProducts;
    }
    return matched;
  }, [publishedProducts, homepageNonOrganicProducts, activeCategory, searchQuery]);

  // Handle instant order click (from "অর্ডার করুন" button -> opens dedicated Instant Checkout Page)
  const handleInstantOrder = (product: Product) => {
    setThankYouOrder(null);
    setDetailedProductStep('checkout');
    setDetailedProduct(product);
    setActiveCategoryPage(null);
    setIsAboutOpen(false);
    setIsVideoGalleryOpen(false);
    setIsPolicyOpen(false);
    setIsTrackingOpen(false);
    setIsAdminOpen(false);
    navigateToStoreRoute(`/products/${encodeURIComponent(product.id)}/checkout?brand=dokandari`);
  };

  const handleAddProduct = async (newProd: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === newProd.id);
      if (exists) return prev.map((p) => (p.id === newProd.id ? newProd : p));
      return [newProd, ...prev];
    });
    if (detailedProduct?.id === newProd.id) {
      setDetailedProduct(newProd);
    }
    await saveProductPersisted(newProd);
  };

  const handleDeleteProduct = async (productId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    if (detailedProduct?.id === productId) {
      setDetailedProduct(null);
    }
    await deleteProductPersisted(productId);
  };

  const handleApplyStoreContentUpdate = (updated: StoreContent) => {
    if (updated.founder) setFounderData(updated.founder);
    if (updated.pageContent) setPageContent(updated.pageContent);
    if (updated.socialLinks) setSocialLinks(updated.socialLinks);
    if (updated.whatsappNumber) setWhatsappNumber(updated.whatsappNumber);
    if (updated.hotlineNumber) setHotlineNumber(updated.hotlineNumber);
    if (updated.officialEmail) setOfficialEmail(updated.officialEmail);
    if (Array.isArray(updated.heroSlides) && updated.heroSlides.length > 0) {
      setHeroSlides(updated.heroSlides);
    }
    if (updated.categoryHeroes) {
      setCategoryHeroes(updated.categoryHeroes);
    }
    if (typeof updated.carouselInterval === 'number') {
      setCarouselInterval(updated.carouselInterval);
    }
    if (typeof updated.bestSellingInterval === 'number') {
      setBestSellingInterval(updated.bestSellingInterval);
    }
    if (Array.isArray(updated.categoryOrder) && updated.categoryOrder.length > 0) {
      setCategoryOrder(updated.categoryOrder);
    }
  };

  const handleSaveCategoryHero = async (catId: string, updatedHero: CategoryHeroConfig) => {
    const nextHeroes = {
      ...categoryHeroes,
      [catId]: updatedHero,
    };
    setCategoryHeroes(nextHeroes);
    await saveStoreContentPersisted({ categoryHeroes: nextHeroes });
  };

  const handleRemoveFounderPhoto = async () => {
    const nextFounder: FounderData = {
      ...founderData,
      photo: '',
    };
    setFounderData(nextFounder);
    await saveStoreContentPersisted({ founder: nextFounder });
  };

  const handleHeroAiBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsHeroAiLoading(true);
      const uploadedUrl = await uploadBannerImageToServer(file, `hero-slide-${currentSlide + 1}`);
      setHeroAiImage(uploadedUrl);
      // Immediately persist the uploaded banner image to the current slide in Firestore + Server Mirror
      const nextSlides = heroSlides.map((s, idx) =>
        idx === currentSlide ? { ...s, image: uploadedUrl } : s
      );
      setHeroSlides(nextSlides);
      await saveStoreContentPersisted({ heroSlides: nextSlides });
    } catch (err) {
      console.warn('Hero banner image upload note:', err);
    } finally {
      setIsHeroAiLoading(false);
    }
  };

  const handleApplyHeroAiBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsHeroAiLoading(true);
    try {
      const activeSlide = heroSlides[currentSlide] || heroSlides[0];
      const effectiveImage = heroAiImage || activeSlide?.image || '';
      if (heroAiPrompt.trim()) {
        const res = await fetch('/api/gemini/ai-edit-section', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionType: 'hero_banner',
            instruction: heroAiPrompt.trim(),
            imageDataUrl: effectiveImage,
            currentData: activeSlide,
          }),
        });
        const json = await res.json();
        const d = json?.data || {};
        const nextSlides = heroSlides.map((s, idx) =>
          idx === currentSlide
            ? {
                ...s,
                image: effectiveImage,
                tag: d.tag || s.tag,
                title: d.title || s.title,
                subtitle: d.subtitle || s.subtitle,
                ctaText: d.ctaText || s.ctaText,
              }
            : s
        );
        setHeroSlides(nextSlides);
        await saveStoreContentPersisted({ heroSlides: nextSlides });
      } else {
        const nextSlides = heroSlides.map((s, idx) =>
          idx === currentSlide ? { ...s, image: effectiveImage } : s
        );
        setHeroSlides(nextSlides);
        await saveStoreContentPersisted({ heroSlides: nextSlides });
      }
      setHeroAiImage('');
      setHeroAiPrompt('');
      setIsHeroAiModalOpen(false);
    } catch (err) {
      console.warn('Hero AI edit note:', err);
      setIsHeroAiModalOpen(false);
    } finally {
      setIsHeroAiLoading(false);
    }
  };

  const isOrganicGreenActive =
    (activeCategoryPage === 'organic_food' && !detailedProduct && !isAboutOpen && !isAdminOpen && !isPolicyOpen && !isVideoGalleryOpen && !isTrackingOpen) ||
    Boolean(detailedProduct && detailedProduct.category === 'organic_food');

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] overflow-x-hidden w-full">
      {/* Top Header with Ticker, Dokandari Logo & Navigation */}
      <Header
        isOrganicGreen={isOrganicGreenActive}
        onGoHome={() => {
          setActiveCategory('all');
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          navigateToStoreRoute('/');
        }}
        onOpenAdmin={() => {
          setIsAdminAuthenticated(isAdminSessionValid());
          setIsAdminOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsTrackingOpen(false);
          navigateToStoreRoute('/admin');
        }}
        onOpenTracking={() => {
          setIsTrackingOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsAdminOpen(false);
          navigateToStoreRoute('/track');
        }}
        onOpenVideoGallery={() => {
          setIsVideoGalleryOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsPolicyOpen(false);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          navigateToStoreRoute('/videos');
        }}
        onOpenAccount={() => setIsAccountOpen(true)}
        onOpenLogin={() => setIsCustomerAuthOpen(true)}
        onOpenMenu={() => setIsMenuOpen(true)}
        onOpenAiAssistant={() => setIsAiOpen(true)}
        onOpenAbout={() => {
          setIsAboutOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsAdminOpen(false);
          setIsTrackingOpen(false);
          navigateToStoreRoute('/about');
        }}
        onOpenPrivacy={() => {
          setIsPolicyOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsAdminOpen(false);
          setIsTrackingOpen(false);
          navigateToStoreRoute('/privacy');
        }}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isAdmin={isAdminAuthenticated}
      />

      <main className="flex-1 w-full">
        {editingProduct ? (
          <ProductCustomizationPage
            product={editingProduct}
            onBack={() => setEditingProduct(null)}
            onProductUpdated={(updated) => {
              setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
              if (detailedProduct?.id === updated.id) {
                setDetailedProduct(updated);
              }
              setEditingProduct(null);
            }}
            onProductDeleted={(id) => {
              setProducts((prev) => prev.filter((p) => p.id !== id));
              if (detailedProduct?.id === id) {
                setDetailedProduct(null);
              }
              setEditingProduct(null);
            }}
          />
        ) : isTrackingOpen ? (
          <OrderTrackingView
            initialOrderId={trackingOrderId}
            onBackToShopping={() => {
              setIsTrackingOpen(false);
              setTrackingOrderId(undefined);
              navigateToStoreRoute('/');
            }}
          />
        ) : isAdminOpen ? (
          isAdminAuthenticated ? (
            <AdminPanel
              onBackToStore={() => {
                setIsAdminOpen(false);
                setIsAdminAuthenticated(isAdminSessionValid());
                navigateToStoreRoute('/');
              }}
              products={products}
              onAddProduct={handleAddProduct}
              onDeleteProduct={handleDeleteProduct}
              onEditProduct={(p) => setEditingProduct(p)}
              categoryOrder={categoryOrder}
              onUpdateCategoryOrder={async (nextOrder) => {
                setCategoryOrder(nextOrder);
                localStorage.setItem('dokandari_category_order', JSON.stringify(nextOrder));
                await saveStoreContentPersisted({ categoryOrder: nextOrder });
              }}
              onStoreContentUpdated={handleApplyStoreContentUpdate}
            />
          ) : (
            <AdminLoginGate
              onSuccess={() => {
                setIsAdminAuthenticated(true);
              }}
              onCancel={() => {
                setIsAdminOpen(false);
                navigateToStoreRoute('/');
              }}
            />
          )
        ) : isAboutOpen ? (
          <AboutPage
            founderData={founderData}
            pageContent={pageContent}
            isAdmin={isAdminAuthenticated}
            totalProductsCount={publishedProducts.length}
            onBackToHome={() => {
              setIsAboutOpen(false);
              navigateToStoreRoute('/');
            }}
            onOpenStoreProducts={() => {
              setIsAboutOpen(false);
              setActiveCategory('all');
              setActiveCategoryPage(null);
              navigateToStoreRoute('/', { scrollTop: false });
              setTimeout(() => {
                const elem = document.getElementById('products-section');
                if (elem) elem.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            onEditFounder={() => setIsFounderEditOpen(true)}
            onRemoveFounderPhoto={handleRemoveFounderPhoto}
            onFounderDirectSaved={(updatedFounder, updatedStore) => {
              setFounderData(updatedFounder);
              if (updatedStore) {
                handleApplyStoreContentUpdate(updatedStore);
              }
            }}
          />
        ) : isVideoGalleryOpen ? (
          <VideoGalleryPage
            products={publishedProducts}
            onBackToHome={() => {
              setIsVideoGalleryOpen(false);
              navigateToStoreRoute('/');
            }}
            onOpenProductDetail={(p) => {
              setIsVideoGalleryOpen(false);
              setDetailedProduct(p);
              navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
            }}
            onInstantOrder={(p) => {
              setIsVideoGalleryOpen(false);
              handleInstantOrder(p);
            }}
          />
        ) : isPolicyOpen ? (
          <PolicyPage
            pageContent={pageContent}
            isAdmin={isAdminAuthenticated}
            onBackToShopping={() => {
              setIsPolicyOpen(false);
              navigateToStoreRoute('/');
            }}
          />
        ) : detailedProduct ? (
          /* Dedicated Real Product Details Page & Separate Instant Checkout / Thank You Pages */
          <ProductDetailPage
            product={detailedProduct}
            initialStep={detailedProductStep}
            initialCompletedOrder={thankYouOrder}
            isAdmin={isAdminAuthenticated}
            allProducts={publishedProducts}
            categoryHeroes={categoryHeroes}
            onSaveCategoryHero={handleSaveCategoryHero}
            onSelectProduct={(p) => {
              setThankYouOrder(null);
              setDetailedProductStep('product');
              setDetailedProduct(p);
              navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
            }}
            onInstantOrderProduct={handleInstantOrder}
            onBack={() => {
              setThankYouOrder(null);
              setDetailedProduct(null);
              setDetailedProductStep('product');
              navigateToStoreRoute('/');
            }}
            onOpenEdit={(p) => setEditingProduct(p)}
            onOrderSuccess={(orderId) => {
              setThankYouOrder(null);
              setDetailedProduct(null);
              setDetailedProductStep('product');
              setTrackingOrderId(orderId);
              setIsTrackingOpen(true);
            }}
            onProductUpdated={handleAddProduct}
          />
        ) : isResolvingUrlProduct ? (
          <div className="max-w-6xl mx-auto px-4 py-12">
            <div className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-10 shadow-xs animate-pulse grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="aspect-square rounded-2xl bg-stone-200" />
              <div className="space-y-4 py-2">
                <div className="h-4 w-32 bg-rose-100 rounded-full" />
                <div className="h-8 w-3/4 bg-stone-200 rounded-xl" />
                <div className="h-10 w-40 bg-stone-200 rounded-xl" />
                <div className="h-24 w-full bg-stone-100 rounded-2xl" />
                <div className="h-14 w-full bg-rose-200 rounded-2xl" />
              </div>
            </div>
          </div>
        ) : activeCategoryPage && activeCategoryPage !== 'all' ? (
          /* Dedicated Category Detail Page with Editable Category Hero Banner */
          <CategoryDetailPage
            categoryId={activeCategoryPage}
            products={publishedProducts}
            categoryHeroes={categoryHeroes}
            isAdmin={isAdminAuthenticated}
            onSaveCategoryHero={handleSaveCategoryHero}
            onBackToHome={() => {
              setActiveCategoryPage(null);
              setActiveCategory('all');
              navigateToStoreRoute('/');
            }}
            onSelectCategory={(cat) => {
              setActiveCategory(cat);
              if (cat === 'all') {
                setActiveCategoryPage(null);
                navigateToStoreRoute('/');
              } else {
                setActiveCategoryPage(cat);
                navigateToStoreRoute(`/catalog/${encodeURIComponent(cat)}?brand=dokandari`);
              }
            }}
            onOpenProductDetail={(p) => {
              setDetailedProduct(p);
              navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
            }}
            onInstantOrder={handleInstantOrder}
            onEditProduct={isAdminAuthenticated ? (p) => setEditingProduct(p) : undefined}
            onAddNewCategoryProduct={
              isAdminAuthenticated
                ? (catId: string) => {
                    const blankProd: Product = {
                      id: `dkd-${catId}-${Date.now()}`,
                      sku: `DKD-ORG-${Math.floor(1000 + Math.random() * 9000)}`,
                      name: 'নতুন অর্গানিক প্রোডাক্ট',
                      titleEn: 'New Organic Product',
                      category: catId as any,
                      price: 550,
                      originalPrice: 700,
                      images: ['/uploads/product/organic-sundarban-honey.jpg'],
                      description:
                        '১০০% খাঁটি ও প্রাকৃতিক অর্গানিক ফুড। কোনো কেমিক্যাল বা ভেজাল নেই। ডেলিভারিম্যানের সামনে চেক করে মূল্য পরিশোধের সুবিধা।',
                      fabric: '১০০% ন্যাচারাল ও কেমিক্যালমুক্ত অর্গানিক ফুড',
                      features: [
                        '১০০% খাঁটি ও প্রাকৃতিক উপাদান',
                        'কোনো কৃত্রিম রঙ বা প্রিজারভেটিভ নেই',
                        'ওপেন পার্সেল ক্যাশ অন ডেলিভারি',
                      ],
                      variants: {
                        sizes: ['500g', '1 Kg'],
                        colors: ['100% Pure Organic'],
                      },
                      rating: 5.0,
                      reviewCount: 15,
                      inStock: true,
                      status: 'published',
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    };
                    setEditingProduct(blankProd);
                  }
                : undefined
            }
          />
        ) : (
          <>
            {/* Full-Width 100% Bright Daylight Hero Banner Carousel (Zero Dark/Black Placeholders) */}
            <section
              className="relative w-full bg-gradient-to-r from-[#FFF5F7] via-[#FFFDF9] to-[#FFF0F3] border-b border-rose-200/80 overflow-hidden min-h-[250px] sm:min-h-[340px] md:min-h-[380px] select-none"
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null) return;
                const deltaX = e.changedTouches[0].clientX - touchStartX.current;
                if (Math.abs(deltaX) > 40) {
                  if (deltaX < 0) {
                    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
                  } else {
                    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
                  }
                }
                touchStartX.current = null;
              }}
            >
              {heroSlides.map((slide, idx) => (
                <div
                  key={slide.id || idx}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    currentSlide === idx ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  <div className="w-full h-full max-w-7xl mx-auto grid grid-cols-12 items-center px-4 sm:px-10 md:px-14 py-4 sm:py-6 gap-3 sm:gap-6">
                    {/* Left Copy Column: Crisp Bright Daylight Theme */}
                    <div className="col-span-7 sm:col-span-7 flex flex-col justify-center space-y-2 sm:space-y-3.5 z-10 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-block w-fit text-[10px] sm:text-xs font-extrabold bg-[#E11D48] text-white px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                          {slide.tag || 'স্পেশাল কালেকশন'}
                        </span>
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-[#BE123C] bg-white/90 border border-rose-200 px-2.5 py-0.5 rounded-full">
                          ✓ ১০০% অরিজিনাল • ক্যাশ অন ডেলিভারি
                        </span>
                      </div>
                      <h2 className="text-base sm:text-2xl md:text-3xl lg:text-4xl font-black text-stone-900 leading-tight line-clamp-2">
                        {slide.title}
                      </h2>
                      <p className="text-[11px] sm:text-sm text-stone-700 font-medium line-clamp-2 max-w-xl">
                        {slide.subtitle}
                      </p>
                      <div className="pt-1 flex items-center gap-2.5 flex-wrap">
                        <button
                          onClick={() => {
                            const link = (slide.ctaLink || '').trim();
                            if (link.startsWith('/catalog/')) {
                              const catId = link.replace('/catalog/', '').split('?')[0];
                              setActiveCategory(catId as ProductCategory);
                              setActiveCategoryPage(catId);
                              navigateToStoreRoute(`${link}?brand=dokandari`);
                              return;
                            }
                            const elem = document.getElementById('products-section');
                            if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="px-4 sm:px-6 py-2 sm:py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-sm transition-all cursor-pointer"
                        >
                          {slide.ctaText || 'কালেকশন দেখুন'} &rarr;
                        </button>
                        <span className="text-[10px] sm:text-xs font-bold text-stone-500 bg-white/80 px-2.5 py-1 rounded-lg border border-rose-100">
                          স্লাইড {idx + 1} / {heroSlides.length}
                        </span>
                      </div>
                    </div>

                    {/* Right Product / Model Showcase Card: Pure Bright White Frame (Never Black/Dark) */}
                    <div className="col-span-5 sm:col-span-5 h-[180px] sm:h-[260px] md:h-[310px] flex items-center justify-center">
                      <div className="relative w-full h-full rounded-2xl bg-white border-2 border-white shadow-md overflow-hidden flex items-center justify-center">
                        <img
                          src={slide.image || '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg'}
                          alt={slide.title}
                          className="w-full h-full object-cover object-center bg-[#FFFDF9]"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.src.includes('Ha2ef56dd79ed496bafac7990404868f7u.jpg')) {
                              target.src = '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg';
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Manual Previous / Next Controls (Bright White & Rose Buttons) */}
              <button
                onClick={() => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                aria-label="Previous slide"
                className="absolute left-1.5 sm:left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/95 hover:bg-[#E11D48] text-stone-800 hover:text-white border border-rose-200 shadow-sm flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setCurrentSlide((prev) => (prev + 1) % heroSlides.length)}
                aria-label="Next slide"
                className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/95 hover:bg-[#E11D48] text-stone-800 hover:text-white border border-rose-200 shadow-sm flex items-center justify-center transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Slider Dots for all 8-10 Slides */}
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-white/90 px-3 py-1 rounded-full border border-rose-200/80 shadow-2xs">
                {heroSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      currentSlide === idx ? 'w-6 bg-[#E11D48]' : 'w-2 bg-rose-300 hover:bg-rose-400'
                    }`}
                  />
                ))}
              </div>

              {/* Admin-Only Quick AI Hero Banner Edit Button (Bright Theme) */}
              {isAdminAuthenticated && (
                <button
                  type="button"
                  onClick={() => setIsHeroAiModalOpen(true)}
                  className="absolute top-2.5 right-2.5 z-20 px-3 py-1.5 rounded-xl bg-white/95 hover:bg-[#E11D48] text-[#E11D48] hover:text-white text-[11px] font-extrabold border border-rose-300 shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✨ ব্যানার ছবি/লেখা এডিট</span>
                </button>
              )}
            </section>

            {/* Admin-Only Hero Banner AI Edit Modal (Bright Backdrop) */}
            {isAdminAuthenticated && isHeroAiModalOpen && (
              <div className="fixed inset-0 z-50 bg-rose-950/25 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-rose-200 text-xs space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-rose-100">
                    <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#E11D48]" />
                      <span>✨ হিরো ব্যানার স্লাইড #{currentSlide + 1} — AI ছবি ও লেখা এডিট</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsHeroAiModalOpen(false)}
                      className="text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleApplyHeroAiBanner} className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="px-3.5 py-2 bg-[#FFF1F2] hover:bg-rose-100 text-[#E11D48] border border-rose-300 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>📸 নতুন ব্যানার ছবি আপলোড</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleHeroAiBannerUpload}
                          className="hidden"
                        />
                      </label>
                      {heroAiImage && (
                        <img
                          src={heroAiImage}
                          alt="Preview"
                          className="w-16 h-10 rounded-lg object-cover border border-rose-200"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block font-bold text-stone-700 mb-1">
                        AI নির্দেশনা বা নতুন অফার লিখুন (ঐচ্ছিক)
                      </label>
                      <input
                        type="text"
                        value={heroAiPrompt}
                        onChange={(e) => setHeroAiPrompt(e.target.value)}
                        placeholder="যেমন: ঈদ স্পেশাল ৩০% ডিসকাউন্ট ও সারা দেশে ক্যাশ অন ডেলিভারি..."
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsHeroAiModalOpen(false)}
                        className="px-4 py-2 border border-stone-300 rounded-xl text-stone-700 cursor-pointer"
                      >
                        বাতিল
                      </button>
                      <button
                        type="submit"
                        disabled={isHeroAiLoading}
                        className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                      >
                        {isHeroAiLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>{isHeroAiLoading ? 'AI সাজাচ্ছে...' : '✨ AI আপডেট ও সেভ'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Reorderable Official Categories Bar (Default: Home Decor 1st, Gadgets 2nd, Fashion 3rd...) */}
            <CategorySquircleBar
              activeCategory={activeCategory}
              orderedCategories={orderedCategories}
              onSelectCategory={(cat) => {
                setActiveCategory(cat);
                if (cat === 'all') {
                  setActiveCategoryPage(null);
                  navigateToStoreRoute('/');
                } else {
                  setActiveCategoryPage(cat);
                  navigateToStoreRoute(`/catalog/${encodeURIComponent(cat)}?brand=dokandari`);
                }
              }}
              onOpenDedicatedPage={(cat) => {
                setActiveCategory(cat);
                setActiveCategoryPage(cat);
                navigateToStoreRoute(`/catalog/${encodeURIComponent(cat)}?brand=dokandari`);
              }}
              productCounts={productCounts}
            />

            {/* Full-Display Main Products & Ordered Category Catalog Sections */}
            <section id="products-section" className="w-full px-2.5 sm:px-5 lg:px-8 py-4 sm:py-8 space-y-8">
              {/* Compact Square Best-Selling Product Carousel (Excludes Organic Food; Organic Food has its own section & page) */}
              {homepageNonOrganicProducts.length > 0 && !searchQuery.trim() && (
                <div className="bg-white border border-rose-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-[#E11D48] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        🔥
                      </span>
                      <div>
                        <h2 className="text-xs sm:text-base font-extrabold text-stone-900">
                          বেস্ট সেলিং স্পেশাল ক্যারোসেল (Best Selling)
                        </h2>
                        <p className="text-[10px] text-stone-500">
                          প্রতি {bestSellingInterval / 1000} সেকেন্ডে একটি করে প্রোডাক্ট ডান থেকে বামে স্লাইড হয়
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAdminAuthenticated && (
                        <div className="hidden sm:flex items-center gap-1 mr-2">
                          {[3000, 5000, 8000, 10000].map((ms) => (
                            <button
                              key={ms}
                              type="button"
                              onClick={async () => {
                                setBestSellingInterval(ms);
                                try {
                                  await setDoc(
                                    doc(db, 'settings', 'store_content'),
                                    { bestSellingInterval: ms },
                                    { merge: true }
                                  );
                                } catch {
                                  // ignore
                                }
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                bestSellingInterval === ms
                                  ? 'bg-[#E11D48] text-white'
                                  : 'bg-stone-100 text-stone-700 hover:bg-rose-50'
                              }`}
                            >
                              {ms / 1000}s
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (bestSellingTrackRef.current) {
                            bestSellingTrackRef.current.scrollBy({ left: -175, behavior: 'smooth' });
                          }
                        }}
                        className="w-7 h-7 rounded-lg border border-stone-200 hover:border-[#E11D48] bg-stone-50 hover:bg-rose-50 text-stone-700 hover:text-[#E11D48] flex items-center justify-center cursor-pointer"
                        title="বামে যান"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (bestSellingTrackRef.current) {
                            bestSellingTrackRef.current.scrollBy({ left: 175, behavior: 'smooth' });
                          }
                        }}
                        className="w-7 h-7 rounded-lg border border-stone-200 hover:border-[#E11D48] bg-stone-50 hover:bg-rose-50 text-stone-700 hover:text-[#E11D48] flex items-center justify-center cursor-pointer"
                        title="ডানে যান"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Right-to-Left Sliding Compact Square Cards */}
                  <div
                    ref={bestSellingTrackRef}
                    data-active-index={bestSellingIndex}
                    className="flex items-stretch gap-2.5 sm:gap-3 overflow-x-auto scroll-smooth pb-1 scrollbar-none"
                  >
                    {homepageNonOrganicProducts.slice(0, 14).map((product) => (
                      <div
                        key={`bs-${product.id}`}
                        className="w-[136px] sm:w-[164px] md:w-[180px] shrink-0"
                      >
                        <ProductCard
                          compact
                          product={product}
                          onOpenDetail={(p) => {
                            setDetailedProductStep('product');
                            setDetailedProduct(p);
                            navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
                          }}
                          onInstantOrder={handleInstantOrder}
                          onEditProduct={
                            isAdminAuthenticated ? (p) => setEditingProduct(p) : undefined
                          }
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Category Catalog Sections in Exact Admin Drag-and-Drop Order (Home Decor 1st, Gadgets 2nd, etc.) */}
              {activeCategory === 'all' && !searchQuery.trim() && (
                <div className="space-y-8">
                  {orderedCategories.map((cat, idx) => {
                    const catProducts = publishedProducts.filter(
                      (p) => p.category === cat.id || normalizeCategoryId(p.category, p.name) === cat.id
                    );
                    if (catProducts.length === 0) return null;
                    const isOrganicCat = cat.id === 'organic_food';

                    return (
                      <div key={cat.id} className="space-y-3">
                        <div
                          className={`rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-2xs border ${
                            isOrganicCat
                              ? 'bg-[#F0FDF4] border-emerald-200'
                              : 'bg-white border-rose-200/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={cat.image}
                              alt={cat.nameBn}
                              className={`w-10 h-10 rounded-xl object-cover border shrink-0 ${
                                isOrganicCat ? 'border-emerald-300' : 'border-rose-200'
                              }`}
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded text-white ${
                                    isOrganicCat ? 'bg-[#16A34A]' : 'bg-[#E11D48]'
                                  }`}
                                >
                                  ক্যাটালগ #{idx + 1}
                                </span>
                                <h2 className="text-sm sm:text-lg font-extrabold text-stone-900">
                                  {cat.nameBn}
                                </h2>
                                <span
                                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                    isOrganicCat
                                      ? 'text-[#15803D] bg-white border-emerald-200'
                                      : 'text-[#E11D48] bg-rose-50 border-rose-200'
                                  }`}
                                >
                                  {catProducts.length} টি পণ্য
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-600 line-clamp-1 mt-0.5">
                                {isOrganicCat
                                  ? `${cat.nameBn} — ১০০% খাঁটি ও কেমিক্যালমুক্ত অর্গানিক ফুড কালেকশন`
                                  : `${cat.nameBn} — প্রিমিয়াম কালেকশন ও সরাসরি ক্যাশ অন ডেলিভারি`}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setActiveCategory(cat.id);
                              setActiveCategoryPage(cat.id);
                              navigateToStoreRoute(`/catalog/${encodeURIComponent(cat.id)}?brand=dokandari`);
                            }}
                            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                              isOrganicCat
                                ? 'bg-[#16A34A] hover:bg-[#15803D] text-white border-[#16A34A]'
                                : 'bg-[#FFF1F2] hover:bg-[#E11D48] text-[#E11D48] hover:text-white border-rose-200'
                            }`}
                          >
                            {isOrganicCat ? 'অর্গানিক শপ দেখুন →' : 'সব দেখুন →'}
                          </button>
                        </div>

                        {/* Strictly 2 columns on mobile, full multi-column on desktop */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
                          {catProducts.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              greenTheme={isOrganicCat}
                              onOpenDetail={(p) => {
                                setDetailedProductStep('product');
                                setDetailedProduct(p);
                                navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
                              }}
                              onInstantOrder={handleInstantOrder}
                              onEditProduct={
                                isAdminAuthenticated
                                  ? (p) => {
                                      setEditingProduct(p);
                                    }
                                  : undefined
                              }
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* All / Filtered Products Master Grid */}
              <div className="space-y-4">
                <div className="bg-[#FFF1F2] border border-rose-200 rounded-2xl p-3.5 sm:p-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-[#E11D48] text-white text-xs sm:text-sm">
                      🔥
                    </span>
                    <div>
                      <h2 className="text-xs sm:text-base font-extrabold text-stone-900 flex items-center gap-1.5 flex-wrap">
                        <span>
                          {activeCategory === 'all'
                            ? 'সকল বেস্ট সেলিং প্রোডাক্টস (All Store Catalog)'
                            : orderedCategories.find((c) => c.id === activeCategory)?.nameBn ||
                              'নির্বাচিত ক্যাটাগরি'}
                        </span>
                        <span className="text-[10px] font-bold bg-[#E11D48] text-white px-2 py-0.5 rounded-sm">
                          👑 TOP ({filteredProducts.length})
                        </span>
                      </h2>
                    </div>
                  </div>

                  {/* Left/Right navigation & Reset filter */}
                  <div className="flex items-center gap-1.5">
                    {activeCategory !== 'all' && (
                      <button
                        onClick={() => {
                          setActiveCategory('all');
                          setActiveCategoryPage(null);
                          navigateToStoreRoute('/', { scrollTop: false });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#E11D48] text-white text-[11px] font-bold cursor-pointer"
                      >
                        সব দেখুন
                      </button>
                    )}
                  </div>
                </div>

                {/* Product Grid: Strictly 2 columns on mobile (grid-cols-2), full 5-column display on desktop */}
                {filteredProducts.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-rose-100 p-10 text-center space-y-3">
                    <p className="text-sm font-bold text-stone-700">
                      এই ক্যাটাগরিতে বর্তমানে কোনো প্রোডাক্ট পাওয়া যায়নি।
                    </p>
                    <button
                      onClick={() => setActiveCategory('all')}
                      className="px-5 py-2.5 bg-[#E11D48] text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      সকল প্রোডাক্ট দেখুন
                    </button>
                  </div>
                ) : (
                  <div
                    id="bestseller-grid"
                    className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4"
                  >
                    {filteredProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onOpenDetail={(p) => {
                          setDetailedProductStep('product');
                          setDetailedProduct(p);
                          navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
                        }}
                        onInstantOrder={handleInstantOrder}
                        onEditProduct={
                          isAdminAuthenticated
                            ? (p) => {
                                setEditingProduct(p);
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Customer Real-Life Experience (UGC) Section */}
            <div id="customer-ugc-section">
              <CustomerUgcSection
                products={publishedProducts}
                isAdmin={isAdminAuthenticated}
                onSelectProduct={(p) => {
                  setDetailedProductStep('product');
                  setDetailedProduct(p);
                  navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
                }}
              />
            </div>

            {/* Founder & CEO Section with Trust Cards */}
            <div id="founder-section">
              <FounderSection
                founderData={founderData}
                onEdit={
                  isAdminAuthenticated
                    ? () => {
                        setIsFounderEditOpen(true);
                      }
                    : undefined
                }
                onRemovePhoto={isAdminAuthenticated ? handleRemoveFounderPhoto : undefined}
              />
            </div>
          </>
        )}
      </main>

      {/* Floating Bottom-Right Admin Control Button — ONLY visible when Admin is logged in */}
      {isAdminAuthenticated && (
        <FloatingAdminButton
          onClick={() => {
            setIsAdminAuthenticated(isAdminSessionValid());
            setIsAdminOpen(true);
            setActiveCategoryPage(null);
            setDetailedProduct(null);
            setIsAboutOpen(false);
            setIsVideoGalleryOpen(false);
            setIsTrackingOpen(false);
            navigateToStoreRoute('/admin');
          }}
          onExitAdminMode={() => {
            localStorage.removeItem('dokandari_admin_session');
            setIsAdminAuthenticated(false);
            setIsAdminOpen(false);
          }}
        />
      )}

      {/* Footer */}
      <Footer
        isOrganicGreen={isOrganicGreenActive}
        socialLinks={socialLinks}
        whatsappNumber={whatsappNumber}
        hotlineNumber={hotlineNumber}
        officialEmail={officialEmail}
        pageContent={pageContent}
        founderAddress={founderData.address}
        isAdmin={isAdminAuthenticated}
        onUpdateStoreContent={handleApplyStoreContentUpdate}
        onOpenLogin={() => setIsCustomerAuthOpen(true)}
        onOpenAdmin={() => {
          setIsAdminAuthenticated(isAdminSessionValid());
          setIsAdminOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsTrackingOpen(false);
          navigateToStoreRoute('/admin');
        }}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          if (cat === 'all') {
            setActiveCategoryPage(null);
            navigateToStoreRoute('/');
          } else {
            setActiveCategoryPage(cat);
            navigateToStoreRoute(`/catalog/${encodeURIComponent(cat)}?brand=dokandari`);
          }
        }}
        onOpenTracking={() => {
          setIsTrackingOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsAdminOpen(false);
          navigateToStoreRoute('/track');
        }}
        onOpenAiAssistant={() => setIsAiOpen(true)}
        onOpenAbout={() => {
          setIsAboutOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsVideoGalleryOpen(false);
          setIsAdminOpen(false);
          setIsTrackingOpen(false);
          navigateToStoreRoute('/about');
        }}
        onOpenPrivacy={() => {
          setIsPolicyOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsAdminOpen(false);
          setIsTrackingOpen(false);
          navigateToStoreRoute('/privacy');
        }}
      />

      {/* Founder Details Edit Modal */}
      <FounderEditModal
        isOpen={isFounderEditOpen}
        onClose={() => setIsFounderEditOpen(false)}
        founderData={founderData}
        onSave={(updated, updatedStore) => {
          setFounderData(updated);
          if (updatedStore) {
            handleApplyStoreContentUpdate(updatedStore);
          }
        }}
      />

      {/* Product Quick View Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onInstantBuy={(p, color, size, qty) => {
          addToCart(p, color, size, qty);
          setSelectedProduct(null);
          setIsCheckoutOpen(true);
        }}
      />

      {/* Cart Drawer */}
      <CartDrawer
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
        onExploreProducts={() => {
          setActiveCategory('all');
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          navigateToStoreRoute('/');
        }}
      />

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        onOrderSuccess={(orderId) => {
          setTrackingOrderId(orderId);
          setIsTrackingOpen(true);
        }}
      />

      {/* Customer Account Modal */}
      <CustomerAccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        onSelectOrderToTrack={(orderId) => {
          setTrackingOrderId(orderId);
          setIsTrackingOpen(true);
        }}
      />

      {/* Customer Authentication */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
        onGoToCollection={() => {
          setIsCustomerAuthOpen(false);
          const elem = document.getElementById('products-section');
          if (elem) elem.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Slide-out Menu Drawer */}
      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        products={publishedProducts}
        isAdmin={isAdminAuthenticated}
        onOpenLogin={() => {
          setIsMenuOpen(false);
          setIsCustomerAuthOpen(true);
        }}
        onOpenProductDetail={(p) => {
          setIsMenuOpen(false);
          setDetailedProductStep('product');
          setDetailedProduct(p);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
        }}
        onGoHome={() => {
          setIsMenuOpen(false);
          setActiveCategory('all');
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setDetailedProduct(null);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          navigateToStoreRoute('/');
        }}
        onOpenAccount={() => {
          setIsMenuOpen(false);
          setIsAccountOpen(true);
        }}
        onOpenCart={() => {
          setIsMenuOpen(false);
          setIsCartOpen(true);
        }}
        onOpenTracking={() => {
          setIsMenuOpen(false);
          setIsTrackingOpen(true);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setDetailedProduct(null);
          setIsAdminOpen(false);
          navigateToStoreRoute('/track');
        }}
        onOpenVideoGallery={() => {
          setIsMenuOpen(false);
          setIsVideoGalleryOpen(true);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsPolicyOpen(false);
          setDetailedProduct(null);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          navigateToStoreRoute('/videos');
        }}
        onOpenAbout={() => {
          setIsMenuOpen(false);
          setIsAboutOpen(true);
          setActiveCategoryPage(null);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setDetailedProduct(null);
          setIsAdminOpen(false);
          navigateToStoreRoute('/about');
        }}
        onOpenPrivacy={() => {
          setIsMenuOpen(false);
          setIsPolicyOpen(true);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setDetailedProduct(null);
          setIsAdminOpen(false);
          navigateToStoreRoute('/privacy');
        }}
        onOpenAiAssistant={() => {
          setIsMenuOpen(false);
          setIsAiOpen(true);
        }}
        onOpenAdmin={() => {
          setIsMenuOpen(false);
          setIsAdminAuthenticated(isAdminSessionValid());
          setIsAdminOpen(true);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setDetailedProduct(null);
          navigateToStoreRoute('/admin');
        }}
        onSelectCategory={(cat) => {
          setActiveCategory(cat);
          setIsMenuOpen(false);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setDetailedProduct(null);
          if (cat === 'all') {
            setActiveCategoryPage(null);
            navigateToStoreRoute('/');
          } else {
            setActiveCategoryPage(cat);
            navigateToStoreRoute(`/catalog/${encodeURIComponent(cat)}?brand=dokandari`);
          }
        }}
      />

      {/* AI Shopping Assistant Modal */}
      <AiAssistantModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        products={publishedProducts}
        onSelectProduct={(p) => {
          setDetailedProduct(p);
          navigateToStoreRoute(`/products/${encodeURIComponent(p.id)}?brand=dokandari`);
        }}
      />

      {/* Responsive Mobile & Web-App Quick Navigation Dock */}
      {!isAdminOpen && !editingProduct && (
        <nav
          aria-label="Mobile Web App Navigation"
          className="fixed bottom-0 inset-x-0 z-40 sm:hidden bg-white/95 backdrop-blur-md border-t border-rose-100 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around"
        >
          <button
            onClick={() => {
              setActiveCategory('all');
              setActiveCategoryPage(null);
              setDetailedProduct(null);
              setIsAboutOpen(false);
              setIsVideoGalleryOpen(false);
              setIsPolicyOpen(false);
              setIsTrackingOpen(false);
              navigateToStoreRoute('/');
            }}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-colors cursor-pointer ${
              !detailedProduct && !activeCategoryPage && !isAboutOpen && !isTrackingOpen && !isVideoGalleryOpen
                ? 'text-[#E11D48] bg-rose-50'
                : 'text-stone-600'
            }`}
          >
            <span className="text-sm leading-none">🏠</span>
            <span>হোম</span>
          </button>

          <button
            onClick={() => {
              setActiveCategory('all');
              setActiveCategoryPage(null);
              setDetailedProduct(null);
              setIsAboutOpen(false);
              setIsVideoGalleryOpen(false);
              setIsPolicyOpen(false);
              setIsTrackingOpen(false);
              navigateToStoreRoute('/', { scrollTop: false });
              setTimeout(() => {
                const elem = document.getElementById('products-section');
                if (elem) elem.scrollIntoView({ behavior: 'smooth' });
              }, 80);
            }}
            className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-bold text-stone-600 hover:text-[#E11D48] transition-colors cursor-pointer"
          >
            <span className="text-sm leading-none">🛍️</span>
            <span>সব পণ্য</span>
          </button>

          <button
            onClick={() => {
              setIsAboutOpen(true);
              setActiveCategoryPage(null);
              setDetailedProduct(null);
              setIsVideoGalleryOpen(false);
              setIsPolicyOpen(false);
              setIsTrackingOpen(false);
              navigateToStoreRoute('/about');
            }}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-colors cursor-pointer ${
              isAboutOpen ? 'text-[#E11D48] bg-rose-50' : 'text-stone-600'
            }`}
          >
            <span className="text-sm leading-none">🏢</span>
            <span>ব্র্যান্ড</span>
          </button>

          <button
            onClick={() => {
              setIsTrackingOpen(true);
              setActiveCategoryPage(null);
              setDetailedProduct(null);
              setIsAboutOpen(false);
              setIsVideoGalleryOpen(false);
              setIsPolicyOpen(false);
              navigateToStoreRoute('/track');
            }}
            className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-colors cursor-pointer ${
              isTrackingOpen ? 'text-[#E11D48] bg-rose-50' : 'text-stone-600'
            }`}
          >
            <span className="text-sm leading-none">🚚</span>
            <span>ট্র্যাকিং</span>
          </button>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl text-[10px] font-bold text-stone-600 hover:text-[#E11D48] transition-colors cursor-pointer"
          >
            <span className="text-sm leading-none">☰</span>
            <span>মেনু</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <StoreMain />
      </CartProvider>
    </AuthProvider>
  );
}
