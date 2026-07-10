/**
 * REMINDER Parameter Types
 *
 * @module @persistence/tools/definitions/reminder/params
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the REMINDER tool.
 * Reminder management.
 */
export interface ReminderParams extends BaseToolParams {
  /** Operation: "set" or "dismiss" (required) */
  op: 'set' | 'dismiss';
  /** Reminder content (required when op is "set") */
  content?: string;
  /** Trigger condition (required when op is "set") */
  condition?: string;
  /** Reminder ID (required when op is "dismiss") */
  id?: number;
}
