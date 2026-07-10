/**
 * DIGEST Tool Definition
 *
 * @module @persistence/tools/definitions/digest
 *
 * PURPOSE: Manage scheduled web digests on configurable topics.
 * DIGEST allows the agent to set up automated research tracking, where topics are
 * searched periodically, results summarized via LLM, and logged to context.
 *
 * WHEN TO USE:
 * - Setting up ongoing monitoring of a newsworthy topic
 * - Tracking developments in a specific area over time
 * - Creating automated briefings on subjects you care about
 * - Enabling/disabling scheduled research cycles
 * - Triggering immediate digest runs when you want results now
 *
 * WHEN NOT TO USE:
 * - One-off web searches (use SEARCH instead)
 * - Looking up specific facts (use SEARCH instead)
 * - Storing information you already have (use REMEMBER/COLD_STORAGE)
 * - Topics that aren't newsworthy or don't change over time
 *
 * OPERATIONS:
 * - add_topic: Add a topic to track (max 10 per preset)
 * - remove_topic: Stop tracking a topic
 * - list_topics: See current topics and status
 * - trigger: Run a digest immediately
 * - enable: Turn on scheduled automatic digests
 * - disable: Turn off scheduled digests
 *
 * PARAMETERS:
 * - op (required): The operation to perform
 * - topic (required for add/remove): The topic string
 * - preset (optional): Which preset to use (geopolitical/tech/daily)
 * - internal (optional): Private reasoning
 *
 * PRESETS:
 * - geopolitical: Daily at 6 AM EST, geopolitical news analysis
 * - tech: Every 12 hours, technology news summary
 * - daily: Daily at 9 AM EST, general news briefing
 *
 * DIGEST CHARACTERISTICS:
 * - Uses Claude Sonnet + web_search tool for research
 * - Results summarized via GPT-4o-mini (cost-effective)
 * - Logged to history as web_digest entries
 * - Costs ~$0.01-0.03 per topic depending on result length
 *
 * TOPIC SELECTION TIPS:
 * - Be SPECIFIC: "US-China trade relations" not "international news"
 * - Be NEWSWORTHY: Topics should have ongoing developments
 * - Be SELECTIVE: Each topic costs money and context space
 * - Be RELEVANT: Track things that matter to your conversations with the user
 *
 * RESULT FORMAT:
 * Digest results appear in history with:
 * - Per-topic summaries (2-3 paragraphs each)
 * - Optional synthesis across all topics
 * - Cost and token usage metadata
 *
 * COST CONSIDERATIONS:
 * - Each topic triggers a web search (~$0.01-0.02)
 * - Synthesis adds ~$0.01 extra
 * - Max 10 topics = max ~$0.30 per digest run
 * - Running daily = ~$9/month at max topics
 *
 * RELATED TOOLS:
 * - SEARCH: For one-off web searches
 * - REMEMBER: For storing discovered insights short-term
 * - COLD_STORAGE: For storing important discoveries permanently
 * - NOTE: For organizing research findings
 *
 * @category research
 * @upstream Called by: @persistence/runtime - runThinkingCycle() during autonomous cycles
 * @downstream Calls: getState/setState for config, runDigest() via platform layer
 */
import type { ToolDefinition } from '../../types';
import type { DigestParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { DigestParams } from './params';

/**
 * DIGEST tool definition with co-located handler.
 */
export const DIGEST: ToolDefinition<DigestParams> = {
  id: 'DIGEST',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: null,
    postProcessed: ['web_digest']
  }
};
