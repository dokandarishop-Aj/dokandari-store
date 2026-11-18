/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const ADMIN_TOKEN_STORAGE_KEY = 'dokandari_admin_token_v1';
const LEGACY_ADMIN_SESSION_KEY = 'dokandari_admin_session';

let fetchInterceptorInstalled = false;

function syncAdminTokenCookie(token: string | null): void {
  if (typeof document === 'undefined') return;
  try {
    if (token) {
      const isHttps = typeof window !== 'undefined' && window.location?.protocol === 'https:';
      const sameSitePart = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
      document.cookie = `dokandari_admin_token=${encodeURIComponent(token)}; Path=/; Max-Age=604800; ${sameSitePart}`;
    } else {
      document.cookie = 'dokandari_admin_token=; Path=/; Max-Age=0; SameSite=Lax';
      document.cookie = 'dokandari_admin_token=; Path=/; Max-Age=0; SameSite=None; Secure';
    }
  } catch {
    // ignore cookie write errors
  }
}

/**
 * Checks if a token string matches the server-issued signed token format:
 * `dkd_adm_v1.<payloadBase64Url>.<hmacSignatureHex>`
 */
export function isSignedAdminTokenFormat(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  if (parts[0] !== 'dkd_adm_v1') return false;
  if (parts[1].length < 16 || parts[2].length < 32) return false;
  try {
    const jsonStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(jsonStr);
    if (!payload || payload.role !== 'admin' || !payload.exp) return false;
    if (Date.now() > Number(payload.exp)) return false;
    return true;
  } catch {
    return false;
  }
}

export function getAdminSessionToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromSession = window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (fromSession && isSignedAdminTokenFormat(fromSession)) {
      const trimmed = fromSession.trim();
      syncAdminTokenCookie(trimmed);
      return trimmed;
    }
    const fromLocal = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
    if (fromLocal && isSignedAdminTokenFormat(fromLocal)) {
      const trimmed = fromLocal.trim();
      syncAdminTokenCookie(trimmed);
      return trimmed;
    }
    // If legacy flag exists without a valid cryptographic server token, purge it immediately
    if (
      window.localStorage.getItem(LEGACY_ADMIN_SESSION_KEY) ||
      window.sessionStorage.getItem(LEGACY_ADMIN_SESSION_KEY)
    ) {
      window.localStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
      window.sessionStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
    }
    return null;
  } catch {
    return null;
  }
}

export function hasValidAdminTokenFormat(): boolean {
  return Boolean(getAdminSessionToken());
}

export function setAdminSessionToken(token: string, remember = true): void {
  if (typeof window === 'undefined') return;
  const clean = (token || '').trim();
  if (!isSignedAdminTokenFormat(clean)) return;
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, clean);
    if (remember) {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, clean);
    } else {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    }
    window.localStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
    syncAdminTokenCookie(clean);
  } catch {
    // ignore storage errors
  }
}

export function clearAdminSessionToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
    window.sessionStorage.removeItem(LEGACY_ADMIN_SESSION_KEY);
    syncAdminTokenCookie(null);
    // Also scrub any cached sensitive API credentials from browser storage on logout
    const rawCreds = window.localStorage.getItem('dokandari_api_credentials');
    if (rawCreds) {
      try {
        const parsed = JSON.parse(rawCreds);
        const publicOnly = {
          facebookPixelId: parsed?.facebookPixelId || '',
          tiktokPixelId: parsed?.tiktokPixelId || '',
          youtubeTagId: parsed?.youtubeTagId || '',
          gtmContainerId: parsed?.gtmContainerId || '',
          ga4MeasurementId: parsed?.ga4MeasurementId || '',
          googleSearchConsoleCode: parsed?.googleSearchConsoleCode || '',
        };
        window.localStorage.setItem('dokandari_api_credentials', JSON.stringify(publicOnly));
      } catch {
        window.localStorage.removeItem('dokandari_api_credentials');
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Verifies the stored Admin token against the backend `/api/admin/session` endpoint.
 * Never trusts localStorage/sessionStorage flags without cryptographic backend validation.
 */
export async function verifyAdminSessionWithServer(): Promise<boolean> {
  const token = getAdminSessionToken();
  if (!token) {
    clearAdminSessionToken();
    return false;
  }
  try {
    const res = await window.fetch('/api/admin/session', {
      method: 'GET',
      headers: {
        'x-admin-token': token,
        Authorization: `Bearer ${token}`,
      },
      credentials: 'same-origin',
    });
    if (!res.ok) {
      clearAdminSessionToken();
      return false;
    }
    const data = await res.json();
    if (data && data.authenticated === true && data.role === 'admin') {
      return true;
    }
    clearAdminSessionToken();
    return false;
  } catch {
    return false;
  }
}

export async function logoutAdminSession(): Promise<void> {
  const token = getAdminSessionToken();
  clearAdminSessionToken();
  try {
    await window.fetch('/api/admin/logout', {
      method: 'POST',
      headers: token ? { 'x-admin-token': token } : {},
      credentials: 'same-origin',
    });
  } catch {
    // ignore network error on logout
  }
}

/**
 * Safely installs a fetch interceptor (when `window.fetch` is configurable) AND ensures
 * the signed `dokandari_admin_token` cookie is synced so same-origin `/api/*` requests
 * always carry the Admin token without ever throwing if `window.fetch` is a read-only getter.
 */
export function installAdminAuthFetchInterceptor(): void {
  if (typeof window === 'undefined' || fetchInterceptorInstalled) return;
  fetchInterceptorInstalled = true;

  // Hydrate cookie if a valid signed token is already in storage
  getAdminSessionToken();

  try {
    const currentFetch = window.fetch;
    if (typeof currentFetch !== 'function') return;
    const originalFetch = currentFetch.bind(window);

    const wrappedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const urlStr =
          typeof input === 'string'
            ? input
            : input instanceof URL
            ? input.toString()
            : input?.url || '';

        const isSameOriginApi =
          urlStr.startsWith('/api/') ||
          (typeof window !== 'undefined' &&
            urlStr.startsWith(`${window.location.origin}/api/`));

        if (isSameOriginApi) {
          const token = getAdminSessionToken();
          if (token) {
            const nextHeaders = new Headers(
              init?.headers || (input instanceof Request ? input.headers : undefined)
            );
            if (!nextHeaders.has('x-admin-token')) {
              nextHeaders.set('x-admin-token', token);
            }
            if (!nextHeaders.has('Authorization')) {
              nextHeaders.set('Authorization', `Bearer ${token}`);
            }
            return originalFetch(input, {
              ...init,
              headers: nextHeaders,
              credentials: init?.credentials || 'same-origin',
            });
          }
        }
      } catch {
        // Fallback to originalFetch
      }
      return originalFetch(input, init);
    };

    Object.defineProperty(window, 'fetch', {
      value: wrappedFetch,
      configurable: true,
      writable: true,
    });
  } catch {
    // In environments where window.fetch is a non-configurable getter, same-origin requests
    // still automatically include `dokandari_admin_token` via document.cookie.
  }
}
