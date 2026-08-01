/**
 * Integration tests for SearchGateway - makes REAL API calls
 *
 * Run with: INTEGRATION=true ANTHROPIC_API_KEY=your-key pnpm test packages/services/src/search/gateway.integration.test.ts
 *
 * These tests are SKIPPED by default. Set INTEGRATION=true to run them.
 * You must provide a valid ANTHROPIC_API_KEY for tests to work.
 *
 * @module @persistence/services/search/gateway.integration.test
 * @covers SearchGateway with real API calls
 */

import { describe, it, expect } from 'vitest';
import { SearchGateway } from './gateway';

// Skip all tests unless INTEGRATION env var is set
const INTEGRATION = process.env.INTEGRATION === 'true';
const API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Use describe.skipIf for conditional test blocks
describe.skipIf(!INTEGRATION)('SearchGateway Integration Tests', () => {
  // Validate API key is present when running integration tests
  it('should have ANTHROPIC_API_KEY set', () => {
    expect(API_KEY).toBeTruthy();
    expect(API_KEY.length).toBeGreaterThan(10);
  });

  describe('search()', () => {
    it('should perform real web search and return results with metadata', async () => {
      const gateway = SearchGateway.fromCredentials(API_KEY);

      // Use a factual query that should return consistent results
      const result = await gateway.search('What is the capital of France?');

      // Verify result structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('metadata');

      // Check metadata was captured
      expect(result.metadata).toHaveProperty('provider', 'anthropic');
      expect(result.metadata).toHaveProperty('model');
      expect(result.metadata).toHaveProperty('tool');
      expect(result.metadata).toHaveProperty('durationMs');
      expect(result.metadata).toHaveProperty('query', 'What is the capital of France?');

      // Duration should be reasonable (> 0ms)
      expect(result.metadata.durationMs).toBeGreaterThan(0);

      if (result.success) {
        // Summary should contain relevant content
        expect(result.summary).toBeTruthy();
        expect(result.summary?.toLowerCase()).toMatch(/paris|france|capital/i);
      } else {
        // If failed, should have error message
        expect(result.error).toBeTruthy();
      }
    }, 30000); // 30 second timeout for real API call

    it('should handle current events queries', async () => {
      const gateway = SearchGateway.fromCredentials(API_KEY);

      // Test with a current events query
      const result = await gateway.search('Latest technology news 2026');

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.durationMs).toBeGreaterThan(0);

      if (result.success) {
        expect(result.summary).toBeTruthy();
        expect(result.summary!.length).toBeGreaterThan(50);
      }
    }, 30000);
  });

  describe('searchSimple()', () => {
    it('should return simplified result format for backwards compatibility', async () => {
      const gateway = SearchGateway.fromCredentials(API_KEY);

      const result = await gateway.searchSimple('What year was the Eiffel Tower built?');

      // SimpleSearchResult format: { result?: string, error?: string }
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

      if ('result' in result && result.result) {
        // Success case
        expect(result.result).toBeTruthy();
        expect(result.result.toLowerCase()).toMatch(/1889|eiffel|tower/i);
        expect(result.error).toBeUndefined();
      } else if ('error' in result && result.error) {
        // Error case
        expect(result.error).toBeTruthy();
      }
    }, 30000);
  });

  describe('getProvider()', () => {
    it('should return the underlying ClaudeSearchProvider', () => {
      const gateway = SearchGateway.fromCredentials(API_KEY);
      const provider = gateway.getProvider();

      expect(provider).toBeDefined();
      expect(typeof provider.search).toBe('function');
      expect(typeof provider.getModel).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should handle invalid API key gracefully', async () => {
      const gateway = SearchGateway.fromCredentials('invalid-key');

      const result = await gateway.search('test query');

      // Should still return a result object with metadata
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.query).toBe('test query');

      // Should indicate failure
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    }, 30000);
  });
});

// Provide clear instructions when tests are skipped
describe('SearchGateway Integration Tests (Instructions)', () => {
  it.skipIf(INTEGRATION)('Run with INTEGRATION=true to enable real API tests', () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════════╗
    ║  Integration Tests SKIPPED                                        ║
    ║                                                                   ║
    ║  To run real API tests:                                          ║
    ║                                                                   ║
    ║  INTEGRATION=true ANTHROPIC_API_KEY=your-key pnpm test \\        ║
    ║    packages/services/src/search/gateway.integration.test.ts       ║
    ║                                                                   ║
    ╚══════════════════════════════════════════════════════════════════╝
    `);
    expect(true).toBe(true);
  });
});
