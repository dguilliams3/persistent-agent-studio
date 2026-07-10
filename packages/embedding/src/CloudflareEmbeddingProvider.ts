/**
 * Cloudflare Workers AI Embedding Provider
 *
 * @module @persistence/embedding/CloudflareEmbeddingProvider
 * @description Embedding generation using Cloudflare Workers AI.
 *
 * Uses Cloudflare's BGE-base-en-v1.5 model which produces 768-dimensional
 * embeddings optimized for retrieval tasks.
 *
 * @upstream Called by:
 *   - platforms/cloudflare — createEmbeddingAdapter()
 *   - memory/sim/routes — backfill operations
 * @downstream Calls:
 *   - Cloudflare Workers AI binding (env.AI.run)
 *
 * @example
 * import { CloudflareEmbeddingProvider } from '@persistence/embedding';
 *
 * const provider = CloudflareEmbeddingProvider.fromBinding(env.AI);
 * const result = await provider.generate('Hello world');
 * if (result.success) {
 *   console.log(`Embedding: ${result.data.length} dimensions`);
 * }
 */

import type { EmbeddingResult } from "./EmbeddingResult.js";
import { embeddingSuccess, embeddingFailure } from "./EmbeddingResult.js";
import type { EmbeddingService } from "./EmbeddingService.js";
import type { CloudflareAIBinding } from "./CloudflareAIBinding.js";
import type { CloudflareEmbeddingConfiguration } from "./CloudflareEmbeddingConfiguration.js";
import {
  EMBEDDING_MODEL,
  CLOUDFLARE_EMBEDDING_MODEL,
  DEFAULT_MAX_TEXT_LENGTH,
} from "./EmbeddingModel.js";

/**
 * Embedding provider using Cloudflare Workers AI.
 *
 * Generates 768-dimensional embeddings using BGE-base-en-v1.5.
 * Handles text truncation, batch processing, and error handling.
 *
 * @implements {EmbeddingService}
 */
export class CloudflareEmbeddingProvider implements EmbeddingService {
  readonly model: string = EMBEDDING_MODEL;
  private readonly maxTextLength: number;

  private constructor(
    private readonly ai: CloudflareAIBinding,
    configuration: CloudflareEmbeddingConfiguration = {},
  ) {
    this.maxTextLength = configuration.maxTextLength ?? DEFAULT_MAX_TEXT_LENGTH;
  }

  /**
   * Creates a provider from a Cloudflare AI binding.
   *
   * @param ai - Cloudflare Workers AI binding (env.AI)
   * @param configuration - Optional configuration
   * @returns CloudflareEmbeddingProvider instance
   */
  static fromBinding(
    ai: CloudflareAIBinding,
    configuration: CloudflareEmbeddingConfiguration = {},
  ): CloudflareEmbeddingProvider {
    return new CloudflareEmbeddingProvider(ai, configuration);
  }

  /**
   * Generates a vector embedding for the given text.
   *
   * @downstream Calls: env.AI.run('@cf/baai/bge-base-en-v1.5')
   */
  async generate(text: string): Promise<EmbeddingResult<Float32Array>> {
    try {
      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return embeddingFailure(
          "INVALID_INPUT",
          "Text is required for embedding generation",
        );
      }

      const truncatedText =
        text.length > this.maxTextLength
          ? text.substring(0, this.maxTextLength)
          : text;

      console.log(
        `[Embeddings] Generating embedding for ${truncatedText.length} chars`,
      );

      const response = await this.ai.run(CLOUDFLARE_EMBEDDING_MODEL, {
        text: truncatedText,
      });

      if (!response || !response.data || !response.data[0]) {
        console.error(
          "[Embeddings] Invalid response structure:",
          JSON.stringify(response).substring(0, 200),
        );
        return embeddingFailure(
          "SERVICE_ERROR",
          "Invalid embedding response structure",
        );
      }

      const embedding = new Float32Array(response.data[0]);
      console.log(
        `[Embeddings] Generated ${embedding.length}-dimensional embedding`,
      );

      return embeddingSuccess(embedding);
    } catch (error) {
      console.error("[Embeddings] Generation error:", error);
      return embeddingFailure(
        "SERVICE_ERROR",
        error instanceof Error
          ? error.message
          : "Unknown error during embedding generation",
      );
    }
  }

  /**
   * Generates embeddings for multiple texts in a single batch.
   *
   * @downstream Calls: env.AI.run('@cf/baai/bge-base-en-v1.5')
   */
  async generateBatch(
    texts: string[],
  ): Promise<EmbeddingResult<Float32Array[]>> {
    try {
      if (!Array.isArray(texts) || texts.length === 0) {
        return embeddingFailure("INVALID_INPUT", "Texts array is required");
      }

      const truncatedTexts = texts.map((text) =>
        text && text.length > this.maxTextLength
          ? text.substring(0, this.maxTextLength)
          : text || "",
      );

      console.log(
        `[Embeddings] Generating batch of ${truncatedTexts.length} embeddings`,
      );

      const response = await this.ai.run(CLOUDFLARE_EMBEDDING_MODEL, {
        text: truncatedTexts,
      });

      if (!response || !response.data) {
        return embeddingFailure(
          "SERVICE_ERROR",
          "Invalid batch embedding response",
        );
      }

      const embeddings = response.data.map(
        (vector) => new Float32Array(vector),
      );
      console.log(`[Embeddings] Generated ${embeddings.length} embeddings`);

      return embeddingSuccess(embeddings);
    } catch (error) {
      console.error("[Embeddings] Batch generation error:", error);
      return embeddingFailure(
        "SERVICE_ERROR",
        error instanceof Error
          ? error.message
          : "Unknown error during batch embedding generation",
      );
    }
  }
}
