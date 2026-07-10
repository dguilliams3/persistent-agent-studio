/**
 * Cloudflare Workers AI Embedding Provider
 *
 * @module @persistence/services/embedding/cloudflare
 * @description Embedding generation using Cloudflare Workers AI.
 *
 * Uses Cloudflare's BGE-base-en-v1.5 model which produces 768-dimensional
 * embeddings optimized for retrieval tasks.
 *
 * ARCHITECTURE:
 * - Thin HTTP client over Cloudflare AI binding
 * - No business logic, just API wrapper
 * - Credential injection via fromBinding factory
 * - Returns ServiceResult for consistent error handling
 *
 * @upstream Called by:
 *   - platforms/cloudflare/src/services/summarization.js - createEmbeddingAdapter()
 *   - Any platform code needing embedding generation
 * @downstream Calls:
 *   - Cloudflare Workers AI binding (env.AI.run)
 *
 * @example
 * import { CloudflareEmbeddingProvider } from '@persistence/services/embedding';
 *
 * // Create provider from Cloudflare AI binding
 * const provider = CloudflareEmbeddingProvider.fromBinding(env.AI);
 *
 * // Generate single embedding
 * const result = await provider.generate('Hello world');
 * if (result.success) {
 *   console.log(`Embedding: ${result.data.length} dimensions`);
 * }
 *
 * // Generate batch
 * const batchResult = await provider.generateBatch(['text1', 'text2']);
 * if (batchResult.success) {
 *   batchResult.data.forEach((emb, i) => console.log(`Text ${i}: ${emb.length} dims`));
 * }
 */

import { success, failure } from '../core/index.js';
import type { ServiceResult } from '../core/index.js';
import type {
  EmbeddingService,
  CloudflareAIBinding,
  CloudflareEmbeddingConfig,
} from './types.js';
import {
  EMBEDDING_MODEL,
  CLOUDFLARE_EMBEDDING_MODEL,
  DEFAULT_MAX_TEXT_LENGTH,
} from './types.js';

/**
 * Embedding provider using Cloudflare Workers AI.
 *
 * Generates 768-dimensional embeddings using BGE-base-en-v1.5.
 * Handles text truncation, batch processing, and error handling.
 *
 * @implements {EmbeddingService}
 *
 * @example
 * const provider = CloudflareEmbeddingProvider.fromBinding(env.AI);
 * const result = await provider.generate('The user discussed career goals...');
 * if (result.success) {
 *   const blob = embeddingToBlob(result.data);
 *   await updateSummaryEmbedding(db, summaryId, blob, provider.model);
 * }
 */
export class CloudflareEmbeddingProvider implements EmbeddingService {
  /**
   * Model identifier for storage/tracking.
   */
  readonly model: string = EMBEDDING_MODEL;

  /**
   * Maximum text length before truncation.
   */
  private readonly maxTextLength: number;

  /**
   * Private constructor - use fromBinding factory.
   */
  private constructor(
    private readonly ai: CloudflareAIBinding,
    config: CloudflareEmbeddingConfig = {}
  ) {
    this.maxTextLength = config.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
  }

  /**
   * Creates a provider from a Cloudflare AI binding.
   *
   * @param ai - Cloudflare Workers AI binding (env.AI)
   * @param config - Optional configuration
   * @returns CloudflareEmbeddingProvider instance
   *
   * @example
   * const provider = CloudflareEmbeddingProvider.fromBinding(env.AI);
   */
  static fromBinding(
    ai: CloudflareAIBinding,
    config: CloudflareEmbeddingConfig = {}
  ): CloudflareEmbeddingProvider {
    return new CloudflareEmbeddingProvider(ai, config);
  }

  /**
   * Generates a vector embedding for the given text.
   *
   * Uses Cloudflare's BGE-base-en-v1.5 model which produces 768-dimensional
   * embeddings. Text is truncated if it exceeds maxTextLength.
   *
   * @upstream Called by: createEmbeddingAdapter() in summarization.js
   * @downstream Calls: env.AI.run('@cf/baai/bge-base-en-v1.5')
   *
   * @param text - Text to generate embedding for
   * @returns ServiceResult with Float32Array embedding on success
   *
   * @example
   * const result = await provider.generate('The user discussed career goals...');
   * if (result.success) {
   *   // result.data is Float32Array with 768 dimensions
   *   const blob = embeddingToBlob(result.data);
   * }
   */
  async generate(text: string): Promise<ServiceResult<Float32Array>> {
    try {
      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return failure(
          'INVALID_INPUT',
          'Text is required for embedding generation'
        );
      }

      // Truncate long texts (BGE model has token limits)
      const truncatedText = text.length > this.maxTextLength
        ? text.substring(0, this.maxTextLength)
        : text;

      console.log(`[Embeddings] Generating embedding for ${truncatedText.length} chars`);

      // Call Cloudflare AI
      const response = await this.ai.run(CLOUDFLARE_EMBEDDING_MODEL, {
        text: truncatedText,
      });

      // Validate response structure
      if (!response || !response.data || !response.data[0]) {
        console.error(
          '[Embeddings] Invalid response structure:',
          JSON.stringify(response).substring(0, 200)
        );
        return failure('SERVICE_ERROR', 'Invalid embedding response structure');
      }

      // Convert to Float32Array
      const embedding = new Float32Array(response.data[0]);
      console.log(`[Embeddings] Generated ${embedding.length}-dimensional embedding`);

      return success(embedding);
    } catch (e) {
      console.error('[Embeddings] Generation error:', e);
      return failure(
        'SERVICE_ERROR',
        e instanceof Error ? e.message : 'Unknown error during embedding generation'
      );
    }
  }

  /**
   * Generates embeddings for multiple texts in a single batch.
   *
   * More efficient than calling generate() in a loop.
   * Returns embeddings in the same order as input texts.
   *
   * @upstream Called by: bulk embedding generation, backfill operations
   * @downstream Calls: env.AI.run('@cf/baai/bge-base-en-v1.5')
   *
   * @param texts - Array of texts to embed
   * @returns ServiceResult with array of Float32Array embeddings on success
   *
   * @example
   * const result = await provider.generateBatch(['text1', 'text2', 'text3']);
   * if (result.success) {
   *   result.data.forEach((emb, i) => console.log(`Text ${i}: ${emb.length} dims`));
   * }
   */
  async generateBatch(texts: string[]): Promise<ServiceResult<Float32Array[]>> {
    try {
      // Validate input
      if (!Array.isArray(texts) || texts.length === 0) {
        return failure('INVALID_INPUT', 'Texts array is required');
      }

      // Truncate each text
      const truncatedTexts = texts.map((t) =>
        t && t.length > this.maxTextLength
          ? t.substring(0, this.maxTextLength)
          : t || ''
      );

      console.log(`[Embeddings] Generating batch of ${truncatedTexts.length} embeddings`);

      // Call Cloudflare AI with batch
      const response = await this.ai.run(CLOUDFLARE_EMBEDDING_MODEL, {
        text: truncatedTexts,
      });

      // Validate response
      if (!response || !response.data) {
        return failure('SERVICE_ERROR', 'Invalid batch embedding response');
      }

      // Convert each to Float32Array
      const embeddings = response.data.map((vec) => new Float32Array(vec));
      console.log(`[Embeddings] Generated ${embeddings.length} embeddings`);

      return success(embeddings);
    } catch (e) {
      console.error('[Embeddings] Batch generation error:', e);
      return failure(
        'SERVICE_ERROR',
        e instanceof Error ? e.message : 'Unknown error during batch embedding generation'
      );
    }
  }
}
