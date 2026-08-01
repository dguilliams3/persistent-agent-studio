/**
 * Agent Loop Module
 *
 * @module @persistence/runtime/loop
 * @description Agent thinking cycle and guards.
 *
 * @upstream Called by: apps/worker (scheduled handler)
 * @downstream Calls: @persistence/db, @persistence/llm, @persistence/tools
 */

export {
  checkIntervalGuard,
  checkSleepGuard,
  checkBatchGuard,
  checkRunningGuard,
  runAllGuards,
  getSleepState,
} from './guards';

// =============================================================================
// PLACEHOLDER EXPORTS
// =============================================================================
// The main cycle logic (~900 lines) is still in worker/src/index.js:2518-3430
// These stubs will be filled in as we decouple from the worker.
// =============================================================================

/**
 * @todo Migrate from worker/src/index.js:
 * - runThinkingCycle() - Main agent loop (lines 2518-3430)
 * - executeActions() - Action execution dispatch
 * - recordCycleMetrics() - Telemetry recording
 */

export const LOOP_MIGRATION_STATUS = {
  migrated: ['guards'],
  pending: [
    'cycle',       // runThinkingCycle() - main loop
    'executor',    // Action execution dispatch
    'telemetry',   // Metric recording, cost tracking
  ],
} as const;
