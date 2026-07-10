/**
 * Image sub-package barrel — re-exports all image types, validators, utilities, and art decay logic.
 *
 * Covers both static (PNG/JPEG/WebP) and animated (GIF/WebP/MP4) image hierarchies,
 * the ImageRecord aggregate, validateStaticImage/validateAnimatedImage guards,
 * format detection utilities, Anthropic/compression constants, and art decay splitting.
 *
 * @downstream packages/media/src/index — re-exported from the package root barrel
 * @downstream Any consumer that imports image-specific types directly from @persistence/media
 * @upstream packages/media/src/image/ImageMedia — union type
 * @upstream packages/media/src/image/ImageRecord — aggregate type
 * @upstream packages/media/src/image/static/ — Photo, ArtImage, StaticImage, validateStaticImage, art-decay
 * @upstream packages/media/src/image/animated/ — AnimatedImage, validateAnimatedImage
 * @upstream packages/media/src/image/format-detection — detectImageFormat, SUPPORTED_IMAGE_FORMATS
 * @upstream packages/media/src/image/constants — CLAUDE_IMAGE_LIMITS, IMAGE_COMPRESSION_DEFAULTS, context limits
 * @pattern barrel — re-exports only; no logic in this file
 * @antipattern DO NOT add logic here — put it in the domain file and re-export.
 * @tested_by packages/media/__tests__/image.test.ts
 */
// Image type hierarchy
export type { ImageMedia } from './ImageMedia';
export type { ImageRecord } from './ImageRecord';

// Static images
export type { StaticImage } from './static/StaticImage';
export type { Photo } from './static/Photo';
export type { ArtImage } from './static/ArtImage';
export { validateStaticImage } from './static/validate';

// Animated images
export type { AnimatedImage } from './animated/AnimatedImage';
export type { ConversionPipeline } from './animated/convert';
export { validateAnimatedImage } from './animated/validate';

// Utilities
export { detectImageFormat, SUPPORTED_IMAGE_FORMATS } from './format-detection';
export type { SupportedImageFormat } from './format-detection';
export {
  CLAUDE_IMAGE_LIMITS,
  IMAGE_COMPRESSION_DEFAULTS,
  MAX_USER_IMAGES_IN_CONTEXT,
  MAX_VIEW_IMAGES_PER_CYCLE,
} from './constants';

// Art decay
export type { ArtImageDisplay, ArtDecayResult } from './static/art-decay';
export { splitArtByDecay, DEFAULT_MAX_VISIBLE_IMAGES } from './static/art-decay';
