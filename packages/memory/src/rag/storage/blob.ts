/**
 * Embedding Blob Conversion
 *
 * @module @persistence/memory/rag/storage/blob
 * @description Pure functions for converting embeddings to/from D1 BLOB format.
 *
 * D1 (SQLite) stores embeddings as BLOBs. These functions handle the
 * conversion between Float32Array (for computation) and ArrayBuffer
 * (for storage).
 *
 * STORAGE FORMAT:
 * - Database stores: ArrayBuffer (raw bytes)
 * - D1 returns: Array of bytes (when reading)
 * - Computation uses: Float32Array (for math operations)
 *
 * ROUND-TRIP:
 * Float32Array → embeddingToBlob → D1 storage → blobToEmbedding → Float32Array
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/db/summaries.js - On summary creation
 *   - platforms/cloudflare/src/services/embeddings.js - On retrieval
 * @downstream Calls:
 *   - None (pure conversion)
 */

import type { EmbeddingFloat32 } from '../types';

/**
 * @description Converts a Float32Array embedding to an ArrayBuffer for D1 storage.
 *
 * D1 stores BLOBs as ArrayBuffer. This function extracts the underlying
 * buffer from a Float32Array, handling the case where the Float32Array
 * may be a view of a larger buffer.
 *
 * @upstream Called by: platforms/cloudflare/src/db/summaries.js addSummary()
 * @downstream Calls: None (pure conversion)
 *
 * @param {EmbeddingFloat32} embedding - The Float32Array embedding
 * @returns {ArrayBuffer} ArrayBuffer suitable for D1 BLOB storage
 *
 * @example
 * const embedding = result.embedding; // Float32Array(768)
 * const blob = embeddingToBlob(embedding);
 * await db.prepare('UPDATE summaries SET embedding = ? WHERE id = ?').bind(blob, id).run();
 *
 * @note The slice() is necessary because Float32Array.buffer might be a
 * view of a larger ArrayBuffer. We need to extract just the relevant portion.
 */
export function embeddingToBlob(embedding: EmbeddingFloat32): ArrayBuffer {
  // D1 expects BLOB data as ArrayBuffer for BLOB storage
  // Return the underlying ArrayBuffer of the Float32Array
  // Use slice to handle the case where Float32Array is a view of a larger buffer
  // Note: slice() returns ArrayBuffer | SharedArrayBuffer, but D1 always uses ArrayBuffer
  return embedding.buffer.slice(
    embedding.byteOffset,
    embedding.byteOffset + embedding.byteLength
  ) as ArrayBuffer;
}

/**
 * @description Converts a D1 BLOB back to a Float32Array embedding.
 *
 * Handles multiple formats that D1 might return:
 * - Array of bytes (most common from D1 queries)
 * - Uint8Array (from some storage formats)
 * - ArrayBuffer (direct storage format)
 *
 * @upstream Called by: findSimilarSummaries(), retrieveRelevantSummaries(), rag/retrieval/mmr.ts
 * @downstream Calls: None (pure conversion)
 *
 * @param {ArrayBuffer|Uint8Array|number[]} blob - The stored BLOB from D1 (various formats)
 * @returns {EmbeddingFloat32} Float32Array embedding ready for math operations
 *
 * @example
 * const row = await db.prepare('SELECT embedding FROM summaries WHERE id = ?').bind(id).first();
 * const embedding = blobToEmbedding(row.embedding);
 * const similarity = cosineSimilarity(queryEmbedding, embedding);
 *
 * @note D1 returns BLOBs as JavaScript Arrays of bytes, not ArrayBuffers.
 * This is a quirk of the D1 API we need to handle.
 */
export function blobToEmbedding(
  blob: ArrayBuffer | Uint8Array | number[]
): EmbeddingFloat32 {
  // D1 returns BLOBs as JavaScript Arrays of bytes, not ArrayBuffers
  // We need to convert to Uint8Array first, then view as Float32Array
  if (Array.isArray(blob)) {
    const buffer = new Uint8Array(blob).buffer;
    return new Float32Array(buffer);
  }

  // Handle Uint8Array (from previous storage format)
  if (blob instanceof Uint8Array) {
    return new Float32Array(blob.buffer);
  }

  // Handle ArrayBuffer (current storage format)
  if (blob instanceof ArrayBuffer) {
    return new Float32Array(blob);
  }

  // Fallback for other formats - try direct conversion
  return new Float32Array(blob as ArrayBuffer);
}

/**
 * @description Validates that a blob contains a valid embedding.
 *
 * Checks that the blob:
 * - Can be converted to a Float32Array
 * - Has the expected dimension (768 for BGE model)
 * - Contains valid floating-point values (no NaN/Infinity)
 *
 * @upstream Called by: Data validation, retrieval pipelines, quality checks
 * @downstream Calls: blobToEmbedding()
 *
 * @param {ArrayBuffer|Uint8Array|number[]|null|undefined} blob - The blob to validate
 * @param {number} [expectedDimension=768] - Expected embedding dimension (default: 768)
 * @returns {Object} Object with valid flag and optional error message
 *
 * @example
 * const result = validateEmbeddingBlob(row.embedding);
 * if (!result.valid) {
 *   console.error('Invalid embedding:', result.error);
 * }
 */
export function validateEmbeddingBlob(
  blob: ArrayBuffer | Uint8Array | number[] | null | undefined,
  expectedDimension: number = 768
): { valid: boolean; error?: string } {
  if (!blob) {
    return { valid: false, error: 'Blob is null or undefined' };
  }

  try {
    const embedding = blobToEmbedding(blob);

    if (embedding.length !== expectedDimension) {
      return {
        valid: false,
        error: `Wrong dimension: expected ${expectedDimension}, got ${embedding.length}`,
      };
    }

    // Check for invalid values
    for (let i = 0; i < embedding.length; i++) {
      if (!Number.isFinite(embedding[i])) {
        return {
          valid: false,
          error: `Invalid value at index ${i}: ${embedding[i]}`,
        };
      }
    }

    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: `Conversion failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
