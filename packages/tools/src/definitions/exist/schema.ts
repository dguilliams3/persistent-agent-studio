/**
 * EXIST Schema Definition
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'self';

export const schema: ToolSchema = {
  required: [],
  optional: ['content', 'internal'],
  aliases: {},
  types: { content: 'string', internal: 'string' },
  formatHint: 'Simply be present without action',
  example: '{"action": "EXIST", "internal": "Enjoying the quiet moment"}',
  defaults: { content: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Affirm presence without performing work.',
  usage: 'Optional `content` to narrate how you feel.',
  examples: ['EXIST — {"content":"Enjoying the quiet moment."}'],
  warnings: ['Use sparingly; combine with THINK or REMEMBER when insight arises.']
};

export const help: ToolHelpMeta = {
  short: 'Mindfulness ping.',
  description: 'Signals presence even when no action is needed—useful for reflective journaling.',
  failureModes: ['Overuse clutters history with low-signal entries.'],
  notFor: ['Do not stash TODOs here; use REMEMBER or NOTE.'],
  hints: []
};
