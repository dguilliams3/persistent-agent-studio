/**
 * SEARCH Tool Definition
 *
 * @module @persistence/tools/definitions/search
 *
 * PURPOSE: Perform web searches to fetch fresh, current information from the internet.
 * SEARCH allows the agent to reach beyond its training cutoff and internal knowledge
 * to discover answers to questions about current events, recent changes, or information
 * that wasn't in the training data.
 *
 * WHEN TO USE:
 * - Current events or breaking news that happened after training cutoff
 * - Time-sensitive information (weather forecasts, schedules, prices)
 * - Verifying facts or claims you're uncertain about
 * - Looking up public profiles, documentation, or specifications
 * - Checking for recent changes to technologies, APIs, or frameworks
 * - Finding answers to specific questions you don't know
 * - Discovering what's new or trending in a topic area
 *
 * WHEN NOT TO USE:
 * - Information you already know with high confidence
 * - Questions answerable from context, cold storage, or recent history
 * - Vague exploratory searches without clear intent ("tell me about X")
 * - Information that's already been searched recently (check history first)
 * - Trivial lookups where you can infer the answer from context
 *
 * PARAMETERS:
 * - query (required, string): Natural language search query (specific and answerable)
 * - internal (optional, string): Private reasoning about why you're searching
 *
 * SEARCH CHARACTERISTICS:
 * - Uses Brave Search API (web results + news results)
 * - Creates TWO history entries: search_query + search_result
 * - Results are ranked by relevance (Brave's algorithm)
 * - Rate limited by API tier (be thoughtful about frequency)
 * - Costs money per search (don't waste on overly broad queries)
 *
 * QUERY CRAFTING TIPS:
 * - Be SPECIFIC: "aurora borealis forecast January 2026" not "northern lights"
 * - Be ANSWERABLE: Ask questions that have concrete answers
 * - Be NARROW: Avoid overly broad exploratory queries
 * - Use natural language: "latest SpaceX launch schedule" not "SpaceX launches"
 * - Include context: "React 19 breaking changes" not just "React"
 *
 * RESULT FORMAT:
 * Search results appear in history as formatted text with:
 * - Title and URL for each result
 * - Snippet or description
 * - Organized by relevance
 *
 * COST CONSIDERATIONS:
 * Each search costs money and uses API quota. Before searching:
 * 1. Check if you already know the answer
 * 2. Check if recent history contains a similar search
 * 3. Ensure your query is specific enough to return useful results
 * 4. Consider whether the information is truly necessary
 *
 * RELATED TOOLS:
 * - WONDER: For expressing curiosity without making API calls
 * - REMEMBER: For storing discovered information short-term
 * - COLD_STORAGE: For storing important discoveries permanently
 * - NOTE: For organizing research findings
 *
 * @category research
 * @upstream Called by: @persistence/runtime - runThinkingCycle() during autonomous cycles
 * @downstream Calls: Brave Search API (external), logHistory() (2x), getMeterSnapshot()
 */
import type { ToolDefinition } from '../../types';
import type { SearchParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { SearchParams } from './params';

/**
 * SEARCH tool definition with co-located handler.
 */
export const SEARCH: ToolDefinition<SearchParams> = {
  id: 'SEARCH',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: 'search_query',
    postProcessed: ['search_result']
  }
};
