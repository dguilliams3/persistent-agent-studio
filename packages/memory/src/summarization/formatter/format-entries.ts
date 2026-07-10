/**
 * Entry Formatter for Summarization
 *
 * @module @persistence/tools/definitions/summarize/formatter/format-entries
 * @description Formats history entries into text suitable for LLM summarization.
 *
 * ENTRY FORMAT:
 * ```
 * [ID:42] 💭 Jan 15 10:30 - Pondering the nature of consciousness...
 * [ID:43] 👤 Jan 15 10:31 - USER: "What are you thinking about?"
 * [ID:44] 📤 Jan 15 10:32 - Telling the user about my thoughts on consciousness...
 * ```
 *
 * KEY BEHAVIORS:
 * - Each entry prefixed with [ID:N] for LLM to track inclusions
 * - Emoji prefix based on entry type (💭 thought, 👤 user_message, etc.)
 * - Timestamps in Eastern Time for human readability
 * - Base64 images replaced with [IMAGE] to save tokens
 * - Long entries truncated with ... indicator
 *
 * @upstream Used by: summarization.js formatHistoryEntries()
 * @downstream Uses: formatter/types.ts for type definitions
 */

import type { HistoryEntry } from '../types';
import type {
  FormattedEntry,
  FormatEntriesOptions,
  FormattedEntriesResult,
  TimeRange,
  TimeRangeOptions,
} from './types';
// Import as VALUE (not type) since it's a const object used at runtime
import { DEFAULT_TYPE_ICONS } from './types';

// Re-export the default icons
export { DEFAULT_TYPE_ICONS } from './types';

/**
 * Formats a batch of history entries for summarization.
 *
 * @param entries - Array of history entries from database
 * @param options - Formatting options
 * @returns Formatted result with text block and metadata
 *
 * @example
 * ```typescript
 * const entries = await getOldestHistory(db, 50);
 * const result = formatEntriesForSummarization(entries, {
 *   maxTotalTokens: 8000,
 *   maxEntryLength: 500
 * });
 *
 * console.log(result.text);       // Formatted text block
 * console.log(result.timeRange);  // "Jan 15 10:30 to Jan 15 14:30 EST"
 * console.log(result.includedIds); // [1, 2, 3, ...]
 * ```
 */
export function formatEntriesForSummarization(
  entries: HistoryEntry[],
  options: FormatEntriesOptions = {}
): FormattedEntriesResult {
  const {
    maxTotalTokens = 8000,
    maxEntryLength = 1000,
    includeIdMarkers = true,
    replaceImages = true,
    timezone = 'America/New_York',
    customTypeIcons = {}
  } = options;

  // Merge custom icons with defaults
  const typeIcons = { ...DEFAULT_TYPE_ICONS, ...customTypeIcons };

  // Format each entry
  const formatted: FormattedEntry[] = [];
  let totalTokens = 0;
  let truncatedCount = 0;

  for (const entry of entries) {
    const formattedEntry = formatSingleEntry(entry, {
      maxEntryLength,
      includeIdMarkers,
      replaceImages,
      timezone,
      typeIcons
    });

    // Check if adding this entry would exceed token limit
    if (totalTokens + formattedEntry.estimatedTokens > maxTotalTokens) {
      truncatedCount++;
      continue;
    }

    formatted.push(formattedEntry);
    totalTokens += formattedEntry.estimatedTokens;
  }

  // Build time range
  const timeRange = computeTimeRange(formatted, { timezone });

  // Build text block
  const text = formatted.map((f) => f.formatted).join('\n');

  return {
    entries: formatted,
    text,
    totalTokens,
    timeRange: timeRange.formatted,
    truncatedCount,
    includedIds: formatted.map((f) => f.id)
  };
}

/**
 * Formats a single history entry.
 */
function formatSingleEntry(
  entry: HistoryEntry,
  options: {
    maxEntryLength: number;
    includeIdMarkers: boolean;
    replaceImages: boolean;
    timezone: string;
    typeIcons: Record<string, string>;
  }
): FormattedEntry {
  const { maxEntryLength, includeIdMarkers, replaceImages, timezone, typeIcons } =
    options;

  // Get timestamp
  const timestamp = new Date(entry.created_at);
  const timeStr = formatTimestamp(timestamp, timezone);

  // Get icon
  const icon = typeIcons[entry.type] || typeIcons.default || '•';

  // Process content
  let content = entry.content || '';

  // Handle images
  if (replaceImages && isImageContent(content)) {
    content = '[IMAGE]';
  }

  // Truncate if needed
  if (content.length > maxEntryLength) {
    content = content.substring(0, maxEntryLength - 3) + '...';
  }

  // Handle special types
  content = formatContentByType(entry.type, content, entry.internal);

  // Build formatted string
  const parts: string[] = [];
  if (includeIdMarkers) {
    parts.push(`[ID:${entry.id}]`);
  }
  parts.push(icon);
  parts.push(timeStr);
  parts.push('-');
  parts.push(content);

  const formatted = parts.join(' ');
  const estimatedTokens = Math.ceil(formatted.length / 4);

  return {
    id: entry.id,
    formatted,
    estimatedTokens,
    type: entry.type,
    timestamp
  };
}

