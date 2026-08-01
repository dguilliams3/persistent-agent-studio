/**
 * Summarization Response Parsers
 *
 * @module @persistence/tools/definitions/summarize/parser
 * @description Barrel export for all summarization response parsers.
 *
 * PARSER HIERARCHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  utils.ts           - Shared extraction, validation, cleaning          │
 * │      ↓                                                                   │
 * │  parse-history.ts   - First-pass summarization (history → summary)     │
 * │  parse-meta.ts      - Meta-summarization (summary → meta-summary)      │
 * │  parse-batch.ts     - Batch summarization (history → N summaries)      │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * USAGE:
 * ```typescript
 * import {
 *   parseHistorySummaryResponse,
 *   parseMetaSummaryResponse,
 *   isValidHistorySummary
 * } from '@persistence/tools/definitions/summarize/parser';
 *
 * const result = parseHistorySummaryResponse(llmOutput, {
 *   validIds: new Set([1, 2, 3]),
 *   fallbackIds: [1, 2, 3]
 * });
 * ```
 *
 * @upstream Used by: summarization service, handlers
 * @downstream Aggregates: parser modules
 */

// Types
export type {
  ResponseFormat,
  FormatDetectionResult,
  ParsedHistoryResponse,
  ParsedBatchResponse,
  ParsedMetaResponse,
  HistoryParserOptions,
  BatchParserOptions,
  MetaParserOptions,
  HistorySummaryJsonSchema,
  BatchSummaryJsonSchema,
  MetaSummaryJsonSchema,
  IdValidationResult,
  LengthValidationResult
} from './types';

// History parser
export {
  parseHistorySummaryResponse,
  isValidHistorySummary
} from './parse-history';

// Meta-summary parser
export {
  parseMetaSummaryResponse,
  parseConsolidationResponse,
  parseSelectionResponse
} from './parse-meta';

// Utilities (for advanced use)
export {
  extractJson,
  detectFormat,
  extractIdsFromJson,
  parseIdString,
  extractLegacyIds,
  extractMarkerIds,
  validateIds,
  normalizeMetadata,
  extractSummaryText,
  removeIdMarkers,
  validateLength
} from './utils';
