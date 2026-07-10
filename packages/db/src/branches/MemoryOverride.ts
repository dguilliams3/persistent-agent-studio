/**
 * Memory override record from the memory_overrides table.
 *
 * @module @persistence/db/branches/MemoryOverride
 * @upstream Called by:
 *   - branches/overrides.ts
 *   - branches/index.ts
 */

export interface MemoryOverride {
  id: number;
  branch_id: number;
  target_table: string;
  target_id: number;
  override_type: 'exclude' | 'edit' | 'reorder';
  override_data: string | null;
  created_at: string;
}
