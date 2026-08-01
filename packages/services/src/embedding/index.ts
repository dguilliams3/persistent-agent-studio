/**
 * Embedding Services — DEPRECATED, use @persistence/embedding
 *
 * @module @persistence/services/embedding
 * @description Vector embedding generation for semantic search.
 *
 * ⚠️  DEPRECATED: The canonical embedding implementation has moved to
 * @persistence/embedding. This directory retains the original source files
 * (types.ts, cloudflare.ts) for backwards reference only. New code must
 * import from @persistence/embedding, not from this path.
 *
 * @antipattern DO NOT import CloudflareEmbeddingProvider or EMBEDDING_MODEL from
 *   @persistence/services or @persistence/services/embedding. Import from
 *   @persistence/embedding instead:
 *   ```typescript
 *   import { CloudflareEmbeddingProvider, EMBEDDING_MODEL } from '@persistence/embedding';
 *   ```
 *
 * Embeddings are dense vector representations of text that capture
 * semantic meaning. Similar texts have similar embeddings, enabling
 * semantic search via cosine similarity.
 *
 * PROVIDERS:
 * - CloudflareEmbeddingProvider: Uses Cloudflare Workers AI (BGE-base-en-v1.5)
 *
 * @upstream Previously used by:
 *   - platforms/cloudflare/src/services/summarization.js - createEmbeddingAdapter()
 *   - @persistence/memory/rag - semantic retrieval (via adapters)
 *   All consumers have been or must be updated to import from @persistence/embedding.
 * @downstream Aggregates: types.ts, cloudflare.ts
 */

// ═══════════════════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export type {
  EmbeddingService,
  CloudflareAIBinding,
  CloudflareEmbeddingConfig,
} from "./types.js";

export {
  EMBEDDING_MODEL,
  CLOUDFLARE_EMBEDDING_MODEL,
  EMBEDDING_DIMENSION,
  DEFAULT_MAX_TEXT_LENGTH,
} from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export { CloudflareEmbeddingProvider } from "./cloudflare.js";
