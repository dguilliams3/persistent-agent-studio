-- Migration v17: Batch Management Enhancements (Phase 1)
-- Adds cancellation tracking and configurable timeout support
-- Created: 2026-01-16

-- Add cancelled_by column to track who/what cancelled the batch
-- Values: 'user' (manual cancel), 'auto_timeout' (system timeout), NULL (not cancelled)
ALTER TABLE pending_batches ADD COLUMN cancelled_by TEXT;

-- Add timeout_seconds column to record the timeout that was in effect when batch was created
-- This helps with debugging and understanding why batches expired
ALTER TABLE pending_batches ADD COLUMN timeout_seconds INTEGER;

-- Index for filtering by cancellation reason (e.g., find all auto-timed-out batches)
CREATE INDEX IF NOT EXISTS idx_pending_batches_cancelled_by ON pending_batches(cancelled_by);
