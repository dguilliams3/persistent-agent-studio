/**
 * A learned entry from the database.
 * Represents battle-tested self-knowledge with evidence tracking.
 *
 * @module @persistence/db/llm-storage/LearnedEntry
 * @upstream Called by:
 *   - llm-storage/learned.ts
 *   - llm-storage/index.ts
 */

import type { LearnedConfidence } from './LearnedConfidence';

export interface LearnedEntry {
  id: number;
  content: string;
  confidence: LearnedConfidence;
  supporting_evidence: string | null;  // JSON array of evidence strings
  challenging_evidence: string | null; // JSON array of evidence strings
  created_at: string;
  updated_at: string | null;
  promoted_to_cold_storage_at: string | null;
}
