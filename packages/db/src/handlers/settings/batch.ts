/**
 * Batch mode handler functions
 *
 * @module @persistence/db/handlers/settings/batch
 * @description Handler functions for batch mode status and configuration.
 * Batch dependencies are injected from the platform layer to avoid DAG violation
 * (packages/db must not import from @persistence/llm).
 *
 * @upstream Called by: platforms/cloudflare/src/routes/settings.ts (wraps with llm deps)
 * @downstream Calls: @persistence/db state functions
 */

import type { DrizzleD1 } from '../../client';

import {
  getState,
  setState,
} from '../../index';


type SettingsBody = Record<string, unknown>;

/**
 * Formats a timestamp as relative time (e.g., "5m ago", "2h ago").
 * Pure utility inlined to avoid platform dependency.
 */
function formatRelativeTime(timestamp: string | Date): string {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? new Date(timestamp + 'Z') : timestamp;
  const now = new Date();
  const differenceMilliseconds = now.getTime() - date.getTime();
  const differenceMinutes = Math.floor(differenceMilliseconds / 60000);
  const differenceHours = Math.floor(differenceMilliseconds / 3600000);
  const differenceDays = Math.floor(differenceMilliseconds / 86400000);

  if (differenceMinutes < 1) return 'just now';
  if (differenceMinutes < 60) return `${differenceMinutes}m ago`;
  if (differenceHours < 24) return `${differenceHours}h ago`;
  if (differenceDays < 7) return `${differenceDays}d ago`;
  return date.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
}

/**
 * Minimal batch record shape for formatting (mirrors PendingBatch from @persistence/llm).
 * Defined locally to avoid DAG violation (packages/db must not import from @persistence/llm).
 */
interface PendingBatchRecord {
  duration_seconds: number;
  submitted_at: string;
  [key: string]: unknown;
}

/**
 * Batch status dependencies injected from platform to avoid DAG violation.
 * packages/db must not import from @persistence/llm.
 */
interface BatchDependencies {
  getPendingBatches: (db: DrizzleD1) => Promise<PendingBatchRecord[]>;
  isInBatchWindow: (db: DrizzleD1) => Promise<boolean>;
  isUserRecentlyActive: (db: DrizzleD1) => Promise<boolean>;
}

export async function handleGetBatchStatus(db: DrizzleD1, dependencies: BatchDependencies) {
  const batchEnabled = await getState(db, 'batch_enabled');
  const batchUntil = await getState(db, 'batch_until');
  const pendingBatches = await dependencies.getPendingBatches(db);
  const inBatchWindow = await dependencies.isInBatchWindow(db);
  const userActive = await dependencies.isUserRecentlyActive(db);

  const formattedBatches = pendingBatches.map((batch) => ({
    ...batch,
    duration: batch.duration_seconds ? `${Math.floor(batch.duration_seconds / 60)}m ${batch.duration_seconds % 60}s` : 'N/A',
    createdAgo: formatRelativeTime(batch.submitted_at)
  }));

  return {
    enabled: batchEnabled === 'true',
    inBatchWindow,
    willBatch: inBatchWindow && !userActive,
    userActivityOverride: userActive,
    batchUntil: batchUntil || null,
    pendingBatches: formattedBatches
  };
}

export async function handleGetBatchEnabled(db: DrizzleD1, isInBatchWindow: (db: DrizzleD1) => Promise<boolean>) {
  const enabled = await getState(db, 'batch_enabled');
  const batchUntil = await getState(db, 'batch_until');
  const inBatchWindow = await isInBatchWindow(db);
  return {
    enabled: enabled === 'true',
    inBatchWindow,
    batchUntil: batchUntil || null,
    autoExpires: !!batchUntil
  };
}

export async function handleSetBatchEnabled(db: DrizzleD1, body: SettingsBody) {
  const enabled = body.enabled as boolean | undefined;
  const hours = body.hours as number | undefined;
  await setState(db, 'batch_enabled', enabled ? 'true' : 'false');

  if (enabled && hours) {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000);
    await setState(db, 'batch_until', until.toISOString());
    return { success: true, enabled: true, batchUntil: until.toISOString() };
  } else {
    await setState(db, 'batch_until', null);
    return { success: true, enabled };
  }
}
