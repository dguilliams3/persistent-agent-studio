/**
 * Options for fetching voice transcriptions.
 *
 * @module @persistence/db/voice/GetTranscriptionsOptions
 * @upstream Called by:
 *   - voice/transcriptions.ts
 *   - voice/index.ts
 */

import type { PersonaOptions } from './PersonaOptions.js';

export interface GetTranscriptionsOptions extends PersonaOptions {
  limit?: number;
  offset?: number;
  needsCorrection?: boolean;
}
