/**
 * Observations Formatter for Context
 *
 * @module @persistence/memory/context/formatters/observations
 * @description Formats user observations for inclusion in Claude's system prompt.
 *
 * OBSERVATIONS FORMAT IN CONTEXT:
 * ```
 * MY OBSERVATIONS ABOUT THE USER (3 entries - use RETRIEVE_OBSERVATION to review):
 * - "Work Schedule" - The user typically works 9-5 on weekdays
 * - "Music Preferences" - Enjoys jazz and classical music
 * ```
 *
 * KEY BEHAVIORS:
 * - Shows title + summary (not full content to save tokens)
 * - Prompts Claude to use RETRIEVE_OBSERVATION for full content
 * - Stable content - observations change rarely
 *
 * @upstream Used by:
 *   - context/builder/ - Uses formatObservationsSection for Block 3
 * @downstream Calls:
 *   - No dependencies (pure string formatting)
 */

import type { ObservationEntry, FormatOptions } from '../types';

// ============================================================================
// OBSERVATIONS FORMATTING
// ============================================================================

/**
 * Formats a single observation entry for context.
 *
 * @param entry - Observation entry to format
 * @returns Formatted entry string
 *
 * @example
 * formatObservationEntry(entry)
 * // Returns: '- "Work Schedule" - The user typically works 9-5 on weekdays'
 */
export function formatObservationEntry(entry: ObservationEntry): string {
  const summary = entry.summary || '(no summary)';
  return `- "${entry.title}" - ${summary}`;
}

/**
 * Formats the complete observations section for context.
 *
 * Produces a section suitable for Block 3:
 * ```
 * MY OBSERVATIONS ABOUT THE USER (3 entries - use RETRIEVE_OBSERVATION to review):
 * - "Work Schedule" - The user typically works 9-5 on weekdays
 * - "Music Preferences" - Enjoys jazz and classical music
 * ```
 *
 * @param entries - Array of observation entries
 * @param options - Formatting options (unused but for consistency)
 * @returns Formatted observations section or empty string if no entries
 *
 * @example
 * formatObservationsSection(entries)
 * // Returns: "MY OBSERVATIONS ABOUT THE USER (2 entries...)\n- \"Title\" - Summary\n..."
 */
export function formatObservationsSection(
  entries: ObservationEntry[],
  options: FormatOptions = {}
): string {
  if (entries.length === 0) {
    return '';
  }

  const header = `MY OBSERVATIONS ABOUT THE USER (${entries.length} entries - use RETRIEVE_OBSERVATION to review):`;
  const lines = entries.map(entry => formatObservationEntry(entry));

  return `${header}\n${lines.join('\n')}\n\n`;
}
