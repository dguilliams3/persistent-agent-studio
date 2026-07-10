/**
 * Parser Utilities for Summarization
 *
 * @module @persistence/tools/definitions/summarize/parser/utils
 * @description Shared utilities for parsing LLM responses.
 *
 * These utilities handle the messy reality of LLM outputs:
 * - JSON extraction from markdown code blocks
 * - ID parsing from various formats
 * - Metadata normalization
 * - Text cleaning
 *
 * DESIGN PHILOSOPHY:
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  RECOVER, DON'T REJECT                                                   │
 * │  If the LLM gives us something 80% correct, extract what we can.        │
 * │  Log warnings but don't throw. Partial data is better than no data.     │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @upstream Used by: parser/parse-history.ts, parser/parse-batch.ts, parser/parse-meta.ts
 * @downstream Defines utilities, no external dependencies
 */

import type { SummaryMetadata } from '../types';
import type { FormatDetectionResult, ResponseFormat, IdValidationResult } from './types';

// ============================================================================
// JSON EXTRACTION
// ============================================================================

/**
 * Extracts JSON from LLM response, handling various formats.
 *
 * LLMs often wrap JSON in markdown code blocks or include preamble text.
 * This function tries multiple extraction strategies.
 *
 * @param text - Raw LLM response text
 * @returns Extracted JSON object or null if extraction failed
 *
 * @example
 * ```typescript
 * // Handles markdown code blocks
 * extractJson('Here is the result:\n```json\n{"key": "value"}\n```')
 * // Returns: { key: "value" }
 *
 * // Handles raw JSON
 * extractJson('{"key": "value"}')
 * // Returns: { key: "value" }
 * ```
 */
export function extractJson(text: string): Record<string, unknown> | null {
  if (!text || typeof text !== 'string') return null;

  // Strategy 1: Extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue to other strategies
    }
  }

  // Strategy 2: Find JSON object in text (greedy match from first { to last })
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // Continue to other strategies
    }
  }

  // Strategy 3: Find JSON array in text
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const arr = JSON.parse(arrayMatch[0]);
      // Wrap array in object for consistent return type
      return { items: arr };
    } catch {
      // Continue to other strategies
    }
  }

  // Strategy 4: Try parsing entire text as JSON
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

/**
 * Detects the format of an LLM response.
 *
 * @param text - Raw LLM response text
 * @returns Detection result with format type and confidence
 */
export function detectFormat(text: string): FormatDetectionResult {
  const warnings: string[] = [];

  if (!text || typeof text !== 'string') {
    return {
      format: 'plain',
      confidence: 1.0,
      warnings: ['Empty or invalid response']
    };
  }

  // Try JSON extraction first
  const jsonObject = extractJson(text);
  if (jsonObject) {
    // Check if it has expected fields
    const hasSummary = 'summary' in jsonObject || 'consolidated_summary' in jsonObject;
    const hasIds = 'included_ids' in jsonObject || 'indices' in jsonObject;
    const hasSummaries = 'summaries' in jsonObject && Array.isArray(jsonObject.summaries);

    if (hasSummary || hasIds || hasSummaries) {
      return {
        format: 'json',
        confidence: 0.95,
        jsonObject,
        warnings
      };
    }

    // JSON but missing expected fields
    warnings.push('JSON parsed but missing expected fields');
    return {
      format: 'json',
      confidence: 0.6,
      jsonObject,
      warnings
    };
  }

  // Check for legacy INCLUDED_IDS format
  if (/INCLUDED_IDS\s*:/i.test(text)) {
    return {
      format: 'legacy',
      confidence: 0.9,
      warnings
    };
  }

  // Check for [ID:N] markers in text (another legacy indicator)
  if (/\[ID:\d+\]/i.test(text)) {
    warnings.push('Found [ID:N] markers in response - may indicate LLM echoed input');
    return {
      format: 'plain',
      confidence: 0.7,
      warnings
    };
  }

  // Default to plain text
  return {
    format: 'plain',
    confidence: 1.0,
    warnings
  };
}

// ============================================================================
// ID EXTRACTION
// ============================================================================

/**
 * Extracts IDs from a JSON object.
 *
 * @param obj - Parsed JSON object
 * @param fieldName - Field to extract IDs from
 * @returns Array of IDs (may be empty)
 */
export function extractIdsFromJson(
  obj: Record<string, unknown>,
  fieldName: string = 'included_ids'
): number[] {
  const value = obj[fieldName];

  if (Array.isArray(value)) {
    return value
      .map((v) => {
        if (typeof v === 'number') return v;
        if (typeof v === 'string') return parseInt(v, 10);
        return NaN;
      })
      .filter((n) => !isNaN(n) && n > 0);
  }

  // Handle string format: "1, 2, 3" or "1,2,3"
  if (typeof value === 'string') {
    return parseIdString(value);
  }

  return [];
}

/**
 * Parses IDs from a comma-separated string.
 *
 * Handles various formats:
 * - "1, 2, 3"
 * - "1,2,3"
 * - "1 2 3"
 * - "[1, 2, 3]"
 *
 * @param text - String containing IDs
 * @returns Array of parsed IDs
 */
export function parseIdString(text: string): number[] {
  if (!text || typeof text !== 'string') return [];

  // Remove brackets if present
  const cleaned = text.replace(/[\[\]]/g, '');

  // Split by comma, semicolon, or whitespace
  return cleaned
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);
}

/**
 * Extracts IDs from legacy "INCLUDED_IDS: 1, 2, 3" format.
 *
 * @param text - Full response text
 * @returns Array of IDs (may be empty if not found)
 */
