/**
 * Service Error Classes
 *
 * @module @persistence/services/core/errors
 * @description Error classes for service operations.
 *
 * These extend Error for instanceof checks while carrying
 * structured ServiceError information.
 */

import type { ServiceError, ServiceErrorCode } from './types.js';

/**
 * Base error class for all service failures.
 *
 * Carries structured error information while being throwable.
 * Prefer using ServiceResult<T> over throwing in most cases.
 *
 * @example
 * try {
 *   await riskyOperation();
 * } catch (err) {
 *   if (err instanceof ServiceException) {
 *     console.log(err.serviceError.code);
 *   }
 * }
 */
export class ServiceException extends Error {
  public readonly serviceError: ServiceError;

  constructor(error: ServiceError) {
    super(error.message);
    this.name = 'ServiceException';
    this.serviceError = error;
  }

  /** Error code for programmatic handling */
  get code(): ServiceErrorCode {
    return this.serviceError.code;
  }

  /** HTTP status code if applicable */
  get statusCode(): number | undefined {
    return this.serviceError.statusCode;
  }

  /** Additional error context */
  get details(): Record<string, unknown> | undefined {
    return this.serviceError.details;
  }
}

/**
 * Network-related error (connection failed, timeout, etc.)
 */
export class NetworkException extends ServiceException {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 'NETWORK_ERROR',
      message,
      details,
    });
    this.name = 'NetworkException';
  }
}

/**
 * Authentication error (invalid API key, expired token, etc.)
 */
export class AuthException extends ServiceException {
  constructor(message: string, statusCode?: number) {
    super({
      code: 'AUTH_ERROR',
      message,
      statusCode,
    });
    this.name = 'AuthException';
  }
}

/**
 * Rate limit exceeded error.
 */
export class RateLimitException extends ServiceException {
  /** Seconds until rate limit resets, if known */
  public readonly retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super({
      code: 'RATE_LIMIT',
      message,
      statusCode: 429,
      details: retryAfter ? { retryAfter } : undefined,
    });
    this.name = 'RateLimitException';
    this.retryAfter = retryAfter;
  }
}

/**
 * Insufficient credit/funds error (402).
 */
export class InsufficientCreditException extends ServiceException {
  constructor(message: string) {
    super({
      code: 'INSUFFICIENT_CREDIT',
      message,
      statusCode: 402,
    });
    this.name = 'InsufficientCreditException';
  }
}

/**
 * Content was blocked by safety filter.
 */
export class ContentFilteredException extends ServiceException {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      code: 'CONTENT_FILTERED',
      message,
      details,
    });
    this.name = 'ContentFilteredException';
  }
}

/**
 * Request timed out.
 */
export class TimeoutException extends ServiceException {
  constructor(message: string, timeoutMs?: number) {
    super({
      code: 'TIMEOUT',
      message,
      details: timeoutMs ? { timeoutMs } : undefined,
    });
    this.name = 'TimeoutException';
  }
}
