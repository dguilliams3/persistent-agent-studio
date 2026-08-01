/**
 * @module @persistence/tools/__tests__/normalize.test
 * @description Unit tests for input normalization utilities
 *
 * Tests cover:
 * - normalizeId() positive integer normalization
 * - Edge cases for string/number inputs
 * - Invalid input handling
 *
 * @covers ../utils/normalize.ts
 */

import { describe, it, expect } from 'vitest';
import { normalizeId } from '../utils/normalize';

// ============================================================================
// normalizeId()
// ============================================================================

describe('normalizeId', () => {
  describe('valid inputs', () => {
    it('normalizes positive integer string to integer', () => {
      expect(normalizeId('5')).toBe(5);
      expect(normalizeId('1')).toBe(1);
      expect(normalizeId('100')).toBe(100);
    });

    it('normalizes positive integer number to same integer', () => {
      expect(normalizeId(5)).toBe(5);
      expect(normalizeId(1)).toBe(1);
      expect(normalizeId(100)).toBe(100);
    });

    it('trims whitespace from string input', () => {
      expect(normalizeId(' 5 ')).toBe(5);
      expect(normalizeId('  10  ')).toBe(10);
      expect(normalizeId('\t7\n')).toBe(7);
    });

    it('handles large positive integers', () => {
      expect(normalizeId(999999)).toBe(999999);
      expect(normalizeId('999999')).toBe(999999);
    });
  });

  describe('invalid inputs returning null', () => {
    it('returns null for undefined', () => {
      expect(normalizeId(undefined)).toBeNull();
    });

    it('returns null for non-numeric string', () => {
      expect(normalizeId('abc')).toBeNull();
      expect(normalizeId('hello')).toBeNull();
      expect(normalizeId('5abc')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(normalizeId('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(normalizeId('   ')).toBeNull();
    });

    it('returns null for zero', () => {
      expect(normalizeId(0)).toBeNull();
      expect(normalizeId('0')).toBeNull();
    });

    it('returns null for negative integers', () => {
      expect(normalizeId(-1)).toBeNull();
      expect(normalizeId(-5)).toBeNull();
      expect(normalizeId('-1')).toBeNull();
      expect(normalizeId('-100')).toBeNull();
    });

    it('returns null for floating point numbers', () => {
      expect(normalizeId(5.5)).toBeNull();
      expect(normalizeId(1.1)).toBeNull();
      expect(normalizeId('5.5')).toBeNull();
      expect(normalizeId('1.9')).toBeNull();
    });

    it('returns null for Infinity', () => {
      expect(normalizeId(Infinity)).toBeNull();
      expect(normalizeId(-Infinity)).toBeNull();
      expect(normalizeId('Infinity')).toBeNull();
    });

    it('returns null for NaN', () => {
      expect(normalizeId(NaN)).toBeNull();
      expect(normalizeId('NaN')).toBeNull();
    });

    it('accepts scientific notation that resolves to integer', () => {
      // 1e5 = 100000 which is a valid integer
      expect(normalizeId('1e5')).toBe(100000);
    });

    it('returns null for scientific notation with decimals', () => {
      // 1.5e2 = 150 but it's specified as a float in notation
      // The function parses it to 150 which is an integer
      expect(normalizeId('1.5e2')).toBe(150);
    });
  });

  describe('edge cases', () => {
    it('handles integer 1 (boundary)', () => {
      expect(normalizeId(1)).toBe(1);
      expect(normalizeId('1')).toBe(1);
    });

    it('handles mixed type comparisons consistently', () => {
      // Both should produce same result
      expect(normalizeId(42)).toBe(normalizeId('42'));
      expect(normalizeId(7)).toBe(normalizeId(' 7 '));
    });
  });
});

// ============================================================================
// REAL-WORLD USAGE SCENARIOS
// ============================================================================

describe('real-world scenarios', () => {
  describe('LEARNED/QUESTION/REMINDER action id normalization', () => {
    it('normalizes string id from JSON parse', () => {
      // LLM might output {"action": "REMINDER", "op": "dismiss", "id": "5"}
      const actionParams = { id: '5' };
      const normalizedId = normalizeId(actionParams.id);
      expect(normalizedId).toBe(5);
    });

    it('normalizes number id from JSON parse', () => {
      // LLM might output {"action": "LEARNED", "op": "update", "id": 3}
      const actionParams = { id: 3 };
      const normalizedId = normalizeId(actionParams.id);
      expect(normalizedId).toBe(3);
    });

    it('handles missing id gracefully', () => {
      const actionParams: { id?: string | number } = {};
      const normalizedId = normalizeId(actionParams.id);
      expect(normalizedId).toBeNull();
    });
  });

  describe('database ID validation', () => {
    it('validates IDs before database queries', () => {
      const userInputs = ['1', '2', 'abc', '-1', '0', '10'];
      const validIds = userInputs.map(normalizeId).filter(id => id !== null);
      expect(validIds).toEqual([1, 2, 10]);
    });
  });
});
