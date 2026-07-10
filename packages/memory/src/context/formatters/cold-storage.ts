/**
 * Cold Storage Formatter for Context
 *
 * @module @persistence/memory/context/formatters/cold-storage
 * @description Formats cold storage entries for inclusion in Claude's system prompt.
 *
 * COLD STORAGE FORMAT IN CONTEXT:
 * ```
 * MY COLD STORAGE (permanent memories I've chosen to preserve):
 * - The user and I first started working together in December 2025
 * - The core philosophy of this project is continuous identity across sessions
 * ```
 *
 * KEY BEHAVIORS:
 * - Simple bullet list format
 * - These are permanent memories chosen for preservation
 * - Minimal formatting to maximize content visibility
 * - Stable content - rarely changes
 *
 * @upstream Used by:
 *   - context/builder/ - Uses formatColdStorageSection for Block 1 extensions
 * @downstream Calls:
 *   - No dependencies (pure string formatting)
 */

import type { ColdStorageEntry, FormatOptions } from '../types';

// ============================================================================
// COLD STORAGE FORMATTING
// ============================================================================

/**
 * Formats a single cold storage entry for context.
 *
 * @param entry - Cold storage entry to format
 * @returns Formatted entry string
 *
 * @example
 * formatColdStorageEntry(entry)
 * // Returns: '- The user and I first started working together in December 2025'
 */
export function formatColdStorageEntry(entry: ColdStorageEntry): string {
  return `- ${entry.content}`;
}

/**
 * Formats the complete cold storage section for context.
 *
 * Produces a section suitable for Block 1 extensions:
 * ```
 * MY COLD STORAGE (permanent memories I've chosen to preserve):
 * - Memory 1
 * - Memory 2
 * ```
 *
 * @param entries - Array of cold storage entries
 * @param options - Formatting options (unused but for consistency)
 * @returns Formatted cold storage section or empty string if no entries
 *
 * @example
 * formatColdStorageSection(entries)
 * // Returns: "MY COLD STORAGE (permanent memories I've chosen to preserve):\n- Memory\n..."
 */
export function formatColdStorageSection(
  entries: ColdStorageEntry[],
  options: FormatOptions = {}
): string {
  if (entries.length === 0) {
    return '';
  }

  const header = "MY COLD STORAGE (permanent memories I've chosen to preserve):";
  const lines = entries.map(entry => formatColdStorageEntry(entry));

  return `${header}\n${lines.join('\n')}\n\n`;
}
