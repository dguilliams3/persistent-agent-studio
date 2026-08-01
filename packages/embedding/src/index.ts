/**
 * @persistence/embedding — Vector embedding generation.
 *
 * @description
 * Platform-agnostic embedding service for semantic similarity search.
 * Produces 768-dimensional vectors using BGE-base-en-v1.5.
 * Zero package dependencies — true leaf node in the dependency graph.
 *
 * @downstream @persistence/memory — SIM embedding backfill and semantic retrieval
 * @downstream @persistence/services — re-exports for backward consumers (temporary)
 * @downstream platforms/cloudflare — creates providers from env.AI binding
 * @pattern barrel — re-exports only; no logic in this file
 * @antipattern DO NOT add logic here — add to the domain file and re-export
 */

// Result type
export type {
  EmbeddingResult,
  EmbeddingError,
  EmbeddingErrorCode,
} from "./EmbeddingResult.js";
export { embeddingSuccess, embeddingFailure } from "./EmbeddingResult.js";

// Service interface
export type { EmbeddingService } from "./EmbeddingService.js";

// Model constants
export {
  EMBEDDING_MODEL,
  CLOUDFLARE_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  DEFAULT_MAX_TEXT_LENGTH,
} from "./EmbeddingModel.js";

// Cloudflare binding type
export type { CloudflareAIBinding } from "./CloudflareAIBinding.js";

// Cloudflare provider
export type { CloudflareEmbeddingConfiguration } from "./CloudflareEmbeddingConfiguration.js";
export { CloudflareEmbeddingProvider } from "./CloudflareEmbeddingProvider.js";
