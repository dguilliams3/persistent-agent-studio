-- =============================================================================
-- Migration v27: Constitutional Fixes — Persona Isolation + Append-Only SIM
-- =============================================================================
-- NOTE (2026-07-04, B4-B docs-truth pass): THIS MIGRATION WAS NEVER APPLIED TO PROD.
-- The live prod D1 (v22 shape) still has UNIQUE(persona_id, metric_type) on sim_basin_metrics.
-- Current application code (packages/memory/src/sim/routes.ts and upsertBasinMetrics) uses
-- upsert-in-place semantics (latest row cache, one row per persona+metric_type).
-- computed_at reflects the last compute time. Weekly data is cached in metadata.
-- DO NOT APPLY THIS MIGRATION NOW. It predates the current upsert code and would conflict
-- with the live schema and logic.
--
-- Other parts of v27 (persona_id additions to 9+ tables, prompt_components, user_observations
-- rename, additional 5 tables) appear to have been incorporated into the current Drizzle
-- schema definitions in packages/db/src/schema/ (many tables now declare persona_id).
-- This is DOCUMENT ONLY — no prod mutations. See FINDINGS for details.
--
-- Purpose (historical):
--   Resolves two constitutional violations (§4 and §5) identified by
--   architecture-council-02 during the Drizzle migration review, and applies
--   three council decisions (Q3 prompt_components table, append-only SIM,
--   no-personal-names renaming).
--
-- Why this migration exists (historical):
--   The original schema predates the multi-persona architecture. Nine tables
--   were created without a persona_id column, making it impossible to enforce
--   the §4 constraint ("all D1 queries that touch entity data MUST filter by
--   persona_id"). Additionally, sim_basin_metrics had a UNIQUE constraint that
--   forced upsert semantics, violating §5 ("results stored append-only,
--   INSERT never UPDATE"). Both violations were harmless with a single persona
--   but become data-correctness bugs the moment a second persona is added.
--
-- Changes applied:
--   1. Adds persona_id to 9 tables missing it (§4 violation)
--   2. Removes UNIQUE(persona_id, metric_type) from sim_basin_metrics (§5 violation)
--   3. Adds computed_at + new index for append-only time-series on sim_basin_metrics
--   4. Creates prompt_components table (council Q3 decision)
--   5. Renames user_observations → observations (no personal names in code)
--
-- Data safety:
--   All existing data defaults to persona_id = 1 (Clio). No rows are deleted.
--   The sim_basin_metrics rebuild copies all existing rows into the new table
--   before dropping the old one.
--
-- Idempotency:
--   NOT fully idempotent. ALTER TABLE ADD COLUMN will error if run twice.
--   Run once against each environment (local dev, then remote production).
--
-- Run with:
--   npx wrangler d1 execute claude-loop --file=migration_v27_constitutional_fixes.sql --remote
-- =============================================================================

BEGIN TRANSACTION;

-- =============================================================================
-- PART 1: Add persona_id to 9 tables
-- =============================================================================
-- Constitutional violation §4: "All D1 queries that touch entity data MUST
-- filter by persona_id." These 9 tables were created before persona isolation
-- was added to the schema. Without persona_id, a query for persona 2's
-- notebook entries would return persona 1's entries — silently corrupting the
-- research experiment and potentially leaking identity context between entities.
--
-- Fix: Add persona_id INTEGER NOT NULL DEFAULT 1 to each table.
-- DEFAULT 1 assigns all existing rows to Clio (persona_id=1), which is correct
-- because only Clio existed when these rows were written.
--
-- Each column addition is paired with a covering index on (persona_id, ...) so
-- that the mandatory WHERE persona_id = ? filter does not cause a full table
-- scan as row counts grow.
-- =============================================================================

-- cold_storage: long-term memories the entity has chosen to retain permanently.
-- Indexed on (persona_id, created_at DESC) for time-ordered retrieval per persona.
ALTER TABLE cold_storage ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_cold_storage_persona ON cold_storage(persona_id, created_at DESC);

-- notebook: scratchpad entries the entity writes to itself during thinking cycles.
ALTER TABLE notebook ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_notebook_persona ON notebook(persona_id);

-- summaries: compressed memory blocks produced by the summarization pipeline.
-- Indexed on (persona_id, created_at DESC) so the most recent summary for a
-- persona can be fetched without scanning all personas' summaries.
ALTER TABLE summaries ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_summaries_persona ON summaries(persona_id, created_at DESC);

-- reminders: time-based reminders the entity schedules for itself.
ALTER TABLE reminders ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_reminders_persona ON reminders(persona_id);

-- cycles: one row per thinking cycle, recording start/end time and token usage.
-- Indexed on (persona_id, created_at DESC) for cycle history queries per persona.
ALTER TABLE cycles ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_cycles_persona ON cycles(persona_id, created_at DESC);

-- image_assets: images generated or collected by the entity (art, references).
-- Indexed on (persona_id, created_at DESC) for the image wall display.
ALTER TABLE image_assets ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_image_assets_persona ON image_assets(persona_id, created_at DESC);

-- learned: facts and knowledge the entity has explicitly added to its knowledge base.
ALTER TABLE learned ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_learned_persona ON learned(persona_id);

-- questions: open questions the entity has queued for future research.
ALTER TABLE questions ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_questions_persona ON questions(persona_id);

-- user_observations: this table will be renamed to "observations" in Part 4
-- (removing the personal name per architectural convention). Adding persona_id
-- here before the rename so Part 4 only handles the rename, not dual concerns.
ALTER TABLE user_observations ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_user_observations_persona ON user_observations(persona_id);


-- =============================================================================
-- PART 2: Fix sim_basin_metrics UNIQUE constraint
-- =============================================================================
-- Constitutional violation §5: "Results stored append-only (INSERT, never
-- UPDATE) to build a continuous time-series trajectory."
--
-- Why UNIQUE(persona_id, metric_type) is a violation:
--   The SIM (Semantic Identity Monitor) tracks how a persona's embedding
--   centroid shifts over time. Each thinking cycle inserts a new row capturing
--   the current centroid, mean distance, and standard deviation. This produces
--   a continuous time-series trajectory that researchers can analyze for
--   identity drift. The UNIQUE constraint forced callers to use INSERT OR
--   REPLACE (upsert), which silently deleted the previous row. That means only
--   the LATEST metric snapshot is retained — destroying the trajectory and
--   making longitudinal research impossible.
--
-- Fix strategy:
--   SQLite does not support ALTER TABLE DROP CONSTRAINT. The only way to remove
--   a constraint is to recreate the table without it. This is a standard SQLite
--   pattern: create new table → copy data → drop old table → rename new table.
--   The computed_at column (already present in the original schema) is retained
--   and indexed for efficient time-series queries.
-- =============================================================================

-- Step 1: Create the replacement table without the UNIQUE constraint.
-- The schema is otherwise identical to the original sim_basin_metrics.
CREATE TABLE sim_basin_metrics_new (
  id INTEGER PRIMARY KEY,
  persona_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL,
  centroid BLOB,
  mean_distance REAL,
  std_distance REAL,
  outlier_threshold REAL,
  sample_count INTEGER,
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  metadata TEXT DEFAULT '{}'
);

-- Step 2: Copy all existing rows from the old table into the new one.
-- No data is lost — every historical metric snapshot is preserved.
INSERT INTO sim_basin_metrics_new (id, persona_id, metric_type, centroid, mean_distance, std_distance, outlier_threshold, sample_count, computed_at, metadata)
SELECT id, persona_id, metric_type, centroid, mean_distance, std_distance, outlier_threshold, sample_count, computed_at, metadata
FROM sim_basin_metrics;

-- Step 3: Drop the original table (the one with the UNIQUE constraint).
-- Safe to drop because all rows have been copied to sim_basin_metrics_new.
DROP TABLE sim_basin_metrics;

-- Step 4: Rename the new table to take the canonical name.
-- All application code references sim_basin_metrics — no code changes needed.
ALTER TABLE sim_basin_metrics_new RENAME TO sim_basin_metrics;

-- Step 5: Create the time-series covering index.
-- Queries for "all metric snapshots of type X for persona Y, newest first"
-- (the primary SIM research query) are served entirely from this index.
CREATE INDEX IF NOT EXISTS idx_sim_basin_metrics_timeseries
  ON sim_basin_metrics(persona_id, metric_type, computed_at DESC);

-- Note: No standalone persona-only index needed — persona_id is the leftmost
-- prefix of the timeseries composite index above, which SQLite can use for
-- any query filtering only on persona_id.


-- =============================================================================
-- PART 3: Create prompt_components table
-- =============================================================================
-- Council Q3 decision: extract prompt construction into a dedicated table.
--
-- Why a separate table instead of columns on the personas table:
--   A persona's system prompt is not a single blob — it is composed of multiple
--   named components (biography, directives, constraints, tone guidance, tool
--   instructions). The old design stored this as a single text column, which
--   meant any change to one component required a full column update and made
--   it impossible to toggle individual directives on/off for experiments.
--
--   With prompt_components, each component is a row. Benefits:
--   - Variable cardinality: a persona can have 3 directives or 30, no schema change
--   - Per-directive toggling: set is_active = 0 to disable one component for an
--     experiment without affecting others
--   - Ordered composition: sort_order controls the sequence components are
--     assembled into the final prompt
--   - Experimental addition: adding a new prompt component for A/B testing is
--     an INSERT, not an ALTER TABLE
--
-- The UNIQUE(persona_id, kind, name) constraint prevents duplicate component
-- names within a kind for the same persona, while allowing multiple components
-- of the same kind (e.g., multiple "directive" rows with different names).
-- =============================================================================

CREATE TABLE IF NOT EXISTS prompt_components (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  persona_id INTEGER NOT NULL REFERENCES personas(id),
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(persona_id, kind, name)
);

-- Covering index for the primary query pattern: "fetch all active components
-- of kind X for persona Y, in sort order." This is the prompt assembly query
-- executed at the start of every thinking cycle.
CREATE INDEX IF NOT EXISTS idx_prompt_components_persona
  ON prompt_components(persona_id, kind, sort_order);


-- =============================================================================
-- PART 4: Rename user_observations → observations
-- =============================================================================
-- Constitutional rule (ARCHITECTURE_CONSTRAINTS.md §"No Personal Names in
-- Code"): this codebase will become open source. Personal names in table
-- names, column names, and function names create irreversible coupling to
-- one person's identity. The table is named "user_observations" because it
-- was originally scoped to a specific human operator — but the ENTITY (Clio)
-- is the one doing the observing. The table name should reflect what it
-- stores, not who configured the system.
--
-- The rename is "observations" (not "user_observations" or "entity_observations")
-- because the persona_id column already identifies WHOSE observations they are.
-- Adding another qualifier would be redundant.
--
-- SQLite 3.25+ supports ALTER TABLE ... RENAME TO. Cloudflare D1 uses a modern
-- SQLite build, so this operation is safe without a create/copy/drop cycle.
-- =============================================================================

ALTER TABLE user_observations RENAME TO observations;

-- SQLite automatically updates the internal index pointers when a table is
-- renamed, but the index NAMES themselves retain the old prefix. This means
-- idx_user_observations_title still exists as a valid index name pointing at
-- the observations table — but the name is stale and confusing. We create
-- clean-named replacements and drop the old names to maintain naming clarity.

-- Clean-named indexes matching the new table name convention.
-- title: supports full-text-style prefix searches ("find all observations about X").
-- created_at DESC: supports time-ordered retrieval (most recent observations first).
-- deleted_at: supports soft-delete filtering (WHERE deleted_at IS NULL).
-- persona_id: supports the mandatory §4 persona filter (covered by Part 1 index,
--   recreated here under the clean name for consistency).
CREATE INDEX IF NOT EXISTS idx_observations_title ON observations(title);
CREATE INDEX IF NOT EXISTS idx_observations_created_at ON observations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_observations_deleted ON observations(deleted_at);
CREATE INDEX IF NOT EXISTS idx_observations_persona ON observations(persona_id);

-- Drop the stale old-named indexes. The IF EXISTS guard makes this safe even
-- if a previous partial run already dropped them.
DROP INDEX IF EXISTS idx_user_observations_title;
DROP INDEX IF EXISTS idx_user_observations_created_at;
DROP INDEX IF EXISTS idx_user_observations_deleted;
DROP INDEX IF EXISTS idx_user_observations_persona;

-- Update the memory_overrides table, which stores table names as plain strings
-- for the overlay system. Any active overlay targeting "user_observations" would
-- silently stop working after the rename without this update. The WHERE clause
-- makes this update safe to re-run (it becomes a no-op after the first run).
UPDATE memory_overrides
SET target_table = 'observations'
WHERE target_table = 'user_observations';

-- Also update SIM tables that store table names as strings in target_table.
-- sim_axis_scores stores per-entry projections keyed by (target_table, target_id).
-- sim_anomaly_flags stores outlier flags keyed by (target_table, target_id).
-- Any rows referencing the old name would silently orphan after the rename.
UPDATE sim_axis_scores
SET target_table = 'observations'
WHERE target_table = 'user_observations';

UPDATE sim_anomaly_flags
SET target_table = 'observations'
WHERE target_table = 'user_observations';


-- =============================================================================
-- PART 5: Add persona_id to 5 additional tables
-- =============================================================================
-- Adversarial review flagged these tables as also storing entity data that
-- should be persona-scoped. While they were not in the original SPEC's 9-table
-- list, they are entity data under §4:
--
-- - pending_batches: batch API requests are persona-specific (each persona's
--   thinking cycle submits its own batch)
-- - glossary: STT corrections may differ per persona (name pronunciation, etc.)
-- - memory_branches: branch configurations are persona-specific memory views
-- - memory_overrides: overlays target persona-specific entries
-- - synthetic_memories: synthetic history entries are per-persona experiments
-- =============================================================================

ALTER TABLE pending_batches ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_pending_batches_persona ON pending_batches(persona_id);

ALTER TABLE glossary ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_glossary_persona ON glossary(persona_id);

ALTER TABLE memory_branches ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_memory_branches_persona ON memory_branches(persona_id);

ALTER TABLE memory_overrides ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_memory_overrides_persona ON memory_overrides(persona_id);

ALTER TABLE synthetic_memories ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_synthetic_memories_persona ON synthetic_memories(persona_id);


COMMIT;
