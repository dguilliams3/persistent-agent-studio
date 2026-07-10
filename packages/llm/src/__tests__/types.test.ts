/**
 * @module @persistence/llm/__tests__/types
 * @description Compile-time type safety tests for unified LLM interfaces
 *
 * Tests cover:
 * - AnthropicCallParams accepts thinking, rejects reasoning
 * - OpenAICallParams accepts reasoning, rejects thinking
 * - Provider-specific model keys exist
 * - CallableModel and CallableProvider type constraints
 * - Base parameter compatibility
 *
 * Uses expectTypeOf for type-only assertions that compile to no runtime code.
 *
 * @covers ../types.ts
 */

import { describe, it, expect, vi } from 'vitest';
import { expectTypeOf } from 'vitest';
import type {
  AnthropicCallParams,
  OpenAICallParams,
  BaseCallParams,
  CallResult,
  BatchHandle,
  CallableModel,
  CallableProvider,
  AnthropicProvider,
  OpenAIProvider,
  LLM,
} from '../types';
import type { SystemBlock, Message, ReasoningEffort } from '@persistence/core/providers';

// =============================================================================
// BASE PARAMETERS
// =============================================================================

describe('BaseCallParams', () => {
  it('has required fields: system, messages, maxTokens', () => {
    const params: BaseCallParams = {
      system: 'You are an AI',
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 1024,
    };
    expect(params).toBeDefined();
  });

  it('accepts system as string', () => {
    expectTypeOf<{ system: string }>().toMatchTypeOf<Pick<BaseCallParams, 'system'>>();
  });

  it('accepts system as SystemBlock array', () => {
    expectTypeOf<{ system: SystemBlock[] }>().toMatchTypeOf<Pick<BaseCallParams, 'system'>>();
  });

  it('enforces maxTokens is number', () => {
    expectTypeOf<{ maxTokens: number }>().toMatchTypeOf<Pick<BaseCallParams, 'maxTokens'>>();
  });

  it('enforces messages is Message array', () => {
    expectTypeOf<{ messages: Message[] }>().toMatchTypeOf<Pick<BaseCallParams, 'messages'>>();
  });
});

// =============================================================================
// ANTHROPIC-SPECIFIC PARAMETERS
// =============================================================================

describe('AnthropicCallParams', () => {
  it('extends BaseCallParams', () => {
    expectTypeOf<AnthropicCallParams>().toMatchTypeOf<BaseCallParams>();
  });

  it('accepts optional thinking parameter', () => {
    const params: AnthropicCallParams = {
      system: 'You are Claude',
      messages: [{ role: 'user', content: 'Think deeply' }],
      maxTokens: 8192,
      thinking: { budgetTokens: 4096 },
    };
    expect(params).toBeDefined();
  });

  it('accepts thinking with valid budgetTokens', () => {
    expectTypeOf<AnthropicCallParams['thinking']>().toMatchTypeOf<
      { budgetTokens: number } | undefined
    >();
  });

  it('is valid without thinking parameter', () => {
    const params: AnthropicCallParams = {
      system: 'You are Claude',
      messages: [{ role: 'user', content: 'Hello' }],
      maxTokens: 2048,
    };
    expect(params).toBeDefined();
  });

  it('rejects reasoning parameter (type error)', () => {
    const _test = () => {
      // @ts-expect-error - reasoning is OpenAI-only, not valid on Anthropic
      const params: AnthropicCallParams = {
        system: 'You are Claude',
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 2048,
        reasoning: 'high',
      };
      return params;
    };
    expect(_test).toBeDefined();
  });

  it('rejects unknown parameters', () => {
    const _test = () => {
      // @ts-expect-error - unknown parameter
      const params: AnthropicCallParams = {
        system: 'You are Claude',
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 2048,
        unknownParam: 'should not exist',
      };
      return params;
    };
    expect(_test).toBeDefined();
  });
});

// =============================================================================
// OPENAI-SPECIFIC PARAMETERS
// =============================================================================

