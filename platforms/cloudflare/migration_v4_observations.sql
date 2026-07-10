-- Migration v4: Add user_observations table
-- A sanctuary for Claude to jot observations about the user
-- Soft delete: deleted_at is set when "deleted", can be restored

CREATE TABLE IF NOT EXISTS user_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  deleted_at TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_observations_title ON user_observations(title);
CREATE INDEX IF NOT EXISTS idx_user_observations_created_at ON user_observations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_observations_deleted ON user_observations(deleted_at);
