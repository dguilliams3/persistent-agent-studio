/**
 * Database Migration Handler
 *
 * Manages D1 schema migrations via POST /migrate endpoint.
 * Extracted from index.js handleRequest() for modularity.
 *
 * Supports two modes:
 * 1. Named migration: { password, migration: "v9" } — runs predefined SQL
 * 2. Custom SQL:      { password, sql: "CREATE TABLE..." } — runs arbitrary SQL
 *
 * @module routes/migrate
 * @upstream Called by: index.js handleRequest() for POST /migrate
 * @downstream Calls: D1 database (db.prepare, db.exec)
 */

import type { Env } from '../bootstrap.js';

interface MigrationResult {
  sql?: string;
  action?: string;
  success: boolean;
  note?: string;
  count?: number;
  data?: unknown[];
  boundaryId?: number;
  cached?: number;
  tail?: number;
}

interface MigrationError {
  sql?: string;
  action?: string;
  error: string;
}

interface MigrationDef {
  description: string;
  statements: string[];
  hasBackfill?: boolean;
}

interface MigrateBody {
  password: string;
  migration?: string;
  sql?: string;
}

// ============================================
// MIGRATION DEFINITIONS
// ============================================

/**
 * Migration definitions — maps version IDs to metadata and SQL statements.
 * Each entry has a description and an array of SQL statements to execute.
 *
 * @type {Record<string, { description: string, statements: string[] }>}
 */
