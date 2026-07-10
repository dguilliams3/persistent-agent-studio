/**
 * Result type for embedding operations.
 *
 * Discriminated union: check `success` to narrow between data and error.
 * Self-contained in the embedding package — no dependency on services/core.
 *
 * @pattern discriminated-union
 * @downstream CloudflareEmbeddingProvider returns this from generate/generateBatch
 * @downstream memory/sim consumes this for backfill operations
 */

export type EmbeddingResult<T> =
  | { success: true; data: T }
  | { success: false; error: EmbeddingError };

export interface EmbeddingError {
  code: EmbeddingErrorCode;
  message: string;
}

export type EmbeddingErrorCode = "INVALID_INPUT" | "SERVICE_ERROR" | "TIMEOUT";

export function embeddingSuccess<T>(data: T): EmbeddingResult<T> {
  return { success: true, data };
}

export function embeddingFailure<T>(
  code: EmbeddingErrorCode,
  message: string,
): EmbeddingResult<T> {
  return { success: false, error: { code, message } };
}
