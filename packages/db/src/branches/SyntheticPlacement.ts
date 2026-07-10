/**
 * Placement options for positioning a synthetic memory in the timeline.
 *
 * @module @persistence/db/branches/SyntheticPlacement
 * @upstream Called by:
 *   - branches/synthetic.ts
 *   - branches/SyntheticUpdates.ts
 *   - branches/index.ts
 */

export interface SyntheticPlacement {
  timestamp?: string | null;
  afterId?: number | null;
}