const MIGRATIONS: Record<string, MigrationDef> = {
  v9: {
    description: 'Memory branches, overrides, and synthetic memories',
    statements: [
      // memory_branches table
      `CREATE TABLE IF NOT EXISTS memory_branches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        parent_branch TEXT,
        is_active INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      // Default main branch
      `INSERT OR IGNORE INTO memory_branches (name, description, is_active) VALUES ('main', 'Canonical unmodified timeline', 1)`,
      // memory_overrides table
      `CREATE TABLE IF NOT EXISTS memory_overrides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch_id INTEGER NOT NULL,
        target_table TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        override_type TEXT NOT NULL,
        override_data TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (branch_id) REFERENCES memory_branches(id) ON DELETE CASCADE,
        UNIQUE(branch_id, target_table, target_id, override_type)
      )`,
      // Override index
      `CREATE INDEX IF NOT EXISTS idx_memory_overrides_branch ON memory_overrides(branch_id, target_table)`,
      // synthetic_memories table
      `CREATE TABLE IF NOT EXISTS synthetic_memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        branch_id INTEGER NOT NULL,
        memory_type TEXT NOT NULL,
        content TEXT NOT NULL,
        internal TEXT,
        position_timestamp TEXT,
        position_after_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (branch_id) REFERENCES memory_branches(id) ON DELETE CASCADE
      )`,
      // Synthetic index
      `CREATE INDEX IF NOT EXISTS idx_synthetic_memories_branch ON synthetic_memories(branch_id)`
    ]
  },

  v10: {
    description: 'Soft delete for reminders — dismissed_at column',
    statements: [
      `ALTER TABLE reminders ADD COLUMN dismissed_at TEXT DEFAULT NULL`
    ]
  },

  v11: {
    description: 'Smart Summary Consolidation Schema — metadata, embeddings, source tracking, soft delete on summaries',
    statements: [
      // Flexible metadata storage (JSON blob)
      `ALTER TABLE summaries ADD COLUMN metadata TEXT DEFAULT '{}'`,
      // Vector embedding storage
      `ALTER TABLE summaries ADD COLUMN embedding BLOB`,
      `ALTER TABLE summaries ADD COLUMN embedding_model TEXT`,
      // Source provenance tracking
      `ALTER TABLE summaries ADD COLUMN source_ids TEXT`,
      `ALTER TABLE summaries ADD COLUMN source_type TEXT DEFAULT 'history'`,
      // Soft delete / consolidation audit trail
      `ALTER TABLE summaries ADD COLUMN archived_at TEXT`,
      `ALTER TABLE summaries ADD COLUMN replaced_by_id INTEGER`,
      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_summaries_active ON summaries(archived_at)`,
      `CREATE INDEX IF NOT EXISTS idx_summaries_replaced_by ON summaries(replaced_by_id)`,
      `CREATE INDEX IF NOT EXISTS idx_summaries_source_type ON summaries(source_type)`
    ]
  },

  v15: {
    description: 'Notebook Embeddings for RAG Retrieval — embedding columns on notebook table',
    statements: [
      `ALTER TABLE notebook ADD COLUMN embedding BLOB`,
      `ALTER TABLE notebook ADD COLUMN embedding_model TEXT`
    ]
  },

  v16: {
    description: 'Glossary table for STT corrections — wrong-to-correct form mappings',
    statements: [
      `CREATE TABLE IF NOT EXISTS glossary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wrong_form TEXT NOT NULL UNIQUE,
        correct_form TEXT NOT NULL,
        category TEXT DEFAULT 'name',
        use_in_prompt INTEGER DEFAULT 1,
        use_in_replace INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_glossary_wrong_form ON glossary(wrong_form)`
    ]
  },

  v18: {
    description: 'Voice Transcription Tracking — raw transcription, corrections, detected emotions',
    statements: [
      `CREATE TABLE IF NOT EXISTS voice_transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        persona_id INTEGER DEFAULT 1,
        history_id INTEGER,
        raw_transcription TEXT NOT NULL,
        corrected_text TEXT,
        detected_emotion TEXT,
        corrected_emotion TEXT,
        audio_duration REAL,
        glossary_applied TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (history_id) REFERENCES history(id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_history ON voice_transcriptions(history_id)`,
      `CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_persona ON voice_transcriptions(persona_id)`,
      `CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_created ON voice_transcriptions(created_at DESC)`
    ]
  },

  v20: {
    description: 'Personas System — config table, personas table with default Clio persona',
    statements: [
      `CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )`,
      `CREATE INDEX IF NOT EXISTS idx_config_key ON config(key)`,
      `CREATE TABLE IF NOT EXISTS personas (
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
      )`,
      `CREATE INDEX IF NOT EXISTS idx_personas_slug ON personas(slug)`,
      `CREATE INDEX IF NOT EXISTS idx_personas_archived ON personas(archived_at)`,
      `CREATE INDEX IF NOT EXISTS idx_personas_created ON personas(created_at DESC)`,
      `INSERT OR IGNORE INTO personas (
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
      )`,
      `INSERT OR IGNORE INTO config (key, value, updated_at)
      VALUES ('active_persona_id', '1', datetime('now'))`
    ]
  },

  v22: {
    description: 'Semantic Identity Monitor foundation schema — SIM tables plus embedding columns on learned/questions/history',
    statements: [
      `CREATE TABLE IF NOT EXISTS sim_concept_axes (
        id INTEGER PRIMARY KEY,
        persona_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        positive_examples TEXT NOT NULL,
        negative_examples TEXT NOT NULL,
        concept_vector BLOB,
        vector_model TEXT DEFAULT 'bge-base-en-v1.5',
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT,
        UNIQUE(persona_id, name)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sim_axes_persona ON sim_concept_axes(persona_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sim_axes_active ON sim_concept_axes(persona_id, is_active)`,
      `CREATE TABLE IF NOT EXISTS sim_axis_scores (
        id INTEGER PRIMARY KEY,
        persona_id INTEGER NOT NULL,
        axis_id INTEGER NOT NULL,
        target_table TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        score REAL NOT NULL,
        percentile REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(axis_id, target_table, target_id),
        FOREIGN KEY (axis_id) REFERENCES sim_concept_axes(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sim_scores_axis ON sim_axis_scores(axis_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sim_scores_target ON sim_axis_scores(target_table, target_id)`,
      `CREATE TABLE IF NOT EXISTS sim_basin_metrics (
        id INTEGER PRIMARY KEY,
        persona_id INTEGER NOT NULL,
        metric_type TEXT NOT NULL,
        centroid BLOB,
        mean_distance REAL,
        std_distance REAL,
        outlier_threshold REAL,
        sample_count INTEGER,
        computed_at TEXT NOT NULL DEFAULT (datetime('now')),
        metadata TEXT DEFAULT '{}',
        UNIQUE(persona_id, metric_type)
      )`,
      `CREATE TABLE IF NOT EXISTS sim_anomaly_flags (
        id INTEGER PRIMARY KEY,
        persona_id INTEGER NOT NULL,
        target_table TEXT NOT NULL,
        target_id INTEGER NOT NULL,
        basin_distance REAL,
        z_score REAL,
        flagged_axes TEXT,
        detection_method TEXT,
        inspected INTEGER DEFAULT 0,
        verdict TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        resolved_at TEXT,
        UNIQUE(target_table, target_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_sim_anomaly_unresolved ON sim_anomaly_flags(persona_id, inspected, verdict)`,
      `ALTER TABLE history ADD COLUMN embedding BLOB`,
      `ALTER TABLE history ADD COLUMN embedding_model TEXT`,
      `ALTER TABLE learned ADD COLUMN embedding BLOB`,
      `ALTER TABLE learned ADD COLUMN embedding_model TEXT`,
      `ALTER TABLE questions ADD COLUMN embedding BLOB`,
      `ALTER TABLE questions ADD COLUMN embedding_model TEXT`
    ]
  },

  v23: {
    description: 'Meter Snapshot on History Entries — meter_snapshot column on history table',
    statements: [
      `ALTER TABLE history ADD COLUMN meter_snapshot TEXT`
    ]
  },

  v24: {
    description: 'Summary Sort Redesign — covered_start and sort_position columns on summaries',
    statements: [
      `ALTER TABLE summaries ADD COLUMN covered_start TEXT`,
      `ALTER TABLE summaries ADD COLUMN sort_position INTEGER`,
      `CREATE INDEX IF NOT EXISTS idx_summaries_covered_start ON summaries(covered_start)`,
      `CREATE INDEX IF NOT EXISTS idx_summaries_sort_position ON summaries(sort_position)`
    ]
  },

  v25: {
    description: 'Summary Tier Refactor — explicit tier + tier_position fields replacing boundary-based derivation',
    statements: [
      `ALTER TABLE summaries ADD COLUMN tier TEXT DEFAULT 'tail'`,
      `ALTER TABLE summaries ADD COLUMN tier_position INTEGER`,
      `CREATE INDEX IF NOT EXISTS idx_summaries_tier ON summaries(tier)`,
      `CREATE INDEX IF NOT EXISTS idx_summaries_tier_position ON summaries(tier, tier_position)`
    ],
    /**
     * v25 has a post-DDL backfill step that assigns tier values and positions
     * based on the current system state. This runs after the DDL statements.
     */
    hasBackfill: true
  },

  v26: {
    description: 'Persona Columns for Remaining Tables — persona_id on pinned_images, pending_view_images, voice_history',
    statements: [
      // pinned_images: persona-specific image wall
      `ALTER TABLE pinned_images ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1`,
      `CREATE INDEX IF NOT EXISTS idx_pinned_images_persona ON pinned_images(persona_id, slot)`,
      // pending_view_images: persona-specific view queue
      `ALTER TABLE pending_view_images ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1`,
      `CREATE INDEX IF NOT EXISTS idx_pending_view_persona ON pending_view_images(persona_id, viewed)`,
      // voice_history: TTS generations per persona
      `ALTER TABLE voice_history ADD COLUMN persona_id INTEGER NOT NULL DEFAULT 1`,
      `CREATE INDEX IF NOT EXISTS idx_voice_history_persona ON voice_history(persona_id, created_at DESC)`
    ]
  }
};

