/**
 * OBSERVATION Tool Definition
 *
 * @module @persistence/tools/definitions/observation
 * @description Structured log for relational or behavioral insights about the user.
 *
 * This tool captures patterns (energy, trust, triggers) plus actionable
 * implications for later promotion into LEARNED or MESSAGE_USER updates.
 *
 * @upstream Called by: @persistence/runtime - runThinkingCycle()
 * @downstream Calls: saveObservation(), getObservation(), deleteObservation(), logHistory()
 */
import type { ToolDefinition } from '../../types';
import type { ObservationParams } from './params';
import { category, schema, prompt, help } from './schema';
import { handler } from './handler';

// Re-export params type for consumers
export type { ObservationParams } from './params';

/**
 * OBSERVATION tool definition with co-located handler.
 */
export const OBSERVATION: ToolDefinition<ObservationParams> = {
  id: 'OBSERVATION',
  category,
  schema,
  prompt,
  help,
  handler,
  historyTypes: {
    primary: {
      save: 'observation_saved',
      get: 'observation_retrieved',
      delete: null
    }
  }
};
