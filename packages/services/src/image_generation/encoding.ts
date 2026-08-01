/**
 * @deprecated Moved to @persistence/media. Import from '@persistence/media' instead.
 * This file re-exports for backwards compatibility during migration.
 */
export {
  parseImageDataUrl,
  isValidImageBase64,
  estimateBase64ByteSize,
  formatMegabytes,
  MIN_VALID_BASE64_LENGTH,
} from '@persistence/media';
export type { DataUrlParts } from '@persistence/media';
