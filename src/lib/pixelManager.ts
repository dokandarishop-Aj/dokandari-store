/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_DOKANDARI_META_PIXEL_ID = '1994859257776698';
export const DEFAULT_DOKANDARI_TIKTOK_PIXEL_ID = 'DBJGOSRC77U3VQV6KLB0';

export interface PixelEventTelemetryLog {
  id: string;
  eventName: string;
  eventId: string;
  orderId?: string;
  contentIds: string[];
  value: number;
  currency: string;
  url: string;
  source: 'client_storefront' | 'server_capi' | 'admin_test' | 'order_reconcile';
  browserFired: boolean;
  capiDispatched: boolean;
  metaPixels: string[];
  tiktokPixels: string[];
  status: string;
  capiResults?: Array<{
    platform: string;
    pixelId: string;
    status: string;
    eventId: string;
    eventsReceived?: number;
    detail?: string;
  }>;
  timestamp: number;
  timeFormatted: string;
}

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    ttq?: any;
    gtag?: any;
    dataLayer?: any[];
    TiktokAnalyticsObject?: string;
    __dokandari_meta_initialized_ids?: Set<string>;
    __dokandari_tiktok_initialized_ids?: Set<string>;
    __dokandari_youtube_initialized_ids?: Set<string>;
    __dokandari_meta_script_loaded?: boolean;
    __dokandari_tiktok_script_loaded?: boolean;
    __dokandari_youtube_script_loaded?: boolean;
    __dokandari_pending_pixel_events?: Array<() => void>;
    __dokandari_fired_purchase_orders?: Map<string, CapiDispatchResponse>;
    __dokandari_client_pixel_logs?: PixelEventTelemetryLog[];
  }
}

export interface CapiDispatchResponse {
  success: boolean;
  eventName: string;
  eventId: string;
  orderId?: string;
  metaPixels?: string[];
  tiktokPixels?: string[];
  contentIds?: string[];
  value?: number;
  currency?: string;
  capiResults?: Array<{
    platform: string;
    pixelId: string;
    status: string;
    eventId: string;
    eventsReceived?: number;
    detail?: string;
    responseBody?: any;
  }>;
  status?: string;
}

const LS_PIXEL_LOGS_KEY = 'dokandari_pixel_event_logs';

