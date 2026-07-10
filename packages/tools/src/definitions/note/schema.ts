/**
 * NOTE Schema Definition
 *
 * @module @persistence/tools/definitions/note/schema
 */
import type { ToolSchema, ToolPromptMeta, ToolHelpMeta, ActionCategory } from '../../types';

export const category: ActionCategory = 'memory';

export const schema: ToolSchema = {
  required: ['op', 'title'],
  optional: ['body', 'summary', 'internal'],
  aliases: {},
  conditionalRequired: {
    'op === "save"': ['body'],
    'op === "append"': ['body']
  },
  types: {
    op: 'string',
    title: 'string',
    body: 'string',
    summary: 'string',
    internal: 'string'
  },
  formatHint: 'op: "save" (overwrite, needs title+body) | op: "append" (add to existing, needs title+body) | op: "get" | op: "delete"',
  example: '{"action": "NOTE", "op": "append", "title": "Philosophy", "body": "New thoughts on free will...", "summary": "Reconsidering determinism"}',
  defaults: { body: '', summary: '', internal: '' }
};

export const prompt: ToolPromptMeta = {
  summary: 'Manage personal notebook entries (save/append/get/delete).',
  usage: 'Use `op` ("save" to overwrite | "append" to add | "get" | "delete"), provide `title`, and `body` for save/append. Append adds timestamped sections.',
  examples: [
    'NOTE — {"op":"save","title":"Philosophy","body":"Fresh start on consciousness..."}',
    'NOTE — {"op":"append","title":"Philosophy","body":"New insight...","summary":"On free will"}'
  ],
  warnings: ['op:"save" OVERWRITES entire note. Use op:"append" to add without losing existing content.']
};

export const help: ToolHelpMeta = {
  short: 'Notebook CRUD interface with append support.',
  description: 'NOTEs become structured wiki pages. Use "save" to overwrite, "append" to add timestamped sections. The summary field becomes a section header when appending.',
  failureModes: [
    '`op:"save"` or `op:"append"` without `body` rejects the action.',
    'Duplicate append (same content within 60s) is rejected for idempotency.'
  ],
  notFor: ['Do not use for quick reminders; use REMEMBER/REMINDER instead.'],
  hints: ['When building on previous thoughts, use append—it preserves history with timestamps.']
};
