/**
 * Update payload for modifying an existing synthetic memory.
 *
 * @module @persistence/db/branches/SyntheticUpdates
 * @upstream Called by:
 *   - branches/synthetic.ts
 *   - branches/index.ts
 */

import type { SyntheticPlacement } from './SyntheticPlacement';

export interface SyntheticUpdates {
  memoryType?: string;
  content?: string;
  internal?: string | null;
  placement?: SyntheticPlacement;
}
