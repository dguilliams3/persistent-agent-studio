/**
 * SET_USER_STATUS Schema Definition
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'communication';

export const schema: ToolSchema = {
  required: ['content'],
  optional: ['internal'],
  aliases: {},
  types: { content: 'string', internal: 'string' },
  formatHint: "Update user's availability (away, busy, available, etc.)",
  example: '{"action": "SET_USER_STATUS", "content": "busy with work"}',
  defaults: { internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: "Update user's availability metadata.",
  usage: 'Set `content` to descriptors like "busy", "away", or "available".',
  examples: ['SET_USER_STATUS — {"content":"busy with work"}'],
  warnings: ['Only update when user explicitly states a change.']
};

export const help: ToolHelpMeta = {
  short: 'User availability tracker.',
  description: 'Keeps dashboards honest about when user can be pinged.',
  failureModes: ['Guessing statuses erodes trust; wait for confirmation.'],
  notFor: ["Do not restate entity's mood — that belongs to SET_STATUS."],
  hints: []
};
