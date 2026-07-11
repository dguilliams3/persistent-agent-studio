/**
 * Tests for SearchGateway - Web search facade
 *
 * @module @persistence/services/search/gateway.test
 * @covers SearchGateway.fromCredentials, search, searchSimple, getProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SearchGateway } from './gateway';
import type { ClaudeSearchProvider } from './brave';
import type { ServiceResult, ServiceError } from '../core/types';
import type { SearchResult } from './types';

// =============================================================================
// MOCKS
// =============================================================================

/**
 * Create a mock ClaudeSearchProvider with configurable behavior
 */
function createMockProvider(overrides = {}): ClaudeSearchProvider {
  return {
    search: vi.fn().mockResolvedValue({
      success: true,
      data: {
        summary: 'Test search summary about AI',
        query: 'latest AI news',
        provider: 'claude-web-search',
        searchTimeMs: 1234,
      },
    } as ServiceResult<SearchResult>),
    getModel: vi.fn().mockReturnValue('claude-sonnet-5'),
    getToolVersion: vi.fn().mockReturnValue('web_search_20250305'),
    getProviderName: vi.fn().mockReturnValue('claude-web-search'),
    ...overrides,
  } as any;
}

/**
 * Create a mock provider that returns a failure result
 */
function createFailingProvider(errorMessage = 'Network error'): ClaudeSearchProvider {
  return {
    search: vi.fn().mockResolvedValue({
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: errorMessage,
        statusCode: 500,
      } as ServiceError,
    } as ServiceResult<SearchResult>),
    getModel: vi.fn().mockReturnValue('claude-sonnet-5'),
    getToolVersion: vi.fn().mockReturnValue('web_search_20250305'),
    getProviderName: vi.fn().mockReturnValue('claude-web-search'),
  } as any;
}

// =============================================================================
// TESTS: Static Factory Method
// =============================================================================

describe('SearchGateway.fromCredentials()', () => {
  it('should create gateway instance from API key', () => {
    const apiKey = 'test-search-api-key-placeholder';

    const gateway = SearchGateway.fromCredentials(apiKey);

    expect(gateway).toBeDefined();
    expect(gateway).toBeInstanceOf(SearchGateway);
  });

  it('should initialize with ClaudeSearchProvider', () => {
    const gateway = SearchGateway.fromCredentials('test-search-key-placeholder');
    const provider = gateway.getProvider();

    expect(provider).toBeDefined();
    // Verify provider has expected methods
    expect(provider.search).toBeDefined();
    expect(provider.getModel).toBeDefined();
    expect(provider.getToolVersion).toBeDefined();
  });
});

// =============================================================================
// TESTS: search() Method
// =============================================================================

describe('SearchGateway.search()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return successful GatewaySearchResult with metadata', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.search('AI developments 2026');

    expect(result.success).toBe(true);
    expect(result.summary).toBe('Test search summary about AI');
    expect(result.error).toBeUndefined();
    expect(result.metadata).toBeDefined();
  });

  it('should include all metadata fields in successful result', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.search('test query');

    expect(result.metadata).toEqual({
      provider: 'anthropic',
      model: 'claude-sonnet-5',
      tool: 'web_search_20250305',
      durationMs: expect.any(Number),
      query: 'test query',
    });
  });

  it('should measure and include duration in metadata', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.search('duration test');

    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.metadata.durationMs).toBe('number');
  });

  it('should pass query to underlying provider', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);
    const query = 'quantum computing breakthroughs';

    await gateway.search(query);

    expect(mockProvider.search).toHaveBeenCalledWith(query);
    expect(mockProvider.search).toHaveBeenCalledTimes(1);
  });

  it('should call getModel() for metadata', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    await gateway.search('test');

    expect(mockProvider.getModel).toHaveBeenCalled();
  });

  it('should call getToolVersion() for metadata', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    await gateway.search('test');

    expect(mockProvider.getToolVersion).toHaveBeenCalled();
  });

  it('should return error result on provider failure', async () => {
    const mockProvider = createFailingProvider('Search timed out');
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.search('test query');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Search timed out');
    expect(result.summary).toBeUndefined();
  });

  it('should include metadata even on error', async () => {
    const mockProvider = createFailingProvider('API error');
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.search('test query');

    expect(result.success).toBe(false);
    expect(result.metadata).toBeDefined();
    expect(result.metadata.provider).toBe('anthropic');
    expect(result.metadata.query).toBe('test query');
    expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle missing error message from provider', async () => {
    const mockProvider = {
      search: vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'UNKNOWN' } as ServiceError, // No message
      } as ServiceResult<SearchResult>),
      getModel: vi.fn().mockReturnValue('claude-sonnet-5'),
      getToolVersion: vi.fn().mockReturnValue('web_search_20250305'),
    } as any;
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.search('test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Search failed');
  });

  it('should extract summary from successful provider result', async () => {
    const customSummary = 'Custom comprehensive search summary';
    const mockProvider = createMockProvider({
      search: vi.fn().mockResolvedValue({
        success: true,
        data: {
          summary: customSummary,
          query: 'test',
          provider: 'claude-web-search',
          searchTimeMs: 500,
        },
      }),
    });
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.search('test');

    expect(result.summary).toBe(customSummary);
  });
});

