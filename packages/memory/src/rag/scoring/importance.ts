/**
 * Importance Score Calculation
 *
 * @module @persistence/memory/rag/scoring/importance
 * @description Log-scaled importance scoring based on content volume.
 *
 * Summaries covering more content (messages, entries) are considered
 * more important. Uses logarithmic scaling to:
 * - Prevent huge summaries from completely dominating
 * - Give meaningful scores to small summaries
 * - Maintain reasonable score distribution
 *
 * SCALING CURVE:
 * ```
 * Score
 *   1.0 ┤                                    ████████████
 *   0.8 ┤                        ████████████
 *   0.6 ┤              ██████████
 *   0.4 ┤      ████████
 *   0.2 ┤  ████
 *   0.1 ┤██ (minimum)
 *       └────────────────────────────────────────────────→ Message Count
 *         0   10    25    50         100        200+
 * ```
 *
 * @upstream Called by: rag/scoring/combined.ts, retrieveRelevantSummaries()
 * @downstream Calls: None (pure math)
 */

import type { ImportanceConfig } from '../types';
import { DEFAULT_IMPORTANCE_CONFIG } from '../types';

/**
 * @description Calculates importance score based on message count.
 *
 * Summaries covering more messages are considered more important.
 * Uses logarithmic scaling to prevent huge summaries from dominating.
 *
 * Formula: score = log(1 + messageCount) / log(1 + maxExpectedCount)
 *
 * @upstream Called by: retrieveRelevantSummaries(), scoring pipeline, combined.ts
 * @downstream Calls: None (pure math)
 *
 * @param {number} messageCount - Number of messages in summary
 * @param {number} [maxExpectedCount] - Expected maximum for normalization (default: 100)
 * @returns {number} Importance score (0.1 minimum, can exceed 1 for very large summaries)
 *
 * @example
 * calculateImportanceScore(0);    // 0.1 (minimum score)
 * calculateImportanceScore(10);   // ~0.52
 * calculateImportanceScore(50);   // ~0.85
 * calculateImportanceScore(100);  // ~1.0
 * calculateImportanceScore(200);  // ~1.15 (can exceed 1)
 *
 * @note The score can exceed 1.0 for very large summaries. This is intentional
 * to give them extra weight, but the combined scoring weights will normalize.
 */
export function calculateImportanceScore(
  messageCount: number,
  maxExpectedCount: number = DEFAULT_IMPORTANCE_CONFIG.maxExpectedCount
): number {
  if (!messageCount || messageCount <= 0) {
    return DEFAULT_IMPORTANCE_CONFIG.minimumScore;
  }

  return Math.log(1 + messageCount) / Math.log(1 + maxExpectedCount);
}

/**
 * @description Calculates importance score with config object.
 *
 * Alternative API accepting a config object instead of individual parameters.
 *
 * @upstream Called by: Retrieval pipelines with config-based setup
 * @downstream Calls: None (pure math)
 *
 * @param {number} messageCount - Number of messages in summary
 * @param {ImportanceConfig} [config] - Importance configuration
 * @returns {number} Importance score
 *
 * @example
 * const config: ImportanceConfig = { maxExpectedCount: 50, minimumScore: 0.05 };
 * const score = calculateImportanceScoreWithConfig(25, config);
 */
export function calculateImportanceScoreWithConfig(
  messageCount: number,
  config: ImportanceConfig = DEFAULT_IMPORTANCE_CONFIG
): number {
  if (!messageCount || messageCount <= 0) {
    return config.minimumScore;
  }

  return Math.log(1 + messageCount) / Math.log(1 + config.maxExpectedCount);
}

/**
 * @description Estimates message count needed to reach a target score.
 *
 * Inverse of calculateImportanceScore. Useful for threshold planning.
 *
 * @upstream Called by: Planning, threshold analysis
 * @downstream Calls: None (pure math)
 *
 * @param {number} targetScore - Target importance score
 * @param {number} [maxExpectedCount] - Expected maximum for normalization
 * @returns {number} Message count needed (rounded up)
 *
 * @example
 * messagesForScore(0.5);  // ~9 messages
 * messagesForScore(0.8);  // ~39 messages
 * messagesForScore(1.0);  // ~100 messages (maxExpectedCount)
 */
export function messagesForScore(
  targetScore: number,
  maxExpectedCount: number = DEFAULT_IMPORTANCE_CONFIG.maxExpectedCount
): number {
  // Solve: targetScore = log(1 + count) / log(1 + max)
  // targetScore * log(1 + max) = log(1 + count)
  // e^(targetScore * log(1 + max)) = 1 + count
  // count = e^(targetScore * log(1 + max)) - 1
  const count = Math.exp(targetScore * Math.log(1 + maxExpectedCount)) - 1;
  return Math.ceil(count);
}
