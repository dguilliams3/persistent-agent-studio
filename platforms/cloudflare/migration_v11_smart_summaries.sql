-- =============================================================================
-- Migration v11: Smart Summary Consolidation Schema
-- =============================================================================
-- Adds columns to summaries table for:
-- 1. Flexible metadata storage (JSON blob for entity_tags, themes, key_facts, etc.)
-- 2. Vector embedding storage (for future semantic retrieval)
-- 3. Source provenance tracking (links summaries back to history IDs or parent summary IDs)
-- 4. Soft delete with audit trail (archived_at + replaced_by_id)
--
-- This enables Claude-driven semantic consolidation where Claude selects which
-- summaries to merge based on thematic analysis, rather than human-specified indices.
--
-- Run via: POST /migrate { "password": "<ADMIN_PASSWORD>", "migration": "v11" }
-- =============================================================================

-- Flexible metadata storage (JSON blob)
-- Stores: entity_tags, key_facts, themes, emotional_tone, time_period_label, etc.
ALTER TABLE summaries ADD COLUMN metadata TEXT DEFAULT '{}';

-- Vector embedding storage (future use with Cloudflare AI or OpenAI ada-2)
-- embedding: BLOB for the vector itself (e.g., 768 or 1536 dimensions)
-- embedding_model: tracks which model generated it for future migrations
ALTER TABLE summaries ADD COLUMN embedding BLOB;
ALTER TABLE summaries ADD COLUMN embedding_model TEXT;

-- Source provenance tracking
-- source_ids: JSON array of IDs (history entry IDs or parent summary IDs)
-- source_type: 'history' for regular summaries, 'summary' for meta-summaries
ALTER TABLE summaries ADD COLUMN source_ids TEXT;
ALTER TABLE summaries ADD COLUMN source_type TEXT DEFAULT 'history';

-- Soft delete / consolidation audit trail
-- archived_at: timestamp when this summary was consolidated into another
-- replaced_by_id: ID of the summary that consolidated this one
ALTER TABLE summaries ADD COLUMN archived_at TEXT;
ALTER TABLE summaries ADD COLUMN replaced_by_id INTEGER;

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Index for efficient active summary queries (most common query pattern)
-- Partial index on archived_at being NULL
CREATE INDEX IF NOT EXISTS idx_summaries_active ON summaries(archived_at);

-- Index for lineage traversal (finding what replaced a summary)
CREATE INDEX IF NOT EXISTS idx_summaries_replaced_by ON summaries(replaced_by_id);

-- Index for finding summaries by source type
CREATE INDEX IF NOT EXISTS idx_summaries_source_type ON summaries(source_type);
