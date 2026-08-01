/**
 * Interface for embedding generation services.
 *
 * Embedding services convert text into dense vector representations
 * for semantic similarity search. All implementations return
 * Float32Array for efficient storage and computation.
 *
 * @downstream CloudflareEmbeddingProvider implements this
 * @downstream memory/rag uses this for semantic retrieval
 * @pattern interface-first — implementations vary, contract is stable
 *
 * @example
 * const provider: EmbeddingService = CloudflareEmbeddingProvider.fromBinding(env.AI);
 * const result = await provider.generate('Hello world');
 * if (result.success) {
 *   console.log(`Generated ${result.data.length}-dimensional embedding`);
 * }
 */

import type { EmbeddingResult } from "./EmbeddingResult.js";

export interface EmbeddingService {
  /**
   * Generates a single embedding for the given text.
   *
   * @param text - Text to generate embedding for
   * @returns EmbeddingResult with Float32Array embedding on success
   */
  generate(text: string): Promise<EmbeddingResult<Float32Array>>;

  /**
   * Generates embeddings for multiple texts in a single batch.
   *
   * More efficient than calling generate() in a loop.
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns EmbeddingResult with array of Float32Array embeddings on success
   */
  generateBatch(texts: string[]): Promise<EmbeddingResult<Float32Array[]>>;

  /**
   * The model identifier used for embeddings.
   * Useful for tracking which model generated each embedding.
   */
  readonly model: string;
}
