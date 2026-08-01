-- Migration v6: Add cycles table + prepare for R2 image storage
-- The "main ledger" - one row per runThinkingCycle execution
-- Also adds image_assets table for future R2 migration

-- ============================================================================
-- CYCLES TABLE: Main ledger for each think cycle execution
-- ============================================================================
CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),

  -- Execution context
  model TEXT,
  trigger TEXT,
  cycle_interval INTEGER,
  loop_count INTEGER,

  -- Token economics
  input_tokens INTEGER,
  output_tokens INTEGER,
  cache_creation_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_ttl TEXT,

  -- Cache strategy used
  volatile_caching_enabled INTEGER,
  history_prefix_size INTEGER,
  history_tail_size INTEGER,

  -- What happened
  action_count INTEGER,
  primary_action TEXT,
  actions_json TEXT,

  -- Cost tracking (in cents for precision)
  estimated_cost_cents REAL,

  -- Status
  status TEXT DEFAULT 'completed',
  error_message TEXT
);

-- ============================================================================
-- IMAGE_ASSETS TABLE: Metadata for images (prep for R2 migration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS image_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT DEFAULT (datetime('now')),

  -- Source info
  source_type TEXT NOT NULL,
  history_id INTEGER,
  cycle_id INTEGER,

  -- Image metadata
  prompt TEXT,
  media_type TEXT,
  width INTEGER,
  height INTEGER,
  size_bytes INTEGER,

  -- Storage location (mutually exclusive)
  base64_data TEXT,
  r2_key TEXT,
  r2_bucket TEXT,

  -- For gallery display
  title TEXT,
  description TEXT,
  is_favorite INTEGER DEFAULT 0,
  deleted_at TEXT
);

-- ============================================================================
-- ADD FOREIGN KEY TO HISTORY
-- ============================================================================
ALTER TABLE history ADD COLUMN cycle_id INTEGER;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Cycles indexes
CREATE INDEX IF NOT EXISTS idx_cycles_created ON cycles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cycles_model ON cycles(model);
CREATE INDEX IF NOT EXISTS idx_cycles_status ON cycles(status);
CREATE INDEX IF NOT EXISTS idx_cycles_trigger ON cycles(trigger);
CREATE INDEX IF NOT EXISTS idx_cycles_primary_action ON cycles(primary_action);

-- History -> Cycle link
CREATE INDEX IF NOT EXISTS idx_history_cycle ON history(cycle_id);

-- Image assets indexes
CREATE INDEX IF NOT EXISTS idx_image_assets_source ON image_assets(source_type);
CREATE INDEX IF NOT EXISTS idx_image_assets_history ON image_assets(history_id);
CREATE INDEX IF NOT EXISTS idx_image_assets_cycle ON image_assets(cycle_id);
CREATE INDEX IF NOT EXISTS idx_image_assets_created ON image_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_assets_r2 ON image_assets(r2_key);
