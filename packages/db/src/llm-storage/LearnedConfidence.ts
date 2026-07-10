/**
 * Confidence levels for self-knowledge entries.
 * Strict union type to ensure type safety across packages.
 *
 * @module @persistence/db/llm-storage/LearnedConfidence
 * @upstream Called by:
 *   - llm-storage/learned.ts
 *   - llm-storage/LearnedEntry.ts
 *   - llm-storage/LearnedAddResult.ts
 *   - llm-storage/index.ts
 */

export type LearnedConfidence = 'emerging' | 'stable' | 'load-bearing';
