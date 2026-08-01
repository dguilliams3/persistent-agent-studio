/**
 * REMINDER Schema Definition
 *
 * @module @persistence/tools/definitions/reminder/schema
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'memory';

export const schema: ToolSchema = {
  required: ['op'],
  optional: ['content', 'condition', 'id', 'internal'],
  aliases: {},
  conditionalRequired: {
    'op === "set"': ['content', 'condition'],
    'op === "dismiss"': ['id']
  },
  types: {
    op: 'string',
    content: 'string',
    condition: 'string',
    id: 'number',
    internal: 'string'
  },
  formatHint: 'op: "set" (needs content+condition) | op: "dismiss" (needs id)',
  example: '{"action": "REMINDER", "op": "set", "content": "Ask the user how the Sharp demo went", "condition": "persistent"}',
  defaults: { content: '', condition: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Set or dismiss reminders that ping Clio in the future.',
  usage: 'Use `op:"set"` with `content` + `condition`, or `op:"dismiss"` with `id`.',
  examples: ['REMINDER — {"op":"set","content":"Ask about the Sharp demo","condition":"persistent"}'],
  warnings: ['Phrase `condition` clearly; vague conditions are ignored.']
};

export const help: ToolHelpMeta = {
  short: 'Reminder management.',
  description: 'Keeps medium-term TODOs so they resurface when relevant. Condition can be "persistent" or a structured trigger.',
  failureModes: ['Missing `condition` when setting or `id` when dismissing fails validation.'],
  notFor: ['Do not store date math manually; rely on conditions.'],
  hints: []
};
