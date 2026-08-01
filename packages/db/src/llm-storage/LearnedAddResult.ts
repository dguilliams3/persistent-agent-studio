/**
 * Result of adding a learned entry.
 *
 * @module @persistence/db/llm-storage/LearnedAddResult
 * @upstream Called by:
 *   - llm-storage/learned.ts
 *   - llm-storage/index.ts
 */

import type { LearnedConfidence } from './LearnedConfidence';

export interface LearnedAddResult {
  id: number;
  confidence: LearnedConfidence;
}
