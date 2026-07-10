/**
 * Summary tier configuration service
 *
 * Provides DRY helpers shared by REST endpoints and Telegram commands for
 * inspecting and updating the rolling window configuration plus live stats.
 *
 * @module services/summary-config
 * @downstream Calls: @persistence/memory/context/stats (splitSummariesByTierAndBoundary)
 */

import { SUMMARY_BUFFER_CONFIG } from '../constants.js';
import { getState, setState, getActiveSummaries } from '../db/index.js';
import { splitSummariesByTierAndBoundary } from '@persistence/memory';

type SummaryLike = {
  id?: unknown;
  tier?: number;
  token_count?: unknown;
  summary?: unknown;
};

type SummaryConfigUpdates = {
  tailTokenThreshold?: number | string;
  tailTokenTarget?: number | string;
};

type SummaryConfigView = {
  promotedCount?: number;
  promotedTokens?: number;
  block3?: {
    pinnedCount: number;
    pinnedTokens: number;
    autoRolledCount: number;
    autoRolledTokens: number;
    totalCount: number;
    totalTokens: number;
  };
  block4?: {
    tailCount: number;
    tailTokens: number;
  };
  boundary?: {
    id: number | null;
    dynamicSummariesCount: number;
  };
  cachedCount?: number;
  cachedTokens?: number;
  tailCount?: number;
  tailTokens?: number;
  tailTokenThreshold?: number;
  tailTokenTarget?: number;
  rollProgress?: number;
  contextSize?: number;
  bufferSize?: number;
  totalActiveSummaries?: number;
};

/**
 * Parse a value from state (string) into an integer with fallback.
 *
 * @param {string|number|undefined|null} value - Stored value
 * @param {number} fallback - Fallback when value invalid
 * @returns {number}
 */
