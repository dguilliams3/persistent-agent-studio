/**
 * Options for filtering glossary entries.
 *
 * @module @persistence/db/voice/GlossaryFilterOptions
 * @upstream Called by:
 *   - voice/glossary.ts
 *   - voice/index.ts
 */

import type { PersonaOptions } from './PersonaOptions.js';

export interface GlossaryFilterOptions extends PersonaOptions {
  /** Only return entries with use_in_prompt = 1 */
  forPrompt?: boolean;
  /** Only return entries with use_in_replace = 1 */
  forReplace?: boolean;
}
