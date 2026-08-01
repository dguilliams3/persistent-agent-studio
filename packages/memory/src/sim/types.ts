/**
 * SIM (Semantic Identity Monitor) Types
 *
 * @module @persistence/memory/sim/types
 * @description Type definitions for the SIM system.
 *
 * SIM tracks identity coherence through:
 * - Concept axes (trained vector directions for meaning dimensions)
 * - Axis scores (projections of content onto concept axes)
 * - Basin metrics (distribution statistics for anomaly detection)
 * - Anomaly flags (content that deviates from learned patterns)
 *
 * @upstream Used by: @persistence/memory/sim
 * @downstream None (pure type definitions)
 */

import type { PersonaOptions } from '@persistence/db';

// ============================================================================
// EMBEDDING TABLE CONFIG
// ============================================================================

/**
 * Row formatter function type
 * Default T is Record<string, unknown> since D1 returns objects with unknown values
 */
export type RowFormatter<T = Record<string, unknown>> = (row: T) => unknown;

/**
 * Configuration for tables that support embeddings
 */
export interface EmbeddingTableConfig<T = Record<string, unknown>> {
  /** Table name in database */
  table: string;
  /** SQL SELECT columns */
  select: string;
  /** Column containing text to embed */
  textColumn: string;
  /** ORDER BY clause */
  orderBy: string;
  /** Column to touch on update (null if none) */
  touchColumn: string | null;
  /** Format function to transform rows for export */
  format: RowFormatter<T>;
}

/**
 * Available embedding table names
 */
export type EmbeddingTableName = 'summaries' | 'learned' | 'questions' | 'history';

// ============================================================================
// CONCEPT AXES
// ============================================================================

/**
 * Raw database row for concept axis
 */
export interface ConceptAxisRow {
  id: number;
  persona_id: number;
  name: string;
  description: string | null;
  positive_examples: string; // JSON array
  negative_examples: string; // JSON array
  concept_vector: ArrayBuffer | Uint8Array | number[] | null;
  vector_model: string;
  is_active: number;
  created_at: string;
  updated_at: string | null;
}

/**
 * Parsed concept axis (JS-friendly format)
 */
export interface ConceptAxis {
  id: number;
  persona_id: number;
  name: string;
  description: string | null;
  positive_examples: string[];
  negative_examples: string[];
  concept_vector: Float32Array | null;
  vector_model: string;
  is_active: number;
  created_at: string;
  updated_at: string | null;
}

/**
 * Input for creating a new axis
 */
export interface CreateAxisInput {
  name: string;
  description?: string | null;
  positiveExamples?: string[];
  negativeExamples?: string[];
  conceptVector?: Float32Array | number[];
  vectorModel?: string;
  isActive?: boolean | number;
}

/**
 * Input for updating an axis
 */
export interface UpdateAxisInput {
  name?: string;
  description?: string | null;
  positiveExamples?: string[];
  negativeExamples?: string[];
  conceptVector?: Float32Array | number[] | null;
  vectorModel?: string;
  isActive?: boolean | number;
}

// ============================================================================
// AXIS SCORES
// ============================================================================

/**
 * Axis score linking content to a concept axis
 */
export interface AxisScore {
  id: number;
  persona_id: number;
  axis_id: number;
  target_table: string;
  target_id: number;
  score: number;
  percentile: number | null;
  created_at: string;
  axis_name?: string; // Joined from sim_concept_axes
}

/**
 * Input for upserting a score
 */
export interface UpsertScoreInput {
  axisId: number;
  targetTable: string;
  targetId: number;
  score: number;
  percentile?: number | null;
}

// ============================================================================
// BASIN METRICS
// ============================================================================

/**
 * Raw database row for basin metrics
 */
export interface BasinMetricsRow {
  id: number;
  persona_id: number;
  metric_type: string;
  centroid: ArrayBuffer | Uint8Array | number[] | null;
  mean_distance: number | null;
  std_distance: number | null;
  outlier_threshold: number | null;
  sample_count: number | null;
  metadata: string; // JSON
  computed_at: string;
}

/**
 * Parsed basin metrics (JS-friendly format)
 */
