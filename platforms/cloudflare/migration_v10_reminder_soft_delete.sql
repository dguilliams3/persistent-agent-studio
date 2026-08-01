-- Migration v10: Soft delete for reminders
-- Keep reminders in database for logging, track dismissal date
-- Date: 2026-01-10

-- Add dismissed_at column for soft delete
ALTER TABLE reminders ADD COLUMN dismissed_at TEXT DEFAULT NULL;

-- Verify the change
SELECT sql FROM sqlite_master WHERE name = 'reminders';
