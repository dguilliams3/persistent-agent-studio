/**
 * @persistence/media — Canonical media type hierarchy.
 *
 * @description
 * Platform-agnostic media types for binary content: images, audio, and future media kinds.
 * Types describe WHAT the binary thing IS. Domain subtypes describe WHO created it and WHY.
 * The resolution pipeline is kind-agnostic — branch on `kind` only for format-specific behavior.
 *
 * @downstream @persistence/db — composed aggregates (ImageRecord) import from here
 * @downstream apps/web — gallery, playback, and upload components import types and validators
 * @downstream packages/services — messaging handlers import domain types for Telegram/PWA
 * @upstream All packages that handle images, audio, or binary content supply data into these types
 * @pattern barrel — re-exports only; no logic in this file. All logic lives in domain files.
 * @antipattern DO NOT add logic to this file — it is a barrel. Add logic to the domain file and re-export here.
 * @tested_by packages/media/__tests__/
 *
 * @example
 * import type { ImageMedia, AudioMedia, MediaResolver } from '@persistence/media';
 * import { validateStaticImage } from '@persistence/media';
 */

// Base types
export type { Media, MediaBase } from "./Media";
export type { MediaSource } from "./MediaSource";
export type { StorageBackend } from "./StorageBackend";

// Image types, validators, utilities, art decay (via sub-barrel)
export * from "./image";

// Audio types and validators (via sub-barrel)
export * from "./audio";

// Resolution
export type { MediaResolver, ResolvedMedia } from "./resolve";

// Encoding utilities
export {
  parseImageDataUrl,
  isValidImageBase64,
  isValidBase64,
  estimateBase64ByteSize,
  formatMegabytes,
  MIN_VALID_BASE64_LENGTH,
} from "./encoding";
export type { DataUrlParts } from "./encoding";

// Context DTOs (lightweight types for prompt assembly pipeline)
// NOTE: PinnedImageContext (slot + title, no base64) is NOT part of this barrel.
// It is owned by @persistence/db/pinned and exported from @persistence/db.
export type {
  UserImage,
  ClaudeArtImage,
  ImageData,
  ArtImageData,
  ViewImageData,
} from "./context";
