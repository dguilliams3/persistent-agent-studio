/**
 * Cold storage entry record from the cold_storage table.
 *
 * @module @persistence/db/llm-storage/ColdStorageEntry
 * @upstream Called by:
 *   - llm-storage/cold-storage.ts
 *   - llm-storage/index.ts
 */

export interface ColdStorageEntry {
  id: number;
  content: string;
  reason: string;
  created_at: string;
}
