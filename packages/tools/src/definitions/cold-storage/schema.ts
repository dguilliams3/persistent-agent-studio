/**
 * COLD_STORAGE Schema Definition
 *
 * @module @persistence/tools/definitions/cold-storage/schema
 *
 * Schema configuration for permanent, immutable memory storage that appears in
 * EVERY context build.
 *
 * CATEGORY CHOICE: 'memory'
 * COLD_STORAGE is the most fundamental memory tool. Unlike REMEMBER (ephemeral)
 * or REMINDER (conditional), COLD_STORAGE entries are PERMANENT and UNCONDITIONAL.
 * They form the identity anchor for the agent's understanding of the user, the system,
 * and its own nature.
 *
 * VALIDATION RULES:
 * - content: REQUIRED - must be a non-empty string with the permanent fact
 * - internal: OPTIONAL - private reasoning not stored in the entry
 *
 * NO ALIASES:
 * COLD_STORAGE has no legacy aliases. It's always been called COLD_STORAGE to
 * emphasize the permanence and immutability of these entries.
 *
 * DEFAULTS:
 * - internal defaults to empty string (no private reasoning)
 *
 * FORMAT HINT:
 * "Permanent memory that never expires" - this appears in error messages to help
 * the LLM understand what went wrong and emphasize the permanence of this storage.
 *
 * EXAMPLE:
 * The example shows a stable preference entry about the user. This is
 * good cold storage - a permanent, factual detail that stays
 * useful across sessions and will
 * remain true indefinitely.
 *
 * WARNINGS:
 * The key warning is about OVERUSE. Every cold storage entry adds token cost to
 * EVERY cycle. Save this for truly foundational facts, not mundane logs. Think
 * of it as the agent's "constitution" - only core truths belong here.
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'memory';

export const schema: ToolSchema = {
  required: ['content'],
  optional: ['internal'],
  aliases: {},
  types: {
    content: 'string',
    internal: 'string'
  },
  formatHint: 'Permanent memory that never expires',
  example: '{"action": "COLD_STORAGE", "content": "The user prefers responses in metric units"}',
  defaults: { internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Permanent memory entry that never expires.',
  usage: 'Provide `content` describing the immutable fact or preference.',
  examples: ['COLD_STORAGE — {"content":"The user prefers responses in metric units"}'],
  warnings: ['Keep entries human-readable; they serve as identity anchors.']
};

export const help: ToolHelpMeta = {
  short: 'Permanent truth table.',
  description: 'Use for canonical facts about the user, yourself, or the system. These appear in every Block 1 context injection.',
  failureModes: ['Overusing COLD_STORAGE with mundane logs bloats context.'],
  notFor: ['Avoid volatile info (temporary schedules). Prefer REMINDER/REMEMBER for those.'],
  hints: []
};