/**
 * List of all valid migration version names, for use in error messages.
 * @type {string[]}
 */
const VALID_VERSIONS = Object.keys(MIGRATIONS);

// ============================================
// BACKFILL LOGIC
// ============================================

/**
 * Runs the v25 tier backfill step.
 * Assigns tier values (cached/tail/archived) and tier_position based on
 * current system state (archived_at, summary_prefix_boundary_id, covered_start).
 *
 * @param {D1Database} db - D1 database binding
 * @param {Array} results - Results accumulator
 * @param {Array} errors - Errors accumulator
 */
async function runV25Backfill(db: D1Database, results: MigrationResult[], errors: MigrationError[]) {
  try {
    // Step 1: Set tier='archived' for all archived summaries
    const archivedResult = await db.prepare(`
      UPDATE summaries SET tier = 'archived' WHERE archived_at IS NOT NULL
    `).run();
    results.push({
      action: 'backfill_archived_tier',
      success: true,
      count: archivedResult.meta.changes
    });

    // Step 2: Get the current boundary ID from state
    const boundaryState = await db.prepare(
      `SELECT value FROM state WHERE key = 'summary_prefix_boundary_id'`
    ).first<{ value: string }>();
    const cacheBoundaryId = boundaryState?.value
      ? parseInt(boundaryState.value, 10)
      : null;

    if (cacheBoundaryId && !Number.isNaN(cacheBoundaryId)) {
      // Step 3: Set tier='cached' for summaries at or before boundary (and not archived)
      const cachedResult = await db.prepare(`
        UPDATE summaries
        SET tier = 'cached'
        WHERE id <= ? AND archived_at IS NULL
      `).bind(cacheBoundaryId).run();
      results.push({
        action: 'backfill_cached_tier',
        success: true,
        count: cachedResult.meta.changes,
        boundaryId: cacheBoundaryId
      });
    } else {
      results.push({
        action: 'backfill_cached_tier',
        success: true,
        note: 'No boundary set - all active summaries remain tier=tail'
      });
    }

    // Step 4: Backfill tier_position based on current sort order within each tier
    // Cached tier: order by covered_start ASC
    const cachedSummaries = await db.prepare(`
      SELECT id FROM summaries
      WHERE tier = 'cached' AND archived_at IS NULL
      ORDER BY COALESCE(covered_start, created_at) ASC
    `).all();
    let cachedUpdated = 0;
    for (let i = 0; i < cachedSummaries.results.length; i++) {
      await db.prepare(`
        UPDATE summaries SET tier_position = ? WHERE id = ?
      `).bind((i + 1) * 100, cachedSummaries.results[i].id).run();
      cachedUpdated++;
    }

    // Tail tier: order by covered_start ASC
    const tailSummaries = await db.prepare(`
      SELECT id FROM summaries
      WHERE tier = 'tail' AND archived_at IS NULL
      ORDER BY COALESCE(covered_start, created_at) ASC
    `).all();
    let tailUpdated = 0;
    for (let i = 0; i < tailSummaries.results.length; i++) {
      await db.prepare(`
        UPDATE summaries SET tier_position = ? WHERE id = ?
      `).bind((i + 1) * 100, tailSummaries.results[i].id).run();
      tailUpdated++;
    }

    results.push({
      action: 'backfill_tier_positions',
      success: true,
      cached: cachedUpdated,
      tail: tailUpdated
    });
  } catch (e: unknown) {
    errors.push({ action: 'backfill_tiers', error: e instanceof Error ? e.message : String(e) });
  }
}

