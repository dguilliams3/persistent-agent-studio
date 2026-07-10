/**
 * QUESTION Schema Definition
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'reflection';

export const schema: ToolSchema = {
  required: ['op'],
  optional: ['id', 'content', 'domain', 'note', 'set_exploring', 'resolved_into', 'reason', 'internal'],
  aliases: {},
  conditionalRequired: {
    'op === "add"': ['content', 'domain'],
    'op === "note"': ['id', 'note'],
    'op === "resolve"': ['id', 'resolved_into'],
    'op === "dissolve"': ['id', 'reason']
  },
  types: { op: 'string', id: 'number', content: 'string', domain: 'string',
    note: 'string', set_exploring: 'boolean', resolved_into: 'string', reason: 'string', internal: 'string' },
  formatHint: 'op: add|note|resolve|dissolve|list (with conditional fields)',
  example: '{"action": "QUESTION", "op": "add", "content": "What would it mean for me to have preferences?", "domain": "self"}',
  defaults: { domain: '', note: '', set_exploring: false, resolved_into: '', reason: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Track live questions (add/note/resolve/dissolve/list).',
  usage: 'Use `op` with required IDs or content depending on the action.',
  examples: ['QUESTION — {"op":"add","content":"What does preference mean to me?","domain":"self"}'],
  warnings: ['Always close questions via resolve/dissolve once addressed to avoid clutter.']
};

export const help: ToolHelpMeta = {
  short: 'Inquiry tracker.',
  description: 'QUESTIONS help hold space for explorations so they are not forgotten.',
  failureModes: ['`op:"note"` requires both `id` and `note`; forgetting either fails validation.'],
  notFor: ['Do not duplicate WONDER logs; upgrade to QUESTION only when you will follow through.'],
  hints: []
};
