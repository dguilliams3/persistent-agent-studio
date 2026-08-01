-- Claude Existence Loop - D1 Schema

-- Unified history timeline
CREATE TABLE IF NOT EXISTS history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL, -- user_message, thought, curiosity, remember, message_to_user, cold_storage, exist
  content TEXT,
  internal TEXT, -- Claude's reasoning
  created_at TEXT DEFAULT (datetime('now'))
);

-- Permanent memories (cold storage)
CREATE TABLE IF NOT EXISTS cold_storage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Loop state
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Initialize state
INSERT OR IGNORE INTO state (key, value) VALUES ('loop_count', '0');
INSERT OR IGNORE INTO state (key, value) VALUES ('last_wake_time', NULL);
INSERT OR IGNORE INTO state (key, value) VALUES ('last_message_to_user', NULL);
INSERT OR IGNORE INTO state (key, value) VALUES ('is_running', 'false');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_history_created ON history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_type ON history(type);
CREATE INDEX IF NOT EXISTS idx_history_persona_created ON history(persona_id, created_at DESC);
