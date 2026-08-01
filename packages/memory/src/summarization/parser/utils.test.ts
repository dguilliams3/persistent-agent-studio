/**
 * @module @persistence/memory/summarization/parser/utils.test
 * @description Unit tests for parser utility functions
 *
 * Tests cover:
 * - extractJson() - JSON extraction from various formats
 * - detectFormat() - response format detection
 * - parseIdString() - ID parsing from strings
 * - extractLegacyIds() - legacy INCLUDED_IDS format
 * - extractMarkerIds() - [ID:N] markers in text
 * - validateIds() - ID validation against known set
 * - normalizeMetadata() - metadata normalization
 * - extractSummaryText() - summary text extraction
 * - removeIdMarkers() - marker removal
 * - validateLength() - length validation
 *
 * @covers utils.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  extractJson,
  detectFormat,
  parseIdString,
  extractLegacyIds,
  extractMarkerIds,
  validateIds,
  extractIdsFromJson,
  normalizeMetadata,
  extractSummaryText,
  removeIdMarkers,
  validateLength,
} from './utils';

// ============================================================================
// extractJson()
// ============================================================================

describe('extractJson', () => {
  describe('markdown code blocks', () => {
    it('extracts JSON from ```json block', () => {
      const text = 'Here is the result:\n```json\n{"key": "value"}\n```';
      const result = extractJson(text);
      expect(result).toEqual({ key: 'value' });
    });

    it('extracts JSON from ``` block without language', () => {
      const text = '```\n{"count": 42}\n```';
      const result = extractJson(text);
      expect(result).toEqual({ count: 42 });
    });

    it('handles nested objects in code block', () => {
      const text = '```json\n{"outer": {"inner": [1, 2, 3]}}\n```';
      const result = extractJson(text);
      expect(result).toEqual({ outer: { inner: [1, 2, 3] } });
    });
  });

  describe('raw JSON', () => {
    it('extracts raw JSON object', () => {
      const text = '{"summary": "Test summary", "ids": [1, 2, 3]}';
      const result = extractJson(text);
      expect(result).toEqual({ summary: 'Test summary', ids: [1, 2, 3] });
    });

    it('extracts JSON object with preamble text', () => {
      const text = 'Here is your summary:\n{"summary": "Done"}';
      const result = extractJson(text);
      expect(result).toEqual({ summary: 'Done' });
    });

    it('extracts JSON object with trailing text', () => {
      const text = '{"key": "value"}\nThat was the result.';
      const result = extractJson(text);
      expect(result).toEqual({ key: 'value' });
    });
  });

  describe('JSON array handling', () => {
    it('wraps JSON array in items property', () => {
      const text = '[1, 2, 3]';
      const result = extractJson(text);
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('wraps array of objects', () => {
      const text = '[{"id": 1}, {"id": 2}]';
      const result = extractJson(text);
      expect(result).toEqual({ items: [{ id: 1 }, { id: 2 }] });
    });
  });

  describe('error handling', () => {
    it('returns null for empty string', () => {
      expect(extractJson('')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(extractJson(null as any)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(extractJson(undefined as any)).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(extractJson('not json at all')).toBeNull();
    });

    it('returns null for truncated JSON', () => {
      expect(extractJson('{"key": "val')).toBeNull();
    });
  });
});

// ============================================================================
// detectFormat()
// ============================================================================

describe('detectFormat', () => {
  describe('JSON format', () => {
    it('detects JSON with summary field', () => {
      const text = '{"summary": "Test summary"}';
      const result = detectFormat(text);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('detects JSON with consolidated_summary field', () => {
      const text = '{"consolidated_summary": "Meta summary"}';
      const result = detectFormat(text);
      expect(result.format).toBe('json');
    });

    it('detects JSON with included_ids field', () => {
      const text = '{"summary": "Test", "included_ids": [1, 2, 3]}';
      const result = detectFormat(text);
      expect(result.format).toBe('json');
    });

    it('has lower confidence for JSON without expected fields', () => {
      const text = '{"random": "data"}';
      const result = detectFormat(text);
      expect(result.format).toBe('json');
      expect(result.confidence).toBeLessThan(0.9);
      expect(result.warnings).toContain('JSON parsed but missing expected fields');
    });
  });

  describe('legacy format', () => {
    it('detects INCLUDED_IDS: format', () => {
      const text = 'Summary here\n\nINCLUDED_IDS: 1, 2, 3';
      const result = detectFormat(text);
      expect(result.format).toBe('legacy');
    });

    it('detects case-insensitive INCLUDED_IDS', () => {
      const text = 'included_ids: 1, 2, 3';
      const result = detectFormat(text);
      expect(result.format).toBe('legacy');
    });
  });

  describe('plain format', () => {
    it('returns plain for regular text', () => {
      const text = 'This is just a regular summary without any special markers.';
      const result = detectFormat(text);
      expect(result.format).toBe('plain');
    });

    it('warns when [ID:N] markers found in plain text', () => {
      const text = 'Summary mentions [ID:42] but not in JSON';
      const result = detectFormat(text);
      expect(result.format).toBe('plain');
      expect(result.warnings).toContain('Found [ID:N] markers in response - may indicate LLM echoed input');
    });
  });

  describe('error handling', () => {
    it('returns plain for empty input', () => {
      const result = detectFormat('');
      expect(result.format).toBe('plain');
      expect(result.warnings).toContain('Empty or invalid response');
    });

    it('returns plain for null input', () => {
      const result = detectFormat(null as any);
      expect(result.format).toBe('plain');
    });
  });
});

// ============================================================================
// parseIdString()
// ============================================================================

describe('parseIdString', () => {
  it('parses comma-separated IDs', () => {
    expect(parseIdString('1, 2, 3')).toEqual([1, 2, 3]);
  });

  it('parses IDs without spaces', () => {
    expect(parseIdString('1,2,3')).toEqual([1, 2, 3]);
  });

  it('parses space-separated IDs', () => {
    expect(parseIdString('1 2 3')).toEqual([1, 2, 3]);
  });

  it('parses IDs with brackets', () => {
    expect(parseIdString('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('filters out invalid values', () => {
    expect(parseIdString('1, abc, 2, , 3')).toEqual([1, 2, 3]);
  });

  it('filters out zero and negative', () => {
    expect(parseIdString('0, -1, 1, 2')).toEqual([1, 2]);
  });

  it('returns empty for empty string', () => {
    expect(parseIdString('')).toEqual([]);
  });

  it('returns empty for null', () => {
    expect(parseIdString(null as any)).toEqual([]);
  });
});

// ============================================================================
// extractLegacyIds()
// ============================================================================

describe('extractLegacyIds', () => {
  it('extracts IDs from INCLUDED_IDS line', () => {
    const text = 'Summary text\n\nINCLUDED_IDS: 1, 2, 3';
    expect(extractLegacyIds(text)).toEqual([1, 2, 3]);
  });

  it('handles lowercase', () => {
    const text = 'included_ids: 42, 43, 44';
    expect(extractLegacyIds(text)).toEqual([42, 43, 44]);
  });

  it('handles with colon space variations', () => {
    const text = 'INCLUDED_IDS:5,6,7';
    expect(extractLegacyIds(text)).toEqual([5, 6, 7]);
  });

  it('returns empty when not found', () => {
    expect(extractLegacyIds('No IDs here')).toEqual([]);
  });
});

// ============================================================================
// extractMarkerIds()
// ============================================================================

describe('extractMarkerIds', () => {
  it('extracts [ID:N] markers', () => {
    const text = '[ID:1] First item [ID:2] Second item [ID:3] Third';
    expect(extractMarkerIds(text)).toEqual([1, 2, 3]);
  });

  it('deduplicates repeated IDs', () => {
    const text = '[ID:1] mentioned [ID:1] twice';
    expect(extractMarkerIds(text)).toEqual([1]);
  });

  it('handles case-insensitive markers', () => {
    const text = '[id:1] [ID:2] [Id:3]';
    expect(extractMarkerIds(text)).toEqual([1, 2, 3]);
  });

  it('returns empty when no markers', () => {
    expect(extractMarkerIds('No markers here')).toEqual([]);
  });
});

// ============================================================================
// extractIdsFromJson()
// ============================================================================

describe('extractIdsFromJson', () => {
  it('extracts IDs from array field', () => {
    const obj = { included_ids: [1, 2, 3] };
    expect(extractIdsFromJson(obj, 'included_ids')).toEqual([1, 2, 3]);
  });

  it('extracts IDs from string array values', () => {
    const obj = { ids: ['1', '2', '3'] };
    expect(extractIdsFromJson(obj, 'ids')).toEqual([1, 2, 3]);
  });

  it('extracts IDs from comma-separated string', () => {
    const obj = { ids: '1, 2, 3' };
    expect(extractIdsFromJson(obj, 'ids')).toEqual([1, 2, 3]);
  });

  it('filters out invalid values', () => {
    const obj = { ids: [1, 'abc', null, 2, -1, 3] };
    expect(extractIdsFromJson(obj, 'ids')).toEqual([1, 2, 3]);
  });

  it('returns empty for missing field', () => {
    const obj = { other: [1, 2, 3] };
    expect(extractIdsFromJson(obj, 'ids')).toEqual([]);
  });
});

// ============================================================================
// validateIds()
// ============================================================================

describe('validateIds', () => {
  it('validates IDs against known set', () => {
    const parsedIds = [1, 2, 3];
    const validIds = new Set([1, 2, 3, 4, 5]);

    const result = validateIds(parsedIds, validIds);

    expect(result.valid).toEqual([1, 2, 3]);
    expect(result.invalid).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('identifies invalid IDs', () => {
    const parsedIds = [1, 99, 3];
    const validIds = new Set([1, 2, 3]);

    const result = validateIds(parsedIds, validIds);

    expect(result.valid).toEqual([1, 3]);
    expect(result.invalid).toEqual([99]);
    expect(result.passed).toBe(false);
  });

  it('identifies duplicates', () => {
    const parsedIds = [1, 2, 1, 3, 2];

    const result = validateIds(parsedIds);

    expect(result.valid).toEqual([1, 2, 3]);
    expect(result.duplicates).toEqual([1, 2]);
  });

  it('passes all when no validIds provided', () => {
    const parsedIds = [1, 2, 99];

    const result = validateIds(parsedIds);

    expect(result.valid).toEqual([1, 2, 99]);
    expect(result.passed).toBe(true);
  });
});

// ============================================================================
// normalizeMetadata()
// ============================================================================

describe('normalizeMetadata', () => {
  it('normalizes valid metadata', () => {
    const raw = {
      entity_tags: ['User', 'Clio', 123], // 123 should be filtered
      key_facts: ['Fact 1'],
      themes: ['philosophy'],
      emotional_tone: 'contemplative',
      time_period_label: 'Morning',
    };

    const result = normalizeMetadata(raw);

    expect(result.entity_tags).toEqual(['User', 'Clio']);
    expect(result.key_facts).toEqual(['Fact 1']);
    expect(result.themes).toEqual(['philosophy']);
    expect(result.emotional_tone).toBe('contemplative');
    expect(result.time_period_label).toBe('Morning');
  });

  it('trims whitespace from strings', () => {
    const raw = {
      entity_tags: ['  User  ', 'Clio  '],
      emotional_tone: '  happy  ',
    };

    const result = normalizeMetadata(raw);

    expect(result.entity_tags).toEqual(['User', 'Clio']);
    expect(result.emotional_tone).toBe('happy');
  });

  it('filters empty strings', () => {
    const raw = {
      entity_tags: ['', 'User', '  ', 'Clio'],
      themes: ['', 'philosophy'],
    };

    const result = normalizeMetadata(raw);

    expect(result.entity_tags).toEqual(['User', 'Clio']);
    expect(result.themes).toEqual(['philosophy']);
  });

  it('returns empty object for null/undefined', () => {
    expect(normalizeMetadata(null)).toEqual({});
    expect(normalizeMetadata(undefined)).toEqual({});
  });

  it('returns empty object for non-object input', () => {
    expect(normalizeMetadata('string')).toEqual({});
    expect(normalizeMetadata(123)).toEqual({});
    expect(normalizeMetadata([])).toEqual({});
  });
});

// ============================================================================
// extractSummaryText()
// ============================================================================

describe('extractSummaryText', () => {
  describe('JSON format', () => {
    it('extracts from summary field', () => {
      const text = '{"summary": "The summary text"}';
      const result = extractSummaryText(text, 'json');
      expect(result).toBe('The summary text');
    });

    it('extracts from consolidated_summary field', () => {
      const text = '{"consolidated_summary": "Meta summary"}';
      const result = extractSummaryText(text, 'json');
      expect(result).toBe('Meta summary');
    });
  });

  describe('legacy format', () => {
    it('removes INCLUDED_IDS line and after', () => {
      const text = 'Summary text here\n\nINCLUDED_IDS: 1, 2, 3';
      const result = extractSummaryText(text, 'legacy');
      expect(result).toBe('Summary text here');
    });
  });

  describe('plain format', () => {
    it('removes code blocks', () => {
      const text = 'Summary text\n```json\n{"test": true}\n```';
      const result = extractSummaryText(text, 'plain');
      expect(result).toBe('Summary text');
    });

    it('trims whitespace', () => {
      const text = '  Summary text  ';
      const result = extractSummaryText(text, 'plain');
      expect(result).toBe('Summary text');
    });
  });

  describe('error handling', () => {
    it('returns empty string for null', () => {
      expect(extractSummaryText(null as any, 'json')).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(extractSummaryText(undefined as any, 'plain')).toBe('');
    });
  });
});

// ============================================================================
// removeIdMarkers()
// ============================================================================

describe('removeIdMarkers', () => {
  it('removes [ID:N] markers', () => {
    const text = '[ID:1] First [ID:2] Second [ID:3] Third';
    expect(removeIdMarkers(text)).toBe('First Second Third');
  });

  it('handles markers with extra spaces', () => {
    const text = '[ID:1]  Multiple   spaces';
    expect(removeIdMarkers(text).trim()).toBe('Multiple   spaces');
  });

  it('handles no markers', () => {
    const text = 'No markers here';
    expect(removeIdMarkers(text)).toBe('No markers here');
  });

  it('handles consecutive markers', () => {
    const text = '[ID:1][ID:2][ID:3] All together';
    expect(removeIdMarkers(text).trim()).toBe('All together');
  });
});

// ============================================================================
// validateLength()
// ============================================================================

describe('validateLength', () => {
  it('accepts summary above minimum', () => {
    const summary = 'A'.repeat(100);
    const result = validateLength(summary, 5);

    expect(result.acceptable).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('rejects summary below minimum', () => {
    const summary = 'A'.repeat(30);
    const result = validateLength(summary, 5, 50);

    expect(result.acceptable).toBe(false);
    expect(result.warning).toContain('too short');
  });

  it('warns for brief summary relative to entry count', () => {
    // 5 entries, expect ~100 chars, only have 50
    const summary = 'A'.repeat(50);
    const result = validateLength(summary, 10); // 10 entries = expect ~200 chars

    expect(result.acceptable).toBe(true);
    expect(result.warning).toContain('too brief');
  });

  it('accepts appropriately sized summary', () => {
    const summary = 'A'.repeat(500);
    const result = validateLength(summary, 10);

    expect(result.acceptable).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('uses custom minLength', () => {
    const summary = 'A'.repeat(80);

    const result100 = validateLength(summary, 5, 100);
    expect(result100.acceptable).toBe(false);

    const result50 = validateLength(summary, 5, 50);
    expect(result50.acceptable).toBe(true);
  });
});
