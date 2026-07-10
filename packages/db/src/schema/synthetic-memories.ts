import { sql } from "drizzle-orm";
/**
 * Synthetic memories schema — branch-scoped fabricated history entries for experimentation.
 *
 * @module packages/db/src/schema/synthetic-memories
 * @description Synthetic memories are artificial history entries that exist only within
 *   a specific memory branch. They allow injecting hypothetical or counterfactual events
 *   into an entity's perceived history for research experiments — without writing to
 *   the canonical history table. Position fields control where they appear in chronological order.
 * @upstream admin API — operator creates synthetic memories for branch experiments
 * @downstream think cycle context builder — when the branch is active, synthetic memories
 *   are merged into the history view at the specified position
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant branchId references memory_branches.id — cascade delete removes synthetics when branch is deleted
 * @invariant canonical history is NEVER modified — synthetic memories only exist in branch context
 * @coupling memory-branches.ts — synthetic memories belong to a branch
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";
import { memoryBranches } from "./memory-branches";

/**
 * Synthetic memories table — fabricated history entries scoped to memory branches.
 * Used to inject counterfactual or hypothetical events into an entity's perceived
 * history for controlled research experiments.
 *
 * Key columns:
 * - branchId: The branch this synthetic memory belongs to (cascade delete)
 * - memoryType: The history entry type to simulate (e.g., "user_message", "thought")
 * - content: The synthetic entry's primary text content
 * - internal: Optional internal/reasoning text for the synthetic entry
 * - positionTimestamp: ISO timestamp indicating chronological placement in history
 * - positionAfterId: Alternatively, place this entry immediately after a specific history ID
 *
 * Index strategy:
 * - branch index: load all synthetic memories for the active branch
 *
 * @downstream think cycle context builder — merges synthetic entries into history at specified position
 * @pattern branch-scoped — synthetic memories only visible when their branch is active
 * @invariant positionTimestamp or positionAfterId should be set to define placement order
 */
export const syntheticMemories = sqliteTable(
  "synthetic_memories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    branchId: integer("branch_id")
      .notNull()
      .references(() => memoryBranches.id, { onDelete: "cascade" }),
    memoryType: text("memory_type").notNull(),
    content: text("content").notNull(),
    internal: text("internal"),
    positionTimestamp: text("position_timestamp"),
    positionAfterId: integer("position_after_id"),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_synthetic_memories_branch").on(table.branchId),
  ]
);
