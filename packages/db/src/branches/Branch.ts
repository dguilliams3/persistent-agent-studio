/**
 * Branch record from the memory_branches table.
 *
 * @module @persistence/db/branches/Branch
 * @upstream Called by:
 *   - branches/branches.ts
 *   - branches/index.ts
 */

export interface Branch {
  id: number;
  name: string;
  description: string | null;
  parent_branch: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}
