import { sql } from "drizzle-orm";
/**
 * SIM anomaly flags schema — entries that deviate significantly from the embedding basin.
 *
 * @module packages/db/src/schema/sim-anomaly-flags
 * @description When the SIM scoring pipeline identifies an entry whose distance from
 *   the persona's embedding basin centroid exceeds the outlier threshold, it creates
 *   an anomaly flag. Flags accumulate for researcher review — they may indicate genuine
 *   identity drift, an unusual event, or a false positive to be dismissed.
 * @upstream SIM scoring pipeline — inserts flags when z-score exceeds threshold post-cycle
 * @downstream apps/web SIM dashboard — unreviewed flags are surfaced for researcher inspection
 * @downstream /sim/export — anomaly flags exported for external analysis
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — flags are per-persona
 * @invariant (targetTable, targetId) is unique — one flag per entry (most anomalous detection wins)
 * @invariant inspected = 0 means unreviewed; inspected = 1 means researcher has looked at it
 * @coupling sim-basin-metrics.ts — outlierThreshold from basin metrics determines what gets flagged
 * @coupling sim-axis-scores.ts — flaggedAxes lists which axes triggered the anomaly
 */
import { sqliteTable, text, integer, real, index, unique } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * SIM anomaly flags table — entries identified as statistical outliers from the identity basin.
 * Provides the researcher's queue for reviewing identity drift events and distinguishing
 * genuine anomalies from noise.
 *
 * Key columns:
 * - targetTable: The table containing the anomalous entry (e.g., "history")
 * - targetId: The primary key of the anomalous entry
 * - basinDistance: Euclidean or cosine distance from the basin centroid
 * - zScore: Standard deviations above the basin mean — primary anomaly severity measure
 * - flaggedAxes: JSON array of axis IDs that contributed to the flag
 * - detectionMethod: Algorithm used ("basin_distance", "axis_outlier", etc.)
 * - inspected: 0 = unreviewed; 1 = researcher has examined this flag
 * - verdict: "genuine" | "false_positive" | "interesting" — researcher's assessment
 * - notes: Researcher's free-form annotation
 * - resolvedAt: Timestamp when the researcher finished reviewing
 *
 * Index strategy:
 * - persona+inspected+verdict composite: surface unresolved flags for the researcher queue
 * - unique on (targetTable, targetId): prevents duplicate flags for the same entry
 *
 * @downstream apps/web SIM anomaly queue — displays flags where inspected = 0
 * @downstream /sim/export — full flag history exported for analysis
 * @pattern persona-scoped — flags isolated by persona_id
 * @invariant verdict must be set when resolvedAt is set
 */
export const simAnomalyFlags = sqliteTable(
  "sim_anomaly_flags",
  {
    id: integer("id").primaryKey(),
    personaId: integer("persona_id")
      .notNull()
      .references(() => personas.id),
    targetTable: text("target_table").notNull(),
    targetId: integer("target_id").notNull(),
    basinDistance: real("basin_distance"),
    zScore: real("z_score"),
    flaggedAxes: text("flagged_axes"),
    detectionMethod: text("detection_method"),
    inspected: integer("inspected").default(0),
    verdict: text("verdict"),
    notes: text("notes"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    resolvedAt: text("resolved_at"),
  },
  (table) => [
    index("idx_sim_anomaly_unresolved").on(
      table.personaId,
      table.inspected,
      table.verdict
    ),
    unique("sim_anomaly_flags_unique").on(table.targetTable, table.targetId),
  ]
);
