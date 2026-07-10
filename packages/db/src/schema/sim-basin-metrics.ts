import { sql } from "drizzle-orm";
/**
 * SIM basin metrics schema — latest-row cache of embedding space basin statistics (one row per persona+metric_type).
 *
 * @module packages/db/src/schema/sim-basin-metrics
 * @description This table holds the most recent basin metrics computation for each (persona_id, metric_type) pair.
 *   Updates are performed in-place via upsert (last compute overwrites the previous row for that key).
 *   computed_at records the timestamp of the last computation.
 *   Weekly drift/trajectory data may be cached as JSON in the metadata field.
 *   NOTE: The live prod schema (v22 shape) retains UNIQUE(persona_id, metric_type); the append-only time-series
 *   design (one row per computation) was never deployed. Current semantics are latest-row cache, not append-only.
 * @upstream /sim/basin/compute routes and compute helpers — upsert after manual or triggered compute
 * @downstream apps/web SIM dashboard — displays latest basin stats + cached weekly data
 * @downstream /sim/export endpoint
 * @pattern latest-row cache — exactly one row per persona+metric_type; upsert-in-place; computed_at = last compute time
 * @invariant one row per (persona_id, metric_type) in prod
 * @invariant computed_at is the time of the last (most recent) computation
 * @coupling sim-axis-scores.ts — basin metrics are derived from axis score distributions
 */
import { sqliteTable, text, integer, real, index, blob } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * SIM basin metrics table — latest-row cache (one row per persona+metric_type).
 * The single row for a given persona+metric_type is updated in-place on each recompute.
 * computedAt is the timestamp of the most recent computation.
 * Weekly trajectory data can be cached in the metadata JSON.
 *
 * Key columns:
 * - metricType: Which basin this row describes (e.g., "global", "type:thought")
 * - centroid: Blob encoding the mean embedding vector of the basin
 * - meanDistance: Average distance of all embeddings from the centroid
 * - stdDistance: Standard deviation of distances — basin tightness measure
 * - outlierThreshold: Distance above which an entry is flagged as anomalous
 * - sampleCount: Number of embeddings included in this computation
 * - computedAt: Timestamp of the last computation (not a series)
 * - metadata: JSON blob for extensible metric metadata (e.g. weekly cache)
 *
 * Index strategy:
 * - persona+metricType+computedAt composite: supports queries (though only latest row exists)
 * - persona index: load all metric types for a persona
 *
 * @downstream /sim/export — latest row exported per metricType
 * @downstream apps/web SIM overview — displays latest basin stats + cached weekly
 * @pattern latest-row cache — upsert-in-place; one row per persona+metric_type
 * @invariant minimum 2 samples required for meaningful meanDistance and stdDistance values
 */
export const simBasinMetrics = sqliteTable(
  "sim_basin_metrics",
  {
    id: integer("id").primaryKey(),
    personaId: integer("persona_id")
      .notNull()
      .references(() => personas.id),
    metricType: text("metric_type").notNull(),
    centroid: blob("centroid"),
    meanDistance: real("mean_distance"),
    stdDistance: real("std_distance"),
    outlierThreshold: real("outlier_threshold"),
    sampleCount: integer("sample_count"),
    computedAt: text("computed_at").notNull().default(sql`(datetime('now'))`),
    metadata: text("metadata").default("{}"),
  },
  (table) => [
    index("idx_sim_basin_metrics_timeseries").on(
      table.personaId,
      table.metricType,
      table.computedAt
    ),
    index("idx_sim_basin_metrics_persona").on(table.personaId),
  ]
);
