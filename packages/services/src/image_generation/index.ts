/**
 * Image Generation Capability - Image creation services
 *
 * @module @persistence/services/image_generation
 * @description Image generation via native Cloudflare Workers AI.
 *
 * Providers:
 * - CloudflareAIProvider: Free, content-filtered (@cf/ models)
 *
 * @example
 * import {
 *   CloudflareAIProvider,
 *   type ImageService,
 * } from '@persistence/services/image_generation';
 *
 * const cloudflare: ImageService = new CloudflareAIProvider(env.AI);
 * const result = await cloudflare.generate('a sunset');
 */

// Types
export type {
  ImageService,
  ImageOptions,
  ImageResult,
  CloudflareImageConfig,
  CloudflareAIBinding,
} from './types.js';

// Providers
export { CloudflareAIProvider } from './cloudflare.js';

// Image utilities (format detection, encoding, constants)
export { detectImageFormat, SUPPORTED_IMAGE_FORMATS } from './format-detection.js';
export type { SupportedImageFormat } from './format-detection.js';

export {
  parseImageDataUrl,
  isValidImageBase64,
  estimateBase64ByteSize,
  formatMegabytes,
  MIN_VALID_BASE64_LENGTH,
} from './encoding.js';
export type { DataUrlParts } from './encoding.js';

export {
  CLAUDE_IMAGE_LIMITS,
  IMAGE_COMPRESSION_DEFAULTS,
  MAX_USER_IMAGES_IN_CONTEXT,
  MAX_VIEW_IMAGES_PER_CYCLE,
} from './constants.js';
