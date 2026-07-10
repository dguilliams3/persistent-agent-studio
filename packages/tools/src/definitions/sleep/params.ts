/**
 * SLEEP Parameter Types
 *
 * @module @persistence/tools/definitions/sleep/params
 */
import type { BaseToolParams } from '../../types';

export interface SleepParams extends BaseToolParams {
  /** Duration in seconds (300-3240) */
  duration: number;
  /** Optional message when going to sleep */
  message?: string;
  /** Optional reminder when waking */
  wakeReminder?: string;
}
