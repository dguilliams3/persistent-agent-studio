/**
 * History Logging Utilities (Platform Re-export)
 *
 * @module utils/history-logger
 * @description Re-exports history logging utilities from @persistence/db package.
 *
 * The @persistence/db package now auto-captures meter snapshots in logHistory(),
 * so this wrapper is no longer needed for that purpose. This file remains as a
 * convenience barrel for backward compatibility.
 *
 * MIGRATION NOTE (2026-01-28):
 * Previously this wrapper existed to auto-inject meter snapshots. That logic
 * has been moved into @persistence/db/history-logger.ts. This file is now a
 * simple re-export and can be removed once all imports are updated.
 *
 * @upstream Called by: All history logging throughout the worker
 * @downstream Re-exports from @persistence/db/history-logger
 */

// Use workspace package - relative paths don't resolve correctly with wrangler bundling
export {
  HISTORY_TYPES,
  EMBEDDABLE_TYPES,
  EMBEDDING_EXCLUDED_TYPES,
  logHistory,
  logHistoryBatch,
  logOperationResult
} from '@persistence/db';

/**
 * Barrel export for backward compatibility with default imports
 */
import {
  HISTORY_TYPES,
  EMBEDDABLE_TYPES,
  EMBEDDING_EXCLUDED_TYPES,
  logHistory,
  logHistoryBatch,
  logOperationResult
} from '@persistence/db';

export default {
  HISTORY_TYPES,
  EMBEDDABLE_TYPES,
  EMBEDDING_EXCLUDED_TYPES,
  logHistory,
  logHistoryBatch,
  logOperationResult
};