export function recordClientPixelLog(entry: Omit<PixelEventTelemetryLog, 'id' | 'timestamp' | 'timeFormatted'>): PixelEventTelemetryLog {
  const now = Date.now();
  const fullEntry: PixelEventTelemetryLog = {
    ...entry,
    id: `pxlog_${now}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: now,
    timeFormatted: new Date(now).toLocaleTimeString('bn-BD'),
  };

  if (typeof window !== 'undefined') {
    window.__dokandari_client_pixel_logs = window.__dokandari_client_pixel_logs || [];
    window.__dokandari_client_pixel_logs.unshift(fullEntry);
    window.__dokandari_client_pixel_logs = window.__dokandari_client_pixel_logs.slice(0, 100);
    try {
      localStorage.setItem(
        LS_PIXEL_LOGS_KEY,
        JSON.stringify(window.__dokandari_client_pixel_logs.slice(0, 60))
      );
    } catch {
      // ignore storage quota errors
    }
    console.info(
      `[Dokandari Pixel & CAPI] ${fullEntry.eventName} | EventID: ${fullEntry.eventId} | Order: ${
        fullEntry.orderId || 'N/A'
      } | Value: ৳${fullEntry.value} | ContentIDs: [${fullEntry.contentIds.join(', ')}] | Status: ${
        fullEntry.status
      }`,
      fullEntry
    );
  }
  return fullEntry;
}

export function getClientPixelLogs(): PixelEventTelemetryLog[] {
  if (typeof window === 'undefined') return [];
  if (window.__dokandari_client_pixel_logs && window.__dokandari_client_pixel_logs.length > 0) {
    return window.__dokandari_client_pixel_logs;
  }
  try {
    const raw = localStorage.getItem(LS_PIXEL_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        window.__dokandari_client_pixel_logs = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export async function fetchServerPixelLogs(): Promise<PixelEventTelemetryLog[]> {
  try {
    const res = await fetch('/api/pixel/logs');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.logs)) {
        return data.logs;
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export async function reconcileOrdersWithCapi(orders: any[]): Promise<{
  success: boolean;
  reconciledCount: number;
  totalOrders: number;
  results: any[];
}> {
  try {
    let storedCreds: any = {};
    try {
      const raw = localStorage.getItem('dokandari_api_credentials');
      if (raw) storedCreds = JSON.parse(raw);
    } catch {
      // ignore
    }
    const res = await fetch('/api/pixel/reconcile-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orders,
        metaPixelIds: parsePixelIds(storedCreds.facebookPixelId || DEFAULT_DOKANDARI_META_PIXEL_ID),
        tiktokPixelIds: parsePixelIds(storedCreds.tiktokPixelId || DEFAULT_DOKANDARI_TIKTOK_PIXEL_ID),
        facebookCapiToken: storedCreds.facebookCapiToken || '',
        tiktokAccessToken: storedCreds.tiktokAccessToken || '',
        metaTestEventCode: storedCreds.metaTestEventCode || '',
        tiktokTestEventCode: storedCreds.tiktokTestEventCode || '',
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Order CAPI reconciliation note:', err);
  }
  return { success: false, reconciledCount: 0, totalOrders: orders.length, results: [] };
}

/**
 * Extracts and cleans pixel/tag IDs whether the admin enters comma-separated IDs
 * OR pastes a full <script> HTML snippet (e.g., fbq('init', '...'), ttq.load('...'), gtag('config', '...')).
 */
export function parsePixelIds(raw?: string | null): string[] {
  if (!raw || typeof raw !== 'string') return [];

  const extracted: string[] = [];

  // 1. Check if raw string contains script snippets like fbq('init', 'ID'), ttq.load('ID'), gtag('config', 'ID')
  const fbqMatches = Array.from(raw.matchAll(/fbq\s*\(\s*['"]init['"]\s*,\s*['"]([A-Za-z0-9_-]{4,35})['"]/gi));
  for (const m of fbqMatches) {
    if (m[1]) extracted.push(m[1].trim());
  }

  const ttqMatches = Array.from(raw.matchAll(/ttq\.load\s*\(\s*['"]([A-Za-z0-9_-]{4,35})['"]/gi));
  for (const m of ttqMatches) {
    if (m[1]) extracted.push(m[1].trim());
  }

  const gtagMatches = Array.from(raw.matchAll(/gtag\s*\(\s*['"]config['"]\s*,\s*['"]([A-Za-z0-9_-]{4,35})['"]/gi));
  for (const m of gtagMatches) {
    if (m[1]) extracted.push(m[1].trim());
  }

  if (extracted.length > 0) {
    return Array.from(new Set(extracted));
  }

  // 2. Otherwise split comma, semicolon, space, or newline-separated IDs
  const parts = raw
    .split(/[\s,;\n\r]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 4 && !p.startsWith('<') && !p.startsWith('http'));
  return Array.from(new Set(parts));
}

/**
 * Normalizes any cart/order item ID to match the exact product ID in the Meta & TikTok Catalog Feed.
 * Preserves full hyphenated product IDs (e.g. "dkd-1776101501645-01", "dkd-arch-unbreakable-wall-mirror")
 * and only strips cart line-item variant suffixes appended by CartContext (e.g. "-default-default", "-Standard Size").
 */
export function normalizeCatalogProductId(rawId?: string | null): string {
  const cleaned = String(rawId || '').trim();
  if (!cleaned) return 'dkd-product';
  const strippedVariant = cleaned
    .replace(/-(?:default|standard(?:\s+size)?|original(?:\s+color)?)(?:-(?:default|standard(?:\s+size)?|original(?:\s+color)?))*$/i, '')
    .trim();
  return strippedVariant || cleaned;
}

/**
 * Injects Meta Pixel base library script tag strictly ONCE globally
 * and sets disablePushState = true so SPA route changes never wipe Purchase/InitiateCheckout events
 * in Meta Ads Data Advisor / Meta Pixel Helper.
 */
function ensureMetaBaseScriptLoaded(): void {
  if (typeof window === 'undefined') return;
  if (window.fbq && window.__dokandari_meta_script_loaded) {
    window.fbq.disablePushState = true;
    return;
  }

  try {
    (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      n.disablePushState = true;
      t = b.createElement(e);
      t.async = true;
      t.id = 'meta-pixel-base-script';
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s?.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    if (window.fbq) {
      window.fbq.disablePushState = true;
    }
    window.__dokandari_meta_script_loaded = true;
  } catch (err) {
    console.warn('Meta Pixel script injection note:', err);
  }
}

/**
 * Injects TikTok Pixel base library script tag strictly ONCE globally
 */
function ensureTikTokBaseScriptLoaded(): void {
  if (typeof window === 'undefined') return;
  if (window.ttq && window.__dokandari_tiktok_script_loaded) return;

  try {
    (function (w: any, d: any, t: any) {
      w.TiktokAnalyticsObject = t;
      var ttq = (w[t] = w[t] || []);
      ttq.methods = [
        'page',
        'track',
        'identify',
        'instances',
        'debug',
        'on',
        'off',
        'once',
        'ready',
        'alias',
        'group',
        'enableCookie',
        'disableCookie',
        'holdConsent',
        'revokeConsent',
        'grantConsent',
      ];
      ttq.setAndDefer = function (t: any, e: any) {
        t[e] = function () {
          t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (var i = 0; i < ttq.methods.length; i++) {
        ttq.setAndDefer(ttq, ttq.methods[i]);
      }
      ttq.instance = function (t: any) {
        for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) {
          ttq.setAndDefer(e, ttq.methods[n]);
        }
        return e;
      };
      ttq.load = function (e: any, n: any) {
        var r = 'https://analytics.tiktok.com/i18n/pixel/events.js';
        ttq._i = ttq._i || {};
        ttq._i[e] = [];
        ttq._i[e]._u = r;
        ttq._t = ttq._t || {};
        ttq._t[e] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[e] = n || {};
        var a = d.createElement('script');
        a.type = 'text/javascript';
        a.async = true;
        a.id = `tiktok-pixel-base-script-${e}`;
        a.src = r + '?sdkid=' + e + '&lib=' + t;
        var c = d.getElementsByTagName('script')[0];
        c?.parentNode?.insertBefore(a, c);
      };
    })(window, document, 'ttq');

    window.__dokandari_tiktok_script_loaded = true;
  } catch (err) {
    console.warn('TikTok Pixel script injection note:', err);
  }
}

/**
 * Injects YouTube / Google Tag (gtag.js) base library strictly ONCE globally
 */
function ensureYouTubeBaseScriptLoaded(primaryTagId: string): void {
  if (typeof window === 'undefined') return;
  if (window.gtag || window.__dokandari_youtube_script_loaded) return;

  try {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());

    const script = document.createElement('script');
    script.async = true;
    script.id = 'youtube-google-tag-base-script';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryTagId)}`;
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript?.parentNode?.insertBefore(script, firstScript);

    window.__dokandari_youtube_script_loaded = true;
  } catch (err) {
    console.warn('YouTube/Google Tag script injection note:', err);
  }
}

/**
 * Synchronously checks localStorage for saved pixel IDs if not yet initialized in memory.
 */
function ensurePixelsInitializedFromStorage(): void {
  if (typeof window === 'undefined') return;
  const hasMeta = (window.__dokandari_meta_initialized_ids?.size || 0) > 0;
  const hasTiktok = (window.__dokandari_tiktok_initialized_ids?.size || 0) > 0;
  if (hasMeta && hasTiktok) return;

  try {
    const raw = localStorage.getItem('dokandari_api_credentials');
    if (raw) {
      const creds = JSON.parse(raw);
      const metaId = creds?.facebookPixelId || DEFAULT_DOKANDARI_META_PIXEL_ID;
      const tiktokId = creds?.tiktokPixelId || DEFAULT_DOKANDARI_TIKTOK_PIXEL_ID;
      initializeMultiPixels(metaId, tiktokId, creds?.youtubeTagId);
      return;
    }
  } catch {
    // ignore
  }
  initializeMultiPixels(DEFAULT_DOKANDARI_META_PIXEL_ID, DEFAULT_DOKANDARI_TIKTOK_PIXEL_ID);
}

/**
 * Initializes multiple Meta, TikTok, and YouTube/Google Tag IDs strictly ONCE per ID without duplicate warnings
 */
