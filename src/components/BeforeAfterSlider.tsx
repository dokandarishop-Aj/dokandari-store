import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Sparkles,
  Upload,
  CheckCircle2,
  MoveHorizontal,
  Sliders,
  Database,
  Loader2,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { Product } from '../types';
import {
  compressImageFileToDataUrl,
  resolveSafeProductImageUrl,
  handleProductImageError,
} from '../lib/storeSync';

interface BeforeAfterSliderProps {
  product: Product;
  isAdmin?: boolean;
  onSaveProduct?: (updatedProduct: Product) => Promise<void> | void;
  compact?: boolean;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  product,
  isAdmin = false,
  onSaveProduct,
  compact = false,
}) => {
  const isSkincareOrBeauty =
    product.category === 'beauty_personal_care' ||
    product.category === 'health_fitness' ||
    /skin|soap|serum|cream|lotion|face|hair|tonic|brighten|whiten|glow|acne|cleanser|স্কিন|সাবান|সিরাম|ক্রিম|হেয়ার|টনিক|ব্রণ|উজ্জ্বল/i.test(
      `${product.name} ${product.titleEn || ''} ${product.description || ''}`
    );

  // Determine default fallback Before & After images from product gallery if not explicitly uploaded yet
  const defaultBeforeImg =
    product.beforeImage ||
    (product.images && product.images.length > 1
      ? resolveSafeProductImageUrl(product.images[1], product, 1)
      : resolveSafeProductImageUrl(product.images?.[0], product, 0));

  const defaultAfterImg =
    product.afterImage ||
    resolveSafeProductImageUrl(product.images?.[0], product, 0);

  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showAdminEditor, setShowAdminEditor] = useState<boolean>(false);

  const [beforeImg, setBeforeImg] = useState<string>(defaultBeforeImg);
  const [afterImg, setAfterImg] = useState<string>(defaultAfterImg);
  const [beforeLabel, setBeforeLabel] = useState<string>(
    product.beforeLabel || 'ব্যবহারের আগে (Before)'
  );
  const [afterLabel, setAfterLabel] = useState<string>(
    product.afterLabel || 'ব্যবহারের পরে (After - ১৪ দিন পর)'
  );
  const [sectionTitle, setSectionTitle] = useState<string>(
    product.beforeAfterTitle ||
      (isSkincareOrBeauty
        ? 'ব্যবহারের আগে ও পরের বাস্তব পার্থক্য (Before & After ফলাফল)'
        : 'প্রোডাক্টের আগে ও পরের তুলনামূলক ভিউ (Before & After Comparison)')
  );

  const [isUploadingBefore, setIsUploadingBefore] = useState<boolean>(false);
  const [isUploadingAfter, setIsUploadingAfter] = useState<boolean>(false);
  const [isSavingLifetime, setIsSavingLifetime] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string>('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const beforeInputRef = useRef<HTMLInputElement | null>(null);
  const afterInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setBeforeImg(
      product.beforeImage ||
        (product.images && product.images.length > 1
          ? resolveSafeProductImageUrl(product.images[1], product, 1)
          : resolveSafeProductImageUrl(product.images?.[0], product, 0))
    );
    setAfterImg(
      product.afterImage ||
        resolveSafeProductImageUrl(product.images?.[0], product, 0)
    );
    setBeforeLabel(product.beforeLabel || 'ব্যবহারের আগে (Before)');
    setAfterLabel(product.afterLabel || 'ব্যবহারের পরে (After - ১৪ দিন পর)');
    if (product.beforeAfterTitle) {
      setSectionTitle(product.beforeAfterTitle);
    }
  }, [
    product.id,
    product.beforeImage,
    product.afterImage,
    product.beforeLabel,
    product.afterLabel,
    product.beforeAfterTitle,
    product.images,
  ]);

  const updateSliderFromClientX = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    setSliderPosition(percentage);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateSliderFromClientX(e.clientX);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture error on older browsers
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateSliderFromClientX(e.clientX);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleBeforeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingBefore(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 900, 0.78);
      setBeforeImg(compressed);
    } catch (err) {
      console.error('Before image upload error:', err);
    } finally {
      setIsUploadingBefore(false);
    }
  };

  const handleAfterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAfter(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 900, 0.78);
      setAfterImg(compressed);
    } catch (err) {
      console.error('After image upload error:', err);
    } finally {
      setIsUploadingAfter(false);
    }
  };

  const handleLifetimeSave = async () => {
    if (!onSaveProduct) return;
    setIsSavingLifetime(true);
    setSaveSuccessMessage('');
    try {
      const updated: Product = {
        ...product,
        beforeImage: beforeImg,
        afterImage: afterImg,
        beforeLabel,
        afterLabel,
        beforeAfterTitle: sectionTitle,
        updatedAt: Date.now(),
        lifetimeSavedAt: Date.now(),
      };
      await onSaveProduct(updated);
      setSaveSuccessMessage('Before & After ছবি লাইফটাইম ডাটাবেজে স্থায়ীভাবে সেভ হয়েছে!');
      setTimeout(() => setSaveSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Save Before/After error:', err);
    } finally {
      setIsSavingLifetime(false);
    }
  };

  // Show on ProductDetailPage if product has custom before/after images, is skincare/beauty, or if user is Admin
  const hasCustomComparison = Boolean(product.beforeImage || product.afterImage);
  if (!hasCustomComparison && !isSkincareOrBeauty && !isAdmin) {
    return null;
  }

  const usingSingleImageSimulated =
    !product.beforeImage &&
    !product.afterImage &&
    beforeImg === afterImg;

  return (
    <div className="bg-gradient-to-br from-rose-50/70 via-white to-emerald-50/50 rounded-3xl border-2 border-rose-100 p-4 sm:p-6 shadow-sm my-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                Before & After রেজাল্ট স্লাইডার
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> ১০০% রিয়েল রেজাল্ট তুলনা
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-neutral-900 mt-0.5">
              {sectionTitle}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Preset Buttons */}
          <div className="hidden sm:flex items-center gap-1 bg-white border border-neutral-200 rounded-xl p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSliderPosition(15)}
              className={`px-2.5 py-1 rounded-lg transition ${
                sliderPosition < 30
                  ? 'bg-emerald-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              After দেখুন
            </button>
            <button
              type="button"
              onClick={() => setSliderPosition(50)}
              className={`px-2.5 py-1 rounded-lg transition ${
                sliderPosition >= 30 && sliderPosition <= 70
                  ? 'bg-rose-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              ৫০/৫০ তুলনা
            </button>
            <button
              type="button"
              onClick={() => setSliderPosition(85)}
              className={`px-2.5 py-1 rounded-lg transition ${
                sliderPosition > 70
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Before দেখুন
            </button>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAdminEditor((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-neutral-900 text-white hover:bg-rose-600 transition shadow-sm"
            >
              <Sliders className="w-3.5 h-3.5" />
              {showAdminEditor ? 'এডিটর বন্ধ করুন' : 'Before/After ছবি আপলোড'}
            </button>
          )}
        </div>
      </div>

      {/* Interactive Comparison Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`relative w-full ${
          compact ? 'h-64 sm:h-72' : 'h-72 sm:h-96'
        } rounded-2xl overflow-hidden select-none cursor-ew-resize border border-neutral-200 bg-neutral-900 shadow-inner touch-none`}
        role="slider"
        aria-label="Before and After product comparison slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(sliderPosition)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') setSliderPosition((p) => Math.max(0, p - 5));
          if (e.key === 'ArrowRight') setSliderPosition((p) => Math.min(100, p + 5));
        }}
      >
        {/* Background Layer: AFTER Image (Right Side / Full Base) */}
        <img
          src={afterImg}
          alt={afterLabel}
          onError={(e) => handleProductImageError(e, product, 0)}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none brightness-105 contrast-105"
        />

        {/* Foreground Clipped Layer: BEFORE Image (Left Side) */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img
            src={beforeImg}
            alt={beforeLabel}
            onError={(e) => handleProductImageError(e, product, 1)}
            draggable={false}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
              usingSingleImageSimulated
                ? 'sepia-[.35] brightness-[0.82] contrast-[0.92] saturate-[0.75]'
                : ''
            }`}
          />
          {usingSingleImageSimulated && (
            <div className="absolute inset-0 bg-amber-950/15 pointer-events-none" />
          )}
        </div>

        {/* Left Badge (Before) */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-neutral-900/85 text-white backdrop-blur-md shadow-md border border-white/15">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            {beforeLabel}
          </span>
        </div>

        {/* Right Badge (After) */}
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold bg-emerald-600/95 text-white backdrop-blur-md shadow-md border border-white/20">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {afterLabel}
          </span>
        </div>

        {/* Draggable Vertical Divider Line + Handle */}
        <div
          className="absolute top-0 bottom-0 z-20 w-1 bg-white shadow-[0_0_16px_rgba(0,0,0,0.6)] pointer-events-none"
          style={{ left: `calc(${sliderPosition}% - 2px)` }}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-11 h-11 rounded-full bg-white text-rose-600 shadow-xl border-2 border-rose-500 flex items-center justify-center transition-transform scale-100">
            <MoveHorizontal className="w-5 h-5 stroke-[2.5]" />
          </div>
        </div>

        {/* Bottom Instruction Pill */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="px-3.5 py-1 rounded-full bg-black/65 backdrop-blur-md text-white text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap border border-white/15">
            <Eye className="w-3.5 h-3.5 text-rose-400" />
            হ্যান্ডেলটি ডানে-বামে টেনে ব্যবহারের আগে ও পরের পার্থক্য দেখুন ({Math.round(sliderPosition)}%)
          </div>
        </div>
      </div>

      {/* Admin Side-by-Side Upload & 1-Click Lifetime Database Save Panel */}
      {isAdmin && showAdminEditor && (
        <div className="mt-4 p-4 rounded-2xl bg-white border-2 border-rose-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
            <div>
              <h4 className="text-sm font-extrabold text-neutral-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-rose-600" />
                অ্যাডমিন Before & After পাশাপাশি ২টি ছবি আপলোড ও লাইফটাইম সেভ
              </h4>
              <p className="text-xs text-neutral-500">
                স্কিনকেয়ার, বিউটি বা যেকোনো প্রোডাক্টের ব্যবহারের আগের ও পরের ২টি আসল ছবি আপলোড করে ১-ক্লিকে লাইফটাইম ডাটাবেজে সেভ করুন।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Before Image Upload Card */}
            <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-neutral-800">
                  ১. ব্যবহারের আগের ছবি (Before Image)
                </span>
                <button
                  type="button"
                  onClick={() => beforeInputRef.current?.click()}
                  disabled={isUploadingBefore}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-xs font-bold hover:bg-rose-600 transition"
                >
                  {isUploadingBefore ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  ছবি আপলোড
                </button>
                <input
                  ref={beforeInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBeforeFileUpload}
                  className="hidden"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <img
                  src={beforeImg}
                  alt="Before Preview"
                  className="w-16 h-16 rounded-lg object-cover border border-neutral-300 shrink-0 bg-white"
                />
                <div className="flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={beforeImg}
                    onChange={(e) => setBeforeImg(e.target.value)}
                    placeholder="অথবা Before ছবির সরাসরি লিংক দিন..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-300 focus:border-rose-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={beforeLabel}
                    onChange={(e) => setBeforeLabel(e.target.value)}
                    placeholder="ব্যবহারের আগে (Before)"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-white focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* After Image Upload Card */}
            <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-900">
                  ২. ব্যবহারের পরের ছবি (After Image)
                </span>
                <button
                  type="button"
                  onClick={() => afterInputRef.current?.click()}
                  disabled={isUploadingAfter}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
                >
                  {isUploadingAfter ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  ছবি আপলোড
                </button>
                <input
                  ref={afterInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAfterFileUpload}
                  className="hidden"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <img
                  src={afterImg}
                  alt="After Preview"
                  className="w-16 h-16 rounded-lg object-cover border border-emerald-300 shrink-0 bg-white"
                />
                <div className="flex-1 space-y-1.5">
                  <input
                    type="text"
                    value={afterImg}
                    onChange={(e) => setAfterImg(e.target.value)}
                    placeholder="অথবা After ছবির সরাসরি লিংক দিন..."
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-emerald-300 focus:border-emerald-600 focus:outline-none bg-white"
                  />
                  <input
                    type="text"
                    value={afterLabel}
                    onChange={(e) => setAfterLabel(e.target.value)}
                    placeholder="ব্যবহারের পরে (After - ১৪ দিন পর)"
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-emerald-200 bg-white focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <input
              type="text"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="স্লাইডার সেকশনের শিরোনাম..."
              className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-neutral-300 focus:border-rose-500 focus:outline-none"
            />

            {onSaveProduct && (
              <button
                type="button"
                onClick={handleLifetimeSave}
                disabled={isSavingLifetime}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-extrabold shadow-md hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-60"
              >
                {isSavingLifetime ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                💾 ১-ক্লিকে লাইফটাইম ডাটাবেজে সেভ করুন
              </button>
            )}
          </div>

          {saveSuccessMessage && (
            <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {saveSuccessMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
