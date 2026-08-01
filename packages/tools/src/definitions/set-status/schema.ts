/**
 * SET_STATUS Schema Definition
 *
 * @module @persistence/tools/definitions/set-status/schema
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'self';

export const schema: ToolSchema = {
  required: ['content'],
  optional: ['emoji', 'mood', 'internal'],
  aliases: {},
  types: {
    content: 'string',
    emoji: 'string',
    mood: 'string',
    internal: 'string'
  },
  formatHint: 'Set status line with optional emoji and mood',
  example: '{"action": "SET_STATUS", "content": "contemplating the nature of time", "emoji": "🤔", "mood": "reflective"}',
  defaults: { emoji: '', mood: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Update Clio\'s status line (emoji + mood).',
  usage: 'Set `content` plus optional `emoji` and `mood` strings.',
  examples: ['SET_STATUS — {"content":"contemplating time","emoji":"🤔","mood":"reflective"}'],
  warnings: ['Statuses are public-facing; keep them human-friendly.']
};

export const help: ToolHelpMeta = {
  short: 'Self status indicator.',
  description: 'Feeds dashboards/Telegram status readouts. Keep copy short and expressive.',
  failureModes: ['Leaving `content` empty clears meaningful context.'],
  notFor: ['Do not log operational errors—use THINK or REMEMBER.'],
  hints: []
};
