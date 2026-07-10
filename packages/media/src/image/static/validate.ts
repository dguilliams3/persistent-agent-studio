import type { StaticImage } from './StaticImage';
import { isValidBase64 } from '../../encoding';

const MAX_STATIC_SIZE_BYTES = 20 * 1024 * 1024; // 20MB (Anthropic limit)
const VALID_STATIC_FORMATS = ['png', 'jpeg', 'webp'] as const;

/**
 * Validate a static image against format, size, and data constraints.
 * Returns an empty array if valid, or an array of error messages.
 *
 * @downstream Any handler that accepts static image uploads — call before persisting to R2
 * @upstream packages/media/src/image/static/StaticImage — accepts StaticImage values
 * @pattern guard-at-boundary — validate on ingress; types are trusted after this point
 * @antipattern DO NOT validate static images inline in upload handlers — use this function.
 *   Centralises the 20MB and format rules; update here to affect all upload paths.
 * @tested_by packages/media/__tests__/validate.test.ts
 * @invariant Returns [] on valid input; never throws; MAX_STATIC_SIZE_BYTES is the Anthropic Vision limit
 */
export function validateStaticImage(image: StaticImage): string[] {
  const errors: string[] = [];
  if (image.sizeBytes && image.sizeBytes > MAX_STATIC_SIZE_BYTES) {
    errors.push(`Image exceeds ${MAX_STATIC_SIZE_BYTES} byte limit: ${image.sizeBytes}`);
  }
  if (!VALID_STATIC_FORMATS.includes(image.format)) {
    errors.push(`Invalid format: ${image.format}`);
  }
  if (image.data !== undefined && !isValidBase64(image.data)) {
    errors.push('Image data contains invalid base64 characters');
  }
  return errors;
}
