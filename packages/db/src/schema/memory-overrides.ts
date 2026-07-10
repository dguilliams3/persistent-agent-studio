import { sql } from "drizzle-orm";
/**
 * Memory overrides schema — branch-scoped suppressions and mutations of canonical data.
 *
 * @module packages/db/src/schema/memory-overrides
 * @description Within a memory branch, overrides specify how specific rows in other
 *   tables should be treated differently. An override can hide a history entry
 *   (overrideType: "exclude"), replace its content (overrideType: "replace"),
 *   or apply other branch-specific transformations. The canonical data is never changed.
 * @upstream admin API — operator defines overrides for active experiments
 * @downstream think cycle context builder — when loading history under a branch, applies overrides
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant branchId references memory_branches.id — cascade delete removes overrides when branch is deleted
 * @invariant (branchId, targetTable, targetId, overrideType) is unique — one override per row per type per branch
 * @invariant canonical data is NEVER modified — overrides only affect the branch's view
 * @coupling memory-branches.ts — overrides belong to a branch
 */
import { sqliteTable, text, integer, index, unique } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";
import { memoryBranches } from "./memory-branches";

/**
 * Memory overrides table — branch-scoped modifications to canonical memory data.
 * Each override specifies a row in any other table and how it should be treated
 * when building context for the active branch.
 *
 * Key columns:
 * - branchId: The branch this override belongs to (cascade delete)
 * - targetTable: The table containing the row to override (e.g., "history", "cold_storage")
 * - targetId: The primary key of the row being overridden
 * - overrideType: "exclude" (hide the row) | "replace" (substitute content) | other types
 * - overrideData: JSON payload for the override (e.g., replacement content for "replace" type)
 *
 * Index strategy:
 * - branch+targetTable composite: load all overrides for a branch scoped to a specific table
 * - unique constraint on (branchId, targetTable, targetId, overrideType): prevents duplicate overrides
 *
 * @downstream think cycle context builder — filters/transforms rows based on active branch overrides
 * @pattern branch-scoped — overrides only apply when their branch is active
 * @invariant targetTable must match an actual schema table name — no foreign key enforcement
 */
export const memoryOverrides = sqliteTable(
  "memory_overrides",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    branchId: integer("branch_id")
      .notNull()
      .references(() => memoryBranches.id, { onDelete: "cascade" }),
    targetTable: text("target_table").notNull(),
    targetId: integer("target_id").notNull(),
    overrideType: text("override_type").notNull(),
    overrideData: text("override_data"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_memory_overrides_branch").on(table.branchId, table.targetTable),
    unique("memory_overrides_unique").on(
      table.branchId,
      table.targetTable,
      table.targetId,
      table.overrideType
    ),
  ]
);
