/**
 * Provider availability helpers
 *
 * @module @persistence/core/providers/availability
 * @description Data-driven secret checks for provider selection surfaces.
 */

import { anthropic } from './anthropic';
import { deepseek } from './deepseek';
import { kimi } from './kimi';
import { openai } from './openai';

const PROVIDERS = { anthropic, openai, deepseek, kimi } as const;

export interface ProviderAvailability {
  label: string;
  envKeyName: string;
  available: boolean;
  reason?: string;
}

export function getProviderAvailabilityMap(
  getSecretValue: (envKeyName: string) => unknown,
): Record<string, ProviderAvailability> {
  return Object.fromEntries(
    Object.entries(PROVIDERS).map(([providerName, provider]) => {
      const rawValue = getSecretValue(provider.envKeyName);
      const available =
        typeof rawValue === 'string' ? rawValue.trim().length > 0 : Boolean(rawValue);

      return [
        providerName,
        {
          label: provider.name,
          envKeyName: provider.envKeyName,
          available,
          reason: available ? undefined : `Missing secret ${provider.envKeyName}`,
        },
      ];
    }),
  );
}
