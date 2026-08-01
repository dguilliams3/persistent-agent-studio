/**
 * History Summary Response Parser
 *
 * @module @persistence/tools/definitions/summarize/parser/parse-history
 * @description Parses LLM responses from history summarization calls.
 *
 * This parser handles the output from `summarizeHistory()` - the first-pass
 * compression that takes N history entries and produces a single summary.
 *
 * EXPECTED RESPONSE FORMAT (JSON):
 * ```json
 * {
 *   "summary": "First-person summary text...",
 *   "included_ids": [1, 2, 3, 5, 7],
 *   "metadata": {
 *     "entity_tags": ["User", "physics"],
 *     "key_facts": ["learned about quantum..."],
 *     "themes": ["science", "curiosity"],
 *     "emotional_tone": "excited, curious",
 *     "time_period_label": "Tuesday morning"
 *   }
 * }
 * ```
 *
 * FALLBACK FORMATS:
 * - Legacy: Plain text followed by `INCLUDED_IDS: 1, 2, 3`
 * - Plain: Just the summary text (IDs inferred from input)
 *
 * @upstream Used by: summarization.js summarizeHistory()
 * @downstream Uses: parser/utils.ts for extraction helpers
 */

import type { SummaryMetadata } from '../types';
import type {
  ParsedHistoryResponse,
  HistoryParserOptions,
  HistorySummaryJsonSchema
} from './types';
import {
  detectFormat,
  extractJson,
  extractIdsFromJson,
  extractLegacyIds,
  extractMarkerIds,
  validateIds,
  normalizeMetadata,
  extractSummaryText,
  removeIdMarkers,
  validateLength
} from './utils';

/**
 * Parses a history summarization LLM response.
 *
 * Attempts to extract:
 * 1. Summary text (the compressed history)
 * 2. Included IDs (which entries were summarized)
 * 3. Metadata (themes, entities, tone, etc.)
 *
 * The parser is designed to be resilient - it will extract what it can
 * and log warnings for issues rather than throwing errors.
 *
 * @param response - Raw LLM response text
 * @param options - Parser options (validIds for validation, fallbackIds, etc.)
 * @returns Parsed response with summary, IDs, metadata, and any errors
 *
 * @example
 * ```typescript
 * // Parse with validation
 * const result = parseHistorySummaryResponse(llmOutput, {
 *   validIds: new Set([1, 2, 3, 4, 5]),
 *   fallbackIds: [1, 2, 3, 4, 5]
 * });
 *
 * if (result.errors.length > 0) {
 *   console.warn('Parse warnings:', result.errors);
 * }
 *
 * // Use the results
 * await saveSummary(result.summary, result.includedIds, result.metadata);
 * ```
 */
export function parseHistorySummaryResponse(
  response: string,
  options: HistoryParserOptions = {}
): ParsedHistoryResponse {
  const { validIds, fallbackIds = [], includeRaw = false } = options;
  const errors: string[] = [];

  // Handle empty response
  if (!response || typeof response !== 'string') {
    return {
      summary: '',
      includedIds: fallbackIds,
      metadata: {},
      format: 'plain',
      errors: ['Empty or invalid response'],
      ...(includeRaw ? { raw: response } : {})
    };
  }

  // Detect format
  const detection = detectFormat(response);
  errors.push(...detection.warnings);

  // Extract based on format
  let summary: string;
  let rawIds: number[];
  let metadata: Partial<SummaryMetadata> = {};

  switch (detection.format) {
    case 'json': {
      const parsed = parseJsonFormat(response, detection.jsonObject);
      summary = parsed.summary;
      rawIds = parsed.ids;
      metadata = parsed.metadata;
      errors.push(...parsed.errors);
      break;
    }

    case 'legacy': {
      const parsed = parseLegacyFormat(response);
      summary = parsed.summary;
      rawIds = parsed.ids;
      errors.push(...parsed.errors);
      break;
    }

    case 'plain':
    default: {
      const parsed = parsePlainFormat(response);
      summary = parsed.summary;
      rawIds = parsed.ids;
      errors.push(...parsed.errors);
      break;
    }
  }

  // Clean summary text
  summary = removeIdMarkers(summary);

  // Validate IDs if validIds provided
  let includedIds: number[];
  if (validIds) {
    const validation = validateIds(rawIds, validIds);
    includedIds = validation.valid;

    if (validation.invalid.length > 0) {
      errors.push(
        `Invalid IDs filtered out: [${validation.invalid.join(', ')}]`
      );
    }
    if (validation.duplicates.length > 0) {
      errors.push(`Duplicate IDs removed: [${validation.duplicates.join(', ')}]`);
    }

    // If no valid IDs extracted, use fallback
    if (includedIds.length === 0 && fallbackIds.length > 0) {
      includedIds = fallbackIds;
      errors.push('No valid IDs extracted, using fallback IDs');
    }
  } else {
    // No validation, deduplicate only
    includedIds = [...new Set(rawIds)];
    if (includedIds.length === 0 && fallbackIds.length > 0) {
      includedIds = fallbackIds;
      errors.push('No IDs extracted, using fallback IDs');
    }
  }

  // Validate length
  const lengthCheck = validateLength(summary, includedIds.length);
  if (!lengthCheck.acceptable) {
    errors.push(lengthCheck.warning!);
  } else if (lengthCheck.warning) {
    errors.push(lengthCheck.warning);
  }

  return {
    summary,
    includedIds,
    metadata,
    format: detection.format,
    errors,
    ...(includeRaw ? { raw: response } : {})
  };
}

