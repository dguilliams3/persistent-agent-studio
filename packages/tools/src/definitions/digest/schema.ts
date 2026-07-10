/**
 * DIGEST Schema Definition
 *
 * @module @persistence/tools/definitions/digest/schema
 *
 * Schema configuration for web digest operations - scheduled web searches on
 * configurable topics with LLM summarization.
 *
 * CATEGORY CHOICE: 'research'
 * DIGEST is categorized as research because it fetches external web information
 * and creates knowledge from it. It's an automated research assistant for tracking
 * topics over time.
 *
 * VALIDATION RULES:
 * - op: REQUIRED - must be one of the valid operations
 * - topic: CONDITIONALLY REQUIRED - needed for add_topic and remove_topic
 * - preset: OPTIONAL - defaults to 'geopolitical'
 * - internal: OPTIONAL - private reasoning
 *
 * OPERATIONS:
 * - add_topic: Adds a topic to the digest tracking list
 * - remove_topic: Removes a topic from tracking
 * - list_topics: Shows currently configured topics
 * - trigger: Immediately runs a digest cycle
 * - enable: Enables scheduled automatic digests
 * - disable: Disables scheduled digests
 *
 * DEFAULTS:
 * - preset defaults to 'geopolitical' (daily at 6 AM EST)
 * - internal defaults to empty string
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'research';

export const schema: ToolSchema = {
  required: ['op'],
  optional: ['topic', 'preset', 'internal'],
  aliases: {},
  conditionalRequired: {
    add_topic: ['topic'],
    remove_topic: ['topic']
  },
  types: {
    op: 'string',
    topic: 'string',
    preset: 'string',
    internal: 'string'
  },
  formatHint: 'op: add_topic|remove_topic|list_topics|trigger|enable|disable, topic: string (for add/remove)',
  example: '{"action": "DIGEST", "op": "add_topic", "topic": "AI regulation developments"}',
  defaults: { preset: 'geopolitical', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Manage scheduled web digests on topics you want to track over time.',
  usage: 'Use `op` to specify the operation. For add_topic/remove_topic, include `topic`. Optionally set `preset` (geopolitical/tech/daily).',
  examples: [
    'DIGEST — {"op": "add_topic", "topic": "US-China relations"}',
    'DIGEST — {"op": "list_topics"}',
    'DIGEST — {"op": "trigger"}',
    'DIGEST — {"op": "enable"}'
  ],
  warnings: [
    'Each topic triggers a web search + LLM call - be selective about what you track.',
    'Max 10 topics per preset to prevent cost runaway.'
  ]
};

export const help: ToolHelpMeta = {
  short: 'Scheduled web digest management.',
  description: 'Configure topics for automated web research. Results are summarized via LLM and logged to your context as web_digest entries.',
  failureModes: [
    'Missing `topic` when op is add_topic or remove_topic.',
    'Invalid op value.',
    'Adding more than 10 topics.'
  ],
  notFor: [
    'One-off web searches - use SEARCH instead.',
    'Looking up specific facts - use SEARCH instead.'
  ],
  hints: [
    'Topics should be newsworthy subjects with ongoing developments.',
    'Use trigger for immediate results instead of waiting for scheduled time.',
    'Check list_topics before adding to avoid duplicates.'
  ]
};
