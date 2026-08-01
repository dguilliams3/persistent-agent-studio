/**
 * Shape of override_data JSON for 'reorder' type overrides.
 *
 * @module @persistence/db/branches/ReorderData
 * @upstream Called by:
 *   - branches/overrides.ts
 *   - branches/index.ts
 */

export interface ReorderData {
  position?: number;
  timestamp_override?: string;
}
