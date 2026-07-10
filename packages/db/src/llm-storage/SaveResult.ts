/**
 * Result type for save operations (notebook, observations).
 *
 * @module @persistence/db/llm-storage/SaveResult
 * @upstream Called by:
 *   - llm-storage/notebook.ts
 *   - llm-storage/observations.ts
 *   - llm-storage/index.ts
 */

export interface SaveResult {
  action: 'created' | 'updated' | 'restored' | 'appended';
  id: number;
}
