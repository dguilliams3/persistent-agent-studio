/**
 * Result type for branch operations (create, activate, delete, fork).
 *
 * @module @persistence/db/branches/BranchResult
 * @upstream Called by:
 *   - branches/branches.ts
 *   - branches/overrides.ts
 *   - branches/synthetic.ts
 *   - branches/index.ts
 */

export interface BranchResult {
  success: boolean;
  error?: string;
  name?: string;
  forkedFrom?: string;
  wasActive?: boolean;
  nowActive?: string | null;
}