export interface BasinMetrics {
  id: number;
  persona_id: number;
  metric_type: string;
  centroid: Float32Array | null;
  mean_distance: number | null;
  std_distance: number | null;
  outlier_threshold: number | null;
  sample_count: number | null;
  metadata: Record<string, unknown>;
  computed_at: string;
}

/**
 * Input for upserting basin metrics
 */
export interface UpsertBasinMetricsInput {
  centroid?: Float32Array | number[] | null;
  meanDistance?: number | null;
  stdDistance?: number | null;
  outlierThreshold?: number | null;
  sampleCount?: number | null;
  metadata?: Record<string, unknown>;
}

/**
 * Entry shape used for weekly drift bucket computation.
 */
export interface WeeklyBasinEntry {
  id: number;
  createdAt: string;
  embedding: Float32Array;
}

/**
 * Weekly drift bucket for one voice type.
 */
export interface WeeklyBasinBucket {
  week: string;
  n: number;
  meanDistFromGlobal: number;
  outlierRate: number;
  ownSpread: number | null;
  ownCentroidShiftFromGlobal: number | null;
}

// ============================================================================
// ANOMALY TRACKING
// ============================================================================

/**
 * Raw database row for anomaly flag
 */
export interface AnomalyFlagRow {
  id: number;
  persona_id: number;
  target_table: string;
  target_id: number;
  basin_distance: number | null;
  z_score: number | null;
  flagged_axes: string; // JSON array
  detection_method: string | null;
  inspected: number;
  verdict: string | null;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

/**
 * Parsed anomaly flag (JS-friendly format)
 */
export interface AnomalyFlag {
  id: number;
  persona_id: number;
  target_table: string;
  target_id: number;
  basin_distance: number | null;
  z_score: number | null;
  flagged_axes: string[];
  detection_method: string | null;
  inspected: number;
  verdict: string | null;
  notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

/**
 * Input for creating an anomaly
 */
export interface CreateAnomalyInput {
  targetTable: string;
  targetId: number;
  basinDistance?: number | null;
  zScore?: number | null;
  flaggedAxes?: string[];
  detectionMethod?: string | null;
}

/**
 * Input for updating an anomaly
 */
export interface UpdateAnomalyInput {
  inspected?: boolean | number;
  verdict?: string | null;
  notes?: string | null;
  resolvedAt?: string | null;
}

/**
 * Filters for querying anomalies
 */
export interface AnomalyFilters {
  unresolvedOnly?: boolean;
  limit?: number;
}

// ============================================================================
// EMBEDDING EXPORT TYPES
// ============================================================================

/**
 * Serialized embedding (number array for JSON export)
 */
export type SerializedEmbedding = number[] | null;

/**
 * Summary row for export
 */
export interface SummaryExportRow {
  id: number;
  summary: string;
  metadata: Record<string, unknown>;
  created_at: string;
  embedding_model: string | null;
  embedding: SerializedEmbedding;
}

/**
 * Learned row for export
 */
export interface LearnedExportRow {
  id: number;
  content: string;
  confidence: string;
  created_at: string;
  embedding_model: string | null;
  embedding: SerializedEmbedding;
}

/**
 * Question row for export
 */
export interface QuestionExportRow {
  id: number;
  content: string;
  domain: string | null;
  status: string;
  created_at: string;
  embedding_model: string | null;
  embedding: SerializedEmbedding;
}

/**
 * History row for export
 */
export interface HistoryExportRow {
  id: number;
  type: string;
  content: string;
  internal: string | null;
  created_at: string;
  embedding_model: string | null;
  embedding: SerializedEmbedding;
}

/**
 * Combined export result type
 */
export type EmbeddingsExportResult = {
  summaries?: SummaryExportRow[];
  learned?: LearnedExportRow[];
  questions?: QuestionExportRow[];
  history?: HistoryExportRow[];
};

/**
 * Coverage stats for a single table
 */
export interface TableCoverageStats {
  total: number;
  withEmbedding: number;
  percent: number;
}

/**
 * Coverage stats for all tables
 */
export type EmbeddingsCoverage = Record<EmbeddingTableName, TableCoverageStats>;

// ============================================================================
// OPTIONS
// ============================================================================

/**
 * Extended options for SIM queries
 */
export interface SimQueryOptions extends PersonaOptions {
  limit?: number;
}
