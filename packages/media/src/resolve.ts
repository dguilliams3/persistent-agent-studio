import type { StorageBackend } from './StorageBackend';

/**
 * Media resolver interface — platform-implemented.
 * Platform layer (Cloudflare) implements this to resolve media from storage backends.
 *
 * @downstream platforms/cloudflare — Cloudflare Worker implements this using R2 and Telegram Bot API
 * @upstream packages/media/src/StorageBackend — resolve() accepts StorageBackend variants
 * @pattern interface-segregation — packages define the contract; platforms supply the implementation
 * @antipattern DO NOT implement resolution logic directly — implement this interface
 *   and register with the media resolver. Resolution is platform-specific (R2, Telegram API, etc.)
 *   but the interface is platform-agnostic.
 * @tested_by packages/media/__tests__/resolve.test.ts
 * @invariant resolve() must return base64-encoded data; isAccessible() must not mutate storage state
 */
export interface MediaResolver {
  /** Resolve media bytes from a storage backend reference */
  resolve(backend: StorageBackend): Promise<ResolvedMedia>;
  /** Check if a storage reference is still valid/accessible */
  isAccessible(backend: StorageBackend): Promise<boolean>;
}

/**
 * Result of resolving a StorageBackend reference to concrete bytes.
 *
 * @downstream Consumers of MediaResolver.resolve() — caller receives this and may pass data to Anthropic API
 * @upstream packages/media/src/resolve — returned by MediaResolver.resolve()
 * @pattern value-object — immutable result record; no behavior, only data
 * @tested_by packages/media/__tests__/resolve.test.ts
 * @invariant data is always base64-encoded; sizeBytes reflects the decoded byte count
 */
export interface ResolvedMedia {
  data: string; // base64
  mimeType: string;
  sizeBytes: number;
}
