/**
 * Result of citing evidence for a learned entry.
 *
 * @module @persistence/db/llm-storage/LearnedCiteResult
 * @upstream Called by:
 *   - llm-storage/learned.ts
 *   - llm-storage/index.ts
 */

export interface LearnedCiteResult {
  id: number;
  evidenceType: 'supporting' | 'challenging';
  evidenceCount: number;
}
