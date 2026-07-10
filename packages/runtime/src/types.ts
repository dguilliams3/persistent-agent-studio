/**
 * Runtime Type Definitions
 *
 * @module @persistence/runtime/types
 * @description Type definitions for agent runtime, context assembly, and cycle management.
 *   Covers the full lifecycle: PersonaContext assembly → CycleConfig → CycleResult →
 *   telemetry (MeterSnapshot, CostSummary). All types are pure data — no logic here.
 *
 * @downstream Consumed by: context/ (PersonaContext, ContextBlock, SystemBlocks),
 *   loop/ (CycleConfig, CycleResult, GuardResult, SleepState),
 *   batch/ (PendingBatch, BatchStatus)
 * @pattern one-type-per-interface — each interface is a distinct lifecycle concept;
 *   do not merge ActionDecision into CycleResult or ContextStats into SystemBlocks
 * @antipattern DO NOT add DB query functions here — this file is types only;
 *   DB access lives in @persistence/db
 */

import type { DrizzleD1, HistoryEntry } from "@persistence/db";
import type { ProviderName, LLMResponse } from "@persistence/llm";

// =============================================================================
// ACTION TYPES
// =============================================================================

/**
 * Parsed action decision from LLM response.
 *
 * Represents one action the LLM has chosen to take in a thinking cycle.
 * The `action` field identifies the tool, other fields are tool-specific params.
 */
export interface ActionDecision {
  action: string;
  content?: string;
  op?: string;
  internal?: string;
  [key: string]: unknown;
}

// =============================================================================
// CONTEXT ASSEMBLY TYPES
// =============================================================================

/**
 * @description Context block for cache-aware prompt assembly
 *
 * Blocks are assembled into a 4-block cache structure:
 * 1. Constitution (static system prompt) - ephemeral cache
 * 2. Memory (cold storage, notebook, observations) - ephemeral cache
 * 3. Summary tail (rolling history summaries) - 5-minute cache
 * 4. Live context (recent history, state) - no cache
 */
export interface ContextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * @description System prompt blocks for cache-aware assembly
 */
export interface SystemBlocks {
  blocks: ContextBlock[];
  totalTokens?: number;
  stats?: ContextStats;
}

/**
 * @description Statistics about assembled context
 */
export interface ContextStats {
  // Token counts
  systemTokens: number;
  historyTokens: number;
  totalTokens: number;

  // Content counts
  historyCount: number;
  summaryCount: number;
  coldStorageCount: number;
  notebookCount: number;
  observationCount: number;
  reminderCount: number;

  // Memory info
  ragMemoriesRetrieved: number;
  syntheticMemoryCount: number;

  // Cache info
  cacheTtl: number;
  cacheStrategy: string;
}

/**
 * @description Runtime-assembled persona context for a thinking cycle.
 *
 * Built by buildPersonaContext() in @persistence/runtime/context/persona
 * from a PersonaRecord (db) + resolved identity. Contains everything
 * the cycle needs without re-querying.
 *
 * Identity resolution order (see resolveIdentity):
 *   1. systemPromptTemplate matches a PERSONA_IDENTITIES key → use template
 *   2. systemPromptTemplate is custom text → use directly
 *   3. No systemPromptTemplate → fall back to Clio identity
 *
 * For the config-level type, see PersonaConfig in @persistence/core.
 * For the database row, see PersonaRecord in @persistence/db.
 *
 * @downstream Consumed by: context builder (builder.ts), cycle orchestrator,
 *   system prompt assembly
 * @upstream Produced by: buildPersonaContext() in @persistence/runtime/context/persona
 * @pattern assembled-at-cycle-start — this interface is constructed once per cycle
 *   and threaded through; do not re-fetch persona data mid-cycle
 * @antipattern DO NOT add DB-query fields here — PersonaContext is read-only runtime
 *   state; anything needing a DB call belongs in the context assembly step (builder.ts)
 * @invariant identity is always a non-empty resolved string — buildPersonaContext
 *   guarantees a fallback; callers may always treat identity as defined
 */
export interface PersonaContext {
  id: number;
  name: string;
  slug: string;
  /** Resolved identity paragraph — assembled from systemPromptTemplate via resolveIdentity() */
  identity: string;
  /** Raw template name/key from persona record (personas.systemPromptTemplate) */
  systemPromptTemplate?: string;
  /** Default provider preference for this persona */
  defaultProvider?: string;
  /** Default model preference for this persona */
  defaultModel?: string;
}

// =============================================================================
// CYCLE TYPES
// =============================================================================

/**
 * @description Thinking cycle configuration
 */
export interface CycleConfig {
  /** Minimum interval between cycles in seconds */
  intervalSeconds: number;
  /** Maximum tokens for LLM response */
  maxTokens: number;
  /** Model to use */
  model?: string;
  /** Provider to use */
  provider?: ProviderName;
  /** Enable batch mode */
  batchMode?: boolean;
  /** Force cycle even if interval hasn't elapsed */
  force?: boolean;
}

/**
 * @description Result of a thinking cycle
 */
export interface CycleResult {
  /** Whether the cycle was executed */
  executed: boolean;
  /** Reason for skipping if not executed */
  skipReason?: string;
  /** Actions taken during the cycle */
  actions?: ExecutedAction[];
  /** Token usage */
  tokens?: {
    input: number;
    output: number;
    cacheRead?: number;
  };
  /** Cost in cents */
  costCents?: number;
  /** Cycle ID for tracking */
  cycleId?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Any errors that occurred */
  error?: string;
}

/**
 * @description An action that was executed during a cycle
 */
export interface ExecutedAction {
  action: string;
  success: boolean;
  error?: string;
  result?: unknown;
}

// =============================================================================
// GUARD TYPES
// =============================================================================

/**
 * @description Guard check result
 */
export interface GuardResult {
  /** Whether to proceed with the cycle */
  proceed: boolean;
  /** Reason for not proceeding */
  reason?: string;
  /** Whether this is a soft skip (e.g., interval not elapsed) */
  softSkip?: boolean;
}

/**
 * @description Sleep state
 */
export interface SleepState {
  sleeping: boolean;
  wakeTime?: string; // ISO timestamp
  reason?: string;
}

// =============================================================================
// BATCH TYPES
// =============================================================================

/**
 * @description Batch job status
 */
export type BatchStatus = "pending" | "processing" | "completed" | "failed";

/**
 * @description Pending batch record
 */
export interface PendingBatch {
  id: number;
  batchId: string;
  provider: ProviderName;
  purpose: string;
  status: BatchStatus;
  createdAt: string;
  completedAt?: string;
  resultData?: string;
}

// =============================================================================
// TELEMETRY TYPES
// =============================================================================

/**
 * @description Meter snapshot for telemetry
 */
export interface MeterSnapshot {
  timestamp: string;
  values: Record<string, number>;
}

/**
 * @description Cost tracking for a period
 */
export interface CostSummary {
  period: string; // e.g., '2026-01-26' or '2026-01'
  totalCents: number;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  cycleCount: number;
}
