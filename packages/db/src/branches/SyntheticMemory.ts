/**
 * Synthetic memory record from the synthetic_memories table.
 *
 * @module @persistence/db/branches/SyntheticMemory
 * @upstream Called by:
 *   - branches/synthetic.ts
 *   - branches/index.ts
 */

export interface SyntheticMemory {
  id: number;
  branch_id: number;
  memory_type: string;
  content: string;
  internal: string | null;
  position_timestamp: string | null;
  position_after_id: number | null;
  created_at: string;
}
