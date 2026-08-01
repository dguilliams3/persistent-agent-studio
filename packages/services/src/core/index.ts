/**
 * Core Utilities - Shared types, errors, and HTTP client
 *
 * @module @persistence/services/core
 * @description Core utilities for all service capabilities.
 */

// Types
export {
  type ServiceResult,
  type ServiceError,
  type ServiceErrorCode,
  type JobStatus,
  type AsyncJob,
  type HttpOptions,
  success,
  failure,
  httpStatusToErrorCode,
} from './types.js';

// Errors
export {
  ServiceException,
  NetworkException,
  AuthException,
  RateLimitException,
  InsufficientCreditException,
  ContentFilteredException,
  TimeoutException,
} from './errors.js';

// HTTP client
export {
  type HttpRequest,
  httpRequest,
  httpGet,
  httpPost,
  httpPostRaw,
  parseApiError,
} from './http.js';
