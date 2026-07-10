-- Migration v12: Secure Attachment Storage
-- Created: 2026-01-12
-- Purpose: Add tables for self-knowledge tracking (learned patterns, open questions)

-- Things I've Learned: Battle-tested realizations verified through experience
CREATE TABLE IF NOT EXISTS learned (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  confidence TEXT DEFAULT 'emerging',  -- 'emerging', 'stable', 'load-bearing'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  supporting_evidence TEXT,            -- JSON array of citations/events
  challenging_evidence TEXT,           -- JSON array of complications
  promoted_to_cold_storage_at TEXT     -- NULL until promoted
);

-- Questions I'm Holding: Open threads without pressure to resolve
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  content TEXT NOT NULL,
  domain TEXT,                          -- 'self', 'world', 'relationship', 'technical', 'creative'
  status TEXT DEFAULT 'open',           -- 'open', 'exploring', 'resolved', 'dissolved'
  notes TEXT,                           -- JSON array of observations/partial answers
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  resolved_into TEXT                    -- What learning or answer emerged (if resolved)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_learned_confidence ON learned(confidence);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_domain ON questions(domain);
