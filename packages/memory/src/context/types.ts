/**
 * Context Assembly Types
 *
 * @module @persistence/memory/context/types
 * @description Type definitions for context assembly and formatting.
 *
 * Context assembly transforms raw memory data into Claude's system prompt.
 * These types define the interfaces for that transformation:
 *
 * - **FormatOptions**: Common options for all formatters
 * - **FormattedSection**: Result of formatting any context section
 * - **ContextData**: All data needed to build a context
 * - **ContextResult**: Final assembled context blocks
 *
 * @upstream Used by:
 *   - context/formatters/ - All formatters use these base types
 *   - context/builder/ - Uses ContextData and ContextResult
 * @downstream Calls:
 *   - No dependencies (pure type definitions)
 */

import type {
  HistoryEntry,
  HistoryId,
  Summary,
  SummaryId,
  ISOTimestamp
} from '../types';

// Re-export memory types needed by context modules
export type { HistoryEntry, Summary };

// Re-export strict DB types for context assembly
// These are the canonical types - no loose duplicates
import type {
  LearnedEntry as DbLearnedEntry,
  LearnedConfidence,
  QuestionEntry as DbQuestionEntry,
  QuestionStatus,
  QuestionDomain,
  ReminderEntry as DbReminderEntry,
  ReminderCondition,
  ColdStorageEntry as DbColdStorageEntry,
  InvoluntaryMeterDisplay,
} from '@persistence/db';

// Re-export the strict types for consumers
export type { LearnedConfidence, QuestionStatus, QuestionDomain, ReminderCondition, InvoluntaryMeterDisplay };

// ============================================================================
// FORMATTING OPTIONS
// ============================================================================

/**
 * Common options for formatting context sections.
 */
export interface FormatOptions {
  /** Maximum total characters for the section (truncate if exceeded) */
  maxLength?: number;

  /** Whether to include timestamps in output (default true) */
  includeTimestamps?: boolean;

  /** Indentation level for nested content */
  indentLevel?: number;

  /** Timezone for timestamp formatting (default 'America/New_York') */
  timezone?: string;
}

/**
 * Result of formatting a section for context.
 */
export interface FormattedSection {
  /** The formatted text content */
  content: string;

  /** Estimated token count (chars / 4) */
  tokenEstimate: number;

  /** Number of entries included in this section */
  entryCount: number;
}

// ============================================================================
// MEMORY DATA TYPES (for formatters)
// ============================================================================

/**
 * A notebook entry for context display.
 */
export interface NotebookEntry {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string | null;
  last_viewed_at: string | null;
}

/**
 * An observation about the user for context display.
 */
export interface ObservationEntry {
  id: number;
  title: string;
  content: string;
  summary: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * A reminder entry for context display.
 * Uses strict types from @persistence/db.
 */
export interface ReminderEntry extends Omit<DbReminderEntry, 'dismissed_at'> {
  // Display doesn't need dismissed_at - only active reminders are shown
}

/**
 * A learned entry (self-knowledge) for context display.
 * Uses strict types from @persistence/db.
 */
export interface LearnedEntry extends Omit<DbLearnedEntry, 'updated_at' | 'promoted_to_cold_storage_at'> {
  // Display doesn't need update/promotion timestamps
}

/**
 * A question entry (open threads) for context display.
 * Uses strict types from @persistence/db.
 */
export interface QuestionEntry extends Omit<DbQuestionEntry, 'updated_at' | 'resolved_into'> {
  // Display doesn't need resolved_into (shown separately if resolved)
}

/**
 * A cold storage entry for context display.
 * Uses strict types from @persistence/db.
 */
export interface ColdStorageEntry extends DbColdStorageEntry {
  // Alias for DB type - cold storage is always shown in full
}

// ============================================================================
// IMAGE COLLECTIONS
// ============================================================================

/**
 * @deprecated These types are now defined in @persistence/media.
 * Re-exported here for backwards compatibility.
 */
import type { UserImage, ClaudeArtImage } from '@persistence/media';
export type { UserImage, ClaudeArtImage } from '@persistence/media';

// ============================================================================
// CONTEXT DATA (input to builder)
// ============================================================================

/**
 * All data needed to build a context.
 *
 * This is what the platform layer provides after loading from DB.
 * The context builder transforms this into formatted blocks.
 */
export interface ContextData {
  /** Raw history entries */
  history: HistoryEntry[];

  /** Compressed summaries */
  summaries: Summary[];

  /** Promoted summaries (pinned to cache) */
  promotedSummaries: Summary[];

  /** Permanent memories */
  coldStorage: ColdStorageEntry[];

  /** Notebook entries */
  notebook: NotebookEntry[];

  /** Observations about the user */
  observations: ObservationEntry[];

  /** Verified self-knowledge */
  learned: LearnedEntry[];

  /** Open questions being held */
  questions: QuestionEntry[];

  /** Active reminders */
  reminders: ReminderEntry[];

  /** Reminders that are currently due */
  dueReminders: ReminderEntry[];

  /** RAG-retrieved summaries/memories */
  ragResults: RagRetrievedMemory[];

  /** User's current status */
  userStatus: UserStatus | null;

  /** Current persona identity */
  persona: PersonaInfo | null;

