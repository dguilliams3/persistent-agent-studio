/**
 * Image Constants
 *
 * @module @persistence/media/image/constants
 * @description Validation and size limits for image handling across the system.
 *
 * @upstream Used by: user content assembly, image generation, gallery handlers
 * @downstream Pure constants, no dependencies
 * @antipattern DO NOT define image size limits elsewhere — import from @persistence/media.
 */

/**
 * Anthropic Claude API image size limits.
 *
 * Claude supports images up to 5MB per image in the Messages API.
 * The base64 limit is conservative to account for encoding overhead.
 *
 * @see https://docs.anthropic.com/en/docs/build-with-claude/vision
 */
export const CLAUDE_IMAGE_LIMITS = {
  /** Maximum raw image size in bytes (5MB) */
  maxImageBytes: 5_242_880,
  /** Maximum base64-encoded characters (~4.875MB raw, conservative buffer) */
  maxBase64Chars: 6_500_000,
} as const;

/**
 * Default image compression settings for D1 storage.
 *
 * D1 has ~900KB max per row, so generated images must be compressed
 * from their original PNG format to JPEG before storage.
 */
export const IMAGE_COMPRESSION_DEFAULTS = {
  /** Maximum width or height in pixels */
  maxDimension: 768,
  /** JPEG compression quality (1-100) */
  jpegQuality: 80,
} as const;

/**
 * Maximum number of the user's recent images to include in context.
 *
 * Limits the number of user-sent images included in the Anthropic API
 * user message to manage context size and cost.
 */
export const MAX_USER_IMAGES_IN_CONTEXT = 3;

/**
 * Maximum number of VIEW_IMAGES (requested images) per cycle.
 *
 * Prevents context bloat from too many requested images in a single cycle.
 */
export const MAX_VIEW_IMAGES_PER_CYCLE = 5;
