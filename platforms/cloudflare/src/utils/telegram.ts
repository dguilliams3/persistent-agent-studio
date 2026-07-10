/**
 * Telegram-specific utility helpers
 *
 * @module utils/telegram
 * @description Shared helpers for Telegram streaming and summary behavior.
 *
 * @upstream Called by: telegram/commands/operations.js, index.js (legacy /think)
 * @downstream Calls: getState() for telegram_streaming state
 */

import { getState } from '../db/index.js';

/**
 * Read the configured Telegram chat id while preserving compatibility with
 * legacy staged data that still uses the old operator-specific state key.
 *
 * Upstream: `platforms/cloudflare/src/tools/post-processors.ts::telegramPostProcessor`
 * Upstream: `platforms/cloudflare/src/services/cycle-adapter.ts::createPlatformCallbacks`
 * Upstream: `platforms/cloudflare/src/services/batch-processor.ts::processPendingBatches`
 * Upstream: `platforms/cloudflare/src/services/web-digest-runner.ts::runWebDigests`
 * Do NOT: Reintroduce hardcoded operator-specific state keys at call sites.
 */
export async function getTelegramChatId(db: D1Database): Promise<string | null> {
  return (await getState(db, 'telegram_chat_id')) ?? null;
}

/**
 * @description Check if Telegram action summary should be skipped
 * because streaming already sent it.
 *
 * @param {D1Database} db - Database connection
 * @returns {Promise<boolean>} true if should skip (streaming is on)
 */
export async function shouldSkipTelegramSummary(db: D1Database): Promise<boolean> {
  const streamEnabled = await getState(db, 'telegram_streaming');
  return streamEnabled === 'true';
}