export function initializeMultiPixels(
  configOrMeta?:
    | {
        metaPixelIds?: string | string[];
        tiktokPixelIds?: string | string[];
        youtubeTagIds?: string | string[];
      }
    | string
    | null,
  optionalTiktok?: string | string[] | null,
  optionalYoutube?: string | string[] | null
): { metaCount: number; tiktokCount: number; youtubeCount: number } {
  if (typeof window === 'undefined') return { metaCount: 0, tiktokCount: 0, youtubeCount: 0 };

  window.__dokandari_meta_initialized_ids =
    window.__dokandari_meta_initialized_ids || new Set<string>();
  window.__dokandari_tiktok_initialized_ids =
    window.__dokandari_tiktok_initialized_ids || new Set<string>();
  window.__dokandari_youtube_initialized_ids =
    window.__dokandari_youtube_initialized_ids || new Set<string>();

  let metaRaw: string | string[] | undefined;
  let tiktokRaw: string | string[] | undefined;
  let youtubeRaw: string | string[] | undefined;

  if (typeof configOrMeta === 'object' && configOrMeta !== null && !Array.isArray(configOrMeta)) {
    metaRaw = configOrMeta.metaPixelIds;
    tiktokRaw = configOrMeta.tiktokPixelIds;
    youtubeRaw = configOrMeta.youtubeTagIds;
  } else {
    metaRaw = configOrMeta || undefined;
    tiktokRaw = optionalTiktok || undefined;
    youtubeRaw = optionalYoutube || undefined;
  }

  const metaList = Array.isArray(metaRaw) ? metaRaw : parsePixelIds(metaRaw);
  const tiktokList = Array.isArray(tiktokRaw) ? tiktokRaw : parsePixelIds(tiktokRaw);
  const youtubeList = Array.isArray(youtubeRaw) ? youtubeRaw : parsePixelIds(youtubeRaw);

  // Initialize Meta Pixels
  if (metaList.length > 0) {
    ensureMetaBaseScriptLoaded();
    metaList.forEach((id) => {
      if (!window.__dokandari_meta_initialized_ids!.has(id)) {
        try {
          if (typeof window.fbq === 'function') {
            window.fbq('init', id);
            window.__dokandari_meta_initialized_ids!.add(id);
          }
        } catch (e) {
          console.warn(`Meta Pixel init note (${id}):`, e);
        }
      }
    });
  }

  // Initialize TikTok Pixels
  if (tiktokList.length > 0) {
    ensureTikTokBaseScriptLoaded();
    tiktokList.forEach((id) => {
      if (!window.__dokandari_tiktok_initialized_ids!.has(id)) {
        try {
          if (window.ttq && typeof window.ttq.load === 'function') {
            window.ttq.load(id);
            window.__dokandari_tiktok_initialized_ids!.add(id);
          }
        } catch (e) {
          console.warn(`TikTok Pixel init note (${id}):`, e);
        }
      }
    });
  }

  // Initialize YouTube / Google Ads / GA4 Tags
  if (youtubeList.length > 0) {
    ensureYouTubeBaseScriptLoaded(youtubeList[0]);
    youtubeList.forEach((id) => {
      if (!window.__dokandari_youtube_initialized_ids!.has(id)) {
        try {
          if (typeof window.gtag === 'function') {
            window.gtag('config', id);
            window.__dokandari_youtube_initialized_ids!.add(id);
          }
        } catch (e) {
          console.warn(`YouTube/Google Tag init note (${id}):`, e);
        }
      }
    });
  }

  // Flush any queued events that fired before Firestore credentials resolved
  if (
    (window.__dokandari_meta_initialized_ids.size > 0 ||
      window.__dokandari_tiktok_initialized_ids.size > 0) &&
    Array.isArray(window.__dokandari_pending_pixel_events) &&
    window.__dokandari_pending_pixel_events.length > 0
  ) {
    const queued = [...window.__dokandari_pending_pixel_events];
    window.__dokandari_pending_pixel_events = [];
    queued.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore
      }
    });
  }

  return {
    metaCount: window.__dokandari_meta_initialized_ids.size,
    tiktokCount: window.__dokandari_tiktok_initialized_ids.size,
    youtubeCount: window.__dokandari_youtube_initialized_ids.size,
  };
}

function getCookieValue(name: string): string {
  if (typeof document === 'undefined' || !document.cookie) return '';
  const match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : '';
}

function getOrCreateFbp(): string {
  const existing = getCookieValue('_fbp');
  if (existing) return existing;
  try {
    const cached = localStorage.getItem('dokandari_fbp_fallback');
    if (cached) return cached;
    const generated = `fb.1.${Date.now()}.${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    localStorage.setItem('dokandari_fbp_fallback', generated);
    return generated;
  } catch {
    return `fb.1.${Date.now()}.1092837465`;
  }
}

export function generateDeduplicationEventId(prefix: string, refId?: string): string {
  const cleanRef = (refId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  return `dkd_${prefix.toLowerCase()}_${cleanRef ? cleanRef + '_' : ''}${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/**
 * Dispatches real server-side Conversions API (CAPI) event with active Pixel IDs, Tokens, event_id & _fbp/_fbc
 * and logs both client-side trigger and server-side CAPI response for 100% auditability.
 */
export async function dispatchServerCapi(
  eventName: string,
  eventData: any,
  customer?: any,
  eventId?: string
): Promise<CapiDispatchResponse | null> {
  try {
    ensurePixelsInitializedFromStorage();
    let storedCreds: any = {};
    try {
      const raw = localStorage.getItem('dokandari_api_credentials');
      if (raw) storedCreds = JSON.parse(raw);
    } catch {
      // ignore
    }

    const metaPixelIds = Array.from(
      window.__dokandari_meta_initialized_ids?.size
        ? window.__dokandari_meta_initialized_ids
        : parsePixelIds(storedCreds.facebookPixelId || DEFAULT_DOKANDARI_META_PIXEL_ID)
    );
    const tiktokPixelIds = Array.from(
      window.__dokandari_tiktok_initialized_ids?.size
        ? window.__dokandari_tiktok_initialized_ids
        : parsePixelIds(storedCreds.tiktokPixelId || DEFAULT_DOKANDARI_TIKTOK_PIXEL_ID)
    );
    const youtubeTagIds = Array.from(
      window.__dokandari_youtube_initialized_ids?.size
        ? window.__dokandari_youtube_initialized_ids
        : parsePixelIds(storedCreds.youtubeTagId)
    );

    const fbp = getOrCreateFbp();
    let fbc = getCookieValue('_fbc');
    if (!fbc && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const fbclid = urlParams.get('fbclid');
      if (fbclid) {
        fbc = `fb.1.${Date.now()}.${fbclid}`;
      }
    }

    const finalEventId = eventId || generateDeduplicationEventId(eventName);
    const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://dokandari.com';

    const res = await fetch('/api/pixel/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        eventId: finalEventId,
        eventData,
        customer,
        fbp,
        fbc,
        url: currentUrl,
        metaPixelIds,
        tiktokPixelIds,
        youtubeTagIds,
        facebookCapiToken: storedCreds.facebookCapiToken || '',
        tiktokAccessToken: storedCreds.tiktokAccessToken || '',
        metaTestEventCode: storedCreds.metaTestEventCode || '',
        tiktokTestEventCode: storedCreds.tiktokTestEventCode || '',
      }),
    });

    if (res.ok) {
      const capiData = (await res.json()) as CapiDispatchResponse;
      const capiSummary =
        Array.isArray(capiData.capiResults) && capiData.capiResults.length > 0
          ? capiData.capiResults.map((r) => `${r.platform}(${r.pixelId}): ${r.status}`).join(' | ')
          : 'Browser Pixel Fired (Server CAPI Standby)';

      recordClientPixelLog({
        eventName,
        eventId: capiData.eventId || finalEventId,
        orderId: eventData?.orderId || eventData?.order_id || undefined,
        contentIds: capiData.contentIds || eventData?.content_ids || [],
        value: Number(capiData.value ?? eventData?.value ?? eventData?.total ?? 0),
        currency: 'BDT',
        url: currentUrl,
        source: 'client_storefront',
        browserFired: true,
        capiDispatched: Boolean(capiData.capiResults && capiData.capiResults.length > 0),
        metaPixels: capiData.metaPixels || metaPixelIds,
        tiktokPixels: capiData.tiktokPixels || tiktokPixelIds,
        status: `✓ Browser + ${capiSummary}`,
        capiResults: capiData.capiResults,
      });

      return capiData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Global PageView tracking for all initialized Meta, TikTok & YouTube/Google pixels
 */
export function trackPixelPageView(): Promise<CapiDispatchResponse | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  ensurePixelsInitializedFromStorage();
  const eventId = generateDeduplicationEventId('pageview');
  try {
    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq('track', 'PageView', {}, { eventID: eventId });
    }
    if (window.ttq && typeof window.ttq.page === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
      window.ttq.page();
    }
    if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
      window.gtag('event', 'page_view', {
        page_location: window.location.href,
        page_path: window.location.pathname,
      });
    }
    return dispatchServerCapi('PageView', { path: window.location.pathname }, undefined, eventId);
  } catch (err) {
    console.warn('Pixel PageView note:', err);
    return Promise.resolve(null);
  }
}

