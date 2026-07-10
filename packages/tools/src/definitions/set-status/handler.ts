/**
 * SET_STATUS Handler
 *
 * @module @persistence/tools/definitions/set-status/handler
 * @description Updates the agent's status line (text, emoji, mood).
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: setState(), logHistory() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { SetStatusParams } from './params';
import { logHistory, HISTORY_TYPES, setState } from '@persistence/db';

/**
 * Handle SET_STATUS action.
 *
 * Updates the agent's status line with optional emoji and mood.
 *
 * @param params - The validated SET_STATUS parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult indicating success
 */
export const handler: ToolHandler<SetStatusParams> = async (
  params: SetStatusParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { content, emoji, mood, internal } = params;
  const { db, cycleId } = ctx;

  if (!content) {
    return {
      success: false,
      error: 'Status content is required'
    };
  }

  try {
    const typedDb = db as Parameters<typeof setState>[0];

    // Update state table entries
    await setState(typedDb, 'current_status', content);
    await setState(typedDb, 'current_status_emoji', emoji ?? null);
    await setState(typedDb, 'current_status_mood', mood ?? null);
    await setState(typedDb, 'current_status_updated', new Date().toISOString());

    // Format display content
    const emojiPrefix = emoji ? `${emoji} ` : '';
    const moodSuffix = mood ? ` (${mood})` : '';
    const displayContent = `${emojiPrefix}${content}${moodSuffix}`;

    // Log to history
    await logHistory({
      db: typedDb,
      type: HISTORY_TYPES.STATUS_UPDATE,
      content: displayContent,
      internal: internal ?? 'Updated my status',
      cycleId
    });

    return {
      success: true,
      type: 'status_update',
      data: { content, emoji, mood }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update status: ${(error as Error).message}`
    };
  }
};
