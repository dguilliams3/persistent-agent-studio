/**
 * Notebook entry record from the notebook table.
 *
 * @module @persistence/db/llm-storage/NotebookEntry
 * @upstream Called by:
 *   - llm-storage/notebook.ts
 *   - llm-storage/index.ts
 */

export interface NotebookEntry {
  id: number;
  title: string;
  content: string;
  summary: string;
  created_at: string;
  updated_at: string;
  last_viewed_at?: string | null;
}