  /**
   * Internal state meters.
   *
   * These track Clio's internal experience (Aliveness, Curiosity, etc.)
   * and are displayed in Block 4 but not visible to the user.
   *
   * Two types of meters:
   * - Core meters: Clio can SET these (Aliveness, Curiosity, etc.)
   * - Involuntary meters: user-controlled, Clio can only READ (appear mysteriously at top)
   */
  meters?: {
    /** Current meter values (e.g., { A: 7, C: 5, N: 6, E: 8, D: 4, X: 3, Y: 5 }) */
    values: Record<string, number>;
    /** Recent history for each meter (last 5 cycles) */
    histories: Record<string, number[]>;
    /** Involuntary meters (user-controlled, Clio reads only) - appear at TOP of meter display */
    involuntary?: InvoluntaryMeterDisplay[];
  };
}

/**
 * User's availability status.
 */
export interface UserStatus {
  status: string;
  updated: string | null;
  setBy: string | null;
}

/**
 * Active persona information.
 */
export interface PersonaInfo {
  id: number;
  name: string;
  systemPromptTemplate: string | null;
}

/**
 * A RAG-retrieved memory for context.
 */
export interface RagRetrievedMemory {
  type: 'summary' | 'notebook';
  item: Summary | NotebookEntry;
  scores: {
    similarity: number;
    recency: number;
    importance: number;
    final: number;
  };
}

// ============================================================================
// CONTEXT RESULT (output from builder)
// ============================================================================

/**
 * Result of building the full context.
 *
 * Contains the 4-block structure for optimal caching:
 * - Block 1: Constitution (static, 1hr cache)
 * - Block 2: Promoted summaries (rarely changes)
 * - Block 3: Stable content (observations, summary prefix)
 * - Block 4: Fresh tail (learned, questions, notebook, history, reminders)
 */
export interface ContextResult {
  /** Block 1: Constitution + tool prompts */
  block1_constitution: string;

  /** Block 1 extensions: Cold storage + MY SPACE (rarely changes) */
  block1Extensions: string;

  /** Block 2: Promoted summaries */
  block2_promotedSummaries: string;

  /** Block 3: Stable content (observations, summary prefix) */
  block3_stableAndSummaries: string;

  /** Block 4: Fresh tail (learned, questions, notebook, RAG, summary tail, history, reminders) */
  block4_freshTail: string;

  /** Legacy: Combined prompt for backwards compatibility */
  systemPrompt: string;

  /** Image collections for vision API */
  userImages: UserImage[];
  claudeArtImages: ClaudeArtImage[];

  /** Counts for logging */
  historyCount: number;
  summariesCount: number;
  remindersCount: number;
  coldStorageCount: number;
  learnedCount: number;
  questionsCount: number;
  notebookCount: number;
  observationsCount: number;
  ragRetrievedCount: number;

  /** Active memory branch */
  activeBranch: string;
}

// ============================================================================
// SUMMARY SPLIT TYPES (collapsed from stats/types.ts)
// ============================================================================

/**
 * Result of splitting summaries by tier and boundary.
 *
 * Used by both the context builder (for block assembly) and
 * the stats API (for token/count reporting).
 */
export interface SummarySplitResult {
  /** Tier 3 summaries - user manually pinned, always in Block 3 */
  pinned: Summary[];

  /** Tier 4 summaries at or before boundary - system auto-rolled to prefix */
  autoRolled: Summary[];

  /** Tier 4 summaries after boundary - dynamic tail, uncached */
  tail: Summary[];

  /** Combined prefix: pinned + autoRolled (for Block 3) */
  prefix: Summary[];

  /** Stats for reporting */
  stats: SummarySplitStats;
}

/**
 * Token and count statistics for each category.
 */
export interface SummarySplitStats {
  pinnedCount: number;
  pinnedTokens: number;
  autoRolledCount: number;
  autoRolledTokens: number;
  tailCount: number;
  tailTokens: number;
  /** Total non-promoted summaries */
  totalCount: number;
  totalTokens: number;
}

/**
 * Options for the split function.
 */
export interface SplitSummariesOptions {
  /** IDs of promoted summaries to exclude (they go in Block 2) */
  promotedIds?: Set<SummaryId>;

  /** Boundary ID - summaries at or before this ID are "auto-rolled" */
  boundaryId?: SummaryId | null;

  /** Custom token estimator (default: chars/4) */
  estimateTokens?: (text: string) => number;
}

// ============================================================================
// CACHE BOUNDARY TYPES (collapsed from cache/types.ts)
// ============================================================================

/**
 * Configuration for cache behavior and boundaries.
 */
export interface CacheConfig {
  useVolatileCaching: boolean;
  cycleIntervalSeconds: number;
  ttl: '5min' | '1hr';
  historyTailTokenThreshold: number;
  historyTailTokenTarget: number;
  minHistoryTailEntries: number;
  summaryTailTokenThreshold: number;
  summaryTailTokenTarget: number;
  minSummaryTailSummaries: number;
  summaryPrefixSize: number;
}

/**
 * Current state of cache boundaries.
 */
export interface CacheBoundaryState {
  historyPrefixBoundaryId: HistoryId | null;
  summaryPrefixBoundaryId: SummaryId | null;
  historyTailTokenCount: number;
  summaryTailTokenCount: number;
}

/**
 * Result of history boundary calculation.
 */
export interface HistoryBoundaryResult {
  boundaryId: HistoryId | null;
  boundaryIndex: number;
  tailTokenCount: number;
  shifted: boolean;
  logMessage: string;
}

/**
 * Result of summary boundary calculation.
 */
export interface SummaryBoundaryResult {
  boundaryId: SummaryId | null;
  boundaryIndex: number;
  tailTokenCount: number;
  movedCount: number;
  shifted: boolean;
  logMessage: string;
}
