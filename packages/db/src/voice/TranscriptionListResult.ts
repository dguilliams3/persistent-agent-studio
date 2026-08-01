/**
 * Paginated result for voice transcriptions.
 *
 * @module @persistence/db/voice/TranscriptionListResult
 * @upstream Called by:
 *   - voice/transcriptions.ts
 *   - voice/index.ts
 */

import type { VoiceTranscription } from './VoiceTranscription.js';

export interface TranscriptionListResult {
  items: VoiceTranscription[];
  total: number;
}
