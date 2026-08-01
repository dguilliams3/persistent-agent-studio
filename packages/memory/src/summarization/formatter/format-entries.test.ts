/**
 * @module @persistence/memory/summarization/formatter/format-entries.test
 * @description Unit tests for entry formatting functions
 *
 * Tests cover:
 * - formatEntriesForSummarization() - main batch formatter
 * - computeTimeRange() - time range calculation
 * - formatTimeRange() - time range string formatting
 * - estimateTokens() - token estimation
 * - canSummarize() - summarization eligibility check
 *
 * @covers format-entries.ts
 */

import { describe, it, expect } from 'vitest';
import {
  formatEntriesForSummarization,
  computeTimeRange,
  formatTimeRange,
  estimateTokens,
  canSummarize,
  DEFAULT_TYPE_ICONS,
} from './format-entries';
import type { HistoryEntry, HistoryId, PersonaId, ISOTimestamp } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

function createEntry(
  id: number,
  type: string = 'thought',
  content: string = 'Test content',
  overrides: Partial<HistoryEntry> = {}
): HistoryEntry {
  return {
    id: id as HistoryId,
    persona_id: 1 as PersonaId,
    type: type as any,
    content,
    internal: null,
    created_at: `2026-01-15T${String(10 + id).padStart(2, '0')}:00:00.000Z` as ISOTimestamp,
    summarized_at: null,
    cycle_id: null,
    meter_snapshot: null,
    ...overrides,
  };
}

// ============================================================================
// formatEntriesForSummarization()
// ============================================================================

describe('formatEntriesForSummarization', () => {
  describe('basic formatting', () => {
    it('formats entries with ID markers', () => {
      const entries = [
        createEntry(1, 'thought', 'Thinking about stuff'),
      ];

      const result = formatEntriesForSummarization(entries);

      expect(result.text).toContain('[ID:1]');
      expect(result.text).toContain('Thinking about stuff');
      expect(result.includedIds).toEqual([1]);
    });

    it('includes type icons', () => {
      const entries = [
        createEntry(1, 'thought', 'A thought'),
        createEntry(2, 'user_message', 'Hello'),
        createEntry(3, 'message_to_user', 'Hi back'),
      ];

      const result = formatEntriesForSummarization(entries);

      // Check that icons appear
      expect(result.text).toContain(DEFAULT_TYPE_ICONS.thought);
      expect(result.text).toContain(DEFAULT_TYPE_ICONS.user_message);
      expect(result.text).toContain(DEFAULT_TYPE_ICONS.message_to_user);
    });

    it('formats user_message with USER: prefix', () => {
      const entries = [
        createEntry(1, 'user_message', 'Hello Claude'),
      ];

      const result = formatEntriesForSummarization(entries);

      expect(result.text).toContain('USER: "Hello Claude"');
    });

    it('includes internal note for message_to_user', () => {
      const entries = [
        createEntry(1, 'message_to_user', 'Hi there', { internal: 'feeling nervous' }),
      ];

      const result = formatEntriesForSummarization(entries);

      expect(result.text).toContain('(thinking: feeling nervous)');
    });
  });

  describe('image handling', () => {
    it('replaces base64 images with [IMAGE] for non-art types', () => {
      // For art_result, the image gets replaced then formatted as "Created art"
      // Test with a different type to verify image replacement works
      const entries = [
        createEntry(1, 'thought', 'data:image/png;base64,iVBORw0KGgo...'),
      ];

      const result = formatEntriesForSummarization(entries);

      expect(result.text).toContain('[IMAGE]');
      expect(result.text).not.toContain('iVBORw0');
    });

    it('formats art_result type even when image is replaced', () => {
      // For art_result, images get replaced, then formatContentByType returns "Created art"
      const entries = [
        createEntry(1, 'art_result', 'data:image/png;base64,iVBORw0KGgo...'),
      ];

      const result = formatEntriesForSummarization(entries);

      expect(result.text).toContain('Created art');
      // Base64 content should NOT appear
      expect(result.text).not.toContain('iVBORw0');
    });

    it('preserves non-image content', () => {
      const entries = [
        createEntry(1, 'thought', 'Just some text about images'),
      ];

      const result = formatEntriesForSummarization(entries);

      expect(result.text).toContain('Just some text about images');
      expect(result.text).not.toContain('[IMAGE]');
    });
  });

  describe('content truncation', () => {
    it('truncates long content with ...', () => {
      const longContent = 'A'.repeat(2000);
      const entries = [
        createEntry(1, 'thought', longContent),
      ];

      const result = formatEntriesForSummarization(entries, {
        maxEntryLength: 500,
      });

      expect(result.text.length).toBeLessThan(longContent.length);
      expect(result.text).toContain('...');
    });

    it('does not truncate short content', () => {
      const entries = [
        createEntry(1, 'thought', 'Short content'),
      ];

      const result = formatEntriesForSummarization(entries, {
        maxEntryLength: 500,
      });

      expect(result.text).toContain('Short content');
      expect(result.text.split('...').length).toBe(1); // No truncation marker
    });
  });

  describe('token budget', () => {
    it('stops adding entries when token limit exceeded', () => {
      const entries = Array.from({ length: 100 }, (_, i) =>
        createEntry(i + 1, 'thought', 'A'.repeat(400)) // ~100 tokens each
      );

      const result = formatEntriesForSummarization(entries, {
        maxTotalTokens: 500, // Only ~5 entries worth
      });

      expect(result.includedIds.length).toBeLessThan(100);
      expect(result.truncatedCount).toBeGreaterThan(0);
      expect(result.totalTokens).toBeLessThanOrEqual(500);
    });

    it('reports truncation count', () => {
      const entries = Array.from({ length: 20 }, (_, i) =>
        createEntry(i + 1, 'thought', 'A'.repeat(400))
      );

      const result = formatEntriesForSummarization(entries, {
        maxTotalTokens: 500,
      });

      expect(result.truncatedCount).toBeGreaterThan(0);
      expect(result.truncatedCount + result.includedIds.length).toBe(20);
    });
  });

  describe('options', () => {
    it('respects includeIdMarkers: false', () => {
      const entries = [createEntry(1, 'thought', 'Content')];

      const result = formatEntriesForSummarization(entries, {
        includeIdMarkers: false,
      });

      expect(result.text).not.toContain('[ID:');
    });

    it('respects replaceImages: false', () => {
      // Use a non-art type so we can see the raw content
      const entries = [
        createEntry(1, 'thought', 'data:image/png;base64,iVBORw0KGgo'),
      ];

      const result = formatEntriesForSummarization(entries, {
        replaceImages: false,
      });

      expect(result.text).not.toContain('[IMAGE]');
      expect(result.text).toContain('data:image');
    });

    it('uses custom type icons', () => {
      const entries = [createEntry(1, 'thought', 'Content')];

      const result = formatEntriesForSummarization(entries, {
        customTypeIcons: { thought: '###' },
      });

      expect(result.text).toContain('###');
      expect(result.text).not.toContain(DEFAULT_TYPE_ICONS.thought);
    });
  });

  describe('time range', () => {
    it('calculates time range from entries', () => {
      const entries = [
        createEntry(1, 'thought', 'First', {
          created_at: '2026-01-15T10:00:00.000Z' as ISOTimestamp,
        }),
        createEntry(2, 'thought', 'Last', {
          created_at: '2026-01-15T14:00:00.000Z' as ISOTimestamp,
        }),
      ];

      const result = formatEntriesForSummarization(entries);

      expect(result.timeRange).toContain('Jan 15');
      expect(result.timeRange).toContain('EST');
    });
  });

  describe('empty input', () => {
    it('handles empty array', () => {
      const result = formatEntriesForSummarization([]);

      expect(result.text).toBe('');
      expect(result.includedIds).toEqual([]);
      expect(result.totalTokens).toBe(0);
      expect(result.timeRange).toBe('No entries');
    });
  });
});

