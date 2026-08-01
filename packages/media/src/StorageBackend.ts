/**
 * Where media bytes live — discriminated union on `kind`.
 *
 * Platform-agnostic: 'objectStorage' maps to R2, S3, GCS, etc.
 * The platform resolver translates to the concrete storage API.
 *
 * @downstream packages/media/src/Media — Media.storage is this type
 * @downstream packages/media/src/resolve — MediaResolver.resolve() accepts this type
 * @upstream None — leaf discriminated union, no dependencies
 * @pattern platform-agnostic — 'objectStorage' hides provider identity; only the resolver knows R2 vs S3
 * @antipattern DO NOT use platform-specific storage names (e.g., 'r2', 's3').
 *   Use 'objectStorage' — only the platform resolver knows which provider backs it.
 * @tested_by packages/media/__tests__/media.test.ts
 */
export type StorageBackend =
  | { kind: 'objectStorage'; key: string }
  | { kind: 'telegramFile'; fileId: string }
  | { kind: 'inline'; data: string };
