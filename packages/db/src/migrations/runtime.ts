/**
 * Runtime migrations for the @persistence/db package
 *
 * @module @persistence/db/migrations/runtime
 * @description
 * Runtime migrations run on every worker start, ensuring tables exist.
 * This is a cold-start resilience pattern that creates tables if missing.
 *
 * @antipattern
 * This approach swallows "already exists" errors for ALTER TABLE statements.
 * It's not ideal but ensures cold-start resilience without requiring
 * explicit migration version tracking for every schema change.
 *
 * @upstream Called by: worker fetch/scheduled handlers at startup
 * @downstream Calls: D1 database DDL operations
 */

/**
 * Minimal D1Database interface for raw SQL operations.
 * The full type comes from @cloudflare/workers-types at the platform layer.
 */
interface D1Database {
  prepare(query: string): { run(): Promise<unknown>; };
}

/**
 * @description Ensures required tables exist in the database
 *
 * Creates cycles and pending_batches tables if they don't exist,
 * and adds columns to history table if missing. This runs on
 * every worker cold start.
 *
 * @param db - The Cloudflare D1 database instance
 *
 * @antipattern
 * Using try/catch to swallow "already exists" errors is not ideal,
 * but it's a pragmatic solution for cold-start resilience. A better
 * approach would use versioned migrations with explicit tracking.
 */
export async function ensureTablesExist(db: D1Database): Promise<void> {
  try {
    // Create cycles table if it doesn't exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS cycles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        persona_id INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        model TEXT,
        trigger TEXT,
        cycle_interval INTEGER,
        loop_count INTEGER,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cache_creation_tokens INTEGER,
        cache_read_tokens INTEGER,
        cache_ttl TEXT,
        volatile_caching_enabled INTEGER,
        history_prefix_size INTEGER,
        history_tail_size INTEGER,
        action_count INTEGER,
        primary_action TEXT,
        actions_json TEXT,
        estimated_cost_cents REAL,
        status TEXT DEFAULT 'completed',
        error_message TEXT
      )
    `).run();

    // Create indexes for cycles
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cycles_created ON cycles(created_at DESC)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_cycles_persona ON cycles(persona_id)`).run();

    // Create pending_batches table if it doesn't exist
    // Note: Uses submitted_at (not created_at) to match migration_v7_batches.sql
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS pending_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        persona_id INTEGER DEFAULT 1,
        batch_id TEXT NOT NULL,
        custom_id TEXT,
        cycle_id INTEGER,
        trigger TEXT,
        model TEXT,
        status TEXT DEFAULT 'pending',
        results_json TEXT,
        error_message TEXT,
        submitted_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      )
    `).run();

    // Add cycle_id to history if missing
    try {
      await db.prepare(`ALTER TABLE history ADD COLUMN cycle_id INTEGER`).run();
    } catch {
      // Column already exists, ignore
    }

    // Add blurred column to history for gallery blur feature
    // When blurred=1, images show with CSS blur filter in gallery
    try {
      await db.prepare(`ALTER TABLE history ADD COLUMN blurred INTEGER DEFAULT 0`).run();
    } catch {
      // Column already exists, ignore
    }

    // Add vaulted column to history for image vault feature
    // When vaulted=1, images are hidden from main gallery, shown in vault section
    try {
      await db.prepare(`ALTER TABLE history ADD COLUMN vaulted INTEGER DEFAULT 0`).run();
    } catch {
      // Column already exists, ignore
    }

    // Add meter_snapshot column to history for internal state tracking
    // Stores Clio's meter values at the moment of the entry (e.g., "A7 C6 N10 E8 D7")
    try {
      await db.prepare(`ALTER TABLE history ADD COLUMN meter_snapshot TEXT`).run();
    } catch {
      // Column already exists, ignore
    }

    // Add model column to personas for per-persona model binding
    // (model-registry resolution ladder: options > personas.model > state > default)
    try {
      await db.prepare(`ALTER TABLE personas ADD COLUMN model TEXT`).run();
    } catch {
      // Column already exists, ignore
    }

  } catch (e) {
    console.error('Table creation error:', e);
  }
}

/**
 * @description Runs all runtime migrations
 *
 * This is the main entry point for runtime migrations.
 * Call this on worker startup before any database operations.
 *
 * @param db - The Cloudflare D1 database instance
 */
export async function runRuntimeMigrations(db: D1Database): Promise<void> {
  await ensureTablesExist(db);
}
