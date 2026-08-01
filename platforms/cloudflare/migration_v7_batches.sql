-- Migration v7: Pending Batches table for Anthropic Batches API
-- Tracks submitted batch requests during overnight hours for 50% cost savings

CREATE TABLE IF NOT EXISTS pending_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL UNIQUE,          -- Anthropic's batch ID (e.g., "msgbatch_...")
  custom_id TEXT NOT NULL,                -- Our custom ID to match results (e.g., "cycle-123")
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  cycle_id INTEGER,                       -- Reference to cycles table if applicable
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, expired
  completed_at TEXT,
  results_json TEXT,                      -- Raw API response when completed
  error_message TEXT,                     -- Error details if failed

  -- Store context needed to process the response
  -- We don't store the full prompt (too large), we rebuild from DB state
  trigger TEXT,                           -- 'cron' or 'manual'
  model TEXT,                             -- Model used

  FOREIGN KEY (cycle_id) REFERENCES cycles(id)
);

-- Index for efficient polling of pending batches
CREATE INDEX IF NOT EXISTS idx_pending_batches_status ON pending_batches(status);
CREATE INDEX IF NOT EXISTS idx_pending_batches_submitted ON pending_batches(submitted_at);
