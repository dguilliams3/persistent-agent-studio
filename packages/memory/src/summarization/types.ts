/**
 * Summarization Types
 *
 * @module @persistence/memory/summarization/types
 * @description Type definitions for the summarization subsystem.
 *
 * This module defines the interfaces and types used throughout the summarization
 * process, from raw history entries through parsed LLM responses to final summary
 * storage.
 *
 * TYPE HIERARCHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Core Types (imported from ../types.ts)                                 │
 * │  ─────────────────────────────────────────────────────────────────────  │
 * │  HistoryEntry          - Raw entry from history table                   │
 * │  Summary               - Full summary with nested metadata              │
 * │  SummaryMetadata       - Rich metadata (tags, themes, etc.)             │
 * │  SummaryTier           - 'cached' | 'tail' | 'archived'                 │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Processing Types (defined here)                                        │
 * │  ─────────────────────────────────────────────────────────────────────  │
 * │  FormattedEntry        - Entry formatted for LLM prompt                 │
 * │  PromptContext         - All data needed to build a prompt              │
 * │  ParsedResponse        - Structured data extracted from LLM output      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *                                    ↓
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  Output Types (defined here)                                            │
 * │  ─────────────────────────────────────────────────────────────────────  │
 * │  SummaryResult         - Result of summarizeHistory()                   │
 * │  BatchSummaryResult    - Result of batchSummarizeHistory()              │
 * │  MetaSummaryResult     - Result of metaSummarize()                      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * DESIGN PRINCIPLES:
 * - Core types are imported from ../types.ts (single source of truth)
 * - Processing types are internal to the summarization module
 * - Output types are what callers (handlers, routes) receive
 * - All types are serializable (no functions, no circular refs)
 *
 * @upstream Used by: All summarize/* modules
 * @downstream Uses: ../types.ts for core type definitions
 */

// ============================================================================
// RE-EXPORTS FROM CORE TYPES
// ============================================================================

// Import core types for internal use
import type {
  HistoryEntry,
  HistoryType,
  HistoryId,
  Summary,
  SummaryId,
  SummaryMetadata,
  SummaryTier,
  SummarySourceType,
  MetaSummary,
  PersonaId,
  CycleId,
  ISOTimestamp,
} from '../types';

// Re-export for consumers
export type {
  HistoryEntry,
  HistoryType,
  HistoryId,
  Summary,
  SummaryId,
  SummaryMetadata,
  SummaryTier,
  SummarySourceType,
  MetaSummary,
  PersonaId,
  CycleId,
  ISOTimestamp,
};

export {
  HISTORY_TYPE_ICONS,
  TIER_SORT_ORDER,
  DEFAULT_METADATA,
  isHistoryType,
  isMetaSummary,
  isValidTransition,
  getSummaryLifecycleState,
} from '../types';

/**
 * Runtime configuration for summarization, loaded from state table.
 *
 * All values have defaults in constants.js, but can be overridden per-persona
 * via /summarize-settings endpoint or Telegram commands.
 */
export interface SummarizationConfig {
  /** Maximum tokens for summary LLM response */
  summaryMaxTokens: number;

  /** Minimum entries required to trigger summarization */
  minSummarizeCount: number;

  /** Maximum entries to process in one summarization */
  maxSummarizeCount: number;

  /** Minimum acceptable summary length (chars) - prevents data loss */
  minSummaryLength: number;

  /** Provider for summarization LLM calls ('anthropic' | 'openai') */
  provider: string;

  /** Model ID for summarization */
  model: string;

  /** Custom system prompt (null = use default) */
  systemPrompt: string | null;

  /** Custom instructions (null = use default) */
  instructions: string | null;
}

/**
 * Configuration for meta-summarization.
 */
export interface MetaSummarizationConfig {
  /** Maximum tokens for meta-summary LLM response */
  metaSummaryMaxTokens: number;

  /** Reasoning effort for meta-summarization ('none' | 'low' | 'medium' | 'high') */
  reasoningEffort: 'none' | 'low' | 'medium' | 'high';