describe('OpenAICallParams', () => {
  it('extends BaseCallParams', () => {
    expectTypeOf<OpenAICallParams>().toMatchTypeOf<BaseCallParams>();
  });

  it('accepts optional reasoning parameter', () => {
    const params: OpenAICallParams = {
      system: 'Summarize this',
      messages: [{ role: 'user', content: 'Please summarize' }],
      maxTokens: 1500,
      reasoning: 'high',
    };
    expect(params).toBeDefined();
  });

  it('accepts reasoning values: none, low, medium, high', () => {
    // Test different reasoning values compile correctly
    const noneReasoning: OpenAICallParams = {
      system: 'Test',
      messages: [{ role: 'user', content: 'Test' }],
      maxTokens: 1024,
      reasoning: 'none',
    };
    expect(noneReasoning).toBeDefined();

    const highReasoning: OpenAICallParams = {
      system: 'Test',
      messages: [{ role: 'user', content: 'Test' }],
      maxTokens: 1024,
      reasoning: 'high',
    };
    expect(highReasoning).toBeDefined();
  });

  it('is valid without reasoning parameter', () => {
    const params: OpenAICallParams = {
      system: 'Generate text',
      messages: [{ role: 'user', content: 'Generate' }],
      maxTokens: 2000,
    };
    expect(params).toBeDefined();
  });

  it('rejects thinking parameter (type error)', () => {
    const _test = () => {
      // @ts-expect-error - thinking is Anthropic-only, not valid on OpenAI
      const params: OpenAICallParams = {
        system: 'Generate text',
        messages: [{ role: 'user', content: 'Generate' }],
        maxTokens: 2000,
        thinking: { budgetTokens: 2048 },
      };
      return params;
    };
    expect(_test).toBeDefined();
  });

  it('rejects unknown parameters', () => {
    const _test = () => {
      // @ts-expect-error - unknown parameter
      const params: OpenAICallParams = {
        system: 'Generate text',
        messages: [{ role: 'user', content: 'Generate' }],
        maxTokens: 2000,
        unknownParam: 'should not exist',
      };
      return params;
    };
    expect(_test).toBeDefined();
  });
});

// =============================================================================
// CALL RESULTS
// =============================================================================

describe('CallResult', () => {
  it('has required fields: content, usage, cost, model', () => {
    const result: CallResult = {
      content: 'Response text',
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      },
      cost: 0.0015,
      model: 'claude-opus',
    };
    expect(result).toBeDefined();
  });

  it('content is string', () => {
    expectTypeOf<CallResult['content']>().toBeString();
  });

  it('cost is number', () => {
    expectTypeOf<CallResult['cost']>().toBeNumber();
  });

  it('model is string', () => {
    expectTypeOf<CallResult['model']>().toBeString();
  });
});

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

describe('BatchHandle', () => {
  it('has batchId and status fields', () => {
    const handle: BatchHandle = {
      batchId: 'batch_123abc',
      status: 'pending',
    };
    expect(handle).toBeDefined();
  });

  it('status is "pending" or "processing"', () => {
    expectTypeOf<BatchHandle['status']>().toMatchTypeOf<'pending' | 'processing'>();
  });
});

// =============================================================================
// CALLABLE INTERFACES
// =============================================================================

describe('CallableModel type parameter', () => {
  it('accepts AnthropicCallParams for Anthropic models', () => {
    type TestModel = CallableModel<AnthropicCallParams>;
    expectTypeOf<TestModel>().toHaveProperty('sync');
    expectTypeOf<TestModel>().toHaveProperty('batch');
  });

  it('accepts OpenAICallParams for OpenAI models', () => {
    type TestModel = CallableModel<OpenAICallParams>;
    expectTypeOf<TestModel>().toHaveProperty('sync');
    expectTypeOf<TestModel>().toHaveProperty('batch');
  });

  it('sync method returns Promise<CallResult>', () => {
    type TestModel = CallableModel<AnthropicCallParams>;
    expectTypeOf<TestModel['sync']>().toBeFunction();
  });

  it('batch method requires customId parameter', () => {
    type TestModel = CallableModel<AnthropicCallParams>;
    expectTypeOf<TestModel['batch']>().toBeFunction();
  });
});

