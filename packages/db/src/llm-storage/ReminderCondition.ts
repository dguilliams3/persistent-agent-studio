/**
 * Condition types for reminders.
 * - 'persistent': Always shown in context
 * - 'next_user_message': Only shown when user sends a message
 * - 'after:YYYY-MM-DD': Only shown after the specified date
 *
 * @module @persistence/db/llm-storage/ReminderCondition
 * @upstream Called by:
 *   - llm-storage/reminders.ts
 *   - llm-storage/index.ts
 */

export type ReminderCondition = 'persistent' | 'next_user_message' | `after:${string}`;
