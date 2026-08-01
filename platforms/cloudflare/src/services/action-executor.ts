/**
 * @module services/action-executor
 * @description Shared action execution wrapper for sync and batch modes.
 *
 * This module provides a DRY execution wrapper that handles:
 * - Action normalization (typo correction)
 * - Action validation (required fields, types)
 * - Optional Telegram streaming
 * - Partial success (execute valid actions even if some fail)
 * - Error storage for one-cycle tooltip feedback
 *
 * The actual action execution logic stays in index.js (sync) or batch-processor.js (batch)
 * and is passed as a callback. This wrapper handles the surrounding concerns.
 *
 * @upstream Called by:
 *   - orchestrator (via cycle-adapter) - sync mode action execution
 *   - batch-processor.js processPendingBatches() - batch mode action execution
 *
 * @downstream Calls:
 *   - feedback.js normalizeAction() - action name normalization
 *   - feedback.js addFeedback() - error feedback storage
 *   - @persistence/tools validateAction() - action structure validation
 *   - db/state.js getState(), setState() - tooltip state storage
 */

import { normalizeAction, transformLegacyAction, addFeedback, FEEDBACK_TYPES } from './feedback.js';
// Validation and schema from @persistence/tools package (canonical source)
import { validateAction, getToolDefinition } from '@persistence/tools';
import { ACTION_HANDLERS } from '../tools/actions/index.js';
import { executePackageHandler } from '../tools/handler-registry.js';
import { runPostProcessors } from '../tools/post-processors.js';
import { logHistory } from '../utils/index.js';
import { getState, setState } from '../db/index.js';
import type { Env } from '../bootstrap.js';

type ActionRecord = any;
type ParseErrorItem = {
  action?: ActionRecord;
  raw?: string;
  error: string;
  hint?: string;
  type: 'parse_failure' | 'validation' | 'execution' | 'malformed';
};
type ParseResult = {
  success: boolean;
  actions: ActionRecord[];
  malformed?: Array<{ raw?: string; error: string }>;
  repairApplied?: string[];
  error?: string;
  rawResponse?: string;
};
type ExecuteContext = {
  db: D1Database;
  env: Env;
  cycleId: number;
  executeAction: (db: D1Database, env: Env, action: ActionRecord, cycleId: number) => Promise<void>;
  streamToTelegram?: (db: D1Database, action: ActionRecord, env: Env) => Promise<void>;
};
type FeedbackMeta = {
  totalActions?: number;
  executedCount?: number;
  repairApplied?: string[];
};
type FeedbackStoreData = {
  timestamp: string;
  errors: ParseErrorItem[];
  totalErrors: number;
  totalActions: number;
  executedCount: number;
  repairApplied: string[];
  shown: boolean;
};

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Maximum number of errors to show in the tooltip.
 * Prevents context pollution from massive parsing failures.
 */
const MAX_TOOLTIP_ERRORS = 5;

/**
 * State key for action feedback (one-cycle tooltip)
 */
const FEEDBACK_STATE_KEY = 'action_feedback_json';

// =============================================================================
// MAIN EXECUTION WRAPPER
// =============================================================================

