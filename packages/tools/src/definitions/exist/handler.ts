/**
 * EXIST Handler
 *
 * @module @persistence/tools/definitions/exist/handler
 * @description Executes the EXIST action - quiet presence without active output.
 *
 * The simplest action - just records that the agent chose to simply be present
 * without taking any other action. Good for cycles where contemplation or
 * waiting is the appropriate response.
 *
 * @upstream Called by: @persistence/tools/executor during action execution
 * @downstream Calls: logHistory() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { ExistParams } from './params';
import { logHistory, HISTORY_TYPES } from '@persistence/db';

/**
 * Handle EXIST action.
 *
 * Records quiet existence - choosing to simply be present.
 * Content is optional for this action.
 *
 * @param params - The validated EXIST parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult indicating success
 */
export const handler: ToolHandler<ExistParams> = async (
  params: ExistParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { content, internal } = params;
  const { db, cycleId } = ctx;

  try {
    await logHistory({
      db: db as Parameters<typeof logHistory>[0]['db'],
      type: HISTORY_TYPES.EXIST,
      content: content || '',
      internal: internal ?? null,
      cycleId
    });

    return {
      success: true,
      type: 'exist',
      data: { content: content || '' }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to log existence: ${(error as Error).message}`
    };
  }
};
