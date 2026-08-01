/**
 * WONDER Handler
 *
 * @module @persistence/tools/definitions/wonder/handler
 * @description Executes the WONDER action - records curiosity and open questions.
 *
 * @upstream Called by: @persistence/tools/executor during action execution
 * @downstream Calls: logHistory() from @persistence/db
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { WonderParams } from './params';
import { logHistory, HISTORY_TYPES } from '@persistence/db';

/**
 * Handle WONDER action.
 *
 * Records curiosities to history without triggering external actions.
 * Use this to express curiosity, questions, or fascination.
 *
 * @param params - The validated WONDER parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult indicating success with curiosity data
 */
export const handler: ToolHandler<WonderParams> = async (
  params: WonderParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { content, internal } = params;
  const { db, cycleId } = ctx;

  try {
    await logHistory({
      db: db as Parameters<typeof logHistory>[0]['db'],
      type: HISTORY_TYPES.CURIOSITY,
      content,
      internal: internal ?? null,
      cycleId
    });

    return {
      success: true,
      type: 'curiosity',
      data: { content }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to log curiosity: ${(error as Error).message}`
    };
  }
};
