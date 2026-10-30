/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  }
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
 * Injects Meta Pixel base library script tag strictly ONCE globally
 */
function ensureMetaBaseScriptLoaded(): void {
  if (typeof window === 'undefined') return;
  if (window.fbq || window.__dokandari_meta_script_loaded) return;

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
      t = b.createElement(e);
      t.async = true;
      t.id = 'meta-pixel-base-script';
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s?.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

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
  if (window.ttq || window.__dokandari_tiktok_script_loaded) return;

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
        a.id = 'tiktok-pixel-base-script';
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

  return {
    metaCount: window.__dokandari_meta_initialized_ids.size,
    tiktokCount: window.__dokandari_tiktok_initialized_ids.size,
    youtubeCount: window.__dokandari_youtube_initialized_ids.size,
  };
}

/**
 * Dispatches real server-side Conversions API (CAPI) event with active Pixel IDs and Tokens
 */
async function dispatchServerCapi(eventName: string, eventData: any, customer?: any) {
  try {
    let storedCreds: any = {};
    try {
      const raw = localStorage.getItem('dokandari_api_credentials');
      if (raw) storedCreds = JSON.parse(raw);
    } catch {
      // ignore
    }

    const metaPixelIds = Array.from(window.__dokandari_meta_initialized_ids || []);
    const tiktokPixelIds = Array.from(window.__dokandari_tiktok_initialized_ids || []);
    const youtubeTagIds = Array.from(window.__dokandari_youtube_initialized_ids || []);

    fetch('/api/pixel/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName,
        eventData,
        customer,
        url: typeof window !== 'undefined' ? window.location.href : '',
        metaPixelIds,
        tiktokPixelIds,
        youtubeTagIds,
        facebookCapiToken: storedCreds.facebookCapiToken || '',
        tiktokAccessToken: storedCreds.tiktokAccessToken || '',
      }),
    }).catch(() => {});
  } catch {
    // Graceful background fallback
  }
}

/**
 * Global PageView tracking for all initialized Meta, TikTok & YouTube/Google pixels
 */
export function trackPixelPageView(): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq('track', 'PageView');
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
    dispatchServerCapi('PageView', { path: window.location.pathname });
  } catch (err) {
    console.warn('Pixel PageView note:', err);
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
}): void {
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq('track', 'ViewContent', {
        content_ids: [product.id],
        content_name: product.name,
        content_category: product.category || 'General',
        content_type: 'product',
        value: product.price,
        currency: 'BDT',
      });
    }

    if (window.ttq && typeof window.ttq.track === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
      window.ttq.track('ViewContent', {
        content_id: product.id,
        content_type: 'product',
        content_name: product.name,
        content_category: product.category || 'General',
        value: product.price,
        currency: 'BDT',
      });
    }

    if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
      window.gtag('event', 'view_item', {
        currency: 'BDT',
        value: product.price,
        items: [{ item_id: product.id, item_name: product.name, item_category: product.category || 'General', price: product.price }],
      });
    }

    dispatchServerCapi('ViewContent', { product });
  } catch (err) {
    console.warn('Pixel ViewContent note:', err);
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
}): void {
  if (typeof window === 'undefined') return;

  const qty = product.quantity || 1;
  const totalVal = product.price * qty;

  try {
    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq('track', 'AddToCart', {
        content_ids: [product.id],
        content_name: product.name,
        content_type: 'product',
        value: totalVal,
        currency: 'BDT',
      });
    }

    if (window.ttq && typeof window.ttq.track === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
      window.ttq.track('AddToCart', {
        content_id: product.id,
        content_type: 'product',
        content_name: product.name,
        quantity: qty,
        value: totalVal,
        currency: 'BDT',
      });
    }

    if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
      window.gtag('event', 'add_to_cart', {
        currency: 'BDT',
        value: totalVal,
        items: [{ item_id: product.id, item_name: product.name, quantity: qty, price: product.price }],
      });
    }

    dispatchServerCapi('AddToCart', { product, quantity: qty, value: totalVal });
  } catch (err) {
    console.warn('Pixel AddToCart note:', err);
  }
}

/**
 * Global InitiateCheckout tracking (fired when customer starts checkout or views checkout form)
 */
