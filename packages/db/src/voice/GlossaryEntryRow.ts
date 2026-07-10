/**
 * Glossary entry as stored in the database.
 *
 * @module @persistence/db/voice/GlossaryEntryRow
 * @description Maps a commonly misheard form (wrong_form) to its correct spelling.
 * Each entry can be configured to be used in prompt priming, post-processing, or both.
 * @upstream Called by:
 *   - voice/glossary.ts
 *   - voice/index.ts
 */

export interface GlossaryEntryRow {
  id: number;
  persona_id: number;
  /** What STT typically outputs incorrectly (e.g., "macy", "macie") */
  wrong_form: string;
  /** What it should be corrected to (e.g., "Macy") */
  correct_form: string;
  /** Category for organization: 'name', 'term', or 'phrase' */
  category: string;
  /** Whether to include in WhisperX initial_prompt (1 = yes) */
  use_in_prompt: number;
  /** Whether to apply in post-processing replacement (1 = yes) */
  use_in_replace: number;
  created_at?: string;
  updated_at?: string;
}
