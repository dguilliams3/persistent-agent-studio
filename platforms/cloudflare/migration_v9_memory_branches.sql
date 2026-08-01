-- Migration v9: Memory Portability Foundation
-- Adds tables for non-destructive memory manipulation and branch-based editing
--
-- Philosophy: Never delete, only exclude.
-- Canonical history remains immutable. Modifications are stored as overlays.
--
-- Tables:
-- - memory_branches: Named configurations of memory views
-- - memory_overrides: Per-branch exclusions/edits/reorderings of canonical entries
-- - synthetic_memories: New memories that don't exist in canonical history
--
-- Run with:
--   npx wrangler d1 execute claude-loop --file=migration_v9_memory_branches.sql --remote

-- =============================================================================
-- MEMORY BRANCHES
-- =============================================================================
-- Each branch represents a different view of the memory timeline.
-- The 'main' branch shows canonical, unmodified history.
-- Other branches can exclude, edit, or reorder entries.
--
-- Only one branch can be active at a time (is_active = 1).
-- Parent branches allow inheritance of overrides.

CREATE TABLE IF NOT EXISTS memory_branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_branch TEXT,              -- For branch inheritance (name of parent)
  is_active INTEGER DEFAULT 0,     -- Only one active at a time
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Default branch (canonical view) - always exists
INSERT OR IGNORE INTO memory_branches (name, description, is_active)
VALUES ('main', 'Canonical unmodified timeline', 1);


-- =============================================================================
-- MEMORY OVERRIDES
-- =============================================================================
-- Per-branch modifications to canonical memory entries.
-- Does NOT modify the original data - only affects how it's rendered in context.
--
-- Override types:
-- - 'exclude': Entry is hidden from context view
-- - 'edit': Content is replaced (original preserved in target table)
-- - 'reorder': Entry position is modified (for timeline manipulation)

CREATE TABLE IF NOT EXISTS memory_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL,

  -- Target identification
  target_table TEXT NOT NULL,      -- 'history', 'cold_storage', 'notebook', 'user_observations', 'summaries', 'reminders'
  target_id INTEGER NOT NULL,      -- ID in the target table

  -- Override type
  override_type TEXT NOT NULL,     -- 'exclude', 'edit', 'reorder'

  -- Override data (JSON format)
  -- For 'exclude': null (presence of row indicates exclusion)
  -- For 'edit': {"content": "new content", "type": "new_type", "internal": "new internal"}
  -- For 'reorder': {"position": 5} or {"timestamp_override": "2026-01-01T00:00:00Z"}
  override_data TEXT,

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (branch_id) REFERENCES memory_branches(id) ON DELETE CASCADE,
  UNIQUE(branch_id, target_table, target_id, override_type)
);

-- Index for fast override lookups by branch
CREATE INDEX IF NOT EXISTS idx_memory_overrides_branch
ON memory_overrides(branch_id, target_table);


-- =============================================================================
-- SYNTHETIC MEMORIES
-- =============================================================================
-- Entirely new memories that don't exist in canonical history.
-- Used for:
-- - Inserting hypothetical events for experimentation
-- - Adding context that "should have been there"
-- - Testing how Claude would respond with different history
--
-- These only appear in the branch they're created for.

CREATE TABLE IF NOT EXISTS synthetic_memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL,

  -- Memory content (mirrors history table structure)
  memory_type TEXT NOT NULL,       -- Same types as history: 'thought', 'message_to_user', etc.
  content TEXT NOT NULL,
  internal TEXT,                   -- Optional internal field (subthought)

  -- Placement in timeline
  position_timestamp TEXT,         -- Explicit timestamp for ordering
  position_after_id INTEGER,       -- Or: insert after this canonical history ID

  created_at TEXT DEFAULT (datetime('now')),

  FOREIGN KEY (branch_id) REFERENCES memory_branches(id) ON DELETE CASCADE
);

-- Index for fast synthetic lookup by branch
CREATE INDEX IF NOT EXISTS idx_synthetic_memories_branch
ON synthetic_memories(branch_id);


-- =============================================================================
-- VERIFICATION QUERIES (comment out after running)
-- =============================================================================
-- SELECT * FROM memory_branches;
-- SELECT sql FROM sqlite_master WHERE name = 'memory_overrides';
-- SELECT sql FROM sqlite_master WHERE name = 'synthetic_memories';
