/**
 * Orchestrator Type Definitions
 *
 * @module @persistence/runtime/orchestrator/types
 * @description All interfaces for the thinking cycle orchestrator.
 * Separated to keep each module under the 150-statement limit.
 *
 * Database access uses DrizzleD1 (from @persistence/db) — NOT the raw D1Database
 * Cloudflare binding. All db parameters in this module are DrizzleD1 instances
 * created via drizzle(env.DB) in the platform layer.
 *
 * AnthropicRawUsage captures the pre-normalization token counts returned directly
 * from the Anthropic API (snake_case fields). Response processing passes this
 * to updateAnthropicMetrics() and calculateCostCents() before writing to D1.
 *
 * @upstream Used by: orchestrator/index.ts, orchestrator/providers.ts, etc.
 */

import type { DrizzleD1 } from "@persistence/db";
import type { ParseResult, LLM } from "@persistence/llm";
import type { SystemBlock } from "../context/systemBlocks";
import type { CacheStrategy } from "../context/systemBlocks";
import type {
  ImageData,
  ArtImageData,
  ViewImageData,
} from "@persistence/media";

// =============================================================================
// PLATFORM CALLBACKS
// =============================================================================

/**
 * @description Platform-specific callbacks injected by the platform layer.
 * These encapsulate concerns that differ between Cloudflare, local, etc.
 */
export interface PlatformCallbacks {
  /** Build the full system prompt (returns 4 content blocks + images + cache strategy) */
  buildSystemPrompt: (db: DrizzleD1) => Promise<SystemPromptResult>;
  /** Build user message content (cycle prompt + images) */
  buildUserContent: (
    db: DrizzleD1,
    loopCount: number,
    promptResult: SystemPromptResult,
  ) => Promise<UserContent[]>;
  /** Execute a single parsed action */
  executeAction: (
    db: DrizzleD1,
    action: Record<string, unknown>,
    cycleId: number,
  ) => Promise<void>;
  /** Execute all parsed actions with streaming/validation (DRY wrapper) */
  executeActions: (
    parseResult: ParseResult,
    cycleId: number,
  ) => Promise<ActionExecutionResult>;
  /** Process meter values from LLM response */
  processMeters: (
    db: DrizzleD1,
    meters: Record<string, number>,
    cycleId: number,
    note?: string,
  ) => Promise<void>;
  /** Send meters display to user (Telegram header) */
  sendMetersDisplay?: (
    meters: Record<string, number>,
    note?: string,
  ) => Promise<void>;
  /** Notify user of errors */
  notifyError?: (message: string) => Promise<void>;
  /** Post-cycle cleanup (clear VIEW_IMAGES, cleanup feedback) */
  postCycleCleanup?: (db: DrizzleD1) => Promise<void>;
  /** Auto-summarization after cycle */
  autoSummarize?: (db: DrizzleD1, cycleId: number) => Promise<void>;
}

// =============================================================================
// SYSTEM PROMPT & IMAGE TYPES
// =============================================================================

/** Result from buildSystemPrompt callback */
export interface SystemPromptResult {
  block1_constitution: string;
  block1Extensions: string;
  block2_promotedSummaries: string;
  block3_stableAndSummaries: string;
  block4_freshTail: string;
  cacheStrategy: CacheStrategy;
  userImages: ImageData[];
  claudeArtImages: ArtImageData[];
  historyCount: number;
  summariesCount: number;
  pendingViewImages: ViewImageData[];
}

/**
 * @deprecated These types are now defined in @persistence/media.
 * Re-exported here for backwards compatibility.
 */
export type {
  ImageData,
  ArtImageData,
  ViewImageData,
} from "@persistence/media";

/** User content block for Anthropic API */
export interface UserContent {
  type: string;
  text?: string;
  source?: { type: string; media_type: string; data: string };
}

// =============================================================================
// ACTION & BATCH TYPES
// =============================================================================

/** Result of action execution */
export interface ActionExecutionResult {
  executed: Array<{ action: string; [key: string]: unknown }>;
  failed: Array<{ action: string; error?: string; [key: string]: unknown }>;
}

// LLM call types are provided by @persistence/llm (CallableModel, LLM, CallResult, BatchHandle)
// @antipattern DO NOT define LLM call types here — use the types from @persistence/llm

/** Raw Anthropic API usage shape (pre-normalization). Used by response processing. */
export interface AnthropicRawUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// =============================================================================
// CONFIG & RESULT TYPES
// =============================================================================

/** Orchestrator configuration
 * @antipattern DO NOT add LLM call callbacks here — use the `llm` instance from @persistence/llm.
 *   The LLM package provides CallableModel with .sync() and .batch() methods that handle
 *   headers, request formatting, response parsing, and error handling for all providers.
 */
export interface OrchestratorConfig {
  db: DrizzleD1;
  /** Typed LLM interface from createLLM() — handles all provider calls */
  llm: LLM;
  callbacks: PlatformCallbacks;
  personaOptions?: import("@persistence/db").PersonaOptions;
  /**
   * Platform-supplied model registry seed (constants → D1 bootstrap). When
   * present, model resolution runs the registry ladder (options.model >
   * personas.model > state selected_model > registry default) instead of the
   * legacy state-or-DEFAULT_MODEL path. See @persistence/db model-registry.
   */
  modelRegistrySeed?: import("@persistence/db").ModelRegistry;
}

/** Cycle options (matches monolith ThinkingCycleOptions) */
export interface CycleOptions {
  fromCron?: boolean;
  model?: string;
  provider?: string;
  trigger?: string;
  force?: boolean;
}

/** Cycle result (matches monolith ThinkingCycleResult) */
export interface OrchestratorResult {
  success?: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  actions?: unknown[];
  decisions?: unknown[];
  meters?: Record<string, unknown>;
  cycleId?: number;
  provider?: string;
  model?: string;
  rawResponse?: string;
  batched?: boolean;
  batchId?: string;
  customId?: string;
  expiresAt?: string;
  cacheMetrics?: unknown;
}

/** Internal context passed between orchestrator functions */
export interface CycleContext {
  provider: string;
  model: string;
  maxOutputTokens: number;
  cycleId: number;
  loopCount: number;
  now: Date;
  promptResult: SystemPromptResult;
  userContent: UserContent[];
  quickFollowup: boolean;
}
