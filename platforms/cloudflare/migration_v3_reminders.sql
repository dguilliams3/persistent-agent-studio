-- Migration v3: Add reminders table

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  condition TEXT DEFAULT 'persistent',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Conditions can be:
-- 'persistent' - always show until dismissed
-- 'next_user_message' - surface when the user sends a message
-- 'after:YYYY-MM-DD' - surface after a specific date
-- 'after:YYYY-MM-DDTHH:MM' - surface after a specific datetime

CREATE INDEX IF NOT EXISTS idx_reminders_condition ON reminders(condition);
