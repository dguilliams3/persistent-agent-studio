/**
 * Context Builder Types
 *
 * @module @persistence/memory/context/builder/types
 * @description Type definitions for the context builder orchestrator.
 *
 * The context builder transforms raw memory data (ContextData) into formatted
 * system prompt blocks using platform-provided formatters. These types define:
 *
 * - **ContextBuilderConfig**: Runtime configuration (boundaries, cache settings, timestamps)
 * - **ContextFormatters**: Platform-specific formatter functions
 * - **BuilderResult**: Output with formatted blocks and boundary updates
 *
 * DESIGN PRINCIPLES:
 * - Pure orchestration - no I/O in the builder itself
 * - Dependency injection - formatters passed in, not imported
 * - Boundary updates returned - platform persists them
 *
 * @upstream Used by:
 *   - context/builder/build-context.ts - Main orchestrator
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - Consumer
 * @downstream Calls:
 *   - ../cache/types.ts - CacheConfig, boundary result types
 *   - ../blocks/types.ts - BlockResult
 *   - ../../types.ts - HistoryId, SummaryId, Summary, HistoryEntry
 */

import type {
  HistoryId,
  SummaryId,
  Summary,
  HistoryEntry
} from '../../types';
import type {
  UserImage,
  ClaudeArtImage,
  NotebookEntry
} from '../types';
import type {
  CacheConfig,
  HistoryBoundaryResult,
  SummaryBoundaryResult
} from '../types';
import type { BlockResult } from '../blocks/types';

// ============================================================================
// BUILDER CONFIGURATION
// ============================================================================

/**
 * Configuration for the context builder.
 *
 * Provides runtime context and boundary state. The platform layer loads these
 * values from the database/environment before calling buildContext().
 *
 * @example
 * const config: ContextBuilderConfig = {
 *   historyBoundaryId: await getState('history_prefix_boundary_id'),
 *   summaryBoundaryId: await getState('summary_prefix_boundary_id'),
 *   cache: {
 *     useVolatileCaching: true,
 *     cycleIntervalSeconds: 60,
 *     ttl: '5min',
 *     historyTailTokenThreshold: 12000,
 *     historyTailTokenTarget: 6000,
 *     minHistoryTailEntries: 5,
 *     summaryTailTokenThreshold: 8000,
 *     summaryTailTokenTarget: 4000,
 *     minSummaryTailSummaries: 2,
 *     summaryPrefixSize: 5
 *   },
 *   now: new Date(),
 *   loopCount: 1234,
 *   timeSinceLastMessage: 15
 * };
 */
export interface ContextBuilderConfig {
  /** Current history boundary ID (from state table, null if not initialized) */
  historyBoundaryId: HistoryId | null;

  /** Current summary boundary ID (from state table, null if not initialized) */
  summaryBoundaryId: SummaryId | null;

  /** Cache configuration (thresholds, TTLs) */
  cache: CacheConfig;

  /** Current timestamp */
  now: Date;

  /** Current loop count */
  loopCount: number;

  /** Minutes since last message to the user (null if never messaged) */
  timeSinceLastMessage: number | null;

  /** Formatted feedback from previous cycle (optional) */
  feedback?: string;

  /** One-cycle parse error tooltip (optional) */
  parseErrorTooltip?: string;

  /** Summarization reminder if over threshold (optional) */
  summarizeReminder?: string;
}

// ============================================================================
// PLATFORM FORMATTERS
// ============================================================================

/**
 * Platform-provided formatter functions.
 *
 * These are passed in so the builder stays pure (no platform-specific imports).
 * The platform layer implements these based on its utilities (formatEasternDateTime, etc.).
 *
 * @example
 * const formatters: ContextFormatters = {
 *   formatDateTime: formatEasternDateTime,
 *   formatSummary: formatSummaryForContext,
 *   formatHistory: (entries, opts) => formatHistorySection(entries, opts),
 *   formatMeters: formatMetersSection
 * };
 */
