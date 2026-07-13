/**
 * Response Processing
 *
 * @module @persistence/runtime/orchestrator/response
 * @description Processes LLM responses: parses JSON, executes actions,
 * updates meters, records cycle metrics, and triggers post-cycle operations.
 * Shared between all providers (Anthropic sync, OpenAI, local).
 *
 * The `usage` parameter type is AnthropicRawUsage (renamed from AnthropicSyncResult
 * in the earlier flat-callback design). It carries pre-normalization token counts
 * directly from the Anthropic API response (snake_case fields: input_tokens,
 * output_tokens, cache_creation_input_tokens, cache_read_input_tokens). Non-Anthropic
 * providers pass null since they do not return cache token data.
 *
 * @upstream Called by: orchestrator/providers.ts
 * @downstream Calls: @persistence/db, @persistence/llm (parser), platform callbacks
 */

import type { DrizzleD1 } from "@persistence/db";
import {
  getState,
  setState,
  logHistory,
  updateCycleMetrics,
  calculateCostCents,
  incrementPersonaCostCents,
} from "@persistence/db";
import { parseClaudeResponse } from "@persistence/llm";
import type {
  OrchestratorConfig,
  OrchestratorResult,
  CycleContext,
  AnthropicRawUsage,
} from "./types";

// =============================================================================
// RESPONSE PROCESSING
// =============================================================================

/**
 * @description Process LLM response: parse, execute actions, update metrics.
 *
 * This is the shared post-LLM-call pipeline used by all providers.
 * The flow is: parse → meters display → execute actions → handle errors →
 * process meters → update loop count → update cycle metrics → cleanup → summarize.
 *
 * @param db - Database instance
 * @param config - Orchestrator config with callbacks
 * @param ctx - Current cycle context
 * @param responseText - Raw text response from the LLM
 * @param usage - Token usage (Anthropic-specific, null for other providers)
 * @returns Cycle result
 */
export async function processResponse(
  db: DrizzleD1,
  config: OrchestratorConfig,
  ctx: CycleContext,
  responseText: string,
  usage: AnthropicRawUsage | null,
): Promise<OrchestratorResult> {
  const { callbacks } = config;

  // Parse response
  const parseResult = parseClaudeResponse(responseText);

  // Handle parse failure before meters/actions
  if (!parseResult.success) {
    await callbacks.notifyError?.(`Sync parse failed: ${parseResult.error}`);
    await logHistory({
      db,
      type: "parse_error",
      content: `Response parsing failed: ${parseResult.error}`,
      internal: `Raw response:\n${(parseResult.rawResponse || "").substring(0, 2000)}`,
      cycleId: ctx.cycleId,
    });
    return { error: `Failed to parse response: ${parseResult.error}` };
  }

  // Send meters header before actions
  if (parseResult.meters && callbacks.sendMetersDisplay) {
    await callbacks
      .sendMetersDisplay(
        parseResult.meters as Record<string, number>,
        parseResult.note,
      )
      .catch(() => {});
  }

  // Execute actions
  const { executed, failed } = await callbacks.executeActions(
    parseResult,
    ctx.cycleId,
  );

  // Handle all-actions-failed
  if (executed.length === 0 && failed.length > 0) {
    const errorSummary = failed
      .slice(0, 3)
      .map((f) => f.error || "Unknown error")
      .join(", ");
    await callbacks.notifyError?.(`All actions failed: ${errorSummary}`);
    await logHistory({
      db,
      type: "parse_error",
      content: `All ${failed.length} actions failed validation/execution`,
      internal: `First error: ${failed[0]?.error || "Unknown"}`,
      cycleId: ctx.cycleId,
    });
    return { error: `All actions failed: ${failed[0]?.error || "Unknown"}` };
  }

  // Process meters
  if (parseResult.meters) {
    await callbacks.processMeters(
      db,
      parseResult.meters as Record<string, number>,
      ctx.cycleId,
      parseResult.note,
    );
  }

  // Update loop count + clear anti-cascade flag
  await setState(db, "loop_count", String(ctx.loopCount + 1));
  await setState(db, "quick_followup_active", null);

  // Update cycle metrics (Anthropic-specific with cache data)
  if (usage) {
    await updateAnthropicMetrics(db, ctx, usage, executed);
  }

  // Post-cycle cleanup
  await callbacks.postCycleCleanup?.(db);

  // Auto-summarization
  const autoSummarize = (await getState(db, "auto_summarize")) === "true";
  if (autoSummarize) {
    await callbacks.autoSummarize?.(db, ctx.cycleId);
  }

  return {
    success: true,
    actions: executed,
    decisions: parseResult.actions,
    meters: parseResult.meters,
    cycleId: ctx.cycleId,
    provider: ctx.provider || "anthropic",
    model: ctx.model,
    cacheMetrics: usage,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * @description Update cycle metrics with Anthropic-specific token and cache data.
 */
async function updateAnthropicMetrics(
  db: DrizzleD1,
  ctx: CycleContext,
  usage: NonNullable<AnthropicRawUsage>,
  executed: Array<{ action: string; [key: string]: unknown }>,
): Promise<void> {
  const costCents = calculateCostCents(usage, ctx.model);
  await updateCycleMetrics(db, ctx.cycleId, {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheCreationTokens: usage.cache_creation_input_tokens,
    cacheReadTokens: usage.cache_read_input_tokens,
    actionCount: executed.length,
    primaryAction: executed[0]?.action,
    actionsJson: JSON.stringify(executed),
    estimatedCostCents: costCents,
    status: "completed",
  });
  await incrementPersonaCostCents(db, costCents);
}
