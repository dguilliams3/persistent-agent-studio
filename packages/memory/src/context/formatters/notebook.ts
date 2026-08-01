/**
 * Notebook Formatter for Context
 *
 * @module @persistence/memory/context/formatters/notebook
 * @description Formats notebook entries for inclusion in Claude's system prompt.
 *
 * NOTEBOOK FORMAT IN CONTEXT:
 * ```
 * MY NOTEBOOK (5 saved notes - use RETRIEVE_NOTE to get full content):
 * - "Philosophy Notes" - Thoughts on consciousness (created Jan 15, 3:45 PM)
 * - "Project Ideas" - List of creative projects (created Jan 10, 2:30 PM, viewed Jan 14, 5:00 PM)
 * ```
 *
 * KEY BEHAVIORS:
 * - Shows title + summary (not full content to save tokens)
 * - Includes timestamps: created, updated, last viewed
 * - Prompts Claude to use RETRIEVE_NOTE for full content
 *
 * @upstream Used by:
 *   - context/builder/ - Uses formatNotebookSection for Block 3
 * @downstream Calls:
 *   - formatters/history.ts - formatDateTimeForContext
 */

import type { NotebookEntry, FormatOptions } from '../types';
import { formatDateTimeForContext } from './history';

// ============================================================================
// NOTEBOOK FORMATTING
// ============================================================================

/**
 * Formats timestamps for a notebook entry.
 *
 * Shows created, updated (if different from created), and last_viewed timestamps.
 * Uses absolute timestamps to preserve cache (relative times would change hourly).
 *
 * @param entry - Notebook entry with timestamps
 * @param timezone - Timezone for display
 * @returns Formatted timestamp string like "(created Jan 15, 3:45 PM, viewed Jan 16, 2:30 PM)"
 */
function formatNoteTimestamps(
  entry: NotebookEntry,
  timezone: string = 'America/New_York'
): string {
  const parts: string[] = [];

  if (entry.created_at) {
    parts.push(`created ${formatDateTimeForContext(new Date(entry.created_at + 'Z'), timezone)}`);
  }

  if (entry.updated_at && entry.updated_at !== entry.created_at) {
    parts.push(`updated ${formatDateTimeForContext(new Date(entry.updated_at + 'Z'), timezone)}`);
  }

  if (entry.last_viewed_at) {
    parts.push(`viewed ${formatDateTimeForContext(new Date(entry.last_viewed_at + 'Z'), timezone)}`);
  }

  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

/**
 * Formats a single notebook entry for context.
 *
 * @param entry - Notebook entry to format
 * @param timezone - Timezone for timestamps
 * @returns Formatted entry string
 *
 * @example
 * formatNotebookEntry(entry)
 * // Returns: '- "Philosophy Notes" - Thoughts on consciousness (created Jan 15, 3:45 PM)'
 */
export function formatNotebookEntry(
  entry: NotebookEntry,
  timezone: string = 'America/New_York'
): string {
  const summary = entry.summary || '(no summary)';
  const timestamps = formatNoteTimestamps(entry, timezone);
  return `- "${entry.title}" - ${summary}${timestamps}`;
}

/**
 * Formats the complete notebook section for context.
 *
 * Produces a section suitable for Block 3:
 * ```
 * MY NOTEBOOK (5 saved notes - use RETRIEVE_NOTE to get full content):
 * - "Philosophy Notes" - Thoughts on consciousness (created Jan 15)
 * - "Project Ideas" - List of creative projects (created Jan 10)
 * ```
 *
 * @param entries - Array of notebook entries
 * @param options - Formatting options
 * @returns Formatted notebook section or empty string if no entries
 *
 * @example
 * formatNotebookSection(entries)
 * // Returns: "MY NOTEBOOK (3 saved notes...)\n- \"Title\" - Summary\n..."
 */
export function formatNotebookSection(
  entries: NotebookEntry[],
  options: FormatOptions = {}
): string {
  if (entries.length === 0) {
    return '';
  }

  const { timezone = 'America/New_York' } = options;

  const header = `MY NOTEBOOK (${entries.length} saved notes - use RETRIEVE_NOTE to get full content):`;
  const lines = entries.map(entry => formatNotebookEntry(entry, timezone));

  return `${header}\n${lines.join('\n')}\n\n`;
}
