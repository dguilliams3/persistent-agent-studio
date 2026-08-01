/**
 * Input data for creating a new glossary entry.
 *
 * @module @persistence/db/voice/GlossaryEntryInput
 * @upstream Called by:
 *   - voice/glossary.ts
 *   - voice/index.ts
 */

export interface GlossaryEntryInput {
  wrongForm: string;
  correctForm: string;
  category?: string;
  useInPrompt?: boolean;
  useInReplace?: boolean;
}
