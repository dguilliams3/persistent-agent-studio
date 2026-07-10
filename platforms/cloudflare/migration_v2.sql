-- Migration v2: Add notebook, summaries, and configurable interval

-- Notebook for persistent notes (outside history rotation)
CREATE TABLE IF NOT EXISTS notebook (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL UNIQUE,
  summary TEXT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Summaries of old history
CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary TEXT NOT NULL,
  message_count INTEGER,
  covered_range TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Add cycle interval setting (default 300 seconds = 5 minutes)
INSERT OR IGNORE INTO state (key, value) VALUES ('cycle_interval_seconds', '300');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notebook_title ON notebook(title);
CREATE INDEX IF NOT EXISTS idx_summaries_created ON summaries(created_at DESC);
