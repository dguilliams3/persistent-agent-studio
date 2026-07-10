/**
 * Batch API Processing Service
 *
 * @module services/batch-processor
 * @description Handles Anthropic Batches API orchestration for async processing.
 *
 * Uses @persistence/llm for core API operations:
 * - checkBatchStatus() - status polling with typed provider
 * - fetchBatchResults() - result fetching with retry + callbacks
 *
 * This file handles:
 * - DB operations (pending_batches table management)
 * - Cron orchestration (processPendingBatches)
 * - Telegram notifications (via retry callbacks)
 * - Timeout handling (soft and hard timeouts)
 *
 * @upstream Called by:
 *   - index.js scheduled() handler - calls processPendingBatches
 *   - orchestrator (via cycle-adapter) - calls submitBatch
 *   - index.js /think-now endpoint - calls checkPendingBatchGuard
 *
 * @downstream Calls:
 *   - @persistence/llm RequestEngine (checkBatchStatus, fetchBatchResults)
 *   - db/batches.js - getPendingBatches, updatePendingBatch, getBatchTimeout
 *   - db/state.js - getState, setState
 *   - db/cycles.js - updateCycleMetrics, markCycleError
 *   - services/telegram.js - sendTelegram (notifications)
 *
 * @see docs/ai_native/BATCH_MODE.md for detailed architecture
 */

import {
  getState,
  setState,
  getPendingBatches,
  updatePendingBatch,
  getBatchTimeout,
  isInBatchWindow,
  updateCycleMetrics,
  markCycleError,
} from '../db/index.js';
import { createDrizzleClient } from '@persistence/db';
import { getBatchHardTimeout, cancelBatch } from '../db/batches.js';
import { logHistory, METERS, METER_EMOJI, setMeterValue } from '../utils/index.js';
import { sendTelegram } from './telegram.js';
import { getTelegramChatId } from '../utils/telegram.js';
import { formatEasternDateTime } from '../utils/time.js';
import { parseClaudeResponse } from '@persistence/llm';
import { executeActions, executeTool } from './action-executor.js';
import type { Env } from '../bootstrap.js';

// Use @persistence/llm for core API operations
import { RequestEngine, anthropic, resolveModel } from '@persistence/llm';
import { BATCH_RETRY_CONFIG } from '../constants.js';

type QueueThinkOptions = { force?: boolean };
type SubmitBatchParams = Record<string, unknown>;
type BatchSubmissionResponse = {
  id?: string;
  processing_status?: string;
  expires_at?: string;
  error?: { message?: string };
};
type BatchStatusResult = {
  status?: string;
  resultsUrl?: string;
  error?: string;
};
type BatchProcessorOptions = {
  executeBatchAction?: (
    db: D1Database,
    env: Env,
    apiKey: string,
    action: Record<string, unknown>,
    cycleId: number,
    now: Date
  ) => Promise<void>;
  streamActionToTelegram?: (db: D1Database, action: Record<string, unknown>, env: Env) => Promise<void>;
};


/**
 * @description Checks for pending batches and returns formatted info for rejection messages
 *
 * Used by /think-now and /think Telegram command to prevent duplicate cycles
 * when a batch is already in progress. Returns both plain text (for JSON API)
 * and HTML (for Telegram) formatted messages.
 *
 * @upstream Called by: handleThinkNow (index.js), handleThink (telegram/commands/think.js)
 * @downstream Calls: getPendingBatches (db/batches.js), formatEasternDateTime
 *
 * @param {D1Database} db - Database instance
 * @returns {Promise<{pending: boolean, batch?: Object, message?: string, htmlMessage?: string}>}
 *
 * @example
 * const guard = await checkPendingBatchGuard(db);
 * if (guard.pending) {
 *   return Response.json({ blocked: true, reason: guard.message });
 * }
 */
