/**
 * History Logging Utilities
 *
 * @module @persistence/db/history-logger
 * @description Standardized history logging utilities with type validation and error handling.
 *
 * This module provides:
 * - Type-safe history entry creation with HISTORY_TYPES enum
 * - Consistent error handling for logging failures
 * - Silent mode for non-critical entries
 * - Batch logging for multiple related entries
 * - Automatic meter snapshot capture (can be disabled)
 *
 * METER SNAPSHOT:
 * By default, logHistory() automatically captures a meter snapshot (Clio's internal
 * state like "A7 C6 N10 E8 D7 X3 Y5") and stores it with each history entry.
 * This can be disabled with `autoCaptureMeterSnapshot: false` or skipped by
 * providing a pre-computed `meterSnapshot` value.
 *
 * @upstream Called by: Tool handlers, action executors
 * @downstream Calls: addHistory() from ./history, getMeterSnapshot() from ./meters
 */

import { addHistory, type AddHistoryOptions } from './history';
import { getMeterSnapshot } from './meters';
import type { DrizzleD1 } from './client';

/**
 * Valid history entry types
 */
export const HISTORY_TYPES = {
  // Core conversation types
  USER_MESSAGE: 'user_message',
  THOUGHT: 'thought',
  CURIOSITY: 'curiosity',
  REMEMBER: 'remember',
  COLD_STORAGE: 'cold_storage',

  // Action result types
  MESSAGE_TO_USER: 'message_to_user',
  SEARCH_QUERY: 'search_query',
  SEARCH_RESULT: 'search_result',
  ART_REQUEST: 'art_request',
  ART_RESULT: 'art_result',
  ART_SHARED: 'art_shared',
  USER_ART: 'user_art',
  USER_VIDEO: 'user_video',

  // System operation types
  NOTE_SAVED: 'note_saved',
  NOTE_RETRIEVED: 'note_retrieved',
  OBSERVATION_SAVED: 'observation_saved',
  OBSERVATION_RETRIEVED: 'observation_retrieved',
  REMINDER_SET: 'reminder_set',
  REMINDER_DISMISS: 'reminder_dismiss',
  STATUS_UPDATE: 'status_update',
  STATE_UPDATE: 'state_update',
  METER_OVERRIDE: 'meter_override',

  // Learning system types
  LEARNED_ADD: 'learned_add',
  LEARNED_UPDATE: 'learned_update',
  LEARNED_CITE: 'learned_cite',
  LEARNED_PROMOTE: 'learned_promote',
  LEARNED_DELETE: 'learned_delete',
  LEARNED_LIST: 'learned_list',

  // Question system types
  QUESTION_ADD: 'question_add',
  QUESTION_NOTE: 'question_note',
  QUESTION_RESOLVE: 'question_resolve',
  QUESTION_DISSOLVE: 'question_dissolve',
  QUESTION_LIST: 'question_list',

  // Pin/image system types
  PIN_UPDATE: 'pin_update',

  // System types
  EXIST: 'exist',
  PARSE_ERROR: 'parse_error',
  ACTION_ERROR: 'action_error',
  SLEEP: 'sleep',
  USER_STATUS_UPDATE: 'user_status_update',
  SUMMARIZE: 'summarize',

  // Media types
  IMAGE: 'image',
  TEXT: 'text',
  EPHEMERAL: 'ephemeral',

  // Web agent types - scheduled topic digests (see packages/services/src/web-agent)
  WEB_DIGEST: 'web_digest'
} as const;

export type HistoryType = typeof HISTORY_TYPES[keyof typeof HISTORY_TYPES];

const VALID_HISTORY_TYPES = new Set(Object.values(HISTORY_TYPES));

/**
 * History entry types that contain meaningful text content worth embedding
 * for semantic search / RAG retrieval. Types NOT in this set are either
 * binary (images), markers (sleep/summarize), or error metadata.
 *
 * This is the canonical allowlist — new types must explicitly opt in.
 */
export const EMBEDDABLE_TYPES = new Set([
  HISTORY_TYPES.THOUGHT,
  HISTORY_TYPES.USER_MESSAGE,
  HISTORY_TYPES.MESSAGE_TO_USER,
  HISTORY_TYPES.CURIOSITY,
  HISTORY_TYPES.REMEMBER,
  HISTORY_TYPES.SEARCH_QUERY,
  HISTORY_TYPES.SEARCH_RESULT,
  HISTORY_TYPES.ART_REQUEST,
  HISTORY_TYPES.LEARNED_ADD,
  HISTORY_TYPES.LEARNED_UPDATE,
  HISTORY_TYPES.LEARNED_CITE,
  HISTORY_TYPES.QUESTION_ADD,
  HISTORY_TYPES.QUESTION_NOTE,
  HISTORY_TYPES.QUESTION_RESOLVE,
  HISTORY_TYPES.NOTE_SAVED,
  HISTORY_TYPES.EXIST,
  HISTORY_TYPES.COLD_STORAGE,
  HISTORY_TYPES.WEB_DIGEST,
]);

