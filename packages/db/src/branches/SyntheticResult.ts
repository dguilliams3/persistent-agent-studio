/**
 * Result type for synthetic memory operations.
 *
 * @module @persistence/db/branches/SyntheticResult
 * @upstream Called by:
 *   - branches/synthetic.ts
 *   - branches/index.ts
 */

export interface SyntheticResult {
  success: boolean;
  error?: string;
  id?: number;
}
