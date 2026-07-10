/**
 * Shape of override_data JSON for 'edit' type overrides.
 *
 * @module @persistence/db/branches/EditData
 * @upstream Called by:
 *   - branches/overrides.ts
 *   - branches/index.ts
 */

export interface EditData {
  content?: string;
  type?: string;
  internal?: string | null;
}
