/**
 * Personality Snapshot Constants
 *
 * @module @persistence/memory/snapshot/constants
 * @description Constants for personality export/import operations.
 *
 * @upstream Used by: personality.js routes, snapshot validation
 * @downstream Uses: None (pure constants)
 */

/**
 * Current snapshot format version.
 * Increment when making breaking changes to the snapshot structure.
 */
export const SNAPSHOT_VERSION = '2.0';

/**
 * Maximum allowed export size in bytes (50MB).
 * Prevents memory issues with very large exports.
 */
export const MAX_EXPORT_SIZE_BYTES = 50 * 1024 * 1024;

/**
 * Default number of history entries to include in export.
 * Can be overridden via historyLimit option.
 */
export const DEFAULT_EXPORT_HISTORY_LIMIT = 100;

/**
 * Placeholder text for excluded image data.
 * Used when images are stripped from history entries.
 */
export const IMAGE_PLACEHOLDER = '[image data excluded]';

/**
 * State keys that are safe to export/import.
 * Excludes sensitive keys (API tokens, passwords) and runtime-only keys.
 */
export const EXPORTABLE_STATE_KEYS = [
  'loop_count',
  'total_cost_cents',
  'cycle_interval_seconds',
  'model',
  'max_completion_tokens',
  'streaming_enabled',
  'sleep_mode',
  'sleep_until',
  'user_status',
  'user_last_seen',
  'user_profile',
  'user_profile_updated',
  'summarize_threshold',
  'batch_enabled',
  'batch_until',
] as const;

/**
 * Type for exportable state keys.
 */
export type ExportableStateKey = (typeof EXPORTABLE_STATE_KEYS)[number];

/**
 * Required memory types in a valid snapshot.
 * Used by validation to ensure snapshot structure is complete.
 */
export const REQUIRED_MEMORY_TYPES = [
  'history',
  'coldStorage',
  'notebook',
  'observations',
  'summaries',
  'reminders',
] as const;

/**
 * Type for required memory types.
 */
export type RequiredMemoryType = (typeof REQUIRED_MEMORY_TYPES)[number];