export function extractLegacyIds(text: string): number[] {
  const match = text.match(/INCLUDED_IDS\s*:\s*([^\n]+)/i);
  if (match) {
    return parseIdString(match[1]);
  }
  return [];
}

/**
 * Extracts IDs that appear as [ID:N] markers in text.
 *
 * This is a fallback when the LLM didn't return structured IDs.
 * We look for patterns like [ID:42] in the summary text.
 *
 * @param text - Summary text
 * @returns Array of IDs found
 */
export function extractMarkerIds(text: string): number[] {
  const matches = text.matchAll(/\[ID:(\d+)\]/gi);
  const ids: number[] = [];
  for (const match of matches) {
    const id = parseInt(match[1], 10);
    if (!isNaN(id) && id > 0) {
      ids.push(id);
    }
  }
  return [...new Set(ids)]; // Deduplicate
}

// ============================================================================
// ID VALIDATION
// ============================================================================

/**
 * Validates parsed IDs against a set of known valid IDs.
 *
 * @param parsedIds - IDs extracted from LLM response
 * @param validIds - Set of valid IDs (from input entries)
 * @returns Validation result with valid, invalid, and duplicate IDs
 */
export function validateIds(
  parsedIds: number[],
  validIds?: Set<number>
): IdValidationResult {
  const seen = new Set<number>();
  const valid: number[] = [];
  const invalid: number[] = [];
  const duplicates: number[] = [];

  for (const id of parsedIds) {
    if (seen.has(id)) {
      duplicates.push(id);
      continue;
    }
    seen.add(id);

    if (!validIds || validIds.has(id)) {
      valid.push(id);
    } else {
      invalid.push(id);
    }
  }

  return {
    valid,
    invalid,
    duplicates,
    passed: invalid.length === 0
  };
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

/**
 * Normalizes metadata from LLM response.
 *
 * Handles missing fields, type coercion, and array validation.
 *
 * @param raw - Raw metadata object from JSON
 * @returns Normalized metadata (partial, may have missing fields)
 */
export function normalizeMetadata(raw: unknown): Partial<SummaryMetadata> {
  if (!raw || typeof raw !== 'object') return {};

  const obj = raw as Record<string, unknown>;
  const result: Partial<SummaryMetadata> = {};

  // entity_tags: string[]
  if (Array.isArray(obj.entity_tags)) {
    result.entity_tags = obj.entity_tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // key_facts: string[]
  if (Array.isArray(obj.key_facts)) {
    result.key_facts = obj.key_facts
      .filter((f): f is string => typeof f === 'string')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  // themes: string[]
  if (Array.isArray(obj.themes)) {
    result.themes = obj.themes
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  // emotional_tone: string
  if (typeof obj.emotional_tone === 'string' && obj.emotional_tone.trim()) {
    result.emotional_tone = obj.emotional_tone.trim();
  }

  // time_period_label: string
  if (typeof obj.time_period_label === 'string' && obj.time_period_label.trim()) {
    result.time_period_label = obj.time_period_label.trim();
  }

  return result;
}

// ============================================================================
// TEXT CLEANING
// ============================================================================

/**
 * Extracts summary text from response, removing metadata markers.
 *
 * @param text - Raw response text
 * @param format - Detected format
 * @returns Clean summary text
 */
export function extractSummaryText(text: string, format: ResponseFormat): string {
  if (!text || typeof text !== 'string') return '';

  switch (format) {
    case 'json': {
      // For JSON, extract from parsed object
      const obj = extractJson(text);
      if (obj) {
        const summary = obj.summary || obj.consolidated_summary;
        if (typeof summary === 'string') {
          return summary.trim();
        }
      }
      // Fall through to plain text extraction
      break;
    }

    case 'legacy': {
      // Remove the INCLUDED_IDS line and everything after
      const cleanedText = text.replace(/\n*INCLUDED_IDS\s*:.*$/is, '').trim();
      return cleanedText;
    }

    case 'plain':
    default: {
      // Return trimmed text, remove any JSON artifacts
      return text
        .replace(/```json[\s\S]*```/g, '')
        .replace(/```[\s\S]*```/g, '')
        .trim();
    }
  }

  // Fallback
  return text.trim();
}

/**
 * Removes [ID:N] markers from summary text.
 *
 * These markers are used in the INPUT to help the LLM track which entries
 * are which, but they shouldn't appear in the OUTPUT summary.
 *
 * @param text - Summary text
 * @returns Text with markers removed
 */
export function removeIdMarkers(text: string): string {
  return text.replace(/\[ID:\d+\]\s*/g, '').trim();
}

// ============================================================================
// LENGTH VALIDATION
// ============================================================================

/**
 * Validates summary length to prevent data loss.
 *
 * A summary that's too short relative to input might indicate:
 * - LLM truncation
 * - Parsing failure
 * - LLM refusing to summarize
 *
 * @param summary - Summary text
 * @param inputEntryCount - Number of input entries
 * @param minLength - Minimum acceptable length (default 50)
 * @returns Validation result
 */
export function validateLength(
  summary: string,
  inputEntryCount: number,
  minLength: number = 50
): { acceptable: boolean; warning?: string } {
  const length = summary.length;
  const estimatedTokens = Math.ceil(length / 4);

  if (length < minLength) {
    return {
      acceptable: false,
      warning: `Summary too short (${length} chars, minimum ${minLength}). May indicate parsing failure or LLM issue.`
    };
  }

  // Heuristic: summary should be at least ~20 chars per input entry
  const expectedMin = inputEntryCount * 20;
  if (length < expectedMin) {
    return {
      acceptable: true,
      warning: `Summary may be too brief for ${inputEntryCount} entries (${length} chars, expected ~${expectedMin}+)`
    };
  }

  return { acceptable: true };
}
