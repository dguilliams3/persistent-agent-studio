/**
 * Context Assembly
 *
 * @module @persistence/memory/context
 * @description Barrel export for context assembly functionality.
 *
 * Context assembly transforms raw memory data into Claude's system prompt.
 * This module provides:
 *
 * - **Formatters**: Transform individual data types into text sections
 * - **Blocks**: Build the 4-block cache-optimized structure
 * - **Cache**: Manage boundary tracking for cache efficiency
 * - **Builder**: Orchestrate the full context assembly
 *
 * USAGE:
 * ```typescript
 * import { context } from '@persistence/memory';
 *
 * // Format individual sections
 * const historyResult = context.formatHistorySection(entries, { recentImageThreshold: 10 });
 * const notebookText = context.formatNotebookSection(notebookEntries);
 * const summaryText = context.formatSummaryForContext(summary, 1);
 *
 * // Calculate cache boundaries
 * const historyBoundary = context.calculateHistoryBoundary(history, boundaryId, config);
 * const summaryBoundary = context.calculateSummaryBoundary(summaries, boundaryId, config);
 *
 * // Build blocks
 * const block2 = context.buildBlock2({ promotedSummaries }, formatDateTime);
 * const block3 = context.buildBlock3(data, formatSummary, formatDateTime);
 * const block4 = context.buildBlock4(data, formatHistory, formatSummary, formatDateTime, formatMeters);
 * ```
 *
 * MIGRATION STATUS:
 * - [x] formatters/ - Pure string formatting (complete)
 * - [x] blocks/ - Block builders (complete)
 * - [x] cache/ - Boundary management (complete)
 * - [x] builder/ - Main orchestrator (complete)
 *
 * @upstream Used by:
 *   - @persistence/memory/index.ts - Package barrel
 *   - platforms/cloudflare/src/prompts/build-system-prompt.js - During migration
 * @downstream Aggregates:
 *   - context/formatters/
 *   - context/cache/
 *   - context/blocks/
 *   - context/types.ts
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Format options
  FormatOptions,
  FormattedSection,

  // Memory data types
  NotebookEntry,
  ObservationEntry,
  ReminderEntry,
  LearnedEntry,
  QuestionEntry,
  ColdStorageEntry,

  // Image types
  UserImage,
  ClaudeArtImage,

  // Context assembly types
  ContextData,
  ContextResult,
  UserStatus,
  PersonaInfo,
  RagRetrievedMemory
} from './types';

// ============================================================================
// FORMATTERS
// ============================================================================

export * from './formatters';

// ============================================================================
// CACHE
// ============================================================================

export * from './cache';

// ============================================================================
// BLOCKS
// ============================================================================

export * from './blocks';

// ============================================================================
// BUILDER
// ============================================================================

export * from './builder';

// ============================================================================
// STATS
// ============================================================================

export * from './stats';