function parseConfigNumber(value: string | number | undefined | null, fallback: number) {
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

/**
 * Prefer stored token_count, otherwise estimate tokens from string length.
 *
 * @param {Object} summary - Summary row
 * @returns {number}
 */
function getTokenCount(summary: SummaryLike): number {
  if (summary?.token_count) {
    const stored = parseInt(String(summary.token_count), 10);
    if (!Number.isNaN(stored)) {
      return stored;
    }
  }
  const textLength = typeof summary?.summary === 'string' ? summary.summary.length : 0;
  return Math.ceil(textLength / 4);
}

/**
 * @description Get summary tier configuration with live stats (v25 tier-based model)
 *
 * Uses explicit `tier` field from summaries table instead of boundary derivation.
 * Three tiers: 'cached' (frozen), 'tail' (dynamic), 'archived' (RAG only).
 *
 * @upstream Called by: GET /summary-config, /tierconfig telegram command
 * @downstream Calls: getState(), getActiveSummaries(), splitSummariesByTierAndBoundary()
 *
 * @param {D1Database} db - Database instance
 * @returns {Promise<Object>} Configuration and live statistics
 *
 * @tests tests/services/summary-config.test.js - "getSummaryConfig"
 */
export async function getSummaryConfig(db: D1Database) {
  const tailTokenThreshold = parseConfigNumber(
    await getState(db, 'tail_token_threshold'),
    SUMMARY_BUFFER_CONFIG.tailTokenThreshold
  );
  const tailTokenTarget = parseConfigNumber(
    await getState(db, 'tail_token_target'),
    SUMMARY_BUFFER_CONFIG.tailTokenTarget
  );
  const contextSize = parseConfigNumber(
    await getState(db, 'summary_context_size'),
    SUMMARY_BUFFER_CONFIG.contextSize
  );
  const bufferSize = parseConfigNumber(
    await getState(db, 'summary_buffer_size'),
    SUMMARY_BUFFER_CONFIG.bufferSize
  );

  // Get boundary state for auto-rolled vs tail split
  const boundaryIdStr = await getState(db, 'summary_prefix_boundary_id');
  const boundaryId = boundaryIdStr ? parseInt(boundaryIdStr, 10) : null;

  const allSummaries = await getActiveSummaries(db) as unknown as SummaryLike[];

  // Filter promoted (tier 2) - they go in Block 2
  const promotedSummaries = allSummaries.filter((s) => s.tier === 2);
  const promotedIds = new Set(promotedSummaries.map((s) => s.id)) as Set<any>;
  const promotedTokens = promotedSummaries.reduce(
    (sum, summary) => sum + getTokenCount(summary),
    0
  );

  // Use shared split function from packages/memory (DRY)
  // This is the SINGLE SOURCE OF TRUTH for tier/boundary categorization
  const splitResult = splitSummariesByTierAndBoundary(allSummaries as any, {
    promotedIds,
    boundaryId: boundaryId as any
  });

  // Extract stats from split result (SINGLE SOURCE OF TRUTH)
  const { stats, autoRolled, tail } = splitResult;
  const dynamicSummariesCount = autoRolled.length + tail.length;

  // Calculate block 3 totals from split stats
  const block3Count = stats.pinnedCount + stats.autoRolledCount;
  const block3Tokens = stats.pinnedTokens + stats.autoRolledTokens;

  return {
    // Block 2 (Promoted) - always cached
    promotedCount: promotedSummaries.length,
    promotedTokens,

    // Block 3 breakdown - cached summaries (from split stats)
    block3: {
      pinnedCount: stats.pinnedCount,
      pinnedTokens: stats.pinnedTokens,
      autoRolledCount: stats.autoRolledCount,
      autoRolledTokens: stats.autoRolledTokens,
      totalCount: block3Count,
      totalTokens: block3Tokens
    },

    // Block 4 - dynamic tail (uncached)
    block4: {
      tailCount: stats.tailCount,
      tailTokens: stats.tailTokens
    },

    // Boundary state
    boundary: {
      id: boundaryId,
      dynamicSummariesCount
    },

    // Legacy fields (for backward compatibility)
    cachedCount: block3Count,
    cachedTokens: block3Tokens,
    tailCount: stats.tailCount,
    tailTokens: stats.tailTokens,

    // Thresholds
    tailTokenThreshold,
    tailTokenTarget,
    contextSize,
    bufferSize,
    totalActiveSummaries: allSummaries.length,
    rollProgress: tailTokenThreshold > 0
      ? Math.round((stats.tailTokens / tailTokenThreshold) * 100)
      : 0
  };
}

/**
 * @description Update summary tier thresholds
 *
 * @param {D1Database} db - Database instance
 * @param {Object} updates - Values to update
 * @param {number} [updates.tailTokenThreshold] - New roll threshold
 * @param {number} [updates.tailTokenTarget] - New target after roll
 * @returns {Promise<{success: boolean, updated?: string[], error?: string}>}
 */
export async function updateSummaryConfig(
  db: D1Database,
  updates: SummaryConfigUpdates = {}
): Promise<{ success: boolean; updated?: string[]; error?: string }> {
  const updateList: string[] = [];

  if (updates.tailTokenThreshold !== undefined) {
    const value = parseInt(String(updates.tailTokenThreshold), 10);
    if (Number.isNaN(value) || value < 1000) {
      return { success: false, error: 'tailTokenThreshold must be >= 1000' };
    }
    await setState(db, 'tail_token_threshold', String(value));
    updateList.push(`threshold=${value}`);
  }

  if (updates.tailTokenTarget !== undefined) {
    const value = parseInt(String(updates.tailTokenTarget), 10);
    if (Number.isNaN(value) || value < 500) {
      return { success: false, error: 'tailTokenTarget must be >= 500' };
    }
    await setState(db, 'tail_token_target', String(value));
    updateList.push(`target=${value}`);
  }

  return { success: true, updated: updateList };
}

/**
 * @description Format config for Telegram display
 *
 * @param {Object} config - Config from getSummaryConfig()
 * @returns {string} Formatted Telegram message
 */
export function formatConfigForTelegram(config: SummaryConfigView): string {
  const rollWarning = (config.rollProgress ?? 0) >= 80 ? ' �s��,? Roll soon!' : '';
  const cachedTokens = config.cachedTokens ?? 0;
  const tailTokens = config.tailTokens ?? 0;

  return `dY"S **Summary Tier Config**

dYS **Frozen Cache:** ${config.cachedCount} summaries (~${cachedTokens.toLocaleString()} tok)
dY"? **Dynamic Tail:** ${config.tailCount} summaries (~${tailTokens.toLocaleString()} tok)

�sT�,? **Thresholds:**
�?� Roll at: ${(config.tailTokenThreshold ?? 0).toLocaleString()} tokens
�?� Target after: ${(config.tailTokenTarget ?? 0).toLocaleString()} tokens
�?� Progress: ${config.rollProgress ?? 0}%${rollWarning}

dY"< **Limits:**
�?� Context size: ${config.contextSize} summaries
�?� Buffer size: ${config.bufferSize} summaries
�?� Total active: ${config.totalActiveSummaries} summaries`;
}
