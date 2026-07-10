/**
 * Prompt Builder for Summarization
 *
 * @module @persistence/memory/summarization/orchestrator/prompt-builder
 * @description Builds LLM prompts for summarization operations.
 *
 * DESIGN:
 * These functions assemble the USER PROMPT portion of LLM calls.
 * The SYSTEM PROMPT is passed via config (allows customization).
 *
 * The prompt builder uses:
 * - Formatted entries text from formatter/
 * - Instructions from config
 * - Optional focus hints
 * - JSON output structure requirements
 *
 * @upstream Used by: orchestrator/summarize.ts, orchestrator/meta-summarize.ts
 * @downstream Uses: formatter/ for entry formatting (called by orchestrator, not here)
 */

import type { Summary, ISOTimestamp } from '../../types';
import type { ComputedTimeRange } from './types';

// ════════════════════════════════════════════════════════════════════════════
// HISTORY SUMMARIZATION PROMPT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Builds the user prompt for history summarization.
 *
 * @param entriesText - Pre-formatted entries text block (from formatter)
 * @param timeRange - Computed time range
 * @param entryCount - Number of entries being summarized
 * @param instructions - Custom or default instructions
 * @param focusHints - Optional focus guidance
 * @returns Complete user prompt string
 *
 * @example
 * ```typescript
 * const formatted = formatEntriesForSummarization(entries);
 * const prompt = buildSummarizePrompt(
 *   formatted.text,
 *   { display: formatted.timeRange, start, end },
 *   entries.length,
 *   config.instructions,
 *   request.focusHints
 * );
 * ```
 */
