/**
 * Provider Routing
 *
 * @module @persistence/runtime/orchestrator/providers
 * @description Routes think cycle LLM calls through the typed LLM interface
 * from @persistence/llm. The orchestrator does NOT make API calls directly —
 * it uses CallableModel.sync() and CallableModel.batch() which handle headers,
 * request formatting, response parsing, and error handling internally.
 *
 * Database access uses DrizzleD1 (from @persistence/db). One raw SQL call exists
 * in checkBatchMode() via db.$client to UPDATE cycles.status to 'batched' — this
 * is a deliberate escape hatch because Drizzle's query builder requires schema-typed
 * columns for string literals. See the @pattern raw-sql-escape-hatch comment inline.
 *
 * @antipattern DO NOT use fetch() to call LLM APIs directly.
 *   Use llm.anthropic.opus.sync() or llm.anthropic.sonnet.batch() from @persistence/llm.
 *   The LLM package already has ProviderDefinition with getHeaders(), formatRequest(),
 *   parseResponse() — reimplementing these is duplication.
 *
 * @antipattern DO NOT use db.$client for general queries — use Drizzle's query builder.
 *   The db.$client escape hatch is reserved for cases where Drizzle cannot express the
 *   query (e.g., raw string literals for status columns not yet in the Drizzle schema).
 *
 * @upstream Called by: orchestrator/index.ts
 * @downstream Calls: @persistence/llm (CallableModel), @persistence/db, orchestrator/response
 */

import type { DrizzleD1 } from "@persistence/db";
import {
  getState,
  setState,
  updateCycleMetrics,
  markCycleError,
} from "@persistence/db";
import { isInBatchWindow, storePendingBatch } from "@persistence/llm";
import type {
  LLM,
  CallResult,
  CallableModel,
  AnthropicCallParams,
} from "@persistence/llm";
import { buildSystemBlocks } from "../context/systemBlocks";
import type { ProfilePictureRef } from "../context/systemBlocks";
import { processResponse } from "./response";
import type {
  OrchestratorConfig,
  OrchestratorResult,
  CycleOptions,
  CycleContext,
} from "./types";

// =============================================================================
// PROVIDER DISPATCH
// =============================================================================

/**
 * @description Route a think cycle to the appropriate provider and mode.
 * Resolves the model from config, calls sync or batch, returns result.
 */
export async function runProviderCycle(
  db: DrizzleD1,
  config: OrchestratorConfig,
  options: CycleOptions,
  ctx: CycleContext,
): Promise<OrchestratorResult> {
  const { llm } = config;

  if (ctx.provider === "anthropic") {
    return runAnthropicCycle(db, config, options, ctx);
  }

  // Non-Anthropic providers (OpenAI, local) — sync only, no batch
  return runNonAnthropicCycle(db, llm, ctx);
}

// =============================================================================
// ANTHROPIC CYCLE (sync + batch)
// =============================================================================

/**
 * @description Handle Anthropic provider. Checks batch mode first,
 * falls back to sync. Uses llm.anthropic[model].sync() / .batch().
 */
export async function runAnthropicCycle(
  db: DrizzleD1,
  config: OrchestratorConfig,
  options: CycleOptions,
  ctx: CycleContext,
): Promise<OrchestratorResult> {
  const { llm } = config;

  // Check batch mode
  const batchResult = await checkBatchMode(db, config, options, ctx);
  if (batchResult) return batchResult;

  // Sync mode
  try {
    const profilePicture = await getProfilePicture(db);
    const systemBlocks = buildAnthropicSystemBlocks(ctx, profilePicture);

    const model = resolveAnthropicModel(llm, ctx.model);
    const result = await model.sync({
      system: systemBlocks as unknown as string,
      messages: [
        {
          role: "user" as const,
          content: ctx.userContent as unknown as string,
        },
      ],
      maxTokens: ctx.maxOutputTokens,
    });

    await updateCycleMetrics(db, ctx.cycleId, {
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
      cacheCreationTokens: result.usage.cacheWrite,
      cacheReadTokens: result.usage.cacheRead,
    });

    return processResponse(db, config, ctx, result.content, {
      input_tokens: result.usage.input,
      output_tokens: result.usage.output,
      cache_creation_input_tokens: result.usage.cacheWrite,
      cache_read_input_tokens: result.usage.cacheRead,
    });
  } catch (e: unknown) {
    console.error("Thinking cycle error:", e);
    if (ctx.cycleId) {
      await markCycleError(
        db,
        ctx.cycleId,
        e instanceof Error ? e.message : String(e),
      ).catch(() => {});
    }
    return {
      error: e instanceof Error ? e.message : String(e),
      cycleId: ctx.cycleId,
    };
  }
}

// =============================================================================
// NON-ANTHROPIC CYCLE
// =============================================================================

/**
 * @description Handle OpenAI and local providers. Sync only (no batch support).
 */
export async function runNonAnthropicCycle(
  db: DrizzleD1,
  llm: LLM,
  ctx: CycleContext,
): Promise<OrchestratorResult> {
  console.log(
    `[Provider Routing] Using ${ctx.provider} provider with model ${ctx.model}`,
  );

  try {
    const systemPrompt = flattenSystemBlocks(ctx.promptResult);
    let result: CallResult;

    if (ctx.provider === "openai") {
      const model = resolveOpenAIModel(llm, ctx.model);
      result = await model.sync({
        system: systemPrompt,
        messages: [
          {
            role: "user" as const,
            content: ctx.userContent
              .map((c) => (c.type === "text" ? c.text : "[image]"))
              .join(" "),
          },
        ],
        maxTokens: ctx.maxOutputTokens,
      });
    } else {
      // Local model — use OpenAI-compatible interface as fallback
      // TODO: Add local model support to LLM package
      throw new Error(
        `Provider "${ctx.provider}" not yet supported via LLM package`,
      );
    }

    await updateCycleMetrics(db, ctx.cycleId, {
      inputTokens: result.usage.input,
      outputTokens: result.usage.output,
    });

    return processResponse(
      db,
      {} as OrchestratorConfig,
      ctx,
      result.content,
      null,
    );
  } catch (err: unknown) {
    console.error(`[${ctx.provider}] Error:`, err);
    await markCycleError(
      db,
      ctx.cycleId,
      err instanceof Error ? err.message : String(err),
    );
    return {
      error: err instanceof Error ? err.message : String(err),
      provider: ctx.provider,
    };
  }
}

