/**
 * RAG Storage Utilities
 *
 * @module @persistence/memory/rag/storage
 * @description Barrel export for embedding storage operations.
 *
 * Functions for converting embeddings between computation format (Float32Array)
 * and storage format (ArrayBuffer/BLOB).
 *
 * STORAGE FLOW:
 * ```
 * [AI Model] → Float32Array → embeddingToBlob() → [D1 BLOB]
 * [D1 BLOB] → blobToEmbedding() → Float32Array → [Similarity Calc]
 * ```
 *
 * USAGE:
 * ```typescript
 * import { embeddingToBlob, blobToEmbedding, validateEmbeddingBlob } from '@persistence/memory/rag/storage';
 *
 * // Store embedding
 * const blob = embeddingToBlob(embedding);
 * await db.prepare('UPDATE summaries SET embedding = ?').bind(blob, id).run();
 *
 * // Retrieve embedding
 * const row = await db.prepare('SELECT embedding FROM summaries').first();
 * const embedding = blobToEmbedding(row.embedding);
 *
 * // Validate before use
 * const check = validateEmbeddingBlob(row.embedding);
 * if (!check.valid) console.error(check.error);
 * ```
 *
 * @upstream Used by: platform DB layer, embedding service
 * @downstream Aggregates: blob.ts
 */

// ============================================================================
// BLOB CONVERSION
// ============================================================================
// Convert between Float32Array (computation) and ArrayBuffer (storage).
// Handles D1's quirks with blob formats.

export {
  embeddingToBlob,
  blobToEmbedding,
  validateEmbeddingBlob,
} from './blob';