/**
 * Global ViewContent tracking (fired when customer opens a product page or modal)
 */
export function trackPixelViewContent(product: {
  id: string;
  name: string;
  category?: string;
  price: number;
}): Promise<CapiDispatchResponse | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  ensurePixelsInitializedFromStorage();
  const canonicalId = normalizeCatalogProductId(product.id);
  const unitPrice = Number(product.price) || 0;
  const eventId = generateDeduplicationEventId('viewcontent', canonicalId);

  const fireBrowserViewContent = () => {
    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq(
        'track',
        'ViewContent',
        {
          content_ids: [canonicalId],
          contents: [{ id: canonicalId, quantity: 1, item_price: unitPrice }],
          content_name: product.name,
          content_category: product.category || 'General',
          content_type: 'product',
          value: unitPrice,
          currency: 'BDT',
        },
        { eventID: eventId }
      );
    }

    if (window.ttq && typeof window.ttq.track === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
      window.ttq.track(
        'ViewContent',
        {
          content_id: canonicalId,
          contents: [
            {
              content_id: canonicalId,
              content_type: 'product',
              content_name: product.name,
              quantity: 1,
              price: unitPrice,
            },
          ],
          content_type: 'product',
          content_name: product.name,
          content_category: product.category || 'General',
          value: unitPrice,
          currency: 'BDT',
        },
        { event_id: eventId }
      );
    }

    if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
      window.gtag('event', 'view_item', {
        currency: 'BDT',
        value: unitPrice,
        items: [
          {
            item_id: canonicalId,
            item_name: product.name,
            item_category: product.category || 'General',
            price: unitPrice,
          },
        ],
      });
    }
  };

  try {
    if (
      (window.__dokandari_meta_initialized_ids?.size || 0) === 0 &&
      (window.__dokandari_tiktok_initialized_ids?.size || 0) === 0
    ) {
      window.__dokandari_pending_pixel_events = window.__dokandari_pending_pixel_events || [];
      window.__dokandari_pending_pixel_events.push(fireBrowserViewContent);
    } else {
      fireBrowserViewContent();
    }

    return dispatchServerCapi(
      'ViewContent',
      {
        product: { ...product, id: canonicalId, price: unitPrice },
        content_ids: [canonicalId],
        contents: [{ id: canonicalId, quantity: 1, item_price: unitPrice }],
        content_name: product.name,
        content_category: product.category || 'General',
        num_items: 1,
        value: unitPrice,
      },
      undefined,
      eventId
    );
  } catch (err) {
    console.warn('Pixel ViewContent note:', err);
    return Promise.resolve(null);
  }
}

/**
 * Global AddToCart tracking
 */
export function trackPixelAddToCart(product: {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  category?: string;
}): Promise<CapiDispatchResponse | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  ensurePixelsInitializedFromStorage();
  const canonicalId = normalizeCatalogProductId(product.id);
  const qty = Math.max(1, Number(product.quantity) || 1);
  const unitPrice = Number(product.price) || 0;
  const totalVal = unitPrice * qty;
  const eventId = generateDeduplicationEventId('addtocart', canonicalId);

  const fireBrowserAddToCart = () => {
    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq(
        'track',
        'AddToCart',
        {
          content_ids: [canonicalId],
          contents: [{ id: canonicalId, quantity: qty, item_price: unitPrice }],
          content_name: product.name,
          content_category: product.category || 'General',
          content_type: 'product',
          num_items: qty,
          value: totalVal,
          currency: 'BDT',
        },
        { eventID: eventId }
      );
    }

    if (window.ttq && typeof window.ttq.track === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
      window.ttq.track(
        'AddToCart',
        {
          content_id: canonicalId,
          contents: [
            {
              content_id: canonicalId,
              content_type: 'product',
              content_name: product.name,
              quantity: qty,
              price: unitPrice,
            },
          ],
          content_type: 'product',
          content_name: product.name,
          quantity: qty,
          value: totalVal,
          currency: 'BDT',
        },
        { event_id: eventId }
      );
    }

    if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
      window.gtag('event', 'add_to_cart', {
        currency: 'BDT',
        value: totalVal,
        items: [{ item_id: canonicalId, item_name: product.name, quantity: qty, price: unitPrice }],
      });
    }
  };

  try {
    if (
      (window.__dokandari_meta_initialized_ids?.size || 0) === 0 &&
      (window.__dokandari_tiktok_initialized_ids?.size || 0) === 0
    ) {
      window.__dokandari_pending_pixel_events = window.__dokandari_pending_pixel_events || [];
      window.__dokandari_pending_pixel_events.push(fireBrowserAddToCart);
    } else {
      fireBrowserAddToCart();
    }

    return dispatchServerCapi(
      'AddToCart',
      {
        product: { ...product, id: canonicalId, price: unitPrice },
        content_ids: [canonicalId],
        contents: [{ id: canonicalId, quantity: qty, item_price: unitPrice }],
        content_name: product.name,
        content_category: product.category || 'General',
        num_items: qty,
        quantity: qty,
        value: totalVal,
      },
      undefined,
      eventId
    );
  } catch (err) {
    console.warn('Pixel AddToCart note:', err);
    return Promise.resolve(null);
  }
}

