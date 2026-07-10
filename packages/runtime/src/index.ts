/**
 * @persistence/runtime - Agent loop and context assembly
 *
 * @description
 * Core agent runtime including the thinking cycle, context building,
 * batch processing, and memory management.
 *
 * Orchestrator type exports from this barrel:
 *   AnthropicRawUsage — pre-normalization Anthropic token usage (added)
 *   PlatformCallbacks, OrchestratorConfig, CycleOptions, OrchestratorResult
 *   SystemPromptResult, ImageData, ArtImageData, ViewImageData
 *   UserContent, ActionExecutionResult
 *
 * Removed type re-exports (no longer available from this barrel):
 *   BatchSubmitResult — import from @persistence/llm
 *   AnthropicSyncParams / AnthropicSyncResult — replaced by CallableModel in @persistence/llm
 *   LLMCallParams — replaced by typed LLM interface in @persistence/llm
 *
 * @upstream apps/worker (fetch, scheduled handlers)
 * @downstream @persistence/db, @persistence/llm, @persistence/tools
 *
 * @example
 * import { runAllGuards, resolveIdentity, PERSONA_IDENTITIES } from '@persistence/runtime';
 * import type { CycleResult, PersonaContext, GuardResult } from '@persistence/runtime';
 */

// =============================================================================
// TYPE EXPORTS
// =============================================================================
export type {
  // Action types
  ActionDecision,
  // Context types
  ContextBlock,
  SystemBlocks,
  ContextStats,
  PersonaContext,
  // Cycle types
  CycleConfig,
  CycleResult,
  ExecutedAction,
  // Guard types
  GuardResult,
  SleepState,
  // Batch types
  BatchStatus,
  PendingBatch,
  // Telemetry types
  MeterSnapshot,
  CostSummary,
} from "./types";

// =============================================================================
// CONTEXT ASSEMBLY
// =============================================================================
// Persona resolution and context building.
// =============================================================================
export {
  // Persona
  PERSONA_IDENTITIES,
  getDefaultIdentity,
  resolveIdentity,
  buildPersonaContext,
  // Cache TTL and system blocks
  selectCacheTtl,
  SHORT_TTL_THRESHOLD,
  LONG_TTL_THRESHOLD,
  buildSystemBlocks,
  // Migration status
  CONTEXT_MIGRATION_STATUS,
} from "./context";

export type { CacheStrategy, ProfilePictureRef, SystemBlock } from "./context";

// Art decay logic
export { splitArtByDecay, DEFAULT_MAX_VISIBLE_IMAGES } from "./art-decay";
export type { ArtImage, ArtDecayResult } from "./art-decay";

// =============================================================================
// AGENT LOOP
// =============================================================================
// Cycle guards and loop management.
// =============================================================================
export {
  // Guards
  checkIntervalGuard,
  checkSleepGuard,
  checkBatchGuard,
  checkRunningGuard,
  runAllGuards,
  getSleepState,
  // Migration status
  LOOP_MIGRATION_STATUS,
} from "./loop";

// =============================================================================
// ORCHESTRATOR
// =============================================================================
// Main thinking cycle orchestrator with dependency injection.
// =============================================================================
export { runThinkingCycle } from "./orchestrator";
export type {
  PlatformCallbacks,
  OrchestratorConfig,
  CycleOptions,
  OrchestratorResult,
  SystemPromptResult,
  ImageData,
  ArtImageData,
  ViewImageData,
  UserContent,
  ActionExecutionResult,
  AnthropicRawUsage,
} from "./orchestrator";

// =============================================================================
// MIGRATION STATUS
// =============================================================================
// Tracks what has been migrated vs still using worker/src/* bridge.
// =============================================================================

/**
 * @todo Migrate remaining runtime functionality:
 * - context/builder.ts - Full context assembly (from build-system-prompt.js, 1068 lines)
 * - batch/processor.ts - Batch API handling (from batch-processor.js)
 * - telemetry/ - Meter snapshots, cost tracking
 */

export const RUNTIME_MIGRATION_STATUS = {
  migrated: [
    "types",
    "context/persona",
    "context/cache",
    // 'context/user-content' - REMOVED (dead code; cycle-images.ts in platform is the active version)
    "art-decay",
    "loop/guards",
    "orchestrator",
  ],
  pending: [
    "context/builder", // Full context assembly (1068 lines)
    // 'context/cache' - MIGRATED (selectCacheTtl, buildSystemBlocks)
    // 'loop/cycle' - MIGRATED to orchestrator.ts
    "loop/executor", // Action execution
    "loop/telemetry", // Metrics and cost tracking
    "batch/processor", // Batch API handling
  ],
} as const;
