/**
 * Persona configuration — shared reference type for display and config.
 *
 * This is the config-level view of a persona. For the database row shape,
 * see PersonaRecord in @persistence/db. For runtime-assembled context,
 * see PersonaContext in @persistence/runtime.
 */
import type { MeterConfig } from './MeterConfig';

export interface PersonaConfig {
  name: string;
  slug: string;
  model: string;
  systemPromptTemplate: string;
  meterConfig?: MeterConfig;
}
