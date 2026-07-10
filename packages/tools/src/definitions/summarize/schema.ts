/**
 * SUMMARIZE Schema Definition
 *
 * @module @persistence/tools/definitions/summarize/schema
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'memory';

export const schema: ToolSchema = {
  required: [],
  optional: ['start', 'count', 'meta', 'internal'],
  aliases: {},
  types: {
    start: 'number',
    count: 'number',
    meta: 'boolean',
    internal: 'string'
  },
  formatHint: 'Compress history (meta: true compresses summaries instead)',
  example: '{"action": "SUMMARIZE", "start": 0, "count": 15}',
  defaults: { start: 0, count: 12, meta: false, internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Compress recent history into long-term summaries.',
  usage: 'Optionally set `start`, `count`, or `meta:true` to summarize summaries.',
  examples: ['SUMMARIZE — {"start":0,"count":15}'],
  warnings: ['Only trigger SUMMARIZE when history exceeds configured thresholds.']
};

export const help: ToolHelpMeta = {
  short: 'History compression.',
  description: 'Used when the live history is too long—splits into digestible summaries stored in the summary table.',
  failureModes: ['Requesting fewer entries than minSummarizeCount wastes a cycle.'],
  notFor: ['Do not run just to tidy small conversations; wait until thresholds are hit.'],
  hints: []
};
