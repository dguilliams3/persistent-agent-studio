/**
 * Personality Snapshot Types
 *
 * @module @persistence/memory/snapshot/types
 * @description Type definitions for personality export/import snapshots.
 *
 * These types define the structure of personality backup files, enabling
 * complete backup, transfer, and experimentation with Claude's personality.
 *
 * @upstream Used by: personality.js routes, snapshot validation/checksum
 * @downstream Uses: None (pure types)
 */

// =============================================================================
// IMAGE TYPES
// =============================================================================

/**
 * Lightweight reference to an image in the system.
 * Used for linking gallery exports to personality exports without
 * including the full base64 data in the main export.
 */
export interface ImageRef {
  /** Unique identifier (e.g., "hist_123", "profile") */
  id: string;
  /** Where the image comes from: "history" or "media" */
  sourceType: 'history' | 'media';
  /** History entry ID if sourceType is "history", null otherwise */
  sourceId: number | null;
  /** Type of image: "art_result", "user_art", "profile_picture" */
  imageType: 'art_result' | 'user_art' | 'profile_picture';
  /** ISO timestamp when created, null for profile pictures */
  createdAt: string | null;
  /** Art prompt if type is "art_result" */
  prompt?: string | null;
}

/**
 * Full image with base64 data for gallery exports.
 */
export interface GalleryImage {
  /** Unique identifier matching ImageRef.id */
  id: string;
  /** Source type */
  sourceType: 'history' | 'media';
  /** History entry ID if from history */
  sourceId: number | null;
  /** Type of image */
  imageType: 'art_result' | 'user_art' | 'profile_picture';
  /** ISO timestamp when created */
  createdAt: string | null;
  /** Art prompt if applicable */
  prompt: string | null;
  /** MIME type (e.g., "image/jpeg", "image/png") */
  mimeType: string;
  /** Estimated size in bytes */
  sizeBytes: number;
  /** Base64 encoded image data (data:image/...;base64,...) */
  base64: string;
}

/**
 * Manifest for gallery export files.
 */
export interface GalleryManifest {
  /** Format version */
  version: string;
  /** ISO timestamp of export */
  exportedAt: string;
  /** Number of images in export */
  imageCount: number;
  /** Total size of all images in bytes */
  totalSizeBytes: number;
  /** Format indicator */
  format: 'json-base64';
}

/**
 * Complete gallery export structure.
 */
export interface GalleryExport {
  manifest: GalleryManifest;
  images: GalleryImage[];
}

// =============================================================================
// SNAPSHOT TYPES
// =============================================================================

/**
 * Metadata about the snapshot export.
 */
export interface SnapshotMeta {
  /** Format version (e.g., "2.0") */
  version: string;
  /** ISO timestamp of export */
  exportedAt: string;
  /** URL of the source worker */
  sourceHost: string;
  /** SHA-256 checksum in format "sha256:..." */
  checksum?: string;
  /** User-provided name for the export */
  name: string;
  /** User-provided description */
  description: string;
}

/**
 * State values included in the snapshot.
 * Keys are from EXPORTABLE_STATE_KEYS.
 */
export interface SnapshotState {
  loop_count?: number;
  total_cost_cents?: number;
  cycle_interval_seconds?: number;
  model?: string;
  max_completion_tokens?: number;
  streaming_enabled?: string;
  sleep_mode?: string;
  sleep_until?: string;
  user_status?: string;
  user_last_seen?: string;
  user_profile?: string;
  user_profile_updated?: string;
  summarize_threshold?: number;
  batch_enabled?: string;
  batch_until?: string;
  [key: string]: unknown;
}

/**
 * Memory collections in the snapshot.
 */
export interface SnapshotMemories {
  /** Recent history entries */
  history: HistoryExportEntry[];
  /** Permanent memories */
  coldStorage: ColdStorageExportEntry[];
  /** Notebook entries */
  notebook: NotebookExportEntry[];
  /** Observations about the user */
  observations: ObservationExportEntry[];
  /** Compressed history summaries */
  summaries: SummaryExportEntry[];
  /** Active/dismissed reminders */
  reminders: ReminderExportEntry[];
  /** Lightweight image references for gallery linking */
  imageRefs: ImageRef[];
}

