/**
 * @module @persistence/memory/rag/storage/blob.test
 * @description Unit tests for embedding blob conversion functions
 *
 * Tests cover:
 * - embeddingToBlob() - Float32Array to ArrayBuffer conversion
 * - blobToEmbedding() - ArrayBuffer/Uint8Array/Array to Float32Array
 * - validateEmbeddingBlob() - validation with dimension checking
 *
 * @covers blob.ts
 */

import { describe, it, expect } from 'vitest';
import {
  embeddingToBlob,
  blobToEmbedding,
  validateEmbeddingBlob,
} from './blob';

// ============================================================================
// embeddingToBlob()
// ============================================================================

describe('embeddingToBlob', () => {
  describe('basic conversion', () => {
    it('converts Float32Array to ArrayBuffer', () => {
      const embedding = new Float32Array([0.1, 0.2, 0.3]);
      const blob = embeddingToBlob(embedding);

      expect(blob).toBeInstanceOf(ArrayBuffer);
      expect(blob.byteLength).toBe(embedding.byteLength);
    });

    it('preserves values through round-trip', () => {
      const original = new Float32Array([0.1, -0.5, 0.9, 0.0]);
      const blob = embeddingToBlob(original);
      const recovered = new Float32Array(blob);

      expect(recovered.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(recovered[i]).toBeCloseTo(original[i], 5);
      }
    });

    it('handles 768-dimensional embeddings', () => {
      const embedding = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        embedding[i] = Math.random() - 0.5;
      }
      const blob = embeddingToBlob(embedding);

      expect(blob.byteLength).toBe(768 * 4); // 4 bytes per float32
    });
  });

  describe('edge cases', () => {
    it('handles empty Float32Array', () => {
      const embedding = new Float32Array(0);
      const blob = embeddingToBlob(embedding);
      expect(blob.byteLength).toBe(0);
    });

    it('handles single element', () => {
      const embedding = new Float32Array([42.5]);
      const blob = embeddingToBlob(embedding);
      const recovered = new Float32Array(blob);
      expect(recovered[0]).toBeCloseTo(42.5, 5);
    });

    it('handles view of larger buffer correctly', () => {
      // Create a Float32Array that is a view of a larger buffer
      const largeBuffer = new ArrayBuffer(100);
      const view = new Float32Array(largeBuffer, 8, 3); // Start at byte 8, 3 elements
      view[0] = 1.0;
      view[1] = 2.0;
      view[2] = 3.0;

      const blob = embeddingToBlob(view);
      const recovered = new Float32Array(blob);

      expect(recovered.length).toBe(3);
      expect(recovered[0]).toBeCloseTo(1.0, 5);
      expect(recovered[1]).toBeCloseTo(2.0, 5);
      expect(recovered[2]).toBeCloseTo(3.0, 5);
    });
  });

  describe('special values', () => {
    it('handles negative values', () => {
      const embedding = new Float32Array([-0.1, -0.5, -0.9]);
      const blob = embeddingToBlob(embedding);
      const recovered = new Float32Array(blob);

      expect(recovered[0]).toBeCloseTo(-0.1, 5);
      expect(recovered[1]).toBeCloseTo(-0.5, 5);
      expect(recovered[2]).toBeCloseTo(-0.9, 5);
    });

    it('handles very small values', () => {
      const embedding = new Float32Array([1e-10, 1e-20, 1e-30]);
      const blob = embeddingToBlob(embedding);
      const recovered = new Float32Array(blob);

      expect(recovered[0]).toBeCloseTo(1e-10, 15);
    });

    it('handles very large values', () => {
      const embedding = new Float32Array([1e10, 1e20, 1e30]);
      const blob = embeddingToBlob(embedding);
      const recovered = new Float32Array(blob);

      expect(recovered[0]).toBeCloseTo(1e10, -5);
    });
  });
});

// ============================================================================
// blobToEmbedding()
// ============================================================================