export interface ContextFormatters {
  /**
   * Format a Date for display.
   *
   * @param date - Date to format
   * @param timezone - Timezone to use (default: 'America/New_York')
   * @returns Formatted string (e.g., "Jan 27, 2026 10:30 AM EST")
   */
  formatDateTime: (date: Date, timezone?: string) => string;

  /**
   * Format a summary for context display.
   *
   * @param summary - Summary to format
   * @param index - 1-based index for display (null for no numbering)
   * @param timezone - Timezone for timestamps (default: 'America/New_York')
   * @returns Formatted summary string with timestamp and content
   */
  formatSummary: (summary: Summary, index: number | null, timezone?: string) => string;

  /**
   * Format history entries, collecting images for vision API.
   *
   * @param entries - History entries to format
   * @param options - Formatting options (recentImageThreshold for image collection)
   * @returns Object with formatted text and extracted images
   */
  formatHistory: (
    entries: HistoryEntry[],
    options: { recentImageThreshold: number }
  ) => {
    text: string;
    userImages: UserImage[];
    claudeArtImages: ClaudeArtImage[];
  };

  /**
   * Format internal state meters section.
   *
   * @param values - Current meter values (e.g., { A: 7, C: 5, ... })
   * @param histories - Recent history for each meter (last 5 cycles)
   * @param involuntary - Optional involuntary meters (user-controlled, appear at TOP)
   * @returns Formatted meters display with visual bars
   */
  formatMeters: (
    values: Record<string, number>,
    histories: Record<string, number[]>,
    involuntary?: Array<{ config: { label: string; emoji: string; description?: string }; state: { value: number; history: number[] } }>
  ) => string;
}

// ============================================================================
// BUILDER RESULT
// ============================================================================

/**
 * Result of building context (Blocks 2, 3, 4).
 *
 * Block 1 (Constitution) is handled by the platform layer separately since it
 * includes platform-specific static content (system prompt template, tool definitions).
 *
 * The platform uses this result to:
 * 1. Assemble the final system prompt (blocks 2-4, plus block 1)
 * 2. Pass images to the vision API
 * 3. Persist boundary updates if shifted
 * 4. Log metadata for debugging
 *
 * @example
 * const result = buildContext(data, formatters, config);
 *
 * // Use for API call
 * const systemPrompt = block1Text + result.systemPrompt;
 * const images = [...result.images.userImages, ...result.images.claudeArtImages];
 *
 * // Persist boundary updates
 * if (result.boundaryUpdates.history.shifted) {
 *   await setState('history_prefix_boundary_id', result.boundaryUpdates.history.boundaryId);
 * }
 * if (result.boundaryUpdates.summary.shifted) {
 *   await setState('summary_prefix_boundary_id', result.boundaryUpdates.summary.boundaryId);
 * }
 */
export interface BuilderResult {
  /** Block 2: Promoted summaries */
  block2: BlockResult;

  /** Block 3: Stable context + summary prefix */
  block3: BlockResult;

  /** Block 4: Fresh tail */
  block4: BlockResult;

  /** Combined system prompt (blocks 2-4 joined with double newlines) */
  systemPrompt: string;

  /** Total estimated tokens across all blocks */
  totalTokens: number;

  /** Collected images from Block 4 for vision API */
  images: {
    userImages: UserImage[];
    claudeArtImages: ClaudeArtImage[];
  };

  /** Boundary updates for platform to persist (if shifted) */
  boundaryUpdates: {
    history: HistoryBoundaryResult;
    summary: SummaryBoundaryResult;
  };

  /** Metadata for logging/stats */
  metadata: {
    historyCount: number;
    summariesCount: number;
    promotedSummariesCount: number;
    /** Block 3 pinned count (tier 3, user manually froze) */
    pinnedSummariesCount: number;
    /** Block 3 auto-rolled count (tier 4, boundary moved to prefix) */
    autoRolledSummariesCount: number;
    /** Block 4 tail count (tier 4, after boundary) */
    tailSummariesCount: number;
    learnedCount: number;
    questionsCount: number;
    notebookCount: number;
    observationsCount: number;
    remindersCount: number;
    ragRetrievedCount: number;
  };
}
