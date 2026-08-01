/**
 * @module @persistence/memory/rag/retrieval/mmr.test
 * @description Unit tests for Maximal Marginal Relevance (MMR) selection
 *
 * Tests cover:
 * - selectByMMR() - main MMR selection algorithm
 * - selectByMMRSimple() - simplified API
 * - prepareCandidates() - candidate preparation helper
 *
 * @covers mmr.ts
 */

import { describe, it, expect } from 'vitest';
import {
  selectByMMR,
  selectByMMRSimple,
  prepareCandidates,
} from './mmr';
import type { ScoredCandidate, MMRConfig } from '../types';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a simple embedding for testing.
 * Uses deterministic values based on ID for reproducibility.
 */
function createTestEmbedding(id: number, dim: number = 768): Float32Array {
  const embedding = new Float32Array(dim);
  // Create a normalized vector pointing in a direction based on ID
  const angle = (id * Math.PI) / 10;
  embedding[0] = Math.cos(angle);
  embedding[1] = Math.sin(angle);
  // Fill rest with small values to simulate real embeddings
  for (let i = 2; i < dim; i++) {
    embedding[i] = 0.01 * Math.sin(id + i);
  }
  return embedding;
}

/**
 * Creates test candidates with varying similarities.
 */
function createTestCandidates<T>(
  items: T[],
  similarities: number[],
  combinedScores?: number[]
): ScoredCandidate<T>[] {
  return items.map((item, i) => ({
    item,
    embedding: createTestEmbedding(i),
    similarity: similarities[i] || 0.5,
    combinedScore: combinedScores ? combinedScores[i] : undefined,
  }));
}

// ============================================================================
// selectByMMR()
// ============================================================================