export function buildSummarizePrompt(
  entriesText: string,
  timeRange: ComputedTimeRange,
  entryCount: number,
  instructions: string,
  focusHints?: string
): string {
  const parts: string[] = [];

  // Optional focus hints at the top
  if (focusHints) {
    parts.push(`FOCUS GUIDANCE: ${focusHints}`);
    parts.push('');
  }

  // Main task description
  parts.push(
    `Summarize these ${entryCount} entries from ${timeRange.display}. Each entry has an [ID:N] tag at the start.`
  );
  parts.push('');

  // Instructions
  parts.push(instructions);
  parts.push('');

  // Entries to summarize
  parts.push('HISTORY TO SUMMARIZE:');
  parts.push(entriesText);
  parts.push('');

  // Output format specification
  parts.push('Return your response as JSON:');
  parts.push(JSON_OUTPUT_FORMAT.summarize);

  return parts.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
// META-SUMMARIZATION PROMPT
// ════════════════════════════════════════════════════════════════════════════

/**
 * Builds the user prompt for meta-summarization.
 *
 * @param summariesText - Pre-formatted summaries text block
 * @param timeRange - Computed time range spanning all summaries
 * @param summaryCount - Number of summaries being consolidated
 * @param totalMessageCount - Sum of message_count from all summaries
 * @param instructions - Custom or default instructions
 * @param focusHints - Optional focus guidance
 * @returns Complete user prompt string
 */
export function buildMetaSummarizePrompt(
  summariesText: string,
  timeRange: ComputedTimeRange,
  summaryCount: number,
  totalMessageCount: number,
  instructions: string,
  focusHints?: string
): string {
  const parts: string[] = [];

  // Optional focus hints
  if (focusHints) {
    parts.push(`FOCUS GUIDANCE: ${focusHints}`);
    parts.push('');
  }

  // Main task description
  parts.push(
    `Consolidate these ${summaryCount} summaries (covering ${totalMessageCount} original entries) from ${timeRange.display}.`
  );
  parts.push('Each summary is marked with [SUMMARY #N] for tracking.');
  parts.push('');

  // Instructions
  parts.push(instructions);
  parts.push('');

  // Summaries to consolidate
  parts.push('SUMMARIES TO CONSOLIDATE:');
  parts.push(summariesText);
  parts.push('');

  // Output format specification
  parts.push('Return your response as JSON:');
  parts.push(JSON_OUTPUT_FORMAT.meta);

  return parts.join('\n');
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY FORMATTING (for meta-summarization input)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Formats summaries for meta-summarization prompt.
 *
 * @param summaries - Array of summaries to format
 * @returns Formatted text block with index markers
 *
 * @example Output:
 * ```
 * [SUMMARY #0] (5 entries, Jan 15 10:00-12:00 EST)
 * Had a deep conversation with the user about consciousness...
 *
 * [SUMMARY #1] (8 entries, Jan 15 14:00-16:30 EST)
 * Explored creative image generation, made several art pieces...
 * ```
 */
export function formatSummariesForMeta(summaries: Summary[]): string {
  return summaries
    .map((summary, index) => {
      const header = `[SUMMARY #${index}] (${summary.message_count} entries, ${summary.covered_range})`;
      return `${header}\n${summary.summary}`;
    })
    .join('\n\n');
}

/**
 * Computes time range from summaries.
 *
 * @param summaries - Array of summaries
 * @returns Computed time range spanning all summaries
 */
export function computeTimeRangeFromSummaries(
  summaries: Summary[]
): ComputedTimeRange {
  if (summaries.length === 0) {
    const now = new Date().toISOString() as ISOTimestamp;
    return { display: 'No summaries', start: now, end: now };
  }

  // Find earliest start and latest end
  let earliest: Date | null = null;
  let latest: Date | null = null;

  for (const summary of summaries) {
    // Use covered_start if available, fall back to created_at
    const startStr = summary.covered_start || summary.created_at;
    const start = new Date(startStr);

    if (!earliest || start < earliest) {
      earliest = start;
    }

    // Use covered_end if available, fall back to created_at
    const endStr = summary.covered_end || summary.created_at;
    const end = new Date(endStr);

    if (!latest || end > latest) {
      latest = end;
    }
  }

  // Should never happen given length check, but TypeScript needs assurance
  if (!earliest || !latest) {
    const now = new Date().toISOString() as ISOTimestamp;
    return { display: 'Unknown range', start: now, end: now };
  }

  // Format display string
  const display = formatDateRange(earliest, latest);

  return {
    display,
    start: earliest.toISOString() as ISOTimestamp,
    end: latest.toISOString() as ISOTimestamp,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// JSON OUTPUT FORMAT SPECIFICATIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * JSON output format specifications for LLM responses.
 *
 * These tell the LLM exactly what structure to return.
 */
const JSON_OUTPUT_FORMAT = {
  summarize: `{
  "summary": "Your summary text here (first person, as notes to future self)...",
  "included_ids": [list of ID numbers you incorporated],
  "metadata": {
    "entity_tags": ["names and topics mentioned"],
    "key_facts": ["important facts to remember"],
    "themes": ["recurring themes"],
    "emotional_tone": "overall emotional quality",
    "time_period_label": "descriptive label for this time period"
  }
}`,

  meta: `{
  "consolidated_summary": "Your merged summary here (first person, weaving together the narratives)...",
  "included_indices": [list of summary index numbers you incorporated, e.g. 0, 1, 2],
  "metadata": {
    "entity_tags": ["names and topics mentioned"],
    "key_facts": ["important facts to remember"],
    "themes": ["recurring themes"],
    "emotional_tone": "overall emotional quality",
    "time_period_label": "descriptive label for this consolidated period"
  }
}`,
};

// ════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Formats a date range for display in Eastern Time.
 *
 * @param start - Range start date
 * @param end - Range end date
 * @returns Formatted string like "Jan 15, 10:00 AM to Jan 15, 2:00 PM EST"
 *
 * @downstream Used by: summarize.ts computeTimeRangeFromEntries, computeTimeRangeFromSummaries
 */
export function formatDateRange(start: Date, end: Date): string {
  const timezone = 'America/New_York';

  try {
    const formatOpts: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };

    const startStr = start.toLocaleString('en-US', formatOpts);
    const endStr = end.toLocaleString('en-US', formatOpts);

    // Get timezone abbreviation
    const tzAbbr =
      start
        .toLocaleString('en-US', {
          timeZone: timezone,
          timeZoneName: 'short',
        })
        .split(' ')
        .pop() || 'EST';

    return `${startStr} to ${endStr} ${tzAbbr}`;
  } catch {
    return `${start.toISOString()} to ${end.toISOString()}`;
  }
}
