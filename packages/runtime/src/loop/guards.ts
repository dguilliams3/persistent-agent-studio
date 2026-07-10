/**
 * Cycle Guards
 *
 * @module @persistence/runtime/loop/guards
 * @description Guards that check whether a thinking cycle should proceed.
 *
 * Guards check conditions like:
 * - Is the minimum interval elapsed since last cycle?
 * - Is the persona currently sleeping?
 * - Is there a batch job that needs processing first?
 * - Is there an active intervention that should block the cycle?
 *
 * @upstream Called by: loop/cycle.ts (runThinkingCycle)
 * @downstream Calls: @persistence/db (getState)
 */

import type { GuardResult, SleepState } from "../types";
import { getState, setState } from "@persistence/db";
import type { DrizzleD1, PersonaOptions } from "@persistence/db";
import { getPendingBatches } from "@persistence/llm";

// =============================================================================
// INTERVAL GUARD
// =============================================================================

/**
 * @description Check if minimum interval has elapsed since last cycle
 *
 * @param db - Database instance
 * @param intervalSeconds - Minimum seconds between cycles
 * @param force - Force cycle even if interval not elapsed
 * @param options - Persona options for state queries
 * @returns Guard result
 */
export async function checkIntervalGuard(
  db: DrizzleD1,
  intervalSeconds: number,
  force = false,
  options: PersonaOptions = {},
): Promise<GuardResult> {
  if (force) {
    return { proceed: true };
  }

  const lastCycleTime = await getState(db, "last_wake_time", options);
  if (!lastCycleTime) {
    // No previous cycle, proceed
    return { proceed: true };
  }

  const lastCycle = new Date(lastCycleTime);
  const now = new Date();
  const elapsedSeconds = (now.getTime() - lastCycle.getTime()) / 1000;

  if (elapsedSeconds < intervalSeconds) {
    return {
      proceed: false,
      reason: `Interval not elapsed (${Math.floor(elapsedSeconds)}s / ${intervalSeconds}s)`,
      softSkip: true,
    };
  }

  return { proceed: true };
}

// =============================================================================
// SLEEP GUARD
// =============================================================================

/**
 * @description Check if persona is currently sleeping
 *
 * Sleep can be triggered by the SLEEP action with a duration.
 * The sleep_until state key holds the ISO timestamp when sleep ends.
 * When sleep period passes, this guard clears the sleep_until state to avoid
 * unnecessary checks on subsequent cycles.
 *
 * @param db - Database instance
 * @param options - Persona options for state queries
 * @returns Guard result with sleep state info
 */
export async function checkSleepGuard(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<GuardResult> {
  const sleepUntil = await getState(db, "sleep_until", options);
  if (!sleepUntil) {
    // Not sleeping
    return { proceed: true };
  }

  const sleepEnd = new Date(sleepUntil);
  const now = new Date();

  if (now < sleepEnd) {
    const remainingMinutes = Math.ceil(
      (sleepEnd.getTime() - now.getTime()) / 60000,
    );
    return {
      proceed: false,
      reason: `Sleeping (${remainingMinutes} minutes remaining)`,
      softSkip: true,
    };
  }

  // BUG-008 FIX: Sleep period ended, clear it to prevent unnecessary checks
  await setState(db, "sleep_until", "", options);
  return { proceed: true };
}

/**
 * @description Get current sleep state
 *
 * @param db - Database instance
 * @param options - Persona options for state queries
 * @returns Sleep state object
 */
export async function getSleepState(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<SleepState> {
  const sleepUntil = await getState(db, "sleep_until", options);

  if (!sleepUntil) {
    return { sleeping: false };
  }

  const sleepEnd = new Date(sleepUntil);
  const now = new Date();

  if (now >= sleepEnd) {
    return { sleeping: false };
  }

  return {
    sleeping: true,
    wakeTime: sleepUntil,
    reason: undefined,
  };
}

// =============================================================================
// BATCH GUARD
// =============================================================================

/**
 * @description Block new think cycles while any batch is pending/processing
 *
 * Queries the pending_batches table directly (not a state key) to check
 * for active batches. This prevents batch stacking where multiple pending
 * batches accumulate causing duplicate actions.
 *
 * @antipattern TIME-BASED BATCH GUARD
 * // WRONG: Only skip if batch is recent (< 5 minutes old)
 * // This fails because Anthropic batches can take 15-30+ minutes.
 * // CORRECT: Skip if ANY batch is pending, regardless of age.
 *
 * @param db - Database instance
 * @returns Guard result
 */
export async function checkBatchGuard(db: DrizzleD1): Promise<GuardResult> {
  const pendingBatches = await getPendingBatches(db);
  const anyPendingBatch = pendingBatches.find(
    (b: any) => b.status === "pending" || b.status === "processing",
  );

  if (anyPendingBatch) {
    const elapsed = anyPendingBatch.duration_seconds || 0;
    return {
      proceed: false,
      reason: `Waiting on pending batch (${Math.round(elapsed)}s elapsed)`,
      softSkip: false,
    };
  }

  return { proceed: true };
}

// =============================================================================
// RUNNING GUARD
// =============================================================================

/**
 * @description Check if the loop is enabled (is_running state)
 *
 * The is_running state key controls whether the loop is active.
 * When is_running !== 'true', the loop is paused and cycles should not proceed.
 *
 * @param db - Database instance
 * @param options - Persona options for state queries
 * @returns Guard result
 */
export async function checkRunningGuard(
  db: DrizzleD1,
  options: PersonaOptions = {},
): Promise<GuardResult> {
  const isRunning = await getState(db, "is_running", options);

  if (isRunning !== "true") {
    return {
      proceed: false,
      reason: "Loop is paused",
      softSkip: true,
    };
  }

  return { proceed: true };
}

// =============================================================================
// COMBINED GUARD
// =============================================================================

/**
 * @description Run all guards and return combined result
 *
 * Guards are checked in order:
 * 1. Running guard (prevents concurrent cycles)
 * 2. Sleep guard (respects SLEEP action)
 * 3. Batch guard (handles batch mode)
 * 4. Interval guard (enforces minimum interval)
 *
 * BUG-010 FIX: All guards now accept PersonaOptions to ensure proper
 * persona isolation in multi-persona scenarios.
 *
 * @param db - Database instance
 * @param config - Guard configuration including persona options
 * @returns Combined guard result
 */
export async function runAllGuards(
  db: DrizzleD1,
  config: {
    intervalSeconds: number;
    force?: boolean;
    personaOptions?: PersonaOptions;
  },
): Promise<GuardResult> {
  const options = config.personaOptions ?? {};

  // Check guards in priority order (matches monolith)

  // 1. Running guard - check is_running state
  const runningResult = await checkRunningGuard(db, options);
  if (!runningResult.proceed) {
    return runningResult;
  }

  // 2. Batch guard - block while batches are pending/processing
  const batchResult = await checkBatchGuard(db);
  if (!batchResult.proceed) {
    return batchResult;
  }

  // 3. Interval guard - enforce minimum interval (can be forced)
  const intervalResult = await checkIntervalGuard(
    db,
    config.intervalSeconds,
    config.force,
    options,
  );
  if (!intervalResult.proceed) {
    return intervalResult;
  }

  // 4. Sleep guard - respect explicit sleep
  const sleepResult = await checkSleepGuard(db, options);
  if (!sleepResult.proceed) {
    return sleepResult;
  }

  return { proceed: true };
}
