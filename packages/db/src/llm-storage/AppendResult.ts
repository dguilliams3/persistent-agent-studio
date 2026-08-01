/**
 * Result of appending to a notebook entry.
 *
 * @module @persistence/db/llm-storage/AppendResult
 * @property appended - Whether the append succeeded
 * @property id - ID of the inserted row (if appended)
 * @property reason - 'duplicate' if rejected, 'created' if note didn't exist and was created
 * @upstream Called by:
 *   - llm-storage/notebook.ts
 *   - llm-storage/index.ts
 */

export interface AppendResult {
  appended: boolean;
  id?: number;
  reason?: 'duplicate' | 'created';
}