/**
 * @description Execute parsed actions with partial success support.
 *
 * This function wraps action execution for both sync and batch modes,
 * providing consistent handling of:
 * - Action name normalization (fixes typos)
 * - Field validation (required fields, types)
 * - Optional Telegram streaming
 * - Partial success (good actions execute even if others fail)
 * - Error feedback storage for tooltip
 *
 * The actual action execution is delegated to the provided callback,
 * which varies between sync mode (inline switch) and batch mode (executeBatchAction).
 *
 * @upstream Called by: orchestrator (via cycle-adapter), processPendingBatches() in batch-processor.js
 * @downstream Calls: normalizeAction(), validateAction(), addFeedback(), storeParseErrors()
 *
 * @param {Object} parseResult - Result from parseClaudeResponse()
 * @param {boolean} parseResult.success - Whether parsing succeeded
 * @param {boolean} [parseResult.fullyParsed] - Whether clean parse worked (vs salvage)
 * @param {Object[]} parseResult.actions - Array of parsed action objects
 * @param {Array<{raw: string, error: string}>} [parseResult.malformed] - Malformed objects from salvage parsing
 * @param {string[]} [parseResult.repairApplied] - Repairs that were applied during parsing
 *
 * @param {Object} context - Execution context
 * @param {D1Database} context.db - Database binding
 * @param {Object} context.env - Environment with API keys
 * @param {number} context.cycleId - Current cycle ID for history entries
 * @param {Function} context.executeAction - Callback to execute a single action
 *   Signature: async (db, env, action, cycleId) => void
 *   Note: Batch mode signature is (db, env, apiKey, action, cycleId, now) - adapt as needed
 * @param {Function} [context.streamToTelegram] - Optional callback to stream action to Telegram
 *   Signature: async (db, action, env) => void
 * @param {string} [context.apiKey] - API key (for batch mode)
 * @param {Date} [context.now] - Current timestamp (for batch mode)
 *
 * @returns {Promise<{executed: Object[], failed: Object[]}>}
 *   executed: Array of successfully executed action objects
 *   failed: Array of failure records with { action?, raw?, error, hint?, type? }
 *
 * @example
 * // Sync mode usage
 * const parseResult = parseClaudeResponse(responseText);
 * const { executed, failed } = await executeActions(parseResult, {
 *   db, env, cycleId,
 *   executeAction: async (db, env, action, cycleId) => {
 *     // inline switch statement execution
 *   },
 *   streamToTelegram: streamActionToTelegram
 * });
 *
 * @example
 * // Batch mode usage
 * const { executed, failed } = await executeActions(parseResult, {
 *   db, env, cycleId, apiKey, now,
 *   executeAction: async (db, env, action, cycleId) => {
 *     await executeBatchAction(db, env, apiKey, action, cycleId, now);
 *   },
 *   streamToTelegram: streamActionToTelegram // optional
 * });
 *
 * @note If parseResult.success is false, returns empty executed and includes parse error
 * @note Validation errors are logged as feedback but don't stop other actions
 *
 * @tests tests/services/action-executor.test.js - executeActions
 *   - Parse failure handling (4 tests)
 *   - Successful action execution (3 tests)
 *   - Action name normalization (3 tests)
 *   - Action validation and partial success (3 tests)
 *   - Malformed objects handling (2 tests)
 *   - Telegram streaming (3 tests)
 *   - Execution error handling (2 tests)
 *   - Error storage for tooltip (2 tests)
 */
export async function executeActions(parseResult: ParseResult, context: ExecuteContext) {
  const { db, env, cycleId, executeAction, streamToTelegram } = context;
  const executed: ActionRecord[] = [];
  const failed: ParseErrorItem[] = [];

  // Handle parse failure
  if (!parseResult.success) {
    failed.push({
      type: 'parse_failure',
      error: parseResult.error || 'Unknown parse error',
      raw: parseResult.rawResponse?.substring(0, 500) // Truncate for safety
    });
    await storeParseErrors(db, failed);
    return { executed, failed };
  }

  // Process each action
  for (const action of parseResult.actions) {
    try {
      // Step 1: Normalize action name (handles typos like MESSAGED_USER → MESSAGE_USER,
      // and dynamic humanName tool names like MESSAGE_ALEX → MESSAGE_USER)
      const originalActionName = action.action;
      action.action = normalizeAction(String(action.action ?? ''));

      if (action.action !== originalActionName) {
        await addFeedback(db, FEEDBACK_TYPES.ACTION_NORMALIZED, {
          original: originalActionName,
          corrected: action.action
        });
      }

      // Step 1b: Transform legacy actions (SHARE_ART → ART with op:"share")
      // This must happen BEFORE validation so the op parameter is set
      const transformedAction = transformLegacyAction(action);
      Object.assign(action, transformedAction);

      // Step 2: Validate action structure
      const validation = validateAction(action);
      if (!validation.valid) {
        failed.push({
          action: action,
          error: validation.error || 'Validation failed',
          hint: validation.hint,
          type: 'validation'
        });
        // Log as feedback for the next cycle
        await addFeedback(db, FEEDBACK_TYPES.ACTION_UNKNOWN, {
          action: action.action || 'unknown',
          error: validation.error
        });
        continue; // Skip to next action - don't fail entire batch
      }

      // Step 3: Stream to Telegram (if callback provided)
      if (streamToTelegram) {
        await streamToTelegram(db, action, env);
      }

      // Step 4: Execute the action via callback
      await executeAction(db, env, action, cycleId);
      executed.push(action);

    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Execution error';
      // Execution failed for this action
      failed.push({
        action: action,
        error: errorMessage,
        type: 'execution'
      });
      console.error(`[ActionExecutor] Action ${action?.action} failed:`, errorMessage);
    }
  }

  // Include malformed objects from salvage parsing
  if (parseResult.malformed && parseResult.malformed.length > 0) {
    for (const m of parseResult.malformed) {
      failed.push({
        raw: m.raw?.substring(0, 200), // Truncate for tooltip
        error: m.error,
        type: 'malformed'
      });
    }
  }

  // Store failures for one-cycle tooltip (Phase 3)
  if (failed.length > 0) {
    await storeParseErrors(db, failed, {
      totalActions: parseResult.actions.length,
      executedCount: executed.length,
      repairApplied: parseResult.repairApplied
    });
  } else {
    // Clear any old feedback if this cycle succeeded
    await clearParseErrors(db);
  }

  return { executed, failed };
}

