-- =============================================================================
-- Migration v19: Summary Token Tracking
-- =============================================================================
-- Adds columns to summaries table for accurate token counting:
-- - token_count: Actual tokens in this summary (as counted by model that created it)
-- - token_model: Which model/tokenizer was used (e.g., 'gpt-4.1-mini', 'claude-sonnet-4')
--
-- This enables accurate cache efficiency calculations vs character-based estimates.
--
-- Run via: POST /migrate { "password": "<ADMIN_PASSWORD>", "migration": "v19" }
-- =============================================================================

ALTER TABLE summaries ADD COLUMN token_count INTEGER;
ALTER TABLE summaries ADD COLUMN token_model TEXT;
