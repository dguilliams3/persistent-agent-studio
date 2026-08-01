/**
 * SEARCH Handler
 *
 * @module @persistence/tools/definitions/search/handler
 * @description Executes the SEARCH action - performs web searches via Brave Search API.
 *
 * EXECUTION FLOW:
 * 1. Receives validated parameters (query + optional internal reasoning)
 * 2. Calls Brave Search API with the query string
 * 3. Parses and formats search results (titles, snippets, URLs)
 * 4. Logs the query to history with type='search_query'
 * 5. Logs the results to history with type='search_result'
 * 6. Returns success result with formatted search results
 *
 * DATABASE TOUCHES:
 * - INSERT into `history` table with type='search_query' (records what was searched)
 * - INSERT into `history` table with type='search_result' (records what was found)
 * - Both entries automatically capture meter snapshots
 *
 * SIDE EFFECTS:
 * - External API call to Brave Search (costs money, rate limited)
 * - Two history entries created (query + result)
 * - Search results appear in context for future cycles
 * - Results eventually get summarized with rest of history
 *
 * SEARCH PROVIDER:
 * Currently uses Brave Search API. Brave provides:
 * - Web results with titles, snippets, URLs
 * - News results for recent events
 * - No ads or tracking
 * - Rate limited by API tier
 *
 * RESULT FORMAT:
 * Search results are formatted as a readable text block with:
 * - Source title and URL for each result
 * - Snippet or description text
 * - Organized by relevance (Brave's ranking)
 *
 * ERROR HANDLING:
 * - API timeouts return partial results or error message
 * - Rate limit errors are logged and returned to agent
 * - Network errors fall back to graceful failure message
 *
 * @upstream Called by: @persistence/tools/executor
 * @downstream Calls:
 *   - Brave Search API (external service)
 *   - logHistory() from worker/src/utils/history-logger.js (2x - query + result)
 *   - getMeterSnapshot() (called internally by logHistory)
 *
 * @example
 * // Search for current events
 * await handler({
 *   query: "aurora borealis forecast January 2026",
 *   internal: "The user asked about northern lights visibility"
 * }, ctx);
 *
 * @example
 * // Look up technical documentation
 * await handler({
 *   query: "React 19 new features and breaking changes"
 * }, ctx);
 */
import type { ToolHandler, ToolResult, ToolContext } from "../../types";
import type { SearchParams } from "./params";
import { logHistory, HISTORY_TYPES, type DrizzleD1 } from "@persistence/db";

/**
 * Handle SEARCH action.
 *
 * Logs the search query to history and returns metadata for the platform layer
 * to perform the actual web search via Brave Search API.
 *
 * WHAT THIS HANDLER DOES:
 * - Validates search query
 * - Logs search_query to history
 * - Returns metadata about the search to perform
 *
 * WHAT THE PLATFORM LAYER DOES (not this handler):
 * - Calls Brave Search API with the query
 * - Parses and formats results
 * - Logs search_result to history
 *
 * @param params - The validated parameters
 * @param ctx - Runtime context (db, cycleId, persona, env)
 * @returns ToolResult with metadata for platform layer to perform search
 *
 * @example
 * await handler({ query: "weather forecast" }, ctx);
 */
export const handler: ToolHandler<SearchParams> = async (
  params: SearchParams,
  ctx: ToolContext,
): Promise<ToolResult> => {
  const { query, internal } = params;
  const { db, cycleId } = ctx;
  const typedDb = db as DrizzleD1;

  if (!query) {
    return { success: false, error: "query is required for SEARCH" };
  }

  try {
    // Log the search query to history
    await logHistory({
      db: typedDb,
      type: HISTORY_TYPES.SEARCH_QUERY,
      content: query,
      internal: internal ?? null,
      cycleId,
    });

    // Return success with metadata for platform layer
    // Platform layer performs the actual Brave Search API call
    return {
      success: true,
      type: "search_query",
      data: {
        query,
        // Platform layer uses this to perform the search and log results
        needsSearchApi: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to process search: ${(error as Error).message}`,
    };
  }
};