describe('selectByMMR', () => {
  describe('basic selection', () => {
    it('selects top k items', () => {
      const items = ['A', 'B', 'C', 'D', 'E'];
      const candidates = createTestCandidates(
        items,
        [0.9, 0.8, 0.7, 0.6, 0.5]
      );

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99), // query embedding
        { k: 3 }
      );

      expect(result.selected.length).toBe(3);
      expect(result.stats.selectedCount).toBe(3);
    });

    it('selects highest similarity first', () => {
      const items = ['low', 'high', 'medium'];
      const candidates = createTestCandidates(
        items,
        [0.5, 0.9, 0.7]
      );

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 1, lambda: 1.0 } // Pure relevance
      );

      expect(result.selected[0].item).toBe('high');
    });

    it('returns fewer than k if not enough candidates', () => {
      const items = ['A', 'B'];
      const candidates = createTestCandidates(items, [0.9, 0.8]);

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 5 }
      );

      expect(result.selected.length).toBe(2);
      expect(result.stats.selectedCount).toBe(2);
    });

    it('returns empty when no candidates', () => {
      const result = selectByMMR(
        [],
        createTestEmbedding(99),
        { k: 5 }
      );

      expect(result.selected.length).toBe(0);
      expect(result.stats.candidateCount).toBe(0);
    });
  });

  describe('diversity through MMR', () => {
    it('prefers diverse items when lambda < 1', () => {
      // Create candidates where some are very similar to each other
      const items = ['A1', 'A2', 'B1', 'B2'];
      const candidates: ScoredCandidate<string>[] = [
        {
          item: 'A1',
          embedding: createTestEmbedding(0),
          similarity: 0.9,
        },
        {
          item: 'A2',
          embedding: createTestEmbedding(0), // Same embedding as A1
          similarity: 0.88,
        },
        {
          item: 'B1',
          embedding: createTestEmbedding(10), // Different direction
          similarity: 0.85,
        },
        {
          item: 'B2',
          embedding: createTestEmbedding(10), // Same as B1
          similarity: 0.83,
        },
      ];

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 2, lambda: 0.5 } // 50% relevance, 50% diversity
      );

      // First selection should be A1 (highest similarity)
      expect(result.selected[0].item).toBe('A1');

      // Second selection should prefer B1 over A2 due to diversity
      // (A2 is very similar to A1, B1 is different)
      expect(result.selected[1].item).toBe('B1');
    });

    it('ignores diversity when lambda = 1', () => {
      const items = ['high', 'similar-to-high', 'medium'];
      const candidates: ScoredCandidate<string>[] = [
        { item: 'high', embedding: createTestEmbedding(0), similarity: 0.9 },
        { item: 'similar-to-high', embedding: createTestEmbedding(0), similarity: 0.85 },
        { item: 'medium', embedding: createTestEmbedding(10), similarity: 0.8 },
      ];

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 2, lambda: 1.0 } // Pure relevance
      );

      // Should select by similarity only
      expect(result.selected[0].item).toBe('high');
      expect(result.selected[1].item).toBe('similar-to-high');
    });
  });

  describe('minSimilarity filtering', () => {
    it('filters candidates below minSimilarity', () => {
      const items = ['A', 'B', 'C'];
      const candidates = createTestCandidates(
        items,
        [0.9, 0.5, 0.3]
      );

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 3, minSimilarity: 0.6 }
      );

      expect(result.selected.length).toBe(1);
      expect(result.selected[0].item).toBe('A');
      expect(result.stats.filteredCount).toBe(1);
    });

    it('filters using combinedScore when useCombinedScore is true', () => {
      const items = ['A', 'B', 'C'];
      const candidates = createTestCandidates(
        items,
        [0.9, 0.9, 0.9], // High similarities
        [0.3, 0.6, 0.8]  // But varying combined scores
      );

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 3, minSimilarity: 0.5, useCombinedScore: true }
      );

      expect(result.selected.length).toBe(2); // B and C pass threshold
      expect(result.stats.filteredCount).toBe(2);
    });

    it('returns empty when all below threshold', () => {
      const items = ['A', 'B'];
      const candidates = createTestCandidates(items, [0.3, 0.4]);

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 5, minSimilarity: 0.5 }
      );

      expect(result.selected.length).toBe(0);
      expect(result.stats.filteredCount).toBe(0);
    });
  });

  describe('combinedScore usage', () => {
    it('uses combinedScore when useCombinedScore is true (default)', () => {
      const items = ['low-sim-high-combined', 'high-sim-low-combined'];
      const candidates: ScoredCandidate<string>[] = [
        {
          item: 'low-sim-high-combined',
          embedding: createTestEmbedding(0),
          similarity: 0.5,
          combinedScore: 0.9,
        },
        {
          item: 'high-sim-low-combined',
          embedding: createTestEmbedding(5),
          similarity: 0.9,
          combinedScore: 0.5,
        },
      ];

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 1, useCombinedScore: true }
      );

      // Should prefer high combined score
      expect(result.selected[0].item).toBe('low-sim-high-combined');
    });

    it('uses similarity when useCombinedScore is false', () => {
      const items = ['low-sim-high-combined', 'high-sim-low-combined'];
      const candidates: ScoredCandidate<string>[] = [
        {
          item: 'low-sim-high-combined',
          embedding: createTestEmbedding(0),
          similarity: 0.5,
          combinedScore: 0.9,
        },
        {
          item: 'high-sim-low-combined',
          embedding: createTestEmbedding(5),
          similarity: 0.9,
          combinedScore: 0.5,
        },
      ];

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 1, useCombinedScore: false }
      );

      // Should prefer high similarity
      expect(result.selected[0].item).toBe('high-sim-low-combined');
    });
  });

  describe('result metadata', () => {
    it('includes MMR scores', () => {
      const items = ['A', 'B'];
      const candidates = createTestCandidates(items, [0.9, 0.8]);

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 2, lambda: 0.7 }
      );

      expect(result.selected[0].mmrScore).toBeDefined();
      expect(result.selected[1].mmrScore).toBeDefined();
      // First item's MMR score should be >= second
      expect(result.selected[0].mmrScore).toBeGreaterThanOrEqual(result.selected[1].mmrScore);
    });

    it('includes selection order', () => {
      const items = ['A', 'B', 'C'];
      const candidates = createTestCandidates(items, [0.9, 0.8, 0.7]);

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 3 }
      );

      expect(result.selected[0].selectionOrder).toBe(0);
      expect(result.selected[1].selectionOrder).toBe(1);
      expect(result.selected[2].selectionOrder).toBe(2);
    });

    it('includes accurate stats', () => {
      const items = ['A', 'B', 'C', 'D'];
      const candidates = createTestCandidates(items, [0.9, 0.8, 0.4, 0.3]);

      const result = selectByMMR(
        candidates,
        createTestEmbedding(99),
        { k: 2, minSimilarity: 0.5, lambda: 0.7 }
      );

      expect(result.stats.candidateCount).toBe(4);
      expect(result.stats.filteredCount).toBe(2); // A and B pass threshold
      expect(result.stats.selectedCount).toBe(2);
      expect(result.stats.lambda).toBe(0.7);
    });
  });
});