/**
 * Formats content based on entry type.
 */
function formatContentByType(
  type: string,
  content: string,
  internal: string | null
): string {
  switch (type) {
    case 'user_message':
      return `USER: "${content}"`;

    case 'message_to_user':
      return internal
        ? `${content} (thinking: ${internal})`
        : content;

    case 'art_result':
      // Extract prompt from content if available
      if (content.includes('[prompt:')) {
        const match = content.match(/\[prompt:\s*([^\]]+)\]/);
        if (match) {
          return `Created art: "${match[1]}"`;
        }
      }
      return 'Created art' + (internal ? `: "${internal}"` : '');

    case 'search_query':
      return `Searched: "${content}"`;

    case 'search_result':
      // Truncate search results more aggressively
      if (content.length > 200) {
        return content.substring(0, 200) + '... [truncated search results]';
      }
      return content;

    case 'thought':
    case 'curiosity':
    case 'exist':
    case 'remember':
    case 'note_saved':
    default:
      return content;
  }
}

/**
 * Checks if content is base64 image data.
 */
function isImageContent(content: string): boolean {
  if (!content) return false;
  return (
    content.startsWith('data:image/') ||
    content.startsWith('/9j/') || // JPEG base64
    content.startsWith('iVBORw') // PNG base64
  );
}

/**
 * Formats a timestamp for display.
 */
function formatTimestamp(date: Date, timezone: string): string {
  try {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    // Fallback if timezone is invalid
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }
}

/**
 * Computes time range from formatted entries.
 */
export function computeTimeRange(
  entries: FormattedEntry[],
  options: TimeRangeOptions = {}
): TimeRange {
  const { timezone = 'America/New_York', format = 'full' } = options;

  if (entries.length === 0) {
    const now = new Date();
    return {
      start: now,
      end: now,
      formatted: 'No entries',
      durationMs: 0
    };
  }

  // Find min/max timestamps
  let start = entries[0].timestamp;
  let end = entries[0].timestamp;

  for (const entry of entries) {
    if (entry.timestamp < start) start = entry.timestamp;
    if (entry.timestamp > end) end = entry.timestamp;
  }

  // Format the range
  const formatted = formatTimeRange(start, end, { timezone, format });

  return {
    start,
    end,
    formatted,
    durationMs: end.getTime() - start.getTime()
  };
}

/**
 * Formats a time range string.
 */
export function formatTimeRange(
  start: Date,
  end: Date,
  options: TimeRangeOptions = {}
): string {
  const { timezone = 'America/New_York', format = 'full' } = options;

  const formatOpts: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    month: 'short',
    day: 'numeric'
  };

  if (format !== 'date-only') {
    formatOpts.hour = 'numeric';
    formatOpts.minute = '2-digit';
    formatOpts.hour12 = true;
  }

  try {
    const startStr = start.toLocaleString('en-US', formatOpts);
    const endStr = end.toLocaleString('en-US', formatOpts);

    // Get timezone abbreviation
    const tzAbbr = start.toLocaleString('en-US', {
      timeZone: timezone,
      timeZoneName: 'short'
    }).split(' ').pop() || 'EST';

    // Same day?
    const sameDay =
      start.toDateString() === end.toDateString();

    if (format === 'compact' && sameDay) {
      // Compact: "Jan 15 10:30-14:30 EST"
      const timeOnly = end.toLocaleString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      return `${startStr}-${timeOnly} ${tzAbbr}`;
    }

    return `${startStr} to ${endStr} ${tzAbbr}`;
  } catch {
    return `${start.toISOString()} to ${end.toISOString()}`;
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Estimates token count for text.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Checks if entries can be summarized (minimum count, etc.).
 */
export function canSummarize(
  entries: HistoryEntry[],
  minCount: number = 5
): { can: boolean; reason?: string } {
  if (entries.length === 0) {
    return { can: false, reason: 'No entries to summarize' };
  }

  if (entries.length < minCount) {
    return {
      can: false,
      reason: `Need at least ${minCount} entries, have ${entries.length}`
    };
  }

  return { can: true };
}
