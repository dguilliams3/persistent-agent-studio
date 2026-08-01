/**
 * Input data for updating a glossary entry.
 *
 * @module @persistence/db/voice/GlossaryEntryUpdate
 * @upstream Called by:
 *   - voice/glossary.ts
 *   - voice/index.ts
 */

export interface GlossaryEntryUpdate {
  wrong_form?: string;
  correct_form?: string;
  category?: string;
  use_in_prompt?: boolean;
  use_in_replace?: boolean;
}
