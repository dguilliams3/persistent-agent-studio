-- Migration v11: Glossary table for STT corrections
-- Created: 2026-01-15

-- Glossary stores wrong→correct mappings for speech-to-text post-processing
-- Used in both prompt priming (initial_prompt) and post-transcription replacement

CREATE TABLE IF NOT EXISTS glossary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wrong_form TEXT NOT NULL UNIQUE,     -- What STT typically outputs (e.g., "Casey")
    correct_form TEXT NOT NULL,          -- What it should be (e.g., "Kasey")
    category TEXT DEFAULT 'name',        -- 'name', 'term', 'phrase' for organization
    use_in_prompt INTEGER DEFAULT 1,     -- Include in WhisperX initial_prompt?
    use_in_replace INTEGER DEFAULT 1,    -- Apply as post-processing replacement?
    created_at TEXT DEFAULT (datetime('now'))
);

-- Index for fast lookups during post-processing
CREATE INDEX IF NOT EXISTS idx_glossary_wrong_form ON glossary(wrong_form);
