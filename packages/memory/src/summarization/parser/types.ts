/**
 * Parser Types for Summarization
 *
 * @module @persistence/tools/definitions/summarize/parser/types
 * @description Type definitions for parsing LLM responses from summarization calls.
 *
 * The parser handles multiple response formats because LLMs don't always follow
 * the requested JSON schema exactly. The formats, in order of preference:
 *
 * 1. **JSON Format** (preferred): Clean JSON with all fields
 *    ```json
 *    {
 *      "summary": "...",
 *      "included_ids": [1, 2, 3],
 *      "metadata": { "themes": [...], ... }
 *    }
 *    ```
 *
 * 2. **Legacy Format**: Plain text with INCLUDED_IDS line
 *    ```
 *    This is the summary text...
 *
 *    INCLUDED_IDS: 1, 2, 3
 *    ```
 *
 * 3. **Plain Text Format** (fallback): Just summary text, IDs inferred
 *
 * @upstream Used by: parser/parse-history.ts, parser/parse-meta.ts
 * @downstream Defined here, no dependencies
 */

import type { SummaryMetadata } from '../types';

// ============================================================================
// FORMAT DETECTION
// ============================================================================

/**
 * Detected response format.
 *
 * Used by parser to report what format was detected, enabling
 * callers to track format success rates and adjust prompts.
 */
export type ResponseFormat = 'json' | 'legacy' | 'plain';

/**
 * Result of format detection.
 */
export interface FormatDetectionResult {
  /** Detected format type */
  format: ResponseFormat;

  /** Confidence level (0-1) */
  confidence: number;

  /** If JSON detected, the parsed object (may be partial) */
  jsonObject?: Record<string, unknown>;

  /** Any warnings during detection */
  warnings: string[];
}

// ============================================================================
// PARSE RESULTS
// ============================================================================

/**
 * Parsed response from history summarization LLM call.
 *
 * The parser extracts these fields from whatever format the LLM returned.
 * All fields except `summary` may be partial or missing.
 *
 * @example
 * ```typescript
 * const result = parseHistorySummaryResponse(llmOutput, { validIds: new Set([1,2,3]) });
 * if (result.errors.length > 0) {
 *   console.warn('Parse issues:', result.errors);
 * }
 * console.log('Summary:', result.summary);
 * console.log('Included:', result.includedIds);
 * ```
 */
export interface ParsedHistoryResponse {
  /** Extracted summary text (always present, may be entire response if parsing failed) */
  summary: string;

  /** IDs of entries that were included in summary */
  includedIds: number[];

  /** Extracted metadata (may be partial) */
  metadata: Partial<SummaryMetadata>;

  /** Format that was detected */
  format: ResponseFormat;

  /** Any parsing warnings/errors (non-fatal) */
  errors: string[];

  /** Raw response for debugging */
  raw?: string;
}

/**
 * Parsed response from batch summarization LLM call.
 *
 * Batch mode creates MULTIPLE summaries, so this contains an array.
 */
export interface ParsedBatchResponse {
  /** Array of parsed summaries with their themes */
  summaries: Array<{
    /** Theme or title for this summary grouping */
    theme: string;

    /** The summary text */
    summary: string;

    /** IDs of entries included in this summary */
    includedIds: number[];

    /** Optional metadata for this summary */
    metadata?: Partial<SummaryMetadata>;
  }>;

  /** IDs explicitly skipped by LLM (not fitting any theme) */
  skippedIds: number[];

  /** Reason for skipping (if provided by LLM) */
  skippedReason: string | null;

  /** Format that was detected */
  format: ResponseFormat;

  /** Any parsing errors */
  errors: string[];
}

/**
 * Parsed response from meta-summarization (summary consolidation).
 *
 * Meta-summarization can work in two phases:
 * 1. Selection: Claude picks which summaries to consolidate
 * 2. Consolidation: Claude merges selected summaries
 *
 * Or in one phase where both happen together.
 */
export interface ParsedMetaResponse {
  /** Indices of summaries to consolidate (0-based) */
  indices: number[];

  /** Why these summaries belong together */
  rationale: string;

  /** The consolidated summary (if provided in same call) */
  consolidatedSummary: string | null;

  /** Extracted metadata for the consolidated summary */
  metadata: Partial<SummaryMetadata>;

  /** Format that was detected */
  format: ResponseFormat;

  /** Any parsing errors */
  errors: string[];
}

// ============================================================================
// PARSER OPTIONS
// ============================================================================

/**
 * Options for the history summary parser.
 */
export interface HistoryParserOptions {
  /** Set of valid IDs for validation (parser will filter out invalid IDs) */
  validIds?: Set<number>;

  /** Fallback IDs if none parsed from response */
  fallbackIds?: number[];

  /** Include raw response in result for debugging */
  includeRaw?: boolean;
}

/**
 * Options for the batch summary parser.
 */
export interface BatchParserOptions {
  /** Set of valid IDs for validation */
  validIds?: Set<number>;

  /** Maximum number of summaries expected */
  maxSummaries?: number;

  /** Minimum entries per summary (for validation) */
  minEntriesPerSummary?: number;
}

/**
 * Options for the meta-summary parser.
 */
export interface MetaParserOptions {
  /** Number of summaries that were provided to LLM (for index validation) */
  summaryCount: number;

  /** Minimum summaries required for consolidation */
  minConsolidateCount?: number;

  /** Field name for summary in JSON ('summary' or 'consolidated_summary') */
  summaryField?: 'summary' | 'consolidated_summary';
}

// ============================================================================
// JSON SCHEMA INTERFACES
// ============================================================================

/**
 * Expected JSON schema for history summarization response.
 *
 * This is what we ASK the LLM to return. Reality may vary.
 */
export interface HistorySummaryJsonSchema {
  summary: string;
  included_ids: number[];
  metadata?: {
    entity_tags?: string[];
    key_facts?: string[];
    themes?: string[];
    emotional_tone?: string;
    time_period_label?: string;
  };
}

/**
 * Expected JSON schema for batch summarization response.
 */
export interface BatchSummaryJsonSchema {
  summaries: Array<{
    theme: string;
    summary: string;
    included_ids: number[];
    metadata?: {
      entity_tags?: string[];
      themes?: string[];
      emotional_tone?: string;
    };
  }>;
  skipped_ids?: number[];
  skipped_reason?: string;
}

/**
 * Expected JSON schema for meta-summarization response.
 */
export interface MetaSummaryJsonSchema {
  indices: number[];
  rationale: string;
  consolidated_summary?: string;
  metadata?: {
    entity_tags?: string[];
    key_facts?: string[];
    themes?: string[];
    emotional_tone?: string;
    time_period_label?: string;
  };
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of validating parsed IDs against known valid IDs.
 */
export interface IdValidationResult {
  /** IDs that were valid */
  valid: number[];

  /** IDs that were invalid (not in validIds set) */
  invalid: number[];

  /** IDs that were duplicated */
  duplicates: number[];

  /** Whether validation passed (no invalid IDs) */
  passed: boolean;
}

/**
 * Result of validating summary length.
 */
export interface LengthValidationResult {
  /** Actual length in characters */
  length: number;

  /** Estimated token count */
  estimatedTokens: number;

  /** Whether length is acceptable */
  acceptable: boolean;

  /** Warning message if length is concerning */
  warning?: string;
}
