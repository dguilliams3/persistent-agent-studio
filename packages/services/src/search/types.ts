/**
 * Search Types - Web search capability interfaces
 *
 * @module @persistence/services/search/types
 * @description Types for web search service providers.
 *
 * Currently uses Claude's built-in web_search tool via Anthropic API.
 */

import type { ServiceResult, HttpOptions } from '../core/types.js';

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

/**
 * Web search service interface.
 *
 * All search providers must implement this interface.
 *
 * @example
 * const search: SearchService = new ClaudeSearchProvider(apiKey);
 * const result = await search.search('latest AI news 2026');
 */
export interface SearchService {
  /**
   * Perform a web search and return summarized results.
   *
   * @param query - Search query
   * @param options - Search options
   * @returns Search result summary
   */
  search(query: string, options?: SearchOptions): Promise<ServiceResult<SearchResult>>;

  /**
   * Get provider name.
   */
  getProviderName(): string;
}

// =============================================================================
// REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Options for web search.
 */
export interface SearchOptions extends HttpOptions {
  /** Maximum results to return */
  maxResults?: number;
  /** Language preference */
  language?: string;
  /** Region/country preference */
  region?: string;
  /** Safe search level */
  safeSearch?: 'strict' | 'moderate' | 'off';
  /** Time range filter */
  timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
}

/**
 * Result from web search.
 */
export interface SearchResult {
  /** Summarized/processed search results */
  summary: string;
  /** Raw results if available */
  results?: SearchResultItem[];
  /** Search query used */
  query: string;
  /** Provider name */
  provider: string;
  /** Time taken (ms) */
  searchTimeMs?: number;
}

/**
 * Individual search result item.
 */
export interface SearchResultItem {
  /** Result title */
  title: string;
  /** Result URL */
  url: string;
  /** Result snippet/description */
  snippet?: string;
  /** Publication date if available */
  date?: string;
}

// =============================================================================
// PROVIDER-SPECIFIC TYPES
// =============================================================================

/**
 * Claude web search configuration.
 *
 * Uses Anthropic's web_search tool which handles the search
 * and summarization in one API call.
 */
export interface ClaudeSearchConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use (default: claude-sonnet-5) */
  model?: string;
  /** Max tokens for response (default: 2048) */
  maxTokens?: number;
  /** System prompt customization */
  systemPrompt?: string;
}

/**
 * Brave Search configuration (if implemented later).
 */
export interface BraveSearchConfig {
  /** Brave Search API key */
  apiKey: string;
  /** Results per page */
  count?: number;
}
