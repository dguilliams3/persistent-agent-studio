/**
 * Image Generation Capability - Image creation services
 *
 * @module @persistence/services/image_generation
 * @description Image generation capability with multiple providers.
 *
 * Providers:
 * - ReplicateProvider: FLUX Schnell/Dev, SDXL (~$0.01-0.025/image)
 * - CloudflareAIProvider: Free, content-filtered
 * - PonyStudioProvider: Free (requires the user's laptop online)
 *
 * @example
 * import {
 *   ReplicateProvider,
 *   CloudflareAIProvider,
 *   type ImageService,
 * } from '@persistence/services/image_generation';
 *
 * // Replicate (paid, flexible)
 * const replicate: ImageService = new ReplicateProvider({
 *   apiToken: 'r8_...',
 *   model: 'flux-schnell',
 * });
 *
 * // Cloudflare AI (free, filtered)
 * const cloudflare: ImageService = new CloudflareAIProvider(env.AI);
 *
 * const result = await replicate.generate('a sunset');
 */

// Types
export type {
  ImageService,
  AsyncImageService,
  ImageOptions,
  ImageResult,
  ReplicateConfig,
  ReplicateModelConfig,
  CloudflareImageConfig,
  CloudflareAIBinding,
  PonyStudioConfig,
  PonyPresets,
} from './types.js';

export { REPLICATE_MODELS } from './types.js';

// Providers
export {
  ReplicateProvider,
  createFluxSchnellProvider,
  createFluxDevProvider,
  createSDXLProvider,
} from './replicate.js';

export { CloudflareAIProvider } from './cloudflare.js';

export { PonyStudioProvider, getPonyPresets } from './pony.js';

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
