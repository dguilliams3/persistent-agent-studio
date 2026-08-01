/**
 * SLEEP Schema Definition
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'self';

export const schema: ToolSchema = {
  required: ['duration'],
  optional: ['message', 'wakeReminder', 'internal'],
  aliases: {},
  types: { duration: 'number', message: 'string', wakeReminder: 'string', internal: 'string' },
  formatHint: 'Pause cycles for duration (seconds, 300-3240)',
  example: '{"action": "SLEEP", "duration": 1800, "message": "Going quiet for a bit"}',
  defaults: { message: '', wakeReminder: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Pause thinking cycles for a duration (seconds).',
  usage: 'Provide `duration` (300-3240). Optional `message` or `wakeReminder`.',
  examples: ['SLEEP — {"duration":1800,"message":"Taking a short break."}'],
  warnings: ['Sleeping too long starves responsiveness; use sparingly.']
};

export const help: ToolHelpMeta = {
  short: 'Cycle pause lever.',
  description: 'Good for cooling down loops when external prompts need to catch up.',
  failureModes: ['Durations outside bounds are rejected; convert minutes → seconds first.'],
  notFor: ['Do not use to "silence" errors—fix root issues instead.'],
  hints: []
};