// ============================================================================
// computeTimeRange()
// ============================================================================

describe('computeTimeRange', () => {
  it('computes range from formatted entries', () => {
    const entries = [
      { id: 1, formatted: '', estimatedTokens: 10, type: 'thought', timestamp: new Date('2026-01-15T10:00:00.000Z') },
      { id: 2, formatted: '', estimatedTokens: 10, type: 'thought', timestamp: new Date('2026-01-15T14:00:00.000Z') },
    ];

    const result = computeTimeRange(entries);

    expect(result.start.getTime()).toBe(new Date('2026-01-15T10:00:00.000Z').getTime());
    expect(result.end.getTime()).toBe(new Date('2026-01-15T14:00:00.000Z').getTime());
    expect(result.durationMs).toBe(4 * 60 * 60 * 1000); // 4 hours
  });

  it('handles single entry', () => {
    const entries = [
      { id: 1, formatted: '', estimatedTokens: 10, type: 'thought', timestamp: new Date('2026-01-15T12:00:00.000Z') },
    ];

    const result = computeTimeRange(entries);

    expect(result.start.getTime()).toBe(result.end.getTime());
    expect(result.durationMs).toBe(0);
  });

  it('handles empty array', () => {
    const result = computeTimeRange([]);

    expect(result.formatted).toBe('No entries');
    expect(result.durationMs).toBe(0);
  });

  it('finds min/max regardless of order', () => {
    const entries = [
      { id: 1, formatted: '', estimatedTokens: 10, type: 'thought', timestamp: new Date('2026-01-15T12:00:00.000Z') },
      { id: 2, formatted: '', estimatedTokens: 10, type: 'thought', timestamp: new Date('2026-01-15T08:00:00.000Z') },
      { id: 3, formatted: '', estimatedTokens: 10, type: 'thought', timestamp: new Date('2026-01-15T16:00:00.000Z') },
    ];

    const result = computeTimeRange(entries);

    expect(result.start.getTime()).toBe(new Date('2026-01-15T08:00:00.000Z').getTime());
    expect(result.end.getTime()).toBe(new Date('2026-01-15T16:00:00.000Z').getTime());
  });
});

