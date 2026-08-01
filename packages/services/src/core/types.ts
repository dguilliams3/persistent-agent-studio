/**
 * Core Types - Shared service interfaces and result types
 *
 * @module @persistence/services/core/types
 * @description Common types used across all service capabilities.
 *
 * Services return `ServiceResult<T>` for consistent error handling.
 * Callers can check `success` before using `data` or handle `error`.
 *
 * @example
 * const result = await tts.synthesize('Hello');
 * if (result.success) {
 *   // result.data is TTSResult
 * } else {
 *   console.error(result.error);
 * }
 */

// =============================================================================
// RESULT TYPES
// =============================================================================

/**
 * Standard result wrapper for all service operations.
 *
 * All service methods return this type for consistent error handling.
 * Uses discriminated union: check `success` to narrow `data` vs `error`.
 */
export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: ServiceError };

/**
 * Structured error information from service operations.
 */
export interface ServiceError {
  /** Error category for programmatic handling */
  code: ServiceErrorCode;
  /** Human-readable error message */
  message: string;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Additional context (e.g., API error details) */
  details?: Record<string, unknown>;
}

/**
 * Standard error codes for service failures.
 */
export type ServiceErrorCode =
  | 'NETWORK_ERROR'      // Connection failed, timeout
  | 'AUTH_ERROR'         // Invalid credentials, expired token
  | 'RATE_LIMIT'         // Too many requests
  | 'INSUFFICIENT_CREDIT' // Account out of credits (402)
  | 'INVALID_INPUT'      // Bad request parameters
  | 'NOT_FOUND'          // Resource doesn't exist
  | 'CONTENT_FILTERED'   // Content blocked by safety filter
  | 'SERVICE_ERROR'      // Provider returned 5xx
  | 'TIMEOUT'            // Request timed out
  | 'UNKNOWN';           // Unclassified error

// =============================================================================
// ASYNC JOB PATTERN
// =============================================================================

/**
 * Status for async job operations (image generation, batch processing).
 */
export type JobStatus =
  | 'queued'      // Job accepted, waiting to start
  | 'processing'  // Job is running
  | 'succeeded'   // Job completed successfully
  | 'failed'      // Job failed
  | 'cancelled';  // Job was cancelled

/**
 * Async job handle returned when starting long-running operations.
 */
export interface AsyncJob<T> {
  /** Unique job identifier from provider */
  id: string;
  /** Current job status */
  status: JobStatus;
  /** Progress percentage if available (0-100) */
  progress?: number;
  /** Result data when status is 'succeeded' */
  result?: T;
  /** Error info when status is 'failed' */
  error?: ServiceError;
  /** Estimated time remaining in seconds */
  estimatedSeconds?: number;
}

// =============================================================================
// HTTP OPTIONS
// =============================================================================

/**
 * Common options for HTTP-based service calls.
 */
export interface HttpOptions {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Number of retry attempts for transient failures (default: 0) */
  retries?: number;
  /** Delay between retries in milliseconds (default: 1000) */
  retryDelay?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Create a successful ServiceResult.
 */
export function success<T>(data: T): ServiceResult<T> {
  return { success: true, data };
}

/**
 * Create a failed ServiceResult.
 */
export function failure<T>(
  code: ServiceErrorCode,
  message: string,
  options?: {
    statusCode?: number;
    details?: Record<string, unknown>;
  }
): ServiceResult<T> {
  return {
    success: false,
    error: {
      code,
      message,
      statusCode: options?.statusCode,
      details: options?.details,
    },
  };
}

/**
 * Map HTTP status codes to error codes.
 */
export function httpStatusToErrorCode(status: number): ServiceErrorCode {
  if (status === 401 || status === 403) return 'AUTH_ERROR';
  if (status === 402) return 'INSUFFICIENT_CREDIT';
  if (status === 404) return 'NOT_FOUND';
  if (status === 429) return 'RATE_LIMIT';
  if (status >= 400 && status < 500) return 'INVALID_INPUT';
  if (status >= 500) return 'SERVICE_ERROR';
  return 'UNKNOWN';
}
