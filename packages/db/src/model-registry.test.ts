/**
 * Model registry contract tests — I1 (config-as-data)
 *
 * @module @persistence/db/model-registry.test
 * @description Pins (1) registry validation (malformed shapes rejected so the
 * self-healing seed path triggers instead of half-parsed garbage) and (2) the
 * resolution ladder's PRIORITY SEMANTICS via the pure pickEffectiveModel.
 *
 * Tests: packages/db/src/model-registry.ts::parseModelRegistry, ::pickEffectiveModel
 */

import { describe, it, expect } from 'vitest';
import { parseModelRegistry, pickEffectiveModel } from './model-registry';

const VALID = {
  models: [
    { id: 'claude-opus-4-6', label: 'Opus (Deep)', provider: 'anthropic', tier: 'deep' },
    { id: 'claude-haiku-4-5', label: 'Haiku (Fast)', provider: 'anthropic' },
  ],
  defaultId: 'claude-haiku-4-5',
};

describe('parseModelRegistry', () => {
  it('accepts a valid registry', () => {
    expect(parseModelRegistry(VALID)).toEqual(VALID);
  });

  it('rejects malformed shapes (each triggers re-seed, not half-parse)', () => {
    expect(parseModelRegistry(null)).toBeNull();
    expect(parseModelRegistry([])).toBeNull();
    expect(parseModelRegistry({})).toBeNull();
    expect(parseModelRegistry({ models: [], defaultId: 'x' })).toBeNull();
    expect(parseModelRegistry({ models: VALID.models })).toBeNull(); // no defaultId
    expect(parseModelRegistry({ models: [{ id: '' }], defaultId: 'x' })).toBeNull();
    // defaultId must be a member of models
    expect(parseModelRegistry({ models: VALID.models, defaultId: 'not-a-member' })).toBeNull();
  });

  it('drops unknown entry fields but keeps tier when present', () => {
    const parsed = parseModelRegistry({
      models: [{ id: 'm1', label: 'M1', provider: 'p', tier: 'fast', extra: 'ignored' }],
      defaultId: 'm1',
    });
    expect(parsed).toEqual({
      models: [{ id: 'm1', label: 'M1', provider: 'p', tier: 'fast' }],
      defaultId: 'm1',
    });
  });
});

describe('pickEffectiveModel — ladder priority', () => {
  const base = { defaultId: 'default-model' };

  it('options.model wins over everything', () => {
    expect(
      pickEffectiveModel({ ...base, optionsModel: 'opt', personaModel: 'per', stateModel: 'sta' }),
    ).toBe('opt');
  });

  it('personas.model wins over state + default', () => {
    expect(pickEffectiveModel({ ...base, personaModel: 'per', stateModel: 'sta' })).toBe('per');
  });

  it('state selected_model wins over default', () => {
    expect(pickEffectiveModel({ ...base, stateModel: 'sta' })).toBe('sta');
  });

  it('falls through to the registry default', () => {
    expect(pickEffectiveModel(base)).toBe('default-model');
  });

  it('empty/whitespace rungs fall through (no empty-string model)', () => {
    expect(
      pickEffectiveModel({ ...base, optionsModel: '  ', personaModel: '', stateModel: null }),
    ).toBe('default-model');
  });
});
