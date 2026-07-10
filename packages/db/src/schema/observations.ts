import { sql } from "drizzle-orm";
/**
 * Observations schema — entity-generated analytical notes about the world or conversations.
 *
 * @module packages/db/src/schema/observations
 * @description Observations are structured notes the entity writes during or after
 *   think cycles to record insights, patterns, or reflections. Distinguished from
 *   notebook (long-form reference docs) and cold storage (atomic facts) — observations
 *   are interpretive, titled entries with summaries. They are soft-deletable.
 *   Renamed from user_observations to observations for open-source readiness.
 * @upstream think cycle — entity writes observations via observation tools
 * @downstream think cycle context builder — recent non-deleted observations may be loaded
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — observations are per-persona
 * @invariant deletedAt null means active; non-null means soft-deleted
 * @coupling notebook.ts — notebook is for reference docs; observations are for analysis notes
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Observations table — entity-generated interpretive notes and analytical reflections.
 * The entity records insights, pattern recognitions, and contextual analysis here.
 * Entries have titles for retrieval and optional summaries for quick scanning.
 *
 * Key columns:
 * - title: Short descriptive label for the observation (must be non-null)
 * - summary: Brief one-sentence description of the observation
 * - content: Full observation text — the entity's analysis or reflection
 * - deletedAt: Soft-delete timestamp; null means the observation is active
 *
 * Index strategy:
 * - title index: lookup observations by title
 * - created_at index: time-ordered access
 * - deleted index: filter active observations (WHERE deletedAt IS NULL)
 * - persona index: load all observations for a persona
 *
 * @downstream think cycle context — active observations inform future thinking
 * @pattern persona-scoped — observations isolated by persona_id
 * @invariant deletedAt is the soft-delete mechanism; never hard-delete
 */
export const observations = sqliteTable(
  "observations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    title: text("title").notNull(),
    summary: text("summary"),
    content: text("content").notNull(),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_observations_title").on(table.title),
    index("idx_observations_created_at").on(table.createdAt),
    index("idx_observations_deleted").on(table.deletedAt),
    index("idx_observations_persona").on(table.personaId),
  ]
);
