/**
 * Reminders Formatter for Context
 *
 * @module @persistence/memory/context/formatters/reminders
 * @description Formats reminders for inclusion in Claude's system prompt.
 *
 * REMINDERS FORMAT IN CONTEXT:
 * ```
 * MY REMINDERS (3 active, 1 triggered):
 * * Check in with the user about the project <- DUE NOW
 * * Review meeting notes [persistent]
 * * Follow up on email [on_user_message]
 * ```
 *
 * KEY BEHAVIORS:
 * - Shows all active reminders
 * - Highlights due reminders with * and <- DUE NOW marker
 * - Shows condition type for non-persistent reminders
 * - Compact format to minimize context tokens
 *
 * @upstream Used by:
 *   - context/builder/ - Uses formatRemindersSection for Block 4
 * @downstream Calls:
 *   - No dependencies (pure string formatting)
 */

import type { ReminderEntry, FormatOptions } from '../types';
import type { ReminderFormatOptions } from './types';

// ============================================================================
// SINGLE REMINDER FORMATTING
// ============================================================================

/**
 * Formats a single reminder entry for context.
 *
 * @param entry - Reminder entry to format
 * @param isDue - Whether this reminder is currently due
 * @returns Formatted reminder string
 *
 * @example
 * formatReminderEntry(entry, true)
 * // Returns: '* Check in with the user about the project <- DUE NOW'
 *
 * formatReminderEntry(entry, false)
 * // Returns: '* Follow up on email [on_user_message]'
 */
export function formatReminderEntry(
  entry: ReminderEntry,
  isDue: boolean = false
): string {
  // Bullet style: * for due, * for not due (consistent)
  const bullet = isDue ? '* ' : '* ';

  // Condition text - hide for persistent (default)
  const conditionText = entry.condition === 'persistent' ? '' : ` [${entry.condition}]`;

  // Due marker
  const dueMarker = isDue ? ' <- DUE NOW' : '';

  return `${bullet}${entry.content}${conditionText}${dueMarker}`;
}

// ============================================================================
// SECTION FORMATTING
// ============================================================================

/**
 * Formats the complete reminders section for context.
 *
 * Produces a section suitable for Block 4:
 * ```
 * MY REMINDERS (3 active, 1 triggered):
 * * Check in with the user about the project <- DUE NOW
 * * Review meeting notes [persistent]
 * * Follow up on email [on_user_message]
 * ```
 *
 * @param entries - Array of reminder entries
 * @param options - Formatting options including dueReminderIds
 * @returns Formatted reminders section or empty string if no entries
 *
 * @example
 * formatRemindersSection(entries, { dueReminderIds: [1, 3] })
 * // Returns: "MY REMINDERS (3 active, 2 triggered):\n* Item <- DUE NOW\n..."
 */
export function formatRemindersSection(
  entries: ReminderEntry[],
  options: ReminderFormatOptions = {}
): string {
  if (entries.length === 0) {
    return '';
  }

  const { dueReminderIds = [] } = options;
  const dueSet = new Set(dueReminderIds);
  const dueCount = dueReminderIds.length;

  // Build header
  const triggeredPart = dueCount > 0 ? `, ${dueCount} triggered` : '';
  const header = `MY REMINDERS (${entries.length} active${triggeredPart}):`;

  // Format each reminder
  const lines = entries.map(entry => {
    const isDue = dueSet.has(entry.id);
    return formatReminderEntry(entry, isDue);
  });

  return `${header}\n${lines.join('\n')}\n\n`;
}