// ============================================
// STATEMENT EXECUTION
// ============================================

/**
 * Executes an array of SQL statements, collecting results and errors.
 * Tolerates "already exists" / "duplicate column" errors as idempotent successes.
 *
 * @param {D1Database} db - D1 database binding
 * @param {string[]} statements - SQL statements to execute
 * @param {Array} results - Results accumulator (mutated in place)
 * @param {Array} errors - Errors accumulator (mutated in place)
 * @param {number} [truncateLen=50] - Max chars of SQL to include in result messages
 */
async function executeStatements(db: D1Database, statements: string[], results: MigrationResult[], errors: MigrationError[], truncateLen = 50) {
  for (const sql of statements) {
    try {
      await db.prepare(sql).run();
      results.push({ sql: sql.slice(0, truncateLen) + '...', success: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('duplicate column') || msg.includes('already exists')) {
        results.push({ sql: sql.slice(0, truncateLen) + '...', success: true, note: 'Already exists' });
      } else {
        errors.push({ sql: sql.slice(0, truncateLen) + '...', error: msg });
      }
    }
  }
}

// ============================================
// MAIN HANDLER
// ============================================

/**
 * Handle POST /migrate requests.
 *
 * Runs predefined database migrations or arbitrary SQL against D1.
 * Protected by ADMIN_PASSWORD — no fallback passwords.
 *
 * @param {D1Database} db - D1 database binding
 * @param {Object} body - Request body
 * @param {string} body.password - Admin password for authentication
 * @param {string} [body.migration] - Named migration version (e.g., "v9", "v25")
 * @param {string} [body.sql] - Custom SQL to execute (alternative to named migration)
 * @param {Object} env - Environment bindings (must contain ADMIN_PASSWORD)
 * @param {Object} corsHeaders - CORS headers to include in response
 * @returns {Response} JSON response with results/errors
 *
 * @upstream Called by: handleRequest() in index.js
 * @downstream Calls: D1 database (schema DDL, data DML)
 */
export async function handleMigrate(db: D1Database, body: MigrateBody, env: Env, corsHeaders: Record<string, string>) {
  // Strict auth — no fallback password
  if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const results: MigrationResult[] = [];
  const errors: MigrationError[] = [];

  // Mode 1: Named migration version
  if (body.migration) {
    const migration = MIGRATIONS[body.migration];

    if (!migration) {
      return new Response(JSON.stringify({
        error: `Unknown migration "${body.migration}". Valid versions: ${VALID_VERSIONS.join(', ')}, or use "sql": "..." for custom SQL.`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Execute DDL statements
    const truncateLen = body.migration === 'v26' ? 60 : 50;
    await executeStatements(db, migration.statements, results, errors, truncateLen);

    // Run post-DDL backfill if defined
    if (migration.hasBackfill && body.migration === 'v25') {
      await runV25Backfill(db, results, errors);
    }
  }
  // Mode 2: Custom SQL execution
  else if (body.sql) {
    try {
      const sqlLower = body.sql.trim().toLowerCase();
      if (sqlLower.startsWith('select')) {
        const queryResult = await db.prepare(body.sql).all();
        results.push({ sql: body.sql.slice(0, 100) + '...', success: true, data: queryResult.results });
      } else {
        await db.prepare(body.sql).run();
        results.push({ sql: body.sql.slice(0, 100) + '...', success: true });
      }
    } catch (e: unknown) {
      errors.push({ sql: body.sql.slice(0, 100) + '...', error: e instanceof Error ? e.message : String(e) });
    }
  }
  // Mode 3: Neither migration nor sql provided
  else {
    return new Response(JSON.stringify({
      error: `Provide "migration": "${VALID_VERSIONS[0]}"..."${VALID_VERSIONS[VALID_VERSIONS.length - 1]}", or "sql": "..."`
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ results, errors, success: errors.length === 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}


