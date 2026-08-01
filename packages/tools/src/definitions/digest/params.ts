/**
 * DIGEST Parameter Types
 *
 * @module @persistence/tools/definitions/digest/params
 *
 * Defines the parameters for web digest operations. DIGEST manages scheduled web
 * searches on configurable topics, with results summarized via LLM and logged to
 * Clio's context window.
 *
 * PARAMETER DETAILS:
 *
 * op (required, string):
 *   The operation to perform on the web digest system.
 *
 *   Valid operations:
 *   - "add_topic": Add a new topic to the digest list
 *   - "remove_topic": Remove a topic from the digest list
 *   - "list_topics": Show all current topics
 *   - "trigger": Run a digest immediately for all configured topics
 *   - "enable": Enable scheduled automatic digests
 *   - "disable": Disable scheduled automatic digests
 *
 * topic (conditionally required, string):
 *   The topic string for add_topic and remove_topic operations.
 *   Required when op is "add_topic" or "remove_topic".
 *   Ignored for other operations.
 *
 *   Good topics (specific, newsworthy):
 *   - "US-China relations"
 *   - "AI regulation developments"
 *   - "Renewable energy policy"
 *   - "SpaceX Starship program"
 *
 *   Bad topics (too broad or vague):
 *   - "news" (too broad)
 *   - "stuff" (meaningless)
 *   - "things happening" (not specific)
 *
 * preset (optional, string):
 *   Which preset configuration to use. Defaults to "geopolitical".
 *   Available presets:
 *   - "geopolitical": Daily at 6 AM EST, geopolitical analysis
 *   - "tech": Every 12 hours, tech news summary
 *   - "daily": Daily at 9 AM EST, general briefing
 *
 * internal (optional, string):
 *   Private reasoning about why you're managing digests.
 *
 * WORKFLOW:
 * 1. Use add_topic to configure what you want to track
 * 2. Use enable to start scheduled digests
 * 3. Use trigger for immediate results when needed
 * 4. Results appear in history as web_digest entries
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the DIGEST tool.
 * Manages scheduled web digests on configurable topics.
 */
export interface DigestParams extends BaseToolParams {
  /** Operation to perform (required) */
  op: 'add_topic' | 'remove_topic' | 'list_topics' | 'trigger' | 'enable' | 'disable';
  /** Topic string for add/remove operations (required for those ops) */
  topic?: string;
  /** Preset configuration to use (default: geopolitical) */
  preset?: 'geopolitical' | 'tech' | 'daily';
}
