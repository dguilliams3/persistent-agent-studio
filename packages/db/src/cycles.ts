/**
 * Cycle tracking database operations
 *
 * The cycles table is the main ledger for each thinking cycle execution.
 * Records model, tokens, costs, actions, and status for each run.
 *
 * Cycles table is persona-scoped for multi-persona support.
 *
 * @module @persistence/db/cycles
 */

import { eq, and, sql } from 'drizzle-orm';
import { MODEL_PRICING, CACHE_PRICING } from '@persistence/core';
import type { DrizzleD1 } from './client';
import { getActivePersonaId } from './persona-scope';
import { cycles } from './schema/cycles';

export interface CycleContext {
  model?: string;
  trigger?: string;
  cycleInterval?: number;
  loopCount?: number;
  cacheTtl?: string;
  volatileCachingEnabled?: boolean;
  historyPrefixSize?: number;
  historyTailSize?: number;
}

export interface CycleMetrics {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  actionCount?: number;
  primaryAction?: string;
  actionsJson?: string;
  estimatedCostCents?: number;
  status?: string;
}

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Options for persona-scoped cycle operations.
 */
export interface CycleOptions {
  personaId?: number;
}

/**
 * @description Creates a new cycle record at the start of runThinkingCycle
 *
 * This is called at the very start of each thinking cycle to create
 * a ledger entry. The cycle is updated with metrics after completion.
 *
 * @upstream Called by: runThinkingCycle (at start)
 * @downstream Calls: getActivePersonaId, Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param context - Initial context for the cycle
 * @param options - Optional settings
 * @returns The ID of the created cycle
 *
 * @note Uses persona scoping via getActivePersonaId
 */
export async function createCycle(
  db: DrizzleD1,
  context: CycleContext,
  options: CycleOptions = {}
): Promise<number> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.insert(cycles).values({
    personaId,
    model: context.model ?? null,
    trigger: context.trigger ?? null,
    cycleInterval: context.cycleInterval ?? null,
    loopCount: context.loopCount ?? null,
    cacheTtl: context.cacheTtl ?? '1h',
    volatileCachingEnabled: context.volatileCachingEnabled ? 1 : 0,
    historyPrefixSize: context.historyPrefixSize ?? null,
    historyTailSize: context.historyTailSize ?? null,
    status: 'pending',
  }).returning({ id: cycles.id });

  return result[0].id;
}

/**
 * @description Updates a cycle record with API response metrics
 *
 * Called after a successful Claude API call to record token usage,
 * costs, and which actions were taken.
 *
 * @upstream Called by: runThinkingCycle (after API response)
 * @downstream Calls: getActivePersonaId, Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param cycleId - The cycle ID to update
 * @param metrics - Metrics from the API response
 * @param options - Optional settings
 */
export async function updateCycleMetrics(
  db: DrizzleD1,
  cycleId: number,
  metrics: CycleMetrics,
  options: CycleOptions = {}
): Promise<void> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  await db.update(cycles)
    .set({
      inputTokens: metrics.inputTokens ?? null,
      outputTokens: metrics.outputTokens ?? null,
      cacheCreationTokens: metrics.cacheCreationTokens ?? null,
      cacheReadTokens: metrics.cacheReadTokens ?? null,
      actionCount: metrics.actionCount ?? null,
      primaryAction: metrics.primaryAction ?? null,
      actionsJson: metrics.actionsJson ?? null,
      estimatedCostCents: metrics.estimatedCostCents ?? null,
      status: metrics.status ?? 'completed',
    })
    .where(and(eq(cycles.personaId, personaId), eq(cycles.id, cycleId)));
}

/**
 * @description Marks a cycle as failed with error message
 *
 * Called when a cycle encounters an error (API failure, timeout, etc.)
 *
 * @upstream Called by: runThinkingCycle (on error)
 * @downstream Calls: getActivePersonaId, Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param cycleId - The cycle ID to update
 * @param errorMessage - The error message to record
 * @param options - Optional settings
 */
