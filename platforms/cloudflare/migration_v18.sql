-- Migration v18: Voice Transcription Tracking
-- Tracks the user's voice messages for STT correction training
-- Created: 2026-01-16

-- User voice transcription tracking table
-- Links to history table entries (type='user_message' with voice metadata)
-- Stores both original transcription and user corrections for training WhisperX
CREATE TABLE IF NOT EXISTS voice_transcriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER DEFAULT 1,              -- Persona scoping (future-proofing)
  history_id INTEGER,                        -- Link to history table entry (optional)
  raw_transcription TEXT NOT NULL,           -- What Whisper transcribed
  corrected_text TEXT,                       -- User's manual correction (null if unchanged)
  detected_emotion TEXT,                     -- What prosody detected (e.g., "happy", "thoughtful")
  corrected_emotion TEXT,                    -- User's actual emotion (null if unchanged)
  audio_duration REAL,                       -- Duration in seconds
  glossary_applied TEXT,                     -- JSON array of applied glossary entry IDs
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (history_id) REFERENCES history(id)
);

-- Index for looking up transcriptions by history entry
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_history ON voice_transcriptions(history_id);

-- Index for persona scoping
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_persona ON voice_transcriptions(persona_id);

-- Index for finding recent transcriptions (for correction UI)
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_created ON voice_transcriptions(created_at DESC);
