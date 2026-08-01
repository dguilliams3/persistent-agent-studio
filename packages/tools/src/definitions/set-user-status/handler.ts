/**
 * SET_USER_STATUS Handler
 *
 * @module @persistence/tools/definitions/set-user-status/handler
 * @description Updates the user's availability status as perceived by the agent.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls: setState(), logHistory() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { SetUserStatusParams } from './params';
import { logHistory, HISTORY_TYPES, setState } from '@persistence/db';

/**
 * Handle SET_USER_STATUS action.
 *
 * Updates the user's availability status in the state table.
 *
 * @param params - The validated SET_USER_STATUS parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult indicating success
 */
export const handler: ToolHandler<SetUserStatusParams> = async (
  params: SetUserStatusParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { content, internal } = params;
  const { db, cycleId } = ctx;

  try {
    const typedDb = db as Parameters<typeof setState>[0];

    // Update state table entries
    await setState(typedDb, 'user_status', content || null);
    await setState(typedDb, 'user_status_updated', new Date().toISOString());
    await setState(typedDb, 'user_status_set_by', 'Claude');

    // Log to history
    await logHistory({
      db: typedDb,
      type: HISTORY_TYPES.USER_STATUS_UPDATE,
      content: `Updated user's status to: "${content || '(cleared)'}"`,
      internal: internal ?? null,
      cycleId
    });

    return {
      success: true,
      type: 'user_status_update',
      data: { content }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update user's status: ${(error as Error).message}`
    };
  }
};
