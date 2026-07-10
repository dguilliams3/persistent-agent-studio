/**
 * @module @persistence/memory/rag/math/statistics.test
 * @description Unit tests for statistical utility functions
 *
 * Tests cover:
 * - normalizeVector() - unit vector normalization
 * - mean() - arithmetic mean calculation
 * - standardDeviation() - population standard deviation
 * - magnitude() - vector L2 norm
 * - dotProduct() - vector dot product
 *
 * @covers statistics.ts
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeVector,
  mean,
  standardDeviation,
  magnitude,
  dotProduct,
} from './statistics';

// ============================================================================
// normalizeVector()
// ============================================================================

describe('normalizeVector', () => {
  describe('unit vector creation', () => {
    it('normalizes a simple vector to unit length', () => {
      const result = normalizeVector([3, 4]);
      expect(result[0]).toBeCloseTo(0.6, 5);
      expect(result[1]).toBeCloseTo(0.8, 5);
      // Verify magnitude is 1
      const mag = Math.sqrt(result[0] ** 2 + result[1] ** 2);
      expect(mag).toBeCloseTo(1.0, 5);
    });

    it('normalizes a 3D vector', () => {
      const result = normalizeVector([1, 2, 2]);
      // Original magnitude: sqrt(1+4+4) = 3
      expect(result[0]).toBeCloseTo(1 / 3, 5);
      expect(result[1]).toBeCloseTo(2 / 3, 5);
      expect(result[2]).toBeCloseTo(2 / 3, 5);
    });

    it('keeps unit vectors unchanged', () => {
      const unit = [1, 0, 0];
      const result = normalizeVector(unit);
      expect(result[0]).toBeCloseTo(1, 10);
      expect(result[1]).toBeCloseTo(0, 10);
      expect(result[2]).toBeCloseTo(0, 10);
    });
  });

  describe('zero vector handling', () => {
    it('returns zero vector for zero input', () => {
      const result = normalizeVector([0, 0, 0]);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(0);
    });

    it('returns zero vector for all-zero Float32Array', () => {
      const result = normalizeVector(new Float32Array([0, 0]));
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('returns empty Float32Array for empty input', () => {
      const result = normalizeVector([]);
      expect(result.length).toBe(0);
      expect(result).toBeInstanceOf(Float32Array);
    });

    it('handles null/undefined input', () => {
      const result1 = normalizeVector(null as any);
      expect(result1.length).toBe(0);

      const result2 = normalizeVector(undefined as any);
      expect(result2.length).toBe(0);
    });

    it('handles single element vector', () => {
      const result = normalizeVector([5]);
      expect(result[0]).toBeCloseTo(1, 10);
    });

    it('handles negative values', () => {
      const result = normalizeVector([-3, -4]);
      expect(result[0]).toBeCloseTo(-0.6, 5);
      expect(result[1]).toBeCloseTo(-0.8, 5);
    });

    it('handles very small values', () => {
      const result = normalizeVector([1e-10, 0]);
      expect(result[0]).toBeCloseTo(1, 5);
      expect(result[1]).toBeCloseTo(0, 10);
    });
  });

  describe('output type', () => {
    it('always returns Float32Array', () => {
      expect(normalizeVector([1, 2, 3])).toBeInstanceOf(Float32Array);
      expect(normalizeVector(new Float32Array([1, 2, 3]))).toBeInstanceOf(Float32Array);
      expect(normalizeVector([])).toBeInstanceOf(Float32Array);
    });
  });
});

// ============================================================================
// mean()
// ============================================================================

describe('mean', () => {
  describe('basic calculations', () => {
    it('calculates mean of simple array', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3);
    });

    it('calculates mean with decimal result', () => {
      expect(mean([1, 2])).toBe(1.5);
    });

    it('calculates mean of single element', () => {
      expect(mean([10])).toBe(10);
    });

    it('handles negative numbers', () => {
      expect(mean([-1, 0, 1])).toBe(0);
    });

    it('handles all negative numbers', () => {
      expect(mean([-10, -20, -30])).toBe(-20);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for empty array', () => {
      expect(mean([])).toBe(0);
    });

    it('returns 0 for null input', () => {
      expect(mean(null as any)).toBe(0);
    });

    it('returns 0 for undefined input', () => {
      expect(mean(undefined as any)).toBe(0);
    });

    it('handles very large numbers', () => {
      expect(mean([1e10, 2e10, 3e10])).toBe(2e10);
    });

    it('handles very small numbers', () => {
      expect(mean([1e-10, 2e-10, 3e-10])).toBeCloseTo(2e-10, 20);
    });

    it('handles mixed positive and negative', () => {
      expect(mean([100, -50, -50])).toBe(0);
    });
  });

  describe('Float32Array support', () => {
    it('calculates mean of Float32Array', () => {
      const arr = new Float32Array([1, 2, 3, 4, 5]);
      expect(mean(arr)).toBe(3);
    });
  });
});

// ============================================================================
// standardDeviation()
// ============================================================================

describe('standardDeviation', () => {
  describe('basic calculations', () => {
    it('returns 0 for constant values', () => {
      expect(standardDeviation([5, 5, 5, 5])).toBe(0);
    });

    it('calculates standard deviation correctly', () => {
      // Values: 2, 4, 4, 4, 5, 5, 7, 9
      // Mean: 5
      // Variance: ((2-5)^2 + (4-5)^2 + (4-5)^2 + (4-5)^2 + (5-5)^2 + (5-5)^2 + (7-5)^2 + (9-5)^2) / 8
      //         = (9 + 1 + 1 + 1 + 0 + 0 + 4 + 16) / 8 = 32/8 = 4
      // StdDev: sqrt(4) = 2
      expect(standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    });

    it('calculates for simple two-element array', () => {
      // Values: 0, 2
      // Mean: 1
      // Variance: ((0-1)^2 + (2-1)^2) / 2 = (1 + 1) / 2 = 1
      // StdDev: 1
      expect(standardDeviation([0, 2])).toBe(1);
    });

    it('handles negative values', () => {
      // Values: -2, 2
      // Mean: 0
      // Variance: ((-2-0)^2 + (2-0)^2) / 2 = (4 + 4) / 2 = 4
      // StdDev: 2
      expect(standardDeviation([-2, 2])).toBe(2);
    });
  });

  describe('with provided mean', () => {
    it('uses provided mean for calculation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const providedMean = 5;
      expect(standardDeviation(values, providedMean)).toBe(2);
    });

    it('produces correct result with wrong provided mean', () => {
      // If we provide wrong mean, result will be different
      const values = [0, 2]; // Actual mean is 1
      const wrongMean = 0; // Pretend mean is 0
      // Variance with wrong mean: (0^2 + 2^2) / 2 = 2
      // StdDev: sqrt(2)
      expect(standardDeviation(values, wrongMean)).toBeCloseTo(Math.sqrt(2), 10);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for empty array', () => {
      expect(standardDeviation([])).toBe(0);
    });

    it('returns 0 for null input', () => {
      expect(standardDeviation(null as any)).toBe(0);
    });

    it('returns 0 for undefined input', () => {
      expect(standardDeviation(undefined as any)).toBe(0);
    });

    it('returns 0 for single element', () => {
      expect(standardDeviation([42])).toBe(0);
    });
  });

  describe('Float32Array support', () => {
    it('works with Float32Array', () => {
      const arr = new Float32Array([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(standardDeviation(arr)).toBe(2);
    });
  });
});

// ============================================================================
// magnitude()
// ============================================================================

describe('magnitude', () => {
  describe('basic calculations', () => {
    it('calculates magnitude of unit vector', () => {
      expect(magnitude([1, 0, 0])).toBe(1);
    });

    it('calculates 3-4-5 triangle', () => {
      expect(magnitude([3, 4])).toBe(5);
    });

    it('calculates sqrt(3) for (1,1,1)', () => {
      expect(magnitude([1, 1, 1])).toBeCloseTo(Math.sqrt(3), 10);
    });

    it('handles negative values', () => {
      expect(magnitude([-3, -4])).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('returns 0 for zero vector', () => {
      expect(magnitude([0, 0, 0])).toBe(0);
    });

    it('returns 0 for empty array', () => {
      expect(magnitude([])).toBe(0);
    });

    it('returns 0 for null input', () => {
      expect(magnitude(null as any)).toBe(0);
    });

    it('returns 0 for undefined input', () => {
      expect(magnitude(undefined as any)).toBe(0);
    });

    it('handles single element', () => {
      expect(magnitude([5])).toBe(5);
      expect(magnitude([-5])).toBe(5);
    });
  });

  describe('Float32Array support', () => {
    it('works with Float32Array', () => {
      expect(magnitude(new Float32Array([3, 4]))).toBe(5);
    });
  });
});

// ============================================================================
// dotProduct()
// ============================================================================

describe('dotProduct', () => {
  describe('basic calculations', () => {
    it('calculates simple dot product', () => {
      // [1,2,3] . [4,5,6] = 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
      expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
    });

    it('returns 0 for orthogonal vectors', () => {
      expect(dotProduct([1, 0], [0, 1])).toBe(0);
    });

    it('handles negative values', () => {
      expect(dotProduct([1, -1], [1, 1])).toBe(0);
    });

    it('calculates magnitude squared when same vector', () => {
      const v = [3, 4];
      // v . v = |v|^2 = 25
      expect(dotProduct(v, v)).toBe(25);
    });
  });

  describe('commutativity', () => {
    it('is commutative (a.b = b.a)', () => {
      const a = [1, 2, 3];
      const b = [4, 5, 6];
      expect(dotProduct(a, b)).toBe(dotProduct(b, a));
    });
  });

  describe('error handling', () => {
    it('throws for mismatched dimensions', () => {
      expect(() => dotProduct([1, 2, 3], [1, 2])).toThrow('same length');
    });

    it('throws for null vectors', () => {
      expect(() => dotProduct(null as any, [1, 2])).toThrow();
    });

    it('throws for undefined vectors', () => {
      expect(() => dotProduct([1, 2], undefined as any)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles single element vectors', () => {
      expect(dotProduct([5], [3])).toBe(15);
    });

    it('handles empty vectors (same length)', () => {
      expect(dotProduct([], [])).toBe(0);
    });
  });

  describe('Float32Array support', () => {
    it('works with Float32Arrays', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([4, 5, 6]);
      expect(dotProduct(a, b)).toBe(32);
    });

    it('works with mixed types', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = [4, 5, 6];
      expect(dotProduct(a, b)).toBe(32);
    });
  });
});
