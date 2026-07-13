/**
 * Pre-Cycle Checks
 *
 * @module @persistence/runtime/orchestrator/prechecks
 * @description Guard checks, quick followup detection, and provider config resolution.
 * These run before the main cycle logic to determine whether/how to proceed.
 *
 * @upstream Called by: orchestrator/index.ts
 * @downstream Calls: @persistence/db (state), loop/guards
 */

import type { DrizzleD1, PersonaOptions, ModelRegistry } from "@persistence/db";
import { getState, setState, resolveEffectiveModel } from "@persistence/db";
import { runAllGuards } from "../loop/guards";
import type { CycleOptions, OrchestratorResult } from "./types";

// =============================================================================
// GUARD CHECKS
// =============================================================================

/**
 * @description Run pre-cycle guards. Returns a skip result if blocked, null if clear.
 *
 * Running guard is always checked (even for manual triggers).
 * Cron-specific guards (batch, interval, sleep) only run for fromCron cycles.
 */
export async function runGuards(
  db: DrizzleD1,
  options: CycleOptions,
  personaOptions?: PersonaOptions,
): Promise<OrchestratorResult | null> {
  const isRunning = await getState(db, "is_running", personaOptions);
  if (isRunning !== "true") {
    return { skipped: true, reason: "Loop is paused" };
  }

  if (options.fromCron) {
    const guardResult = await runAllGuards(db, {
      intervalSeconds: parseInt(
        (await getState(db, "cycle_interval_seconds")) || "300",
      ),
      force: options.force,
      personaOptions,
    });
    if (!guardResult.proceed) {
      return { skipped: true, reason: guardResult.reason };
    }
  }

  return null;
}

// =============================================================================
// QUICK FOLLOWUP CHECK
// =============================================================================

/**
 * @description Check for quick followup triggers that bypass interval.
 * Returns true if this is a quick followup cycle.
 *
 * Quick followups are scheduled by post-processors (cache prime after summarize,
 * search follow-up) and bypass normal interval timing.
 */
export async function checkQuickFollowup(
  db: DrizzleD1,
  fromCron?: boolean,
): Promise<string | null> {
  if (!fromCron) return null;

  const quickFollowupAt = await getState(db, "quick_followup_at");
  if (!quickFollowupAt) return null;

  const followupTime = new Date(quickFollowupAt).getTime();
  if (Date.now() < followupTime) return null;

  const followupReason = await getState(db, "quick_followup_reason");
  console.log(
    `[Quick Followup] Triggered (reason: ${followupReason}) - bypassing interval check`,
  );
  await setState(db, "quick_followup_at", null);
  await setState(db, "quick_followup_reason", null);
  await setState(db, "quick_followup_active", "true");
  return followupReason ?? "quick_followup";
}

// =============================================================================
// PROVIDER CONFIG RESOLUTION
// =============================================================================

/** Default model constant */
const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_MAX_OUTPUT_TOKENS = 16000;

/**
 * @description Resolve provider, model, and max tokens from options + stored state.
 *
 * With a registry seed (platform-supplied): the D1 registry ladder decides the
 * model — options.model > personas.model > state selected_model > registry
 * default (config-as-data: models live in D1).
 * Without a seed (legacy callers): options > state > DEFAULT_MODEL constant.
 */
export async function resolveProviderConfig(
  db: DrizzleD1,
  options: CycleOptions,
  modelRegistrySeed?: ModelRegistry,
): Promise<{ model: string; provider: string; maxOutputTokens: number }> {
  const storedProvider =
    (await getState(db, "selected_provider")) || "anthropic";
  let model: string;
  if (modelRegistrySeed) {
    model = await resolveEffectiveModel(db, {
      optionsModel: options.model ?? null,
      seed: modelRegistrySeed,
    });
  } else {
    const storedModel = await getState(db, "selected_model");
    model = options.model || storedModel || DEFAULT_MODEL;
  }
  const provider = options.provider || storedProvider;

  const storedMaxTokens = await getState(db, "max_output_tokens");
  const maxOutputTokens = storedMaxTokens
    ? parseInt(storedMaxTokens)
    : DEFAULT_MAX_OUTPUT_TOKENS;

  return { model, provider, maxOutputTokens };
}
