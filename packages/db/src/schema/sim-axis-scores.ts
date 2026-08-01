import { sql } from "drizzle-orm";
/**
 * SIM axis scores schema — cosine similarity projections of entity outputs onto concept axes.
 *
 * @module packages/db/src/schema/sim-axis-scores
 * @description For each entry in the history (or other scored tables), and for each active
 *   SIM concept axis, this table stores the cosine similarity between the entry's embedding
 *   and the axis concept vector. These scores form the raw data for trajectory analysis.
 *   Scores are computed after every think cycle and never recomputed (append-only).
 * @upstream SIM scoring pipeline — inserted by the cycle orchestrator after each cycle
 * @downstream sim-basin-metrics — basin metrics aggregate these scores over time
 * @downstream sim-anomaly-flags — anomaly detection flags entries with outlier scores
 * @downstream apps/web SIM dashboard — score time series are displayed per axis
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant (axisId, targetTable, targetId) is unique — one score per axis per entry
 * @invariant scores are never recomputed — if the axis changes, new entries are scored with new vector
 * @invariant persona_id is always present — scores are per-persona
 * @coupling sim-concept-axes.ts — axisId references the axis definition
 */
import { sqliteTable, text, integer, real, index, unique } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";
import { simConceptAxes } from "./sim-concept-axes";

/**
 * SIM axis scores table — per-entry cosine similarity scores on each concept axis.
 * Provides the raw measurement data for the Semantic Identity Monitor's
 * trajectory and basin analysis calculations.
 *
 * Key columns:
 * - axisId: The concept axis being scored against (cascade delete)
 * - targetTable: The table containing the scored entry (e.g., "history", "summaries")
 * - targetId: The primary key of the scored entry
 * - score: Cosine similarity value (-1.0 to 1.0) between entry embedding and axis vector
 * - percentile: Rank of this score within the persona's historical distribution on this axis
 *
 * Index strategy:
 * - axis index: retrieve all scores for a specific axis (time series queries)
 * - target index: retrieve all axis scores for a specific entry
 * - unique on (axisId, targetTable, targetId): prevents duplicate scoring
 *
 * @downstream sim-basin-metrics — aggregates scores per axis per time window
 * @downstream sim-anomaly-flags — identifies entries with z-scores above threshold
 * @pattern append-only — scores are computed once per entry per axis; never updated
 * @invariant score is the cosine similarity, not a normalized value — range -1.0 to 1.0
 */
export const simAxisScores = sqliteTable(
  "sim_axis_scores",
  {
    id: integer("id").primaryKey(),
    personaId: integer("persona_id")
      .notNull()
      .references(() => personas.id),
    axisId: integer("axis_id")
      .notNull()
      .references(() => simConceptAxes.id, { onDelete: "cascade" }),
    targetTable: text("target_table").notNull(),
    targetId: integer("target_id").notNull(),
    score: real("score").notNull(),
    percentile: real("percentile"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("idx_sim_scores_axis").on(table.axisId),
    index("idx_sim_scores_target").on(table.targetTable, table.targetId),
    unique("sim_axis_scores_unique").on(
      table.axisId,
      table.targetTable,
      table.targetId
    ),
  ]
);
