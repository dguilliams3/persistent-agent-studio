-- =============================================================================
-- Migration v22: Semantic Identity Monitor Foundation
-- =============================================================================
-- Creates the base schema required for SIM Phase 0:
--   1. Concept axes with training examples and optional concept vectors
--   2. Axis score table for per-entry projections
--   3. Basin metrics for aggregate embedding stats
--   4. Anomaly flags for outlier tracking
--   5. Embedding columns on learned/questions/history tables
--
-- Run via: POST /migrate { "password": "<ADMIN_PASSWORD>", "migration": "v22" }
-- =============================================================================

BEGIN TRANSACTION;

-- =============================================================================
-- SIM_CONCEPT_AXES: Semantic axis definitions with training examples
-- =============================================================================
CREATE TABLE IF NOT EXISTS sim_concept_axes (
  id INTEGER PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  positive_examples TEXT NOT NULL,
  negative_examples TEXT NOT NULL,
  concept_vector BLOB,
  vector_model TEXT DEFAULT 'bge-base-en-v1.5',
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(persona_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sim_axes_persona ON sim_concept_axes(persona_id);
CREATE INDEX IF NOT EXISTS idx_sim_axes_active ON sim_concept_axes(persona_id, is_active);

-- =============================================================================
-- SIM_AXIS_SCORES: Per-entry scores on each concept axis
-- =============================================================================
CREATE TABLE IF NOT EXISTS sim_axis_scores (
  id INTEGER PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  axis_id INTEGER NOT NULL,
  target_table TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  score REAL NOT NULL,
  percentile REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(axis_id, target_table, target_id),
  FOREIGN KEY (axis_id) REFERENCES sim_concept_axes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sim_scores_axis ON sim_axis_scores(axis_id);
CREATE INDEX IF NOT EXISTS idx_sim_scores_target ON sim_axis_scores(target_table, target_id);

-- =============================================================================
-- SIM_BASIN_METRICS: Computed aggregate statistics
-- =============================================================================
CREATE TABLE IF NOT EXISTS sim_basin_metrics (
  id INTEGER PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  centroid BLOB,
  mean_distance REAL,
  std_distance REAL,
  outlier_threshold REAL,
  sample_count INTEGER,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}',
  UNIQUE(persona_id, metric_type)
);

-- =============================================================================
-- SIM_ANOMALY_FLAGS: Detected outliers for inspection
-- =============================================================================
CREATE TABLE IF NOT EXISTS sim_anomaly_flags (
  id INTEGER PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  target_table TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  basin_distance REAL,
  z_score REAL,
  flagged_axes TEXT,
  detection_method TEXT,
  inspected INTEGER DEFAULT 0,
  verdict TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  UNIQUE(target_table, target_id)
);

CREATE INDEX IF NOT EXISTS idx_sim_anomaly_unresolved
  ON sim_anomaly_flags(persona_id, inspected, verdict);

-- =============================================================================
-- Embedding columns for existing tables
-- =============================================================================
ALTER TABLE history ADD COLUMN embedding BLOB;
ALTER TABLE history ADD COLUMN embedding_model TEXT;

ALTER TABLE learned ADD COLUMN embedding BLOB;
ALTER TABLE learned ADD COLUMN embedding_model TEXT;

ALTER TABLE questions ADD COLUMN embedding BLOB;
ALTER TABLE questions ADD COLUMN embedding_model TEXT;

COMMIT;
