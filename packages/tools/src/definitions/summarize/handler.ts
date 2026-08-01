/**
 * SUMMARIZE Handler
 *
 * @module @persistence/tools/definitions/summarize/handler
 * @description Executes the SUMMARIZE action.
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls:
 *   - summarizeHistory() from worker/src/services/summarizer.js
 *   - logHistory() from worker/src/utils/history-logger.js
 */
import type { ToolHandler, ToolResult, ToolContext } from '../../types';
import type { SummarizeParams } from './params';

/**
 * Handle SUMMARIZE action.
 *
 * Returns metadata for the platform layer to perform history compression
 * using the configured LLM provider.
 *
 * WHAT THIS HANDLER DOES:
 * - Validates summarize parameters
 * - Returns metadata about what to summarize
 *
 * WHAT THE PLATFORM LAYER DOES (not this handler):
 * - Fetches history entries to summarize
 * - Calls LLM API to generate summary
 * - Stores summary in summaries table
 * - Marks history entries as summarized
 *
 * NOTE: This handler intentionally does minimal work because summarization
 * is inherently an external service operation (LLM call) that belongs in
 * the platform layer.
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult with metadata for platform layer to perform summarization
 *
 * @example
 * await handler({ start: 0, count: 15, meta: false }, ctx);
 */
export const handler: ToolHandler<SummarizeParams> = async (
  params: SummarizeParams,
  ctx: ToolContext
): Promise<ToolResult> => {
  const { start, count, meta, internal } = params;

  // Return metadata for platform layer to perform summarization
  // All the heavy lifting (LLM call, DB updates) happens in platform layer
  return {
    success: true,
    type: 'summarize_request',
    data: {
      start: start ?? 0,
      count: count ?? 15,
      meta: meta === true,
      // Platform layer uses this to perform LLM summarization
      needsSummarization: true
    }
  };
};