/**
 * @description Dispatch a tool action using package handlers (preferred) or platform handlers (fallback).
 *
 * Execution strategy:
 * 1. Try package handler first (TypeScript, uses @persistence/db)
 * 2. If no package handler exists, fall back to platform handler (JavaScript)
 * 3. If neither exists, log unhandled action
 *
 * Package handlers are preferred because they:
 * - Use typed @persistence/db functions (single source of truth)
 * - Are easier to test in isolation
 * - Consolidate logic away from the platform layer
 *
 * @param {Object} params
 * @param {D1Database} params.db
 * @param {Object} params.env
 * @param {Object} params.action
 * @param {number} params.cycleId
 * @param {string} [params.apiKey]
 * @param {Date} [params.now]
 *
 * @upstream Called by: executeActions() callback, batch-processor.js
 * @downstream Calls: executePackageHandler(), ACTION_HANDLERS
 */
export async function executeTool({
  db,
  env,
  action,
  cycleId,
  apiKey,
  now = new Date()
}: {
  db: D1Database;
  env: Env;
  action: ActionRecord;
  cycleId: number;
  apiKey?: string;
  now?: Date;
}) {
  // Try package handler first (preferred path)
  const packageResult = await executePackageHandler({ db, env, action, cycleId }) as {
    success: boolean;
    error?: unknown;
    data?: unknown;
  } | null | undefined;
  if (packageResult) {
    // Package handler executed - log any errors but don't throw
    if (!packageResult.success && packageResult.error) {
      console.error(`[executeTool] Package handler error for ${action.action}:`, packageResult.error);
    }

    // Run post-processors for handlers that return metadata flags
    // (e.g., needsTelegram, needsVoice, needsImageGeneration)
    if (packageResult.success && packageResult.data) {
      try {
        await runPostProcessors({ db, env, cycleId, apiKey, now }, packageResult as any);
      } catch (postErr: unknown) {
        const postErrMessage = postErr instanceof Error ? postErr.message : String(postErr);
        console.error(`[executeTool] Post-processing error for ${action.action}:`, postErrMessage);
        // Non-fatal - action already succeeded, just post-processing failed
      }
    }

    return packageResult;
  }

  // Fall back to platform handler
  const handler = ACTION_HANDLERS[action.action as keyof typeof ACTION_HANDLERS];
  if (!handler) {
    await logHistory({ db, type: 'action_error', content: `Unhandled action: ${action.action}`, internal: action.internal, cycleId });
    return;
  }
  await handler({ db, env, action, cycleId });
}

// =============================================================================
// ERROR STORAGE (Phase 3: One-Cycle Tooltip)
// =============================================================================

/**
 * @description Store parse errors for one-cycle tooltip display.
 *
 * Stores error information in the state table so it can be injected
 * into Clio's context on the next cycle. The errors are marked as
 * `shown: false` initially, then marked `shown: true` after being
 * injected, and finally cleared after that cycle completes.
 *
 * @upstream Called by: executeActions()
 * @downstream Calls: setState()
 *
 * @param {D1Database} db - Database binding
 * @param {Object[]} errors - Array of error objects
 * @param {Object} [meta] - Optional metadata about the execution
 * @param {number} [meta.totalActions] - Total actions that were attempted
 * @param {number} [meta.executedCount] - Number of successful executions
 * @param {string[]} [meta.repairApplied] - JSON repairs that were applied
 *
 * @tests tests/services/action-executor.test.js - storeParseErrors
 *   - Stores JSON in state table
 *   - Limits to MAX_TOOLTIP_ERRORS (5)
 *   - Includes metadata from context
 *   - Handles setState errors gracefully
 */