// ============================================================================
// formatTimeRange()
// ============================================================================

describe('formatTimeRange', () => {
  it('formats same-day range', () => {
    const start = new Date('2026-01-15T10:00:00.000Z');
    const end = new Date('2026-01-15T14:00:00.000Z');

    const result = formatTimeRange(start, end);

    expect(result).toContain('Jan 15');
    expect(result).toContain('to');
  });

  it('formats different-day range', () => {
    const start = new Date('2026-01-15T10:00:00.000Z');
    const end = new Date('2026-01-17T14:00:00.000Z');

    const result = formatTimeRange(start, end);

    expect(result).toContain('Jan 15');
    expect(result).toContain('Jan 17');
  });

  it('respects format option: compact', () => {
    const start = new Date('2026-01-15T10:00:00.000Z');
    const end = new Date('2026-01-15T14:00:00.000Z');

    const result = formatTimeRange(start, end, { format: 'compact' });

    expect(result).toContain('-');
  });

  it('respects format option: date-only', () => {
    const start = new Date('2026-01-15T10:00:00.000Z');
    const end = new Date('2026-01-17T14:00:00.000Z');

    const result = formatTimeRange(start, end, { format: 'date-only' });

    // Should not include specific times
    expect(result).toContain('Jan 15');
    expect(result).toContain('Jan 17');
  });

  it('includes timezone abbreviation', () => {
    const start = new Date('2026-01-15T10:00:00.000Z');
    const end = new Date('2026-01-15T14:00:00.000Z');

    const result = formatTimeRange(start, end, { timezone: 'America/New_York' });

    // Should include EST or EDT
    expect(result).toMatch(/E[SD]T/);
  });
});

// ============================================================================
// estimateTokens()
// ============================================================================

describe('estimateTokens', () => {
  it('estimates ~4 chars per token', () => {
    expect(estimateTokens('A'.repeat(400))).toBe(100);
    expect(estimateTokens('A'.repeat(800))).toBe(200);
  });

  it('rounds up fractional tokens', () => {
    expect(estimateTokens('ABC')).toBe(1); // 3/4 = 0.75 -> 1
    expect(estimateTokens('ABCDE')).toBe(2); // 5/4 = 1.25 -> 2
  });

  it('handles empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('handles single character', () => {
    expect(estimateTokens('A')).toBe(1);
  });
});

// ============================================================================
// canSummarize()
// ============================================================================

describe('canSummarize', () => {
  it('returns true when enough entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) => createEntry(i + 1));

    const result = canSummarize(entries, 5);

    expect(result.can).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns false for empty array', () => {
    const result = canSummarize([]);

    expect(result.can).toBe(false);
    expect(result.reason).toBe('No entries to summarize');
  });

  it('returns false when below minimum', () => {
    const entries = [createEntry(1), createEntry(2)];

    const result = canSummarize(entries, 5);

    expect(result.can).toBe(false);
    expect(result.reason).toContain('Need at least 5');
    expect(result.reason).toContain('have 2');
  });

  it('uses default minCount of 5', () => {
    const fourEntries = Array.from({ length: 4 }, (_, i) => createEntry(i + 1));
    const fiveEntries = Array.from({ length: 5 }, (_, i) => createEntry(i + 1));

    expect(canSummarize(fourEntries).can).toBe(false);
    expect(canSummarize(fiveEntries).can).toBe(true);
  });
});

// ============================================================================
// DEFAULT_TYPE_ICONS
// ============================================================================

describe('DEFAULT_TYPE_ICONS', () => {
  it('has icons for all standard types', () => {
    // These are the types actually defined in types.ts
    const expectedTypes = [
      'thought', 'curiosity', 'exist', 'message_to_user', 'user_message',
      'art_request', 'art_result', 'user_art', 'search_query', 'search_result',
      'cold_storage', 'note_saved', 'remember', 'voice_sent',
    ];

    for (const type of expectedTypes) {
      expect(DEFAULT_TYPE_ICONS[type]).toBeDefined();
      expect(typeof DEFAULT_TYPE_ICONS[type]).toBe('string');
    }
  });

  it('has a default icon', () => {
    expect(DEFAULT_TYPE_ICONS.default).toBeDefined();
  });
});
