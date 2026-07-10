/**
 * Configuration for CloudflareEmbeddingProvider.
 *
 * @downstream CloudflareEmbeddingProvider.fromBinding accepts this
 */
export interface CloudflareEmbeddingConfiguration {
  /**
   * Maximum text length before truncation.
   * BGE models have token limits; ~8000 chars is safe.
   *
   * @default 8000
   */
  maxTextLength?: number;
}
