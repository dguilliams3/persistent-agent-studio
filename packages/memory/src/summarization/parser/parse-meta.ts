/**
 * Meta-Summary Response Parser
 *
 * @module @persistence/tools/definitions/summarize/parser/parse-meta
 * @description Parses LLM responses from meta-summarization (summary consolidation).
 *
 * Meta-summarization takes N existing summaries and consolidates a subset
 * into a single higher-level summary. It can work in two modes:
 *
 * 1. **Claude-Driven**: Claude selects which summaries to consolidate
 *    and provides the consolidated summary in one call.
 *
 * 2. **Two-Phase**: First call selects summaries, second call consolidates.
 *
 * EXPECTED RESPONSE FORMAT (JSON):
 * ```json
 * {
 *   "indices": [0, 1, 3],
 *   "rationale": "These summaries cover the same conversation thread...",
 *   "consolidated_summary": "Merged summary text...",
 *   "metadata": {
 *     "themes": ["science", "philosophy"],
 *     "emotional_tone": "contemplative"
 *   }
 * }
 * ```
 *
 * @upstream Used by: summarization.js metaSummarize()
 * @downstream Uses: parser/utils.ts for extraction helpers
 */

import type { SummaryMetadata } from '../types';
import type { ParsedMetaResponse, MetaParserOptions } from './types';
import {
  detectFormat,
  extractJson,
  extractIdsFromJson,
  normalizeMetadata,
  removeIdMarkers,
  validateLength
} from './utils';

/**
 * Parses a meta-summarization LLM response.
 *
 * Extracts:
 * 1. Indices of summaries to consolidate
 * 2. Rationale for why these summaries belong together
 * 3. Consolidated summary (if provided in same call)
 * 4. Metadata for the consolidated summary
 *
 * @param response - Raw LLM response text
 * @param options - Parser options (summaryCount for index validation)
 * @returns Parsed response with indices, rationale, summary, and errors
 *
 * @example
 * ```typescript
 * const result = parseMetaSummaryResponse(llmOutput, {
 *   summaryCount: 5,  // We provided 5 summaries to Claude
 *   minConsolidateCount: 2
 * });
 *
 * if (result.indices.length >= 2) {
 *   // Consolidate these summaries
 *   await consolidate(result.indices, result.consolidatedSummary);
 * }
 * ```
 */
export function parseMetaSummaryResponse(
  response: string,
  options: MetaParserOptions
): ParsedMetaResponse {
  const {
    summaryCount,
    minConsolidateCount = 2,
    summaryField = 'consolidated_summary'
  } = options;
  const errors: string[] = [];

  // Handle empty response
  if (!response || typeof response !== 'string') {
    return {
      indices: [],
      rationale: '',
      consolidatedSummary: null,
      metadata: {},
      format: 'plain',
      errors: ['Empty or invalid response']
    };
  }

  // Detect format
  const detection = detectFormat(response);
  errors.push(...detection.warnings);

  // For meta-summarization, we really need JSON format
  if (detection.format !== 'json') {
    errors.push(
      `Expected JSON format for meta-summarization, got ${detection.format}`
    );
    return {
      indices: [],
      rationale: response.substring(0, 200),
      consolidatedSummary: null,
      metadata: {},
      format: detection.format,
      errors
    };
  }

  // Parse JSON
  const obj = detection.jsonObject || extractJson(response);
  if (!obj) {
    errors.push('JSON extraction failed');
    return {
      indices: [],
      rationale: '',
      consolidatedSummary: null,
      metadata: {},
      format: 'plain',
      errors
    };
  }

  // Extract indices
  let indices = extractIndices(obj);
  if (indices.length === 0) {
    errors.push('No indices found in response');
  } else {
    // Validate indices are within range
    const validIndices: number[] = [];
    const invalidIndices: number[] = [];

    for (const idx of indices) {
      if (idx >= 0 && idx < summaryCount) {
        validIndices.push(idx);
      } else {
        invalidIndices.push(idx);
      }
    }

    if (invalidIndices.length > 0) {
      errors.push(
        `Invalid indices removed (out of range 0-${summaryCount - 1}): [${invalidIndices.join(', ')}]`
      );
    }

    indices = validIndices;
  }

  // Check minimum consolidation count
  if (indices.length > 0 && indices.length < minConsolidateCount) {
    errors.push(
      `Only ${indices.length} indices selected, minimum is ${minConsolidateCount}`
    );
  }

  // Extract rationale
  let rationale = '';
  if (typeof obj.rationale === 'string') {
    rationale = obj.rationale.trim();
  } else if (typeof obj.reason === 'string') {
    rationale = obj.reason.trim();
  } else if (typeof obj.explanation === 'string') {
    rationale = obj.explanation.trim();
  }

  // Extract consolidated summary
  let consolidatedSummary: string | null = null;
  const summaryValue = obj[summaryField] || obj.summary || obj.merged_summary;
  if (typeof summaryValue === 'string' && summaryValue.trim()) {
    consolidatedSummary = removeIdMarkers(summaryValue.trim());

    // Validate length
    const lengthCheck = validateLength(consolidatedSummary, indices.length, 100);
    if (!lengthCheck.acceptable) {
      errors.push(lengthCheck.warning!);
    } else if (lengthCheck.warning) {
      errors.push(lengthCheck.warning);
    }
  }

  // Extract metadata
  let metadata: Partial<SummaryMetadata> = {};
  if (obj.metadata && typeof obj.metadata === 'object') {
    metadata = normalizeMetadata(obj.metadata);
  }

  return {
    indices,
    rationale,
    consolidatedSummary,
    metadata,
    format: 'json',
    errors
  };
}

