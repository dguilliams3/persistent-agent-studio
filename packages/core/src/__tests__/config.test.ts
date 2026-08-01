/**
 * @module @persistence/core/__tests__/config.test
 * @description Unit tests for configuration builders and utilities
 *
 * Tests cover:
 * - createTokenConfig() - validation and edge cases
 * - createSizeConfig() - validation and edge cases
 * - createThresholdConfig() - validation and edge cases
 * - Pre-built configurations (SUMMARIZE_CONFIG, RAG_CONFIG, etc.)
 * - validateConfigs() - overall validation
 *
 * @covers ../config.ts
 */

import { describe, it, expect } from 'vitest';
import {
  createTokenConfig,
  createSizeConfig,
  createThresholdConfig,
  validateConfigs,
  SUMMARIZE_CONFIG,
  BATCH_SUMMARIZE_CONFIG,
  HISTORY_TOKEN_CONFIG,
  RAG_CONFIG,
  SUMMARY_BUFFER_CONFIG,
  QUICK_FOLLOWUP_CONFIG,
  BATCH_RETRY_CONFIG,
  type TokenConfig,
  type SizeConfig,
  type ThresholdConfig,
} from '../config';

// ============================================================================
// createTokenConfig()
// ============================================================================

describe('createTokenConfig', () => {
  describe('valid inputs', () => {
    it('creates config with only maxTokens', () => {
      const config = createTokenConfig({ maxTokens: 4000 });
      expect(config.maxTokens).toBe(4000);
      expect(config.defaultTokens).toBeUndefined();
      expect(config.minTokens).toBeUndefined();
    });

    it('creates config with all parameters', () => {
      const config = createTokenConfig({
        maxTokens: 8000,
        defaultTokens: 4000,
        minTokens: 1000,
      });
      expect(config.maxTokens).toBe(8000);
      expect(config.defaultTokens).toBe(4000);
      expect(config.minTokens).toBe(1000);
    });

    it('accepts zero for optional parameters', () => {
      const config = createTokenConfig({
        maxTokens: 4000,
        defaultTokens: 0,
        minTokens: 0,
      });
      expect(config.defaultTokens).toBe(0);
      expect(config.minTokens).toBe(0);
    });

    it('accepts very large token values', () => {
      const config = createTokenConfig({ maxTokens: 200000 }); // Claude context window
      expect(config.maxTokens).toBe(200000);
    });
  });

  describe('invalid inputs', () => {
    it('throws when maxTokens is 0', () => {
      expect(() => createTokenConfig({ maxTokens: 0 }))
        .toThrow('maxTokens is required and must be > 0');
    });

    it('throws when maxTokens is negative', () => {
      expect(() => createTokenConfig({ maxTokens: -100 }))
        .toThrow('maxTokens is required and must be > 0');
    });

    it('throws when defaultTokens is negative', () => {
      expect(() => createTokenConfig({ maxTokens: 4000, defaultTokens: -1 }))
        .toThrow('defaultTokens must be >= 0');
    });

    it('throws when minTokens is negative', () => {
      expect(() => createTokenConfig({ maxTokens: 4000, minTokens: -1 }))
        .toThrow('minTokens must be >= 0');
    });
  });
});

// ============================================================================
// createSizeConfig()
// ============================================================================

describe('createSizeConfig', () => {
  describe('valid inputs', () => {
    it('creates config with only maxSize', () => {
      const config = createSizeConfig({ maxSize: 100 });
      expect(config.maxSize).toBe(100);
      expect(config.defaultSize).toBeUndefined();
      expect(config.minSize).toBeUndefined();
    });

    it('creates config with all parameters', () => {
      const config = createSizeConfig({
        maxSize: 100,
        defaultSize: 50,
        minSize: 10,
      });
      expect(config.maxSize).toBe(100);
      expect(config.defaultSize).toBe(50);
      expect(config.minSize).toBe(10);
    });

    it('accepts zero for optional parameters', () => {
      const config = createSizeConfig({
        maxSize: 100,
        defaultSize: 0,
        minSize: 0,
      });
      expect(config.defaultSize).toBe(0);
      expect(config.minSize).toBe(0);
    });

    it('accepts size of 1', () => {
      const config = createSizeConfig({ maxSize: 1 });
      expect(config.maxSize).toBe(1);
    });
  });

  describe('invalid inputs', () => {
    it('throws when maxSize is 0', () => {
      expect(() => createSizeConfig({ maxSize: 0 }))
        .toThrow('maxSize is required and must be > 0');
    });

    it('throws when maxSize is negative', () => {
      expect(() => createSizeConfig({ maxSize: -10 }))
        .toThrow('maxSize is required and must be > 0');
    });

    it('throws when defaultSize is negative', () => {
      expect(() => createSizeConfig({ maxSize: 100, defaultSize: -1 }))
        .toThrow('defaultSize must be >= 0');
    });

    it('throws when minSize is negative', () => {
      expect(() => createSizeConfig({ maxSize: 100, minSize: -1 }))
        .toThrow('minSize must be >= 0');
    });
  });
});

