/**
 * HTTP Client Utilities
 *
 * @module @persistence/services/core/http
 * @description Shared HTTP utilities for service providers.
 *
 * Provides a wrapper around fetch with:
 * - Configurable timeout
 * - Retry with exponential backoff
 * - Consistent error handling
 * - JSON request/response helpers
 */

import {
  type ServiceResult,
  type ServiceErrorCode,
  type HttpOptions,
  failure,
  httpStatusToErrorCode,
} from './types.js';

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 0;
const DEFAULT_RETRY_DELAY = 1000;

// =============================================================================
// HTTP CLIENT
// =============================================================================

/**
 * HTTP request configuration.
 */
export interface HttpRequest extends HttpOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: unknown;
  /** If true, return raw Response instead of parsing JSON */
  raw?: boolean;
}

/**
 * Make an HTTP request with timeout and retry support.
 *
 * @param request - Request configuration
 * @returns ServiceResult with response data or error
 *
 * @example
 * const result = await httpRequest({
 *   url: 'https://api.example.com/endpoint',
 *   method: 'POST',
 *   headers: { 'Authorization': 'Bearer token' },
 *   body: { text: 'Hello' },
 *   timeout: 10000,
 *   retries: 2,
 * });
 */
export async function httpRequest<T>(
  request: HttpRequest
): Promise<ServiceResult<T>> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY,
    signal,
    raw = false,
  } = request;

  let lastError: ServiceResult<T> = failure('UNKNOWN', 'No request attempted');
  let attempts = 0;

  while (attempts <= retries) {
    attempts++;

    try {
      // Create timeout abort controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeout);

      // Combine with external signal if provided
      const combinedSignal = signal
        ? combineSignals(signal, timeoutController.signal)
        : timeoutController.signal;

      // Build fetch options
      const fetchOptions: RequestInit = {
        method,
        headers: {
          ...headers,
          ...(body && !headers['Content-Type']
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        signal: combinedSignal,
      };

      // Add body for non-GET requests
      if (body && method !== 'GET') {
        fetchOptions.body =
          body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer
            ? body as BodyInit
            : JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      // Handle non-2xx responses
      if (!response.ok) {
        const errorCode = httpStatusToErrorCode(response.status);
        let errorMessage = `HTTP ${response.status}`;

        // Try to extract error message from response body
        try {
          const errorBody = await response.text();
          if (errorBody) {
            try {
              const errorJson = JSON.parse(errorBody);
              errorMessage =
                errorJson.error?.message ||
                errorJson.message ||
                errorJson.detail ||
                errorMessage;
            } catch {
              errorMessage = errorBody.slice(0, 200);
            }
          }
        } catch {
          // Ignore error reading body
        }

        lastError = failure(errorCode, errorMessage, {
          statusCode: response.status,
        });

        // Don't retry on client errors (4xx) except rate limits
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return lastError;
        }

        // Retry on 5xx and 429
        if (attempts <= retries) {
          await sleep(retryDelay * Math.pow(2, attempts - 1));
          continue;
        }

        return lastError;
      }

      // Return raw response if requested
      if (raw) {
        return { success: true, data: response as unknown as T };
      }

      // Parse JSON response
      const data = await response.json();
      return { success: true, data: data as T };
    } catch (err) {
      // Handle abort/timeout
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = failure('TIMEOUT', `Request timed out after ${timeout}ms`);
      } else if (err instanceof Error) {
        lastError = failure('NETWORK_ERROR', err.message);
      } else {
        lastError = failure('UNKNOWN', String(err));
      }

      // Retry on network errors
      if (attempts <= retries) {
        await sleep(retryDelay * Math.pow(2, attempts - 1));
        continue;
      }

      return lastError;
    }
  }

  return lastError;
}

/**
 * Make a GET request.
 */
export function httpGet<T>(
  url: string,
  headers?: Record<string, string>,
  options?: HttpOptions
): Promise<ServiceResult<T>> {
  return httpRequest({ url, method: 'GET', headers, ...options });
}

/**
 * Make a POST request with JSON body.
 */
export function httpPost<T>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
  options?: HttpOptions
): Promise<ServiceResult<T>> {
  return httpRequest({ url, method: 'POST', body, headers, ...options });
}

/**
 * Make a POST request and return raw Response.
 *
 * Useful for binary responses (audio, images).
 */
export async function httpPostRaw(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
  options?: HttpOptions
): Promise<ServiceResult<Response>> {
  return httpRequest({ url, method: 'POST', body, headers, raw: true, ...options });
}

// =============================================================================
// HELPERS
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Combine multiple AbortSignals into one.
 */
function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  return controller.signal;
}

/**
 * Parse error from various API response formats.
 *
 * Handles common patterns:
 * - { error: { message: "..." } }
 * - { error: "..." }
 * - { message: "..." }
 * - { detail: "..." }
 * - { detail: { message: "..." } }
 */
export function parseApiError(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;

  const obj = data as Record<string, unknown>;

  // { error: { message: "..." } } - Anthropic, OpenAI
  if (obj.error && typeof obj.error === 'object') {
    const error = obj.error as Record<string, unknown>;
    if (typeof error.message === 'string') return error.message;
  }

  // { error: "..." } - Simple format
  if (typeof obj.error === 'string') return obj.error;

  // { message: "..." } - Generic
  if (typeof obj.message === 'string') return obj.message;

  // { detail: { message: "..." } } - ElevenLabs
  if (obj.detail && typeof obj.detail === 'object') {
    const detail = obj.detail as Record<string, unknown>;
    if (typeof detail.message === 'string') return detail.message;
    if (typeof detail.status === 'string') return detail.status;
  }

  // { detail: "..." } - FastAPI
  if (typeof obj.detail === 'string') return obj.detail;

  return undefined;
}
