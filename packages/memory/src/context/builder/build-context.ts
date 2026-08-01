/**
 * Context Builder Orchestrator
 *
 * @module @persistence/memory/context/builder/build-context
 * @description Builds Blocks 2, 3, 4 from ContextData.
 *
 * This is a PURE FUNCTION - no database calls, no env access.
 * All I/O is handled by the platform layer before calling this.
 *
 * THE BUILD PIPELINE:
 * 1. Calculate cache boundaries (stable prefix/tail splits)
 * 2. Split summaries by boundary (prefix goes to Block 3, tail to Block 4)
 * 3. Build Block 2 (promoted summaries)
 * 4. Build Block 3 (stable context + summary prefix)
 * 5. Build Block 4 (fresh tail: RAG, summary tail, history, reminders)
 * 6. Combine blocks and return with boundary updates
 *
 * DEPENDENCY INJECTION:
 * Formatters are passed in rather than imported, making this:
 * - Testable (mock formatters in tests)
 * - Platform-agnostic (same logic for Cloudflare, Node, etc.)
 * - Pure (no side effects, deterministic output)
 *
 * @upstream Used by:
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - Main consumer
 * @downstream Calls:
 *   - cache/boundary.ts - calculateHistoryBoundary, calculateSummaryBoundary
 *   - stats/split-summaries.ts - splitSummariesByTierAndBoundary
 *   - blocks/block2.ts - buildBlock2
 *   - blocks/block3.ts - buildBlock3
 *   - blocks/block4.ts - buildBlock4
 */

import type { Summary } from '../../types';
import type { ContextData, NotebookEntry } from '../types';
import type { ContextBuilderConfig, ContextFormatters, BuilderResult } from './types';
import type { Block2Data, Block3Data, Block4Data } from '../blocks/types';

import { calculateHistoryBoundary, calculateSummaryBoundary } from '../cache';
import { buildBlock2, buildBlock3, buildBlock4 } from '../blocks';
import { splitSummariesByTierAndBoundary } from '../stats';

/**
 * Build context blocks 2, 3, 4.
 *
 * Pure orchestrator that transforms ContextData into formatted blocks.
 * Platform layer is responsible for:
 * - Loading data from DB → ContextData
 * - Providing formatters → ContextFormatters
 * - Providing config → ContextBuilderConfig
 * - Persisting boundary updates from result
 * - Combining with Block 1 for final prompt
 *
 * @description Orchestrates context assembly from memory data into cache-optimized blocks
 * @upstream Called by: platforms/cloudflare/src/prompts/build-system-prompt.js
 * @downstream Calls: calculateHistoryBoundary, calculateSummaryBoundary, buildBlock2/3/4
 *
 * @param {ContextData} data - All memory data from platform (history, summaries, notebook, etc.)
 * @param {ContextFormatters} formatters - Platform-specific formatters
 * @param {ContextBuilderConfig} config - Runtime configuration (boundaries, cache, timestamps)
 * @returns {BuilderResult} Blocks, combined prompt, images, boundary updates, and metadata
 *
 * @example
 * import { buildContext } from '@persistence/memory/context/builder';
 *
 * // Platform loads data
 * const data = await loadContextData(db, personaId);
 *
 * // Platform provides formatters
 * const formatters = {
 *   formatDateTime: formatEasternDateTime,
 *   formatSummary: formatSummaryForContext,
 *   formatHistory: formatHistorySection,
 *   formatMeters: formatMetersSection
 * };
 *
 * // Platform provides config
 * const config = {
 *   historyBoundaryId: await getState('history_prefix_boundary_id'),
 *   summaryBoundaryId: await getState('summary_prefix_boundary_id'),
 *   cache: getCacheConfig(),
 *   now: new Date(),
 *   loopCount: await getLoopCount(),
 *   timeSinceLastMessage: await getTimeSinceLastMessage()
 * };
 *
 * // Build context (pure)
 * const result = buildContext(data, formatters, config);
 *
 * // Use result
 * const fullPrompt = block1 + '\n\n' + result.systemPrompt;
 * const images = [...result.images.userImages, ...result.images.claudeArtImages];
 *
 * // Persist boundary updates
 * if (result.boundaryUpdates.history.shifted) {
 *   await setState('history_prefix_boundary_id', result.boundaryUpdates.history.boundaryId);
 * }
 */
