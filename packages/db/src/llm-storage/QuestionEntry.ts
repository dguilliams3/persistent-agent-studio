/**
 * A question entry from the database.
 * Represents open curiosity threads without pressure to resolve.
 *
 * @module @persistence/db/llm-storage/QuestionEntry
 * @upstream Called by:
 *   - llm-storage/questions.ts
 *   - llm-storage/index.ts
 */

import type { QuestionStatus } from './QuestionStatus';

export interface QuestionEntry {
  id: number;
  content: string;
  domain: string | null;  // QuestionDomain or free-form
  status: QuestionStatus;
  notes: string | null;           // JSON array of note strings
  resolved_into: string | null;   // What insight emerged (if resolved)
  created_at: string;
  updated_at: string | null;
}