export async function checkPendingBatchGuard(db: D1Database) {
  const pendingBatches = await getPendingBatches(db);
  const anyPendingBatch = pendingBatches.find(b =>
    b.status === 'pending' || b.status === 'processing'
  );

  if (!anyPendingBatch) {
    return { pending: false };
  }

  const elapsed = anyPendingBatch.duration_seconds || 0;
  const elapsedMins = Math.round(elapsed / 60);

  // Format submitted_at in Eastern time
  const submittedAt = anyPendingBatch.submitted_at
    ? formatEasternDateTime(new Date(anyPendingBatch.submitted_at + 'Z'))
    : 'unknown';

  // Plain text for JSON API responses
  const message = `Batch in progress since ${submittedAt} (${elapsedMins}m elapsed). ` +
    `ID: ${anyPendingBatch.batch_id.substring(0, 20)}...`;

  // HTML for Telegram
  const htmlMessage =
    `⏳ Batch in progress (${elapsedMins}m elapsed)\n` +
    `Started: ${submittedAt}\n` +
    `ID: <code>${anyPendingBatch.batch_id.substring(0, 20)}...</code>\n\n` +
    `Use <code>/think force</code> to override`;

  return {
    pending: true,
    batch: anyPendingBatch,
    message,
    htmlMessage
  };
}

/**
 * @description Shared logic for queueing a think cycle via quick_followup_at
 *
 * Used by both Telegram /think and HTTP /think-now to avoid duplicating
 * the batch-guard + schedule + status-check logic. Returns a result object
 * that callers format for their respective transports (Telegram HTML vs JSON).
 *
 * @upstream Called by: handleThink (telegram/commands/operations.js), /think-now (index.js)
 * @downstream Calls: checkPendingBatchGuard, setState, isInBatchWindow
 *
 * @param {D1Database} db - Database instance
 * @param {Object} [options]
 * @param {boolean} [options.force] - Skip batch guard check
 * @returns {Promise<{queued: boolean, blocked?: boolean, batchGuard?: Object, batchMode?: boolean, force?: boolean}>}
 */
export async function queueThinkCycle(db: D1Database, options: QueueThinkOptions = {}) {
  const force = options.force || false;

  // Check for pending batches (unless force override)
  if (!force) {
    const batchGuard = await checkPendingBatchGuard(db);
    if (batchGuard.pending) {
      return { queued: false, blocked: true, batchGuard };
    }
  }

  // Schedule immediate cycle via quick_followup_at.
  // The cron handler checks this and bypasses the interval check when set.
  await setState(db, 'quick_followup_at', new Date().toISOString());
  await setState(db, 'is_running', 'true');

  const batchMode = await isInBatchWindow(db);
  return { queued: true, blocked: false, batchMode, force };
}

/**
 * @description Submits a batch request to the Anthropic Batches API
 *
 * Creates an async batch request that will be processed in the background.
 * The batch ID is stored in pending_batches table for later status checking.
 *
 * @upstream Called by: orchestrator (via cycle-adapter) when in batch window
 * @downstream Calls: Anthropic POST /v1/messages/batches
 *
 * @param {string} apiKey - Anthropic API key
 * @param {string} customId - Unique ID for this request (e.g., "cycle-123-1705432100000")
 * @param {Object} params - Message params (model, max_tokens, system, messages)
 * @returns {Promise<{batchId: string, status: string, expiresAt: string}|{error: string}>}
 *
 * @example
 * const result = await submitBatch(apiKey, `cycle-${cycleId}-${Date.now()}`, {
 *   model: 'claude-opus-4-6',
 *   max_tokens: 8192,
 *   system: systemBlocks,
 *   messages: [{ role: 'user', content: userContent }]
 * });
 * if (result.error) {
 *   console.error('Batch submission failed:', result.error);
 * }
 */
export async function submitBatch(apiKey: string, customId: string, params: SubmitBatchParams) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages/batches', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        requests: [{
          custom_id: customId,
          params: params
        }]
      })
    });

    const data = await response.json() as BatchSubmissionResponse;

    if (!response.ok) {
      return { error: data.error?.message || `HTTP ${response.status}` };
    }

    return {
      batchId: data.id,
      status: data.processing_status,
      expiresAt: data.expires_at
    };
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// checkBatchStatus and fetchBatchResults moved to @persistence/llm
// Use engine.checkBatchStatus() and engine.fetchBatchResults() instead

