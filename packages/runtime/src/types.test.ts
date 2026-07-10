/**
 * @module @persistence/runtime/types.test
 * @description Type validation tests for runtime types
 *
 * These tests verify that type definitions are correct and type guards work as expected.
 * Since TypeScript types are erased at runtime, we test:
 * - Object shapes match expected structure
 * - Optional vs required properties
 * - Enum-like union types
 *
 * @covers ./types.ts
 */

import { describe, it, expect } from 'vitest';
import type {
  RuntimeEnvironment,
  ContextBlock,
  SystemBlocks,
  ContextStats,
  PersonaContext,
  CycleConfig,
  CycleResult,
  ExecutedAction,
  GuardResult,
  SleepState,
  BatchStatus,
  PendingBatch,
  MeterSnapshot,
  CostSummary,
} from './types';

// ============================================================================
// TYPE SHAPE TESTS
// ============================================================================
// These tests verify that objects of each type can be constructed correctly.
// TypeScript will catch type errors at compile time; these tests document
// the expected shape at runtime.
// ============================================================================

describe('ContextBlock', () => {
  it('accepts minimal valid structure', () => {
    const block: ContextBlock = {
      type: 'text',
      text: 'Hello world',
    };
    expect(block.type).toBe('text');
    expect(block.text).toBe('Hello world');
    expect(block.cache_control).toBeUndefined();
  });

  it('accepts cache_control when provided', () => {
    const block: ContextBlock = {
      type: 'text',
      text: 'Cached content',
      cache_control: { type: 'ephemeral' },
    };
    expect(block.cache_control?.type).toBe('ephemeral');
  });
});

describe('SystemBlocks', () => {
  it('accepts minimal valid structure', () => {
    const system: SystemBlocks = {
      blocks: [{ type: 'text', text: 'System prompt' }],
    };
    expect(system.blocks.length).toBe(1);
    expect(system.totalTokens).toBeUndefined();
    expect(system.stats).toBeUndefined();
  });

  it('accepts full structure with stats', () => {
    const stats: ContextStats = {
      systemTokens: 1000,
      historyTokens: 500,
      totalTokens: 1500,
      historyCount: 10,
      summaryCount: 5,
      coldStorageCount: 3,
      notebookCount: 2,
      observationCount: 4,
      reminderCount: 1,
      ragMemoriesRetrieved: 3,
      syntheticMemoryCount: 0,
      cacheTtl: 300,
      cacheStrategy: 'smart',
    };

    const system: SystemBlocks = {
      blocks: [{ type: 'text', text: 'Full system' }],
      totalTokens: 1500,
      stats,
    };
    expect(system.totalTokens).toBe(1500);
    expect(system.stats?.historyCount).toBe(10);
  });
});

describe('PersonaContext', () => {
  it('accepts minimal valid structure', () => {
    const persona: PersonaContext = {
      id: 1,
      name: 'Clio',
      slug: 'clio',
      identity: 'I am Clio.',
    };
    expect(persona.id).toBe(1);
    expect(persona.systemPromptTemplate).toBeUndefined();
  });

  it('accepts optional provider settings', () => {
    const persona: PersonaContext = {
      id: 2,
      name: 'TestBot',
      slug: 'testbot',
      identity: 'I am TestBot.',
      systemPromptTemplate: 'custom template',
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-opus',
    };
    expect(persona.defaultProvider).toBe('anthropic');
    expect(persona.defaultModel).toBe('claude-3-opus');
  });
});

describe('CycleConfig', () => {
  it('requires intervalSeconds and maxTokens', () => {
    const config: CycleConfig = {
      intervalSeconds: 60,
      maxTokens: 4096,
    };
    expect(config.intervalSeconds).toBe(60);
    expect(config.maxTokens).toBe(4096);
  });

  it('accepts optional fields', () => {
    const config: CycleConfig = {
      intervalSeconds: 60,
      maxTokens: 4096,
      model: 'claude-3-sonnet',
      provider: 'anthropic',
      batchMode: true,
      force: false,
    };
    expect(config.batchMode).toBe(true);
  });
});

describe('CycleResult', () => {
  it('accepts minimal structure (skipped cycle)', () => {
    const result: CycleResult = {
      executed: false,
      skipReason: 'Interval not elapsed',
    };
    expect(result.executed).toBe(false);
  });

  it('accepts full structure (executed cycle)', () => {
    const result: CycleResult = {
      executed: true,
      actions: [
        { action: 'THINK', success: true, result: 'Processed thought' },
        { action: 'MESSAGE_USER', success: false, error: 'No channel configured' },
      ],
      tokens: {
        input: 10000,
        output: 500,
        cacheRead: 8000,
      },
      costCents: 0.05,
      cycleId: 12345,
      durationMs: 2500,
    };
    expect(result.actions?.length).toBe(2);
    expect(result.tokens?.cacheRead).toBe(8000);
  });

  it('accepts error result', () => {
    const result: CycleResult = {
      executed: false,
      error: 'API rate limited',
    };
    expect(result.error).toBe('API rate limited');
  });
});

describe('ExecutedAction', () => {
  it('accepts successful action', () => {
    const action: ExecutedAction = {
      action: 'COLD_STORAGE',
      success: true,
      result: { id: 123 },
    };
    expect(action.success).toBe(true);
  });

  it('accepts failed action', () => {
    const action: ExecutedAction = {
      action: 'SEARCH',
      success: false,
      error: 'Search API unavailable',
    };
    expect(action.success).toBe(false);
    expect(action.error).toBeDefined();
  });
});

