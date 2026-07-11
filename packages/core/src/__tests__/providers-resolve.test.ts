/**
 * @module @persistence/core/__tests__/providers-resolve.test
 * @description Unit tests for provider resolution functions
 *
 * Tests cover:
 * - resolveProvider() - provider name to definition
 * - resolveModel() - model name to definition for a provider
 * - resolveProviderModel() - "provider/model" string to both
 * - isValidProviderModel() - validation without throwing
 * - getAllProviderModels() - list all combinations
 *
 * @covers ../providers/resolve.ts
 */

import { describe, it, expect } from 'vitest';
import {
  resolveProvider,
  resolveModel,
  resolveProviderModel,
  isValidProviderModel,
  getAllProviderModels,
} from '../providers/resolve';
import { PROVIDERS } from '../providers/index';

// ============================================================================
// resolveProvider()
// ============================================================================

describe('resolveProvider()', () => {
  describe('valid providers', () => {
    it('resolves "anthropic" to Anthropic provider', () => {
      const provider = resolveProvider('anthropic');

      expect(provider.name).toBe('Anthropic');
      expect(provider.api.url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('resolves "openai" to OpenAI provider', () => {
      const provider = resolveProvider('openai');

      expect(provider.name).toBe('OpenAI');
      expect(provider.api.baseUrl).toBe('https://api.openai.com/v1');
      expect(provider.api.url).toBe('/chat/completions');
    });

    it('resolves "deepseek" to DeepSeek provider', () => {
      const provider = resolveProvider('deepseek');

      expect(provider.name).toBe('DeepSeek');
      expect(provider.envKeyName).toBe('DEEPSEEK_API_KEY');
    });

    it('returns the same object as PROVIDERS', () => {
      const provider = resolveProvider('anthropic');
      expect(provider).toBe(PROVIDERS.anthropic);
    });
  });

  describe('invalid providers', () => {
    it('throws for unknown provider', () => {
      expect(() => resolveProvider('mistral'))
        .toThrow("Unknown provider: 'mistral'");
    });

    it('throws for empty string', () => {
      expect(() => resolveProvider(''))
        .toThrow("Unknown provider: ''");
    });

    it('error message includes valid providers', () => {
      expect(() => resolveProvider('invalid'))
        .toThrow(/Valid providers: anthropic, openai, deepseek, kimi/);
    });

    it('is case-sensitive (anthropic vs ANTHROPIC)', () => {
      expect(() => resolveProvider('ANTHROPIC'))
        .toThrow("Unknown provider: 'ANTHROPIC'");
    });
  });
});

// ============================================================================
// resolveModel()
// ============================================================================

describe('resolveModel()', () => {
  describe('Anthropic models', () => {
    const anthropic = resolveProvider('anthropic');

    it('resolves "haiku"', () => {
      const model = resolveModel(anthropic, 'haiku');

      expect(model.id).toBe('claude-haiku-4-5');
      expect(model.displayName).toBe('Claude 4.5 Haiku');
    });

    it('resolves "sonnet"', () => {
      const model = resolveModel(anthropic, 'sonnet');

      expect(model.id).toBe('claude-sonnet-5');
    });

    it('resolves "opus"', () => {
      const model = resolveModel(anthropic, 'opus');

      expect(model.id).toBe('claude-opus-4-6');
    });

    it('returns the same object as provider.models', () => {
      const model = resolveModel(anthropic, 'sonnet');
      expect(model).toBe(PROVIDERS.anthropic.models.sonnet);
    });
  });

  describe('OpenAI models', () => {
    const openai = resolveProvider('openai');

    it('resolves "gpt-4o"', () => {
      const model = resolveModel(openai, 'gpt-4o');

      expect(model.id).toBe('gpt-4o');
      expect(model.displayName).toBe('GPT-4o');
    });

    it('resolves "gpt-4o-mini"', () => {
      const model = resolveModel(openai, 'gpt-4o-mini');

      expect(model.displayName).toBe('GPT-4o Mini');
    });

    it('resolves "gpt-5.2"', () => {
      const model = resolveModel(openai, 'gpt-5.2');

      expect(model.capabilities.reasoning).toBe(true);
    });
  });

  describe('invalid models', () => {
    const anthropic = resolveProvider('anthropic');
    const openai = resolveProvider('openai');

    it('throws for unknown Anthropic model', () => {
      expect(() => resolveModel(anthropic, 'gpt-4o'))
        .toThrow("Unknown model: 'gpt-4o' for provider 'Anthropic'");
    });

    it('throws for unknown OpenAI model', () => {
      expect(() => resolveModel(openai, 'sonnet'))
        .toThrow("Unknown model: 'sonnet' for provider 'OpenAI'");
    });

    it('error message includes valid models', () => {
      expect(() => resolveModel(anthropic, 'invalid'))
        .toThrow(/Valid models: haiku, sonnet, opus/);
    });

    it('throws for empty string', () => {
      expect(() => resolveModel(anthropic, ''))
        .toThrow("Unknown model: ''");
    });
  });
});

// ============================================================================
// resolveProviderModel()
// ============================================================================

describe('resolveProviderModel()', () => {
  describe('valid references', () => {
    it('resolves "anthropic/sonnet"', () => {
      const { provider, model } = resolveProviderModel('anthropic/sonnet');

      expect(provider.name).toBe('Anthropic');
      expect(model.id).toBe('claude-sonnet-5');
    });

    it('resolves "anthropic/haiku"', () => {
      const { provider, model } = resolveProviderModel('anthropic/haiku');

      expect(model.displayName).toBe('Claude 4.5 Haiku');
    });

    it('resolves "anthropic/opus"', () => {
      const { provider, model } = resolveProviderModel('anthropic/opus');

      expect(model.pricing.input).toBe(5.00);
    });

    it('resolves "openai/gpt-4o"', () => {
      const { provider, model } = resolveProviderModel('openai/gpt-4o');

      expect(provider.name).toBe('OpenAI');
      expect(model.id).toBe('gpt-4o');
    });

    it('resolves "openai/gpt-4o-mini"', () => {
      const { provider, model } = resolveProviderModel('openai/gpt-4o-mini');

      expect(model.pricing.input).toBe(0.15);
    });

    it('resolves "openai/gpt-5.2"', () => {
      const { provider, model } = resolveProviderModel('openai/gpt-5.2');

      expect(model.quirks?.reasoningOverhead).toBe(2000);
    });
  });

  describe('invalid format', () => {
    it('throws for missing slash', () => {
      expect(() => resolveProviderModel('anthropic-sonnet'))
        .toThrow("Invalid provider/model reference: 'anthropic-sonnet'");
    });

    it('throws for too many slashes', () => {
      expect(() => resolveProviderModel('anthropic/sonnet/extra'))
        .toThrow("Invalid provider/model reference: 'anthropic/sonnet/extra'");
    });

    it('throws for empty string', () => {
      expect(() => resolveProviderModel(''))
        .toThrow("Invalid provider/model reference: ''");
    });

    it('throws for only slash', () => {
      expect(() => resolveProviderModel('/'))
        .toThrow(/Unknown provider: ''/);
    });

    it('error mentions expected format', () => {
      expect(() => resolveProviderModel('invalid'))
        .toThrow(/Expected format: 'provider\/model'/);
    });
  });

  describe('invalid provider or model', () => {
    it('throws for invalid provider', () => {
      expect(() => resolveProviderModel('mistral/large'))
        .toThrow("Unknown provider: 'mistral'");
    });

    it('throws for invalid model', () => {
      expect(() => resolveProviderModel('anthropic/invalid'))
        .toThrow("Unknown model: 'invalid'");
    });

    it('throws for cross-provider model', () => {
      expect(() => resolveProviderModel('anthropic/gpt-4o'))
        .toThrow("Unknown model: 'gpt-4o' for provider 'Anthropic'");
    });
  });
});

// ============================================================================
// isValidProviderModel()
// ============================================================================

describe('isValidProviderModel()', () => {
  describe('valid references', () => {
    it('returns true for "anthropic/sonnet"', () => {
      expect(isValidProviderModel('anthropic/sonnet')).toBe(true);
    });

    it('returns true for "anthropic/haiku"', () => {
      expect(isValidProviderModel('anthropic/haiku')).toBe(true);
    });

    it('returns true for "anthropic/opus"', () => {
      expect(isValidProviderModel('anthropic/opus')).toBe(true);
    });

    it('returns true for "openai/gpt-4o"', () => {
      expect(isValidProviderModel('openai/gpt-4o')).toBe(true);
    });

    it('returns true for "openai/gpt-4o-mini"', () => {
      expect(isValidProviderModel('openai/gpt-4o-mini')).toBe(true);
    });

    it('returns true for "openai/gpt-5.2"', () => {
      expect(isValidProviderModel('openai/gpt-5.2')).toBe(true);
    });
  });

  describe('invalid references', () => {
    it('returns false for invalid format', () => {
      expect(isValidProviderModel('anthropic-sonnet')).toBe(false);
    });

    it('returns false for invalid provider', () => {
      expect(isValidProviderModel('mistral/large')).toBe(false);
    });

    it('returns false for invalid model', () => {
      expect(isValidProviderModel('anthropic/invalid')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidProviderModel('')).toBe(false);
    });

    it('returns false for cross-provider model', () => {
      expect(isValidProviderModel('anthropic/gpt-4o')).toBe(false);
    });
  });

  it('does not throw on invalid input', () => {
    expect(() => isValidProviderModel('invalid')).not.toThrow();
    expect(() => isValidProviderModel('')).not.toThrow();
  });
});

// ============================================================================
// getAllProviderModels()
// ============================================================================

describe('getAllProviderModels()', () => {
  it('returns array of strings', () => {
    const all = getAllProviderModels();

    expect(Array.isArray(all)).toBe(true);
    for (const ref of all) {
      expect(typeof ref).toBe('string');
    }
  });

  it('includes Anthropic models', () => {
    const all = getAllProviderModels();

    expect(all).toContain('anthropic/haiku');
    expect(all).toContain('anthropic/sonnet');
    expect(all).toContain('anthropic/opus');
  });

  it('includes OpenAI models', () => {
    const all = getAllProviderModels();

    expect(all).toContain('openai/gpt-4o');
    expect(all).toContain('openai/gpt-4o-mini');
    expect(all).toContain('openai/gpt-5.2');
  });

  it('returns expected count', () => {
    const all = getAllProviderModels();

    // 3 Anthropic + 3 OpenAI + 4 DeepSeek + 4 Kimi = 14
    expect(all.length).toBe(14);
  });

  it('all returned values are valid', () => {
    const all = getAllProviderModels();

    for (const ref of all) {
      expect(isValidProviderModel(ref)).toBe(true);
    }
  });

  it('all returned values can be resolved', () => {
    const all = getAllProviderModels();

    for (const ref of all) {
      const { provider, model } = resolveProviderModel(ref);
      expect(provider).toBeDefined();
      expect(model).toBeDefined();
    }
  });
});

// ============================================================================
// Integration / Real-world Scenarios
// ============================================================================

describe('real-world scenarios', () => {
  it('config value from DB can be resolved', () => {
    // Simulating: state.summarize_provider = 'anthropic', state.summarize_model = 'sonnet'
    const providerName = 'anthropic';
    const modelName = 'sonnet';

    const provider = resolveProvider(providerName);
    const model = resolveModel(provider, modelName);

    expect(model.id).toBe('claude-sonnet-5');
    expect(model.pricing.input).toBe(3.00);
  });

  it('combined reference from config can be resolved', () => {
    // Simulating: config.defaultModel = 'openai/gpt-4o-mini'
    const ref = 'openai/gpt-4o-mini';

    const { provider, model } = resolveProviderModel(ref);

    expect(provider.envKeyName).toBe('OPENAI_API_KEY');
    expect(model.pricing.input).toBe(0.15);
  });

  it('validation before resolve prevents errors', () => {
    const userInput = 'invalid/model';

    if (isValidProviderModel(userInput)) {
      // This block won't run
      resolveProviderModel(userInput);
    } else {
      // Handle invalid input gracefully
      expect(true).toBe(true);
    }
  });

  it('can iterate all models to find cheapest', () => {
    const all = getAllProviderModels();

    let cheapest = { ref: '', price: Infinity };

    for (const ref of all) {
      const { model } = resolveProviderModel(ref);
      const cost = model.pricing.input + model.pricing.output;
      if (cost < cheapest.price) {
        cheapest = { ref, price: cost };
      }
    }

    // deepseek-chat is currently the cheapest registered remote option (0.14 + 0.28 = 0.42)
    expect(cheapest.ref).toBe('deepseek/deepseek-chat');
    expect(cheapest.price).toBeCloseTo(0.42, 6);
  });
});