  /** Provider for meta-summarization (may differ from regular summarization) */
  provider: string;

  /** Model for meta-summarization */
  model: string;

  /** Custom meta system prompt (null = use default) */
  metaSystemPrompt: string | null;

  /** Custom meta instructions (null = use default) */
  metaInstructions: string | null;
}

// ============================================================================
// PROCESSING TYPES - Internal to summarization module
// ============================================================================

/**
 * History entry formatted for inclusion in LLM prompt.
 *
 * Base64 images are replaced with [IMAGE] placeholder.
 * Content is truncated if too long.
 * ID tag is prepended for tracking.
 */
export interface FormattedEntry {
  /** Original entry ID (for tracking which were included) */
  id: number;

  /** Formatted string for prompt: "[ID:42] 💭 Jan 15 10:30 - Pondering..." */
  formatted: string;

  /** Approximate token count for this entry */
  estimatedTokens: number;
}

/**
 * All context needed to build a summarization prompt.
 */
export interface PromptContext {
  /** Formatted entries text block */
  entriesText: string;

  /** Human-readable time range */
  timeRange: string;

  /** Number of entries being summarized */
  entryCount: number;

  /** Optional focus notes from Claude */
  claudeNotes: string | null;

  /** System prompt to use */
  systemPrompt: string;

  /** Instructions to include in user prompt */
  instructions: string;

  /** Set of valid entry IDs (for response validation) */
  validIds: Set<number>;
}

// Note: SummaryMetadata is imported from ../types.ts
// The Partial<SummaryMetadata> allows for partial metadata during parsing

/**
 * Parsed response from summarization LLM call.
 *
 * The parser handles multiple formats:
 * - JSON with summary + included_ids + metadata
 * - Legacy format with INCLUDED_IDS: line
 * - Plain text (fallback)
 */
export interface ParsedSummaryResponse {
  /** Extracted summary text */
  summary: string;

  /** IDs of entries that were included in summary */
  includedIds: number[];

  /** Extracted metadata (may be partial) */
  metadata: Partial<SummaryMetadata>;

  /** Format that was detected ('json' | 'legacy' | 'plain') */
  format: 'json' | 'legacy' | 'plain';

  /** Any parsing warnings/errors (non-fatal) */
  errors: string[];
}

/**
 * Parsed response from meta-summarization (Claude-driven mode).
 */
export interface ParsedMetaResponse {
  /** Indices of summaries to consolidate */
  indices: number[];

  /** Why these summaries belong together */
  rationale: string;

  /** The consolidated summary (if provided in same call) */
  consolidatedSummary: string | null;

  /** Extracted metadata */
  metadata: Partial<SummaryMetadata>;

  /** Any parsing errors */
  errors: string[];
}

// ============================================================================
// OUTPUT TYPES - Returned to callers
// ============================================================================

/**
 * Result of summarizeHistory() operation.
 */
export interface SummaryResult {
  /** Whether summarization succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Number of entries that were summarized and deleted */
  count?: number;

  /** Starting index (usually 0 for oldest) */
  start?: number;

  /** The generated summary text */
  summary?: string;

  /** IDs of entries that were included */
  includedIds?: number[];

  /** Extracted metadata */
  metadata?: Partial<SummaryMetadata>;

  /** How many entries were offered to LLM */
  entriesOffered?: number;

  /** How many entries were actually included */
  entriesIncluded?: number;

  /** Processing duration in milliseconds */
  durationMs?: number;

  /** Provider used for LLM call */
  provider?: string;

  /** Model used for LLM call */
  model?: string;

  /** Time range covered */
  timeRange?: string;

  /** Response format detected */
  responseFormat?: 'json' | 'legacy' | 'plain';

  /** Debug info if error occurred */
  debug?: Record<string, unknown>;

  /** Step where failure occurred (for debugging) */
  failedAtStep?: string;

  /** Number of entries preserved (if aborted to prevent data loss) */
  preserved?: number;
}

/**
 * Result of metaSummarize() operation.
 */