// ============================================================================
// createThresholdConfig()
// ============================================================================

describe('createThresholdConfig', () => {
  describe('valid inputs', () => {
    it('creates config with only threshold', () => {
      const config = createThresholdConfig({ threshold: 12000 });
      expect(config.threshold).toBe(12000);
      expect(config.target).toBeUndefined();
      expect(config.minValue).toBeUndefined();
    });

    it('creates config with all parameters', () => {
      const config = createThresholdConfig({
        threshold: 12000,
        target: 6000,
        minValue: 3,
      });
      expect(config.threshold).toBe(12000);
      expect(config.target).toBe(6000);
      expect(config.minValue).toBe(3);
    });

    it('accepts zero for threshold', () => {
      const config = createThresholdConfig({ threshold: 0 });
      expect(config.threshold).toBe(0);
    });

    it('accepts zero for optional parameters', () => {
      const config = createThresholdConfig({
        threshold: 100,
        target: 0,
        minValue: 0,
      });
      expect(config.target).toBe(0);
      expect(config.minValue).toBe(0);
    });
  });

  describe('invalid inputs', () => {
    it('throws when threshold is negative', () => {
      expect(() => createThresholdConfig({ threshold: -1 }))
        .toThrow('threshold is required and must be >= 0');
    });

    it('throws when threshold is undefined', () => {
      expect(() => createThresholdConfig({ threshold: undefined as unknown as number }))
        .toThrow('threshold is required and must be >= 0');
    });

    it('throws when target is negative', () => {
      expect(() => createThresholdConfig({ threshold: 100, target: -1 }))
        .toThrow('target must be >= 0');
    });

    it('throws when minValue is negative', () => {
      expect(() => createThresholdConfig({ threshold: 100, minValue: -1 }))
        .toThrow('minValue must be >= 0');
    });
  });
});

// ============================================================================
// Pre-built Configurations
// ============================================================================

describe('SUMMARIZE_CONFIG', () => {
  it('has valid entries configuration', () => {
    expect(SUMMARIZE_CONFIG.entries.maxSize).toBe(100);
    expect(SUMMARIZE_CONFIG.entries.minSize).toBe(10);
  });

  it('has valid tokens configuration', () => {
    expect(SUMMARIZE_CONFIG.tokens.maxTokens).toBe(4000);
  });
});

describe('BATCH_SUMMARIZE_CONFIG', () => {
  it('has valid batch configuration', () => {
    expect(BATCH_SUMMARIZE_CONFIG.batch.defaultSize).toBe(50);
    expect(BATCH_SUMMARIZE_CONFIG.batch.maxSize).toBe(60);
    expect(BATCH_SUMMARIZE_CONFIG.batch.minSize).toBe(15);
  });

  it('has valid summaries configuration', () => {
    expect(BATCH_SUMMARIZE_CONFIG.summaries.maxSize).toBe(2);
    expect(BATCH_SUMMARIZE_CONFIG.summaries.minSize).toBe(8);
  });

  it('has valid tokens configuration', () => {
    expect(BATCH_SUMMARIZE_CONFIG.tokens.maxTokens).toBe(8000);
  });

  it('has quality constraints', () => {
    expect(BATCH_SUMMARIZE_CONFIG.quality.minSummaryLength).toBe(500);
  });
});

describe('HISTORY_TOKEN_CONFIG', () => {
  it('has valid tail threshold configuration', () => {
    expect(HISTORY_TOKEN_CONFIG.tail.threshold).toBe(12000);
    expect(HISTORY_TOKEN_CONFIG.tail.target).toBe(6000);
    expect(HISTORY_TOKEN_CONFIG.tail.minValue).toBe(3);
  });
});

