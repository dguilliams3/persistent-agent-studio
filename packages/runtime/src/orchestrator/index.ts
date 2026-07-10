/**
 * Thinking Cycle Orchestrator
 *
 * @module @persistence/runtime/orchestrator
 * @description Main entry point for the thinking cycle. Wires together
 * guard checks, context assembly, provider routing, and response processing.
 *
 * Cycle flow:
 * 1. Guard checks (is_running, batch, interval, sleep)
 * 2. Quick-followup bypass (cache prime, search follow-up)
 * 3. Set last_wake_time (prevents cron race conditions)
 * 4. Context assembly (system prompt + user content with images)
 * 5. Provider routing (Anthropic sync/batch, OpenAI, local)
 * 6. Response parsing → action execution → metrics → auto-summarization
 *
 * Exported types (re-exported from ./types):
 *   AnthropicRawUsage — pre-normalization token counts from Anthropic API
 *   PlatformCallbacks, OrchestratorConfig, CycleOptions, OrchestratorResult
 *   SystemPromptResult, ImageData, ArtImageData, ViewImageData
 *   UserContent, ActionExecutionResult, CycleContext
 *
 * Removed types (no longer exported from this module):
 *   BatchSubmitResult — moved to @persistence/llm
 *   AnthropicSyncParams / AnthropicSyncResult — replaced by CallableModel interface in @persistence/llm
 *   LLMCallParams — replaced by typed LLM interface; use llm.anthropic.opus.sync() etc.
 *
 * @upstream Called by: platform scheduled() handler
 * @downstream Calls: prechecks, providers, response modules
 */

import type { DrizzleD1 } from "@persistence/db";
import { getState, setState, createCycle } from "@persistence/db";
import {
  runGuards,
  checkQuickFollowup,
  resolveProviderConfig,
} from "./prechecks";
import { runNonAnthropicCycle, runAnthropicCycle } from "./providers";
import type {
  OrchestratorConfig,
  CycleOptions,
  OrchestratorResult,
} from "./types";

// Re-export all types for consumers
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
  CycleContext,
} from "./types";

// =============================================================================
// ORCHESTRATOR
// =============================================================================

/**
 * @description Run a complete thinking cycle.
 *
 * This is the main entry point that replaces the monolith's runThinkingCycle().
 * Platform-specific behavior is injected via callbacks in OrchestratorConfig.
 *
 * @param config - Orchestrator configuration (db, apiKey, callbacks)
 * @param options - Cycle options (fromCron, model, provider, trigger, force)
 * @returns Cycle result
 */
export async function runThinkingCycle(
  config: OrchestratorConfig,
  options: CycleOptions = {},
): Promise<OrchestratorResult> {
  const { db, callbacks } = config;

  // --- Guard checks ---
  const guardResult = await runGuards(db, options, config.personaOptions);
  if (guardResult) return guardResult;

  // --- Quick followup bypass ---
  const quickFollowup = await checkQuickFollowup(db, options.fromCron);

  // --- Set last_wake_time early to prevent cron race conditions ---
  const now = new Date();
  await setState(db, "last_wake_time", now.toISOString());

  // --- Context assembly ---
  const promptResult = await callbacks.buildSystemPrompt(db);
  const loopCount = parseInt((await getState(db, "loop_count")) || "0");
  const userContent = await callbacks.buildUserContent(
    db,
    loopCount,
    promptResult,
  );

  // --- Provider/model resolution ---
  const { model, provider, maxOutputTokens } = await resolveProviderConfig(
    db,
    options,
  );

  // --- Create cycle record ---
  const cycleId = await createCycle(db, {
    model,
    trigger: options.trigger || (options.fromCron ? "cron" : "think-now"),
    cycleInterval: promptResult.cacheStrategy.cycleInterval,
    loopCount,
    cacheTtl: promptResult.cacheStrategy.ttl,
    volatileCachingEnabled: promptResult.cacheStrategy.useVolatileCaching,
    historyPrefixSize: promptResult.cacheStrategy.historyPrefixSize,
    historyTailSize: promptResult.cacheStrategy.actualTailSize,
  });

  // --- Provider routing ---
  const ctx = {
    provider,
    model,
    maxOutputTokens,
    cycleId,
    loopCount,
    now,
    promptResult,
    userContent,
    quickFollowup,
  };

  if (provider !== "anthropic") {
    return runNonAnthropicCycle(db, config.llm, ctx);
  }

  return runAnthropicCycle(db, config, options, ctx);
}
