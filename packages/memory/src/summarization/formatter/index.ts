/**
 * Summarization Formatters
 *
 * @module @persistence/tools/definitions/summarize/formatter
 * @description Barrel export for entry and summary formatters.
 *
 * The formatters transform raw database records into text suitable for
 * LLM summarization prompts. They handle:
 *
 * - Entry type → emoji mapping (💭 thought, 👤 user_message, etc.)
 * - ID tracking with [ID:N] markers
 * - Image replacement with [IMAGE] placeholder
 * - Timestamp formatting in Eastern Time
 * - Time range computation
 * - Token estimation and truncation
 *
 * USAGE:
 * ```typescript
 * import {
 *   formatEntriesForSummarization,
 *   computeTimeRange,
 *   estimateTokens
 * } from '@persistence/tools/definitions/summarize/formatter';
 *
 * const result = formatEntriesForSummarization(entries, {
 *   maxTotalTokens: 8000,
 *   timezone: 'America/New_York'
 * });
 * ```
 *
 * @upstream Used by: summarization service
 * @downstream Aggregates: formatter modules
 */

// Types
export type {
  FormattedEntry,
  FormatEntriesOptions,
  FormattedEntriesResult,
  TimeRange,
  TimeRangeOptions,
  BatchFormatOptions,
  BatchFormattedResult,
  FormattedSummary,
  FormatSummariesOptions,
  FormattedSummariesResult,
  EntryFormatter
} from './types';

// Constants
export { DEFAULT_TYPE_ICONS } from './types';

// Entry formatting
export {
  formatEntriesForSummarization,
  computeTimeRange,
  formatTimeRange,
  estimateTokens,
  canSummarize
} from './format-entries';
