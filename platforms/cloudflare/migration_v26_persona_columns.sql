-- Migration v26: Add persona_id columns to pinned_images, pending_view_images, voice_history
-- Date: 2026-01-27
-- Description: Adds persona_id columns to tables that were missing them for multi-persona isolation
--
-- Background:
-- These tables were created before full persona isolation was implemented.
-- The pinned_images and pending_view_images tables manage persona-specific image curation.
-- The voice_history table stores TTS generations per persona.
--
-- Changes:
-- 1. Add persona_id to pinned_images (defaults to 1 for existing rows)
-- 2. Add persona_id to pending_view_images (defaults to 1 for existing rows)
-- 3. Add persona_id to voice_history (defaults to 1 for existing rows)
--
-- Run with:
--   npx wrangler d1 execute claude-loop --file=migration_v26_persona_columns.sql --remote

-- =============================================================================
-- PINNED_IMAGES: Add persona_id column
-- =============================================================================
-- Clio's 5-slot image wall should be persona-specific
-- Each persona can have their own pinned images

ALTER TABLE pinned_images ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;

-- Update composite primary key to include persona_id
-- SQLite doesn't support ALTER TABLE to modify PK, so we need to recreate the table
-- But for now, just add an index since slot is already the PK
CREATE INDEX IF NOT EXISTS idx_pinned_images_persona ON pinned_images(persona_id, slot);


-- =============================================================================
-- PENDING_VIEW_IMAGES: Add persona_id column
-- =============================================================================
-- Pending view images are persona-specific - each persona has their own view queue

ALTER TABLE pending_view_images ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;

-- Index for persona-scoped queries
CREATE INDEX IF NOT EXISTS idx_pending_view_persona ON pending_view_images(persona_id, viewed);


-- =============================================================================
-- VOICE_HISTORY: Add persona_id column
-- =============================================================================
-- TTS generations should be tracked per persona

ALTER TABLE voice_history ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;

-- Index for persona-scoped queries
CREATE INDEX IF NOT EXISTS idx_voice_history_persona ON voice_history(persona_id, created_at DESC);


-- =============================================================================
-- VERIFICATION QUERIES (comment out after running)
-- =============================================================================
-- SELECT sql FROM sqlite_master WHERE name = 'pinned_images';
-- SELECT sql FROM sqlite_master WHERE name = 'pending_view_images';
-- SELECT sql FROM sqlite_master WHERE name = 'voice_history';
-- SELECT COUNT(*), persona_id FROM pinned_images GROUP BY persona_id;
-- SELECT COUNT(*), persona_id FROM pending_view_images GROUP BY persona_id;
-- SELECT COUNT(*), persona_id FROM voice_history GROUP BY persona_id;
