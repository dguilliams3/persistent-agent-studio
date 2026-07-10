/**
 * Centralized API Client for Cloudflare Worker Backend
 *
 * @module api/client
 * @description All HTTP requests to the worker backend go through this client
 * for consistent error handling, headers, and authentication.
 *
 * On 401 for non-/auth paths, the thrown ApiError has .unauthorized = true
 * (in addition to .status) so callers can distinguish auth failures without
 * losing the signal.
 *
 * For binary/blob responses or raw body uploads (non-JSON), use fetchRaw()
 * which still injects Authorization header (prevents header duplication at
 * call sites).
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

export const WORKER_URL = import.meta.env?.VITE_WORKER_URL?.trim() || 'https://your-worker.workers.dev';

// Single-user personal tool — sessionStorage is acceptable.
// For multi-user deployment, use httpOnly cookie or server-side session.
const ADMIN_PASSWORD_SESSION_KEY = 'admin_password';

export function getAdminPassword({ promptIfMissing = true } = {}): string | null {
  const envPassword = import.meta.env?.VITE_ADMIN_PASSWORD;
  if (typeof envPassword === 'string' && envPassword.trim()) {
    return envPassword.trim();
  }

  try {
    const stored = sessionStorage.getItem(ADMIN_PASSWORD_SESSION_KEY);
    if (stored && stored.trim()) {
      return stored.trim();
    }
  } catch (error) {
    console.error('Failed to retrieve admin password from session storage:', error);
  }

  if (!promptIfMissing || typeof window === 'undefined' || typeof window.prompt !== 'function') {
    return null;
  }

  const entered = window.prompt('Enter admin password:');
  if (!entered || !entered.trim()) {
    return null;
  }

  const normalized = entered.trim();

  try {
    sessionStorage.setItem(ADMIN_PASSWORD_SESSION_KEY, normalized);
  } catch (error) {
    console.error('Failed to store admin password in session storage:', error);
  }

  return normalized;
}

export function clearAdminPassword(): void {
  try {
    sessionStorage.removeItem(ADMIN_PASSWORD_SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear admin password from session storage:', error);
  }
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// =============================================================================
// CORE REQUEST FUNCTION
// =============================================================================

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | Record<string, unknown> | null;
}

/**
 * Build request headers with JSON default + auth token (except /auth/login).
 * Provided headers override the default Content-Type.
 * Token (if present) is always set for Authorization on non-login.
 */
function getAuthHeaders(
  endpoint: string,
  providedHeaders: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...providedHeaders,
  };

  if (endpoint !== '/auth/login') {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to retrieve auth token:', error);
    }
  }

  return headers;
}

async function request<T = Record<string, unknown>>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const url = `${WORKER_URL}${endpoint}`;

  const headers = getAuthHeaders(
    endpoint,
    (options.headers as Record<string, string>) || {},
  );

  const config = {
    ...options,
    headers,
  } as RequestOptions & { headers: Record<string, string> };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData) && !(config.body instanceof ArrayBuffer)) {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(url, config as RequestInit);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const apiErr = new ApiError(
        (data as Record<string, string>).error || (data as Record<string, string>).message || `Request failed: ${response.status}`,
        response.status,
        data
      );
      if (response.status === 401 && !endpoint.startsWith('/auth')) {
        (apiErr as any).unauthorized = true;
      }
      throw apiErr;
    }

    return data as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError((err as Error).message || 'Network error', 0, null);
  }
}

/**
 * Raw fetch that returns the Response object (no auto .json()).
 * Use for binary responses (e.g. audio blobs) or custom Content-Type bodies
 * (e.g. video arrayBuffer uploads). Still injects Authorization Bearer header
 * via same logic as json paths — call sites must not duplicate header code.
 *
 * For 401s, does not auto-throw (caller inspects response.ok); the
 * unauthorized marking is applied in the json request() path.
 *
 * @upstream Called by: voice slice (audio), VoiceTab (tts), chat slice (video-to-gif)
 * @downstream Calls: fetch (native)
 */
async function fetchRaw(endpoint: string, init: RequestInit = {}): Promise<Response> {
  const url = `${WORKER_URL}${endpoint}`;
  const headers = getAuthHeaders(
    endpoint,
    (init.headers as Record<string, string>) || {},
  );
  const config: RequestInit = {
    ...init,
    headers,
  };
  // Caller is responsible for body formatting (no auto-stringify here)
  return fetch(url, config);
}

// =============================================================================
// PUBLIC API CLIENT
// =============================================================================

export const api = {
  get: <T = Record<string, unknown>>(endpoint: string) => request<T>(endpoint),

  post: <T = Record<string, unknown>>(endpoint: string, body?: Record<string, unknown>) =>
    request<T>(endpoint, { method: 'POST', body: body as unknown as BodyInit }),

  put: <T = Record<string, unknown>>(endpoint: string, body?: Record<string, unknown>) =>
    request<T>(endpoint, { method: 'PUT', body: body as unknown as BodyInit }),

  delete: <T = Record<string, unknown>>(endpoint: string, body?: Record<string, unknown>) =>
    request<T>(endpoint, { method: 'DELETE', body: body as unknown as BodyInit }),

  /**
   * Raw Response fetch for blobs or non-JSON bodies.
   * See fetchRaw() implementation for docs.
   */
  fetchRaw,

  getMeters: () => request('/meters'),

  setMeter: (meter: string, value: number) =>
    request(`/meters/${meter}/set`, {
      method: 'POST',
      body: { value, source: 'web' } as unknown as BodyInit,
    }),

  setMetersBatch: (changes: Record<string, { from: number; to: number }>) =>
    request('/meters/batch', {
      method: 'POST',
      body: { changes, source: 'web' } as unknown as BodyInit,
    }),
};

export default api;