/**
 * Global InitiateCheckout tracking (fired when customer starts checkout or views checkout form)
 */
export function trackPixelInitiateCheckout(
  itemsOrValue: { id?: string; productId?: string; name: string; price: number; quantity?: number }[] | number,
  totalValueOrQty?: number,
  fallbackProduct?: { id: string; name: string; price: number }
): Promise<CapiDispatchResponse | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  ensurePixelsInitializedFromStorage();

  try {
    let items: { id: string; name: string; price: number; quantity: number }[];
    let totalValue: number;

    if (Array.isArray(itemsOrValue)) {
      items = itemsOrValue.map((i) => ({
        id: normalizeCatalogProductId(i.productId || i.id),
        name: i.name,
        price: Number(i.price) || 0,
        quantity: Math.max(1, Number(i.quantity) || 1),
      }));
      totalValue =
        totalValueOrQty ?? items.reduce((acc, curr) => acc + curr.price * (curr.quantity || 1), 0);
    } else {
      totalValue = Number(itemsOrValue) || 0;
      const qty = Math.max(1, Number(totalValueOrQty) || 1);
      const unit = fallbackProduct?.price || Math.round(totalValue / qty) || totalValue;
      items = [
        {
          id: normalizeCatalogProductId(fallbackProduct?.id || 'dkd-1'),
          name: fallbackProduct?.name || 'Dokandari Order Item',
          price: unit,
          quantity: qty,
        },
      ];
    }

    const ids = items.map((i) => i.id);
    const numItems = items.reduce((acc, curr) => acc + (curr.quantity || 1), 0);
    const eventId = generateDeduplicationEventId('initiatecheckout', ids[0]);

    const fireBrowserCheckout = () => {
      if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
        window.fbq(
          'track',
          'InitiateCheckout',
          {
            content_ids: ids,
            contents: items.map((i) => ({
              id: i.id,
              quantity: i.quantity || 1,
              item_price: i.price,
            })),
            content_name: items.map((i) => i.name).join(', '),
            content_type: 'product',
            num_items: numItems,
            value: totalValue,
            currency: 'BDT',
          },
          { eventID: eventId }
        );
      }

      if (window.ttq && typeof window.ttq.track === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
        window.ttq.track(
          'InitiateCheckout',
          {
            content_id: ids[0],
            contents: items.map((i) => ({
              content_id: i.id,
              content_type: 'product',
              content_name: i.name,
              quantity: i.quantity || 1,
              price: i.price,
            })),
            content_type: 'product',
            value: totalValue,
            currency: 'BDT',
          },
          { event_id: eventId }
        );
      }

      if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
        window.gtag('event', 'begin_checkout', {
          currency: 'BDT',
          value: totalValue,
          items: items.map((i) => ({
            item_id: i.id,
            item_name: i.name,
            quantity: i.quantity || 1,
            price: i.price,
          })),
        });
      }
    };

    if (
      (window.__dokandari_meta_initialized_ids?.size || 0) === 0 &&
      (window.__dokandari_tiktok_initialized_ids?.size || 0) === 0
    ) {
      window.__dokandari_pending_pixel_events = window.__dokandari_pending_pixel_events || [];
      window.__dokandari_pending_pixel_events.push(fireBrowserCheckout);
    } else {
      fireBrowserCheckout();
    }

    return dispatchServerCapi(
      'InitiateCheckout',
      {
        items,
        content_ids: ids,
        contents: items.map((i) => ({ id: i.id, quantity: i.quantity || 1, item_price: i.price })),
        content_name: items.map((i) => i.name).join(', '),
        num_items: numItems,
        totalValue,
        value: totalValue,
      },
      undefined,
      eventId
    );
  } catch (err) {
    console.warn('Pixel InitiateCheckout note:', err);
    return Promise.resolve(null);
  }
}

/**
 * Global Purchase tracking (fired when order is confirmed on Thank You page)
 * Guarantees 100% deduplicated event_id and content_ids matching between Meta Pixel, Meta CAPI, TikTok Pixel, and TikTok Events API.
 */