/**
 * Extracts indices from JSON object.
 *
 * Handles various field names and formats.
 */
function extractIndices(obj: Record<string, unknown>): number[] {
  // Try common field names
  const fieldNames = ['indices', 'selected_indices', 'summary_indices', 'ids'];

  for (const field of fieldNames) {
    const value = obj[field];
    if (Array.isArray(value)) {
      return value
        .map((v) => {
          if (typeof v === 'number') return v;
          if (typeof v === 'string') return parseInt(v, 10);
          return NaN;
        })
        .filter((n) => !isNaN(n) && n >= 0);
    }
  }

  // Try to find any array of numbers
  for (const value of Object.values(obj)) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every((v) => typeof v === 'number' || !isNaN(parseInt(String(v), 10)))
    ) {
      return value.map((v) =>
        typeof v === 'number' ? v : parseInt(String(v), 10)
      );
    }
  }

  return [];
}

/**
 * Parses a consolidation-only response (when indices are already known).
 *
 * Used in two-phase mode where the first call selected indices and
 * the second call just provides the consolidated summary.
 *
 * @param response - Raw LLM response
 * @param options - Parser options
 * @returns Just the summary and metadata portions
 */
export function parseConsolidationResponse(
  response: string,
  options: { minLength?: number } = {}
): {
  summary: string;
  metadata: Partial<SummaryMetadata>;
  errors: string[];
} {
  const { minLength = 100 } = options;
  const errors: string[] = [];

  if (!response || typeof response !== 'string') {
    return {
      summary: '',
      metadata: {},
      errors: ['Empty or invalid response']
    };
  }

  // Try JSON first
  const detection = detectFormat(response);
  if (detection.format === 'json' && detection.jsonObject) {
    const obj = detection.jsonObject;
    const summary =
      (obj.consolidated_summary as string) ||
      (obj.summary as string) ||
      (obj.merged_summary as string) ||
      '';

    const metadata = obj.metadata
      ? normalizeMetadata(obj.metadata)
      : normalizeMetadata(obj);

    if (summary) {
      const clean = removeIdMarkers(summary.trim());
      const lengthCheck = validateLength(clean, 1, minLength);
      if (!lengthCheck.acceptable) {
        errors.push(lengthCheck.warning!);
      }
      return { summary: clean, metadata, errors };
    }
  }

  // Fall back to treating entire response as summary
  const summary = removeIdMarkers(response.trim());
  const lengthCheck = validateLength(summary, 1, minLength);
  if (!lengthCheck.acceptable) {
    errors.push(lengthCheck.warning!);
  }

  return { summary, metadata: {}, errors };
}

// ============================================================================
// SELECTION-ONLY PARSER
// ============================================================================

/**
 * Parses a selection-only response (first phase of two-phase mode).
 *
 * Used when Claude is just selecting which summaries to consolidate,
 * not actually doing the consolidation yet.
 *
 * @param response - Raw LLM response
 * @param summaryCount - Number of summaries that were provided
 * @returns Selection result with indices and rationale
 */
export function parseSelectionResponse(
  response: string,
  summaryCount: number
): {
  indices: number[];
  rationale: string;
  errors: string[];
} {
  const result = parseMetaSummaryResponse(response, {
    summaryCount,
    minConsolidateCount: 2
  });

  return {
    indices: result.indices,
    rationale: result.rationale,
    errors: result.errors
  };
}
