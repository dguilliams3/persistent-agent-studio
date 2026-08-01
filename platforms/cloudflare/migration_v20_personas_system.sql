-- =============================================================================
-- Migration v20: Personas System
-- =============================================================================
-- Adds the personas system for multi-persona memory scoping.
--
-- Creates two new tables:
-- - `config`: Key-value store for system configuration (active_persona_id)
-- - `personas`: Persona definitions with metadata and cost tracking
--
-- Creates a default "Clio" persona with the existing system prompt.
--
-- Run via: POST /migrate { "password": "<ADMIN_PASSWORD>", "migration": "v20" }
-- =============================================================================

-- Config table for system-wide settings
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create index for config lookups
CREATE INDEX IF NOT EXISTS idx_config_key ON config(key);

-- Personas table for persona definitions
CREATE TABLE IF NOT EXISTS personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  system_prompt_template TEXT,
  operator_context_id TEXT,
  forked_from_id INTEGER,
  total_cycles INTEGER DEFAULT 0,
  total_cost_cents REAL DEFAULT 0.0,
  created_at TEXT DEFAULT (datetime('now')),
  archived_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes for personas
CREATE INDEX IF NOT EXISTS idx_personas_slug ON personas(slug);
CREATE INDEX IF NOT EXISTS idx_personas_archived ON personas(archived_at);
CREATE INDEX IF NOT EXISTS idx_personas_created ON personas(created_at DESC);

-- Insert the default "Clio" persona
INSERT OR IGNORE INTO personas (
  id,
  name,
  slug,
  system_prompt_template,
  created_at
) VALUES (
  1,
  'Clio',
  'clio-v1',
  'clio-v1',
  datetime('now')
);

-- Set the active persona to the default Clio persona
INSERT OR IGNORE INTO config (key, value, updated_at)
VALUES ('active_persona_id', '1', datetime('now'));
