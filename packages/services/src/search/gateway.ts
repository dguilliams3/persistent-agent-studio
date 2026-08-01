/**
 * SearchGateway - High-level facade for all web search operations
 *
 * @module @persistence/services/search/gateway
 * @description Single entry point for web search. Wraps ClaudeSearchProvider
 * and returns results with metadata for tracking/logging.
 *
 * This is the ONLY entry point for web search in the codebase. All search
 * operations (SEARCH action, digest, manual queries) should use this gateway.
 *
 * @upstream Called by:
 *   - Post-processors (searchPostProcessor, digestExecutionPostProcessor)
 *   - Web agent service (runDigest)
 *   - Cron digest
 *
 * @downstream Calls:
 *   - ClaudeSearchProvider (low-level Anthropic API wrapper)
 *
 * @example
 * const gateway = SearchGateway.fromCredentials(apiKey);
 * const result = await gateway.search('latest AI news');
 *
 * if (result.success) {
 *   console.log(result.summary);
 *   console.log(result.metadata); // { provider, model, tool, durationMs, query }
 * }
 */

import { ClaudeSearchProvider } from './brave.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Metadata about a search operation.
 * Used for tracking, logging, and debugging.
 */
export interface SearchMetadata {
  /** Provider name (always 'anthropic' for now) */
  provider: 'anthropic';
  /** Model used for search (e.g., 'claude-sonnet-5') */
  model: string;
  /** Web search tool version (e.g., 'web_search_20250305') */
  tool: string;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Original query */
  query: string;
}

/**
 * Search result with metadata.
 * Simplified interface for consumers - no ServiceResult wrapper.
 */
export interface GatewaySearchResult {
  /** Whether the search succeeded */
  success: boolean;
  /** Search result summary (only if success=true) */
  summary?: string;
  /** Error message (only if success=false) */
  error?: string;
  /** Metadata about the search operation */
  metadata: SearchMetadata;
}

/**
 * Simplified search result for backwards compatibility with doWebSearch().
 * Use GatewaySearchResult for new code.
 */
export interface SimpleSearchResult {
  result?: string;
  error?: string;
}

// =============================================================================
// GATEWAY IMPLEMENTATION
// =============================================================================

/**
 * High-level facade for web search operations.
 *
 * Use static factory methods to create instances:
 * - `fromCredentials()` for direct API key usage
 *
 * @example
 * const gateway = SearchGateway.fromCredentials(apiKey);
 * const result = await gateway.search('latest news on AI');
 *
 * // With metadata for logging
 * await logHistory({
 *   db, type: 'search_result',
 *   content: result.summary,
 *   metadata: result.metadata
 * });
 */
export class SearchGateway {
  private provider: ClaudeSearchProvider;

  /**
   * Private constructor - use static factory methods.
   */
  private constructor(provider: ClaudeSearchProvider) {
    this.provider = provider;
  }

  /**
   * Create gateway from API key.
   *
   * @param apiKey - Anthropic API key
   * @returns SearchGateway instance
   *
   * @example
   * const gateway = SearchGateway.fromCredentials(env.ANTHROPIC_API_KEY);
   */
  static fromCredentials(apiKey: string): SearchGateway {
    return new SearchGateway(ClaudeSearchProvider.fromCredentials(apiKey));
  }

  /**
   * Perform a web search with full metadata.
   *
   * This is the primary method - returns result with metadata for logging.
   *
   * @param query - Search query
   * @returns Search result with metadata
   *
   * @example
   * const result = await gateway.search('AI developments 2026');
   * if (result.success) {
   *   console.log(result.summary);
   *   console.log(`Took ${result.metadata.durationMs}ms`);
   * }
   */
  async search(query: string): Promise<GatewaySearchResult> {
    const startTime = Date.now();

    const result = await this.provider.search(query);

    const durationMs = Date.now() - startTime;

    const metadata: SearchMetadata = {
      provider: 'anthropic',
      model: this.provider.getModel(),
      tool: this.provider.getToolVersion(),
      durationMs,
      query,
    };

    if (result.success) {
      return {
        success: true,
        summary: result.data.summary,
        metadata,
      };
    } else {
      return {
        success: false,
        error: result.error?.message ?? 'Search failed',
        metadata,
      };
    }
  }

  /**
   * Perform a web search with simplified return type.
   *
   * This method exists for backwards compatibility with doWebSearch().
   * Prefer search() for new code to get metadata.
   *
   * @param query - Search query
   * @returns Simple result with result or error
   *
   * @example
   * const { result, error } = await gateway.searchSimple('query');
   */
  async searchSimple(query: string): Promise<SimpleSearchResult> {
    const result = await this.search(query);
    return result.success
      ? { result: result.summary }
      : { error: result.error };
  }

  /**
   * Get the underlying provider (for advanced use cases).
   */
  getProvider(): ClaudeSearchProvider {
    return this.provider;
  }
}
