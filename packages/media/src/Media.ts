import type { MediaSource } from './MediaSource';
import type { StorageBackend } from './StorageBackend';
import type { StaticImage } from './image/static/StaticImage';
import type { AnimatedImage } from './image/animated/AnimatedImage';
import type { AudioMedia } from './audio/AudioMedia';

/**
 * Base media interface — binary content from somewhere.
 *
 * MediaBase describes WHAT the binary thing IS. Domain subtypes (Photo, ArtImage,
 * SynthesizedSpeech) extend MediaBase subtypes to describe WHO created it and WHY.
 *
 * The resolution pipeline is kind-agnostic: resolve(mediaRef) -> Media.
 * Branch on `kind` only when format-specific behavior is needed (validation, API injection).
 *
 * Prefer the `Media` discriminated union for function parameters and return types.
 * Use `MediaBase` only when defining new subtypes via `extends`.
 *
 * @downstream packages/media/src/image/ImageMedia — StaticImage and AnimatedImage extend MediaBase
 * @downstream packages/media/src/audio/AudioMedia — AudioMedia extends MediaBase
 * @downstream packages/media/src/image/ImageRecord — composed aggregate contains ImageMedia
 * @upstream None — root of the media type hierarchy
 * @pattern domain-ownership — canonical binary content type; all media kinds extend this, never bypass it
 * @antipattern DO NOT create new "binary content" abstractions — extend this hierarchy.
 *   Import from @persistence/media and use the existing type tree.
 * @tested_by packages/media/__tests__/media.test.ts
 * @invariant Every MediaBase value must have a timestamp and source; data may be absent when unresolved
 */
export interface MediaBase {
  /** Base64 data — absent if unresolved */
  data?: string;
  /** MIME type of the media (e.g., 'image/png', 'audio/ogg') — optional, populated on resolution */
  mimeType?: string;
  /** ISO timestamp of creation */
  timestamp: string;
  /** Who created it */
  source: MediaSource;
  /** Where the bytes live */
  storage: StorageBackend;
}

/**
 * Discriminated union of all concrete media kinds.
 *
 * Narrow via the `kind` field: 'static' | 'animated' | 'audio'.
 * Use this as the parameter/return type when accepting any media.
 * Use MediaBase only in `extends` clauses when defining new subtypes.
 *
 * @pattern discriminated-union — narrow via `kind` to access format-specific fields
 * @antipattern DO NOT use MediaBase as a parameter type when Media union is appropriate.
 */
export type Media = StaticImage | AnimatedImage | AudioMedia;
