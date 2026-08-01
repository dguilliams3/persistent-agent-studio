/**
 * REMEMBER Handler
 *
 * @module @persistence/tools/definitions/remember/handler
 * @description Executes the REMEMBER action - stores ephemeral notes in scrolling history.
 *
 * REMEMBER entries have the same lifecycle as normal history:
 * - Fresh in rolling window (fully visible in context)
 * - Ages into summary tier when token thresholds hit
 * - Eventually archived if not semantically relevant
 *
 * Unlike COLD_STORAGE (permanent) or REMINDER (conditional), REMEMBER entries
 * naturally fade over time through the summarization process.
 *
 * @upstream Called by: @persistence/tools/executor during action execution
 * @downstream Calls: logHistory() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { RememberParams } from './params';
import { logHistory, HISTORY_TYPES } from '@persistence/db';

/**
 * Handle REMEMBER action.
 *
 * Records ephemeral notes to scrolling history.
 *
 * @param params - The validated REMEMBER parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult indicating success with stored content
 */
export const handler: ToolHandler<RememberParams> = async (
  params: RememberParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { content, internal } = params;
  const { db, cycleId } = ctx;

  try {
    await logHistory({
      db: db as Parameters<typeof logHistory>[0]['db'],
      type: HISTORY_TYPES.REMEMBER,
      content,
      internal: internal ?? null,
      cycleId
    });

    return {
      success: true,
      type: 'remember',
      data: { content }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to log memory: ${(error as Error).message}`
    };
  }
};
