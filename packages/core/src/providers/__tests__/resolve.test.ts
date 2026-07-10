/**
 * Tests for Provider Resolution Functions
 *
 * @module @persistence/core/providers/__tests__/resolve
 */

import { describe, it, expect } from 'vitest';
import {
  resolveProvider,
  resolveModel,
  resolveModelById,
  resolveProviderModel,
  isValidProviderModel,
  getAllProviderModels,
} from '../resolve';
import { anthropic } from '../anthropic';
import { openai } from '../openai';

describe('resolveProvider', () => {
  it('resolves anthropic provider', () => {
    const provider = resolveProvider('anthropic');
    expect(provider).toBe(anthropic);
    expect(provider.name).toBe('Anthropic');
  });

  it('resolves openai provider', () => {
    const provider = resolveProvider('openai');
    expect(provider).toBe(openai);
    expect(provider.name).toBe('OpenAI');
  });

  it('throws for unknown provider', () => {
    expect(() => resolveProvider('unknown')).toThrow(
      "Unknown provider: 'unknown'. Valid providers: anthropic, openai"
    );
  });

  it('throws for empty string provider', () => {
    expect(() => resolveProvider('')).toThrow("Unknown provider: ''");
  });

  it('is case-sensitive', () => {
    expect(() => resolveProvider('Anthropic')).toThrow("Unknown provider: 'Anthropic'");
    expect(() => resolveProvider('OPENAI')).toThrow("Unknown provider: 'OPENAI'");
  });
});

describe('resolveModel', () => {
  it('resolves anthropic model by key', () => {
    const provider = resolveProvider('anthropic');
    const model = resolveModel(provider, 'sonnet');
    expect(model.displayName).toBe('Claude 4.6 Sonnet');
    expect(model.id).toContain('sonnet');
  });

  it('resolves openai model by key', () => {
    const provider = resolveProvider('openai');
    const model = resolveModel(provider, 'gpt-4o-mini');
    expect(model.displayName).toContain('Mini');
  });

  it('throws for unknown model', () => {
    const provider = resolveProvider('anthropic');
    expect(() => resolveModel(provider, 'nonexistent')).toThrow(
      "Unknown model: 'nonexistent' for provider 'Anthropic'"
    );
  });

  it('includes valid models in error message', () => {
    const provider = resolveProvider('anthropic');
    expect(() => resolveModel(provider, 'bad')).toThrow('Valid models:');
  });
});

describe('resolveModelById', () => {
  it('finds anthropic model by exact ID', () => {
    const provider = resolveProvider('anthropic');
    const model = resolveModelById(provider, anthropic.models.sonnet.id);
    expect(model).toBeDefined();
    expect(model?.displayName).toBe('Claude 4.6 Sonnet');
  });

  it('finds openai model by exact ID', () => {
    const provider = resolveProvider('openai');
    const model = resolveModelById(provider, openai.models['gpt-4o-mini'].id);
    expect(model).toBeDefined();
    expect(model?.displayName).toContain('Mini');
  });

  it('returns undefined for unknown ID', () => {
    const provider = resolveProvider('anthropic');
    const model = resolveModelById(provider, 'not-a-real-model-id');
    expect(model).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    const provider = resolveProvider('anthropic');
    const model = resolveModelById(provider, '');
    expect(model).toBeUndefined();
  });

  it('returns undefined for partial ID match', () => {
    const provider = resolveProvider('anthropic');
    // Should not match 'claude' as it's not the full ID
    const model = resolveModelById(provider, 'claude');
    expect(model).toBeUndefined();
  });

  it('does not cross-match between providers', () => {
    const anthropicProvider = resolveProvider('anthropic');
    const openaiModel = openai.models['gpt-4o-mini'];
    // OpenAI model ID should not be found in Anthropic provider
    const result = resolveModelById(anthropicProvider, openaiModel.id);
    expect(result).toBeUndefined();
  });
});

describe('resolveProviderModel', () => {
  it('resolves valid provider/model reference', () => {
    const { provider, model } = resolveProviderModel('anthropic/sonnet');
    expect(provider.name).toBe('Anthropic');
    expect(model.displayName).toBe('Claude 4.6 Sonnet');
  });

  it('resolves openai provider/model reference', () => {
    const { provider, model } = resolveProviderModel('openai/gpt-4o-mini');
    expect(provider.name).toBe('OpenAI');
    expect(model.displayName).toContain('Mini');
  });

  it('throws for invalid format (no slash)', () => {
    expect(() => resolveProviderModel('anthropic')).toThrow(
      "Invalid provider/model reference: 'anthropic'. Expected format: 'provider/model'"
    );
  });

  it('throws for invalid format (too many slashes)', () => {
    expect(() => resolveProviderModel('anthropic/sonnet/extra')).toThrow(
      "Invalid provider/model reference"
    );
  });

  it('throws for unknown provider', () => {
    expect(() => resolveProviderModel('unknown/model')).toThrow("Unknown provider: 'unknown'");
  });

  it('throws for unknown model', () => {
    expect(() => resolveProviderModel('anthropic/nonexistent')).toThrow(
      "Unknown model: 'nonexistent'"
    );
  });
});

describe('isValidProviderModel', () => {
  it('returns true for valid reference', () => {
    expect(isValidProviderModel('anthropic/sonnet')).toBe(true);
    expect(isValidProviderModel('openai/gpt-4o-mini')).toBe(true);
  });

  it('returns false for invalid reference', () => {
    expect(isValidProviderModel('invalid')).toBe(false);
    expect(isValidProviderModel('unknown/model')).toBe(false);
    expect(isValidProviderModel('anthropic/nonexistent')).toBe(false);
    expect(isValidProviderModel('')).toBe(false);
  });
});

describe('getAllProviderModels', () => {
  it('returns array of provider/model strings', () => {
    const all = getAllProviderModels();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it('includes anthropic models', () => {
    const all = getAllProviderModels();
    expect(all).toContain('anthropic/sonnet');
    expect(all).toContain('anthropic/opus');
    expect(all).toContain('anthropic/haiku');
  });

  it('includes openai models', () => {
    const all = getAllProviderModels();
    expect(all.some(ref => ref.startsWith('openai/'))).toBe(true);
  });

  it('all entries are valid references', () => {
    const all = getAllProviderModels();
    for (const ref of all) {
      expect(isValidProviderModel(ref)).toBe(true);
    }
  });
});
