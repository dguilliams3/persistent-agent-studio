/**
 * Result type for delete operations (notebook, observations).
 *
 * @module @persistence/db/llm-storage/DeleteResult
 * @upstream Called by:
 *   - llm-storage/notebook.ts
 *   - llm-storage/observations.ts
 *   - llm-storage/index.ts
 */

export interface DeleteResult {
  success: boolean;
  title?: string;
}
