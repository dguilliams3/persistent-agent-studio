/**
 * Cloudflare Workers AI binding type for embedding generation.
 *
 * This is the shape of `env.AI` in a Cloudflare Worker.
 * The binding provides access to Cloudflare's AI models.
 *
 * @upstream Cloudflare Workers runtime provides this binding
 * @downstream CloudflareEmbeddingProvider wraps this for type-safe embedding generation
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
   * @returns Model-specific output with embedding vectors
   */
  run(
    model: string,
    input: { text: string | string[] },
  ): Promise<{
    /** Array of embedding vectors. Each vector is an array of floats. */
    data: number[][];
    /** Shape of the output: [batch_size, embedding_dimension] */
    shape: number[];
  }>;
}