export interface MetaSummaryResult {
  /** Whether meta-summarization succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Number of summaries consolidated */
  count?: number;

  /** Indices of summaries that were consolidated */
  indices?: number[];

  /** The generated meta-summary text */
  summary?: string;

  /** Extracted metadata */
  metadata?: Partial<SummaryMetadata>;

  /** Why these summaries were grouped */
  rationale?: string;

  /** Mode: 'claude_driven' or 'manual_override' */
  mode?: 'claude_driven' | 'manual_override';

  /** ID of the new consolidated summary */
  newSummaryId?: number;

  /** IDs of summaries that were archived */
  archivedIds?: number[];

  /** Number of summaries before consolidation */
  summariesBefore?: number;

  /** Number of summaries consolidated */
  summariesConsolidated?: number;

  /** Number of summaries remaining after */
  summariesRemaining?: number;

  /** Total message count from consolidated summaries */
  totalMessagesConsolidated?: number;

  /** Processing duration in milliseconds */
  durationMs?: number;

  /** Provider used */
  provider?: string;

  /** Model used */
  model?: string;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Options for the response parser.
 */
export interface ParserOptions {
  /** Set of valid IDs for validation */
  validIds?: Set<number>;

  /** Fallback IDs if none parsed from response */
  fallbackIds?: number[];

  /** Field name for summary in JSON ('summary' or 'consolidated_summary') */
  summaryField?: 'summary' | 'consolidated_summary';
}

/**
 * Validation result for entries before summarization.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Error message if validation failed */
  error?: string;

  /** Warnings that don't block summarization */
  warnings: string[];
}

// ============================================================================
// PROMPT TYPES (collapsed from prompts/types.ts)
// ============================================================================

/**
 * Default prompts that can be overridden via state table.
 */
export interface DefaultPrompts {
  /** System prompt for history summarization */
  summarize_system: string;
  /** Instructions included in history summarization user prompt */
  summarize_instructions: string;
  /** System prompt for meta-summarization */
  meta_system: string;
  /** Instructions included in meta-summarization user prompt */
  meta_instructions: string;
  /** System prompt for batch summarization */
  batch_system: string;
  /** Instructions included in batch summarization user prompt */
  batch_instructions: string;
}

/**
 * Context for building history summarization prompt.
 */
export interface HistoryPromptContext {
  /** Formatted entries text block (with [ID:N] tags) */
  entriesText: string;
  /** Human-readable time range */
  timeRange: string;
  /** Number of entries being summarized */
  entryCount: number;
  /** Optional focus notes from Claude */
  claudeNotes?: string;
  /** Instructions to include (custom or default) */
  instructions: string;
}

/**
 * Context for building batch summarization prompt.
 */
export interface BatchPromptContext {
  /** Formatted entries text block */
  entriesText: string;
  /** Human-readable time range */
  timeRange: string;
  /** Total number of entries being analyzed */
  entryCount: number;
  /** Maximum number of summaries to create */
  maxSummaries: number;
  /** Minimum entries required per summary */
  minEntriesPerSummary: number;
  /** Optional focus notes */
  claudeNotes?: string;
}

/**
 * Context for building meta-summarization selection prompt.
 */
export interface MetaSelectionPromptContext {
  /** Formatted summaries for Claude to analyze */
  summariesText: string;
  /** Number of summaries available */
  summaryCount: number;
  /** Optional focus notes */
  claudeNotes?: string;
  /** Instructions for consolidation */
  instructions: string;
}

/**
 * Context for building meta-summarization consolidation prompt.
 */
export interface MetaConsolidationPromptContext {
  /** Formatted summaries to consolidate */
  summariesText: string;
  /** Number of summaries being consolidated */
  summaryCount: number;
  /** Optional focus notes */
  claudeNotes?: string;
  /** Instructions for consolidation */
  instructions: string;
}

/**
 * Built prompt ready for LLM call.
 */
export interface BuiltPrompt {
  /** System message for the LLM */
  system: string;
  /** User message content */
  user: string;
}