export async function storeParseErrors(db: D1Database, errors: ParseErrorItem[], meta: FeedbackMeta = {}) {
  try {
    const feedbackData = {
      timestamp: new Date().toISOString(),
      errors: errors.slice(0, MAX_TOOLTIP_ERRORS), // Limit stored errors
      totalErrors: errors.length,
      totalActions: meta.totalActions || 0,
      executedCount: meta.executedCount || 0,
      repairApplied: meta.repairApplied || [],
      shown: false
    };

    await setState(db, FEEDBACK_STATE_KEY, JSON.stringify(feedbackData));
    console.log(`[ActionExecutor] Stored ${errors.length} error(s) for tooltip`);
  } catch (e: unknown) {
    console.error('[ActionExecutor] Failed to store parse errors:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * @description Clear stored parse errors (after successful cycle or after shown).
 *
 * @upstream Called by: executeActions() on success, orchestrator post-cycle cleanup
 * @downstream Calls: setState()
 *
 * @param {D1Database} db - Database binding
 *
 * @tests tests/services/action-executor.test.js - clearParseErrors
 *   - Sets state key to null
 *   - Handles errors gracefully
 */
export async function clearParseErrors(db: D1Database) {
  try {
    await setState(db, FEEDBACK_STATE_KEY, null);
  } catch (e: unknown) {
    console.error('[ActionExecutor] Failed to clear parse errors:', e instanceof Error ? e.message : String(e));
  }
}

/**
 * @description Get stored parse errors for tooltip injection.
 *
 * Returns the error data if present and not yet shown.
 * Used by buildSystemPrompt to inject feedback into context.
 *
 * @upstream Called by: buildSystemPrompt() uncached block
 * @downstream Calls: getState()
 *
 * @param {D1Database} db - Database binding
 * @returns {Promise<Object|null>} Feedback data or null if none/already shown
 *
 * @tests tests/services/action-executor.test.js - getParseErrors
 *   - Returns null when no errors stored
 *   - Returns feedback data when errors exist
 *   - Returns null if already shown
 *   - Parses JSON correctly
 *   - Handles parse errors gracefully
 */
export async function getParseErrors(db: D1Database): Promise<FeedbackStoreData | null> {
  try {
    const raw = await getState(db, FEEDBACK_STATE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw) as FeedbackStoreData;
    if (data.shown) return null; // Already shown, don't show again

    return data;
  } catch (e: unknown) {
    console.error('[ActionExecutor] Failed to get parse errors:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * @description Mark parse errors as shown (so they only appear once).
 *
 * Called after injecting the tooltip into context. The errors
 * will be cleared on the next successful cycle or at end of this cycle.
 *
 * @upstream Called by: buildSystemPrompt() after injection
 * @downstream Calls: getState(), setState()
 *
 * @param {D1Database} db - Database binding
 *
 * @tests tests/services/action-executor.test.js - markParseErrorsShown
 *   - Sets shown flag to true
 *   - Does nothing if no errors stored
 *   - Handles errors gracefully
 */
export async function markParseErrorsShown(db: D1Database) {
  try {
    const raw = await getState(db, FEEDBACK_STATE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw) as FeedbackStoreData;
    data.shown = true;
    await setState(db, FEEDBACK_STATE_KEY, JSON.stringify(data));
  } catch (e: unknown) {
    console.error('[ActionExecutor] Failed to mark errors as shown:', e instanceof Error ? e.message : String(e));
  }
}

// =============================================================================
// TOOLTIP FORMATTING
// =============================================================================

/**
 * @description Format error feedback as a tooltip for Clio's context.
 *
 * Creates a human-readable tooltip that:
 * - Shows success/failure count
 * - Lists specific errors with hints
 * - Notes any auto-repairs that were applied
 * - Is clear that it auto-clears after this response
 *
 * @upstream Called by: buildSystemPrompt() when injecting feedback
 * @downstream Calls: getActionSchema()
 *
 * @param {Object} feedbackData - Data from getParseErrors()
 * @returns {string} Formatted tooltip string
 *
 * @example
 * const tooltip = formatFeedbackTooltip(feedbackData);
 * // Returns:
 * // ════════════════════════════════════════════════════════
 * // ⚠️ ACTION FEEDBACK (auto-clears after this response)
 * // ...
 *
 * @tests tests/services/action-executor.test.js - formatFeedbackTooltip
 *   - Returns empty string for null/undefined input
 *   - Returns empty string for empty errors array
 *   - Formats malformed errors with raw preview
 *   - Formats validation errors with hints
 *   - Formats execution errors
 *   - Formats parse failure errors
 *   - Includes success count when partial success
 *   - Shows repair notes when applied
 *   - Truncates to MAX_TOOLTIP_ERRORS (5)
 *   - Includes action schema examples
 */
export function formatFeedbackTooltip(feedbackData: FeedbackStoreData | null) {
  if (!feedbackData || !feedbackData.errors || feedbackData.errors.length === 0) {
    return '';
  }

  const lines = [];
  lines.push('════════════════════════════════════════════════════════');
  lines.push('⚠️ ACTION FEEDBACK (auto-clears after this response)');
  lines.push('');

  // Summary line
  const { executedCount, totalActions, totalErrors, errors, repairApplied } = feedbackData;
  if (totalActions > 0) {
    lines.push(`Previous response: ${executedCount} of ${totalActions} actions executed successfully.`);
  }

  // Note repairs if any were applied
  if (repairApplied && repairApplied.length > 0) {
    lines.push(`JSON repairs applied: ${repairApplied.join(', ')}`);
  }

  // List failures
  if (errors.length > 0) {
    lines.push('');
    lines.push('FAILED:');

    errors.forEach((err: ParseErrorItem, idx: number) => {
      const num = idx + 1;

      if (err.type === 'malformed') {
        // Malformed JSON from salvage parsing
        const rawPreview = err.raw ? err.raw.substring(0, 80) : '(no content)';
        lines.push(`${num}. [MALFORMED] ${err.error}`);
        lines.push(`   Raw: ${rawPreview}${(err.raw?.length ?? 0) > 80 ? '...' : ''}`);
      } else if (err.type === 'validation') {
        // Validation failure
        const actionName = err.action?.action || 'unknown';
        lines.push(`${num}. [VALIDATION] ${actionName} - ${err.error}`);
        if (err.hint) {
          lines.push(`   Hint: ${err.hint}`);
        }
        // Add example from registry
        const toolDef = getToolDefinition(actionName);
        if (toolDef?.schema?.example) {
          lines.push(`   Example: ${toolDef.schema.example}`);
        }
      } else if (err.type === 'execution') {
        // Execution failure
        const actionName = err.action?.action || 'unknown';
        lines.push(`${num}. [EXECUTION] ${actionName} - ${err.error}`);
      } else if (err.type === 'parse_failure') {
        // Complete parse failure
        lines.push(`${num}. [PARSE FAILURE] ${err.error}`);
        if (err.raw) {
          lines.push(`   Response preview: ${err.raw.substring(0, 80)}...`);
        }
      } else {
        // Unknown error type
        lines.push(`${num}. [ERROR] ${err.error || 'Unknown error'}`);
      }
    });

    // Note if more errors were truncated
    if (totalErrors > MAX_TOOLTIP_ERRORS) {
      lines.push(`   ... and ${totalErrors - MAX_TOOLTIP_ERRORS} more error(s)`);
    }
  }

  // List successes if there were some
  if (executedCount > 0 && totalActions > executedCount) {
    lines.push('');
    lines.push(`SUCCEEDED: ${executedCount} action(s) executed normally`);
  }

  lines.push('════════════════════════════════════════════════════════');
  lines.push('');

  return lines.join('\n');
}

// =============================================================================
// CLEANUP HELPER
// =============================================================================

/**
 * @description Clean up feedback state after a cycle completes.
 *
 * Called at the end of the thinking cycle to clear feedback that was shown.
 * If the feedback wasn't shown yet (edge case), it stays for the next cycle.
 *
 * @upstream Called by: orchestrator post-cycle cleanup (via cycle-adapter)
 * @downstream Calls: getState(), setState()
 *
 * @param {D1Database} db - Database binding
 *
 * @tests tests/services/action-executor.test.js - cleanupFeedback
 *   - Clears feedback if shown flag is true
 *   - Leaves feedback if not yet shown
 *   - Does nothing if no feedback stored
 *   - Handles errors gracefully
 */
export async function cleanupFeedback(db: D1Database) {
  try {
    const raw = await getState(db, FEEDBACK_STATE_KEY);
    if (!raw) return;

    const data = JSON.parse(raw) as FeedbackStoreData;
    if (data.shown) {
      // Feedback was shown, clear it
      await setState(db, FEEDBACK_STATE_KEY, null);
      console.log('[ActionExecutor] Cleared shown feedback');
    }
    // If not shown yet, leave it for next cycle
  } catch (e: unknown) {
    console.error('[ActionExecutor] Failed to cleanup feedback:', e instanceof Error ? e.message : String(e));
  }
}