// ============================================================================
// selectByMMRSimple()
// ============================================================================

describe('selectByMMRSimple', () => {
  it('returns only items (no metadata)', () => {
    const items = ['A', 'B', 'C'];
    const candidates = createTestCandidates(items, [0.9, 0.8, 0.7]);

    const result = selectByMMRSimple(
      candidates,
      createTestEmbedding(99),
      { k: 2 }
    );

    expect(result).toEqual(['A', 'B']);
  });

  it('returns items in selection order', () => {
    const items = ['low', 'high', 'medium'];
    const candidates = createTestCandidates(items, [0.5, 0.9, 0.7]);

    const result = selectByMMRSimple(
      candidates,
      createTestEmbedding(99),
      { k: 3, lambda: 1.0 }
    );

    expect(result[0]).toBe('high');
    expect(result[1]).toBe('medium');
    expect(result[2]).toBe('low');
  });

  it('returns empty array for no candidates', () => {
    const result = selectByMMRSimple([], createTestEmbedding(99), { k: 5 });
    expect(result).toEqual([]);
  });
});

// ============================================================================
// prepareCandidates()
// ============================================================================

describe('prepareCandidates', () => {
  it('transforms items into scored candidates', () => {
    const items = [
      { id: 1, text: 'hello' },
      { id: 2, text: 'world' },
    ];

    const candidates = prepareCandidates(
      items,
      (item) => createTestEmbedding(item.id),
      (item) => item.id * 0.1
    );

    expect(candidates.length).toBe(2);
    expect(candidates[0].item.id).toBe(1);
    expect(candidates[0].similarity).toBe(0.1);
    expect(candidates[0].embedding).toBeInstanceOf(Float32Array);
  });

  it('includes combined score when provided', () => {
    const items = [{ id: 1 }];

    const candidates = prepareCandidates(
      items,
      (item) => createTestEmbedding(item.id),
      () => 0.5,
      (item, sim) => sim * 2
    );

    expect(candidates[0].combinedScore).toBe(1.0);
  });

  it('filters by minSimilarity', () => {
    const items = [
      { id: 1, sim: 0.3 },
      { id: 2, sim: 0.7 },
      { id: 3, sim: 0.5 },
    ];

    const candidates = prepareCandidates(
      items,
      (item) => createTestEmbedding(item.id),
      (item) => item.sim,
      undefined,
      0.5
    );

    expect(candidates.length).toBe(2);
    expect(candidates.map(c => c.item.id)).toEqual([2, 3]);
  });

  it('handles empty input', () => {
    const candidates = prepareCandidates(
      [],
      () => createTestEmbedding(0),
      () => 0.5
    );

    expect(candidates).toEqual([]);
  });

  it('skips items that fail embedding extraction', () => {
    const items = [{ id: 1 }, { id: 2 }];

    const candidates = prepareCandidates(
      items,
      (item) => {
        if (item.id === 1) throw new Error('Embedding failed');
        return createTestEmbedding(item.id);
      },
      () => 0.5
    );

    expect(candidates.length).toBe(1);
    expect(candidates[0].item.id).toBe(2);
  });
});
