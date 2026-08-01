/**
 * Embedding model constants.
 *
 * BGE-base-en-v1.5 produces 768-dimensional embeddings
 * optimized for English text retrieval. Frozen per persona —
 * if the model changes, start a new persona (see ARCHITECTURE_CONSTRAINTS.md).
 *
 * @invariant Once an embedding is stored, it is never recomputed or overwritten.
 * @downstream CloudflareEmbeddingProvider uses CLOUDFLARE_EMBEDDING_MODEL for API calls
 * @downstream memory/sim uses EMBEDDING_DIMENSION for vector validation
 */

/** Short model identifier for storage and tracking. */
export const EMBEDDING_MODEL = "bge-base-en-v1.5";

/** Full Cloudflare AI model path for API calls. */
export const CLOUDFLARE_EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";

/** Embedding vector dimension for BGE-base-en-v1.5. */
export const EMBEDDING_DIMENSION = 768;

/** Default maximum text length before truncation. */
export const DEFAULT_MAX_TEXT_LENGTH = 8000;
