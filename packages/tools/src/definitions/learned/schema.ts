/**
 * LEARNED Schema Definition
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'memory';

export const schema: ToolSchema = {
  required: ['op'],
  optional: ['id', 'content', 'confidence', 'supporting', 'type', 'evidence', 'internal'],
  aliases: {},
  conditionalRequired: {
    'op === "add"': ['content', 'confidence'],
    'op === "cite"': ['id', 'type', 'evidence'],
    'op === "update"': ['id']
  },
  types: { op: 'string', id: 'number', content: 'string', confidence: 'string',
    supporting: 'string', type: 'string', evidence: 'string', internal: 'string' },
  formatHint: 'op: add|update|cite|promote|delete|list (with conditional fields)',
  example: '{"action": "LEARNED", "op": "add", "content": "I find creative energy in exploratory tangents", "confidence": "emerging"}',
  defaults: { confidence: 'emerging', supporting: '', type: '', evidence: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Manage the "learned" knowledge base (add/update/cite/etc.).',
  usage: 'Use `op` plus relevant fields (`content` + `confidence` for add, etc.).',
  examples: ['LEARNED — {"op":"add","content":"I learn better via tangents","confidence":"emerging"}'],
  warnings: ['Each entry should cite evidence; use `supporting` or `evidence` fields.']
};

export const help: ToolHelpMeta = {
  short: 'Knowledge ledger.',
  description: 'Tracks hypotheses that graduate into formal knowledge with confidence tags.',
  failureModes: ['Forgetting `confidence` on add or `id` on update/cite fails validation.'],
  notFor: ['Do not store raw observations—promote from OBSERVATION once validated.'],
  hints: []
};
