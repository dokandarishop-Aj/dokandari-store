/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { AuthProvider } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { INITIAL_PRODUCTS } from './data/initialCatalog';
import { Product, ProductCategory, OFFICIAL_CATEGORIES } from './types';
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
} from './lib/storeSync';
import {
  initializeMultiPixels,
  initializeGoogleSeoAndTags,
  trackPixelPageView,
} from './lib/pixelManager';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';

// Map legacy category strings to the 11 official category IDs so all products match accurately
function normalizeCategoryId(cat: string, productName = ''): string {
  const officialIds = new Set(OFFICIAL_CATEGORIES.map((c) => c.id));
  if (officialIds.has(cat as any)) return cat;

  const lowerName = productName.toLowerCase();
  if (lowerName.includes('মিরর') || lowerName.includes('mirror') || lowerName.includes('ডেকোর')) {
    return 'home_decor';
  }
  if (cat === 'skincare') return 'beauty_personal_care';
  if (cat === 'abaya' || cat === 'festive' || cat === 'hijab') return 'fashion_clothing';
  return 'home_decor';
}

function StoreMain() {
  const initialStore = useMemo(() => getInitialStoreContent(), []);
  const [products, setProducts] = useState<Product[]>(() => mergeCatalogProducts(INITIAL_PRODUCTS));
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailedProduct, setDetailedProduct] = useState<Product | null>(null);
  const [detailedProductStep, setDetailedProductStep] = useState<'product' | 'checkout'>('product');
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
  const [activeCategoryPage, setActiveCategoryPage] = useState<string | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isVideoGalleryOpen, setIsVideoGalleryOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

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

  // Seed initial catalog & attach real-time Firestore listeners
  useEffect(() => {
    seedProductsIfEmpty();

    const unsubProducts = onSnapshot(
      collection(db, 'products'),
      (snap) => {
        if (!snap.empty) {
          const list: Product[] = [];
          snap.forEach((docSnap) => list.push(docSnap.data() as Product));
          const merged = mergeCatalogProducts(list);
          setProducts(merged);
          setDetailedProduct((current) => {
            if (!current) return null;
            const updated = merged.find((p) => p.id === current.id);
            return updated || current;
          });
        } else {
          setProducts(mergeCatalogProducts(INITIAL_PRODUCTS));
        }
      },
      (err) => {
        console.warn('Realtime products listener note', err);
      }
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'store_content'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const mergedContent = mergeStoreContent(data);
          setFounderData(mergedContent.founder);
          setPageContent(mergedContent.pageContent!);
          setSocialLinks(mergedContent.socialLinks!);
          setWhatsappNumber(mergedContent.whatsappNumber);
          setHotlineNumber(mergedContent.hotlineNumber);
          setOfficialEmail(
            mergedContent.officialEmail || DEFAULT_STORE_CONTENT.officialEmail || 'dokandari.shop@gmail.com'
          );
          if (Array.isArray(mergedContent.heroSlides) && mergedContent.heroSlides.length > 0) {
            setHeroSlides(mergedContent.heroSlides);
          }
          if (mergedContent.categoryHeroes) {
            setCategoryHeroes(mergedContent.categoryHeroes);
          }
          if (typeof mergedContent.carouselInterval === 'number' && mergedContent.carouselInterval >= 1000) {
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
            localStorage.setItem('dokandari_category_order', JSON.stringify(mergedContent.categoryOrder));
          }
        }
      },
      (err) => {
        console.warn('Realtime settings listener note', err);
      }
    );

    const unsubCredentials = onSnapshot(
      doc(db, 'settings', 'api_credentials'),
      (snap) => {
        if (snap.exists()) {
          const creds = snap.data();
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
        } else {
          const local = localStorage.getItem('dokandari_api_credentials');
          if (local) {
            try {
              const creds = JSON.parse(local);
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
        }
      },
      (err) => {
        console.warn('Realtime credentials listener note', err);
      }
    );

    return () => {
      unsubProducts();
      unsubSettings();
      unsubCredentials();
    };
  }, []);

  // Support clean domain-relative pathname routing (/products/:id, /catalog/:catId) + query (?product=id) + hash
  useEffect(() => {
    const syncFromUrl = () => {
      const pathname = window.location.pathname;
      const searchParams = new URLSearchParams(window.location.search);
      const queryProdId = searchParams.get('product');
      const hash = window.location.hash;

      // 1. Clean Pathname Routing: /products/:id or /catalog/:catId or /category/:catId
      if (pathname.startsWith('/products/')) {
        const prodId = decodeURIComponent(pathname.replace('/products/', '').split('/')[0]);
        const found = products.find((p) => p.id === prodId && p.status !== 'draft');
        if (found) {
          setDetailedProduct(found);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          return;
        }
      } else if (pathname.startsWith('/catalog/') || pathname.startsWith('/category/')) {
        const catId = decodeURIComponent(
          pathname.replace(/^\/(catalog|category)\//, '').split('/')[0]
        );
        if (catId) {
          setActiveCategory(catId);
          setActiveCategoryPage(catId);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          return;
        }
      } else if (pathname === '/about') {
        setIsAboutOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        return;
      } else if (pathname === '/videos') {
        setIsVideoGalleryOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        return;
      } else if (pathname === '/privacy') {
        setIsPolicyOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        return;
      } else if (pathname === '/admin') {
        setIsAdminOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        return;
      }

      // 2. Query Parameter (?product=id)
      if (queryProdId) {
        const found = products.find((p) => p.id === queryProdId && p.status !== 'draft');
        if (found) {
          setDetailedProduct(found);
          return;
        }
      }

      // 3. Hash Navigation fallback (#/products/id, #/category/id, #/catalog/id)
      if (hash.startsWith('#/products/')) {
        const prodId = decodeURIComponent(hash.replace('#/products/', ''));
        const found = products.find((p) => p.id === prodId && p.status !== 'draft');
        if (found) {
          setDetailedProduct(found);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          return;
        }
      } else if (hash.startsWith('#/category/') || hash.startsWith('#/catalog/')) {
        const catId = decodeURIComponent(hash.replace(/^#\/(category|catalog)\//, ''));
        setActiveCategory(catId);
        setActiveCategoryPage(catId);
        setDetailedProduct(null);
        setIsAboutOpen(false);
        setIsVideoGalleryOpen(false);
      } else if (hash === '#/about') {
        setIsAboutOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsVideoGalleryOpen(false);
        setIsPolicyOpen(false);
        setIsAdminOpen(false);
      } else if (hash === '#/videos') {
        setIsVideoGalleryOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsAboutOpen(false);
        setIsPolicyOpen(false);
        setIsAdminOpen(false);
      } else if (hash === '#/privacy') {
        setIsPolicyOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsAboutOpen(false);
        setIsVideoGalleryOpen(false);
        setIsAdminOpen(false);
      } else if (hash === '#/admin') {
        setIsAdminOpen(true);
        setDetailedProduct(null);
        setActiveCategoryPage(null);
        setIsAboutOpen(false);
        setIsVideoGalleryOpen(false);
      }
    };
    syncFromUrl();
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [products]);

  // Only show published products to customers on storefront
  const publishedProducts = useMemo(() => {
    return products.filter((p) => p.status !== 'draft');
  }, [products]);

  // Step-by-step Right-to-Left auto-sliding for Best-Selling Compact Square Carousel (3s, 5s, 8s, 10s)
  useEffect(() => {
    if (publishedProducts.length <= 1) return;
    const ms = Math.max(2000, bestSellingInterval || 5000);
    const timer = setInterval(() => {
      setBestSellingIndex((prev) => {
        const nextIdx = (prev + 1) % publishedProducts.length;
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
  }, [publishedProducts.length, bestSellingInterval]);

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

  // Filter products by category & search
  const filteredProducts = useMemo(() => {
    return publishedProducts.filter((p) => {
      const normCat = normalizeCategoryId(p.category, p.name);
      const matchCat =
        activeCategory === 'all' || p.category === activeCategory || normCat === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.titleEn && p.titleEn.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [publishedProducts, activeCategory, searchQuery]);

  // Handle instant order click (from "অর্ডার করুন" button -> opens dedicated Instant Checkout Page)
  const handleInstantOrder = (product: Product) => {
    setDetailedProductStep('checkout');
    setDetailedProduct(product);
    setActiveCategoryPage(null);
    setIsAboutOpen(false);
    setIsVideoGalleryOpen(false);
    setIsPolicyOpen(false);
    setIsTrackingOpen(false);
    setIsAdminOpen(false);
    window.history.pushState(
      null,
      '',
      `/products/${encodeURIComponent(product.id)}/checkout?brand=dokandari`
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] overflow-x-hidden w-full">
      {/* Top Header with Ticker, Dokandari Logo & Navigation */}
      <Header
        onGoHome={() => {
          setActiveCategory('all');
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          window.history.pushState(null, '', '/');
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
          window.history.pushState(null, '', '/admin');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenTracking={() => {
          setIsTrackingOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setIsAdminOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenVideoGallery={() => {
          setIsVideoGalleryOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsPolicyOpen(false);
          setIsTrackingOpen(false);
          setIsAdminOpen(false);
          window.history.pushState(null, '', '/videos');
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
          window.history.pushState(null, '', '/about');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPrivacy={() => {
          setIsPolicyOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsAdminOpen(false);
          setIsTrackingOpen(false);
          window.history.pushState(null, '', '/privacy');
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
            }}
          />
        ) : isAdminOpen ? (
          isAdminAuthenticated ? (
            <AdminPanel
              onBackToStore={() => {
                setIsAdminOpen(false);
                setIsAdminAuthenticated(isAdminSessionValid());
                window.history.pushState(null, '', '/');
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
                window.history.pushState(null, '', '/');
              }}
            />
          )
        ) : isAboutOpen ? (
          <AboutPage
            founderData={founderData}
            pageContent={pageContent}
            isAdmin={isAdminAuthenticated}
            onBackToHome={() => {
              setIsAboutOpen(false);
              window.history.pushState(null, '', '/');
            }}
            onEditFounder={() => setIsFounderEditOpen(true)}
          />
        ) : isVideoGalleryOpen ? (
          <VideoGalleryPage
            products={publishedProducts}
            onBackToHome={() => {
              setIsVideoGalleryOpen(false);
              window.history.pushState(null, '', '/');
            }}
            onOpenProductDetail={(p) => {
              setIsVideoGalleryOpen(false);
              setDetailedProduct(p);
              window.history.pushState(null, '', `/products/${encodeURIComponent(p.id)}`);
              window.scrollTo({ top: 0, behavior: 'smooth' });
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
              window.history.pushState(null, '', '/');
            }}
          />
        ) : detailedProduct ? (
          /* Dedicated Real Product Details Page & Separate Instant Checkout / Thank You Pages */
          <ProductDetailPage
            product={detailedProduct}
            initialStep={detailedProductStep}
            isAdmin={isAdminAuthenticated}
            allProducts={publishedProducts}
            onSelectProduct={(p) => {
              setDetailedProductStep('product');
              setDetailedProduct(p);
              window.history.pushState(
                null,
                '',
                `/products/${encodeURIComponent(p.id)}?brand=dokandari`
              );
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onInstantOrderProduct={handleInstantOrder}
            onBack={() => {
              setDetailedProduct(null);
              setDetailedProductStep('product');
              window.history.pushState(null, '', '/');
            }}
            onOpenEdit={(p) => setEditingProduct(p)}
            onOrderSuccess={(orderId) => {
              setDetailedProduct(null);
              setDetailedProductStep('product');
              setTrackingOrderId(orderId);
              setIsTrackingOpen(true);
            }}
            onProductUpdated={handleAddProduct}
          />
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
              window.history.pushState(null, '', '/');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSelectCategory={(cat) => {
              setActiveCategory(cat);
              if (cat === 'all') {
                setActiveCategoryPage(null);
                window.history.pushState(null, '', '/');
              } else {
                setActiveCategoryPage(cat);
                window.history.pushState(null, '', `/catalog/${encodeURIComponent(cat)}`);
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenProductDetail={(p) => {
              setDetailedProduct(p);
              window.history.pushState(null, '', `/products/${encodeURIComponent(p.id)}`);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onInstantOrder={handleInstantOrder}
            onEditProduct={(p) => setEditingProduct(p)}
          />
        ) : (
          <>
            {/* Responsive Hero Banner Carousel (Speed selector hidden on customer homepage, controlled in Admin Panel) */}
            <section
              className="relative w-full bg-stone-900 overflow-hidden aspect-16/9 sm:aspect-24/9 max-h-[380px] select-none"
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
                  className={`absolute inset-0 transition-opacity duration-700 ${
                    currentSlide === idx ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className="w-full h-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/45 to-transparent flex flex-col justify-center px-5 sm:px-14 max-w-2xl text-white">
                    <span className="inline-block w-fit text-[10px] sm:text-[11px] font-bold bg-[#E11D48] text-white px-2.5 py-0.5 rounded-md uppercase tracking-wider mb-2">
                      {slide.tag}
                    </span>
                    <h2 className="text-lg sm:text-3xl font-extrabold leading-tight text-white line-clamp-2">
                      {slide.title}
                    </h2>
                    <p className="text-xs sm:text-sm text-stone-200 mt-1.5 sm:mt-2 font-medium line-clamp-2">
                      {slide.subtitle}
                    </p>
                    <div className="mt-3 sm:mt-4">
                      <button
                        onClick={() => {
                          const elem = document.getElementById('products-section');
                          if (elem) elem.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-4 sm:px-5 py-2 sm:py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                      >
                        {slide.ctaText || 'কালেকশন দেখুন'} &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Manual Previous / Next Controls */}
              <button
                onClick={() => setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
                aria-label="Previous slide"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/85 hover:bg-white text-[#E11D48] flex items-center justify-center shadow-md transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setCurrentSlide((prev) => (prev + 1) % heroSlides.length)}
                aria-label="Next slide"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/85 hover:bg-white text-[#E11D48] flex items-center justify-center shadow-md transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Slider Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
                {heroSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      currentSlide === idx ? 'w-6 bg-[#E11D48]' : 'w-2 bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </section>

            {/* Reorderable Official Categories Bar (Default: Home Decor 1st, Gadgets 2nd, Fashion 3rd...) */}
            <CategorySquircleBar
              activeCategory={activeCategory}
              orderedCategories={orderedCategories}
              onSelectCategory={(cat) => {
                setActiveCategory(cat);
                if (cat === 'all') {
                  setActiveCategoryPage(null);
                  window.history.pushState(null, '', '/');
                } else {
                  setActiveCategoryPage(cat);
                  window.history.pushState(null, '', `/catalog/${encodeURIComponent(cat)}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              onOpenDedicatedPage={(cat) => {
                setActiveCategory(cat);
                setActiveCategoryPage(cat);
                window.history.pushState(null, '', `/catalog/${encodeURIComponent(cat)}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              productCounts={productCounts}
            />

            {/* Full-Display Main Products & Ordered Category Catalog Sections */}
            <section id="products-section" className="w-full px-2.5 sm:px-5 lg:px-8 py-4 sm:py-8 space-y-8">
              {/* Compact Square Best-Selling Product Carousel (Slides 1-by-1 Right-to-Left every 3s/5s/8s/10s) */}
              {publishedProducts.length > 0 && !searchQuery.trim() && (
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
                    {publishedProducts.slice(0, 14).map((product) => (
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
                            window.history.pushState(null, '', `/products/${encodeURIComponent(p.id)}?brand=dokandari`);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
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

                    return (
                      <div key={cat.id} className="space-y-3">
                        <div className="bg-white border border-rose-200/80 rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={cat.image}
                              alt={cat.nameBn}
                              className="w-10 h-10 rounded-xl object-cover border border-rose-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-[#E11D48] text-white">
                                  ক্যাটালগ #{idx + 1}
                                </span>
                                <h2 className="text-sm sm:text-lg font-extrabold text-stone-900">
                                  {cat.nameBn}
                                </h2>
                                <span className="text-xs font-bold text-[#E11D48] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                  {catProducts.length} টি পণ্য
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">
                                {cat.nameBn} — প্রিমিয়াম কালেকশন ও সরাসরি ক্যাশ অন ডেলিভারি
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setActiveCategory(cat.id);
                              setActiveCategoryPage(cat.id);
                              window.history.pushState(null, '', `/catalog/${encodeURIComponent(cat.id)}`);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#FFF1F2] hover:bg-[#E11D48] text-[#E11D48] hover:text-white border border-rose-200 text-xs font-bold transition-all cursor-pointer shrink-0"
                          >
                            সব দেখুন &rarr;
                          </button>
                        </div>

                        {/* Strictly 2 columns on mobile, full multi-column on desktop */}
                        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
                          {catProducts.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              onOpenDetail={(p) => {
                                setDetailedProductStep('product');
                                setDetailedProduct(p);
                                window.history.pushState(null, '', `/products/${encodeURIComponent(p.id)}?brand=dokandari`);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
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
                          window.history.pushState(null, '', '/');
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
                          window.history.pushState(null, '', `/products/${encodeURIComponent(p.id)}?brand=dokandari`);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
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
            window.location.hash = '#/admin';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      )}

      {/* Footer */}
      <Footer
        socialLinks={socialLinks}
        whatsappNumber={whatsappNumber}
        hotlineNumber={hotlineNumber}
        officialEmail={officialEmail}
        pageContent={pageContent}
        founderAddress={founderData.address}
        isAdmin={isAdminAuthenticated}
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
          window.location.hash = '#/admin';
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
            window.history.replaceState(null, '', window.location.pathname);
          } else {
            setActiveCategoryPage(cat);
            window.location.hash = `#/category/${cat}`;
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenTracking={() => {
          setIsTrackingOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsAdminOpen(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAiAssistant={() => setIsAiOpen(true)}
        onOpenAbout={() => {
          setIsAboutOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsVideoGalleryOpen(false);
          setIsAdminOpen(false);
          setIsTrackingOpen(false);
          window.location.hash = '#/about';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPrivacy={() => {
          setIsPolicyOpen(true);
          setActiveCategoryPage(null);
          setDetailedProduct(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setIsAdminOpen(false);
          setIsTrackingOpen(false);
          window.location.hash = '#/privacy';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Founder Details Edit Modal */}
      <FounderEditModal
        isOpen={isFounderEditOpen}
        onClose={() => setIsFounderEditOpen(false)}
        founderData={founderData}
        onSave={(updated) => setFounderData(updated)}
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
          window.history.pushState(
            null,
            '',
            `/products/${encodeURIComponent(p.id)}?brand=dokandari`
          );
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
          window.history.replaceState(null, '', window.location.pathname);
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
          window.location.hash = '#/videos';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenAbout={() => {
          setIsMenuOpen(false);
          setIsAboutOpen(true);
          setActiveCategoryPage(null);
          setIsVideoGalleryOpen(false);
          setIsPolicyOpen(false);
          setDetailedProduct(null);
          setIsAdminOpen(false);
          window.location.hash = '#/about';
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenPrivacy={() => {
          setIsMenuOpen(false);
          setIsPolicyOpen(true);
          setActiveCategoryPage(null);
          setIsAboutOpen(false);
          setIsVideoGalleryOpen(false);
          setDetailedProduct(null);
          setIsAdminOpen(false);
          window.location.hash = '#/privacy';
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
          window.location.hash = '#/admin';
          window.scrollTo({ top: 0, behavior: 'smooth' });
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
            window.history.replaceState(null, '', window.location.pathname);
          } else {
            setActiveCategoryPage(cat);
            window.location.hash = `#/category/${cat}`;
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* AI Shopping Assistant Modal */}
      <AiAssistantModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        products={publishedProducts}
        onSelectProduct={(p) => {
          setDetailedProduct(p);
          window.location.hash = `#/products/${p.id}`;
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
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
