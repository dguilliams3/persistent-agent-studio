import { sql } from "drizzle-orm";
/**
 * Personas schema — defines the entity identity records that anchor all persona-scoped data.
 *
 * @module packages/db/src/schema/personas
 * @description Each row is a distinct AI entity identity. Personas are the root
 *   of the entire data model — every other table with a persona_id traces back here.
 *   Personas may be forked from other personas for experimental branching.
 * @upstream platforms/cloudflare — creates and activates personas via admin routes
 * @upstream packages/db — Drizzle query builder with persona scoping via persona-scope.ts
 * @downstream history, summaries, cycles, cold-storage, notebook, reminders, observations,
 *   learned, questions, image-assets, voice-history, voice-transcriptions,
 *   sim-concept-axes, sim-axis-scores, sim-basin-metrics, sim-anomaly-flags,
 *   prompt-components — all reference persona_id as a foreign key
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant slug must be unique — used as a human-readable identifier in API routes
 * @invariant persona_id is the primary isolation mechanism for all research data
 * @coupling All persona-scoped tables use persona_id as a foreign key referencing this table
 */
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

/**
 * Personas table — root identity records for AI entities.
 * Each persona is an independent AI entity with its own conversation history,
 * memory layers, SIM metrics, and configuration.
 *
 * Key columns:
 * - slug: URL-safe unique identifier used in API routes and tool selection
 * - systemPromptTemplate: Handlebars-style template for the entity's base system prompt
 * - operatorContextId: References an external operator context document
 * - forkedFromId: If set, this persona was cloned from another for experimental branching
 * - totalCycles / totalCostCents: Running counters for operational monitoring
 * - archivedAt: Soft-delete — archived personas retain all data but stop running
 *
 * Index strategy:
 * - slug index: lookup by slug on every API route
 * - archived index: filter out archived personas in active queries
 * - created index: time-range queries for audit and reporting
 *
 * @downstream history — every history entry belongs to a persona
 * @downstream cycles — every think cycle belongs to a persona
 * @downstream sim-concept-axes — SIM axes are defined per persona
 * @pattern persona-scoped — this IS the scope root; all other tables reference it
 * @invariant archivedAt null means active; non-null means retired
 * @invariant forkedFromId references personas.id (self-referential, not enforced by FK)
 */
export const personas = sqliteTable(
  "personas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").unique().notNull(),
    systemPromptTemplate: text("system_prompt_template"),
    operatorContextId: text("operator_context_id"),
    forkedFromId: integer("forked_from_id"),
    totalCycles: integer("total_cycles").default(0),
    totalCostCents: real("total_cost_cents").default(0),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    archivedAt: text("archived_at"),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_personas_slug").on(table.slug),
    index("idx_personas_archived").on(table.archivedAt),
    index("idx_personas_created").on(table.createdAt),
  ]
);
