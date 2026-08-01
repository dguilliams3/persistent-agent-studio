/**
 * Batch API Database State Management
 *
 * @module @persistence/llm/batches
 * @description Database operations for the Anthropic Batches API state.
 * Manages pending_batches table for tracking batch submissions and their status.
 *
 * NOTE: This module handles the D1 DATABASE STATE for batches (storing, tracking,
 * updating pending batches). The actual Anthropic API interaction (submitBatch,
 * checkBatchStatus, fetchBatchResults) is handled by RequestEngine in ./engine/.
 *
 * pending_batches table is persona-scoped for multi-persona support.
 *
 * Raw SQL pattern: Two functions in this module (listPendingBatches and
 * updatePendingBatch) use the db.$client escape hatch for raw D1 SQL. This is
 * intentional — those queries use SQLite-specific expressions (julianday arithmetic,
 * conditional SET clauses) that Drizzle's query builder cannot express. The pattern
 * is `const raw = db.$client` followed by `raw.prepare(sql).bind(...).run()`.
 *
 * @upstream Called by:
 *   - Platform batch-processor.js (polling loop)
 *   - Platform Telegram /batch, /cancel commands
 *   - Platform API endpoints (/batches, /batch-timeout)
 * @downstream Calls:
 *   - @persistence/db state functions (getState, setState)
 *   - @persistence/db persona functions (getActivePersonaId) and Drizzle schema tables
 *   - db.$client (raw D1 binding) for SQLite-specific queries in listPendingBatches and updatePendingBatch
 * @antipattern DO NOT call .prepare() directly on a DrizzleD1 value — DrizzleD1 is the
 *   Drizzle wrapper, not the raw D1 binding. Always extract the binding first:
 *   `const raw = db.$client; await raw.prepare(sql).bind(...).run()`.
 */

import {
  getState,
  setState,
  getActivePersonaId,
  parseDbTimestamp,
  pendingBatches,
  historyTable,
  eq,
  and,
  inArray,
  sql,
  desc,
  type DrizzleD1,
  type PersonaOptions,
} from "@persistence/db";

// =============================================================================
// CONSTANTS (Moved from platform/cloudflare/src/constants.js)
// =============================================================================

/**
 * @description Time window for using Anthropic's Batches API (50% cheaper, async)
 * During this window, cycles are submitted as batch requests instead of sync
 * All times are in Eastern Time (America/New_York)
 *
 * @property {number} startHour - Hour to start batching (0-23, Eastern)
 * @property {number} endHour - Hour to stop batching (0-23, Eastern)
 * @property {boolean} enabled - Master toggle for batch mode
 * @property {number} userActivityOverrideMinutes - Skip batching if the user messaged within this many minutes
 */
export const BATCH_WINDOW = {
  startHour: 0, // 12:00 AM Eastern
  endHour: 9, // 9:00 AM Eastern
  enabled: false, // Set to true when batch implementation is ready
  userActivityOverrideMinutes: 30, // Stay sync if user active recently
} as const;

/**
 * @description Hard timeout for batches - maximum time before force-clearing
 *
 * This is a safety net that fires regardless of Anthropic's reported status.
 * Default 54 minutes (3240s) - just under the 1-hour cache TTL to preserve
 * cache economics. If a batch runs longer than this, something is wrong.
 *
 * The soft timeout (batch_timeout_seconds) triggers when Anthropic reports
 * 'in_progress'. This hard timeout triggers regardless of status.
 *
 * @type {number} Default hard timeout in seconds
 */
export const BATCH_HARD_TIMEOUT_SECONDS = 54 * 60; // 54 minutes

// =============================================================================
// UTILITIES (Inlined to avoid platform dependency)
// =============================================================================