export function trackPixelInitiateCheckout(
  itemsOrValue: { id?: string; productId?: string; name: string; price: number; quantity?: number }[] | number,
  totalValueOrQty?: number
): void {
  if (typeof window === 'undefined') return;

  try {
    let items: { id: string; name: string; price: number; quantity?: number }[];
    let totalValue: number;

    if (Array.isArray(itemsOrValue)) {
      items = itemsOrValue.map((i) => ({
        id: i.id || i.productId || 'item',
        name: i.name,
        price: i.price,
        quantity: i.quantity || 1,
      }));
      totalValue = totalValueOrQty ?? items.reduce((acc, curr) => acc + curr.price * (curr.quantity || 1), 0);
    } else {
      totalValue = Number(itemsOrValue) || 0;
      items = [
        {
          id: 'checkout_cart',
          name: 'Cart Item',
          price: totalValue,
          quantity: totalValueOrQty || 1,
        },
      ];
    }

    const ids = items.map((i) => i.id);

    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq('track', 'InitiateCheckout', {
        content_ids: ids,
        num_items: items.reduce((acc, curr) => acc + (curr.quantity || 1), 0),
        value: totalValue,
        currency: 'BDT',
      });
    }

    if (window.ttq && typeof window.ttq.track === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
      window.ttq.track('InitiateCheckout', {
        contents: items.map((i) => ({
          content_id: i.id,
          content_name: i.name,
          quantity: i.quantity || 1,
          price: i.price,
        })),
        value: totalValue,
        currency: 'BDT',
      });
    }

    if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
      window.gtag('event', 'begin_checkout', {
        currency: 'BDT',
        value: totalValue,
        items: items.map((i) => ({ item_id: i.id, item_name: i.name, quantity: i.quantity || 1, price: i.price })),
      });
    }

    dispatchServerCapi('InitiateCheckout', { items, totalValue });
  } catch (err) {
    console.warn('Pixel InitiateCheckout note:', err);
  }
}

/**
 * Global Purchase tracking (fired when order is confirmed successfully)
 */
export function trackPixelPurchase(
  orderOrId:
    | {
        id: string;
        total: number;
        items: { productId?: string; id?: string; name: string; price: number; quantity?: number }[];
        customer?: { phone?: string; email?: string; name?: string };
      }
    | string,
  totalArg?: number,
  qtyArg?: number
): void {
  if (typeof window === 'undefined') return;

  try {
    let order: {
      id: string;
      total: number;
      items: { productId?: string; id?: string; name: string; price: number; quantity?: number }[];
      customer?: { phone?: string; email?: string; name?: string };
    };

    if (typeof orderOrId === 'object' && orderOrId !== null) {
      order = orderOrId;
    } else {
      const orderTotal = totalArg || 0;
      order = {
        id: String(orderOrId),
        total: orderTotal,
        items: [{ id: 'item-1', name: 'Order Item', price: orderTotal, quantity: qtyArg || 1 }],
      };
    }

    const ids = order.items.map((i) => i.productId || i.id || 'item');

    if (typeof window.fbq === 'function' && window.__dokandari_meta_initialized_ids?.size) {
      window.fbq('track', 'Purchase', {
        content_ids: ids,
        content_type: 'product',
        value: order.total,
        currency: 'BDT',
        order_id: order.id,
      });
    }

    if (window.ttq && typeof window.ttq.track === 'function' && window.__dokandari_tiktok_initialized_ids?.size) {
      window.ttq.track('CompletePayment', {
        contents: order.items.map((i) => ({
          content_id: i.productId || i.id,
          content_name: i.name,
          quantity: i.quantity || 1,
          price: i.price,
        })),
        value: order.total,
        currency: 'BDT',
        order_id: order.id,
      });
    }

    if (typeof window.gtag === 'function' && window.__dokandari_youtube_initialized_ids?.size) {
      window.gtag('event', 'purchase', {
        transaction_id: order.id,
        value: order.total,
        currency: 'BDT',
        items: order.items.map((i) => ({
          item_id: i.productId || i.id,
          item_name: i.name,
          quantity: i.quantity || 1,
          price: i.price,
        })),
      });
    }

    dispatchServerCapi(
      'Purchase',
      { orderId: order.id, total: order.total, items: order.items },
      order.customer
    );
  } catch (err) {
    console.warn('Pixel Purchase note:', err);
  }
}
