/**
 * SLEEP Handler
 *
 * @module @persistence/tools/definitions/sleep/handler
 * @description Pauses the agent's thinking cycles for a duration.
 *
 * NOTE: This handler implements the CORE sleep logic (setting sleep_until timestamp).
 * The NOTIFICATIONS (Telegram/Discord messages) must be handled by the platform layer,
 * as they require platform-specific service integrations.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: setState(), logHistory() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { SleepParams } from './params';
import { logHistory, HISTORY_TYPES, setState } from '@persistence/db';

/** Minimum sleep duration (5 minutes) */
const MIN_SLEEP_SECONDS = 300;
/** Maximum sleep duration (54 minutes - default) */
const MAX_SLEEP_SECONDS = 3240;

/**
 * Handle SLEEP action.
 *
 * Sets the sleep_until timestamp to pause thinking cycles.
 * Returns metadata that the platform layer can use for notifications.
 *
 * @param params - The validated SLEEP parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult with sleep metadata for platform notification handling
 */
export const handler: ToolHandler<SleepParams> = async (
  params: SleepParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { duration, message, wakeReminder, internal } = params;
  const { db, cycleId } = ctx;

  try {
    const typedDb = db as Parameters<typeof setState>[0];

    // Clamp duration to valid range
    const sleepDuration = Math.max(MIN_SLEEP_SECONDS, Math.min(MAX_SLEEP_SECONDS, duration || 1800));
    const now = new Date();
    const sleepUntil = new Date(now.getTime() + sleepDuration * 1000);

    // Set sleep_until in state
    await setState(typedDb, 'sleep_until', sleepUntil.toISOString());

    // Log sleep to history
    await logHistory({
      db: typedDb,
      type: HISTORY_TYPES.SLEEP,
      content: message || `Going to sleep for ${Math.round(sleepDuration / 60)} minutes`,
      internal: internal ?? `Sleep duration: ${sleepDuration}s`,
      cycleId
    });

    return {
      success: true,
      type: 'sleep',
      data: {
        duration: sleepDuration,
        sleepUntil: sleepUntil.toISOString(),
        message,
        wakeReminder,
        // Platform layer uses these for notifications
        needsNotification: !!message,
        needsReminder: !!wakeReminder
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to initiate sleep: ${(error as Error).message}`
    };
  }
};