/**
 * History entry as exported in snapshot (may have image data excluded).
 */
export interface HistoryExportEntry {
  id: number;
  type: string;
  content: string;
  internal?: string | null;
  created_at: string;
  summarized_at?: string | null;
  meter_snapshot?: string | null;
}

/**
 * Cold storage entry as exported.
 */
export interface ColdStorageExportEntry {
  id: number;
  content: string;
  context?: string | null;
  created_at: string;
}

/**
 * Notebook entry as exported.
 */
export interface NotebookExportEntry {
  id: number;
  title: string;
  content: string;
  summary?: string | null;
  created_at: string;
  updated_at?: string | null;
}

/**
 * Observation entry as exported.
 */
export interface ObservationExportEntry {
  id: number;
  title: string;
  content: string;
  summary?: string | null;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

/**
 * Summary entry as exported.
 */
export interface SummaryExportEntry {
  id: number;
  summary: string;
  message_count: number;
  covered_range?: string | null;
  created_at: string;
}

/**
 * Reminder entry as exported (includes dismissed).
 */
export interface ReminderExportEntry {
  id: number;
  content: string;
  condition: string;
  triggered: number;
  created_at: string;
  triggered_at?: string | null;
  dismissed_at?: string | null;
}

/**
 * Media section (DEPRECATED - use imageRefs + separate gallery export).
 */
export interface SnapshotMedia {
  profilePicture: string | null;
  gallery: GalleryMediaEntry[];
}

/**
 * Gallery entry in deprecated media section.
 */
export interface GalleryMediaEntry {
  id: number;
  type: string;
  content: string;
  image: string;
  created_at: string;
}

/**
 * Branch information in snapshot.
 */
export interface SnapshotBranches {
  list: BranchExportEntry[];
  overrides: BranchOverrideEntry[];
  synthetics: SyntheticMemoryEntry[];
  activeBranch: string;
}

/**
 * Branch list entry as exported.
 */
export interface BranchExportEntry {
  id: number;
  name: string;
  description?: string | null;
  created_at: string;
  parent_branch?: string | null;
}

/**
 * Branch override entry as exported.
 */
export interface BranchOverrideEntry {
  id: number;
  branch_id: number;
  branchName: string;
  target_table: string;
  target_id: number;
  override_type: string;
  override_data?: string | null;
  created_at: string;
}

/**
 * Synthetic memory entry as exported.
 */
export interface SyntheticMemoryEntry {
  id: number;
  branch_id: number;
  branchName: string;
  memory_type: string;
  content: string;
  position_timestamp?: string | null;
  created_at: string;
}

/**
 * System prompt configuration in snapshot.
 */
export interface SnapshotSystemPrompt {
  template: string;
  customizations: Record<string, unknown>;
}

/**
 * Complete personality snapshot structure (v2.0).
 *
 * This is the canonical format for personality exports.
 */
export interface PersonalitySnapshot {
  meta: SnapshotMeta;
  state: SnapshotState;
  memories: SnapshotMemories;
  /** @deprecated Use imageRefs + separate gallery export instead */
  media: SnapshotMedia;
  branches: SnapshotBranches;
  systemPrompt: SnapshotSystemPrompt;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Result of snapshot format validation.
 */
export interface ValidationResult {
  /** Whether the snapshot is valid */
  valid: boolean;
  /** List of validation errors, empty if valid */
  errors: string[];
}

// =============================================================================
// PENDING IMAGE REFS (for gallery hydration)
// =============================================================================

/**
 * Pending image reference stored during import for later gallery hydration.
 */
export interface PendingImageRef extends ImageRef {
  /** Target for hydration: "history" or "profile" */
  target: 'history' | 'profile';
  /** New history ID assigned during import (if target is "history") */
  historyId?: number;
  /** Which field to restore: "content" or "internal" */
  field?: 'content' | 'internal';
  /** Original export history ID for reference */
  sourceExportId?: number;
}

/**
 * State structure for pending image refs.
 */
export interface PendingImageRefsState {
  version: string;
  updatedAt: string | null;
  refs: PendingImageRef[];
}