// =============================================================================
// TESTS: searchSimple() Method
// =============================================================================

describe('SearchGateway.searchSimple()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return SimpleSearchResult on success', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.searchSimple('test query');

    expect(result.result).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.result).toBe('Test search summary about AI');
  });

  it('should return error on failure', async () => {
    const mockProvider = createFailingProvider('Connection failed');
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.searchSimple('test query');

    expect(result.error).toBeDefined();
    expect(result.result).toBeUndefined();
    expect(result.error).toBe('Connection failed');
  });

  it('should delegate to search() method', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    await gateway.searchSimple('delegated query');

    expect(mockProvider.search).toHaveBeenCalledWith('delegated query');
  });

  it('should handle missing error message gracefully', async () => {
    const mockProvider = {
      search: vi.fn().mockResolvedValue({
        success: false,
        error: { code: 'UNKNOWN' } as ServiceError,
      } as ServiceResult<SearchResult>),
      getModel: vi.fn().mockReturnValue('claude-sonnet-5'),
      getToolVersion: vi.fn().mockReturnValue('web_search_20250305'),
    } as any;
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.searchSimple('test');

    expect(result.error).toBe('Search failed');
  });

  it('should return default error message for undefined error in failure', async () => {
    const mockProvider = {
      search: vi.fn().mockResolvedValue({
        success: false,
        error: undefined,
      } as any),
      getModel: vi.fn().mockReturnValue('claude-sonnet-5'),
      getToolVersion: vi.fn().mockReturnValue('web_search_20250305'),
    } as any;
    const gateway = new (SearchGateway as any)(mockProvider);

    const result = await gateway.searchSimple('test');

    // When error is undefined, should return default 'Search failed' message
    expect(result.error).toBe('Search failed');
    expect(result.result).toBeUndefined();
  });
});

// =============================================================================
// TESTS: getProvider() Method
// =============================================================================

describe('SearchGateway.getProvider()', () => {
  it('should return the underlying ClaudeSearchProvider instance', () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const retrievedProvider = gateway.getProvider();

    expect(retrievedProvider).toBe(mockProvider);
  });

  it('should allow access to provider methods', () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const provider = gateway.getProvider();

    expect(provider.search).toBeDefined();
    expect(provider.getModel).toBeDefined();
    expect(provider.getToolVersion).toBeDefined();
    expect(provider.getProviderName).toBeDefined();
  });

  it('should return same provider instance across multiple calls', () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const provider1 = gateway.getProvider();
    const provider2 = gateway.getProvider();

    expect(provider1).toBe(provider2);
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('SearchGateway integration', () => {
  it('should handle multiple sequential searches', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const result1 = await gateway.search('first query');
    const result2 = await gateway.search('second query');

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(mockProvider.search).toHaveBeenCalledTimes(2);
  });

  it('should preserve metadata across different queries', async () => {
    const mockProvider = createMockProvider();
    const gateway = new (SearchGateway as any)(mockProvider);

    const result1 = await gateway.search('query one');
    const result2 = await gateway.search('query two');

    expect(result1.metadata.query).toBe('query one');
    expect(result2.metadata.query).toBe('query two');
    expect(result1.metadata.provider).toBe(result2.metadata.provider);
    expect(result1.metadata.model).toBe(result2.metadata.model);
  });

  it('should work with mixed success and failure results', async () => {
    const successProvider = createMockProvider();
    const failureProvider = createFailingProvider('Test error');

    const gateway1 = new (SearchGateway as any)(successProvider);
    const gateway2 = new (SearchGateway as any)(failureProvider);

    const result1 = await gateway1.search('query');
    const result2 = await gateway2.search('query');

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(false);
    expect(result1.metadata.provider).toBe(result2.metadata.provider);
  });
});
