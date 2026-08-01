/**
 * Batch API database operations (Platform Re-export)
 *
 * @module db/batches
 * @description MIGRATION NOTE: Implementation moved to packages/llm/src/batches.ts
 *
 * This file re-exports all batch state management functions from the @persistence/llm package.
 * The package handles D1 database operations for tracking Anthropic Batch API submissions.
 *
 * @see packages/llm/src/batches.ts - Source of truth
 *
 * @upstream Called by:
 *   - services/batch-processor.js (polling loop)
 *   - Telegram /batch, /cancel commands
 *   - API endpoints (/batches, /batch-timeout)
 * @downstream Calls:
 *   - @persistence/llm/batches
 */

// Use workspace package - relative paths don't resolve correctly with wrangler bundling
export {
  // Constants
  BATCH_WINDOW,
  BATCH_HARD_TIMEOUT_SECONDS,
  // Timeout configuration
  getBatchTimeout,
  setBatchTimeout,
  getBatchHardTimeout,
  setBatchHardTimeout,
  // CRUD operations
  listPendingBatches,
  storePendingBatch,
  getPendingBatches,
  updatePendingBatch,
  // Timing checks
  isInBatchWindow,
  isUserRecentlyActive,
  // Cancellation
  cancelBatch,
} from '@persistence/llm';
