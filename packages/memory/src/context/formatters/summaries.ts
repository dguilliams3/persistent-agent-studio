/**
 * Summaries Formatter for Context
 *
 * @module @persistence/memory/context/formatters/summaries
 * @description Formats summaries for inclusion in Claude's system prompt.
 *
 * SUMMARY FORMAT IN CONTEXT:
 * ```
 * --- Summary #1 (20 entries from Jan 15, 3:45 PM to Jan 15, 5:30 PM) ---
 * Had a meandering conversation with the user about philosophy and AI consciousness.
 * We discussed attachment theory and how it might apply to human-AI relationships...
 * ```
 *
 * KEY BEHAVIORS:
 * - Shows entry count and date range for context
 * - Numbered for reference in conversation
 * - First-person narrative style from Claude's perspective
 * - Prefers covered_range over covered_start for full date information
 *
 * @upstream Used by:
 *   - context/builder/ - Uses formatSummarySection for Block 3/4
 * @downstream Calls:
 *   - formatters/history.ts - formatDateTimeForContext
 */

import type { Summary } from '../../types';
import type { SummaryFormatOptions, FormatOptions } from './types';
import { formatDateTimeForContext } from './history';

// ============================================================================
// SINGLE SUMMARY FORMATTING
// ============================================================================

/**
 * Formats a single summary for context display.
 *
 * Produces consistent formatting with date range prefix so Claude knows
 * when events occurred:
 *
 * ```
 * --- Summary #1 (20 entries from Jan 15, 3:45 PM to Jan 15, 5:30 PM) ---
 * summary text here...
 * ```
 *
 * Prefers covered_range (full range) over covered_start (single timestamp).
 *
 * @param summary - Summary object to format
 * @param index - 1-based index for numbering (null to omit number)
 * @param timezone - Timezone for fallback date formatting
 * @returns Formatted summary string
 *
 * @example
 * formatSummaryForContext(summary, 1)
 * // Returns:
 * // "--- Summary #1 (20 entries from Jan 15, 3:45 PM to Jan 16, 2:30 PM) ---
 * // I had a conversation with the user about..."
 */
export function formatSummaryForContext(
  summary: Summary,
  index: number | null = null,
  timezone: string = 'America/New_York'
): string {
  // Prefer covered_range (full date range) over covered_start (single date)
  let dateLabel: string;
  if (summary.covered_range) {
    // Use full human-readable range (shows start AND end dates)
    dateLabel = summary.covered_range;
  } else if (summary.covered_start) {
    // Fall back to single date from ISO timestamp
    const startDate = new Date(summary.covered_start);
    dateLabel = formatDateTimeForContext(startDate, timezone);
  } else {
    dateLabel = 'unknown date';
  }

  // Build header - format: "--- Summary N (X entries from RANGE) ---"
  const indexLabel = index !== null ? `#${index} ` : '';
  const entryCount = summary.message_count || '?';

  return `--- Summary ${indexLabel}(${entryCount} entries from ${dateLabel}) ---\n${summary.summary}`;
}

// ============================================================================
// SECTION FORMATTING
// ============================================================================

/**
 * Formats the summaries prefix section for context.
 *
 * These are older summaries that go in Block 3 (cached).
 *
 * @param summaries - Array of summaries
 * @param options - Formatting options
 * @returns Formatted summaries section
 *
 * @example
 * formatSummariesPrefixSection(summaries)
 * // Returns: "SUMMARIES OF EARLIER HISTORY:\n--- Summary #1 (...)---\n..."
 */
export function formatSummariesPrefixSection(
  summaries: Summary[],
  options: SummaryFormatOptions = {}
): string {
  if (summaries.length === 0) {
    return '';
  }

  const {
    timezone = 'America/New_York',
    startIndex = 1
  } = options;

  const header = 'SUMMARIES OF EARLIER HISTORY:';
  const formattedSummaries = summaries.map((s, i) =>
    formatSummaryForContext(s, startIndex + i, timezone)
  );

  return `${header}\n${formattedSummaries.join('\n\n')}\n\n`;
}

/**
 * Formats the summaries tail section for context.
 *
 * These are newer summaries that go in Block 4 (uncached).
 * Includes [END SUMMARIES] marker to signal transition to live history.
 *
 * @param summaries - Array of summaries
 * @param prefixCount - Number of summaries in prefix (for correct numbering)
 * @param options - Formatting options
 * @returns Formatted summaries section
 *
 * @example
 * formatSummariesTailSection(summaries, 5)
 * // Returns: "RECENT SUMMARIES (3 new):\n--- Summary #6 (...) ---\n...\n[END SUMMARIES]"
 */
export function formatSummariesTailSection(
  summaries: Summary[],
  prefixCount: number = 0,
  options: SummaryFormatOptions = {}
): string {
  const { timezone = 'America/New_York' } = options;

  if (summaries.length === 0) {
    // Still add end marker if there were prefix summaries
    return prefixCount > 0 ? '[END SUMMARIES]\n\n' : '';
  }

  const header = `RECENT SUMMARIES (${summaries.length} new):`;
  const formattedSummaries = summaries.map((s, i) =>
    formatSummaryForContext(s, prefixCount + i + 1, timezone)
  );

  return `${header}\n${formattedSummaries.join('\n\n')}\n[END SUMMARIES]\n\n`;
}

/**
 * Formats promoted summaries section for context.
 *
 * Promoted summaries are pinned to Block 2 for tighter cache coupling.
 * They bypass the normal buffer rotation and stay in stable context.
 *
 * @param summaries - Array of promoted summaries
 * @param options - Formatting options
 * @returns Formatted promoted summaries section
 *
 * @example
 * formatPromotedSummariesSection(summaries)
 * // Returns: "\n\nPROMOTED SUMMARIES (pinned to stable context):\n..."
 */
export function formatPromotedSummariesSection(
  summaries: Summary[],
  options: SummaryFormatOptions = {}
): string {
  if (summaries.length === 0) {
    return '';
  }

  const { timezone = 'America/New_York' } = options;

  const header = 'PROMOTED SUMMARIES (pinned to stable context):';
  const formattedSummaries = summaries.map(s => {
    const dateStr = formatDateTimeForContext(new Date(s.created_at + 'Z'), timezone);
    return `[${dateStr}] ${s.summary}`;
  });

  return `\n\n${header}\n${formattedSummaries.join('\n\n')}\n`;
}
