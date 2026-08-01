/**
 * Result of adding a question.
 *
 * @module @persistence/db/llm-storage/QuestionAddResult
 * @upstream Called by:
 *   - llm-storage/questions.ts
 *   - llm-storage/index.ts
 */

export interface QuestionAddResult {
  id: number;
  domain: string | null;
}