describe('RAG_CONFIG', () => {
  it('has valid retrieval configuration', () => {
    expect(RAG_CONFIG.retrieval.maxSize).toBe(20);
    expect(RAG_CONFIG.retrieval.defaultSize).toBe(10);
  });

  it('has valid scoring configuration', () => {
    expect(RAG_CONFIG.scoring.minScore).toBe(0.7);
    expect(RAG_CONFIG.scoring.boostRecent).toBe(1.2);
  });

  it('has valid diversity configuration', () => {
    expect(RAG_CONFIG.diversity.lambda).toBe(0.5);
    expect(RAG_CONFIG.diversity.maxSimilar).toBe(0.8);
  });
});

describe('SUMMARY_BUFFER_CONFIG', () => {
  it('has reasonable context and buffer sizes', () => {
    expect(SUMMARY_BUFFER_CONFIG.contextSize).toBe(10);
    expect(SUMMARY_BUFFER_CONFIG.bufferSize).toBe(15);
  });

  it('has token thresholds', () => {
    expect(SUMMARY_BUFFER_CONFIG.tailTokenThreshold).toBe(8000);
    expect(SUMMARY_BUFFER_CONFIG.tailTokenTarget).toBe(4000);
  });

  it('has minimum tail summaries', () => {
    expect(SUMMARY_BUFFER_CONFIG.minTailSummaries).toBe(1);
  });
});

describe('QUICK_FOLLOWUP_CONFIG', () => {
  it('has valid timing configuration', () => {
    expect(QUICK_FOLLOWUP_CONFIG.delayAfterSearchMs).toBe(30000);
  });

  it('has batch threshold configuration', () => {
    expect(QUICK_FOLLOWUP_CONFIG.batchAvgThresholdSeconds).toBe(180);
    expect(QUICK_FOLLOWUP_CONFIG.batchAvgLookbackHours).toBe(1);
  });

  it('has feature flags', () => {
    expect(QUICK_FOLLOWUP_CONFIG.enableAfterSearch).toBe(true);
  });
});

describe('BATCH_RETRY_CONFIG', () => {
  it('has valid retry configuration', () => {
    expect(BATCH_RETRY_CONFIG.maxRetries).toBe(3);
    expect(BATCH_RETRY_CONFIG.baseDelayMs).toBe(1000);
    expect(BATCH_RETRY_CONFIG.maxDelayMs).toBe(8000);
  });
});

// ============================================================================
// validateConfigs()
// ============================================================================

describe('validateConfigs', () => {
  it('returns true when all configs are valid', () => {
    expect(validateConfigs()).toBe(true);
  });

  it('confirms all config objects are accessible', () => {
    // This implicitly tests that the configs were created without errors
    expect(() => {
      Object.values(SUMMARIZE_CONFIG);
      Object.values(BATCH_SUMMARIZE_CONFIG);
      Object.values(HISTORY_TOKEN_CONFIG);
      Object.values(RAG_CONFIG);
      Object.values(SUMMARY_BUFFER_CONFIG);
      Object.values(QUICK_FOLLOWUP_CONFIG);
      Object.values(BATCH_RETRY_CONFIG);
    }).not.toThrow();
  });
});

// ============================================================================
// Type Guards & Edge Cases
// ============================================================================

describe('type structure verification', () => {
  it('TokenConfig has correct shape', () => {
    const config: TokenConfig = createTokenConfig({ maxTokens: 1000 });
    // TypeScript compile-time check - these properties exist
    expect(typeof config.maxTokens).toBe('number');
    expect(config.defaultTokens === undefined || typeof config.defaultTokens === 'number').toBe(true);
    expect(config.minTokens === undefined || typeof config.minTokens === 'number').toBe(true);
  });

  it('SizeConfig has correct shape', () => {
    const config: SizeConfig = createSizeConfig({ maxSize: 100 });
    expect(typeof config.maxSize).toBe('number');
    expect(config.defaultSize === undefined || typeof config.defaultSize === 'number').toBe(true);
    expect(config.minSize === undefined || typeof config.minSize === 'number').toBe(true);
  });

  it('ThresholdConfig has correct shape', () => {
    const config: ThresholdConfig = createThresholdConfig({ threshold: 100 });
    expect(typeof config.threshold).toBe('number');
    expect(config.target === undefined || typeof config.target === 'number').toBe(true);
    expect(config.minValue === undefined || typeof config.minValue === 'number').toBe(true);
  });
});
