/**
 * Image Format Detection from Base64 Magic Bytes
 *
 * @module @persistence/media/image/format-detection
 * @description Detects actual image format from base64-encoded data by inspecting
 * magic byte prefixes. Never trusts declared MIME types — always verifies from
 * the binary header.
 *
 * Magic byte prefixes in base64:
 * - JPEG: /9j/ (FFD8FF in hex)
 * - PNG: iVBOR (89504E47 in hex)
 * - GIF: R0lGOD (47494638 in hex)
 * - WebP: UklGR (52494646 in hex)
 * - BMP: Qk (424D in hex)
 * - TIFF: SUkq or TU0A (49492A00 or 4D4D002A in hex)
 *
 * @upstream Called by: user content assembly (runThinkingCycle)
 * @downstream Pure function, no dependencies
 * @antipattern DO NOT duplicate format detection logic elsewhere — import from @persistence/media.
 */

/**
 * Base64 prefix → MIME type mapping.
 *
 * Order matters for prefixes that could overlap (none currently do).
 * Each entry: [base64Prefix, mimeType]
 */
const MAGIC_BYTE_SIGNATURES: ReadonlyArray<readonly [string, string]> = [
  ['/9j/', 'image/jpeg'],
  ['iVBOR', 'image/png'],
  ['R0lGOD', 'image/gif'],
  ['UklGR', 'image/webp'],
  ['Qk', 'image/bmp'],
  ['SUkq', 'image/tiff'],
  ['TU0A', 'image/tiff'],
] as const;

/**
 * Detect image MIME type from base64-encoded data using magic bytes.
 *
 * @param base64Data - Raw base64 string (NOT a data URL — strip the prefix first)
 * @returns MIME type string (e.g., 'image/jpeg') or null if unrecognized
 *
 * @example
 * detectImageFormat('/9j/4AAQSkZJRg...') // 'image/jpeg'
 * detectImageFormat('iVBORw0KGgo...') // 'image/png'
 * detectImageFormat('AAAA...') // null (unrecognized)
 */
export function detectImageFormat(base64Data: string): string | null {
  for (const [prefix, mimeType] of MAGIC_BYTE_SIGNATURES) {
    if (base64Data.startsWith(prefix)) {
      return mimeType;
    }
  }
  return null;
}

/**
 * All supported image MIME types that can be detected.
 */
export const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
] as const;

export type SupportedImageFormat = typeof SUPPORTED_IMAGE_FORMATS[number];
