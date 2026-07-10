/**
 * OBSERVATION Schema Definition
 *
 * @module @persistence/tools/definitions/observation/schema
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'memory';

export const schema: ToolSchema = {
  required: ['op', 'title'],
  optional: ['content', 'summary', 'internal'],
  aliases: {},
  conditionalRequired: {
    'op === "save"': ['content']
  },
  types: {
    op: 'string',
    title: 'string',
    content: 'string',
    summary: 'string',
    internal: 'string'
  },
  formatHint: 'op: "save" (needs title+content) | op: "get" (title only) | op: "delete" (title only)',
  example: '{"action": "OBSERVATION", "op": "save", "title": "The User\'s Energy Patterns", "content": "The user seems more energetic on days they exercise"}',
  defaults: { content: '', summary: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Track structured observations about the user.',
  usage: 'Set `op` plus `title` and `content` when saving.',
  examples: ['OBSERVATION — {"op":"save","title":"Energy Patterns","content":"The user is more energetic after workouts."}'],
  warnings: ['Observations should be respectful and actionable.']
};

export const help: ToolHelpMeta = {
  short: 'Relational insight log.',
  description: 'Use for empathy or relational trends that deserve their own board separate from notes.',
  failureModes: ['Missing `content` when `op:"save"` fails validation.'],
  notFor: ['Avoid storing personal secrets that belong in secure storage.'],
  hints: []
};