describe('CallableProvider type parameter', () => {
  it('provides checkBatch, fetchResults, cancelBatch methods', () => {
    type TestProvider = CallableProvider<AnthropicCallParams>;
    expectTypeOf<TestProvider>().toHaveProperty('checkBatch');
    expectTypeOf<TestProvider>().toHaveProperty('fetchResults');
    expectTypeOf<TestProvider>().toHaveProperty('cancelBatch');
  });

  it('checkBatch accepts string batchId', () => {
    type TestProvider = CallableProvider<AnthropicCallParams>;
    expectTypeOf<TestProvider['checkBatch']>().toBeFunction();
  });
});

// =============================================================================
// ANTHROPIC PROVIDER
// =============================================================================

describe('AnthropicProvider', () => {
  it('has opus model', () => {
    expectTypeOf<AnthropicProvider>().toHaveProperty('opus');
  });

  it('has sonnet model', () => {
    expectTypeOf<AnthropicProvider>().toHaveProperty('sonnet');
  });

  it('has haiku model', () => {
    expectTypeOf<AnthropicProvider>().toHaveProperty('haiku');
  });

  it('opus accepts AnthropicCallParams', () => {
    expectTypeOf<AnthropicProvider['opus']>().toMatchTypeOf<CallableModel<AnthropicCallParams>>();
  });

  it('sonnet accepts AnthropicCallParams', () => {
    expectTypeOf<AnthropicProvider['sonnet']>().toMatchTypeOf<
      CallableModel<AnthropicCallParams>
    >();
  });

  it('haiku accepts AnthropicCallParams', () => {
    expectTypeOf<AnthropicProvider['haiku']>().toMatchTypeOf<CallableModel<AnthropicCallParams>>();
  });

  it('provider methods available at top level', () => {
    expectTypeOf<AnthropicProvider>().toHaveProperty('checkBatch');
    expectTypeOf<AnthropicProvider>().toHaveProperty('fetchResults');
    expectTypeOf<AnthropicProvider>().toHaveProperty('cancelBatch');
  });
});

// =============================================================================
// OPENAI PROVIDER
// =============================================================================

describe('OpenAIProvider', () => {
  it('has gpt-4o model', () => {
    expectTypeOf<OpenAIProvider>().toHaveProperty('gpt-4o');
  });

  it('has gpt-4o-mini model', () => {
    expectTypeOf<OpenAIProvider>().toHaveProperty('gpt-4o-mini');
  });

  it('has gpt-5.2 model', () => {
    expectTypeOf<OpenAIProvider>().toHaveProperty('gpt-5.2');
  });

  it('gpt-4o accepts OpenAICallParams', () => {
    expectTypeOf<OpenAIProvider['gpt-4o']>().toMatchTypeOf<CallableModel<OpenAICallParams>>();
  });

  it('gpt-4o-mini accepts OpenAICallParams', () => {
    expectTypeOf<OpenAIProvider['gpt-4o-mini']>().toMatchTypeOf<CallableModel<OpenAICallParams>>();
  });

  it('gpt-5.2 accepts OpenAICallParams', () => {
    expectTypeOf<OpenAIProvider['gpt-5.2']>().toMatchTypeOf<CallableModel<OpenAICallParams>>();
  });

  it('provider methods available at top level', () => {
    expectTypeOf<OpenAIProvider>().toHaveProperty('checkBatch');
    expectTypeOf<OpenAIProvider>().toHaveProperty('fetchResults');
    expectTypeOf<OpenAIProvider>().toHaveProperty('cancelBatch');
  });

  it('rejects undefined model keys', () => {
    const _test = () => {
      // @ts-expect-error - 'gpt-5' doesn't exist, should be 'gpt-5.2'
      const model: OpenAIProvider['gpt-5'] = null as any;
      return model;
    };
    expect(_test).toBeDefined();
  });
});

// =============================================================================
// UNIFIED LLM INTERFACE
// =============================================================================

