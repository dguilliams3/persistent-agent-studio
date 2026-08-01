-- Migration v5: Add soft-delete for history entries
-- Instead of deleting summarized entries, mark them with a timestamp
-- UI can show all entries, Claude's context excludes summarized ones

ALTER TABLE history ADD COLUMN summarized_at TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_history_summarized ON history(summarized_at);