// =============================================================================
// BATCH MODE
// =============================================================================

/**
 * @description Check if batch mode should be used and submit via llm.anthropic.batch().
 * Returns a result if batch was submitted, null if sync should proceed.
 */
async function checkBatchMode(
  db: DrizzleD1,
  config: OrchestratorConfig,
  options: CycleOptions,
  ctx: CycleContext,
): Promise<OrchestratorResult | null> {
  const { llm } = config;

  const batchEnabledState = await getState(db, "batch_enabled");
  const batchExplicitlyEnabled = batchEnabledState === "true";
  const inBatchWindow = await isInBatchWindow(db);

  const forceSyncFallback =
    (await getState(db, "force_sync_fallback")) === "true";
  if (forceSyncFallback) {
    console.log("[Batch Mode] Sync fallback flag set - forcing sync mode");
    await setState(db, "force_sync_fallback", "false");
    return null;
  }

  const useBatchMode =
    inBatchWindow && (batchExplicitlyEnabled || options.fromCron);
  if (!useBatchMode) return null;

  console.log("[Batch Mode] In batch window, submitting async request");

  const profilePicture = await getProfilePicture(db);
  const systemBlocks = buildAnthropicSystemBlocks(ctx, profilePicture);
  const customId = `cycle-${ctx.cycleId}-${Date.now()}`;

  try {
    const model = resolveAnthropicModel(llm, ctx.model);
    const handle = await model.batch({
      system: systemBlocks as unknown as string,
      messages: [
        {
          role: "user" as const,
          content: ctx.userContent as unknown as string,
        },
      ],
      maxTokens: ctx.maxOutputTokens,
      customId,
    });

    await storePendingBatch(
      db,
      handle.batchId,
      customId,
      ctx.cycleId,
      "cron",
      ctx.model,
    );
    // db.$client exposes the underlying D1Database binding for raw SQL.
    // Used here because Drizzle's query builder does not support UPDATE with
    // a string literal for the status column without a schema change.
    // @pattern raw-sql-escape-hatch — use db.$client only when Drizzle cannot express the query
    await db.$client
      .prepare(`UPDATE cycles SET status = 'batched' WHERE id = ?`)
      .bind(ctx.cycleId)
      .run();

    console.log(`[Batch Mode] Submitted batch ${handle.batchId}`);

    return {
      batched: true,
      batchId: handle.batchId,
      customId,
      cycleId: ctx.cycleId,
    };
  } catch (err: unknown) {
    console.error("[Batch Mode] Submission failed:", err);
    config.callbacks.notifyError?.(
      `Batch submission failed: ${err instanceof Error ? err.message : String(err)}\nFalling back to sync mode.`,
    );
    return null;
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * @description Resolve a model name to a CallableModel from the Anthropic provider.
 * Defaults to sonnet if the model name doesn't match a known model.
 */
function resolveAnthropicModel(
  llm: LLM,
  modelName: string,
): CallableModel<AnthropicCallParams> {
  if (modelName.includes("opus")) return llm.anthropic.opus;
  if (modelName.includes("haiku")) return llm.anthropic.haiku;
  // Default to sonnet
  return llm.anthropic.sonnet;
}

/**
 * @description Resolve a model name to a CallableModel from the OpenAI provider.
 */
function resolveOpenAIModel(llm: LLM, modelName: string) {
  if (modelName.includes("gpt-5")) return llm.openai["gpt-5.2"];
  if (modelName.includes("mini")) return llm.openai["gpt-4o-mini"];
  return llm.openai["gpt-4o"];
}

/**
 * @description Get profile picture from state for system block injection.
 */
export async function getProfilePicture(
  db: DrizzleD1,
): Promise<ProfilePictureRef | null> {
  const image = await getState(db, "profile_picture");
  if (!image) return null;
  const prompt = await getState(db, "profile_picture_prompt");
  return { image, prompt };
}

/**
 * @description Flatten the 4-block system prompt into a single string for non-Anthropic providers.
 */
function flattenSystemBlocks(
  promptResult: CycleContext["promptResult"],
): string {
  const {
    block1_constitution,
    block1Extensions,
    block2_promotedSummaries,
    block3_stableAndSummaries,
    block4_freshTail,
  } = promptResult;
  return (
    block1_constitution +
    (block1Extensions || "") +
    "\n\n" +
    block2_promotedSummaries +
    "\n\n" +
    block3_stableAndSummaries +
    "\n\n" +
    block4_freshTail
  );
}

/**
 * @description Build Anthropic system blocks with cache control for sync/batch calls.
 */
function buildAnthropicSystemBlocks(
  ctx: CycleContext,
  profilePicture: ProfilePictureRef | null,
) {
  return buildSystemBlocks(
    ctx.promptResult.block1_constitution,
    ctx.promptResult.block1Extensions,
    ctx.promptResult.block2_promotedSummaries,
    ctx.promptResult.block3_stableAndSummaries,
    ctx.promptResult.block4_freshTail,
    ctx.promptResult.cacheStrategy,
    profilePicture,
  );
}
