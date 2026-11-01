/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const DEFAULT_DOKANDARI_META_PIXEL_ID = '1994859257776698';

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
        tiktokPixelIds: parsePixelIds(storedCreds.tiktokPixelId),
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
 */
export function normalizeCatalogProductId(rawId?: string | null): string {
  const cleaned = String(rawId || '').trim();
  if (!cleaned) return 'dkd-product';
  // If an item ID was constructed like "dkd-1-Silver-Standard" or "dkd-real-1-Default-Standard",
  // extract the canonical product ID prefix so it matches the catalog feed 100%.
  const realMatch = cleaned.match(/^(dkd-real-\d+|dkd-custom-\d+|dkd-ai-\d+|dkd-\d+|prod-\d+)/i);
  if (realMatch && realMatch[1]) {
    return realMatch[1];
  }
  return cleaned;
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
  if (hasMeta || hasTiktok) return;

  try {
    const raw = localStorage.getItem('dokandari_api_credentials');
    if (raw) {
      const creds = JSON.parse(raw);
      const metaId = creds?.facebookPixelId || DEFAULT_DOKANDARI_META_PIXEL_ID;
      initializeMultiPixels(metaId, creds?.tiktokPixelId, creds?.youtubeTagId);
      return;
    }
  } catch {
    // ignore
  }
  initializeMultiPixels(DEFAULT_DOKANDARI_META_PIXEL_ID);
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
        : parsePixelIds(storedCreds.tiktokPixelId)
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
        window.ttq.track('CompletePayment', tiktokPayload, { event_id: eventId });
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
 * Dynamically updates Schema.org Product JSON-LD and document title/canonical URL
 * when viewing a product detail page so Google Search & Meta Microdata index every product on dokandari.com.
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
      return;
    }

    const canonicalId = normalizeCatalogProductId(product.id);
    document.title = `${product.name} — ৳${product.price.toLocaleString()} | Dokandari (দোকানদারি)`;

    const schemaObj = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      productID: canonicalId,
      sku: canonicalId,
      mpn: product.sku || canonicalId,
      name: product.name,
      description:
        product.description ||
        `${product.name} — ১০০% অরিজিনাল কোয়ালিটি ও সারা বাংলাদেশে ক্যাশ অন ডেলিভারি সুবিধা।`,
      image: product.images && product.images.length > 0 ? product.images : [],
      brand: {
        '@type': 'Brand',
        name: 'Dokandari',
      },
      offers: {
        '@type': 'Offer',
        url: `${window.location.origin}/products/${encodeURIComponent(canonicalId)}`,
        priceCurrency: 'BDT',
        price: product.price,
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
