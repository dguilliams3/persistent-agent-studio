/**
 * A reminder entry from the database.
 * Represents alerts that persist across thinking cycles.
 *
 * @module @persistence/db/llm-storage/ReminderEntry
 * @upstream Called by:
 *   - llm-storage/reminders.ts
 *   - llm-storage/index.ts
 */

export interface ReminderEntry {
  id: number;
  content: string;
  condition: string | null;  // ReminderCondition or custom
  triggered: number;         // 0 = active, 1 = triggered
  created_at: string;
  dismissed_at: string | null;
}
