/**
 * NOTE Tool Definition
 *
 * @module @persistence/tools/definitions/note
 * @description Notebook CRUD interface for persistent wiki-style pages.
 *
 * This tool enables the agent to save, retrieve, and delete structured
 * documents that are richer than REMEMBER entries but not quite permanent truths.
 *
 * @upstream Called by: @persistence/runtime - runThinkingCycle()
 * @downstream Calls: saveNote(), getNote(), deleteNote(), logHistory()
 */
import type { ToolDefinition } from '../../types';
import type { NoteParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { NoteParams } from './params';

/**
 * NOTE tool definition with co-located handler.
 */
export const NOTE: ToolDefinition<NoteParams> = {
  id: 'NOTE',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: {
      save: 'note_saved',
      append: 'note_saved',
      get: null,
      delete: null
    }
  }
};
