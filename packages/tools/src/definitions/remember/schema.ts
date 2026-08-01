/**
 * REMEMBER Schema Definition
 *
 * @module @persistence/tools/definitions/remember/schema
 *
 * Schema configuration for ephemeral notes that ride along with scrolling history.
 *
 * CATEGORY CHOICE: 'memory'
 * This is a memory tool because it stores information for later recall, but unlike
 * COLD_STORAGE (permanent) or REMINDER (conditional), REMEMBER entries are ephemeral
 * and naturally fade as history scrolls.
 *
 * VALIDATION RULES:
 * - content: REQUIRED - must be a non-empty string with the note content
 * - internal: OPTIONAL - private reasoning about this note
 *
 * NO ALIASES:
 * REMEMBER has no legacy aliases since it's been REMEMBER since day one. It's
 * conceptually distinct from COLD_STORAGE and REMINDER.
 *
 * DEFAULTS:
 * - internal defaults to empty string (no private reasoning)
 *
 * FORMAT HINT:
 * This appears in error messages when parsing fails, helping the LLM understand
 * what went wrong and how to fix it.
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
  formatHint: 'Ephemeral note that scrolls with history',
  example: '{"action": "REMEMBER", "content": "The user mentioned they have a meeting at 3pm"}',
  defaults: { internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Store short-lived notes that stay in scrolling history.',
  usage: 'Set `content` to capture ephemeral observations or TODOs.',
  examples: ['REMEMBER — {"content":"The user mentioned a demo tomorrow at 10am."}'],
  warnings: ['REMEMBER scrolls away; escalate important facts to COLD_STORAGE.']
};

export const help: ToolHelpMeta = {
  short: 'Sticky note in standard history.',
  description: 'Use REMEMBER to jot facts you will need soon but not forever. Great for near-term reminders that still benefit from summarization.',
  failureModes: ['Forgetting to upgrade crucial insights to COLD_STORAGE causes loss once history rotates.'],
  notFor: ['Do not use for permanent truths—that is COLD_STORAGE.'],
  hints: []
};
