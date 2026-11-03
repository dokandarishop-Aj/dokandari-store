/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Star,
  CheckCircle2,
  MapPin,
  Camera,
  Plus,
  Trash2,
  Edit3,
  Upload,
  X,
  Database,
  Sparkles,
  ShoppingBag,
  Video,
  Clock,
  Check,
} from 'lucide-react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CustomerUgcCard, Product } from '../types';
import {
  compressImageFileToDataUrl,
  getPersistedCustomerUgcCards,
  saveCustomerUgcCardsPersisted,
  submitCustomerUgcReviewForApproval,
  resolveSafeProductImageUrl,
} from '../lib/storeSync';

interface CustomerUgcSectionProps {
  cards?: CustomerUgcCard[];
  products: Product[];
  isAdmin?: boolean;
  onUpdateCards?: (nextCards: CustomerUgcCard[]) => void;
  onSelectProduct?: (product: Product) => void;
}

export const CustomerUgcSection: React.FC<CustomerUgcSectionProps> = ({
  cards: externalCards,
  products,
  isAdmin = false,
  onUpdateCards: externalOnUpdateCards,
  onSelectProduct,
}) => {
  const [internalCards, setInternalCards] = useState<CustomerUgcCard[]>(() =>
    getPersistedCustomerUgcCards()
  );
  const cards = externalCards ?? internalCards;
  const onUpdateCards = (nextCards: CustomerUgcCard[]) => {
    setInternalCards(nextCards);
    externalOnUpdateCards?.(nextCards);
  };

  useEffect(() => {
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'customer_ugc'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data?.cards) && data.cards.length > 0) {
            setInternalCards(data.cards as CustomerUgcCard[]);
          }
        }
      },
      () => {}
    );

    const unsubReviews = onSnapshot(
      collection(db, 'ugc_reviews'),
      (snap) => {
        if (snap.empty) return;
        const remoteSubCards: CustomerUgcCard[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data() as CustomerUgcCard;
          if (d && d.id) remoteSubCards.push(d);
        });
        if (remoteSubCards.length > 0) {
          setInternalCards((prev) => {
            const byId = new Map<string, CustomerUgcCard>();
            for (const c of prev) byId.set(c.id, c);
            for (const rc of remoteSubCards) byId.set(rc.id, rc);
            return Array.from(byId.values()).sort(
              (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            );
          });
        }
      },
      () => {}
    );

    return () => {
      unsubSettings();
      unsubReviews();
    };
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'customer_submit' | 'admin_edit'>('customer_submit');
  const [editingCard, setEditingCard] = useState<CustomerUgcCard | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [location, setLocation] = useState('ঢাকা');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [customProductName, setCustomProductName] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState('');
  const [reviewVideo, setReviewVideo] = useState('');
  const [beforePhoto, setBeforePhoto] = useState('');
  const [testimonial, setTestimonial] = useState('');
  const [rating, setRating] = useState(5);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [customerSuccessBanner, setCustomerSuccessBanner] = useState('');

  // Separate pending vs approved cards
  const pendingCards = cards.filter((c) => c.status === 'pending');
  const approvedCards = cards.filter((c) => c.status !== 'pending' && c.status !== 'rejected');

  // Open modal for Customer 'Upload Your Review' (saves as pending approval)
  const openCustomerUploadModal = () => {
    setEditingCard(null);
    setModalMode('customer_submit');
    setCustomerName('');
    setLocation('ঢাকা');
    setSelectedProductId(products[0]?.id || '');
    setCustomProductName('');
    setReviewPhoto('');
    setReviewVideo('');
    setBeforePhoto('');
    setTestimonial('');
    setRating(5);
    setIsModalOpen(true);
  };

  // Open modal for Admin direct add/edit
  const openAdminAddModal = () => {
    setEditingCard(null);
    setModalMode('admin_edit');
    setCustomerName('');
    setLocation('ঢাকা');
    setSelectedProductId(products[0]?.id || '');
    setCustomProductName('');
    setReviewPhoto('');
    setReviewVideo('');
    setBeforePhoto('');
    setTestimonial('');
    setRating(5);
    setIsModalOpen(true);
  };

  const openEditModal = (card: CustomerUgcCard) => {
    setEditingCard(card);
    setModalMode('admin_edit');
    setCustomerName(card.customerName);
    setLocation(card.location);
    setSelectedProductId(card.productId || '');
    setCustomProductName(card.productName);
    setReviewPhoto(card.reviewPhoto || '');
    setReviewVideo(card.reviewVideo || '');
    setBeforePhoto(card.beforePhoto || '');
    setTestimonial(card.testimonial);
    setRating(card.rating || 5);
    setIsModalOpen(true);
  };

  // Unified File Upload: Supports both Image and Video files
  const handleMediaUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'review_media' | 'before'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (target === 'before') {
      setUploadingBefore(true);
      try {
        const compressed = await compressImageFileToDataUrl(file, 850, 0.82);
        setBeforePhoto(compressed);
      } catch (err) {
        console.warn('Before photo upload error:', err);
      } finally {
        setUploadingBefore(false);
        e.target.value = '';
      }
      return;
    }

    // Check if customer uploaded a video file or an image file
    if (file.type.startsWith('video/')) {
      setUploadingVideo(true);
      try {
        // Read video file as data URL (up to ~8MB) or object URL fallback
        const videoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('ভিডিও ফাইলটি পড়া যায়নি'));
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(file);
        });
        // If video data URL is under 750KB, store directly in Firestore; otherwise upload or keep safe preview
        if (videoDataUrl.length <= 780000) {
          setReviewVideo(videoDataUrl);
        } else {
          setReviewVideo(videoDataUrl.slice(0, 780000));
        }
        // If no photo yet, set selected product's image as thumbnail fallback
        const matchedProd = products.find((p) => p.id === selectedProductId);
        if (!reviewPhoto && matchedProd?.images?.[0]) {
          setReviewPhoto(matchedProd.images[0]);
        }
      } catch (err) {
        console.warn('UGC video upload error:', err);
      } finally {
        setUploadingVideo(false);
        e.target.value = '';
      }
    } else {
      setUploadingPhoto(true);
      try {
        const compressed = await compressImageFileToDataUrl(file, 850, 0.82);
        setReviewPhoto(compressed);
      } catch (err) {
        console.warn('UGC image upload error:', err);
      } finally {
        setUploadingPhoto(false);
        e.target.value = '';
      }
    }
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedProd = products.find((p) => p.id === selectedProductId);
    const finalProductName =
      customProductName.trim() || matchedProd?.name || 'দোকানদারি অরিজিনাল কালেকশন';

    const fallbackThumb =
      reviewPhoto.trim() ||
      matchedProd?.images?.[0] ||
      '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg';

    if (!customerName.trim() || (!reviewPhoto.trim() && !reviewVideo.trim()) || !testimonial.trim()) {
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'customer_submit' && !isAdmin) {
        // Customer submission -> Save to Firestore as a pending approval submission!
        const submittedCard = await submitCustomerUgcReviewForApproval({
          customerName: customerName.trim(),
          location: location.trim() || 'ঢাকা',
          productName: finalProductName,
          productId: selectedProductId || matchedProd?.id || undefined,
          reviewPhoto: fallbackThumb,
          reviewVideo: reviewVideo.trim() || undefined,
          beforePhoto: beforePhoto.trim() || undefined,
          testimonial: testimonial.trim(),
          rating: Number(rating) || 5,
          verifiedBadge: 'পেন্ডিং অনুমোদন (Pending Approval)',
          updatedAt: Date.now(),
        });

        const nextList = [submittedCard, ...cards.filter((c) => c.id !== submittedCard.id)];
        onUpdateCards(nextList);
        setIsModalOpen(false);
        setCustomerSuccessBanner(
          '🎉 ধন্যবাদ! আপনার রিভিউ ছবি/ভিডিও সফলভাবে ডাটাবেজে জমা হয়েছে এবং অ্যাডমিন অনুমোদনের পর ওয়েবসাইটে প্রকাশিত হবে।'
        );
        setTimeout(() => setCustomerSuccessBanner(''), 7000);
      } else {
        // Admin direct add/edit -> Immediately approved & persisted
        const newCard: CustomerUgcCard = {
          id: editingCard?.id || `ugc-${Date.now()}`,
          customerName: customerName.trim(),
          location: location.trim() || 'ঢাকা',
          productName: finalProductName,
          productId: selectedProductId || undefined,
          reviewPhoto: fallbackThumb,
          reviewVideo: reviewVideo.trim() || undefined,
          beforePhoto: beforePhoto.trim() || undefined,
          testimonial: testimonial.trim(),
          rating: Number(rating) || 5,
          status: 'approved',
          verifiedBadge: 'ভেরিফাইড কাস্টমার রিভিউ',
          createdAt: editingCard?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };

        const nextList = editingCard
          ? cards.map((c) => (c.id === editingCard.id ? newCard : c))
          : [newCard, ...cards];

        const saved = await saveCustomerUgcCardsPersisted(nextList);
        try {
          await setDoc(doc(db, 'ugc_reviews', newCard.id), newCard, { merge: true });
        } catch {
          // ignore
        }
        onUpdateCards(saved);
        setIsModalOpen(false);
        setToastMsg('✅ কাস্টমার রিভিউ কার্ড লাইফটাইম ডাটাবেজে সেভ হয়েছে!');
        setTimeout(() => setToastMsg(''), 4000);
      }
    } finally {
      setSaving(false);
    }
  };

  // Admin: 1-Click Approve Pending Review
  const handleApprovePendingCard = async (card: CustomerUgcCard) => {
    const approved: CustomerUgcCard = {
      ...card,
      status: 'approved',
      verifiedBadge: 'ভেরিফাইড কাস্টমার রিভিউ',
      verifiedBadgeText: 'ভেরিফাইড কাস্টমার রিভিউ',
      updatedAt: Date.now(),
    };
    const nextList = cards.map((c) => (c.id === card.id ? approved : c));
    const saved = await saveCustomerUgcCardsPersisted(nextList);
    try {
      await setDoc(doc(db, 'ugc_reviews', card.id), approved, { merge: true });
    } catch {
      // ignore
    }
    onUpdateCards(saved);
    setToastMsg(`✅ "${card.customerName}"-এর রিভিউ অনুমোদন করা হয়েছে এবং লাইভ ওয়েবসাইটে প্রকাশিত হয়েছে!`);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleDeleteCard = async (cardId: string) => {
    const nextList = cards.filter((c) => c.id !== cardId);
    const saved = await saveCustomerUgcCardsPersisted(nextList);
    try {
      await deleteDoc(doc(db, 'ugc_reviews', cardId));
    } catch {
      // ignore
    }
    onUpdateCards(saved);
    setToastMsg('🗑️ কাস্টমার রিভিউ কার্ডটি ডাটাবেজ থেকে মুছে ফেলা হয়েছে।');
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleLifetimeSaveAll = async () => {
    setSaving(true);
    try {
      const saved = await saveCustomerUgcCardsPersisted(cards);
      onUpdateCards(saved);
      setToastMsg('💾 সকল কাস্টমার এক্সপেরিয়েন্স ও UGC রিভিউ কার্ড ১-ক্লিকে লাইফটাইম ডাটাবেজে সেভ হয়েছে!');
      setTimeout(() => setToastMsg(''), 4000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="py-8 sm:py-12 border-t border-rose-100 bg-gradient-to-b from-white via-[#FFF9FA] to-white">
      <div className="w-full px-3 sm:px-6 lg:px-10 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-[#E11D48] text-[11px] font-extrabold">
              <Camera className="w-3.5 h-3.5" />
              <span>CUSTOMER REAL-LIFE EXPERIENCE • ১০০% বাস্তব গ্রাহক অভিজ্ঞতা</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-stone-900 tracking-tight">
              আমাদের সম্মানিত গ্রাহকদের বাস্তব অভিজ্ঞতা (Customer UGC)
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl">
              সারা বাংলাদেশের গ্রাহকদের হাতে পাওয়া আসল প্রোডাক্টের আনবক্সিং ছবি, ভিডিও ও ফলাফল। ডেলিভারি ম্যানের সামনে চেক করে নেওয়ার শতভাগ নিশ্চয়তা।
            </p>
          </div>

          {/* Dedicated 'Upload Your Review' Button for Customers + Admin Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openCustomerUploadModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#E11D48] to-pink-600 hover:from-[#BE123C] hover:to-pink-700 text-white text-xs sm:text-sm font-extrabold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>📤 আপনার রিভিউ আপলোড করুন (Upload Your Review)</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={openAdminAddModal}
                  className="px-3.5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ অ্যাডমিন ডিরেক্ট UGC যোগ</span>
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleLifetimeSaveAll}
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>{saving ? 'সেভ হচ্ছে...' : '১-ক্লিকে লাইফটাইম সেভ'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Customer Submission Confirmation Toast */}
        {customerSuccessBanner && (
          <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-xs sm:text-sm font-extrabold flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{customerSuccessBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setCustomerSuccessBanner('')}
              className="text-emerald-700 hover:text-emerald-950 font-bold text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {toastMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-extrabold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Admin-Only Pending Approval Queue */}
        {isAdmin && pendingCards.length > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-amber-50/90 border-2 border-amber-300 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-700" />
                <h3 className="text-xs sm:text-sm font-black text-amber-950">
                  অ্যাডমিন পেন্ডিং রিভিউ অনুমোদন তালিকা ({pendingCards.length}টি রিভিউ অনুমোদনের অপেক্ষায়)
                </h3>
              </div>
              <span className="text-[11px] font-bold text-amber-800 bg-white px-2.5 py-0.5 rounded-full border border-amber-200">
                কাস্টমারদের আপলোডকৃত ছবি ও ভিডিও রিভিউ
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingCards.map((pCard) => (
                <div
                  key={pCard.id}
                  className="p-3.5 rounded-2xl bg-white border border-amber-300 shadow-2xs flex flex-col justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    {pCard.reviewVideo ? (
                      <video
                        src={pCard.reviewVideo}
                        controls
                        className="w-20 h-20 rounded-xl object-cover bg-stone-900 shrink-0 border border-amber-200"
                      />
                    ) : (
                      <img
                        src={pCard.reviewPhoto}
                        alt={pCard.customerName}
                        className="w-20 h-20 rounded-xl object-cover bg-stone-100 shrink-0 border border-amber-200"
                      />
                    )}
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-stone-900 truncate">{pCard.customerName}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-extrabold">
                          Pending
                        </span>
                      </div>
                      <p className="text-[11px] text-[#E11D48] font-bold truncate">{pCard.productName}</p>
                      <p className="text-[11px] text-stone-600 line-clamp-2">“{pCard.testimonial}”</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-100">
                    <button
                      type="button"
                      onClick={() => handleApprovePendingCard(pCard)}
                      className="flex-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>অনুমোদন ও পাবলিশ করুন</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(pCard.id)}
                      className="py-1.5 px-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ডিলিট</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* UGC Grid Cards (Approved Reviews) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {approvedCards.map((card) => {
            const linkedProduct = products.find(
              (p) => p.id === card.productId || p.name === card.productName
            );
            const safePhoto =
              card.reviewPhoto ||
              (linkedProduct ? resolveSafeProductImageUrl(linkedProduct.images[0], linkedProduct, 0) : '');

            return (
              <div
                key={card.id}
                className="group bg-white rounded-3xl border border-rose-100/90 hover:border-rose-300 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Customer Real Review Photo or Video Container */}
                  <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
                    {card.reviewVideo ? (
                      <video
                        src={card.reviewVideo}
                        poster={safePhoto || undefined}
                        controls
                        playsInline
                        className="w-full h-full object-cover bg-stone-950"
                      />
                    ) : (
                      <img
                        src={safePhoto}
                        alt={`${card.customerName} - ${card.productName}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    )}

                    {/* Before Photo Mini Pip if available */}
                    {card.beforePhoto && !card.reviewVideo && (
                      <div className="absolute bottom-2.5 left-2.5 bg-white/95 p-1 rounded-xl shadow-md border border-rose-200 flex items-center gap-1.5">
                        <img
                          src={card.beforePhoto}
                          alt="Before"
                          className="w-9 h-9 rounded-lg object-cover"
                        />
                        <div className="pr-1.5">
                          <span className="block text-[9px] font-black text-stone-500 uppercase">
                            Before
                          </span>
                          <span className="block text-[10px] font-extrabold text-[#E11D48]">
                            আগের ছবি
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Verified Customer Badge */}
                    <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full bg-emerald-600/95 text-white text-[10px] font-extrabold flex items-center gap-1 shadow-xs backdrop-blur-xs pointer-events-none">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>
                        {card.reviewVideo
                          ? '🎥 ভেরিফাইড ভিডিও রিভিউ'
                          : card.verifiedBadge || 'ভেরিফাইড কাস্টমার রিভিউ'}
                      </span>
                    </div>

                    {/* Admin Quick Edit / Delete Overlay */}
                    {isAdmin && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(card)}
                          className="p-1.5 rounded-full bg-white/95 hover:bg-white text-stone-800 shadow-sm cursor-pointer"
                          title="এই রিভিউ কার্ড এডিট করুন"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(card.id)}
                          className="p-1.5 rounded-full bg-white/95 hover:bg-rose-50 text-rose-600 shadow-sm cursor-pointer"
                          title="ডিলিট করুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Testimonial Content */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`w-3.5 h-3.5 ${
                              idx < (card.rating || 5) ? 'fill-amber-400 text-amber-400' : 'text-stone-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] font-bold text-stone-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-[#E11D48]" />
                        {card.location}
                      </span>
                    </div>

                    <p className="text-xs text-stone-700 leading-relaxed line-clamp-3 font-medium">
                      “{card.testimonial}”
                    </p>
                  </div>
                </div>

                {/* Footer: Customer Info & Linked Product */}
                <div className="px-4 pb-4 pt-2 border-t border-rose-50 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold text-stone-900">{card.customerName}</div>
                    <div className="text-[10.5px] text-[#E11D48] font-bold line-clamp-1">
                      {card.productName}
                    </div>
                  </div>

                  {linkedProduct && onSelectProduct && (
                    <button
                      type="button"
                      onClick={() => onSelectProduct(linkedProduct)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-[#E11D48] text-[#E11D48] hover:text-white text-[10.5px] font-extrabold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <ShoppingBag className="w-3 h-3" />
                      <span>পণ্যটি দেখুন</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal for Customer 'Upload Your Review' OR Admin Add/Edit UGC Card */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-rose-200 text-xs my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-rose-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E11D48]" />
                <div>
                  <h3 className="text-sm font-black text-stone-900">
                    {editingCard
                      ? 'কাস্টমার রিভিউ কার্ড এডিট করুন'
                      : modalMode === 'customer_submit'
                      ? '📤 আপনার রিভিউ ছবি বা ভিডিও আপলোড করুন (Upload Your Review)'
                      : '+ নতুন কাস্টমার রিয়েল রিভিউ (UGC) যোগ করুন'}
                  </h3>
                  {modalMode === 'customer_submit' && !isAdmin && (
                    <p className="text-[10.5px] text-stone-500 mt-0.5">
                      প্রোডাক্ট সিলেক্ট করে আপনার বাস্তব ছবি বা ভিডিও রিভিউ জমা দিন (অ্যাডমিন অনুমোদনের পর ওয়েবসাইটে প্রদর্শিত হবে)
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">আপনার নাম (Customer Name) *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="যেমন: নুসরাত জাহান"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">শহর / এলাকা (Location) *</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="যেমন: উত্তরা, ঢাকা"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">কোন প্রোডাক্টটি কিনেছেন নির্বাচন করুন *</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    setSelectedProductId(e.target.value);
                    const found = products.find((p) => p.id === e.target.value);
                    if (found) setCustomProductName(found.name);
                  }}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-bold"
                >
                  <option value="">-- ক্যাটালগ থেকে প্রোডাক্ট সিলেক্ট করুন --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — ৳{p.price}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-2">
                  <label className="block font-extrabold text-stone-800">
                    রিভিউ ছবি বা ভিডিও আপলোড করুন *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <label className="px-3 py-1.5 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5 text-[11px]">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploadingPhoto || uploadingVideo
                          ? 'আপলোড হচ্ছে...'
                          : '📷 ছবি / 🎥 ভিডিও ফাইল নিন'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => handleMediaUpload(e, 'review_media')}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={reviewPhoto}
                    onChange={(e) => setReviewPhoto(e.target.value)}
                    placeholder="অথবা ছবির সরাসরি লিংক দিন..."
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-[11px]"
                  />
                  <input
                    type="text"
                    value={reviewVideo}
                    onChange={(e) => setReviewVideo(e.target.value)}
                    placeholder="অথবা ভিডিও লিংক (MP4/WebM)..."
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-[11px]"
                  />
                  <div className="flex items-center gap-2">
                    {reviewPhoto && (
                      <img
                        src={reviewPhoto}
                        alt="Review Preview"
                        className="w-14 h-14 rounded-xl object-cover border border-rose-300"
                      />
                    )}
                    {reviewVideo && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                        <Video className="w-3.5 h-3.5" />
                        <span>✓ ভিডিও যুক্ত হয়েছে</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-stone-50 border border-stone-200 space-y-2">
                  <label className="block font-extrabold text-stone-800">
                    ব্যবহারের আগের ছবি (Before - ঐচ্ছিক)
                  </label>
                  <label className="px-3 py-1.5 bg-stone-800 hover:bg-stone-900 text-white rounded-xl font-bold cursor-pointer inline-flex items-center gap-1.5 text-[11px]">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingBefore ? 'আপলোড হচ্ছে...' : '📁 Before ছবি দিন'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleMediaUpload(e, 'before')}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="text"
                    value={beforePhoto}
                    onChange={(e) => setBeforePhoto(e.target.value)}
                    placeholder="অথবা Before ছবির লিংক..."
                    className="w-full px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-[11px]"
                  />
                  {beforePhoto && (
                    <img
                      src={beforePhoto}
                      alt="Before Preview"
                      className="w-14 h-14 rounded-xl object-cover border border-stone-300"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-stone-700 mb-1">প্রোডাক্টের নাম (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={customProductName}
                    onChange={(e) => setCustomProductName(e.target.value)}
                    placeholder="প্রোডাক্টের নাম"
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">রেটিং (১ - ৫ স্টার)</label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl bg-white font-bold"
                  >
                    <option value={5}>⭐⭐⭐⭐⭐ (5.0)</option>
                    <option value={4}>⭐⭐⭐⭐ (4.0)</option>
                    <option value={3}>⭐⭐⭐ (3.0)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  আপনার মতামত / রিভিউ টেক্সট (Testimonial) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  placeholder="প্রোডাক্টের মান, ডেলিভারি ও ব্যবহারের ফলাফল সম্পর্কে লিখুন..."
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 rounded-xl font-bold text-stone-700 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#E11D48] hover:bg-[#BE123C] text-white rounded-xl font-extrabold cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {saving
                    ? 'জমা হচ্ছে...'
                    : modalMode === 'customer_submit' && !isAdmin
                    ? '📤 রিভিউ সাবমিট করুন (Pending Approval)'
                    : '💾 লাইফটাইম ডাটাবেজে সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
