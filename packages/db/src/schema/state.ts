import { sql } from "drizzle-orm";
/**
 * State schema — persona-scoped key-value store for runtime state.
 *
 * @module packages/db/src/schema/state
 * @description Key-value store for runtime state that needs to persist
 *   across Worker restarts. Persona-scoped via composite PK (key, persona_id)
 *   added in migration v26/v27. Used for per-persona settings like
 *   "loop_count", "is_running", "cycle_interval_seconds", "model", etc.
 *   Distinguished from config (which is operator-set configuration) — state is
 *   runtime-mutable by the Worker itself.
 * @upstream platforms/cloudflare — Worker reads and writes state during cycle execution
 * @downstream think cycle orchestrator — checks state for scheduling decisions
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona-scoped — composite PK (key, persona_id) for multi-persona support
 * @invariant upsert semantics on write — INSERT OR REPLACE on (key, persona_id)
 * @coupling config.ts — config is operator-set; state is runtime-mutable
 */
import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * State table — global key-value runtime state store.
 * Persists Worker runtime state across restarts without requiring persona scope.
 * Intended for low-frequency system-level reads and writes.
 *
 * Key columns:
 * - key: Unique state key (primary key) — e.g., "last_cycle_at", "active_persona_id"
 * - value: Serialized value — JSON string or plain text depending on key
 * - updatedAt: Timestamp of last write for staleness detection
 *
 * @downstream think cycle orchestrator — reads scheduling state
 * @pattern persona-scoped-kv — composite PK (key, persona_id) for multi-persona isolation
 * @invariant writes should use INSERT OR REPLACE (upsert) semantics on (key, persona_id)
 */
export const state = sqliteTable("state", {
  key: text("key").notNull(),
  personaId: integer("persona_id").notNull().default(1),
  value: text("value"),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`),
}, (table) => [
  primaryKey({ columns: [table.key, table.personaId] }),
]);