// ============================================================================
// FORMAT-SPECIFIC PARSERS
// ============================================================================

interface ParseResult {
  summary: string;
  ids: number[];
  metadata: Partial<SummaryMetadata>;
  errors: string[];
}

/**
 * Parses JSON format response.
 */
function parseJsonFormat(
  response: string,
  preExtracted?: Record<string, unknown>
): ParseResult {
  const errors: string[] = [];

  const obj = preExtracted || extractJson(response);
  if (!obj) {
    errors.push('JSON extraction failed despite format detection');
    return {
      summary: response.trim(),
      ids: [],
      metadata: {},
      errors
    };
  }

  // Cast to expected schema (loosely)
  const json = obj as Partial<HistorySummaryJsonSchema>;

  // Extract summary
  let summary = '';
  if (typeof json.summary === 'string') {
    summary = json.summary.trim();
  } else {
    errors.push('Missing or invalid "summary" field in JSON');
    // Try to find summary-like field
    const possibleSummary = obj['text'] || obj['content'] || obj['result'];
    if (typeof possibleSummary === 'string') {
      summary = possibleSummary.trim();
      errors.push(`Used fallback field for summary`);
    }
  }

  // Extract IDs
  let ids = extractIdsFromJson(obj, 'included_ids');
  if (ids.length === 0) {
    // Try alternate field names
    ids = extractIdsFromJson(obj, 'includedIds') ||
          extractIdsFromJson(obj, 'ids') ||
          extractIdsFromJson(obj, 'entry_ids') ||
          [];
    if (ids.length > 0) {
      errors.push('Used alternate field name for IDs');
    }
  }

  // Extract metadata
  let metadata: Partial<SummaryMetadata> = {};
  if (obj.metadata && typeof obj.metadata === 'object') {
    metadata = normalizeMetadata(obj.metadata);
  } else {
    // Metadata might be at top level
    metadata = normalizeMetadata(obj);
  }

  return { summary, ids, metadata, errors };
}

/**
 * Parses legacy format response (text + INCLUDED_IDS line).
 */
function parseLegacyFormat(response: string): ParseResult {
  const errors: string[] = [];

  // Extract IDs from INCLUDED_IDS line
  const ids = extractLegacyIds(response);
  if (ids.length === 0) {
    errors.push('INCLUDED_IDS line found but no valid IDs extracted');
  }

  // Extract summary (everything before INCLUDED_IDS)
  const summary = extractSummaryText(response, 'legacy');

  return {
    summary,
    ids,
    metadata: {},
    errors
  };
}

/**
 * Parses plain text format (fallback).
 */
function parsePlainFormat(response: string): ParseResult {
  const errors: string[] = [];

  // Try to find any [ID:N] markers in the text
  const markerIds = extractMarkerIds(response);
  if (markerIds.length > 0) {
    errors.push(`Extracted ${markerIds.length} IDs from [ID:N] markers in text`);
  }

  // Clean the response
  const summary = extractSummaryText(response, 'plain');

  return {
    summary,
    ids: markerIds,
    metadata: {},
    errors
  };
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Quick validation check for a history summary response.
 *
 * @param response - Raw LLM response
 * @param validIds - Set of valid entry IDs
 * @returns True if response looks valid and usable
 */
export function isValidHistorySummary(
  response: string,
  validIds?: Set<number>
): boolean {
  const parsed = parseHistorySummaryResponse(response, { validIds });

  // Must have non-empty summary
  if (!parsed.summary || parsed.summary.length < 50) {
    return false;
  }

  // Must have some IDs (or no validation was requested)
  if (validIds && parsed.includedIds.length === 0) {
    return false;
  }

  return true;
}
