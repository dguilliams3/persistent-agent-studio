/**
 * SEARCH Schema Definition
 *
 * @module @persistence/tools/definitions/search/schema
 *
 * Schema configuration for web search operations via external search providers.
 *
 * CATEGORY CHOICE: 'research'
 * SEARCH is categorized as research because it reaches beyond internal knowledge
 * to fetch fresh, external information. Unlike memory tools (internal) or creative
 * tools (generative), SEARCH is about DISCOVERING what you don't already know.
 *
 * VALIDATION RULES:
 * - query: REQUIRED - must be a non-empty string with the search query
 * - internal: OPTIONAL - private reasoning about the search
 *
 * ALIAS SUPPORT:
 * `content` is aliased to `query` for backward compatibility. Early versions of
 * the action format used "content" for all text fields. Both formats work:
 * - {"action": "SEARCH", "query": "..."} (preferred)
 * - {"action": "SEARCH", "content": "..."} (legacy, still supported)
 *
 * DEFAULTS:
 * - internal defaults to empty string (no private reasoning)
 *
 * FORMAT HINT:
 * "Web search query (alias: content)" - this appears in error messages to help
 * the LLM understand that both `query` and `content` are valid parameter names.
 *
 * EXAMPLE:
 * The example shows a specific, time-bound query for aurora forecasts. This is
 * PERFECT for search - it's time-sensitive, answerable, and narrow enough to
 * return relevant results without wasting API calls on overly broad searches.
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'research';

export const schema: ToolSchema = {
  required: ['query'],
  optional: ['internal'],
  aliases: { content: 'query' },
  types: {
    query: 'string',
    internal: 'string'
  },
  formatHint: 'Web search query (alias: content)',
  example: '{"action": "SEARCH", "query": "aurora borealis forecast January 2026"}',
  defaults: { internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Perform a web search using the provided query.',
  usage: 'Set `query` (alias `content`) to the question you want answered.',
  examples: ['SEARCH — {"query":"aurora borealis forecast January 2026"}'],
  warnings: ['Craft narrow queries; broad prompts waste API calls.']
};

export const help: ToolHelpMeta = {
  short: 'Web search action.',
  description: 'Reach out to external search providers for fresh information. Always use natural-language queries.',
  failureModes: ['Missing `query` or sending multi-action instructions results in rejection.'],
  notFor: ['Do not describe what you already know—only ask for unknowns.'],
  hints: []
};
