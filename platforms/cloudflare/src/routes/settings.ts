/**
 * Settings routes (platform re-export)
 *
 * @module routes/settings
 * @description Re-exports settings handler functions from @persistence/db/handlers/settings.
 * Batch status handlers are wrapped to inject @persistence/llm dependencies
 * (the db package cannot depend on llm — DAG violation).
 *
 * @upstream Called by: routes/index.ts, routes/registry.ts
 * @downstream Delegates to: @persistence/db/handlers/settings
 */

import {
  getPendingBatches,
  isInBatchWindow,
  isUserRecentlyActive,
} from '@persistence/llm';

export {
  handleGetUserStatus,
  handleSetUserStatus,
  handleGetDiscordEnabled,
  handleSetDiscordEnabled,
  handleSetBatchEnabled,
  handleGetMaxTokens,
  handleSetMaxTokens,
  handleGetStreaming,
  handleSetStreaming,
  handleGetSleepStatus,
  handleDeleteSleepStatus,
  handleSetInterval,
  handleGetSummarizeSettings,
  handleSetSummarizeSettings,
  handleSetAutoSummarize,
  handleGetSummarizePrompts,
  handleSetSummarizePrompts,
  handleStart,
  handleStop,
  handleGetRagConfig,
  handleSetRagConfig,
  getRagConfig,
  DEFAULT_PROMPTS,
} from '@persistence/db/handlers/settings';

import {
  handleGetBatchStatus as _handleGetBatchStatus,
  handleGetBatchEnabled as _handleGetBatchEnabled,
} from '@persistence/db/handlers/settings';

/**
 * Platform wrapper: injects @persistence/llm batch dependencies.
 */
export async function handleGetBatchStatus(db: D1Database) {
  return _handleGetBatchStatus(db, {
    getPendingBatches,
    isInBatchWindow,
    isUserRecentlyActive,
  });
}

/**
 * Platform wrapper: injects isInBatchWindow from @persistence/llm.
 */
export async function handleGetBatchEnabled(db: D1Database) {
  return _handleGetBatchEnabled(db, isInBatchWindow);
}
