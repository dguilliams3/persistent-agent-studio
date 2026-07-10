/**
 * SEARCH Parameter Types
 *
 * @module @persistence/tools/definitions/search/params
 *
 * Defines the parameters for web search operations. SEARCH allows the agent to
 * reach beyond its training cutoff and internal knowledge to fetch fresh, current
 * information from the internet via search providers (Brave Search).
 *
 * PARAMETER DETAILS:
 *
 * query (required, string):
 *   The search query to send to the web search API. Should be a natural language
 *   question or specific search phrase, not a command or instruction.
 *
 *   Good queries (specific, answerable):
 *   - "aurora borealis forecast January 2026"
 *   - "latest SpaceX launch schedule"
 *   - "Claude 3.5 Sonnet release date"
 *   - "React 19 new features"
 *   - "operator GitHub profile"
 *
 *   Bad queries (too broad, vague, or command-like):
 *   - "tell me about space" (too broad)
 *   - "find stuff about programming" (too vague)
 *   - "search for news" (lacks specificity)
 *   - "look up the thing the user mentioned" (missing context)
 *
 *   Best for:
 *   - Current events or breaking news
 *   - Time-sensitive information (schedules, forecasts, prices)
 *   - Verifying facts outside your training data
 *   - Looking up public profiles or documentation
 *   - Checking for recent changes to technologies
 *
 *   NOT for:
 *   - Information you already know with confidence
 *   - Questions answerable from context or cold storage
 *   - Vague exploratory searches without clear intent
 *
 * internal (optional, string):
 *   Private reasoning about why you're searching this. Visible to you but not
 *   included in the search query or logged search_query entry.
 *
 *   Example: "The operator mentioned this but I don't have current data"
 *
 * ALIAS SUPPORT:
 * The search schema supports `content` as an alias for `query` to accommodate
 * legacy formats. Both are valid:
 * - {"action": "SEARCH", "query": "..."}
 * - {"action": "SEARCH", "content": "..."}
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the SEARCH tool.
 * Web search action.
 */
export interface SearchParams extends BaseToolParams {
  /** Search query (required) */
  query: string;
}
