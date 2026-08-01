-- Migration v8: Add last_viewed_at to notebook table
-- Tracks when each note was last retrieved via RETRIEVE_NOTE action

ALTER TABLE notebook ADD COLUMN last_viewed_at TEXT;

-- Create index for efficient ordering by access time
CREATE INDEX IF NOT EXISTS idx_notebook_last_viewed ON notebook(last_viewed_at DESC);
