/**
 * Formatter Types for Summarization
 *
 * @module @persistence/tools/definitions/summarize/formatter/types
 * @description Type definitions for formatting history entries into prompts.
 *
 * The formatter transforms raw database entries into a text format suitable
 * for LLM summarization. Key responsibilities:
 *
 * 1. **Type-based formatting** - Different entry types (thought, message, art)
 *    get different emoji prefixes and formatting
 *
 * 2. **ID tracking** - Each entry is tagged with [ID:N] so the LLM can
 *    reference which entries it included in the summary
 *
 * 3. **Image handling** - Base64 images are replaced with [IMAGE] placeholder
 *    to avoid token bloat
 *
 * 4. **Time formatting** - Timestamps converted to human-readable format
 *
 * @upstream Used by: formatter/format-entries.ts
 * @downstream Defined here, no dependencies
 */

import type { HistoryEntry } from '../types';

// ============================================================================
// ENTRY FORMATTING
// ============================================================================

/**
 * A formatted entry ready for inclusion in a summarization prompt.
 */
export interface FormattedEntry {
  /** Original entry ID (for tracking which were included) */
  id: number;

  /** Formatted string for prompt: "[ID:42] 💭 Jan 15 10:30 - Pondering..." */
  formatted: string;

  /** Approximate token count for this entry */
  estimatedTokens: number;

  /** Entry type (preserved for filtering/grouping) */
  type: string;

  /** Original timestamp (for time range calculation) */
  timestamp: Date;
}

/**
 * Options for formatting a batch of entries.
 */
export interface FormatEntriesOptions {
  /** Maximum total tokens for all entries (will truncate if exceeded) */
  maxTotalTokens?: number;

  /** Maximum characters per entry content (truncate with ...) */
  maxEntryLength?: number;

  /** Whether to include [ID:N] markers (default true) */
  includeIdMarkers?: boolean;

  /** Whether to replace images with [IMAGE] (default true) */
  replaceImages?: boolean;

  /** Time zone for formatting timestamps (default 'America/New_York') */
  timezone?: string;

  /** Custom type → emoji mapping (extends defaults) */
  customTypeIcons?: Record<string, string>;
}

/**
 * Result of formatting entries for a prompt.
 */
export interface FormattedEntriesResult {
  /** All formatted entries */
  entries: FormattedEntry[];

  /** Concatenated text block for prompt */
  text: string;

  /** Total estimated tokens */
  totalTokens: number;

  /** Human-readable time range covered */
  timeRange: string;

  /** Entries that were truncated due to token limit */
  truncatedCount: number;

  /** IDs of all entries that were formatted (for validation) */
  includedIds: number[];
}

// ============================================================================
// TYPE-SPECIFIC FORMATTING
// ============================================================================

/**
 * Default emoji icons for entry types.
 */
export const DEFAULT_TYPE_ICONS: Record<string, string> = {
  thought: '💭',
  message_to_user: '📤',
  user_message: '👤',
  curiosity: '🔍',
  art_result: '🖼️',
  user_art: '🎨',
  art_request: '🎨',
  search_query: '🔎',
  search_result: '📰',
  cold_storage: '🧊',
  note_saved: '📓',
  exist: '😌',
  remember: '📝',
  voice_sent: '🎤',
  // Defaults for unknown types
  default: '•'
};

/**
 * Formatter function signature for custom entry formatting.
 */
export type EntryFormatter = (
  entry: HistoryEntry,
  options: FormatEntriesOptions
) => FormattedEntry;

// ============================================================================
// TIME RANGE
// ============================================================================

/**
 * Options for generating time range strings.
 */
export interface TimeRangeOptions {
  /** Timezone for display (default 'America/New_York') */
  timezone?: string;

  /** Include year if dates span years (default true) */
  includeYear?: boolean;

  /** Format: 'full' = "Jan 15 10:30 to Jan 15 14:30 EST"
   *          'compact' = "Jan 15 10:30-14:30 EST"
   *          'date-only' = "Jan 15 to Jan 16" */
  format?: 'full' | 'compact' | 'date-only';
}

/**
 * Computed time range from a set of entries.
 */
export interface TimeRange {
  /** Earliest timestamp */
  start: Date;

  /** Latest timestamp */
  end: Date;

  /** Human-readable range string */
  formatted: string;

  /** Duration in milliseconds */
  durationMs: number;
}

// ============================================================================
// BATCH FORMATTING
// ============================================================================

/**
 * Options for formatting entries in batch mode.
 *
 * Batch mode is used when summarizing large backlogs where entries
 * will be grouped into multiple thematic summaries.
 */
export interface BatchFormatOptions extends FormatEntriesOptions {
  /** Maximum entries per batch (for pagination) */
  maxEntriesPerBatch?: number;

  /** Include entry type counts in output */
  includeTypeCounts?: boolean;

  /** Group entries by type before formatting */
  groupByType?: boolean;
}

/**
 * Result of batch formatting with metadata.
 */
export interface BatchFormattedResult extends FormattedEntriesResult {
  /** Count of entries by type */
  typeCounts?: Record<string, number>;

  /** Entries grouped by type (if groupByType was true) */
  groupedEntries?: Record<string, FormattedEntry[]>;
}

// ============================================================================
// SUMMARY FORMATTING (for meta-summarization)
// ============================================================================

/**
 * A summary formatted for inclusion in meta-summarization prompt.
 */
export interface FormattedSummary {
  /** Summary ID */
  id: number;

  /** 0-based index (for LLM to reference) */
  index: number;

  /** Formatted string: "--- Summary 1 (Jan 10-15) ---\n[text]" */
  formatted: string;

  /** Estimated tokens */
  estimatedTokens: number;

  /** Original covered range */
  coveredRange: string;

  /** Message count from source entries */
  messageCount: number;
}

/**
 * Options for formatting summaries for meta-summarization.
 */
export interface FormatSummariesOptions {
  /** Maximum total tokens */
  maxTotalTokens?: number;

  /** Include metadata pills in formatted output */
  includeMetadata?: boolean;

  /** Header format: 'numbered' = "--- Summary 1 ---"
   *                 'dated' = "--- Summary (Jan 10-15) ---"
   *                 'both' = "--- Summary 1 (Jan 10-15) ---" */
  headerFormat?: 'numbered' | 'dated' | 'both';
}

/**
 * Result of formatting summaries for meta-summarization.
 */
export interface FormattedSummariesResult {
  /** Formatted summaries */
  summaries: FormattedSummary[];

  /** Concatenated text for prompt */
  text: string;

  /** Total estimated tokens */
  totalTokens: number;

  /** Total message count across all summaries */
  totalMessageCount: number;
}
