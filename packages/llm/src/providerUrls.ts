/**
 * Provider URL helpers
 *
 * @module @persistence/llm/providerUrls
 * @description Resolves provider API paths against optional custom base URLs.
 */

import type { ProviderDefinition } from '@persistence/core/providers';

export function resolveProviderApiUrl(provider: ProviderDefinition): string {
  const { url, baseUrl } = provider.api;
  if (baseUrl) {
    const normalizedUrl = url.startsWith('/') ? url.slice(1) : url;
    return new URL(normalizedUrl, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
  }
  return url;
}

export function resolveBatchApiUrl(
  provider: ProviderDefinition,
  replacementPath: string,
): string {
  const requestUrl = resolveProviderApiUrl(provider);
  if (!requestUrl.includes('/messages')) {
    throw new Error(`Batch operations are unsupported for ${provider.name}`);
  }
  return requestUrl.replace('/messages', replacementPath);
}