export async function markCycleError(
  db: DrizzleD1,
  cycleId: number,
  errorMessage: string,
  options: CycleOptions = {}
): Promise<void> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  await db.update(cycles)
    .set({ status: 'error', errorMessage })
    .where(and(eq(cycles.personaId, personaId), eq(cycles.id, cycleId)));
}

/**
 * @description Cleans up orphaned cycles stuck in 'pending' status
 *
 * When /think or /think-now creates a cycle via runThinkingCycle but the
 * HTTP handler times out (~30s), the cycle stays in 'pending' forever.
 * This function marks those orphaned cycles as 'error' so they don't
 * accumulate indefinitely.
 *
 * @upstream Called by: cron scheduled() handler in index.js
 * @downstream Calls: getActivePersonaId, Drizzle query builder
 *
 * @param db - Drizzle D1 client
 * @param staleMinutes - Minutes after which a pending cycle is considered orphaned (default: 10)
 * @param options - Optional persona settings
 * @returns Number of orphaned cycles cleaned up
 */
export async function cleanupOrphanedCycles(
  db: DrizzleD1,
  staleMinutes = 10,
  options: CycleOptions = {}
): Promise<number> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const result = await db.update(cycles)
    .set({
      status: 'error',
      errorMessage: 'Orphaned: HTTP handler timed out before cycle completed',
    })
    .where(and(
      eq(cycles.personaId, personaId),
      eq(cycles.status, 'pending'),
      sql`created_at < datetime('now', '-' || ${staleMinutes} || ' minutes')`
    ))
    .returning({ id: cycles.id });

  return result.length;
}

/**
 * @description Calculates estimated cost in cents based on token usage
 *
 * Uses pricing constants from @persistence/core.
 * Sonnet 4.5 baseline: $3/MTok input, $15/MTok output
 * Cached reads are 0.1x, cache writes are 2x for 1hr TTL
 *
 * @upstream Called by: runThinkingCycle, updateCycleMetrics
 * @downstream Calls: PRICING constants from @persistence/core
 *
 * @param usage - Token usage from API response
 * @param model - Model identifier (e.g., "claude-opus-4-6"). Defaults to opus pricing.
 * @param isBatch - Whether this was a batch API request (50% discount)
 * @returns Estimated cost in cents (3 decimal precision)
 *
 * @note Anthropic's API returns input_tokens as FRESH tokens only (not including cached)
 * @note cache_read_input_tokens is separate and additive, not overlapping
 */
export function calculateCostCents(
  usage: TokenUsage,
  model?: string,
  isBatch = false
): number {
  // Determine model type from model string (e.g., "claude-opus-4-6" -> "opus")
  let modelType: 'haiku' | 'sonnet' | 'opus' = 'opus'; // default
  if (model) {
    if (model.includes('haiku')) modelType = 'haiku';
    else if (model.includes('sonnet')) modelType = 'sonnet';
    else if (model.includes('opus')) modelType = 'opus';
  }

  const pricing = MODEL_PRICING[modelType] || MODEL_PRICING.opus;
  const inputPrice = pricing.inputPerMillion / 1000000;
  const outputPrice = pricing.outputPerMillion / 1000000;

  const { input_tokens = 0, output_tokens = 0, cache_creation_input_tokens = 0, cache_read_input_tokens = 0 } = usage;

  // Note: Anthropic's API returns input_tokens as FRESH tokens only (not including cached)
  // cache_read_input_tokens is separate and additive, not overlapping
  const freshInputCost = input_tokens * inputPrice;
  const cachedReadCost = cache_read_input_tokens * inputPrice * CACHE_PRICING.cacheReadDiscount;
  const cacheWriteCost = cache_creation_input_tokens * inputPrice * CACHE_PRICING.cacheWritePremium;
  const outputCost = output_tokens * outputPrice;

  let totalDollars = freshInputCost + cachedReadCost + cacheWriteCost + outputCost;

  // Apply 50% batch discount if this was a batch API request
  if (isBatch) {
    totalDollars *= CACHE_PRICING.batchDiscount;
  }

  return Math.round(totalDollars * 100 * 1000) / 1000; // cents with 3 decimal precision
}
