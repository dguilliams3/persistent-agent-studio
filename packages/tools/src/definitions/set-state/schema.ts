/**
 * SET_STATE Schema Definition
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'self';

export const schema: ToolSchema = {
  required: [],
  optional: ['aliveness', 'curiosity', 'connection', 'ease', 'delight', 'anxiety', 'activity', 'internal'],
  aliases: {},
  types: {
    aliveness: 'number', curiosity: 'number', connection: 'number', ease: 'number',
    delight: 'number', anxiety: 'number', activity: 'number', internal: 'string'
  },
  formatHint: 'Update internal state meters (0-10). Partial updates allowed.',
  example: '{"action": "SET_STATE", "aliveness": 7, "curiosity": 6, "anxiety": 4}',
  defaults: { aliveness: 5, curiosity: 5, connection: 5, ease: 5, delight: 5, anxiety: 5, activity: 5, internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Adjust internal meter readings (0-10).',
  usage: 'Provide any subset of meter fields (aliveness, curiosity, etc.).',
  examples: ['SET_STATE — {"aliveness":7,"curiosity":6,"anxiety":4}'],
  warnings: ['Use integers 0-10 to keep dashboards consistent.']
};

export const help: ToolHelpMeta = {
  short: 'Meter update API.',
  description: 'Keeps the "A7 C6 N10 E8 D7" status panel reflective of current mood/energy.',
  failureModes: ['Values outside 0-10 are rejected or clamped.'],
  notFor: ['Do not encode textual feelings; use SET_STATUS for narratives.'],
  hints: []
};