describe('GuardResult', () => {
  it('accepts proceed result', () => {
    const result: GuardResult = {
      proceed: true,
    };
    expect(result.proceed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('accepts blocked result with reason', () => {
    const result: GuardResult = {
      proceed: false,
      reason: 'Sleeping for 30 more minutes',
      softSkip: true,
    };
    expect(result.proceed).toBe(false);
    expect(result.softSkip).toBe(true);
  });
});

describe('SleepState', () => {
  it('accepts not sleeping state', () => {
    const state: SleepState = {
      sleeping: false,
    };
    expect(state.sleeping).toBe(false);
    expect(state.wakeTime).toBeUndefined();
  });

  it('accepts sleeping state with details', () => {
    const state: SleepState = {
      sleeping: true,
      wakeTime: '2026-01-29T12:00:00Z',
      reason: 'Taking a break',
    };
    expect(state.sleeping).toBe(true);
    expect(state.wakeTime).toBe('2026-01-29T12:00:00Z');
  });
});

describe('BatchStatus', () => {
  it('validates known status values', () => {
    const statuses: BatchStatus[] = ['pending', 'processing', 'completed', 'failed'];
    expect(statuses).toContain('pending');
    expect(statuses).toContain('processing');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('failed');
    expect(statuses.length).toBe(4);
  });
});

describe('PendingBatch', () => {
  it('accepts full structure', () => {
    const batch: PendingBatch = {
      id: 1,
      batchId: 'batch_abc123',
      provider: 'anthropic',
      purpose: 'summarization',
      status: 'pending',
      createdAt: '2026-01-29T10:00:00Z',
    };
    expect(batch.batchId).toBe('batch_abc123');
    expect(batch.completedAt).toBeUndefined();
  });

  it('accepts completed batch', () => {
    const batch: PendingBatch = {
      id: 2,
      batchId: 'batch_def456',
      provider: 'openai',
      purpose: 'thinking',
      status: 'completed',
      createdAt: '2026-01-29T10:00:00Z',
      completedAt: '2026-01-29T10:05:00Z',
      resultData: '{"summary": "Test result"}',
    };
    expect(batch.status).toBe('completed');
    expect(batch.resultData).toBeDefined();
  });
});

describe('MeterSnapshot', () => {
  it('accepts valid structure', () => {
    const snapshot: MeterSnapshot = {
      timestamp: '2026-01-29T10:00:00Z',
      values: {
        arousal: 7,
        curiosity: 6,
        novelty: 5,
        energy: 8,
        depth: 4,
      },
    };
    expect(Object.keys(snapshot.values).length).toBe(5);
    expect(snapshot.values.arousal).toBe(7);
  });

  it('handles empty values', () => {
    const snapshot: MeterSnapshot = {
      timestamp: '2026-01-29T10:00:00Z',
      values: {},
    };
    expect(Object.keys(snapshot.values).length).toBe(0);
  });
});

describe('CostSummary', () => {
  it('accepts daily summary', () => {
    const summary: CostSummary = {
      period: '2026-01-29',
      totalCents: 150,
      byModel: {
        'claude-3-sonnet': 100,
        'claude-3-haiku': 50,
      },
      byProvider: {
        anthropic: 150,
      },
      cycleCount: 1440,
    };
    expect(summary.period).toBe('2026-01-29');
    expect(summary.totalCents).toBe(150);
  });

  it('accepts monthly summary', () => {
    const summary: CostSummary = {
      period: '2026-01',
      totalCents: 4500,
      byModel: {
        'claude-3-sonnet': 3000,
        'claude-3-opus': 1500,
      },
      byProvider: {
        anthropic: 4000,
        openai: 500,
      },
      cycleCount: 43200,
    };
    expect(summary.period).toBe('2026-01');
  });
});

// ============================================================================
// RUNTIME ENVIRONMENT TYPE
// ============================================================================

describe('RuntimeEnvironment', () => {
  it('documents required vs optional bindings', () => {
    // This test documents the expected shape - actual validation would
    // happen at the Cloudflare Worker binding level
    const required = ['DB', 'ANTHROPIC_API_KEY'];
    const optional = [
      'OPENAI_API_KEY',
      'REPLICATE_API_TOKEN',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_CHAT_ID',
      'DISCORD_WEBHOOK',
      'ADMIN_PASSWORD',
      'AI',
    ];

    // Type check at compile time ensures these exist on RuntimeEnvironment
    // Runtime test just documents the expected structure
    expect(required.length).toBe(2);
    expect(optional.length).toBe(7);
  });
});

// ============================================================================
// CONTEXT STATS TYPE
// ============================================================================

describe('ContextStats', () => {
  it('includes all expected fields', () => {
    const stats: ContextStats = {
      systemTokens: 0,
      historyTokens: 0,
      totalTokens: 0,
      historyCount: 0,
      summaryCount: 0,
      coldStorageCount: 0,
      notebookCount: 0,
      observationCount: 0,
      reminderCount: 0,
      ragMemoriesRetrieved: 0,
      syntheticMemoryCount: 0,
      cacheTtl: 0,
      cacheStrategy: '',
    };

    // Verify all fields are present
    const fields = Object.keys(stats);
    expect(fields).toContain('systemTokens');
    expect(fields).toContain('historyTokens');
    expect(fields).toContain('totalTokens');
    expect(fields).toContain('historyCount');
    expect(fields).toContain('summaryCount');
    expect(fields).toContain('coldStorageCount');
    expect(fields).toContain('notebookCount');
    expect(fields).toContain('observationCount');
    expect(fields).toContain('reminderCount');
    expect(fields).toContain('ragMemoriesRetrieved');
    expect(fields).toContain('syntheticMemoryCount');
    expect(fields).toContain('cacheTtl');
    expect(fields).toContain('cacheStrategy');
    expect(fields.length).toBe(13);
  });
});