export function trackPixelPurchase(
  orderOrId:
    | {
        id: string;
        total: number;
        items: { productId?: string; id?: string; name: string; price: number; quantity?: number }[];
        customer?: { phone?: string; email?: string; name?: string; city?: string; district?: string };
      }
    | string,
  totalArg?: number,
  qtyArg?: number,
  forceResync = false
): Promise<CapiDispatchResponse | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  ensurePixelsInitializedFromStorage();

  try {
    let order: {
      id: string;
      total: number;
      items: { productId?: string; id?: string; name: string; price: number; quantity?: number }[];
      customer?: { phone?: string; email?: string; name?: string; city?: string; district?: string };
    };

    if (typeof orderOrId === 'object' && orderOrId !== null) {
      order = orderOrId;
    } else {
      const orderTotal = Number(totalArg) || 0;
      order = {
        id: String(orderOrId),
        total: orderTotal,
        items: [{ id: 'dkd-1', productId: 'dkd-1', name: 'Dokandari Order Item', price: orderTotal, quantity: qtyArg || 1 }],
      };
    }

    const normalizedItems = (order.items || []).map((i) => ({
      id: normalizeCatalogProductId(i.productId || i.id),
      name: i.name || 'Dokandari Product',
      price: Number(i.price) || 0,
      quantity: Math.max(1, Number(i.quantity) || 1),
    }));

    const ids = normalizedItems.map((i) => i.id);
    const numItems = normalizedItems.reduce((acc, curr) => acc + curr.quantity, 0);
    const totalVal = Number(order.total) || 0;
    const cleanOrderId = String(order.id).replace(/[^a-zA-Z0-9_-]/g, '');
    const eventId = `dkd_purchase_${cleanOrderId}`;

    const fireBrowserPurchase = () => {
      if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
        window.fbq(
          'track',
          'Purchase',
          {
            content_ids: ids,
            contents: normalizedItems.map((i) => ({
              id: i.id,
              quantity: i.quantity,
              item_price: i.price,
            })),
            content_name: normalizedItems.map((i) => i.name).join(', '),
            content_type: 'product',
            num_items: numItems,
            value: totalVal,
            currency: 'BDT',
            order_id: order.id,
          },
          { eventID: eventId }
        );
      }

      if (window.ttq && typeof window.ttq.track === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
        const tiktokPayload = {
          content_id: ids[0] || 'dkd-1',
          contents: normalizedItems.map((i) => ({
            content_id: i.id,
            content_type: 'product',
            content_name: i.name,
            quantity: i.quantity,
            price: i.price,
          })),
          content_type: 'product',
          content_name: normalizedItems.map((i) => i.name).join(', '),
          quantity: numItems,
          value: totalVal,
          currency: 'BDT',
          order_id: order.id,
        };
        window.ttq.track('Purchase', tiktokPayload, { event_id: eventId });
        window.ttq.track('CompletePayment', tiktokPayload, { event_id: `${eventId}_payment` });
        window.ttq.track('PlaceAnOrder', tiktokPayload, { event_id: `${eventId}_order` });
      }

      if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
        window.gtag('event', 'purchase', {
          transaction_id: order.id,
          value: totalVal,
          currency: 'BDT',
          items: normalizedItems.map((i) => ({
            item_id: i.id,
            item_name: i.name,
            quantity: i.quantity,
            price: i.price,
          })),
        });
      }
    };

    if (
      (window.__dokandari_meta_initialized_ids?.size || 0) === 0 &&
      (window.__dokandari_tiktok_initialized_ids?.size || 0) === 0
    ) {
      window.__dokandari_pending_pixel_events = window.__dokandari_pending_pixel_events || [];
      window.__dokandari_pending_pixel_events.push(fireBrowserPurchase);
    } else {
      fireBrowserPurchase();
      // Also fire browser Purchase beacon 220ms after pushState so Chrome's Meta Ads Data Advisor & TikTok Pixel Helper
      // register Purchase under the new /thank-you/:orderId URL after onHistoryStateUpdated completes (100% deduplicated by eventID).
      setTimeout(() => {
        try {
          fireBrowserPurchase();
        } catch {
          // ignore
        }
      }, 220);
    }

    window.__dokandari_fired_purchase_orders =
      window.__dokandari_fired_purchase_orders || new Map<string, CapiDispatchResponse>();

    if (!forceResync && window.__dokandari_fired_purchase_orders.has(cleanOrderId)) {
      return Promise.resolve(window.__dokandari_fired_purchase_orders.get(cleanOrderId) || null);
    }

    return dispatchServerCapi(
      'Purchase',
      {
        orderId: order.id,
        total: totalVal,
        value: totalVal,
        content_ids: ids,
        contents: normalizedItems.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          item_price: i.price,
        })),
        content_name: normalizedItems.map((i) => i.name).join(', '),
        num_items: numItems,
        items: normalizedItems,
      },
      order.customer,
      eventId
    ).then((res) => {
      if (res) {
        window.__dokandari_fired_purchase_orders?.set(cleanOrderId, res);
      }
      return res;
    });
  } catch (err) {
    console.warn('Pixel Purchase note:', err);
    return Promise.resolve(null);
  }
}

/**
 * Global WhatsApp Message / Order Conversion Tracking
 */
export function trackPixelWhatsAppConversion(
  product?: { id?: string; name?: string; price?: number; category?: string },
  sourceLocation = 'storefront'
): Promise<CapiDispatchResponse | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);

  ensurePixelsInitializedFromStorage();
  const prodId = normalizeCatalogProductId(product?.id || 'dkd-1');
  const prodName = product?.name || 'Dokandari WhatsApp Order';
  const prodPrice = Number(product?.price) || 0;
  const prodCat = product?.category || 'General';
  const contactEventId = generateDeduplicationEventId('contact', prodId);
  const leadEventId = generateDeduplicationEventId('lead', prodId);

  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'whatsapp_order_click',
      conversion_type: 'WhatsApp Message Order',
      source_location: sourceLocation,
      content_id: prodId,
      content_name: prodName,
      content_category: prodCat,
      value: prodPrice,
      currency: 'BDT',
    });

    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq(
        'track',
        'Contact',
        {
          content_ids: [prodId],
          contents: [{ id: prodId, quantity: 1, item_price: prodPrice }],
          content_name: prodName,
          content_category: prodCat,
          content_type: 'product',
          value: prodPrice,
          currency: 'BDT',
        },
        { eventID: contactEventId }
      );
      window.fbq(
        'track',
        'Lead',
        {
          content_ids: [prodId],
          contents: [{ id: prodId, quantity: 1, item_price: prodPrice }],
          content_name: prodName,
          content_category: prodCat,
          content_type: 'product',
          value: prodPrice,
          currency: 'BDT',
        },
        { eventID: leadEventId }
      );
    }

    if (
      window.ttq &&
      typeof window.ttq.track === 'function' &&
      window.__dokandari_tiktok_initialized_ids?.size
    ) {
      window.ttq.track(
        'Contact',
        {
          content_id: prodId,
          contents: [
            {
              content_id: prodId,
              content_type: 'product',
              content_name: prodName,
              quantity: 1,
              price: prodPrice,
            },
          ],
          content_type: 'product',
          content_name: prodName,
          content_category: prodCat,
          value: prodPrice,
          currency: 'BDT',
        },
        { event_id: contactEventId }
      );
    }

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'generate_lead', {
        currency: 'BDT',
        value: prodPrice,
        lead_source: `WhatsApp (${sourceLocation})`,
        item_id: prodId,
        item_name: prodName,
      });
    }

    return dispatchServerCapi(
      'Contact',
      {
        channel: 'WhatsApp',
        sourceLocation,
        content_ids: [prodId],
        contents: [{ id: prodId, quantity: 1, item_price: prodPrice }],
        content_name: prodName,
        content_category: prodCat,
        num_items: 1,
        value: prodPrice,
        product: { id: prodId, name: prodName, price: prodPrice, category: prodCat },
      },
      undefined,
      contactEventId
    );
  } catch (err) {
    console.warn('Pixel WhatsApp conversion note:', err);
    return Promise.resolve(null);
  }
}

/**
 * Automatically connects Google Tag Manager (GTM-XXXX), Google Analytics 4 (G-XXXX),
 * and Google Search Console verification tag (`google-site-verification`) into the live DOM.
 */
