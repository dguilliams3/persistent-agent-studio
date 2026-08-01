-- Migration v21: Summary Promotion to Block 2
-- Date: 2026-01-19
-- Description: Add promotion field for pinning summaries to stable context tier

-- Adds promoted_to_block2 column to summaries table.
-- When promoted_to_block2 = 1, summary bypasses normal buffer rotation
-- and always appears in Block 2 (stable context) for tighter cache coupling.
-- When promoted_to_block2 = 0 (default), summary follows normal buffer system.
--
-- Block structure with promotion:
--   Block 1 (Cache): Implicit cache line (control, static prompts, etc.)
--   Block 2 (Stable): Context summaries + promoted summaries (pinned)
--   Block 3 (Buffer): Buffer summaries (rotating, awaiting consolidation)
--   Block 4 (Prefix): Recent history entries (newest first)
ALTER TABLE summaries ADD COLUMN promoted_to_block2 INTEGER DEFAULT 0;

-- Index for quick lookup of promoted summaries in context building
CREATE INDEX IF NOT EXISTS idx_promoted_summaries ON summaries(promoted_to_block2) WHERE promoted_to_block2 = 1;
