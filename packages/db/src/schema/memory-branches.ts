import { sql } from "drizzle-orm";
/**
 * Memory branches schema — named experimental memory contexts for non-destructive persona manipulation.
 *
 * @module packages/db/src/schema/memory-branches
 * @description Memory branches allow non-destructive experimentation with an entity's
 *   memory state. A branch can hide history entries (via memory_overrides) or inject
 *   synthetic memories (via synthetic_memories) without modifying the canonical data.
 *   Only one branch can be active at a time. The default "main" branch has no overrides.
 * @upstream admin API — operator creates and activates branches via branch management routes
 * @downstream memory-overrides — overrides reference a branch_id to scope their effect
 * @downstream synthetic-memories — synthetic entries reference a branch_id
 * @downstream think cycle context builder — loads memory through the lens of the active branch
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant name is unique — branches are addressed by name
 * @invariant only one branch has isActive = 1 at a time
 * @coupling memory-overrides.ts — overrides are branch-scoped
 * @coupling synthetic-memories.ts — synthetic memories are branch-scoped
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Memory branches table — named contexts for experimental memory manipulation.
 * Each branch can suppress or augment the entity's view of its own history
 * without modifying the underlying canonical data.
 *
 * Key columns:
 * - name: Unique branch name — used for activation and management
 * - description: Human-readable description of the experiment this branch represents
 * - parentBranch: Name of the branch this was forked from (for branch hierarchies)
 * - isActive: 1 = this branch is currently applied to think cycle context; 0 = inactive
 *
 * @downstream memory-overrides — all overrides for this branch reference this id
 * @downstream synthetic-memories — all synthetic entries for this branch reference this id
 * @pattern non-destructive-experiment — history data never changes; branches layer on top
 * @invariant exactly one branch should have isActive = 1 at any time
 */
export const memoryBranches = sqliteTable("memory_branches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  personaId: integer("persona_id")
    .notNull()
    .default(1)
    .references(() => personas.id),
  name: text("name").notNull().unique(),
  description: text("description"),
  parentBranch: text("parent_branch"),
  isActive: integer("is_active").default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
});