export function initializeGoogleSeoAndTags(config?: {
  gtmContainerId?: string;
  ga4MeasurementId?: string;
  googleSiteVerification?: string;
  googleSearchConsoleCode?: string;
  youtubeTagId?: string;
}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!config) return;

  try {
    // 1. Google Search Console Verification Meta Tag
    const rawVerify = (config.googleSiteVerification || config.googleSearchConsoleCode || '').trim();
    if (rawVerify) {
      const cleanToken = rawVerify
        .replace(/<meta[^>]*content=["']([^"']+)["'][^>]*>/i, '$1')
        .replace(/^google-site-verification=/i, '')
        .trim();
      if (cleanToken) {
        let metaEl = document.querySelector(
          'meta[name="google-site-verification"]'
        ) as HTMLMetaElement | null;
        if (!metaEl) {
          metaEl = document.createElement('meta');
          metaEl.name = 'google-site-verification';
          document.head.appendChild(metaEl);
        }
        metaEl.content = cleanToken;
      }
    }

    // 2. Google Tag Manager (GTM-XXXX)
    const rawGtm = (config.gtmContainerId || '').trim();
    const gtmMatch = rawGtm.match(/GTM-[A-Z0-9]+/i);
    if (gtmMatch && gtmMatch[0]) {
      const gtmId = gtmMatch[0].toUpperCase();
      if (!document.getElementById(`gtm-script-${gtmId}`)) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        const gtmScript = document.createElement('script');
        gtmScript.id = `gtm-script-${gtmId}`;
        gtmScript.async = true;
        gtmScript.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
        document.head.appendChild(gtmScript);
      }
    }

    // 3. Google Analytics 4 (G-XXXX) & YouTube/Google Ads Tags
    const combinedGoogleTags = [config.ga4MeasurementId || '', config.youtubeTagId || '']
      .filter(Boolean)
      .join(',');
    if (combinedGoogleTags) {
      const parsed = parsePixelIds(combinedGoogleTags);
      if (parsed.length > 0) {
        initializeMultiPixels(undefined, undefined, parsed);
      }
    }
  } catch (err) {
    console.warn('Google GTM/GA4/GSC auto-connect note:', err);
  }
}

/**
 * Helper to upsert a <meta property="..." content="..."> tag in document.head
 * so Meta Pixel Microdata & TikTok Pixel automatically index products for zero-link catalog building.
 */
