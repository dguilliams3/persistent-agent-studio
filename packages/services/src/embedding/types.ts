/**
 * Embedding Service Types
 *
 * @module @persistence/services/embedding/types
 * @description Type definitions for embedding generation services.
 *
 * DESIGN PRINCIPLES:
 * - Interface-first: EmbeddingService defines the contract, implementations vary
 * - Float32Array for embeddings: Efficient storage and computation
 * - ServiceResult wrapper: Consistent error handling across providers
 *
 * @upstream Used by: @persistence/services/embedding/cloudflare.ts
 * @downstream Used by: @persistence/memory/rag (orchestrators need embeddings)
 */

import type { ServiceResult } from '../core/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interface for embedding generation services.
 *
 * Embedding services convert text into dense vector representations
 * for semantic similarity search. All implementations must return
 * Float32Array for efficient storage and computation.
 *
 * @example
 * const provider: EmbeddingService = CloudflareEmbeddingProvider.fromBinding(env.AI);
 * const result = await provider.generate('Hello world');
 * if (result.success) {
 *   console.log(`Generated ${result.data.length}-dimensional embedding`);
 * }
 */
export interface EmbeddingService {
  /**
   * Generates a single embedding for the given text.
   *
   * @param text - Text to generate embedding for
   * @returns ServiceResult with Float32Array embedding on success
   */
  generate(text: string): Promise<ServiceResult<Float32Array>>;

  /**
   * Generates embeddings for multiple texts in a single batch.
   *
   * More efficient than calling generate() in a loop.
   *
   * @param texts - Array of texts to generate embeddings for
   * @returns ServiceResult with array of Float32Array embeddings on success
   */
  generateBatch(texts: string[]): Promise<ServiceResult<Float32Array[]>>;

  /**
   * The model identifier used for embeddings.
   * Useful for tracking which model generated each embedding.
   */
  readonly model: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLOUDFLARE AI BINDING TYPE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cloudflare Workers AI binding type for embedding generation.
 *
 * This is the shape of env.AI in a Cloudflare Worker.
 * The binding provides access to Cloudflare's AI models.
 *
 * @example
 * // In a Cloudflare Worker:
 * export default {
 *   async fetch(request, env) {
 *     const ai: CloudflareAIBinding = env.AI;
 *     const result = await ai.run('@cf/baai/bge-base-en-v1.5', { text: 'Hello' });
 *     // result.data is [[...768 floats...]]
 *   }
 * }
 */
export interface CloudflareAIBinding {
  /**
   * Run an AI model with the given input.
   *
   * For embedding models, input should have a `text` property
   * that is either a string or array of strings.
   *
   * @param model - Model identifier (e.g., '@cf/baai/bge-base-en-v1.5')
   * @param input - Model-specific input
   * @returns Model-specific output
   */
  run(
    model: string,
    input: { text: string | string[] }
  ): Promise<{
    /** Array of embedding vectors. Each vector is an array of floats. */
    data: number[][];
    /** Shape of the output: [batch_size, embedding_dimension] */
    shape: number[];
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configuration for CloudflareEmbeddingProvider.
 */
export interface CloudflareEmbeddingConfig {
  /**
   * Maximum text length before truncation.
   * BGE models have token limits; ~8000 chars is safe.
   *
   * @default 8000
   */
  maxTextLength?: number;
}

/**
 * Default embedding model identifier.
 *
 * BGE-base-en-v1.5 produces 768-dimensional embeddings
 * optimized for English text retrieval.
 */
export const EMBEDDING_MODEL = 'bge-base-en-v1.5';

/**
 * Full Cloudflare AI model path for BGE.
 */
export const CLOUDFLARE_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

/**
 * Embedding dimension for BGE-base-en-v1.5.
 */
export const EMBEDDING_DIMENSION = 768;

/**
 * Default maximum text length for truncation.
 */
export const DEFAULT_MAX_TEXT_LENGTH = 8000;
