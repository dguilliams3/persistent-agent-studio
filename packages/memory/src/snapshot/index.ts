/**
 * Personality Snapshot Module
 *
 * @module @persistence/memory/snapshot
 * @description Pure functions for personality snapshot validation, checksums, and constants.
 *
 * This module provides platform-agnostic utilities for handling personality
 * export/import operations. All functions are pure (no database or network calls).
 *
 * SCOPE:
 * - Checksum calculation and verification (SHA-256)
 * - Snapshot format validation
 * - Constants (version, limits, exportable keys)
 * - Type definitions for snapshots
 *
 * NOT IN SCOPE (handled in platforms/cloudflare/src/routes/personality.js):
 * - Database operations (export/import handlers)
 * - HTTP request/response handling
 * - Image processing (findImagesInHistory, etc.)
 *
 * @upstream Used by: platforms/cloudflare/src/routes/personality.js
 * @downstream Uses: Web Crypto API (crypto.subtle)
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Image types
  ImageRef,
  GalleryImage,
  GalleryManifest,
  GalleryExport,

  // Snapshot structure types
  SnapshotMeta,
  SnapshotState,
  SnapshotMemories,
  SnapshotMedia,
  SnapshotBranches,
  SnapshotSystemPrompt,
  PersonalitySnapshot,

  // Export entry types
  HistoryExportEntry,
  ColdStorageExportEntry,
  NotebookExportEntry,
  ObservationExportEntry,
  SummaryExportEntry,
  ReminderExportEntry,
  GalleryMediaEntry,
  BranchExportEntry,
  BranchOverrideEntry,
  SyntheticMemoryEntry,

  // Validation types
  ValidationResult,

  // Pending image refs
  PendingImageRef,
  PendingImageRefsState,
} from './types';

// =============================================================================
// CONSTANTS
// =============================================================================

export {
  SNAPSHOT_VERSION,
  MAX_EXPORT_SIZE_BYTES,
  DEFAULT_EXPORT_HISTORY_LIMIT,
  IMAGE_PLACEHOLDER,
  EXPORTABLE_STATE_KEYS,
  REQUIRED_MEMORY_TYPES,
} from './constants';

export type { ExportableStateKey, RequiredMemoryType } from './constants';

// =============================================================================
// CHECKSUM
// =============================================================================

export { calculateChecksum, verifyChecksum } from './checksum';

// =============================================================================
// VALIDATION
// =============================================================================

export { validateSnapshotFormat } from './validation';