/**
 * @description Processes all pending batches - checks status, fetches results, executes actions
 *
 * This is the main batch processing loop called at the start of each cron cycle.
 * It checks all pending/processing batches, handles timeouts, fetches completed results,
 * and executes actions through the provided callback.
 *
 * Flow:
 * 1. Get all pending/processing batches from DB
 * 2. For each batch:
 *    - Check status via Anthropic API
 *    - Handle timeout (mark expired, set sync fallback flag)
 *    - If complete, fetch results and execute actions
 *    - Update cycle metrics and loop count
 *
 * @upstream Called by: index.js scheduled() handler (cron)
 * @downstream Calls:
 *   - checkBatchStatus, fetchBatchResults (this module)
 *   - getPendingBatches, updatePendingBatch, getBatchTimeout (db/batches.js)
 *   - getState, setState (db/state.js)
 *   - addHistory (db/history.js)
 *   - updateCycleMetrics, markCycleError (db/cycles.js)
 *   - sendTelegram (services/telegram.js)
 *   - executeTool dispatcher (default)
 *
 * @param {Object} env - Environment bindings (DB, secrets, etc.)
 * @param {Object} options - Processing options
 * @param {Function} [options.executeBatchAction] - Optional override for action execution
 * @param {Function} options.streamActionToTelegram - Callback to stream actions (required)
 * @returns {Promise<{processed: number, errors: string[]}>}
 *
 * @example
 * const result = await processPendingBatches(env, {
 *   executeBatchAction,
 *   streamActionToTelegram
 * });
 * if (result.processed > 0) {
 *   console.log(`Processed ${result.processed} batch(es)`);
 * }
 *
 * @note Timeout defaults to cycle_interval/2 (min 60s) to allow sync fallback
 * @note Sets `force_sync_fallback` state key on timeout for next cycle
 */
