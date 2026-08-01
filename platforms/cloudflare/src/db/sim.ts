/**
 * SIM (Semantic Identity Monitor) - Platform Re-export
 *
 * @module db/sim
 * @description MIGRATION NOTE: Implementation moved to packages/memory/src/sim/
 *
 * This file re-exports all SIM functionality from @persistence/memory.
 * The actual implementation now lives in the shared package layer for
 * reusability across platforms.
 *
 * @see packages/memory/src/sim/index.ts for implementation
 *
 * @upstream Called by:
 *   - routes/sim.js - SIM API endpoints
 *   - Future: Context building for identity consistency checks
 * @downstream Calls:
 *   - @persistence/memory/sim
 */

// Use workspace package - relative paths don't resolve correctly with wrangler bundling
export {
  // Types
  /** @typedef {import('@persistence/memory').EmbeddingTableConfig} EmbeddingTableConfig */
  /** @typedef {import('@persistence/memory').EmbeddingTableName} EmbeddingTableName */
  /** @typedef {import('@persistence/memory').ConceptAxisRow} ConceptAxisRow */
  /** @typedef {import('@persistence/memory').ConceptAxis} ConceptAxis */
  /** @typedef {import('@persistence/memory').CreateAxisInput} CreateAxisInput */
  /** @typedef {import('@persistence/memory').UpdateAxisInput} UpdateAxisInput */
  /** @typedef {import('@persistence/memory').AxisScore} AxisScore */
  /** @typedef {import('@persistence/memory').UpsertScoreInput} UpsertScoreInput */
  /** @typedef {import('@persistence/memory').BasinMetricsRow} BasinMetricsRow */
  /** @typedef {import('@persistence/memory').BasinMetrics} BasinMetrics */
  /** @typedef {import('@persistence/memory').UpsertBasinMetricsInput} UpsertBasinMetricsInput */
  /** @typedef {import('@persistence/memory').AnomalyFlagRow} AnomalyFlagRow */
  /** @typedef {import('@persistence/memory').AnomalyFlag} AnomalyFlag */
  /** @typedef {import('@persistence/memory').CreateAnomalyInput} CreateAnomalyInput */
  /** @typedef {import('@persistence/memory').UpdateAnomalyInput} UpdateAnomalyInput */
  /** @typedef {import('@persistence/memory').AnomalyFilters} AnomalyFilters */
  /** @typedef {import('@persistence/memory').EmbeddingsExportResult} EmbeddingsExportResult */
  /** @typedef {import('@persistence/memory').EmbeddingsCoverage} EmbeddingsCoverage */
  /** @typedef {import('@persistence/memory').TableCoverageStats} TableCoverageStats */
  /** @typedef {import('@persistence/memory').SimQueryOptions} SimQueryOptions */

  // Config
  SIM_EMBEDDING_TABLES,

  // Concept axes
  getAxes,
  getAxisById,
  createAxis,
  updateAxis,
  deleteAxis,

  // Axis scores
  getScoresForEntry,
  upsertScore,
  batchUpsertScores,

  // Basin metrics
  getBasinMetrics,
  upsertBasinMetrics,

  // Anomaly tracking
  getAnomalies,
  createAnomaly,
  updateAnomaly,

  // Embedding helpers
  getEmbeddingsExport,
  getEmbeddingsCoverage,
} from '@persistence/memory';
