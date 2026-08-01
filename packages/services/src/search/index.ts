/**
 * Search Capability - Web search services
 *
 * @module @persistence/services/search
 * @description Web search capability using Claude's web_search tool.
 *
 * PRIMARY ENTRY POINT: SearchGateway
 * Use SearchGateway for all new code - it provides a simplified interface
 * with metadata for logging/tracking.
 *
 * @example
 * import { SearchGateway } from '@persistence/services/search';
 *
 * const gateway = SearchGateway.fromCredentials(apiKey);
 * const result = await gateway.search('latest AI news 2026');
 *
 * if (result.success) {
 *   console.log(result.summary);
 *   console.log(result.metadata); // { provider, model, tool, durationMs, query }
 * }
 */

// Types
export type {
  SearchService,
  SearchOptions,
  SearchResult,
  SearchResultItem,
  ClaudeSearchConfig,
  BraveSearchConfig,
} from './types.js';

// Gateway types
export type {
  SearchMetadata,
  GatewaySearchResult,
  SimpleSearchResult,
} from './gateway.js';

// Gateway (PRIMARY ENTRY POINT - use this for new code)
export { SearchGateway } from './gateway.js';

// Providers (low-level - prefer SearchGateway for new code)
export {
  ClaudeSearchProvider,
  BraveSearchProvider, // Alias for backward compat
} from './brave.js';
