/**
 * Observation entry record from the observations table.
 *
 * @module @persistence/db/llm-storage/ObservationEntry
 * @upstream Called by:
 *   - llm-storage/observations.ts
 *   - llm-storage/index.ts
 */

export interface ObservationEntry {
  id: number;
  title: string;
  content: string;
  summary: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
