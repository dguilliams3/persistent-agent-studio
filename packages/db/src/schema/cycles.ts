import { sql } from "drizzle-orm";
/**
 * Cycles schema — records of every think cycle executed by an entity.
 *
 * @module packages/db/src/schema/cycles
 * @description Each row captures one complete think cycle: the model used, the trigger
 *   that initiated it, token consumption, caching behavior, actions taken, and cost.
 *   Cycles are the operational heartbeat of the entity — they happen on a configurable
 *   schedule (cron) or can be triggered by user messages.
 * @upstream platforms/cloudflare — scheduled worker creates cycle records after each run
 * @upstream packages/core — think orchestrator writes cycle data
 * @downstream history — history entries reference cycle_id to group per-cycle events
 * @downstream pending-batches — batch API jobs reference the cycle that submitted them
 * @downstream image-assets — images generated in a cycle reference cycle_id
 * @pattern split-schema — domain-scoped table definition for maintainability
 * @invariant persona_id is always present — cycles are per-persona
 * @invariant status is "completed", "error", or "pending" — never left as null
 * @coupling history.ts — history entries produced in a cycle carry this cycle's id
 */
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { personas } from "./personas";

/**
 * Cycles table — operational log of every entity think cycle.
 * Captures the full execution record for cost accounting, debugging,
 * and research analysis of thinking patterns.
 *
 * Key columns:
 * - model: The Anthropic model used (e.g., "claude-3-5-sonnet-20241022")
 * - trigger: What caused this cycle ("scheduled", "user_message", "manual")
 * - cycleInterval: Configured cycle interval in minutes at time of execution
 * - loopCount: Number of agentic loops within this cycle
 * - inputTokens / outputTokens: Token consumption for cost tracking
 * - cacheCreationTokens / cacheReadTokens: Prompt caching efficiency metrics
 * - cacheTtl: The cache TTL setting used ("ephemeral" or "persistent")
 * - historyPrefixSize / historyTailSize: How many history entries were loaded as context
 * - actionCount: Number of tool calls executed in this cycle
 * - primaryAction: The dominant action type taken (e.g., "think", "search")
 * - actionsJson: JSON array of all actions taken in this cycle
 * - estimatedCostCents: Computed cost in fractional cents
 * - status: "completed" | "error" | "pending"
 *
 * Index strategy:
 * - persona+created composite: time-ordered cycle history per persona
 * - model / trigger / status / primary_action: analytical queries across cycles
 *
 * @downstream pending-batches — batch jobs link back to the submitting cycle
 * @pattern append-only — cycles are records of what happened, never updated
 * @invariant estimatedCostCents is real (fractional) — summed to personas.total_cost_cents
 */
export const cycles = sqliteTable(
  "cycles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    personaId: integer("persona_id")
      .notNull()
      .default(1)
      .references(() => personas.id),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    model: text("model"),
    trigger: text("trigger"),
    cycleInterval: integer("cycle_interval"),
    loopCount: integer("loop_count"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheCreationTokens: integer("cache_creation_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    cacheTtl: text("cache_ttl"),
    volatileCachingEnabled: integer("volatile_caching_enabled"),
    historyPrefixSize: integer("history_prefix_size"),
    historyTailSize: integer("history_tail_size"),
    actionCount: integer("action_count"),
    primaryAction: text("primary_action"),
    actionsJson: text("actions_json"),
    estimatedCostCents: real("estimated_cost_cents"),
    status: text("status").default("completed"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_cycles_created").on(table.createdAt),
    index("idx_cycles_model").on(table.model),
    index("idx_cycles_status").on(table.status),
    index("idx_cycles_trigger").on(table.trigger),
    index("idx_cycles_primary_action").on(table.primaryAction),
    index("idx_cycles_persona").on(table.personaId, table.createdAt),
  ]
);
