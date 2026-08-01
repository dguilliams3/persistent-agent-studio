/**
 * NOTE Parameter Types
 *
 * @module @persistence/tools/definitions/note/params
 */
import type { BaseToolParams } from '../../types';

/**
 * Parameters for the NOTE tool.
 * Notebook CRUD interface for persistent wiki-style pages.
 *
 * Operations:
 * - save: Overwrite entire note content (creates new or replaces existing)
 * - append: Add content to existing note (creates if doesn't exist)
 * - get: Retrieve note by title
 * - delete: Remove note by title
 */
export interface NoteParams extends BaseToolParams {
  /** Operation: "save" (overwrite), "append" (add), "get", or "delete" (required) */
  op: 'save' | 'get' | 'delete' | 'append';
  /** Unique notebook title (required) */
  title: string;
  /** Markdown content (required when op is "save" or "append") */
  body?: string;
  /** Short highlight for UI listings (for save) or section header (for append) */
  summary?: string;
}