export function buildContext(
  data: ContextData,
  formatters: ContextFormatters,
  config: ContextBuilderConfig
): BuilderResult {
  // ========================================================================
  // 1. CALCULATE BOUNDARIES (pure functions, no I/O)
  // ========================================================================

  const historyBoundary = calculateHistoryBoundary(
    data.history,
    config.historyBoundaryId,
    config.cache
  );

  const summaryBoundary = calculateSummaryBoundary(
    data.summaries,
    config.summaryBoundaryId,
    config.cache
  );

  // ========================================================================
  // 2. SPLIT SUMMARIES BY TIER AND BOUNDARY (DRY: uses shared function)
  // ========================================================================

  const promotedIds = new Set(data.promotedSummaries.map(s => s.id));
  const splitResult = splitSummariesByTierAndBoundary(data.summaries, {
    promotedIds,
    boundaryId: summaryBoundary.boundaryId
  });

  // Extract for block assembly
  const { prefix: summaryPrefix, tail: summaryTail, pinned: pinnedSummaries, autoRolled: autoRolledSummaries } = splitResult;

  // ========================================================================
  // 3. PREPARE BLOCK DATA STRUCTURES
  // ========================================================================

  const block2Data: Block2Data = {
    promotedSummaries: data.promotedSummaries
  };

  const block3Data: Block3Data = {
    observations: data.observations,
    summaryPrefix
  };

  // Default meters if not provided
  const meters = data.meters || { values: {}, histories: {} };

  const block4Data: Block4Data = {
    learned: data.learned,
    questions: data.questions,
    notebook: data.notebook,
    ragResults: data.ragResults.map(r => ({
      type: r.type,
      item: r.item as Summary | NotebookEntry,
      scores: { similarity: r.scores.similarity }
    })),
    summaryTail,
    history: data.history,
    reminders: data.reminders,
    dueReminders: data.dueReminders || [],
    userStatus: data.userStatus,
    loopCount: config.loopCount,
    now: config.now,
    timeSinceLastMessage: config.timeSinceLastMessage,
    feedback: config.feedback || '',
    parseErrorTooltip: config.parseErrorTooltip || '',
    summarizeReminder: config.summarizeReminder || '',
    meters
  };

  // ========================================================================
  // 4. BUILD BLOCKS (pure formatting)
  // ========================================================================

  const block2 = buildBlock2(block2Data, formatters.formatDateTime);

  const block3 = buildBlock3(
    block3Data,
    formatters.formatSummary,
    formatters.formatDateTime
  );

  const block4 = buildBlock4(
    block4Data,
    formatters.formatHistory,
    formatters.formatSummary,
    formatters.formatDateTime,
    formatters.formatMeters
  );

  // ========================================================================
  // 5. COMBINE AND RETURN
  // ========================================================================

  // Join non-empty blocks with double newlines
  const systemPrompt = [block2.text, block3.text, block4.text]
    .filter(Boolean)
    .join('\n\n');

  const totalTokens = block2.estimatedTokens + block3.estimatedTokens + block4.estimatedTokens;

  // Aggregate images from Block 4 (other blocks don't have images)
  const images = block4.images || { userImages: [], claudeArtImages: [] };

  return {
    block2,
    block3,
    block4,
    systemPrompt,
    totalTokens,
    images,
    boundaryUpdates: {
      history: historyBoundary,
      summary: summaryBoundary
    },
    metadata: {
      historyCount: data.history.length,
      summariesCount: summaryPrefix.length + summaryTail.length,
      promotedSummariesCount: data.promotedSummaries.length,
      // Block 3 breakdown: pinned (tier 3, manual) vs auto-rolled (tier 4, boundary)
      pinnedSummariesCount: pinnedSummaries.length,
      autoRolledSummariesCount: autoRolledSummaries.length,
      // Block 4: actual tail (tier 4, after boundary)
      tailSummariesCount: summaryTail.length,
      learnedCount: data.learned.length,
      questionsCount: data.questions.length,
      notebookCount: data.notebook.length,
      observationsCount: data.observations.length,
      remindersCount: data.reminders.length,
      ragRetrievedCount: data.ragResults.length
    }
  };
}
