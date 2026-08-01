/**
 * Quick Follow-Up Scheduling Utilities
 *
 * @module services/quick-followup
 * @description Schedules fast follow-up cycles after search, art, and digest actions
 * to let Clio react quickly.
 *
 * NOTE: Summarize follow-ups were removed — at 54-min cycle intervals, the next
 * regular cycle handles post-summarize state fine without a special follow-up.
 *
 * @upstream Called by:
 *   - Tool action handlers (search, art, digest)
 * @downstream Calls:
 *   - db/index.js getState/setState
 *   - QUICK_FOLLOWUP_CONFIG constants
 */

import { getState, setState } from '../db/index.js';
import { QUICK_FOLLOWUP_CONFIG } from '../constants.js';

/**
 * @description Schedules a quick follow-up cycle for search/art/digest reactivity.
 * Anti-cascade: If the current cycle was itself triggered by a quick followup,
 * refuses to schedule another one, preventing infinite followup chains.
 *
 * @param {D1Database} db - Database instance
 * @param {string} reason - 'search', 'art_complete', or 'digest'
 * @returns {Promise<{scheduled: boolean, reason?: string}>}
 */
export async function scheduleQuickFollowup(db: D1Database, reason: string) {
  const config = QUICK_FOLLOWUP_CONFIG;
  if (reason === 'search' && !config.enableAfterSearch) {
    return { scheduled: false, reason: 'disabled' };
  }

  // Anti-cascade: don't schedule a followup from within a followup cycle
  const followupActive = await getState(db, 'quick_followup_active');
  if (followupActive === 'true') {
    console.log(`[Quick Followup] Anti-cascade: skipping ${reason} - already in a followup cycle`);
    return { scheduled: false, reason: 'anti_cascade' };
  }

  const existing = await getState(db, 'quick_followup_at');
  if (existing) {
    return { scheduled: false, reason: 'already_scheduled' };
  }

  const batchUntil = await getState(db, 'batch_until');
  const inBatchMode = batchUntil && new Date(batchUntil) > new Date();

  if (inBatchMode) {
    const avgBatchTime = await getAverageBatchTime(db, config.batchAvgLookbackHours);
    if (avgBatchTime === null || avgBatchTime >= config.batchAvgThresholdSeconds) {
      console.log(`[Quick Followup] Skipping - in batch mode with avg time ${avgBatchTime}s >= ${config.batchAvgThresholdSeconds}s threshold`);
      return { scheduled: false, reason: 'batch_too_slow' };
    }
    console.log(`[Quick Followup] Batch mode but avg time ${avgBatchTime}s < ${config.batchAvgThresholdSeconds}s threshold, proceeding`);
  }

  const delay = config.delayAfterSearchMs;
  const followupTime = new Date(Date.now() + delay).toISOString();
  await setState(db, 'quick_followup_at', followupTime);
  await setState(db, 'quick_followup_reason', reason);

  console.log(`[Quick Followup] Scheduled for ${reason} in ${delay / 1000}s at ${followupTime}`);
  return { scheduled: true, followupTime };
}

/**
 * @description Gets average batch completion time from recent cycles
 *
 * @param {D1Database} db - Database instance
 * @param {number} lookbackHours - How far back to look
 * @returns {Promise<number|null>} Average seconds, or null if no data
 */
async function getAverageBatchTime(db: D1Database, lookbackHours: number): Promise<number | null> {
  try {
    const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString();
    const result = await db.prepare(`
      SELECT AVG(duration_seconds) as avg_duration
      FROM batches
      WHERE status = 'completed'
        AND created_at > ?
        AND duration_seconds IS NOT NULL
    `).bind(cutoff).first();
    return typeof result?.avg_duration === 'number' ? result.avg_duration : null;
  } catch (e: unknown) {
    console.warn('[Quick Followup] Error getting batch avg:', e instanceof Error ? e.message : String(e));
    return null;
  }
}