/**
 * History entry types excluded from embedding generation.
 * Inverse of EMBEDDABLE_TYPES — used by the SIM backfill endpoint
 * to filter out non-textual or non-semantic entries.
 *
 * Moved from platforms/cloudflare/src/routes/sim.js to keep the
 * type taxonomy in the package layer.
 */
export const EMBEDDING_EXCLUDED_TYPES = new Set([
  HISTORY_TYPES.ART_RESULT,
  HISTORY_TYPES.USER_ART,
  HISTORY_TYPES.SLEEP,
  HISTORY_TYPES.STATUS_UPDATE,
  HISTORY_TYPES.STATE_UPDATE,
  HISTORY_TYPES.SUMMARIZE,
  HISTORY_TYPES.USER_STATUS_UPDATE,
  HISTORY_TYPES.PARSE_ERROR,
  HISTORY_TYPES.ACTION_ERROR,
  HISTORY_TYPES.PIN_UPDATE,
  HISTORY_TYPES.IMAGE,
  HISTORY_TYPES.EPHEMERAL,
  HISTORY_TYPES.METER_OVERRIDE,
]);

/**
 * Parameters for logHistory
 */
export interface LogHistoryParams extends AddHistoryOptions {
  /** Database instance */
  db: DrizzleD1;
  /** History entry type (must be valid HISTORY_TYPES value) */
  type: HistoryType | string;
  /** Primary content of the history entry */
  content: string;
  /** Internal reasoning/notes (optional) */
  internal?: string | null;
  /** Cycle identifier for grouping (optional) */
  cycleId?: string | number | null;
  /** If true, swallow logging errors instead of throwing */
  silent?: boolean;
  /** If true, auto-capture meter snapshot (default: true) */
  autoCaptureMeterSnapshot?: boolean;
}

/**
 * @description Standardized history logging function with type validation
 *
 * Provides a validated interface for creating history entries with consistent
 * error handling and optional silent mode for non-critical logging failures.
 *
 * METER SNAPSHOT:
 * By default, this function automatically captures a meter snapshot (Clio's internal
 * state like "A7 C6 N10 E8 D7 X3 Y5") and stores it with each history entry.
 *
 * Control meter snapshot behavior:
 * - Default: Auto-captures meter snapshot
 * - `autoCaptureMeterSnapshot: false`: Skips auto-capture entirely
 * - `meterSnapshot: 'A7 C6...'`: Uses provided value, skips auto-capture
 *
 * @upstream Called by: Tool handlers, action executors
 * @downstream Calls: addHistory() from ./history, getMeterSnapshot() from ./meters
 *
 * @param params - Logging parameters
 * @returns Result from addHistory() call, or null if silent mode and error
 *
 * @throws {Error} If type is invalid or required parameters missing (unless silent)
 *
 * @example
 * // Basic usage - auto-captures meter snapshot
 * await logHistory({ db, type: 'thought', content: 'I am thinking' });
 *
 * // With metadata for tracking provider/model info
 * await logHistory({
 *   db,
 *   type: 'search_result',
 *   content: result.summary,
 *   metadata: {
 *     provider: 'anthropic',
 *     model: 'claude-sonnet-4-20250514',
 *     tool: 'web_search_20250305',
 *     durationMs: 1234
 *   }
 * });
 *
 * // With explicit meter snapshot (skips auto-capture)
 * await logHistory({
 *   db,
 *   type: 'thought',
 *   content: 'Processing...',
 *   meterSnapshot: 'A7 C6 N10 E8 D7 X3 Y5'
 * });
 *
 * // Disable auto-capture for performance
 * await logHistory({
 *   db,
 *   type: 'exist',
 *   content: '',
 *   autoCaptureMeterSnapshot: false
 * });
 *
 * // Silent mode for non-critical entries
 * await logHistory({ db, type: 'status_update', content: 'Updated', silent: true });
 */
export async function logHistory({
  db,
  type,
  content,
  internal,
  cycleId = null,
  silent = false,
  autoCaptureMeterSnapshot = true,
  meterSnapshot,
  ...options
}: LogHistoryParams & { meterSnapshot?: string | null }): Promise<{ id: number } | null> {
  // Validate required parameters
  if (!db) {
    const error = new Error('logHistory: db parameter is required');
    if (silent) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }

  if (!type) {
    const error = new Error('logHistory: type parameter is required');
    if (silent) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }

  if (content === undefined || content === null) {
    const error = new Error('logHistory: content parameter is required (can be empty string)');
    if (silent) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }

  // Validate type is known
  if (!VALID_HISTORY_TYPES.has(type as HistoryType)) {
    const error = new Error(
      `logHistory: Unknown history type "${type}". Must be one of: ${[...VALID_HISTORY_TYPES].join(', ')}`
    );
    if (silent) {
      console.warn(error.message);
      return null;
    }
    throw error;
  }

  try {
    const numericCycleId = cycleId !== null && cycleId !== undefined
      ? (typeof cycleId === 'string' ? parseInt(cycleId, 10) : cycleId)
      : null;

    // Auto-capture meter snapshot if enabled and not already provided
    let finalMeterSnapshot = meterSnapshot;
    if (!finalMeterSnapshot && autoCaptureMeterSnapshot) {
      try {
        finalMeterSnapshot = await getMeterSnapshot(db);
      } catch (snapshotErr) {
        // Don't fail the history entry if snapshot fails
        console.warn('logHistory: Failed to get meter snapshot:', (snapshotErr as Error).message);
      }
    }

    return await addHistory(
      db,
      type,
      content,
      internal ?? null,
      Number.isNaN(numericCycleId) ? null : numericCycleId,
      { ...options, meterSnapshot: finalMeterSnapshot }
    );
  } catch (error) {
    if (silent) {
      console.warn(`logHistory: Failed to log ${type} entry (silent mode):`, (error as Error).message);
      return null;
    }
    throw error;
  }
}

