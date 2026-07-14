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
import { recordAdaptiveCadenceAfterWakeAdmission } from "../loop/guards";
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
  const previousWakeTime = await getState(db, "last_wake_time", config.personaOptions);

  // --- Quick-followup PEEK (bugfix 2026-07-11) ---
  // A pending quick_followup_at (Think Now button, cache prime, search
  // follow-up) is supposed to bypass the interval guard — but runGuards
  // previously ran (and returned on "Interval not elapsed") BEFORE
  // checkQuickFollowup ever read the flag, making /think-now a no-op that
  // silently waited out the full cycle interval. Peek the flag here WITHOUT
  // consuming it and pass force to the interval guard (force bypasses ONLY
  // the interval — running/sleep/batch guards still apply). The flag is
  // consumed by checkQuickFollowup below only after all guards pass, so a
  // genuinely blocked cycle does not swallow the user's Think Now.
  let force = options.force;
  // Captured at the peek (before checkQuickFollowup consumes the flag) so the
  // cycle record can carry an honest trigger: a wake caused by an inbound
  // message stamps "user_message" (RUN-20260712-2013 F-B10 — the schema
  // documented this trigger but no code path ever set it).
  let followupReason: string | null = null;
  if (options.fromCron && !force) {
    const quickFollowupAt = await getState(db, "quick_followup_at");
    if (quickFollowupAt && Date.now() >= new Date(quickFollowupAt).getTime()) {
      force = true;
      followupReason = (await getState(db, "quick_followup_reason")) ?? null;
    }
  }

  // --- Guard checks ---
  const guardResult = await runGuards(
    db,
    { ...options, force },
    config.personaOptions,
  );
  if (guardResult) return guardResult;

  // --- Quick followup bypass (consumes the flag) ---
  const quickFollowupReasonFromConsume = await checkQuickFollowup(db, options.fromCron);
  const quickFollowup = quickFollowupReasonFromConsume !== null;

  // --- Set last_wake_time early to prevent cron race conditions ---
  const now = new Date();
  const baseIntervalSeconds = parseInt(
    (await getState(db, "cycle_interval_seconds", config.personaOptions)) || "300",
  );
  await recordAdaptiveCadenceAfterWakeAdmission(db, {
    baseIntervalSeconds,
    previousWakeTime,
    options: config.personaOptions,
  });
  await setState(db, "last_wake_time", now.toISOString(), config.personaOptions);

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
    config.modelRegistrySeed,
  );

  // --- Create cycle record ---
  const cycleId = await createCycle(db, {
    model,
    trigger:
      options.trigger ||
      (followupReason === "user_message"
        ? "user_message"
        : options.fromCron
          ? "cron"
          : "think-now"),
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