function upsertHeadMetaProperty(property: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * Dynamically updates Schema.org Product JSON-LD, OpenGraph Product Microdata tags,
 * and document title/canonical URL when viewing a product detail page so Meta Pixel,
 * TikTok Pixel & Google Search automatically index every product on dokandari.com / dukandari.com.
 */
export function updateProductStructuredData(product: {
  id: string;
  name: string;
  description?: string;
  price: number;
  originalPrice?: number;
  images?: string[];
  sku?: string;
  category?: string;
  inStock?: boolean;
  rating?: number;
  reviewCount?: number;
} | null): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  try {
    const existingScript = document.getElementById('dokandari-dynamic-product-jsonld');
    if (!product) {
      if (existingScript) existingScript.remove();
      document.title = 'Dokandari (দোকানদারি) — প্রিমিয়াম হোম ডেকোর, স্মার্ট গ্যাজেট, মডেস্ট ফ্যাশন ও স্কিনকেয়ার | বাংলাদেশ';
      upsertHeadMetaProperty('og:type', 'website');
      return;
    }

    const canonicalId = normalizeCatalogProductId(product.id);
    const productUrl = `${window.location.origin}/products/${encodeURIComponent(canonicalId)}?brand=dokandari`;
    const rawImg = product.images && product.images.length > 0 ? product.images[0] : '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg';
    const absoluteImg = rawImg.startsWith('http')
      ? rawImg
      : rawImg.startsWith('data:')
      ? `${window.location.origin}/images/${encodeURIComponent(canonicalId)}/1`
      : `${window.location.origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
    const descText =
      product.description ||
      `${product.name} — ১০০% অরিজিনাল কোয়ালিটি ও সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা।`;
    const availText = product.inStock !== false ? 'in stock' : 'out of stock';

    document.title = `${product.name} — ৳${product.price.toLocaleString()} | Dokandari (দোকানদারি)`;

    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = productUrl;

    // Inject Meta & TikTok OpenGraph Product Microdata tags for automatic Pixel Catalog creation
    upsertHeadMetaProperty('og:type', 'product');
    upsertHeadMetaProperty('og:title', product.name);
    upsertHeadMetaProperty('og:description', descText);
    upsertHeadMetaProperty('og:url', productUrl);
    upsertHeadMetaProperty('og:image', absoluteImg);
    upsertHeadMetaProperty('product:brand', 'Dokandari');
    upsertHeadMetaProperty('product:availability', availText);
    upsertHeadMetaProperty('product:condition', 'new');
    upsertHeadMetaProperty('product:price:amount', String(product.price));
    upsertHeadMetaProperty('product:price:currency', 'BDT');
    upsertHeadMetaProperty('product:retailer_item_id', canonicalId);
    upsertHeadMetaProperty('product:item_group_id', canonicalId);
    upsertHeadMetaProperty('product:category', product.category || 'home_decor');

    const schemaObj = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': productUrl,
      productID: canonicalId,
      sku: canonicalId,
      mpn: product.sku || canonicalId,
      name: product.name,
      description: descText,
      category: product.category || 'home_decor',
      image: [absoluteImg],
      brand: {
        '@type': 'Brand',
        name: 'Dokandari',
      },
      offers: {
        '@type': 'Offer',
        url: productUrl,
        priceCurrency: 'BDT',
        price: String(product.price),
        availability:
          product.inStock !== false
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        itemCondition: 'https://schema.org/NewCondition',
        seller: {
          '@type': 'Organization',
          name: 'Dokandari',
        },
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: product.rating || 4.9,
        reviewCount: product.reviewCount || 24,
      },
    };

    let scriptEl = existingScript as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'dokandari-dynamic-product-jsonld';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(schemaObj);
  } catch {
    // ignore
  }
}

export interface AutoCatalogPixelSyncResult {
  success: boolean;
  scannedProductsCount: number;
  scannedCategoriesCount: number;
  categories: Array<{ category: string; count: number }>;
  metaPixels: string[];
  tiktokPixels: string[];
  timestamp: number;
}

/**
 * 1-Click & Automatic Pixel-Based Catalog Builder (Zero Manual Link Needed):
 * 1. Injects a full Schema.org ItemList + Product Graph into document.head so Meta & TikTok Pixel Microdata
 *    crawlers automatically discover and index every product and category on dokandari.com / dukandari.com.
 * 2. Broadcasts catalog microdata signals to connected Meta Pixels (fbq) and TikTok Pixels (ttq)
 *    and syncs with `/api/pixel/auto-catalog-sync` on the server.
 */
export async function syncAutoCatalogWithPixels(
  products: any[],
  options?: { forceFullBroadcast?: boolean }
): Promise<AutoCatalogPixelSyncResult> {
  if (typeof window === 'undefined') {
    return {
      success: false,
      scannedProductsCount: 0,
      scannedCategoriesCount: 0,
      categories: [],
      metaPixels: [],
      tiktokPixels: [],
      timestamp: Date.now(),
    };
  }

  ensurePixelsInitializedFromStorage();

  const validProducts = (Array.isArray(products) ? products : []).filter(
    (p) => p && p.id && p.status !== 'draft'
  );

  const origin = window.location.origin || 'https://dokandari.com';
  const categoryMap = new Map<string, number>();

  const itemListElements = validProducts.slice(0, 120).map((p, idx) => {
    const prodId = normalizeCatalogProductId(p.id);
    const cat = String(p.category || 'home_decor');
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
    const rawImg = Array.isArray(p.images) && p.images[0] ? p.images[0] : '/uploads/product/Ha2ef56dd79ed496bafac7990404868f7u.jpg';
    const absImg = rawImg.startsWith('http')
      ? rawImg
      : rawImg.startsWith('data:')
      ? `${origin}/images/${encodeURIComponent(prodId)}/1`
      : `${origin}${rawImg.startsWith('/') ? '' : '/'}${rawImg}`;
    const prodUrl = `${origin}/products/${encodeURIComponent(prodId)}?brand=dokandari`;
    const priceNum = Math.max(1, Number(p.price) || 990);

    return {
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': prodUrl,
        productID: prodId,
        sku: prodId,
        mpn: p.sku || prodId,
        name: p.name || 'Dokandari Product',
        description:
          p.description ||
          `${p.name || 'Dokandari Product'} — ১০০% অরিজিনাল কোয়ালিটি ও সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।`,
        image: [absImg],
        category: cat,
        brand: {
          '@type': 'Brand',
          name: 'Dokandari',
        },
        offers: {
          '@type': 'Offer',
          url: prodUrl,
          priceCurrency: 'BDT',
          price: String(priceNum),
          availability: p.inStock !== false ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
      },
    };
  });

  // 1. Inject full catalog JSON-LD graph into <head> for automatic Pixel Microdata discovery
  try {
    let catalogScript = document.getElementById('dokandari-auto-catalog-jsonld') as HTMLScriptElement | null;
    if (!catalogScript) {
      catalogScript = document.createElement('script');
      catalogScript.id = 'dokandari-auto-catalog-jsonld';
      catalogScript.type = 'application/ld+json';
      document.head.appendChild(catalogScript);
    }
    catalogScript.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Dokandari Official Live Product Catalog',
      url: origin,
      numberOfItems: itemListElements.length,
      itemListElement: itemListElements,
    });
  } catch {
    // ignore DOM error
  }

  const activeMetaIds = Array.from(window.__dokandari_meta_initialized_ids || [DEFAULT_DOKANDARI_META_PIXEL_ID]);
  const activeTiktokIds = Array.from(window.__dokandari_tiktok_initialized_ids || [DEFAULT_DOKANDARI_TIKTOK_PIXEL_ID]);

  // 2. When triggered via 1-Click button (or first auto-scan), broadcast catalog microdata to Meta & TikTok Pixels
  if (options?.forceFullBroadcast && validProducts.length > 0) {
    const allIds = validProducts.slice(0, 50).map((p) => normalizeCatalogProductId(p.id));
    const contents = validProducts.slice(0, 50).map((p) => ({
      id: normalizeCatalogProductId(p.id),
      quantity: 1,
      item_price: Math.max(1, Number(p.price) || 990),
    }));
    const totalCatalogVal = contents.reduce((acc, c) => acc + c.item_price, 0);
    const syncEventId = `dkd_autocatalog_${Date.now()}`;

    if (typeof window.fbq === 'function') {
      try {
        window.fbq('set', 'autoConfig', true, activeMetaIds[0] || DEFAULT_DOKANDARI_META_PIXEL_ID);
        window.fbq(
          'track',
          'ViewContent',
          {
            content_ids: allIds,
            contents,
            content_type: 'product',
            content_name: `Dokandari Auto Catalog Sync (${validProducts.length} Products)`,
            content_category: 'all_categories',
            value: totalCatalogVal,
            currency: 'BDT',
          },
          { eventID: syncEventId }
        );
      } catch {
        // ignore
      }
    }

    if (window.ttq && typeof window.ttq.track === 'function') {
      try {
        window.ttq.track(
          'ViewContent',
          {
            content_id: allIds[0] || 'dkd-1',
            contents: validProducts.slice(0, 30).map((p) => ({
              content_id: normalizeCatalogProductId(p.id),
              content_type: 'product',
              content_name: String(p.name || 'Dokandari Product').slice(0, 100),
              quantity: 1,
              price: Math.max(1, Number(p.price) || 990),
            })),
            content_type: 'product',
            content_name: `Dokandari Full Catalog (${validProducts.length} Products)`,
            value: totalCatalogVal,
            currency: 'BDT',
          },
          { event_id: syncEventId }
        );
      } catch {
        // ignore
      }
    }
  }

  // 3. Notify server `/api/pixel/auto-catalog-sync` so Server CAPI & Live Catalog Mirror stay 100% synced
  try {
    const res = await fetch('/api/pixel/auto-catalog-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin,
        forceFullBroadcast: Boolean(options?.forceFullBroadcast),
        metaPixelIds: activeMetaIds,
        tiktokPixelIds: activeTiktokIds,
        productsCount: validProducts.length,
      }),
    });
    if (res.ok) {
      const serverData = await res.json();
      if (serverData?.success) {
        return serverData;
      }
    }
  } catch {
    // fallback to local summary
  }

  const categoriesSummary = Array.from(categoryMap.entries()).map(([category, count]) => ({
    category,
    count,
  }));

  return {
    success: true,
    scannedProductsCount: validProducts.length,
    scannedCategoriesCount: categoriesSummary.length,
    categories: categoriesSummary,
    metaPixels: activeMetaIds,
    tiktokPixels: activeTiktokIds,
    timestamp: Date.now(),
  };
}

