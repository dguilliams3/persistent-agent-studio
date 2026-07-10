/**
 * Context Block Types
 *
 * @module @persistence/memory/context/blocks/types
 * @description Type definitions for the 4-block context assembly system.
 *
 * THE 4-BLOCK SYSTEM:
 *
 * Block 1 (CONSTITUTION): Static identity and action definitions
 * - Never changes between cycles
 * - System prompt, cold storage, MY SPACE
 * - Cache TTL: 1 hour
 *
 * Block 2 (PROMOTED): Rarely-changing important summaries
 * - Pinned/promoted summaries
 * - Changes weekly/monthly
 * - Cache TTL: 1 hour
 *
 * Block 3 (STABLE): Observations and summary prefix
 * - Observations about the user
 * - Most summaries (prefix)
 * - Cache TTL: 1 hour (invalidates on OBSERVATION actions)
 *
 * Block 4 (FRESH): Every-cycle dynamic content
 * - Learned, questions, notebook (action-modifiable, uncached)
 * - RAG results, summary tail, history, reminders
 * - Never cached (changes every cycle)
 *
 * @upstream Used by:
 *   - context/blocks/*.ts - Block builder functions
 *   - context/builder/ - Main orchestrator
 * @downstream Calls:
 *   - ../types.ts - Memory data types
 *   - ../../types.ts - Core types
 */

import type {
  HistoryEntry,
  Summary,
  NotebookEntry,
  ObservationEntry,
  ReminderEntry,
  LearnedEntry,
  QuestionEntry,
  ColdStorageEntry,
  UserImage,
  ClaudeArtImage
} from '../types';

// Re-export types needed by block files
export type { HistoryEntry, Summary, UserImage, ClaudeArtImage };

// ============================================================================
// BLOCK CONFIGURATION
// ============================================================================

/**
 * Configuration for a single block's construction.
 */
export interface BlockConfig {
  /** Block number (1-4) */
  blockNumber: 1 | 2 | 3 | 4;

  /** Whether to include this block in output */
  enabled: boolean;

  /** Cache TTL to use ('5min' | '1hr' | 'none') */
  cacheTtl: '5min' | '1hr' | 'none';
}

// ============================================================================
// BLOCK DATA INPUTS
// ============================================================================

/**
 * Data needed to build Block 1 (CONSTITUTION).
 */
export interface Block1Data {
  /** Static system prompt from getStaticSystemPrompt() */
  staticPrompt: string;

  /** Tool prompt block (action definitions) */
  toolPrompt: string;

  /** Cold storage entries */
  coldStorage: ColdStorageEntry[];

  /** Pinned images for MY SPACE */
  pinnedImages: Array<{ slot: number; image_id: number; title: string }>;

  /** Gallery summary */
  gallerySummary: {
    count: number;
    images: Array<{ id: number; title: string }>;
  };
}

/**
 * Data needed to build Block 2 (PROMOTED).
 */
export interface Block2Data {
  /** Promoted/pinned summaries */
  promotedSummaries: Summary[];
}

/**
 * Data needed to build Block 3 (STABLE).
 */
export interface Block3Data {
  /** Observations about the user */
  observations: ObservationEntry[];

  /** Summary prefix (older summaries in cached block) */
  summaryPrefix: Summary[];
}

/**
 * Data needed to build Block 4 (FRESH).
 */
export interface Block4Data {
  /** Learned entries (self-knowledge) */
  learned: LearnedEntry[];

  /** Open questions */
  questions: QuestionEntry[];

  /** Notebook index */
  notebook: NotebookEntry[];

  /** RAG-retrieved memories */
  ragResults: Array<{
    type: 'summary' | 'notebook';
    item: Summary | NotebookEntry;
    scores: { similarity: number };
  }>;

  /** Summary tail (recent summaries not in prefix) */
  summaryTail: Summary[];

  /** Full history (all entries) */
  history: HistoryEntry[];

  /** Active reminders */
  reminders: ReminderEntry[];

  /** Due reminders (subset of reminders) */
  dueReminders: ReminderEntry[];

  /** User's status */
  userStatus: {
    status: string;
    updated: string | null;
    setBy: string | null;
  } | null;

  /** Current loop count */
  loopCount: number;

  /** Current timestamp */
  now: Date;

  /** Time since last message to the user (minutes) */
  timeSinceLastMessage: number | null;

  /** Feedback from previous cycle */
  feedback: string;

  /** Parse error tooltip (one-cycle only) */
  parseErrorTooltip: string;

  /** Summarization reminder (if over threshold) */
  summarizeReminder: string;

  /** Meter values and histories */
  meters: {
    values: Record<string, number>;
    histories: Record<string, number[]>;
    /** Involuntary meters (user-controlled, appear at TOP of meter display) */
    involuntary?: Array<{ config: { label: string; emoji: string; description?: string }; state: { value: number; history: number[] } }>;
  };
}

// ============================================================================
// BLOCK BUILD RESULTS
// ============================================================================

/**
 * Result of building a single block.
 */
export interface BlockResult {
  /** Block number */
  blockNumber: 1 | 2 | 3 | 4;

  /** Assembled text content */
  text: string;

  /** Estimated token count */
  estimatedTokens: number;

  /** Whether this block should be cached */
  cached: boolean;

  /** Cache TTL if cached */
  cacheTtl?: '5min' | '1hr';

  /** Images collected during formatting (blocks 1 & 4 only) */
  images?: {
    userImages: UserImage[];
    claudeArtImages: ClaudeArtImage[];
  };

  /** Metadata about what's included */
  metadata: {
    [key: string]: number | string | boolean;
  };
}

/**
 * Combined result of all 4 blocks.
 */
export interface FourBlockResult {
  /** Block 1: Constitution */
  block1: BlockResult;

  /** Block 2: Promoted summaries */
  block2: BlockResult;

  /** Block 3: Stable context + summary prefix */
  block3: BlockResult;

  /** Block 4: Fresh tail */
  block4: BlockResult;

  /** Combined system prompt (all blocks concatenated) */
  systemPrompt: string;

  /** Total estimated tokens */
  totalTokens: number;

  /** All images from all blocks */
  images: {
    userImages: UserImage[];
    claudeArtImages: ClaudeArtImage[];
  };
}
