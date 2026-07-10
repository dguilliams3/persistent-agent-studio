import { sql } from "drizzle-orm";
/**
 * Config schema — operator-set configuration key-value store.
 *
 * @module packages/db/src/schema/config
 * @description Stores operator-controlled configuration values that govern entity
 *   behavior — cycle intervals, feature flags, model preferences, and other
 *   tunable parameters. Distinct from state (runtime-mutable) — config values
 *   are set by the operator and read by the Worker, not written by the entity.
 *   Not persona-scoped: configuration applies at the system level.
 * @upstream admin API routes — operator writes config via POST /config
 * @downstream think cycle orchestrator — reads config to determine cycle behavior
 * @downstream packages/core — config values shape RuntimeEnv at startup
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant NOT persona-scoped — config is global operator configuration
 * @invariant key is unique (primary key) — upsert semantics on write
 * @coupling state.ts — state is runtime-mutable by Worker; config is operator-set
 */
import { sqliteTable, text, index } from "drizzle-orm/sqlite-core";

/**
 * Config table — operator-set configuration key-value store.
 * Holds tunable parameters that control entity behavior and system settings.
 * Read frequently by the Worker during cycle initialization.
 *
 * Key columns:
 * - key: Configuration key (primary key) — e.g., "cycle_interval_minutes", "default_model"
 * - value: Configuration value — always a string; parse to the appropriate type at read time
 * - updatedAt: Timestamp of last operator update
 *
 * Index strategy:
 * - key index: fast lookup by config key (though primary key already handles this)
 *
 * @downstream think cycle orchestrator — reads cycle_interval_minutes, default_model, etc.
 * @pattern global-kv — not persona-scoped; system-wide configuration
 * @invariant value is always a string — callers are responsible for parsing (e.g., parseInt)
 */
export const config = sqliteTable(
  "config",
  {
    key: text("key").primaryKey(),
    value: text("value"),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_config_key").on(table.key)]
);
