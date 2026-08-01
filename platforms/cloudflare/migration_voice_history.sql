-- Voice History Table
-- Stores all TTS generations for playback and credit tracking
CREATE TABLE IF NOT EXISTS voice_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'v2',
  stability REAL,
  audio_base64 TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Index for listing by date
CREATE INDEX IF NOT EXISTS idx_voice_history_created ON voice_history(created_at DESC);
