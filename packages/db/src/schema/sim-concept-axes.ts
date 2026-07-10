import { sql } from "drizzle-orm";
/**
 * SIM concept axes schema — researcher-defined semantic dimensions for identity measurement.
 *
 * @module packages/db/src/schema/sim-concept-axes
 * @description The Semantic Identity Monitor (SIM) measures identity evolution by
 *   projecting entity outputs onto researcher-defined conceptual axes. Each axis
 *   is defined by positive examples (content that scores HIGH on the axis) and
 *   negative examples (content that scores LOW). The concept vector is derived
 *   from these examples using BGE-base-en-v1.5 embeddings.
 * @upstream admin API — researcher creates and manages axes via /sim/axes routes
 * @downstream sim-axis-scores — every scored entry gets a projection onto each active axis
 * @downstream sim-anomaly-flags — flagged_axes references axis IDs
 * @downstream apps/web SIM dashboard — axes are displayed with their score distributions
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — axes are defined per-persona for research isolation
 * @invariant (personaId, name) is unique — no duplicate axis names within a persona
 * @invariant vectorModel follows the frozen embedding model constraint (BGE-base-en-v1.5)
 * @coupling sim-axis-scores.ts — this table defines the axes; scores reference them
 */
import { sqliteTable, text, integer, index, blob, unique } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * SIM concept axes table — researcher-defined semantic dimensions for identity tracking.
 * Each axis represents a conceptual spectrum (e.g., "curiosity vs routine") used
 * to measure where entity outputs fall along that dimension over time.
 *
 * Key columns:
 * - name: Human-readable axis label (unique per persona)
 * - description: What this axis measures and why it matters for identity research
 * - positiveExamples: JSON array of text examples that score high on this axis
 * - negativeExamples: JSON array of text examples that score low on this axis
 * - conceptVector: Blob encoding the axis direction vector (derived from examples via BGE)
 * - vectorModel: Embedding model used to compute the concept vector (frozen)
 * - isActive: 1 = axis is included in scoring; 0 = retired axis
 *
 * Index strategy:
 * - persona index: load all axes for a persona
 * - persona+active composite: load only active axes for scoring pipeline
 * - unique on (personaId, name): prevents duplicate axis definitions
 *
 * @downstream sim-axis-scores — active axes are scored against all history embeddings
 * @pattern persona-scoped — axes isolated by persona_id for research integrity
 * @invariant changing positiveExamples/negativeExamples requires recomputing conceptVector
 */
export const simConceptAxes = sqliteTable(
  "sim_concept_axes",
  {
    id: integer("id").primaryKey(),
    personaId: integer("persona_id")
      .notNull()
      .references(() => personas.id),
    name: text("name").notNull(),
    description: text("description"),
    positiveExamples: text("positive_examples").notNull(),
    negativeExamples: text("negative_examples").notNull(),
    conceptVector: blob("concept_vector"),
    vectorModel: text("vector_model").default("bge-base-en-v1.5"),
    isActive: integer("is_active").default(1),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at"),
  },
  (table) => [
    index("idx_sim_axes_persona").on(table.personaId),
    index("idx_sim_axes_active").on(table.personaId, table.isActive),
    unique("sim_concept_axes_unique").on(table.personaId, table.name),
  ]
);