export async function processPendingBatches(env: Env, options: BatchProcessorOptions = {}) {
  const {
    executeBatchAction = ((db, env, apiKey, action, cycleId, now) => executeTool({ db, env, action, cycleId, apiKey, now })),
    streamActionToTelegram
  } = options;

  const db = createDrizzleClient(env.DB);
  const apiKey = env.ANTHROPIC_API_KEY || '';

  const pendingBatches = await getPendingBatches(db);

  if (pendingBatches.length === 0) {
    return { processed: 0, errors: [] };
  }

  console.log(`[Batch Processor] Found ${pendingBatches.length} pending batches to check`);

  // Create engine with Telegram notification callbacks for retry
  const engine = new RequestEngine(
    { ANTHROPIC_API_KEY: apiKey },
    {
      retry: {
        maxRetries: BATCH_RETRY_CONFIG.maxRetries,
        baseDelayMs: BATCH_RETRY_CONFIG.baseDelayMs,
        maxDelayMs: BATCH_RETRY_CONFIG.maxDelayMs,
        onRetry: async (attempt, max, error, delayMs) => {
          if (env?.TELEGRAM_BOT_TOKEN) {
            const chatId = await getTelegramChatId(db);
            if (chatId) {
              await sendTelegram(
                chatId,
                `⚠️ Batch fetch failed (attempt ${attempt}/${max}): ${error}\nRetrying in ${delayMs/1000}s...`,
                env
              ).catch(() => {});
            }
          }
        },
        onAllFailed: async (max, error) => {
          if (env?.TELEGRAM_BOT_TOKEN) {
            const chatId = await getTelegramChatId(db);
            if (chatId) {
              await sendTelegram(
                chatId,
                `❌ Batch fetch failed after ${max} attempts: ${error}`,
                env
              ).catch(() => {});
            }
          }
        },
      },
    }
  );

  const errors = [];
  let processed = 0;

  for (const batch of pendingBatches) {
    try {
      // Idempotency logging: log current state for debugging race conditions
      console.log(`[Batch Processor] Checking batch ${batch.batch_id} (local status: ${batch.status}, age: ${batch.duration_seconds}s)`);

      // Use package's checkBatchStatus (throws on error, so wrap in try/catch)
      let statusResult: BatchStatusResult;
      try {
        statusResult = await engine.checkBatchStatus(batch.batch_id, anthropic) as BatchStatusResult;
      } catch (e: unknown) {
        // Convert exception to error object format for backwards compatibility
        statusResult = { error: e instanceof Error ? e.message : String(e) };
      }

      if (statusResult.error) {
        console.error(`[Batch Processor] Error checking batch ${batch.batch_id}:`, statusResult.error);
        // If batch returns an error (e.g., 404 not found), mark as failed and continue
        await updatePendingBatch(db, batch.batch_id, 'failed', null, statusResult.error);
        errors.push(`Batch ${batch.batch_id}: ${statusResult.error}`);
        // Auto-disable batch mode — if we can't even check status, don't submit more
        await setState(db, 'batch_enabled', 'false');
        await setState(db, 'force_sync_fallback', 'true');
        await setState(db, 'last_wake_time', new Date().toISOString());
        // Notify the user via Telegram about the error
        const telegramChatId = await getTelegramChatId(db);
        if (telegramChatId) {
          await sendTelegram(telegramChatId, `⚠️ Batch check failed: ${statusResult.error}. Batch mode auto-disabled. Switching to sync.`, env);
        }
        continue;
      }

      console.log(`[Batch Processor] Batch ${batch.batch_id} status: ${statusResult.status}`);

      // HARD TIMEOUT: Safety net that fires regardless of Anthropic's reported status.
      // Checked FIRST so no downstream exception (e.g., in getBatchTimeout or result
      // processing) can prevent it from running. If a batch exceeds this, something
      // is fundamentally wrong and we need to clear it.
      // Default 54 min - just under cache TTL to preserve cache economics.
      const hardTimeoutSeconds = await getBatchHardTimeout(db);
      if (batch.duration_seconds > hardTimeoutSeconds) {
        console.log(`[Batch Processor] HARD TIMEOUT: Batch ${batch.batch_id} exceeded ${hardTimeoutSeconds}s (actual: ${batch.duration_seconds}s), force-clearing`);

        // Cancel on Anthropic's side so we don't pay for results we'll never fetch
        await cancelBatch(batch.batch_id, apiKey, db, { cancelledBy: 'auto_timeout' }).catch((e: unknown) =>
          console.error(`[Batch Processor] Anthropic cancel failed (non-fatal):`, e instanceof Error ? e.message : String(e))
        );

        await updatePendingBatch(db, batch.batch_id, 'expired', null,
          `Hard timeout after ${batch.duration_seconds}s (limit: ${hardTimeoutSeconds}s) - status was "${statusResult.status}"`,
          { cancelledBy: 'auto_timeout' }
        );
        errors.push(`Batch ${batch.batch_id}: Hard timeout after ${Math.round(batch.duration_seconds / 60)} minutes (status: ${statusResult.status})`);

        // Auto-disable batch mode on first timeout to prevent Sisyphean loop:
        // timeout → sync fallback → re-submit batch → timeout → ...
        // This preserves the ~1h prompt cache for immediate sync use.
        await setState(db, 'batch_enabled', 'false');
        await setState(db, 'force_sync_fallback', 'true');
        // Also reset last_wake_time so the interval check doesn't block the fallback
        await setState(db, 'last_wake_time', new Date().toISOString());

        // Notify the user via Telegram
        const telegramChatId = await getTelegramChatId(db);
        if (telegramChatId) {
          await sendTelegram(
            telegramChatId,
            `🚨 <b>Hard timeout!</b> Batch stuck for ${Math.round(batch.duration_seconds / 60)} min (Anthropic status: "${statusResult.status}").\nBatch mode auto-disabled. Switching to sync.`,
            env
          );
        }
        continue;
      }

      // Soft timeout: fires on ANY non-terminal status (not just 'in_progress').
      // Default: interval/2 (~27 min with 54-min cycles). Batches normally complete
      // in 1-3 min, so if we're here, something is wrong. Auto-disable on first
      // timeout to prevent Sisyphean loop and preserve prompt cache for sync.
      const terminalStatuses = ['ended', 'expired', 'canceled'];
      const timeoutSeconds = await getBatchTimeout(db);
      const status = statusResult.status ?? '';
      if (batch.duration_seconds > timeoutSeconds && !terminalStatuses.includes(status)) {
        console.log(`[Batch Processor] Batch ${batch.batch_id} timed out (${batch.duration_seconds}s > ${timeoutSeconds}s, status: ${statusResult.status}), marking as expired`);

        // Cancel on Anthropic's side so we don't pay for results we'll never fetch
        await cancelBatch(batch.batch_id, apiKey, db, { cancelledBy: 'auto_timeout' }).catch(e =>
          console.error(`[Batch Processor] Anthropic cancel failed (non-fatal):`, e.message)
        );

        await updatePendingBatch(db, batch.batch_id, 'expired', null,
          `Timed out after ${batch.duration_seconds}s (limit: ${timeoutSeconds}s) - status was "${statusResult.status}"`,
          { cancelledBy: 'auto_timeout' }
        );
        errors.push(`Batch ${batch.batch_id}: Timed out after ${Math.round(batch.duration_seconds / 60)} minutes`);

        // Auto-disable on first timeout. Batches complete in 1-3 min normally —
        // if we're timing out, batch mode is broken. Don't re-submit into another
        // doomed batch. Preserves prompt cache for immediate sync fallback.
        await setState(db, 'batch_enabled', 'false');
        await setState(db, 'force_sync_fallback', 'true');
        await setState(db, 'last_wake_time', new Date().toISOString());

        // Notify the user via Telegram
        const telegramChatId = await getTelegramChatId(db);
        if (telegramChatId) {
          await sendTelegram(telegramChatId, `⚠️ Batch timed out after ${Math.round(batch.duration_seconds / 60)} min (status: ${statusResult.status}). Batch mode auto-disabled. Switching to sync.`, env);
        }
        continue;
      }

      // Update status if changed from pending to processing
      if (statusResult.status === 'in_progress' && batch.status === 'pending') {
        await updatePendingBatch(db, batch.batch_id, 'processing');
      }

      // If batch is complete, fetch and process results
      if (statusResult.status === 'ended') {
        // CRITICAL: Mark batch as 'executing' IMMEDIATELY to prevent re-processing
        // If we crash during action execution, we won't re-fetch and re-execute
        // on the next cron cycle (which was causing duplicate history entries)
        await updatePendingBatch(db, batch.batch_id, 'processing');
        console.log(`[Batch Processor] Batch ${batch.batch_id} marked as executing`);

        if (!statusResult.resultsUrl) {
          console.error(`[Batch Processor] Batch ${batch.batch_id} ended but no results URL`);
          await updatePendingBatch(db, batch.batch_id, 'failed', null, 'No results URL');
          errors.push(`Batch ${batch.batch_id}: No results URL`);
          continue;
        }

        console.log(`[Batch Processor] Fetching results for batch ${batch.batch_id}...`);

        // Resolve model for cost calculation (package needs typed model)
        let model;
        try {
          model = resolveModel(anthropic as any, batch.model);
        } catch (_e: unknown) {
          // Fallback to haiku if model resolution fails
          console.warn(`[Batch Processor] Model resolution failed for "${batch.model}", using haiku fallback`);
          model = anthropic.models['haiku'];
        }

        // Use package's fetchBatchResults (throws on all-retries-failed)
        let results;
        try {
          results = await engine.fetchBatchResults(statusResult.resultsUrl, anthropic, model);
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          console.error('[Batch Processor] Error fetching results:', errorMessage);
          await updatePendingBatch(db, batch.batch_id, 'failed', null, errorMessage);
          errors.push(`Batch ${batch.batch_id}: ${errorMessage}`);
          continue;
        }

        // Process each result (usually just one per batch in our case)
        // Package returns BatchResult[] with .response or .error
        for (const result of results) {
          if (result.response) {
            const responseText = result.response.content || '';

            // Parse actions using shared parser (DRY with sync mode)
            const parseResult = parseClaudeResponse(responseText);

            // Execute actions using the batch cycle_id
            const cycleId = batch.cycle_id ?? 0;
            // CRITICAL: Use new Date() for correct UTC timestamp, NOT toEastern()
            // toEastern() is for DISPLAY only - it creates a Date with wrong timestamp
            // that's 5 hours behind, causing SLEEP to immediately expire
            const now = new Date();

            // Send meters header to the user's Telegram BEFORE action notifications (if meters present)
            if (parseResult.meters && parseResult.success) {
              const telegramChatId = await getTelegramChatId(db);
              const streamEnabled = await getState(db, 'telegram_streaming');
              if (telegramChatId && streamEnabled === 'true' && env?.TELEGRAM_BOT_TOKEN) {
                // Pretty emoji mapping for each meter (from shared METER_EMOJI)
                const meterLine = Object.entries(parseResult.meters)
                  .map(([abbrev, value]) => `${METER_EMOJI[abbrev] || abbrev}${value}`)
                  .join(' · ');
                // Include note if present (italic, below meters)
                const display = parseResult.note
                  ? `${meterLine}\n<i>${parseResult.note}</i>`
                  : meterLine;
                await sendTelegram(telegramChatId, display, env).catch(() => {});
              }
            }

            // Execute actions using DRY wrapper
            // Handles: normalization, validation, streaming, error tracking for tooltip
            const { executed, failed } = await executeActions(parseResult, {
              db, env, cycleId,
              executeAction: async (db: D1Database, env: Env, action: Record<string, unknown>, cycleId: number) => {
                // Delegate to batch-specific executor (passed from index.js)
                await executeBatchAction(db, env, apiKey, action, cycleId, now);
              },
              streamToTelegram: streamActionToTelegram
            });

            console.log(`[Batch Processor] Executed ${executed.length}/${parseResult.actions?.length || 0} actions from batch ${batch.batch_id}`);

            // If complete parse failure or all actions failed, notify via Telegram
            if (!parseResult.success || (executed.length === 0 && failed.length > 0)) {
              const telegramChatId = await getTelegramChatId(db);
              if (telegramChatId && env?.TELEGRAM_BOT_TOKEN) {
                const errorSummary = failed.slice(0, 3).map(f => f.error || 'Unknown error').join(', ');
                await sendTelegram(
                  telegramChatId,
                  `⚠️ <b>Batch action errors</b>\n\n${errorSummary}${failed.length > 3 ? `\n... and ${failed.length - 3} more` : ''}`,
                  env
                ).catch(() => {});
              }

              // Log parse failure to history
              if (!parseResult.success) {
                await logHistory({ db, type: 'parse_error', content: `Batch response parsing failed: ${parseResult.error}`, internal: `Raw response:\n${(parseResult.rawResponse || '').substring(0, 2000)}`, cycleId: batch.cycle_id });
              }

              // If nothing executed, skip metrics update but don't completely fail
              if (executed.length === 0) {
                await markCycleError(db, cycleId, `All actions failed: ${failed[0]?.error || 'Unknown'}`);
                continue;
              }
            }

            // Update cycle record with metrics from batch result
            // Package already applies 50% batch discount to cost
            const usage = result.response.usage || {};
            const costCents = (result.response.cost || 0) * 100; // Convert dollars to cents
            await updateCycleMetrics(db, cycleId, {
              inputTokens: usage.input,
              outputTokens: usage.output,
              cacheCreationTokens: usage.cacheWrite,
              cacheReadTokens: usage.cacheRead,
              actionCount: executed.length,
              primaryAction: String(executed[0]?.action ?? ''),
              actionsJson: JSON.stringify(executed),
              estimatedCostCents: costCents,
              status: 'completed'
            });

            // Process meters from response (new format: {"actions": [...], "meters": {...}})
            if (parseResult.meters) {
              const meterUpdates = [];
              for (const [abbrev, value] of Object.entries(parseResult.meters)) {
                // Map abbreviations to full names
                const meterNameMap: Record<string, string> = { A: 'aliveness', C: 'curiosity', N: 'connection', E: 'ease', D: 'delight', X: 'anxiety', Y: 'activity' };
                const meterName = meterNameMap[abbrev] || abbrev.toLowerCase();
                if (METERS[meterName as keyof typeof METERS] && typeof value === 'number') {
                  const newValue = await setMeterValue(db, meterName, value);
                  meterUpdates.push(`${METERS[meterName as keyof typeof METERS].abbrev}${newValue}`);
                }
              }
              if (meterUpdates.length > 0) {
                console.log(`[Batch] Meters from response: ${meterUpdates.join(' ')}${parseResult.note ? ` | ${parseResult.note}` : ''}`);
                // Log state_update entry with optional note (same as old SET_STATE behavior)
                const internal = parseResult.note || 'meters from response';
                await logHistory({ db, type: 'state_update', content: meterUpdates.join(' '), internal, cycleId });
              }
            }

            // Update loop count
            const loopCount = parseInt(await getState(db, 'loop_count') || '0');
            await setState(db, 'loop_count', String(loopCount + 1));
            await setState(db, 'last_wake_time', now.toISOString());

            processed++;

          } else if (result.error) {
            // Package returns { customId, error } for failed requests
            console.error(`[Batch Processor] Batch request ${result.customId} errored:`, result.error);
            await logHistory({ db, type: 'thought', content: `Batch processing error: ${result.error}`, internal: 'Batch request failed', cycleId: batch.cycle_id });
            await markCycleError(db, batch.cycle_id ?? 0, `Batch error: ${result.error}`);
          }
        }

        // Mark batch as completed - final state transition
        console.log(`[Batch Processor] Batch ${batch.batch_id} state: executing → completed (${processed + 1} actions executed)`);
        await updatePendingBatch(db, batch.batch_id, 'completed', JSON.stringify(results));

      } else if (statusResult.status === 'expired' || statusResult.status === 'canceled') {
        console.log(`[Batch Processor] Batch ${batch.batch_id} ${statusResult.status}`);
        await updatePendingBatch(db, batch.batch_id, statusResult.status);
        await markCycleError(db, batch.cycle_id ?? 0, `Batch ${statusResult.status}`);
      }
      // If still 'in_progress', we'll check again next cron cycle

    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(`[Batch Processor] Exception processing batch ${batch.batch_id}:`, e);
      errors.push(`Batch ${batch.batch_id}: ${errorMessage}`);

      // CRITICAL: Mark batch as failed to prevent infinite retry loops.
      // Without this, an unhandled exception (e.g., during result fetch or action
      // execution) leaves the batch in 'pending' status. Every subsequent cron cycle
      // hits the same exception, and the batch blocks new cycles indefinitely.
      try {
        // Cancel on Anthropic's side
        await cancelBatch(batch.batch_id, apiKey, db, { cancelledBy: 'auto_timeout' }).catch(() => {});

        await updatePendingBatch(db, batch.batch_id, 'failed', null,
          `Unhandled exception: ${errorMessage}`,
          { cancelledBy: 'auto_timeout' }
        );
        console.log(`[Batch Processor] Marked batch ${batch.batch_id} as failed after unhandled exception`);

        // Auto-disable batch mode + force sync fallback
        await setState(db, 'batch_enabled', 'false');
        await setState(db, 'force_sync_fallback', 'true');
        await setState(db, 'last_wake_time', new Date().toISOString());
      } catch (updateErr) {
        // If even the failure marking fails, log it - hard timeout will eventually catch it
        console.error(`[Batch Processor] CRITICAL: Failed to mark batch ${batch.batch_id} as failed:`, updateErr);
      }
    }
  }

  return { processed, errors };
}