describe('blobToEmbedding', () => {
  describe('from ArrayBuffer', () => {
    it('converts ArrayBuffer to Float32Array', () => {
      const original = new Float32Array([0.1, 0.2, 0.3]);
      const buffer = original.buffer.slice(0);
      const result = blobToEmbedding(buffer);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(3);
    });

    it('preserves values from ArrayBuffer', () => {
      const original = new Float32Array([0.1, -0.5, 0.9]);
      const buffer = original.buffer.slice(0);
      const result = blobToEmbedding(buffer);

      expect(result[0]).toBeCloseTo(0.1, 5);
      expect(result[1]).toBeCloseTo(-0.5, 5);
      expect(result[2]).toBeCloseTo(0.9, 5);
    });
  });

  describe('from Uint8Array', () => {
    it('converts Uint8Array to Float32Array', () => {
      const original = new Float32Array([0.1, 0.2, 0.3]);
      const uint8 = new Uint8Array(original.buffer);
      const result = blobToEmbedding(uint8);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(3);
    });
  });

  describe('from number array (D1 format)', () => {
    it('converts number array to Float32Array', () => {
      // D1 returns BLOBs as arrays of bytes
      const original = new Float32Array([0.5, -0.5]);
      const uint8Array = new Uint8Array(original.buffer);
      const numberArray = Array.from(uint8Array);

      const result = blobToEmbedding(numberArray);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result[0]).toBeCloseTo(0.5, 5);
      expect(result[1]).toBeCloseTo(-0.5, 5);
    });

    it('handles 768-dimensional from number array', () => {
      const original = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        original[i] = (i / 768) - 0.5;
      }
      const uint8Array = new Uint8Array(original.buffer);
      const numberArray = Array.from(uint8Array);

      const result = blobToEmbedding(numberArray);

      expect(result.length).toBe(768);
      expect(result[0]).toBeCloseTo(original[0], 5);
      expect(result[383]).toBeCloseTo(original[383], 5);
      expect(result[767]).toBeCloseTo(original[767], 5);
    });
  });

  describe('round-trip integrity', () => {
    it('preserves values through embeddingToBlob -> blobToEmbedding', () => {
      const original = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        original[i] = Math.random() * 2 - 1;
      }

      const blob = embeddingToBlob(original);
      const recovered = blobToEmbedding(blob);

      expect(recovered.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(recovered[i]).toBeCloseTo(original[i], 5);
      }
    });

    it('handles D1-style round trip (blob -> number[] -> Float32Array)', () => {
      const original = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const blob = embeddingToBlob(original);

      // Simulate D1 returning as number array
      const uint8View = new Uint8Array(blob);
      const d1Response = Array.from(uint8View);

      const recovered = blobToEmbedding(d1Response);

      expect(recovered.length).toBe(original.length);
      for (let i = 0; i < original.length; i++) {
        expect(recovered[i]).toBeCloseTo(original[i], 5);
      }
    });
  });
});

// ============================================================================
// validateEmbeddingBlob()
// ============================================================================

describe('validateEmbeddingBlob', () => {
  describe('valid embeddings', () => {
    it('validates correct 768-dimensional embedding', () => {
      const embedding = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        embedding[i] = Math.random() - 0.5;
      }
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('validates embedding from number array', () => {
      const embedding = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        embedding[i] = Math.random() - 0.5;
      }
      const numberArray = Array.from(new Uint8Array(embedding.buffer));

      const result = validateEmbeddingBlob(numberArray);
      expect(result.valid).toBe(true);
    });

    it('validates custom dimension', () => {
      const embedding = new Float32Array(384); // Different dimension
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob, 384);
      expect(result.valid).toBe(true);
    });
  });

  describe('null/undefined handling', () => {
    it('rejects null blob', () => {
      const result = validateEmbeddingBlob(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('null or undefined');
    });

    it('rejects undefined blob', () => {
      const result = validateEmbeddingBlob(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('null or undefined');
    });
  });

  describe('dimension validation', () => {
    it('rejects wrong dimension', () => {
      const embedding = new Float32Array(512); // Wrong dimension
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob, 768);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Wrong dimension');
      expect(result.error).toContain('expected 768');
      expect(result.error).toContain('got 512');
    });

    it('rejects empty embedding against non-zero dimension', () => {
      const embedding = new Float32Array(0);
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob, 768);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Wrong dimension');
    });
  });

  describe('invalid value detection', () => {
    it('rejects NaN values', () => {
      const embedding = new Float32Array(768);
      embedding[100] = NaN;
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid value');
      expect(result.error).toContain('index 100');
    });

    it('rejects Infinity values', () => {
      const embedding = new Float32Array(768);
      embedding[50] = Infinity;
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid value');
      expect(result.error).toContain('index 50');
    });

    it('rejects negative Infinity values', () => {
      const embedding = new Float32Array(768);
      embedding[200] = -Infinity;
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid value');
    });
  });

  describe('edge cases', () => {
    it('validates embedding with zeros', () => {
      const embedding = new Float32Array(768); // All zeros
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob);
      expect(result.valid).toBe(true);
    });

    it('validates single-element embedding with custom dimension', () => {
      const embedding = new Float32Array([0.5]);
      const blob = embeddingToBlob(embedding);

      const result = validateEmbeddingBlob(blob, 1);
      expect(result.valid).toBe(true);
    });
  });
});
