/**
 * Quick-followup scheduling helpers shared by inbound message doors.
 *
 * @module @persistence/db/quick-followup
 * @description Minimal persona-aware helpers for scheduling a prompt follow-up
 * via state keys. These helpers intentionally only queue the follow-up; the
 * orchestrator still enforces running/sleep/batch guards and only bypasses the
 * normal interval when the queued reason is due.
 */

import type { DrizzleD1 } from "./client";
import { getState, setState } from "./state";

interface PersonaScopedOptions {
  personaId?: number;
}

export interface QueueQuickFollowupOptions extends PersonaScopedOptions {
  reason: string;
  delayMs?: number;
  minSinceWakeMs?: number;
}

export interface QueueQuickFollowupResult {
  scheduled: boolean;
  reason: "scheduled" | "already_scheduled" | "recent_wake";
  followupTime?: string;
}

const DEFAULT_MIN_SINCE_WAKE_MS = 30_000;

/**
 * Queue a quick follow-up when no follow-up is already pending and the last wake
 * was not too recent.
 */
export async function queueQuickFollowup(
  db: DrizzleD1,
  options: QueueQuickFollowupOptions,
): Promise<QueueQuickFollowupResult> {
  const {
    reason,
    delayMs = 0,
    minSinceWakeMs = DEFAULT_MIN_SINCE_WAKE_MS,
    ...personaOptions
  } = options;
  const existing = await getState(db, "quick_followup_at", personaOptions);
  if (existing) {
    return { scheduled: false, reason: "already_scheduled" };
  }

  const lastWakeTime = await getState(db, "last_wake_time", personaOptions);
  if (lastWakeTime) {
    const lastWakeMs = Date.parse(lastWakeTime);
    if (Number.isFinite(lastWakeMs) && Date.now() - lastWakeMs < minSinceWakeMs) {
      return { scheduled: false, reason: "recent_wake" };
    }
  }

  const followupTime = new Date(Date.now() + delayMs).toISOString();
  await setState(db, "quick_followup_at", followupTime, personaOptions);
  await setState(db, "quick_followup_reason", reason, personaOptions);
  return { scheduled: true, reason: "scheduled", followupTime };
}
