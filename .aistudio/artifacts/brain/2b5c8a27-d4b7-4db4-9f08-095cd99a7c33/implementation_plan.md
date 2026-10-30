# Multi-Pixel Tracking & Abandoned Lead Recovery Plan

## 1. Zero Duplicate Pixel Warnings & Multi-Pixel ID Support
- [x] Injects base Meta and TikTok tracking scripts strictly ONCE globally.
- [x] Allows admins to input multiple comma/space/newline-separated Meta Pixel IDs and TikTok Pixel IDs.
- [x] Parses and dedupes all unique IDs in `src/lib/pixelManager.ts`, maintaining global Sets (`__dokandari_meta_initialized_ids`, `__dokandari_tiktok_initialized_ids`) so `fbq('init')` and `ttq.load()` are called exactly once per ID.
- [x] Dispatches all standard e-commerce events (`PageView`, `ViewContent`, `AddToCart`, `InitiateCheckout`, `Purchase`) to all configured pixel IDs simultaneously.
- [x] Background CAPI proxy route `/api/pixel/event` in `server.ts` for iOS 14+ reliability.
- [x] Interactive Multi-Pixel tool in Admin Panel with live parsed ID chips and zero-duplicate status verification.

## 2. Real-Time Abandoned Cart & Lead Recovery
- [x] Instant debounced lead capture (`captureAbandonedLeadDebounced`) triggered the moment a customer enters their phone number in PDP quick order form or Cart Checkout modal.
- [x] Automatic conversion marker (`markLeadConverted`) when customer confirms the order.
- [x] Real-time Admin Dashboard module "ড্রপড ও লিড রিকভারি (Abandoned Leads & Cart Drop Recovery)":
  - KPI cards: Total captured leads, Pending recovery count, Converted orders, Recoverable value in BDT.
  - Search and filter by status ('all', 'pending', 'contacted', 'converted', 'cancelled').
  - 1-Click WhatsApp button with prefilled personalized recovery message in Bengali.
  - 1-Click Direct Phone call (`tel:...`) and quick phone number copy.
  - Live status dropdown with instantaneous Firestore update and lead deletion.

## 3. High-Performance Speed & Zero-Lag
- [x] Added `loading="lazy"`, `decoding="async"`, `referrerPolicy="no-referrer"` to product images and thumbnails across ProductCard, ProductDetailPage, ProductDetailModal, and Admin Panel.
- [x] Build and TypeScript validation passed cleanly.
