/**
 * REMINDER Tool Definition
 *
 * @module @persistence/tools/definitions/reminder
 * @description Reminder management.
 *
 * This tool sets or dismisses reminders that ping Clio in the future when
 * conditions are met.
 *
 * @upstream Called by: @persistence/runtime - runThinkingCycle()
 * @downstream Calls: setReminder(), dismissReminder(), logHistory()
 */
import type { ToolDefinition } from '../../types';
import type { ReminderParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { ReminderParams } from './params';

/**
 * REMINDER tool definition with co-located handler.
 */
export const REMINDER: ToolDefinition<ReminderParams> = {
  id: 'REMINDER',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: {
      set: 'reminder_set',
      dismiss: 'reminder_dismiss'
    }
  }
};