/**
 * @description Converts a date to Eastern timezone
 *
 * This is useful for consistent timestamp calculations regardless of where
 * the Cloudflare Worker is executing (edge locations worldwide).
 * Inlined here to avoid dependency on platform layer.
 *
 * @param date - The date to convert, defaults to current date/time
 * @returns A new Date object representing the time in Eastern timezone
 *
 * @example
 * const easternNow = toEastern();
 * const easternHour = toEastern().getHours();
 */
function toEastern(date: Date = new Date()): Date {
  return new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Batch status values from Anthropic API
 */
export type BatchApiStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "expired"
  | "canceled"
  | "canceling";

/**
 * Who cancelled a batch
 */
export type CancelledBy = "user" | "auto_timeout" | null;

/**
 * Pending batch record from D1
 */
export interface PendingBatch {
  id: number;
  persona_id: number;
  batch_id: string;
  custom_id: string;
  cycle_id: number | null;
  trigger: string;
  model: string;
  status: BatchApiStatus;
  submitted_at: string;
  completed_at: string | null;
  results_json: string | null;
  error_message: string | null;
  cancelled_by: CancelledBy;
  timeout_seconds: number | null;
  duration_seconds: number;
}

/**
 * Options for batch operations
 */
export interface BatchOptions extends PersonaOptions {}

/**
 * Result from cancel operation
 */
export interface CancelBatchResult {
  success: boolean;
  status?: string;
  cancelInitiatedAt?: string;
  cancelledBy?: CancelledBy;
  error?: string;
}

// =============================================================================
// TIMEOUT CONFIGURATION
// =============================================================================

/**
 * @description Get the effective batch timeout in seconds
 *
 * Returns the configured batch timeout, or defaults to half the cycle interval
 * if no custom timeout is set (or set to 'auto'). This ensures batches timeout
 * with enough time to fallback to a sync cycle before the next scheduled cycle.
 *
 * @upstream Called by: processPendingBatches, storePendingBatch, /batch-timeout endpoint
 * @downstream Calls: getState (db/state.js)
 *
 * @param db - Database instance
 * @param options - Optional settings including personaId override
 * @returns Timeout in seconds
 *
 * @example
 * const timeout = await getBatchTimeout(db);
 * // Returns: 7200 (if custom set) or 150 (half of 300s cycle interval)
 *
 * @note Uses persona scoping via getState (already persona-aware)
 * @note Default is cycle_interval / 2 to allow sync fallback within same cycle window
 */
export async function getBatchTimeout(
  db: DrizzleD1,
  options: BatchOptions = {},
): Promise<number> {
  const customTimeout = await getState(db, "batch_timeout_seconds", options);
  if (customTimeout && customTimeout !== "auto") {
    return parseInt(customTimeout, 10);
  }
  // Default to half the cycle interval - gives time for sync fallback
  const interval = await getState(db, "cycle_interval_seconds", options);
  const halfInterval = Math.floor(parseInt(interval || "300", 10) / 2);
  // Minimum 60 seconds to avoid too-aggressive timeouts
  return Math.max(halfInterval, 60);
}

/**
 * @description Set the batch timeout in seconds
 *
 * Sets a custom batch timeout, or resets to auto (uses cycle interval).
 * Passing 'auto' or null resets to automatic behavior.
 *
 * @upstream Called by: /batch-timeout endpoint, /batchtimeout Telegram command
 * @downstream Calls: setState (db/state.js)
 *
 * @param db - Database instance
 * @param seconds - Timeout in seconds, 'auto', or null to reset
 * @param options - Optional settings including personaId override
 * @returns The value that was set
 *
 * @example
 * await setBatchTimeout(db, 7200);  // Set to 2 hours
 * await setBatchTimeout(db, 'auto');  // Reset to auto (use cycle interval)
 * await setBatchTimeout(db, null);  // Same as 'auto'
 *
 * @note Uses persona scoping via setState (already persona-aware)
 */
export async function setBatchTimeout(
  db: DrizzleD1,
  seconds: number | string | null,
  options: BatchOptions = {},
): Promise<{ timeout: string | null }> {
  // 'auto' or null resets to use cycle interval
  const value = seconds === "auto" || seconds === null ? null : String(seconds);
  await setState(db, "batch_timeout_seconds", value, options);
  return { timeout: value || "auto" };
}

/**
 * @description Get the hard timeout for batches (fires regardless of Anthropic status)
 *
 * This is a safety net that fires even if checkBatchStatus fails or returns
 * unexpected data. Default 54 minutes - just under cache TTL to preserve
 * cache economics. If a batch exceeds this, something is wrong.
 *
 * @upstream Called by: processPendingBatches (batch-processor.js)
 * @downstream Calls: getState (db/state.js)
 *
 * @param db - Database instance
 * @param options - Optional settings including personaId override
 * @returns Hard timeout in seconds
 *
 * @example
 * const hardTimeout = await getBatchHardTimeout(db);
 * // Returns: 3240 (54 min default) or custom value
 */
export async function getBatchHardTimeout(
  db: DrizzleD1,
  options: BatchOptions = {},
): Promise<number> {
  const custom = await getState(db, "batch_hard_timeout_seconds", options);
  if (custom && custom !== "auto") {
    return parseInt(custom, 10);
  }
  return BATCH_HARD_TIMEOUT_SECONDS;
}

/**
 * @description Set the hard timeout for batches
 *
 * @upstream Called by: /batch-hard-timeout endpoint, Telegram command
 * @downstream Calls: setState (db/state.js)
 *
 * @param db - Database instance
 * @param seconds - Timeout in seconds, 'auto', or null to reset
 * @param options - Optional settings
 * @returns The value that was set
 */
export async function setBatchHardTimeout(
  db: DrizzleD1,
  seconds: number | string | null,
  options: BatchOptions = {},
): Promise<{ hardTimeout: number }> {
  const value = seconds === "auto" || seconds === null ? null : String(seconds);
  await setState(db, "batch_hard_timeout_seconds", value, options);
  return {
    hardTimeout: value ? parseInt(value, 10) : BATCH_HARD_TIMEOUT_SECONDS,
  };
}

// =============================================================================
// BATCH CRUD OPERATIONS
// =============================================================================

/**
 * @description List all pending/processing batches with duration info
 *
 * Returns batches that are currently pending or processing, along with
 * calculated duration_seconds, cancelled_by, and timeout_seconds fields.
 *
 * Uses db.$client (raw D1 binding) because the query includes a julianday()
 * arithmetic expression for duration_seconds that Drizzle's query builder
 * cannot generate. Access pattern: `const raw = db.$client; raw.prepare(sql).bind(...).all()`.
 *
 * @upstream Called by: /batches endpoint, /batches Telegram command
 * @downstream Calls: db.$client raw D1 binding with persona filtering
 *
 * @param db - DrizzleD1 database instance
 * @param options - Optional settings including personaId override
 * @returns Array of pending batch records
 *
 * @example
 * const batches = await listPendingBatches(db);
 * // Returns: [{ batch_id: 'batch_abc123', status: 'processing', duration_seconds: 120, ... }]
 *
 * @note Uses persona scoping - queries are filtered by persona_id
 */
export async function listPendingBatches(
  db: DrizzleD1,
  options: BatchOptions = {},
): Promise<Partial<PendingBatch>[]> {
  const raw = db.$client;
  const { personaId = null } = options;
  let query = `SELECT batch_id, status, submitted_at as created_at, completed_at, cancelled_by, timeout_seconds,
    CAST((julianday('now') - julianday(submitted_at)) * 86400 AS INTEGER) as duration_seconds
    FROM pending_batches
    WHERE status IN ('pending', 'processing')`;

  if (personaId !== null) {
    query += ` AND (persona_id = ? OR persona_id IS NULL)`;
    const result = await raw
      .prepare(query)
      .bind(personaId)
      .all<Partial<PendingBatch>>();
    return result.results || [];
  }

  const result = await raw.prepare(query).all<Partial<PendingBatch>>();
  return result.results || [];
}

/**
 * @description Stores a pending batch record in D1
 *
 * Called when a batch request is submitted to Anthropic's API.
 * The batch is then checked periodically until it completes.
 * Now captures the timeout_seconds that was in effect when the batch was created.
 *
 * @upstream Called by: submitBatch (after successful API call)
 * @downstream Calls: insertWithPersona (db/personas.js), getBatchTimeout
 *
 * @param db - Database instance
 * @param batchId - Anthropic batch ID
 * @param customId - Our custom ID for tracking
 * @param cycleId - Associated cycle ID if any
 * @param trigger - What triggered this batch ('cron' or 'manual')
 * @param model - Model used
 * @param options - Optional settings including personaId override
 *
 * @example
 * await storePendingBatch(db, 'batch_abc123', 'custom-001', 42, 'cron', 'claude-opus-4');
 *
 * // Override persona
 * await storePendingBatch(db, batchId, customId, cycleId, trigger, model, { personaId: 2 });
 *
 * @note Uses persona scoping via insertWithPersona
 * @note Automatically captures the current batch timeout for audit trail
 */
export async function storePendingBatch(
  db: DrizzleD1,
  batchId: string,
  customId: string,
  cycleId: number | null,
  trigger: string,
  model: string,
  options: BatchOptions = {},
): Promise<void> {
  // Capture the current timeout for audit trail
  const timeoutSeconds = await getBatchTimeout(db, options);
  const personaId = await getActivePersonaId(db);

  await db.insert(pendingBatches).values({
    personaId,
    batchId,
    customId,
    cycleId: cycleId ?? null,
    trigger,
    model,
    status: "pending",
    timeoutSeconds,
  });
}

/**
 * @description Gets all pending batches that need to be checked
 *
 * Returns batches with status 'pending' or 'processing', along with
 * calculated duration_seconds showing how long they've been running.
 *
 * @upstream Called by: processPendingBatches, /batches endpoint
 * @downstream Calls: personaAll (db/personas.js)
 *
 * @param db - Database instance
 * @param options - Optional settings including personaId override
 * @returns Array of pending batch records with duration_seconds
 *
 * @example
 * const batches = await getPendingBatches(db);
 *
 * // Override persona
 * const otherBatches = await getPendingBatches(db, { personaId: 2 });
 *
 * @note Uses persona scoping via personaAll
 */
export async function getPendingBatches(
  db: DrizzleD1,
  options: BatchOptions = {},
): Promise<PendingBatch[]> {
  // Include 'canceling' so the polling loop can detect when Anthropic transitions
  // to 'canceled' (terminal). Without this, batches set to 'canceling' by cancelBatch()
  // are never polled again, leaving orphaned records.
  // NOTE: The batch guard (checkPendingBatchGuard) and runThinkingCycle guard both
  // filter in JS for 'pending'/'processing' only, so 'canceling' records won't block cycles.
  const personaId = options.personaId ?? await getActivePersonaId(db);

  const rows = await db
    .select({
      id: pendingBatches.id,
      persona_id: pendingBatches.personaId,
      batch_id: pendingBatches.batchId,
      custom_id: pendingBatches.customId,
      cycle_id: pendingBatches.cycleId,
      trigger: pendingBatches.trigger,
      model: pendingBatches.model,
      status: pendingBatches.status,
      submitted_at: pendingBatches.submittedAt,
      completed_at: pendingBatches.completedAt,
      results_json: pendingBatches.resultsJson,
      error_message: pendingBatches.errorMessage,
      cancelled_by: pendingBatches.cancelledBy,
      timeout_seconds: pendingBatches.timeoutSeconds,
      duration_seconds: sql<number>`
        CASE WHEN ${pendingBatches.completedAt} IS NOT NULL
          THEN CAST((julianday(${pendingBatches.completedAt}) - julianday(${pendingBatches.submittedAt})) * 86400 AS INTEGER)
          ELSE CAST((julianday('now') - julianday(${pendingBatches.submittedAt})) * 86400 AS INTEGER)
        END`.as("duration_seconds"),
    })
    .from(pendingBatches)
    .where(
      and(
        eq(pendingBatches.personaId, personaId),
        inArray(pendingBatches.status, ["pending", "processing", "canceling"]),
      ),
    )
    .orderBy(pendingBatches.submittedAt)
    .all();

  return rows as PendingBatch[];
}

/**
 * @description Updates a pending batch record with status and completion info
 *
 * Called when a batch status changes. Only sets completed_at for terminal
 * statuses (completed, failed, expired, canceled) - not for 'processing'.
 * Now tracks who/what cancelled the batch via the cancelledBy option.
 *
 * @antipattern ALWAYS SETTING COMPLETED_AT
 * // WRONG: Always set completed_at when status changes
 * SET status = ?, completed_at = datetime('now'), ...
 * // This causes duration_seconds to be calculated as time-to-processing
 * // instead of actual elapsed time, breaking the batch guard logic.
 *
 * // CORRECT: Only set completed_at for terminal statuses
 * if (isTerminal) { SET completed_at = datetime('now') }
 *
 * Uses db.$client (raw D1 binding) because the UPDATE requires a conditional
 * datetime('now') assignment that varies by terminal/non-terminal status,
 * which Drizzle's query builder cannot express as a single prepared statement.
 *
 * @upstream Called by: processPendingBatches, cancelBatch
 * @downstream Calls: getActivePersonaId (db/personas.js), db.$client raw D1 binding for UPDATE
 *
 * @param db - Database instance
 * @param batchId - Anthropic batch ID
 * @param status - New status ('processing', 'completed', 'failed', 'expired', 'canceled')
 * @param resultsJson - Raw results JSON from API
 * @param errorMessage - Error message if failed
 * @param options - Optional settings including personaId override and cancelledBy
 *
 * @example
 * await updatePendingBatch(db, 'batch_abc123', 'completed', resultsJson);
 *
 * // With cancellation tracking
 * await updatePendingBatch(db, batchId, 'expired', null, 'Timed out', { cancelledBy: 'auto_timeout' });
 *
 * @note Uses persona scoping via getActivePersonaId + manual WHERE clause
 * @note D1 accepts null but NOT undefined - use ?? null for cancelledBy
 */
export async function updatePendingBatch(
  db: DrizzleD1,
  batchId: string,
  status: BatchApiStatus,
  resultsJson: string | null = null,
  errorMessage: string | null = null,
  options: BatchOptions & { cancelledBy?: CancelledBy } = {},
): Promise<void> {
  const raw = db.$client;
  const { cancelledBy = null } = options;
  const personaId = options.personaId ?? await getActivePersonaId(db);
  // Only set completed_at for terminal statuses, not for 'processing'
  const isTerminal = ["completed", "failed", "expired", "canceled"].includes(
    status,
  );

  if (isTerminal) {
    await raw
      .prepare(
        `
      UPDATE pending_batches
      SET status = ?, completed_at = datetime('now'), results_json = ?, error_message = ?, cancelled_by = ?
      WHERE persona_id = ? AND batch_id = ?
    `,
      )
      .bind(
        status,
        resultsJson ?? null,
        errorMessage ?? null,
        cancelledBy ?? null,
        personaId,
        batchId,
      )
      .run();
  } else {
    await raw
      .prepare(
        `
      UPDATE pending_batches
      SET status = ?
      WHERE persona_id = ? AND batch_id = ?
    `,
      )
      .bind(status, personaId, batchId)
      .run();
  }
}

// =============================================================================
// BATCH WINDOW & TIMING CHECKS
// =============================================================================

/**
 * @description Checks if current time is within the batch processing window (Eastern time)
 *
 * Batch mode can be toggled via D1 state ('batch_enabled') or falls back
 * to BATCH_WINDOW.enabled constant. Supports timed batch mode via 'batch_until'.
 *
 * @upstream Called by: Main thinking cycle to decide batch vs streaming
 * @downstream Calls: getState, setState
 *
 * @param db - Database instance to check state
 * @param options - Optional settings including personaId override
 * @returns True if batching should be used
 *
 * @example
 * if (await isInBatchWindow(db)) {
 *   // Submit to batch API
 * } else {
 *   // Use streaming API
 * }
 *
 * // Override persona
 * if (await isInBatchWindow(db, { personaId: 2 })) { ... }
 *
 * @note Uses persona scoping via getState/setState (already persona-aware)
 */
export async function isInBatchWindow(
  db: DrizzleD1,
  options: BatchOptions = {},
): Promise<boolean> {
  // Check D1 state first (allows runtime toggling via UI/Telegram)
  const stateSetting = await getState(db, "batch_enabled", options);

  // Check if there's a timed batch mode (e.g., "/batch 8" for 8 hours)
  const batchUntil = await getState(db, "batch_until", options);
  if (batchUntil) {
    const untilTime = new Date(batchUntil);
    if (Date.now() >= untilTime.getTime()) {
      // Timer expired - auto-disable batch mode
      await setState(db, "batch_enabled", "false", options);
      await setState(db, "batch_until", null, options);
      console.log("[Batch Mode] Timed batch expired, disabling");
      return false;
    }
    // Timed batch still active
    return true;
  }

  // If user EXPLICITLY enabled batch (state set to 'true'), respect it regardless of time
  // This fixes the issue where UI showed "on" but batching only worked 12AM-9AM
  if (stateSetting === "true") {
    return true;
  }

  // If user EXPLICITLY disabled batch, respect that too
  if (stateSetting === "false") {
    return false;
  }

  // No explicit setting - use time window as default behavior
  // Batch automatically during overnight hours (12AM-9AM Eastern) if BATCH_WINDOW.enabled is true
  if (!BATCH_WINDOW.enabled) {
    return false;
  }
  const easternHour = toEastern().getHours();
  return (
    easternHour >= BATCH_WINDOW.startHour && easternHour < BATCH_WINDOW.endHour
  );
}

/**
 * @description Checks if the user has been active recently (overrides batch mode)
 *
 * When the user is actively messaging, we want to use streaming for faster
 * responses rather than batching.
 *
 * @upstream Called by: Main thinking cycle
 * @downstream Calls: personaFirst (db/personas.js)
 *
 * @param db - Database instance
 * @param options - Optional settings including personaId override
 * @returns True if user has been active within the override window
 *
 * @example
 * if (await isUserRecentlyActive(db)) {
 *   // Use streaming instead of batch
 * }
 *
 * // Override persona
 * if (await isUserRecentlyActive(db, { personaId: 2 })) { ... }
 *
 * @note Uses persona scoping via personaFirst
 */
export async function isUserRecentlyActive(
  db: DrizzleD1,
  options: BatchOptions = {},
): Promise<boolean> {
  const personaId = options.personaId ?? await getActivePersonaId(db);
  const lastUserMessage = await db
    .select({ created_at: historyTable.createdAt })
    .from(historyTable)
    .where(
      and(
        eq(historyTable.personaId, personaId),
        eq(historyTable.type, "user_message"),
      ),
    )
    .orderBy(desc(historyTable.createdAt))
    .limit(1)
    .get();

  if (!lastUserMessage || !lastUserMessage.created_at) return false;

  const lastMessageTime = parseDbTimestamp(lastUserMessage.created_at);
  const minutesAgo = (Date.now() - lastMessageTime.getTime()) / 60000;

  return minutesAgo < BATCH_WINDOW.userActivityOverrideMinutes;
}

// =============================================================================
// BATCH CANCELLATION (API INTERACTION)
// =============================================================================

/**
 * LLM interface for optional dependency injection
 *
 * @description Minimal interface for cancelBatch to use the unified LLM.
 * Full LLM type is in ./types.ts but we only need cancelBatch here.
 */
interface LLMCancelInterface {
  anthropic: {
    cancelBatch(batchId: string): Promise<{
      success: boolean;
      status?: string;
      cancelInitiatedAt?: string;
      error?: string;
    }>;
  };
}

/**
 * @description Cancels a pending batch via Anthropic API
 *
 * Sends cancellation request to Anthropic's Batches API and updates
 * the local database record. Now tracks who/what cancelled the batch.
 * Note that in-flight requests may still complete even after cancellation.
 *
 * Supports optional LLM interface for unified API access. If llm is provided,
 * uses llm.anthropic.cancelBatch(). Otherwise falls back to direct fetch.
 *
 * @upstream Called by: handleCancel (Telegram command), /cancel API endpoint
 * @downstream Calls: LLM interface OR Anthropic Batches API (POST /cancel), updatePendingBatch
 *
 * @param batchId - Anthropic batch ID to cancel
 * @param apiKey - Anthropic API key (used if llm not provided)
 * @param db - Database instance
 * @param options - Optional settings including personaId override, cancelledBy, and llm interface
 * @returns Cancel result with status information
 *
 * @example
 * // Legacy usage (direct API key)
 * const result = await cancelBatch('batch_abc123', env.ANTHROPIC_API_KEY, db);
 *
 * // New usage (with LLM interface)
 * const llm = await createLLM(secrets);
 * const result = await cancelBatch('batch_abc123', '', db, { llm });
 *
 * // With cancellation source tracking
 * const result = await cancelBatch(batchId, apiKey, db, { cancelledBy: 'auto_timeout', llm });
 *
 * @note Cancellation is not immediate - batch enters 'canceling' state first.
 * In-progress requests within the batch may still complete.
 * @note Uses persona scoping via updatePendingBatch passthrough
 */
export async function cancelBatch(
  batchId: string,
  apiKey: string,
  db: DrizzleD1,
  options: BatchOptions & {
    cancelledBy?: CancelledBy;
    llm?: LLMCancelInterface;
  } = {},
): Promise<CancelBatchResult> {
  const { cancelledBy = "user", llm } = options;

  try {
    let apiResult: {
      success: boolean;
      status?: string;
      cancelInitiatedAt?: string;
      error?: string;
    };

    if (llm) {
      // Use unified LLM interface
      apiResult = await llm.anthropic.cancelBatch(batchId);
    } else {
      // Fallback to direct fetch (backwards compatibility)
      const response = await fetch(
        `https://api.anthropic.com/v1/messages/batches/${batchId}/cancel`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
            "x-api-key": apiKey,
          },
        },
      );

      const data = (await response.json()) as {
        processing_status?: string;
        cancel_initiated_at?: string;
        error?: { message?: string };
      };

      if (!response.ok) {
        apiResult = {
          success: false,
          error: data.error?.message || `HTTP ${response.status}`,
        };
      } else {
        apiResult = {
          success: true,
          status: data.processing_status || "canceling",
          cancelInitiatedAt: data.cancel_initiated_at,
        };
      }
    }

    if (!apiResult.success) {
      return { success: false, error: apiResult.error };
    }

    // Update local record - status will be 'canceling' until fully canceled
    const newStatus = (apiResult.status || "canceling") as BatchApiStatus;
    await updatePendingBatch(
      db,
      batchId,
      newStatus,
      null,
      `Cancelled by ${cancelledBy}`,
      { ...options, cancelledBy },
    );

    return {
      success: true,
      status: newStatus,
      cancelInitiatedAt: apiResult.cancelInitiatedAt,
      cancelledBy,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
