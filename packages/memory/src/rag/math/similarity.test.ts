/**
 * @module @persistence/memory/rag/math/similarity.test
 * @description Unit tests for vector similarity functions
 *
 * Tests cover:
 * - cosineSimilarity() - angle-based similarity calculation
 * - euclideanDistance() - straight-line distance calculation
 * - distanceToSimilarity() - distance to similarity conversion
 *
 * @covers similarity.ts
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  euclideanDistance,
  distanceToSimilarity,
} from './similarity';

// ============================================================================
// cosineSimilarity()
// ============================================================================

describe('cosineSimilarity', () => {
  describe('identical vectors', () => {
    it('returns 1.0 for identical vectors', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
    });

    it('returns 1.0 for identical scaled vectors', () => {
      const a = [1, 2, 3];
      const b = [2, 4, 6]; // Same direction, different magnitude
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
    });

    it('returns 1.0 for complex identical vectors', () => {
      const a = [0.5, -0.3, 0.8, 0.1];
      const b = [0.5, -0.3, 0.8, 0.1];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
    });
  });

  describe('orthogonal vectors', () => {
    it('returns 0 for orthogonal unit vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
    });

    it('returns 0 for orthogonal non-unit vectors', () => {
      const a = [3, 0];
      const b = [0, 5];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
    });
  });

  describe('opposite vectors', () => {
    it('returns -1.0 for opposite vectors', () => {
      const a = [1, 0, 0];
      const b = [-1, 0, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
    });

    it('returns -1.0 for negated vectors', () => {
      const a = [1, 2, 3];
      const b = [-1, -2, -3];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
    });
  });

  describe('partial similarity', () => {
    it('returns ~0.707 for 45-degree angle', () => {
      const a = [1, 0];
      const b = [1, 1]; // 45 degrees from a
      // cos(45) = sqrt(2)/2 ≈ 0.707
      const expected = Math.sqrt(2) / 2;
      expect(cosineSimilarity(a, b)).toBeCloseTo(expected, 5);
    });

    it('returns positive for similar vectors', () => {
      const a = [1, 2, 3];
      const b = [1.1, 2.1, 3.1];
      expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for zero vectors', () => {
      const a = [0, 0, 0];
      const b = [1, 2, 3];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('returns 0 when both vectors are zero', () => {
      const a = [0, 0];
      const b = [0, 0];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('handles single-element vectors', () => {
      const a = [5];
      const b = [3];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
    });

    it('handles single negative element', () => {
      const a = [5];
      const b = [-3];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
    });

    it('handles Float32Array inputs', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0, 10);
    });
  });

  describe('error handling', () => {
    it('throws for mismatched dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => cosineSimilarity(a, b)).toThrow('dimension mismatch');
    });

    it('throws for different length Float32Arrays', () => {
      const a = new Float32Array([1, 2, 3, 4]);
      const b = new Float32Array([1, 2]);
      expect(() => cosineSimilarity(a, b)).toThrow('dimension mismatch');
    });
  });

  describe('realistic embedding scenarios', () => {
    it('handles 768-dimensional vectors', () => {
      // Simulate BGE embedding dimension
      const a = new Float32Array(768);
      const b = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        a[i] = Math.random() - 0.5;
        b[i] = Math.random() - 0.5;
      }
      const sim = cosineSimilarity(a, b);
      // Random vectors should have similarity near 0 but within [-1, 1]
      expect(sim).toBeGreaterThanOrEqual(-1);
      expect(sim).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================================================
// euclideanDistance()
// ============================================================================

describe('euclideanDistance', () => {
  describe('zero distance', () => {
    it('returns 0 for identical vectors', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3];
      expect(euclideanDistance(a, b)).toBe(0);
    });

    it('returns 0 for identical Float32Arrays', () => {
      const a = new Float32Array([0.5, 0.3, 0.8]);
      const b = new Float32Array([0.5, 0.3, 0.8]);
      expect(euclideanDistance(a, b)).toBeCloseTo(0, 10);
    });
  });

  describe('unit distance', () => {
    it('returns 1 for unit distance in 1D', () => {
      const a = [0];
      const b = [1];
      expect(euclideanDistance(a, b)).toBe(1);
    });

    it('returns 1 for adjacent points on axis', () => {
      const a = [0, 0, 0];
      const b = [1, 0, 0];
      expect(euclideanDistance(a, b)).toBe(1);
    });
  });

  describe('known distances', () => {
    it('calculates 3-4-5 triangle correctly', () => {
      const a = [0, 0];
      const b = [3, 4];
      expect(euclideanDistance(a, b)).toBe(5);
    });

    it('calculates sqrt(2) for diagonal', () => {
      const a = [0, 0];
      const b = [1, 1];
      expect(euclideanDistance(a, b)).toBeCloseTo(Math.sqrt(2), 10);
    });

    it('calculates distance in 3D space', () => {
      const a = [0, 0, 0];
      const b = [1, 1, 1];
      expect(euclideanDistance(a, b)).toBeCloseTo(Math.sqrt(3), 10);
    });
  });

  describe('symmetry', () => {
    it('is symmetric (distance(a,b) = distance(b,a))', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      expect(euclideanDistance(a, b)).toBe(euclideanDistance(b, a));
    });
  });

  describe('error handling', () => {
    it('throws for mismatched dimensions', () => {
      const a = [1, 2, 3];
      const b = [1, 2];
      expect(() => euclideanDistance(a, b)).toThrow('same length');
    });

    it('throws for null vectors', () => {
      expect(() => euclideanDistance(null as any, [1, 2])).toThrow();
    });

    it('throws for undefined vectors', () => {
      expect(() => euclideanDistance([1, 2], undefined as any)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles empty arrays (same length)', () => {
      // Empty arrays technically have the same length
      const a: number[] = [];
      const b: number[] = [];
      expect(euclideanDistance(a, b)).toBe(0);
    });

    it('handles very small values', () => {
      const a = [1e-10, 1e-10];
      const b = [0, 0];
      const expected = Math.sqrt(2) * 1e-10;
      expect(euclideanDistance(a, b)).toBeCloseTo(expected, 15);
    });

    it('handles very large values', () => {
      const a = [1e6, 1e6];
      const b = [0, 0];
      const expected = Math.sqrt(2) * 1e6;
      expect(euclideanDistance(a, b)).toBeCloseTo(expected, 0);
    });
  });
});

// ============================================================================
// distanceToSimilarity()
// ============================================================================

describe('distanceToSimilarity', () => {
  describe('basic conversion', () => {
    it('returns 1 for distance 0', () => {
      expect(distanceToSimilarity(0)).toBe(1);
    });

    it('returns 0.5 for distance 1', () => {
      expect(distanceToSimilarity(1)).toBe(0.5);
    });

    it('returns ~0.333 for distance 2', () => {
      expect(distanceToSimilarity(2)).toBeCloseTo(1 / 3, 10);
    });

    it('returns ~0.1 for distance 9', () => {
      expect(distanceToSimilarity(9)).toBeCloseTo(0.1, 10);
    });
  });

  describe('bounds', () => {
    it('always returns value in (0, 1]', () => {
      for (const distance of [0, 0.1, 1, 10, 100, 1000]) {
        const similarity = distanceToSimilarity(distance);
        expect(similarity).toBeGreaterThan(0);
        expect(similarity).toBeLessThanOrEqual(1);
      }
    });

    it('approaches 0 for very large distances', () => {
      expect(distanceToSimilarity(1000000)).toBeLessThan(0.001);
    });
  });

  describe('monotonicity', () => {
    it('decreases as distance increases', () => {
      const sim0 = distanceToSimilarity(0);
      const sim1 = distanceToSimilarity(1);
      const sim10 = distanceToSimilarity(10);
      const sim100 = distanceToSimilarity(100);

      expect(sim0).toBeGreaterThan(sim1);
      expect(sim1).toBeGreaterThan(sim10);
      expect(sim10).toBeGreaterThan(sim100);
    });
  });
});
