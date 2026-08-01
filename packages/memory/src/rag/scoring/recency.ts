/**
 * Recency Score Calculation
 *
 * @module @persistence/memory/rag/scoring/recency
 * @description Exponential decay scoring based on age.
 *
 * Recent memories are more likely to be relevant to current context.
 * This module implements exponential decay where:
 * - Today's memories score ~1.0
 * - Memories decay by 50% every halflife period
 * - Very old memories approach 0 but never quite reach it
 *
 * DECAY CURVE:
 * ```
 * Score
 *   1.0 ┤███████████████████████████████████████████████
 *   0.8 ┤                    ██
 *   0.6 ┤                           ██
 *   0.5 ┤- - - - - - - - - - - - - - - - ██ - - - - - - (1 halflife)
 *   0.4 ┤                                    ██
 *   0.25┤- - - - - - - - - - - - - - - - - - - - - ██ - (2 halflives)
 *   0.1 ┤                                            ████
 *       └────────────────────────────────────────────────→ Days
 * ```
 *
 * @upstream Called by: rag/scoring/combined.ts, retrieveRelevantSummaries()
 * @downstream Calls: None (pure math)
 */

import type { RecencyConfig } from '../types';
import { DEFAULT_RECENCY_CONFIG } from '../types';

/**
 * @description Calculates recency decay score using exponential decay.
 *
 * Score decays by 50% every halflifeDays. Recent items score ~1.0,
 * old items approach 0.
 *
 * Formula: score = e^(-ln(2) * daysSinceCreation / halflifeDays)
 *
 * @upstream Called by: retrieveRelevantSummaries(), scoring pipeline, combined.ts
 * @downstream Calls: None (pure math)
 *
 * @param {string|Date} createdAt - ISO timestamp of item creation
 * @param {number} [halflifeDays] - Days for score to decay by 50% (default: 14)
 * @returns {number} Recency score (0-1)
 *
 * @example
 * // If today is 2026-01-15 and halflife is 14 days:
 * calculateRecencyScore('2026-01-15T00:00:00Z', 14); // ~1.0 (today)
 * calculateRecencyScore('2026-01-01T00:00:00Z', 14); // ~0.5 (14 days ago)
 * calculateRecencyScore('2025-12-18T00:00:00Z', 14); // ~0.25 (28 days ago)
 *
 * @note The function uses Date.now() for current time. In tests,
 * you may want to mock Date.now() for deterministic results.
 */
export function calculateRecencyScore(
  createdAt: string | Date,
  halflifeDays: number = DEFAULT_RECENCY_CONFIG.halflifeDays
): number {
  const now = Date.now();
  const created = createdAt instanceof Date
    ? createdAt.getTime()
    : new Date(createdAt).getTime();

  const daysSince = (now - created) / (1000 * 60 * 60 * 24);

  // Exponential decay: e^(-ln(2) * days / halflife)
  // When daysSince = halflife, score = e^(-ln(2)) = 0.5
  return Math.exp(-Math.LN2 * daysSince / halflifeDays);
}

/**
 * @description Calculates recency score with config object.
 *
 * Alternative API accepting a config object instead of individual parameters.
 *
 * @upstream Called by: Retrieval pipelines with config-based setup
 * @downstream Calls: calculateRecencyScore()
 *
 * @param {string|Date} createdAt - ISO timestamp of item creation
 * @param {RecencyConfig} [config] - Recency configuration
 * @returns {number} Recency score (0-1)
 *
 * @example
 * const config: RecencyConfig = { halflifeDays: 7 };
 * const score = calculateRecencyScoreWithConfig('2026-01-15T00:00:00Z', config);
 */
export function calculateRecencyScoreWithConfig(
  createdAt: string | Date,
  config: RecencyConfig = DEFAULT_RECENCY_CONFIG
): number {
  return calculateRecencyScore(createdAt, config.halflifeDays);
}

/**
 * @description Estimates how many days until score drops below threshold.
 *
 * Useful for cache management or TTL calculations.
 *
 * @upstream Called by: Cache TTL planning, expiration calculations
 * @downstream Calls: None (pure math)
 *
 * @param {number} threshold - Target score threshold (e.g., 0.1)
 * @param {number} [halflifeDays] - Halflife in days
 * @returns {number} Days until score drops below threshold
 *
 * @example
 * // How many days until score drops below 0.1?
 * daysUntilThreshold(0.1, 14); // ~46.5 days
 */
export function daysUntilThreshold(
  threshold: number,
  halflifeDays: number = DEFAULT_RECENCY_CONFIG.halflifeDays
): number {
  // Solve: threshold = e^(-ln(2) * days / halflife)
  // ln(threshold) = -ln(2) * days / halflife
  // days = -halflife * ln(threshold) / ln(2)
  return -halflifeDays * Math.log(threshold) / Math.LN2;
}