/**
 * Parameters for batch history logging
 */
export interface LogHistoryBatchParams extends AddHistoryOptions {
  /** Database instance */
  db: DrizzleD1;
  /** Cycle identifier for all entries */
  cycleId?: string | number | null;
  /** Array of entry objects */
  entries: Array<{
    type: HistoryType | string;
    content: string;
    internal?: string | null;
  }>;
  /** If true, continue on individual entry failures */
  silent?: boolean;
}

/**
 * @description Batch history logging for multiple entries
 *
 * Logs multiple history entries in sequence, with optional error handling.
 * Useful for operations that create multiple related history entries.
 *
 * @upstream Called by: Operations that need to log multiple related entries
 * @downstream Calls: logHistory() for each entry
 *
 * @param params - Batch logging parameters
 * @returns Array of results from each logHistory call
 *
 * @throws {Error} If any entry fails and silent=false
 *
 * @example
 * await logHistoryBatch({
 *   db,
 *   cycleId,
 *   entries: [
 *     { type: 'thought', content: 'Starting operation' },
 *     { type: 'search_query', content: 'query terms' },
 *     { type: 'search_result', content: 'results found' }
 *   ]
 * });
 */
export async function logHistoryBatch({
  db,
  cycleId,
  entries,
  silent = false,
  ...options
}: LogHistoryBatchParams): Promise<Array<{ id: number } | null>> {
  if (!Array.isArray(entries)) {
    throw new Error('logHistoryBatch: entries must be an array');
  }

  const results: Array<{ id: number } | null> = [];

  for (const entry of entries) {
    try {
      const result = await logHistory({
        db,
        type: entry.type,
        content: entry.content,
        internal: entry.internal,
        cycleId,
        silent,
        ...options
      });
      results.push(result);
    } catch (error) {
      if (!silent) {
        throw error;
      }
      results.push(null);
    }
  }

  return results;
}

/**
 * Parameters for operation result logging
 */
export interface LogOperationResultParams extends AddHistoryOptions {
  /** Database instance */
  db: DrizzleD1;
  /** Cycle identifier */
  cycleId?: string | number | null;
  /** Operation name (e.g., 'search', 'art_generation') */
  operation: string;
  /** Whether operation succeeded */
  success: boolean;
  /** Content for success case */
  successContent?: string;
  /** Content for failure case */
  failureContent?: string;
  /** Error details for failure case */
  error?: Error | string;
  /** Internal notes */
  internal?: string | null;
}

/**
 * @description Create standardized success/failure history entries
 *
 * Convenience function for operations that have clear success/failure outcomes.
 * Automatically formats content based on operation result.
 *
 * @upstream Called by: Operations with binary outcomes (search, API calls, etc.)
 * @downstream Calls: logHistory()
 *
 * @param params - Result logging parameters
 * @returns Result from logHistory call
 *
 * @example
 * // Success case
 * await logOperationResult({
 *   db, cycleId,
 *   operation: 'search',
 *   success: true,
 *   successContent: `Found ${results.length} results for "${query}"`
 * });
 *
 * // Failure case
 * await logOperationResult({
 *   db, cycleId,
 *   operation: 'art_generation',
 *   success: false,
 *   failureContent: 'Failed to generate image',
 *   error: artError
 * });
 */
export async function logOperationResult({
  db,
  cycleId,
  operation,
  success,
  successContent,
  failureContent,
  error,
  internal,
  ...options
}: LogOperationResultParams): Promise<{ id: number } | null> {
  let content: string;

  if (success) {
    content = successContent || `${operation} completed successfully`;
  } else {
    const errorDetails = error
      ? (typeof error === 'string' ? error : error.message)
      : '';
    content = failureContent || `${operation} failed${errorDetails ? `: ${errorDetails}` : ''}`;
  }

  return logHistory({
    db,
    type: success ? HISTORY_TYPES.THOUGHT : HISTORY_TYPES.ACTION_ERROR,
    content,
    internal,
    cycleId,
    ...options
  });
}
