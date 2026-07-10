/**
 * Claude Web Search Provider
 *
 * @module @persistence/services/search/brave
 * @description Claude web search implementation using Anthropic's web_search tool.
 *
 * Note: This file is named 'brave.ts' for historical reasons, but implements
 * Claude's built-in web_search tool, not Brave Search API. The existing
 * codebase uses Anthropic's web_search tool which handles search + summarization.
 *
 * @upstream Called by: Platform handlers via SearchService interface
 * @downstream Calls: Anthropic Messages API with web_search tool
 */

import {
  type ServiceResult,
  failure,
  success,
  httpStatusToErrorCode,
} from '../core/types.js';
import { parseApiError } from '../core/http.js';
import type { SecretsProvider } from '@persistence/core';
import type {
  SearchService,
  SearchOptions,
  SearchResult,
  ClaudeSearchConfig,
} from './types.js';

// =============================================================================
// CONSTANTS
// =============================================================================

const API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 2048;
const WEB_SEARCH_TOOL_VERSION = 'web_search_20250305';

// =============================================================================
// PROVIDER IMPLEMENTATION
// =============================================================================

/**
 * Claude web search provider using Anthropic's web_search tool.
 *
 * Use static factory methods to create instances:
 * - `create()` for production (async, uses SecretsProvider)
 * - `fromCredentials()` for testing (sync, direct credentials)
 *
 * @example
 * // Production usage
 * const search = await ClaudeSearchProvider.create(secrets);
 * const result = await search.search('latest AI news 2026');
 *
 * @example
 * // Testing usage
 * const search = ClaudeSearchProvider.fromCredentials('sk-...');
 */
export class ClaudeSearchProvider implements SearchService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTokens: number;
  private readonly systemPrompt?: string;

  /**
   * @description Private constructor - use static factory methods instead.
   *
   * @upstream Called by: create(), fromCredentials()
   * @downstream Calls: None (initializes state)
   */
  private constructor(config: ClaudeSearchConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? DEFAULT_MODEL;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.systemPrompt = config.systemPrompt;
  }

  /**
   * @description Create provider from secrets.
   *
   * Production factory method that retrieves Anthropic API key from platform secrets.
   *
   * @upstream Called by: Platform initialization (Cloudflare Worker, server)
   * @downstream Calls: SecretsProvider.require()
   *
   * @param secrets - Platform secrets provider
   * @param options - Optional configuration overrides (model, maxTokens, systemPrompt)
   * @returns Promise<ClaudeSearchProvider> Configured provider instance
   *
   * @example
   * const search = await ClaudeSearchProvider.create(secrets, {
   *   model: 'claude-opus-4-6',
   *   maxTokens: 4096
   * });
   */
  static async create(
    secrets: SecretsProvider,
    options?: Partial<Omit<ClaudeSearchConfig, 'apiKey'>>
  ): Promise<ClaudeSearchProvider> {
    const apiKey = await secrets.require('ANTHROPIC_API_KEY');
    return new ClaudeSearchProvider({ apiKey, ...options });
  }

  /**
   * @description Create provider with direct credentials (for testing).
   *
   * Synchronous factory method that accepts credentials directly.
   * Maintains backward compatibility with existing test code.
   *
   * @upstream Called by: Unit tests, development scripts
   * @downstream Calls: constructor
   *
   * @param config - Full configuration or just API key string
   * @returns ClaudeSearchProvider Configured provider instance
   *
   * @example
   * // Simple string
   * const search = ClaudeSearchProvider.fromCredentials('sk-...');
   *
   * @example
   * // Full config
   * const search = ClaudeSearchProvider.fromCredentials({
   *   apiKey: 'sk-...',
   *   model: 'claude-opus-4-6'
   * });
   */
  static fromCredentials(config: ClaudeSearchConfig | string): ClaudeSearchProvider {
    if (typeof config === 'string') {
      return new ClaudeSearchProvider({ apiKey: config });
    }
    return new ClaudeSearchProvider(config);
  }

  getProviderName(): string {
    return 'claude-web-search';
  }

  /**
   * @description Get the model being used for search.
   *
   * Used by SearchGateway to capture model information in search metadata.
   *
   * @upstream Called by: SearchGateway.search()
   * @downstream Calls: None (getter)
   *
   * @returns {string} Model name (e.g., 'claude-sonnet-4-20250514')
   */
  getModel(): string {
    return this.model;
  }

  /**
   * @description Get the web_search tool version.
   *
   * Used by SearchGateway to capture tool version in search metadata.
   *
   * @upstream Called by: SearchGateway.search()
   * @downstream Calls: None (getter)
   *
   * @returns {string} Tool version (e.g., 'web_search_20250305')
   */
  getToolVersion(): string {
    return WEB_SEARCH_TOOL_VERSION;
  }

  /**
   * Perform a web search using Claude's web_search tool.
   *
   * Sends query to Claude with web_search enabled, Claude performs
   * the search and returns a summarized response.
   */
  async search(
    query: string,
    options: SearchOptions = {}
  ): Promise<ServiceResult<SearchResult>> {
    const timeout = options.timeout ?? 60000;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const messages = [{
        role: 'user' as const,
        content: `Search the web for: ${query}\n\nProvide a concise summary of what you find.`,
      }];

      const body: Record<string, unknown> = {
        model: this.model,
        max_tokens: this.maxTokens,
        tools: [{ type: WEB_SEARCH_TOOL_VERSION, name: 'web_search' }],
        messages,
      };

      if (this.systemPrompt) {
        body.system = this.systemPrompt;
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json() as {
        error?: { message?: string };
        content?: Array<{ type: string; text?: string }>;
      };

      if (!response.ok || data.error) {
        const errorMsg = parseApiError(data) ?? data.error?.message ?? `HTTP ${response.status}`;
        return failure(
          httpStatusToErrorCode(response.status),
          errorMsg,
          { statusCode: response.status }
        );
      }

      // Extract text from response
      let summary = '';
      for (const block of data.content ?? []) {
        if (block.type === 'text' && block.text) {
          summary += block.text;
        }
      }

      if (!summary) {
        summary = 'No results found';
      }

      return success({
        summary,
        query,
        provider: 'claude-web-search',
        searchTimeMs: Date.now() - startTime,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return failure('TIMEOUT', 'Search timed out');
      }
      return failure(
        'NETWORK_ERROR',
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

// Alias for backward compatibility
export { ClaudeSearchProvider as BraveSearchProvider };
