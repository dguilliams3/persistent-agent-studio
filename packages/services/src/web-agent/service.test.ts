/**
 * Tests for Web Agent Digest Service
 *
 * NOTE: These tests require vitest config update to include packages/*.test.ts
 * Run with: npx vitest run packages/services/src/web-agent/service.test.ts
 *
 * @module @persistence/services/web-agent/service.test
 * @covers runDigest, isWebAgentDue, loadTopicsFromState, getWebAgentStateKeys
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runDigest,
  isWebAgentDue,
  loadTopicsFromState,
  type DigestRequest,
  type DigestDeps,
} from './service';
import { getWebAgentStateKeys, WEB_AGENT_PRESETS } from './types';

// =============================================================================
// MOCKS
// =============================================================================

function createMockSearchGateway(searchSimpleFn = vi.fn().mockResolvedValue({ result: 'Mock search result' })) {
  return {
    search: vi.fn().mockResolvedValue({
      success: true,
      summary: 'Mock search result',
      metadata: { provider: 'anthropic', model: 'test', tool: 'web_search', durationMs: 100, query: 'test' }
    }),
    searchSimple: searchSimpleFn,
    getProvider: vi.fn(),
  } as any; // Mock SearchGateway
}

function createMockDeps(overrides: Partial<DigestDeps> = {}): DigestDeps {
  return {
    searchGateway: createMockSearchGateway(),
    callLLM: vi.fn().mockResolvedValue({
      content: 'Mock synthesis',
      metadata: { cost: 0.01, tokens: { input: 100, output: 50 } },
    }),
    env: {},
    ...overrides,
  };
}

function createMockStateDeps(state: Record<string, string | undefined> = {}) {
  return {
    db: {} as any,
    getState: vi.fn().mockImplementation((_db: any, key: string) =>
      Promise.resolve(state[key])
    ),
  };
}

// =============================================================================
// runDigest() tests
// =============================================================================

describe('runDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch single topic without synthesis', async () => {
    const deps = createMockDeps();
    const request: DigestRequest = {
      topics: ['US-China relations'],
      synthesize: false,
    };

    const result = await runDigest(request, deps);

    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].success).toBe(true);
    expect(result.successCount).toBe(1);
    expect(result.synthesis).toBeUndefined();
  });

  it('should fetch multiple topics with synthesis', async () => {
    const deps = createMockDeps();
    const request: DigestRequest = {
      topics: ['Topic A', 'Topic B', 'Topic C'],
      synthesize: true,
    };

    const result = await runDigest(request, deps);

    expect(result.topics).toHaveLength(3);
    expect(result.successCount).toBe(3);
    expect(result.synthesis).toBe('Mock synthesis');
    expect(deps.callLLM).toHaveBeenCalledTimes(1);
  });

  it('should handle empty topics array', async () => {
    const deps = createMockDeps();
    const result = await runDigest({ topics: [] }, deps);

    expect(result.topics).toHaveLength(0);
    expect(result.successCount).toBe(0);
  });

  it('should handle all topics failing', async () => {
    const deps = createMockDeps({
      searchGateway: createMockSearchGateway(
        vi.fn().mockRejectedValue(new Error('Network error'))
      ),
    });

    const result = await runDigest({ topics: ['A', 'B'], synthesize: true }, deps);

    expect(result.successCount).toBe(0);
    expect(result.errorCount).toBe(2);
    expect(result.synthesis).toBeUndefined();
  });
});

// =============================================================================
// isWebAgentDue() tests
// =============================================================================

describe('isWebAgentDue', () => {
  it('should return false if not enabled', async () => {
    const deps = createMockStateDeps({ 'test_enabled': 'false' });
    expect(await isWebAgentDue('test', 6, deps)).toBe(false);
  });

  it('should return true if enabled and no lastRun', async () => {
    const deps = createMockStateDeps({ 'test_enabled': 'true' });
    expect(await isWebAgentDue('test', 6, deps)).toBe(true);
  });

  it('should return false if interval not elapsed', async () => {
    const recentRun = new Date(Date.now() - 1000 * 60 * 60).toISOString();
    const deps = createMockStateDeps({
      'test_enabled': 'true',
      'test_last_run': recentRun,
    });
    expect(await isWebAgentDue('test', 6, deps)).toBe(false);
  });
});

// =============================================================================
// loadTopicsFromState() tests  
// =============================================================================

describe('loadTopicsFromState', () => {
  it('should parse valid JSON', async () => {
    const deps = createMockStateDeps({ 'test_topics': '["A", "B"]' });
    expect(await loadTopicsFromState('test', deps)).toEqual(['A', 'B']);
  });

  it('should return empty for corrupted JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = createMockStateDeps({ 'test_topics': 'bad json' });
    expect(await loadTopicsFromState('test', deps)).toEqual([]);
  });
});

// =============================================================================
// getWebAgentStateKeys() tests
// =============================================================================

describe('getWebAgentStateKeys', () => {
  it('should return correct keys', () => {
    const keys = getWebAgentStateKeys('web_agent_geo');
    expect(keys.topics).toBe('web_agent_geo_topics');
    expect(keys.enabled).toBe('web_agent_geo_enabled');
  });
});

// =============================================================================
// WEB_AGENT_PRESETS validation
// =============================================================================

describe('WEB_AGENT_PRESETS', () => {
  it('should have all presets', () => {
    expect(WEB_AGENT_PRESETS.geopolitical).toBeDefined();
    expect(WEB_AGENT_PRESETS.tech).toBeDefined();
    expect(WEB_AGENT_PRESETS.daily).toBeDefined();
  });

  it('geopolitical runs at 6 AM EST', () => {
    expect(WEB_AGENT_PRESETS.geopolitical.targetHourUTC).toBe(11);
  });
});