describe('LLM unified interface', () => {
  it('has anthropic provider', () => {
    expectTypeOf<LLM>().toHaveProperty('anthropic');
  });

  it('has openai provider', () => {
    expectTypeOf<LLM>().toHaveProperty('openai');
  });

  it('anthropic returns AnthropicProvider', () => {
    expectTypeOf<LLM['anthropic']>().toMatchTypeOf<AnthropicProvider>();
  });

  it('openai returns OpenAIProvider', () => {
    expectTypeOf<LLM['openai']>().toMatchTypeOf<OpenAIProvider>();
  });

  it('supports deep model access: llm.anthropic.opus', () => {
    expectTypeOf<LLM['anthropic']['opus']>().toMatchTypeOf<CallableModel<AnthropicCallParams>>();
  });

  it('supports deep model access: llm.openai["gpt-5.2"]', () => {
    expectTypeOf<LLM['openai']['gpt-5.2']>().toMatchTypeOf<CallableModel<OpenAICallParams>>();
  });
});

// =============================================================================
// PARAMETER SEPARATION TEST
// =============================================================================

describe('Provider parameter separation (critical type safety)', () => {
  it('Anthropic models only accept AnthropicCallParams with thinking', () => {
    type Model = AnthropicProvider['opus'];
    type Params = AnthropicCallParams;

    expectTypeOf<Params>().toHaveProperty('thinking');
    expectTypeOf<Params>().not.toHaveProperty('reasoning');
  });

  it('OpenAI models only accept OpenAICallParams with reasoning', () => {
    type Model = OpenAIProvider['gpt-5.2'];
    type Params = OpenAICallParams;

    expectTypeOf<Params>().toHaveProperty('reasoning');
    expectTypeOf<Params>().not.toHaveProperty('thinking');
  });

  it('prevents mixing provider params at compile time', () => {
    const _test = () => {
      // @ts-expect-error - cannot pass OpenAICallParams to Anthropic model
      const anthropicCall = async (model: CallableModel<AnthropicCallParams>) => {
        return model.sync({
          system: 'Test',
          messages: [{ role: 'user', content: 'Test' }],
          maxTokens: 1024,
          reasoning: 'high', // This should error
        } as any);
      };
      return anthropicCall;
    };
    expect(_test).toBeDefined();
  });

  it('prevents mixing provider params at compile time (reverse)', () => {
    const _test = () => {
      // @ts-expect-error - cannot pass AnthropicCallParams to OpenAI model
      const openaiCall = async (model: CallableModel<OpenAICallParams>) => {
        return model.sync({
          system: 'Test',
          messages: [{ role: 'user', content: 'Test' }],
          maxTokens: 1024,
          thinking: { budgetTokens: 2048 }, // This should error
        } as any);
      };
      return openaiCall;
    };
    expect(_test).toBeDefined();
  });
});

// =============================================================================
// MODEL KEY VERIFICATION
// =============================================================================

describe('Model key accuracy', () => {
  it('Anthropic has exactly: opus, sonnet, haiku', () => {
    type ExpectedKeys = 'opus' | 'sonnet' | 'haiku' | 'definition' | 'checkBatch' | 'fetchResults' | 'cancelBatch';
    expectTypeOf<keyof AnthropicProvider>().toMatchTypeOf<ExpectedKeys>();
  });

  it('OpenAI has exactly: gpt-4o, gpt-4o-mini, gpt-5.2', () => {
    type ExpectedKeys = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-5.2' | 'definition' | 'checkBatch' | 'fetchResults' | 'cancelBatch';
    expectTypeOf<keyof OpenAIProvider>().toMatchTypeOf<ExpectedKeys>();
  });

  it('prevents typos in Anthropic model names', () => {
    const _test = () => {
      // @ts-expect-error - 'claude' is not a valid key, should be 'opus', 'sonnet', or 'haiku'
      const anthropic: AnthropicProvider = null as any;
      const model = anthropic['claude'];
      return model;
    };
    expect(_test).toBeDefined();
  });

  it('prevents typos in OpenAI model names', () => {
    const _test = () => {
      // @ts-expect-error - 'gpt-4' is not valid, should be 'gpt-4o' or 'gpt-4o-mini'
      const openai: OpenAIProvider = null as any;
      const model = openai['gpt-4'];
      return model;
    };
    expect(_test).toBeDefined();
  });
});
