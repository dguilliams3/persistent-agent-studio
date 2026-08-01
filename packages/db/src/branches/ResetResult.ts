/**
 * Result type for branch reset operations.
 *
 * @module @persistence/db/branches/ResetResult
 * @upstream Called by:
 *   - branches/overrides.ts
 *   - branches/index.ts
 */

export interface ResetResult {
  success: boolean;
  overridesRemoved: number;
  syntheticsRemoved: number;
}
