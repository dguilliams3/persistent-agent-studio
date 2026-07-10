/**
 * Domain categories for questions.
 *
 * @module @persistence/db/llm-storage/QuestionDomain
 * @upstream Called by:
 *   - llm-storage/questions.ts
 *   - llm-storage/index.ts
 */

export type QuestionDomain = 'self' | 'world' | 'user' | 'technical' | 'creative' | null;
