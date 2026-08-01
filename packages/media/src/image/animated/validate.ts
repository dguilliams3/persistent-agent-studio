import type { AnimatedImage } from './AnimatedImage';
import { isValidBase64 } from '../../encoding';

const MAX_ANIMATED_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const VALID_ANIMATED_FORMATS = ['gif', 'webp', 'mp4'] as const;

/**
 * Validate an animated image against format, size, and data constraints.
 * Returns an empty array if valid, or an array of error messages.
 *
 * @downstream Any handler that accepts animated image uploads — call before persisting to R2
 * @upstream packages/media/src/image/animated/AnimatedImage — accepts AnimatedImage values
 * @pattern guard-at-boundary — validate on ingress; types are trusted after this point
 * @antipattern DO NOT validate animated images inline in upload handlers — use this function.
 *   Centralises the 50MB limit and format rules; update here to affect all animated upload paths.
 * @tested_by packages/media/__tests__/validate.test.ts
 * @invariant Returns [] on valid input; never throws; durationSeconds must be non-negative; frameCount must be >= 1
 */
export function validateAnimatedImage(image: AnimatedImage): string[] {
  const errors: string[] = [];
  if (image.sizeBytes && image.sizeBytes > MAX_ANIMATED_SIZE_BYTES) {
    errors.push(`Animated image exceeds ${MAX_ANIMATED_SIZE_BYTES} byte limit: ${image.sizeBytes}`);
  }
  if (!VALID_ANIMATED_FORMATS.includes(image.format)) {
    errors.push(`Invalid format: ${image.format}`);
  }
  if (image.durationSeconds !== undefined && image.durationSeconds < 0) {
    errors.push(`Duration cannot be negative: ${image.durationSeconds}`);
  }
  if (image.frameCount !== undefined && image.frameCount < 1) {
    errors.push(`Frame count must be at least 1: ${image.frameCount}`);
  }
  if (image.data !== undefined && !isValidBase64(image.data)) {
    errors.push('Image data contains invalid base64 characters');
  }
  return errors;
}
