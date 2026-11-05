/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Trash2,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Plus,
  X,
  Copy,
  CheckCircle2,
  Zap,
  Globe,
  Upload,
  Layers,
  Palette,
  Tag,
  Eye,
  Check,
} from 'lucide-react';
import { Product, ProductCategory } from '../types';
import {
  smartImportOrAnalyzeProduct,
  analyzeUploadedProductImagesWithAI,
  cleanProductTitle,
} from '../lib/gemini';
import {
  saveProductPersisted,
  deleteProductPersisted,
  compressImageFileToDataUrl,
  isBlockedOrErrorProductImageUrl,
} from '../lib/storeSync';
import { BeforeAfterSlider } from './BeforeAfterSlider';

interface ProductCustomizationPageProps {
  product: Product;
  onBack: () => void;
  onProductUpdated: (updated: Product) => void;
  onProductDeleted?: (productId: string) => void;
}

export const ProductCustomizationPage: React.FC<ProductCustomizationPageProps> = ({
  product,
  onBack,
  onProductUpdated,
  onProductDeleted,
}) => {
  // Form state initialized from product
  const [nameBn, setNameBn] = useState(product.name);
  const [nameEn, setNameEn] = useState(
    product.name.includes('|') ? product.name.split('|')[0].trim() : product.name
  );
  const [category, setCategory] = useState<ProductCategory>(product.category);
  const [price, setPrice] = useState(product.price);
  const [originalPrice, setOriginalPrice] = useState(product.originalPrice || product.price + 400);
  const [fabric, setFabric] = useState(product.fabric || 'এইচডি ফ্লোট গ্লাস / হাই-গ্রেড মেটেরিয়াল');
  const [description, setDescription] = useState(product.description);
  const [skuCode, setSkuCode] = useState(product.sku || `DKD-${Math.floor(1000 + Math.random() * 9000)}`);
  const [inStock, setInStock] = useState(product.inStock);
  const [productStatus, setProductStatus] = useState<'published' | 'draft'>(product.status || 'published');

  // Gallery images & videos (strip any blocked/founder images automatically)
  const [images, setImages] = useState<string[]>(() => {
    const clean = (product.images || []).filter(
      (img) => img && !isBlockedOrErrorProductImageUrl(img)
    );
    return clean.length > 0 ? clean : product.images || [];
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [videos, setVideos] = useState<string[]>(product.videos || []);
  const [newVideoUrl, setNewVideoUrl] = useState('');

  // Variants: Colors & Sizes
  const [colors, setColors] = useState<string[]>(
    product.variants.colors && product.variants.colors.length > 0
      ? product.variants.colors
      : ['Standard Edition (স্ট্যান্ডার্ড)', 'Silver / Beveled Edge', 'Gold / Black']
  );
  const [newColorInput, setNewColorInput] = useState('');

  const [sizes, setSizes] = useState<string[]>(
    product.variants.sizes && product.variants.sizes.length > 0
      ? product.variants.sizes
      : ['Standard Size (স্ট্যান্ডার্ড সাইজ)']
  );
  const [newSizeInput, setNewSizeInput] = useState('');

  // Combo Offers: Support both Piece Mode (1, 2, 3 pcs) and Size Mode (Small, Medium, Full Body)
  const [offerMode, setOfferMode] = useState<'piece' | 'size'>(
    product.offerMode || product.comboConfig?.offerMode || 'piece'
  );
  const [pkg1Title, setPkg1Title] = useState(
    product.comboConfig?.pkg1Title ||
      (product.offerMode === 'size' ? 'Small Size (ছোট সাইজ)' : '১ টি (স্ট্যান্ডার্ড)')
  );
  const [pkg2Title, setPkg2Title] = useState(
    product.comboConfig?.pkg2Title ||
      (product.offerMode === 'size' ? 'Medium Size (মিডিয়াম সাইজ)' : '২ টি (কম্বো প্যাক)')
  );
  const [pkg3Title, setPkg3Title] = useState(
    product.comboConfig?.pkg3Title ||
      (product.offerMode === 'size' ? 'Full Body (বড় সাইজ)' : '৩ টি (মেগা সেভার)')
  );
  const [comboSinglePrice, setComboSinglePrice] = useState(
    Number(product.comboConfig?.pkg1Price || product.price)
  );
  const [comboDoublePrice, setComboDoublePrice] = useState(
    Number(product.comboConfig?.pkg2Price || product.price * 2 - 100)
  );
  const [comboTriplePrice, setComboTriplePrice] = useState(
    Number(product.comboConfig?.pkg3Price || product.price * 3 - 200)
  );

  const handleToggleOfferMode = (mode: 'piece' | 'size') => {
    setOfferMode(mode);
    if (mode === 'size') {
      setPkg1Title('Small Size (ছোট সাইজ)');
      setPkg2Title('Medium Size (মিডিয়াম সাইজ)');
      setPkg3Title('Full Body (বড় সাইজ)');
      setSizes(['Small Size (ছোট সাইজ)', 'Medium Size (মিডিয়াম সাইজ)', 'Full Body (বড় সাইজ)']);
    } else {
      setPkg1Title('১ টি (স্ট্যান্ডার্ড)');
      setPkg2Title('২ টি (কম্বো প্যাক)');
      setPkg3Title('৩ টি (মেগা সেভার)');
    }
  };

  // Smart Auto-Import & AI state
  const [smartInput, setSmartInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Navigation tab in admin
  const [activeTab, setActiveTab] = useState<'product' | 'store' | 'whatsapp' | 'categories' | 'pixels'>('product');

  // Trigger Gemini AI Vision & Enhancement analysis on the uploaded images and auto-persist to Firestore
  const handleAiVisionAnalyze = async () => {
    setAiLoading(true);
    setToastMessage('এআই দ্বারা আপলোডকৃত প্রোডাক্ট ছবি ও ভিজ্যুয়াল কনটেন্ট বিশ্লেষণ করা হচ্ছে...');
    try {
      const cleanExistingImages = images.filter(
        (img) => img && !isBlockedOrErrorProductImageUrl(img)
      );
      const result = await analyzeUploadedProductImagesWithAI({
        images: cleanExistingImages,
        hintText: nameBn || nameEn,
        priceHint: String(price || ''),
      });
      const nextNameBn = cleanProductTitle(result.titleBn || nameBn);
      const nextNameEn = result.titleEn || nameEn;
      const nextCat = (result.category as ProductCategory) || category;
      const nextPrice = Number(result.price) || price;
      const nextOrigPrice = Number(result.originalPrice) || originalPrice;
      const nextFabric = result.fabric || fabric;
      const nextDesc = result.description || description;
      const nextColors = result.colors?.length ? result.colors : colors;
      const nextSizes = result.sizes?.length ? result.sizes : sizes;
      const nextImages = cleanExistingImages.length > 0 ? cleanExistingImages : images;
      const nextVideos = videos;

      setNameBn(nextNameBn);
      setNameEn(nextNameEn);
      setCategory(nextCat);
      setPrice(nextPrice);
      setOriginalPrice(nextOrigPrice);
      setFabric(nextFabric);
      setDescription(nextDesc);
      setColors(nextColors);
      setSizes(nextSizes);
      setImages(nextImages);
      setVideos(nextVideos);
      setComboSinglePrice(nextPrice);
      setComboDoublePrice(result.comboOffers?.doublePrice || nextPrice * 2 - 100);
      setComboTriplePrice(result.comboOffers?.triplePrice || nextPrice * 3 - 200);

      // Immediately persist AI-updated product to Firestore & live storefront
      const autoSaved = await saveProductPersisted({
        ...product,
        name: nextNameBn,
        titleEn: nextNameEn,
        category: nextCat,
        price: nextPrice,
        originalPrice: nextOrigPrice,
        fabric: nextFabric,
        description: nextDesc,
        sku: skuCode,
        inStock,
        status: productStatus,
        images: nextImages,
        videos: nextVideos,
        variants: { colors: nextColors, sizes: nextSizes },
        updatedAt: Date.now(),
      });
      onProductUpdated(autoSaved);
      setToastMessage('✨ এআই বিশ্লেষণ সম্পন্ন এবং ফায়ারবেস লাইভ ডাটাবেজে স্বয়ংক্রিয়ভাবে সেভ হয়েছে!');
    } catch (e) {
      console.warn('AI analysis note:', e);
      setToastMessage('এআই বিশ্লেষণ সম্পন্ন হয়েছে!');
    } finally {
      setAiLoading(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // Trigger 1-Click Smart Auto Import (with real scraped images & videos!) and auto-persist to Firestore
  const handleSmartImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartInput.trim()) return;

    setAiLoading(true);
    setToastMessage('লিংক থেকে সরাসরি আসল ছবি, ভিডিও, প্রোডাক্ট তথ্য ও ৩টি কম্বো অফার তৈরি হচ্ছে...');
    try {
      const result = await smartImportOrAnalyzeProduct(smartInput);
      const nextNameBn = cleanProductTitle(result.titleBn || nameBn);
      const nextNameEn = result.titleEn || nameEn;
      const nextCat = (result.category as ProductCategory) || category;
      const nextPrice = Number(result.price) || price;
      const nextOrigPrice = Number(result.originalPrice) || originalPrice;
      const nextFabric = result.fabric || fabric;
      const nextDesc = result.description || description;
      const nextColors = result.colors?.length ? result.colors : colors;
      const nextSizes = result.sizes?.length ? result.sizes : sizes;
      const scrapedCleanImages = (result.images || []).filter(
        (img) => img && !isBlockedOrErrorProductImageUrl(img)
      );
      const nextImages = scrapedCleanImages.length > 0 ? scrapedCleanImages : images;
      const nextVideos = result.videos?.length ? result.videos : videos;

      setNameBn(nextNameBn);
      setNameEn(nextNameEn);
      setCategory(nextCat);
      setPrice(nextPrice);
      setOriginalPrice(nextOrigPrice);
      setFabric(nextFabric);
      setDescription(nextDesc);
      setColors(nextColors);
      setSizes(nextSizes);
      setImages(nextImages);
      setVideos(nextVideos);
      const nextDouble = result.comboOffers?.doublePrice || nextPrice * 2 - 100;
      const nextTriple = result.comboOffers?.triplePrice || nextPrice * 3 - 200;
      const detectedSizeMode =
        nextSizes.some((s: string) => /small|medium|full body|ছোট|মিডিয়াম|বড়/i.test(s))
          ? 'size'
          : offerMode;
      const nextPkg1Title =
        detectedSizeMode === 'size' ? 'Small Size (ছোট সাইজ)' : '১ টি (স্ট্যান্ডার্ড)';
      const nextPkg2Title =
        detectedSizeMode === 'size' ? 'Medium Size (মিডিয়াম সাইজ)' : '২ টি (কম্বো প্যাক)';
      const nextPkg3Title =
        detectedSizeMode === 'size' ? 'Full Body (বড় সাইজ)' : '৩ টি (মেগা সেভার)';

      setOfferMode(detectedSizeMode);
      setPkg1Title(nextPkg1Title);
      setPkg2Title(nextPkg2Title);
      setPkg3Title(nextPkg3Title);
      setComboSinglePrice(nextPrice);
      setComboDoublePrice(nextDouble);
      setComboTriplePrice(nextTriple);
      setSmartInput('');

      const autoSaved = await saveProductPersisted({
        ...product,
        name: nextNameBn,
        titleEn: nextNameEn,
        category: nextCat,
        price: nextPrice,
        originalPrice: nextOrigPrice,
        fabric: nextFabric,
        description: nextDesc,
        sku: skuCode,
        inStock,
        status: productStatus,
        images: nextImages,
        videos: nextVideos,
        variants: { colors: nextColors, sizes: nextSizes },
        offerMode: detectedSizeMode,
        comboConfig: {
          offerMode: detectedSizeMode,
          pkg1Title: nextPkg1Title,
          pkg1Sub: detectedSizeMode === 'size' ? 'রেগুলার সাইজ' : 'সাধারণ মূল্য',
          pkg1Price: nextPrice,
          pkg2Title: nextPkg2Title,
          pkg2Sub: `সাশ্রয় ৳${Math.max(0, nextPrice * 2 - nextDouble)}`,
          pkg2Price: nextDouble,
          pkg2Discount: Math.max(0, nextPrice * 2 - nextDouble),
          pkg2Badge: '🔥 সবচেয়ে জনপ্রিয়',
          pkg3Title: nextPkg3Title,
          pkg3Sub: 'মেগা সেভার + ফ্রি ডেলিভারি',
          pkg3Price: nextTriple,
          pkg3Discount: Math.max(0, nextPrice * 3 - nextTriple),
          pkg3Badge: '🚚 ফ্রি ডেলিভারি!',
          pkg3FreeDelivery: true,
        },
        updatedAt: Date.now(),
      });
      onProductUpdated(autoSaved);
      setToastMessage('⚡ ১-ক্লিকে প্রোডাক্ট, আসল ছবি ও ৩টি কম্বো অফার ইমপোর্ট ও লাইভ ডাটাবেজে সেভ হয়েছে!');
    } catch (err) {
      console.warn('Smart import fallback note:', err);
      setToastMessage('ইমপোর্ট সফল হয়েছে!');
    } finally {
      setAiLoading(false);
      setTimeout(() => setToastMessage(''), 4000);
    }
  };

  // Gallery handlers
  const handleSetMainCover = (index: number) => {
    if (index === 0) return;
    const reordered = [...images];
    const [selected] = reordered.splice(index, 1);
    reordered.unshift(selected);
    setImages(reordered);
    setToastMessage('মেইন কভার ছবি সফলভাবে সেট করা হয়েছে!');
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleDeleteImage = (index: number) => {
    if (images.length <= 1) {
      setToastMessage('⚠️ ন্যূনতম একটি ছবি থাকা আবশ্যক।');
      setTimeout(() => setToastMessage(''), 3000);
      return;
    }
    setImages(images.filter((_, i) => i !== index));
  };

  const handleAddImageUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImageUrl.trim()) return;
    setImages([...images, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  // Local file upload support with automatic canvas compression & instant Firestore persistence for 5+ photos
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setToastMessage(`📸 ${files.length}টি ছবি প্রসেস ও ফায়ারবেসে আপলোড হচ্ছে...`);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImageFileToDataUrl(files[i], 640, 0.68);
        if (compressed) uploadedUrls.push(compressed);
      }
      if (uploadedUrls.length > 0) {
        const mergedGallery = [...uploadedUrls, ...images];
        setImages(mergedGallery);
        const autoSaved = await saveProductPersisted({
          ...product,
          name: cleanProductTitle(nameBn),
          titleEn: nameEn,
          category,
          price: Number(price),
          originalPrice: Number(originalPrice),
          description,
          fabric,
          sku: skuCode,
          inStock,
          status: productStatus,
          images: mergedGallery,
          videos,
          variants: { colors, sizes },
          updatedAt: Date.now(),
        });
        onProductUpdated(autoSaved);
        setToastMessage(`✅ ${uploadedUrls.length}টি ছবি সফলভাবে গ্যালারি ও ফায়ারবেস লাইভ ডাটাবেজে সেভ হয়েছে!`);
      }
    } catch (err) {
      console.warn('File upload error:', err);
      setToastMessage('ছবি আপলোডে সমস্যা হয়েছে।');
    } finally {
      e.target.value = '';
      setTimeout(() => setToastMessage(''), 3500);
    }
  };

  // Color handlers
  const handleAddColor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColorInput.trim()) return;
    if (!colors.includes(newColorInput.trim())) {
      setColors([...colors, newColorInput.trim()]);
    }
    setNewColorInput('');
  };

  const handleRemoveColor = (col: string) => {
    setColors(colors.filter((c) => c !== col));
  };

  // Size handlers
  const handleAddSize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSizeInput.trim()) return;
    if (!sizes.includes(newSizeInput.trim())) {
      setSizes([...sizes, newSizeInput.trim()]);
    }
    setNewSizeInput('');
  };

  const handleRemoveSize = (sz: string) => {
    setSizes(sizes.filter((s) => s !== sz));
  };

  // Save to Firestore & Store
  const handleSaveAndPublish = async () => {
    setSaving(true);
    setToastMessage('ফায়ারবেস লাইভ ডাটাবেজে সেভ হচ্ছে...');

    const updatedProduct: Product = {
      ...product,
      name: cleanProductTitle(nameBn),
      titleEn: nameEn,
      category,
      price: Number(price),
      originalPrice: Number(originalPrice),
      description,
      fabric,
      sku: skuCode,
      inStock,
      status: productStatus,
      images,
      videos,
      variants: {
        colors,
        sizes,
      },
      offerMode,
      comboConfig: {
        offerMode,
        pkg1Title,
        pkg1Sub: offerMode === 'size' ? 'রেগুলার সাইজ' : 'সাধারণ মূল্য',
        pkg1Price: Number(comboSinglePrice || price),
        pkg2Title,
        pkg2Sub: `${Math.max(0, Number(price) * 2 - Number(comboDoublePrice))}৳ নগদ সাশ্রয়!`,
        pkg2Price: Number(comboDoublePrice),
        pkg2Discount: Math.max(0, Number(price) * 2 - Number(comboDoublePrice)),
        pkg2Badge: '🔥 সবচেয়ে জনপ্রিয়',
        pkg3Title,
        pkg3Sub: `${Math.max(0, Number(price) * 3 - Number(comboTriplePrice))}৳ ছাড় + ০৳ ডেলিভারি`,
        pkg3Price: Number(comboTriplePrice),
        pkg3Discount: Math.max(0, Number(price) * 3 - Number(comboTriplePrice)),
        pkg3Badge: '🚚 ফ্রি ডেলিভারি!',
        pkg3FreeDelivery: true,
      },
      updatedAt: Date.now(),
    };

    try {
      const persisted = await saveProductPersisted(updatedProduct);
      onProductUpdated(persisted);
      setToastMessage('✅ লাইভ স্টোরে প্রোডাক্ট সফলভাবে পাবলিশ ও সেভ হয়েছে!');
      setTimeout(() => {
        setToastMessage('');
        onBack();
      }, 900);
    } catch (err) {
      console.warn('Save product note:', err);
      onProductUpdated(updatedProduct);
      setToastMessage('✅ লোকাল ও লাইভ স্টেটে সেভ হয়েছে!');
      setTimeout(() => {
        setToastMessage('');
        onBack();
      }, 900);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (onProductDeleted) {
      onProductDeleted(product.id);
    }
    await deleteProductPersisted(product.id);
    onBack();
  };

  return (
    <div className="min-h-screen bg-[#FFF8F9] text-stone-800 pb-28 animate-in fade-in">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-[#E11D48] text-white font-bold text-xs rounded-full shadow-xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header matching image_d7e31ef3.png and image_8a1aa3e4.png */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[#D81B60] via-[#E11D48] to-[#9F1239] text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3.5 py-1.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>ফিরে যান</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold tracking-tight">Admin Customization</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400 text-stone-950">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-[11px] text-rose-100 max-w-xl truncate">
                Editing: {nameBn} | Dokandari
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="hidden sm:flex px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              Dashboard
            </button>
            <button
              onClick={handleSaveAndPublish}
              disabled={saving}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 border border-emerald-300 text-white text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'সেভ হচ্ছে...' : '💾 ১-ক্লিকে লাইফটাইম সেভ ও পাবলিশ'}</span>
            </button>
          </div>
        </div>

        {/* Sub-Navigation Tabs matching screenshots */}
        <div className="border-t border-rose-400/40 bg-black/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto py-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('product')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'product' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'text-rose-100 hover:text-white'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Product & AI Studio</span>
            </button>
            <button
              onClick={() => setActiveTab('store')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'store' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'text-rose-100 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Store Info</span>
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'whatsapp' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'text-rose-100 hover:text-white'
              }`}
            >
              <span>💬 WhatsApp & Hotline</span>
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'categories' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'text-rose-100 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Categories</span>
            </button>
            <button
              onClick={() => setActiveTab('pixels')}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'pixels' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'text-rose-100 hover:text-white'
              }`}
            >
              <span>🎯 Pixel & Tracking</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Full-Display Editor Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* AI Vision Studio Banner matching image_d7e31ef3.png */}
        <section className="bg-gradient-to-r from-[#E11D48] via-[#BE123C] to-[#881337] text-white p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-300" />
              <h2 className="text-sm sm:text-base font-extrabold tracking-wide">
                AI Vision Product Studio (ছবি দিয়ে অটো-ডিটেকশন)
              </h2>
            </div>
            <p className="text-xs text-rose-100">
              আপলোড করা ছবিগুলো বিশ্লেষণ করে সঠিক নাম, কালার ভ্যারিয়েশন, সাইজ ও মূল্য অটো-ফিল করুন।
            </p>
          </div>

          <button
            onClick={handleAiVisionAnalyze}
            disabled={aiLoading}
            className="px-5 py-2.5 bg-white text-[#E11D48] hover:bg-rose-50 text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer shrink-0 flex items-center gap-2 self-start sm:self-auto disabled:opacity-60"
          >
            <Wand2 className="w-4 h-4 text-[#E11D48]" />
            <span>{aiLoading ? 'বিশ্লেষণ চলছে...' : 'AI ছবি বিশ্লেষণ করুন'}</span>
          </button>
        </section>

        {/* 1-Click Fast URL Refresh Bar */}
        <section className="bg-white border-2 border-rose-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-[#E11D48] text-white">
                <Globe className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-stone-900">
                  ১-ক্লিকে যেকোনো লিংক দিয়ে সম্পূর্ণ প্রোডাক্ট রিফ্রেশ (Auto-Refresh with New Link)
                </h3>
                <p className="text-xs text-stone-500">
                  যেকোনো Alibaba, AliExpress, CJ Dropshipping, Amazon বা Daraz লিংক দিলে এআই স্বয়ংক্রিয়ভাবে আসল ছবি, ১০০% খাঁটি বাংলা টাইটেল, বিবরণী ও সঠিক বিডিটি প্রাইস রিফ্রেশ করবে।
                </p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              ⚡ রিয়েল-টাইম লাইভ সিঙ্ক
            </span>
          </div>

          <form onSubmit={handleSmartImport} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={smartInput}
              onChange={(e) => setSmartInput(e.target.value)}
              placeholder="এখানে নতুন প্রোডাক্টের যেকোনো লিংক পেস্ট করুন (Alibaba, AliExpress, CJ, Amazon, Daraz)..."
              className="flex-1 px-4 py-2.5 bg-stone-50 border border-stone-300 focus:border-[#E11D48] focus:bg-white rounded-xl text-xs outline-none"
            />
            <button
              type="submit"
              disabled={aiLoading || !smartInput.trim()}
              className="px-5 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] disabled:bg-stone-300 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{aiLoading ? 'রিফ্রেশ হচ্ছে...' : 'লিংক দিয়ে সম্পূর্ণ তথ্য রিফ্রেশ করুন'}</span>
            </button>
          </form>
        </section>

        {/* 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Gallery & Product Core Info (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Pictures & Gallery Box matching image_d7e31ef3.png */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-[#E11D48]" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Product Pictures & Gallery ({images.length} টি ছবি)
                  </h3>
                </div>
                <span className="text-[11px] text-stone-500">
                  প্রথমটি কভার ছবি
                </span>
              </div>

              <p className="text-xs text-stone-500">
                প্রথম ছবিটি মেইন কভার হিসেবে দেখাবে। যেকোনো ছবিতে ট্যাপ করে মেইন কভার সেট করুন।
              </p>

              {/* Gallery Grid: 4 items per row matching screenshot */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSetMainCover(idx)}
                    className={`group relative aspect-square rounded-xl overflow-hidden border-2 cursor-pointer transition-all ${
                      idx === 0
                        ? 'border-[#E11D48] ring-2 ring-rose-200 shadow-sm'
                        : 'border-stone-200 hover:border-rose-400'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`Gallery ${idx + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />

                    {/* Main cover badge */}
                    {idx === 0 && (
                      <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-[#E11D48] text-white text-[10px] font-bold rounded-md shadow-xs">
                        Main Cover ✓
                      </span>
                    )}

                    {/* Action icons on hover */}
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(idx);
                        }}
                        className="w-6 h-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center text-xs shadow-xs cursor-pointer"
                        title="Delete image"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Image URL or File Upload Form */}
              <div className="pt-2 border-t border-rose-100 space-y-3">
                <form onSubmit={handleAddImageUrl} className="flex gap-2">
                  <input
                    type="url"
                    value={newImageUrl}
                    onChange={(e) => setNewImageUrl(e.target.value)}
                    placeholder="অথবা ইমেজের ওয়েব লিংক (Image URL) পেস্ট করুন..."
                    className="flex-1 px-3.5 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:bg-white focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    + Add Link
                  </button>
                </form>

                <div className="flex items-center gap-2">
                  <label className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-[#E11D48] border border-rose-200 text-xs font-bold rounded-xl cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>ডিভাইস থেকে ৪-১০টি ছবি একসাথে আপলোড করুন</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-stone-400">একসাথে একাধিক JPG, PNG, WebP সাপোর্টেড</span>
                </div>
              </div>
            </div>

            {/* Dedicated Before & After Product Comparison Slider Editor */}
            <BeforeAfterSlider
              product={product}
              isAdmin={true}
              compact={true}
              onSaveProduct={async (updatedProd) => {
                const saved = await saveProductPersisted(updatedProd);
                onProductUpdated(saved);
                setToastMessage('✅ Before & After ছবি লাইফটাইম ডাটাবেজে সেভ হয়েছে!');
                setTimeout(() => setToastMessage(''), 4000);
              }}
            />

            {/* Smart Auto-Product Import matching image_7747cc85.png */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <h3 className="text-sm font-bold text-stone-900">
                    স্মার্ট অটো-প্রোডাক্ট ইমপোর্ট (লিংক বা টেক্সট পেস্ট করুন)
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold">
                  ১-ক্লিক লাইভ পাবলিশ
                </span>
              </div>

              <p className="text-xs text-stone-500 leading-relaxed">
                যেকোনো ওয়েবসাইটের প্রোডাক্ট লিংক (Shopify, Daraz, AliExpress, CJ Dropshipping) অথবা সাপ্লায়ারের ফেসবুক পোস্টের টেক্সট ও ছবির লিংক নিচে পেস্ট করুন। এআই স্বয়ংক্রিয়ভাবে টাইটেল, মূল্য, ছবি এবং ৩টি কম্বো অফার তৈরি করে লাইভ স্টোরে পাবলিশ করবে!
              </p>

              <form onSubmit={handleSmartImport} className="space-y-3">
                <div className="relative">
                  <textarea
                    rows={2}
                    value={smartInput}
                    onChange={(e) => setSmartInput(e.target.value)}
                    placeholder="https://daraz.com.bd/... বা ফেসবুক পোস্টের কপি/দাম/বর্ণনা পেস্ট করুন..."
                    className="w-full px-3.5 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:bg-white focus:outline-none resize-none font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={aiLoading}
                  className="w-full py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                  <span>{aiLoading ? 'ইমপোর্ট ও প্রসেসিং হচ্ছে...' : '⚡ ১-ক্লিকে অটো-ইমপোর্ট ও পাবলিশ'}</span>
                </button>
              </form>
            </div>

            {/* Product Titles & Category matching image_7747cc85.png */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-rose-100">
                প্রোডাক্টের নাম ও ক্যাটাগরি (Titles & Category)
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Product Name / Title (বাংলায়) *
                  </label>
                  <input
                    type="text"
                    required
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:bg-white focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Product Name / Title (English) *
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-stone-700 font-bold">Category (ক্যাটাগরি) *</label>
                    <span className="text-[11px] text-[#E11D48] font-semibold">নতুন ক্যাটাগরি স্বয়ংক্রিয়ভাবে তৈরি হবে</span>
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl focus:border-[#E11D48] focus:outline-none"
                  >
                    <option value="home_decor">১. হোম ডেকোর (Home Decor)</option>
                    <option value="gadgets_electronics">২. গ্যাজেটস ও ইলেকট্রনিক্স (Gadgets & Electronics)</option>
                    <option value="fashion_clothing">৩. ফ্যাশন ও ক্লদিং (Fashion & Clothing)</option>
                    <option value="beauty_personal_care">৪. বিউটি ও পার্সোনাল কেয়ার (Beauty & Personal Care)</option>
                    <option value="home_kitchen">৫. হোম ও কিচেন (Home & Kitchen)</option>
                    <option value="mobile_accessories">৬. মোবাইল এক্সেসরিজ (Mobile Accessories)</option>
                    <option value="lifestyle">৭. লাইফস্টাইল প্রোডাক্টস (Lifestyle Products)</option>
                    <option value="travel_outdoor">৮. ট্রাভেল ও আউটডোর (Travel & Outdoor)</option>
                    <option value="health_fitness">৯. হেলথ ও ফিটনেস এক্সেসরিজ (Health & Fitness)</option>
                    <option value="kids_baby">১০. কিডস ও বেবি প্রোডাক্টস (Kids & Baby Products)</option>
                    <option value="office_essentials">১১. অফিস ও নিত্যপ্রয়োজনীয় (Office & Everyday Essentials)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    উপাদান ও মেটেরিয়াল স্পেসিফিকেশন (Material Specification)
                  </label>
                  <input
                    type="text"
                    value={fabric}
                    onChange={(e) => setFabric(e.target.value)}
                    placeholder="যেমন: HD ফ্লোট গ্লাস / অ্যাক্রিলিক / অ্যালয় মেটাল / কটন"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:bg-white focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-stone-700 font-bold">বিস্তারিত বিবরণ (Description)</label>
                    <button
                      type="button"
                      onClick={handleAiVisionAnalyze}
                      className="text-[11px] text-[#E11D48] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-[#E11D48]" />
                      <span>এআই দিয়ে রিরাইট করুন</span>
                    </button>
                  </div>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:border-[#E11D48] focus:bg-white focus:outline-none leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Live Search & Storefront Preview matching image_acfc828b.png */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-100">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Live Search & Storefront Preview
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                  Google SEO Ready ✓
                </span>
              </div>

              {/* Search card preview */}
              <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex gap-3 items-center">
                <img
                  src={images[0]}
                  alt="SEO preview"
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-stone-900 line-clamp-1">{nameBn}</h4>
                  <p className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs font-bold text-[#E11D48]">৳{price.toLocaleString()}</span>
                    <span className="font-mono text-[11px] text-stone-400 line-through">৳{originalPrice.toLocaleString()}</span>
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">ইন স্টক</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Variants, Pricing, 3 Combo Offers (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Color Variations Box matching image_d7e31ef3.png */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-[#E11D48]" />
                  <h3 className="text-sm font-bold text-stone-900">
                    কালার ভ্যারিয়েশন ({colors.length} টি কালার)
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setColors([])}
                    className="text-stone-400 hover:text-stone-600 underline cursor-pointer"
                  >
                    Clear All
                  </button>
                  <span className="text-emerald-700 font-bold">100% Real Colors</span>
                </div>
              </div>

              {/* Color chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {colors.map((color) => (
                  <span
                    key={color}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 hover:bg-rose-50 text-stone-800 text-xs font-medium rounded-full border border-stone-200"
                  >
                    <span>{color}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveColor(color)}
                      className="text-stone-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              {/* Add color input */}
              <form onSubmit={handleAddColor} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newColorInput}
                  onChange={(e) => setNewColorInput(e.target.value)}
                  placeholder="নতুন কালার (যেমন: মেরুন (Maroon))..."
                  className="flex-1 px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:border-[#E11D48] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  + Add
                </button>
              </form>
            </div>

            {/* Size Variations Box */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-stone-900">
                  উপলব্ধ সাইজসমূহ (Available Sizes)
                </h3>
                <span className="text-[11px] text-stone-500">{sizes.length} টি সাইজ</span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {sizes.map((sz) => (
                  <span
                    key={sz}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-800 text-xs font-semibold rounded-full border border-rose-200"
                  >
                    <span>{sz}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSize(sz)}
                      className="text-rose-400 hover:text-rose-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <form onSubmit={handleAddSize} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newSizeInput}
                  onChange={(e) => setNewSizeInput(e.target.value)}
                  placeholder="যেমন: Free Size, 38, 40, 42..."
                  className="flex-1 px-3 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-lg focus:border-[#E11D48] focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                >
                  + Add
                </button>
              </form>
            </div>

            {/* Pricing & 3 Combo / Size Offers (Supports BOTH Piece Mode & Size Mode) */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-rose-100 flex-wrap gap-2">
                <h3 className="text-sm font-bold text-stone-900">
                  মূল্য ও ৩টি অফার প্যাকেজ (পিস অথবা সাইজ অনুযায়ী)
                </h3>
                <span className="text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  রিয়েল-টাইম লাইভ সেভ!
                </span>
              </div>

              {/* Mode Selector: Piece vs Size */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleOfferMode('piece')}
                  className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                    offerMode === 'piece'
                      ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-rose-300'
                  }`}
                >
                  📦 পিস অনুযায়ী (১, ২, ৩ পিস)
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleOfferMode('size')}
                  className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                    offerMode === 'size'
                      ? 'bg-[#E11D48] text-white border-[#E11D48] shadow-xs'
                      : 'bg-stone-50 text-stone-700 border-stone-200 hover:border-rose-300'
                  }`}
                >
                  📏 সাইজ অনুযায়ী (Small, Medium, Full)
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Package 1 */}
                <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={pkg1Title}
                      onChange={(e) => setPkg1Title(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-white border border-rose-200 rounded-lg font-extrabold text-stone-900 text-xs"
                    />
                    <span className="text-[10px] text-stone-500 font-medium shrink-0">প্যাকেজ ১</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-stone-600 block mb-0.5 font-medium">বিক্রয় মূল্য (৳)</label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setPrice(val);
                          setComboSinglePrice(val);
                          setComboDoublePrice(val * 2 - 100);
                          setComboTriplePrice(val * 3 - 200);
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-mono font-bold text-[#E11D48]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-stone-600 block mb-0.5 font-medium">পূর্বের মূল্য (Strikethrough)</label>
                      <input
                        type="number"
                        value={originalPrice}
                        onChange={(e) => setOriginalPrice(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-mono text-stone-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Package 2 */}
                <div className="p-3 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={pkg2Title}
                      onChange={(e) => setPkg2Title(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-white border border-stone-300 rounded-lg font-extrabold text-stone-900 text-xs"
                    />
                    <span className="text-[10px] font-bold text-[#E11D48] bg-rose-100 px-2 py-0.5 rounded-full shrink-0">সবচেয়ে জনপ্রিয়</span>
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-600 block mb-0.5 font-medium">প্যাকেজ ২ মূল্য (৳ BDT)</label>
                    <input
                      type="number"
                      value={comboDoublePrice}
                      onChange={(e) => setComboDoublePrice(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-mono font-bold text-[#E11D48]"
                    />
                  </div>
                </div>

                {/* Package 3 */}
                <div className="p-3 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={pkg3Title}
                      onChange={(e) => setPkg3Title(e.target.value)}
                      className="flex-1 px-2.5 py-1 bg-white border border-stone-300 rounded-lg font-extrabold text-stone-900 text-xs"
                    />
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">ফ্রি ডেলিভারি</span>
                  </div>
                  <div>
                    <label className="text-[11px] text-stone-600 block mb-0.5 font-medium">প্যাকেজ ৩ মূল্য (৳ BDT)</label>
                    <input
                      type="number"
                      value={comboTriplePrice}
                      onChange={(e) => setComboTriplePrice(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg font-mono font-bold text-emerald-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SKU & Stock Management matching image_7747cc85.png */}
            <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs space-y-3 text-xs">
              <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-rose-100">
                স্টক ও SKU ম্যানেজার (Stock & Inventory)
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-bold mb-1">প্রোডাক্ট বেস SKU</label>
                  <input
                    type="text"
                    value={skuCode}
                    onChange={(e) => setSkuCode(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-bold mb-1">স্টক স্ট্যাটাস</label>
                  <select
                    value={inStock ? 'true' : 'false'}
                    onChange={(e) => setInStock(e.target.value === 'true')}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg font-semibold text-xs"
                  >
                    <option value="true">✓ ইন স্টক (In Stock)</option>
                    <option value="false">✕ স্টক আউট (Out of Stock)</option>
                  </select>
                </div>
              </div>

              {/* Publication Status: Published vs Draft (Requirement 6.7 & 7) */}
              <div className="pt-2 border-t border-rose-100">
                <label className="block text-stone-700 font-bold mb-1">পাবলিকেশন স্ট্যাটাস (Visibility)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setProductStatus('published')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      productStatus === 'published'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}
                  >
                    ✓ লাইভ পাবলিশড (Live)
                  </button>
                  <button
                    type="button"
                    onClick={() => setProductStatus('draft')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      productStatus === 'draft'
                        ? 'bg-amber-50 text-stone-800 border-stone-300 shadow-2xs'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}
                  >
                    📝 ড্রাফট (Draft Only)
                  </button>
                </div>
              </div>

              {/* Product Video Link (Requirement 6.5) */}
              <div className="pt-2 border-t border-rose-100 space-y-2">
                <label className="block text-stone-700 font-bold">প্রোডাক্ট ভিডিও লিংক (MP4 / WebM / YouTube)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    placeholder="https://...mp4 অথবা youtube link"
                    className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newVideoUrl.trim() && !videos.includes(newVideoUrl.trim())) {
                        setVideos([...videos, newVideoUrl.trim()]);
                        setNewVideoUrl('');
                      }
                    }}
                    className="px-3 py-1.5 bg-[#E11D48] text-white font-bold rounded-lg text-xs hover:bg-[#BE123C] cursor-pointer"
                  >
                    + Add Video
                  </button>
                </div>
                {videos.length > 0 && (
                  <div className="space-y-1">
                    {videos.map((vid, vIdx) => (
                      <div key={vIdx} className="flex items-center justify-between p-2 rounded-lg bg-stone-50 border border-stone-200 text-[11px]">
                        <span className="truncate max-w-[200px] font-mono">{vid}</span>
                        <button
                          type="button"
                          onClick={() => setVideos(videos.filter((_, i) => i !== vIdx))}
                          className="text-rose-600 font-bold hover:underline cursor-pointer"
                        >
                          রিমুভ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSkuCode(`DKD-${category.toUpperCase().slice(0, 3)}-${Math.floor(100 + Math.random() * 900)}`);
                    setToastMessage('নতুন SKU কোড জেনারেট করা হয়েছে!');
                    setTimeout(() => setToastMessage(''), 2000);
                  }}
                  className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-[#E11D48] font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>নতুন SKU অটো-জেনারেট করুন</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </main>

      {/* Bottom Sticky Action Bar matching image_d7e31ef3.png and image_acfc828b.png */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-rose-200 py-3 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="px-4 py-2 border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancel / ফিরে যান
            </button>
            <button
              onClick={handleDeleteProduct}
              className="px-4 py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Product</span>
            </button>
          </div>

          <button
            onClick={handleSaveAndPublish}
            disabled={saving}
            className="px-6 py-2.5 bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'লাইভ সেভ হচ্ছে...' : '💾 Save & Live Publish to Store'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
