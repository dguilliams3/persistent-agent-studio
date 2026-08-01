/**
 * Result of adding a reminder.
 *
 * @module @persistence/db/llm-storage/ReminderAddResult
 * @upstream Called by:
 *   - llm-storage/reminders.ts
 *   - llm-storage/index.ts
 */

export interface ReminderAddResult {
  id: number;
  condition: string;
}
