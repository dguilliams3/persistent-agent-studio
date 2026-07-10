/**
 * THINK Handler
 *
 * @module @persistence/tools/definitions/think/handler
 * @description Executes the THINK action - records private internal thoughts and reasoning.
 *
 * EXECUTION FLOW:
 * 1. Log the thought to the history table with type 'thought'
 * 2. Mark as internal=true so the user knows it's private
 * 3. Do NOT push to Telegram (thoughts are never notifications)
 * 4. Do NOT trigger any external services
 * 5. Return success result with thought content
 *
 * DATABASE TABLES TOUCHED:
 * - history: INSERT new row with type='thought', content=params.content, internal=true
 *
 * SIDE EFFECTS:
 * - Thought logged to history (visible in web UI with "internal" badge)
 * - Meter snapshot captured automatically by logHistory()
 * - Thought may be included in future summaries
 * - NO Telegram notification sent
 * - NO WebSocket broadcast (or only to admin UI, not the user's view)
 * - NO external API calls
 *
 * KEY DISTINCTION FROM MESSAGE_USER:
 * - THINK: internal=true, no Telegram push, marked as private
 * - MESSAGE_USER: internal=false, Telegram notification, addressed to the user
 *
 * ERROR HANDLING:
 * - If content is missing, validation fails before handler is called
 * - Database errors are caught and logged but don't crash the cycle
 *
 * @upstream Called by: @persistence/tools/executor during action execution
 * @downstream Calls:
 *   - logHistory() from worker/src/utils/history-logger.js
 *   - Summarization service (thoughts feed into summaries during compression)
 *
 * @example
 * // Simple private thought
 * await handler({ content: "I should check the API docs before responding..." }, ctx);
 *
 * @example
 * // Emotional processing
 * await handler({
 *   content: "I feel uncertain about that last response. Did I understand correctly?"
 * }, ctx);
 *
 * @example
 * // Planning next action
 * await handler({
 *   content: "Looking at the user's questions, they seem interested in memory architecture. I should prepare some observations about that for when they ask.",
 *   internal: "pre-planning"
 * }, ctx);
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { ThinkParams } from './params';
import { logHistory, HISTORY_TYPES } from '@persistence/db';

/**
 * Handle THINK action.
 *
 * Records private thoughts to history without external notifications.
 * This is the agent's private contemplation space.
 *
 * @param params - The validated THINK parameters
 * @param ctx - Runtime context containing db, cycleId, persona, env
 * @returns ToolResult indicating success with thought data
 */
export const handler: ToolHandler<ThinkParams> = async (
  params: ThinkParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { content, internal } = params;
  const { db, cycleId } = ctx;

  try {
    await logHistory({
      db: db as Parameters<typeof logHistory>[0]['db'],
      type: HISTORY_TYPES.THOUGHT,
      content,
      internal: internal ?? null,
      cycleId
    });

    return {
      success: true,
      type: 'thought',
      data: { content }
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to log thought: ${(error as Error).message}`
    };
  }
};
