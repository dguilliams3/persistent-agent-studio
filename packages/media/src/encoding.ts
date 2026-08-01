/**
 * Image Base64 Encoding Utilities
 *
 * @module @persistence/media/encoding
 * @description Data URL parsing and base64 validation for image data.
 * Provides pure functions for working with base64-encoded images.
 *
 * @upstream Called by: user content assembly, image generation pipelines
 * @downstream Pure functions, no dependencies
 * @antipattern DO NOT duplicate base64 parsing/validation elsewhere — import from @persistence/media.
 */

/** Result of parsing a data URL */
export interface DataUrlParts {
  /** MIME type (e.g., 'image/png') */
  mediaType: string;
  /** Raw base64 data (without the data URL prefix) */
  base64Data: string;
}

/**
 * Parse a data URL into its media type and base64 data components.
 *
 * @param dataUrl - Full data URL (e.g., 'data:image/png;base64,iVBOR...')
 * @returns Parsed parts, or null if the string is not a valid image data URL
 *
 * @example
 * parseImageDataUrl('data:image/png;base64,iVBOR...')
 * // { mediaType: 'image/png', base64Data: 'iVBOR...' }
 *
 * parseImageDataUrl('not a data url') // null
 */
export function parseImageDataUrl(dataUrl: string): DataUrlParts | null {
  const match = dataUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mediaType: `image/${match[1]}`,
    base64Data: match[2],
  };
}

/**
 * Minimum base64 character count for a valid image.
 *
 * 100 base64 chars = ~75 bytes — anything shorter cannot be a real image.
 */
export const MIN_VALID_BASE64_LENGTH = 100;

/**
 * Check if base64 data is long enough to be a valid image.
 *
 * @param base64Data - Raw base64 string (not a data URL)
 * @returns true if the data is at least MIN_VALID_BASE64_LENGTH characters
 */
export function isValidImageBase64(base64Data: string): boolean {
  return base64Data.length >= MIN_VALID_BASE64_LENGTH;
}

/**
 * Check if a string contains only valid base64 characters.
 *
 * Validates the character set (A-Z, a-z, 0-9, +, /, =) and padding.
 * Does NOT check minimum length — use isValidImageBase64 for that.
 *
 * @param base64Data - Raw base64 string (not a data URL)
 * @returns true if the string is structurally valid base64
 */
export function isValidBase64(base64Data: string): boolean {
  if (base64Data.length === 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(base64Data);
}

/**
 * Estimate raw byte size from base64 character count.
 *
 * Base64 encoding inflates size by ~4/3. This reverses the calculation
 * to estimate the original binary size.
 *
 * @param base64Length - Number of base64 characters
 * @returns Estimated size in bytes
 */
export function estimateBase64ByteSize(base64Length: number): number {
  return Math.floor((base64Length * 3) / 4);
}

/**
 * Format byte size as human-readable MB string.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string like '4.2'
 */
export function formatMegabytes(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}
